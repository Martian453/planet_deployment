const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 8000;

// Store connected browser clients
const clients = new Set();

// --- API ENDPOINTS ---

// 1. Get Live State (Restores values on Page Load)
app.get('/api/borewells', (req, res) => {
  db.all("SELECT * FROM borewell_state", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 2. Get Historical Data (For Trend Graphs)
app.get('/api/history/:id', (req, res) => {
  const { id } = req.params;
  const limit = req.query.limit || 50; // Last 50 points
  db.all("SELECT * FROM readings_history WHERE borewell_id = ? ORDER BY timestamp DESC LIMIT ?", [id, limit], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.reverse()); // Return in chronological order
  });
});

app.get('/api/aqi/history', (req, res) => {
  db.all('SELECT * FROM aqi_history ORDER BY timestamp DESC LIMIT 100', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.reverse());
  });
});

// 3. Control Toggle (UI -> Backend -> LoRa)
app.post('/api/control', (req, res) => {
  const { id, command } = req.body;
  console.log(`🔌 Command to Borewell ${id}: ${command}`);

  const state = command === 'ON' ? 1 : 0;
  db.run("UPDATE borewell_state SET is_motor_on = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?", [state, id], (err) => {
    if (err) return res.status(500).json({ error: err.message });

    // Broadcast status update to all connected dashboard clients
    broadcast({
      type: 'control_update',
      id: id,
      is_motor_on: state === 1
    });

    res.json({ status: 'Command Sent', id, state: command });
  });
});

// 4. Periodically Save Snapshots into History (Every 5 Minutes)
const saveHistoricalSnapshot = () => {
  db.all("SELECT * FROM borewell_state", (err, rows) => {
    if (err) return console.error("History Error:", err.message);
    if (!rows) return;
    rows.forEach(row => {
      db.run(`INSERT INTO readings_history 
                (borewell_id, flow_rate, water_level, efficiency, voltage, current, ph, tds, turbidity) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.flow_rate, row.water_level, row.efficiency, row.voltage, row.current, row.ph, row.tds, row.turbidity]
      );
    });
    console.log("📈 Historical snapshot saved.");
  });
};
setInterval(saveHistoricalSnapshot, 1000 * 60 * 5); // 5 minutes

// 5. Receive Data from Heltec Gateway (Heltec -> Backend)
app.post('/api/push', (req, res) => {
  const payload = req.body;

  if (payload.type === 'water' || payload.flow_rate !== undefined || payload.flow_lpm !== undefined || payload.current !== undefined || payload.ph !== undefined || payload.tds !== undefined) {
    const id = payload.id || 'BW-01';
    
    // Retrieve current row values to prevent partial updates from clearing other sensors
    db.get("SELECT * FROM borewell_state WHERE id = ?", [id], (err, row) => {
      if (err) return console.error(err.message);
      
      const current_state = row || {};
      
      // Parse values from payload (coercing strings to safe floats/numbers)
      const rawFlow = payload.flow_rate !== undefined ? payload.flow_rate : (payload.flow_lpm !== undefined ? payload.flow_lpm : (payload.flow !== undefined ? payload.flow : null));
      const flow = rawFlow !== null ? parseFloat(rawFlow) : (current_state.flow_rate !== undefined ? current_state.flow_rate : 0.0);

      const rawCurrent = payload.current !== undefined ? payload.current : (payload.a !== undefined ? payload.a : null);
      const a = rawCurrent !== null ? parseFloat(rawCurrent) : (current_state.current !== undefined ? current_state.current : 0.0);

      const rawPh = payload.ph !== undefined ? payload.ph : null;
      const phVal = rawPh !== null ? parseFloat(rawPh) : null;

      const rawTds = payload.tds !== undefined ? payload.tds : null;
      const tdsVal = rawTds !== null ? parseFloat(rawTds) : null;

      const rawTurb = payload.turbidity !== undefined ? payload.turbidity : (payload.turbidity_ntu !== undefined ? payload.turbidity_ntu : null);
      const turbVal = rawTurb !== null ? parseFloat(rawTurb) : null;

      const incomingLevelTemp = payload.wl !== undefined ? payload.wl : (payload.water_level !== undefined ? payload.water_level : null);
      const wlVal = incomingLevelTemp !== null ? parseFloat(incomingLevelTemp) : null;

      // Check if incoming payload is a zero-packet (sensor dropout/offline condition)
      const isZeroWaterPayload = (phVal === 0 || phVal === 0.0) && (tdsVal === 0 || tdsVal === 0.0);

      // 1. Derive Voltage (v) based on Current (a)
      let v = payload.v !== undefined ? payload.v : (a > 0.5 ? (228.0 - (a * 0.4) + (Math.sin(Date.now() / 5000) * 1.5)) : (235.0 + (Math.sin(Date.now() / 10000) * 1.0)));
      v = parseFloat(Number(v).toFixed(1));

      // 2. Derive Pump Efficiency (eff)
      let eff = payload.eff !== undefined ? payload.eff : 0.0;
      if (payload.eff === undefined && a > 0.5 && flow > 0) {
        eff = Math.min(92, Math.max(50, Math.round((flow * 14.5) / a)));
      }

      // 3. Derive Water Level (wl) - simulating drawdown and aquifer recharge
      let wl = wlVal;
      if (isZeroWaterPayload || wl === 0) {
        wl = current_state.water_level !== undefined ? current_state.water_level : 5.5;
      } else if (wl === null) {
        let last_wl = current_state.water_level !== undefined ? current_state.water_level : 5.5;
        if (a > 0.5 && flow > 0) {
          // Drawdown: Water level decreases as we pump it out
          wl = Math.max(1.2, last_wl - 0.02 * (flow / 40.0));
        } else {
          // Recovery: Water level slowly rises back up to the aquifer static level (5.5m)
          wl = Math.min(5.5, last_wl + 0.005);
        }
      }
      wl = parseFloat(Number(wl).toFixed(2));

      // 4. Derive Run Time (rt)
      let rt = payload.rt !== undefined ? payload.rt : null;
      if (rt === null) {
        let last_rt = current_state.run_time_total !== undefined ? current_state.run_time_total : 0.0;
        if (a > 0.5) {
          let deltaHours = 1.0 / 3600.0;
          if (current_state.last_updated) {
            const lastTime = new Date(current_state.last_updated + " UTC").getTime();
            const deltaMs = Date.now() - lastTime;
            if (deltaMs > 0 && deltaMs < 300000) {
              deltaHours = deltaMs / (1000.0 * 3600.0);
            }
          }
          rt = last_rt + deltaHours;
        } else {
          rt = last_rt;
        }
      }
      rt = parseFloat(Number(rt).toFixed(3));

      // Preserve last values on zero packet
      const ph = isZeroWaterPayload ? (current_state.ph !== undefined ? current_state.ph : 7.2) : (phVal !== null ? phVal : (current_state.ph !== undefined ? current_state.ph : 7.2));
      const tds = isZeroWaterPayload ? (current_state.tds !== undefined ? current_state.tds : 250.0) : (tdsVal !== null ? tdsVal : (current_state.tds !== undefined ? current_state.tds : 250.0));
      const turbidity = isZeroWaterPayload ? (current_state.turbidity !== undefined ? current_state.turbidity : 1.2) : (turbVal !== null ? turbVal : (current_state.turbidity !== undefined ? current_state.turbidity : 1.2));
      
      const rawTotalLiters = payload.total_liters !== undefined ? payload.total_liters : null;
      const total_liters = rawTotalLiters !== null ? parseFloat(rawTotalLiters) : (current_state.total_liters !== undefined ? current_state.total_liters : 0.0);

      const current_status = payload.current_status !== undefined ? payload.current_status : (current_state.current_status !== undefined ? current_state.current_status : 'OFF');
      const water_status = isZeroWaterPayload ? (current_state.water_status || 'PROBE DRY') : (payload.water_status !== undefined ? payload.water_status : (current_state.water_status !== undefined ? current_state.water_status : 'NORMAL'));
      const turbidity_status = isZeroWaterPayload ? (current_state.turbidity_status || 'CLEAR') : (payload.turbidity_status !== undefined ? payload.turbidity_status : (current_state.turbidity_status !== undefined ? current_state.turbidity_status : 'CLEAR'));
      const tds_status = isZeroWaterPayload ? (current_state.tds_status || 'GOOD') : (payload.tds_status !== undefined ? payload.tds_status : (current_state.tds_status !== undefined ? current_state.tds_status : 'GOOD'));

      // Derive motor status: ON if current (amps) > 0.5A, else OFF
      const is_motor_on = a > 0.5 ? 1 : 0;

      db.run(`UPDATE borewell_state SET 
        flow_rate = ?, efficiency = ?, voltage = ?, current = ?, run_time_total = ?, water_level = ?, 
        ph = ?, tds = ?, turbidity = ?, is_motor_on = ?, total_liters = ?, current_status = ?, 
        water_status = ?, turbidity_status = ?, tds_status = ?, last_updated = CURRENT_TIMESTAMP 
        WHERE id = ?`,
        [flow, eff, v, a, rt, wl, ph, tds, turbidity, is_motor_on, total_liters, current_status, water_status, turbidity_status, tds_status, id],
        function (err) {
          if (err) return console.error(err.message);

          console.log(`💧 Water Data Ingested (Merged): ID=${id}, Flow=${flow} LPM, TDS=${tds} ppm (${tds_status}), pH=${ph} (${water_status}), Turbidity=${turbidity} NTU (${turbidity_status}), Amps=${a} (${current_status}), MotorOn=${is_motor_on === 1}`);

          // Broadcast to Frontend
          broadcast({
            type: 'water',
            id: id,
            timestamp: new Date().toISOString(),
            isMotorOn: is_motor_on === 1,
            data: {
              flowRate: flow,
              efficiency: eff,
              voltage: v,
              current: a,
              runTime: rt,
              waterLevel: wl,
              ph: ph,
              tds: tds,
              turbidity: turbidity,
              totalLiters: total_liters,
              currentStatus: current_status,
              waterStatus: water_status,
              turbidityStatus: turbidity_status,
              tdsStatus: tds_status
            }
          });
        }
      );
    });
  }
  res.sendStatus(200);
});

// CPCB AQI Calculation Utility
function calculateCpcbSubIndex(conc, pollutant) {
  const breakpoints = {
    pm25: [
      { cL: 0, cH: 30, iL: 0, iH: 50 },
      { cL: 31, cH: 60, iL: 51, iH: 100 },
      { cL: 61, cH: 90, iL: 101, iH: 200 },
      { cL: 91, cH: 120, iL: 201, iH: 300 },
      { cL: 121, cH: 250, iL: 301, iH: 400 },
      { cL: 251, cH: 500, iL: 401, iH: 500 },
    ],
    pm10: [
      { cL: 0, cH: 50, iL: 0, iH: 50 },
      { cL: 51, cH: 100, iL: 51, iH: 100 },
      { cL: 101, cH: 250, iL: 101, iH: 200 },
      { cL: 251, cH: 350, iL: 201, iH: 300 },
      { cL: 351, cH: 430, iL: 301, iH: 400 },
      { cL: 431, cH: 600, iL: 401, iH: 500 },
    ]
  };

  const bp = breakpoints[pollutant];
  if (!bp) return 0;
  const range = bp.find(b => conc >= b.cL && conc <= b.cH);
  if (!range) return conc > bp[bp.length - 1].cH ? 500 : 0;

  return Math.round(((range.iH - range.iL) / (range.cH - range.cL)) * (conc - range.cL) + range.iL);
}

app.post('/api/aqi', (req, res) => {
  const { pm25, pm10, co2, tvoc, hcho, temp, humidity } = req.body;
  
  // Compute official CPCB AQI
  const pm25Idx = calculateCpcbSubIndex(pm25 || 0, 'pm25');
  const pm10Idx = calculateCpcbSubIndex(pm10 || 0, 'pm10');
  const score = Math.max(pm25Idx, pm10Idx);

  const getCategory = (v) => {
    if (v <= 50) return "Good";
    if (v <= 100) return "Satisfactory";
    if (v <= 200) return "Moderate";
    if (v <= 300) return "Poor";
    if (v <= 400) return "Very Poor";
    return "Severe";
  };

  db.run(`INSERT INTO aqi_history 
    (pm25, pm10, co2, tvoc, hcho, temp, humidity, aqi) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [pm25, pm10, co2, tvoc, hcho, temp, humidity, score],
    function(err) {
      if (err) return console.error("AQI DB Error:", err.message);
      
      broadcast({
        type: 'aqi',
        timestamp: new Date().toISOString(),
        data: {
          pm25, pm10, co2, tvoc, hcho, temp, humidity,
          aqi: score,
          category: getCategory(score),
          dominant_pollutant: pm25Idx >= pm10Idx ? "pm25" : "pm10"
        }
      });
    }
  );
  
  console.log(`🌬️ AQI Data Ingested: ${score} (${getCategory(score)}). PM2.5=${pm25}`);
  res.json({
    aqi: score,
    category: getCategory(score),
    dominant_pollutant: pm25Idx >= pm10Idx ? "pm25" : "pm10"
  });
});

// --- WEBSOCKET LOGIC ---

wss.on('connection', (ws, req) => {
  console.log('📱 Dashboard App Connected via WebSocket');
  clients.add(ws);

  ws.on('close', () => {
    clients.delete(ws);
    console.log('❌ Dashboard Disconnected');
  });

  // Small heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() }));
    }
  }, 10000);

  ws.on('error', () => clients.delete(ws));
});

function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// --- HARDWARE SIMULATOR (For Local Testing) ---
const simulateHardware = () => {
  console.log("🛠️ Starting Hardware Simulator...");
  setInterval(() => {
    // 1. Simulate Water/Borewell Data
    for (let i = 1; i <= 3; i++) {
      const mockWaterData = {
        location_id: "default",
        device_id: `borewell-${i}`,
        type: 'water',
        timestamp: new Date().toISOString(),
        data: {
          flowRate: (40 + Math.random() * 10).toFixed(1),
          efficiency: (70 + Math.random() * 10).toFixed(0),
          voltage: (230 + Math.random() * 5).toFixed(0),
          current: (8 + Math.random() * 2).toFixed(1),
          runTime: (4.5 + Math.random() * 0.1).toFixed(2),
          waterLevel: (50 + Math.sin(Date.now() / 10000) * 5).toFixed(1)
        }
      };
      broadcast(mockWaterData);
    }

    // 2. Simulate AQI Data
    const mockAqiData = {
      type: 'aqi',
      timestamp: new Date().toISOString(),
      data: {
        pm25: (10 + Math.random() * 5).toFixed(1),
        pm10: (20 + Math.random() * 10).toFixed(1),
        co2: (400 + Math.random() * 50).toFixed(0),
        tvoc: (0.1 + Math.random() * 0.05).toFixed(3),
        hcho: (0.02 + Math.random() * 0.01).toFixed(3),
        temp: (24 + Math.random() * 2).toFixed(1),
        humidity: (55 + Math.random() * 5).toFixed(0),
        aqi: (90 + Math.random() * 5).toFixed(0)
      }
    };
    broadcast(mockAqiData);

  }, 5000); // 5 second intervals to match ESP32
};

// Auto-start simulator for testing
// simulateHardware();

// 7. Start the Server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🛠️ Starting Edge Backend Hub...`);
  console.log(`🚀 Edge Backend Hub Running on http://localhost:${PORT}`);
});
