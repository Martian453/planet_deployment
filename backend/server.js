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
                (borewell_id, flow_rate, water_level, efficiency, voltage, current) 
                VALUES (?, ?, ?, ?, ?, ?)`,
        [row.id, row.flow_rate, row.water_level, row.efficiency, row.voltage, row.current]
      );
    });
    console.log("📈 Historical snapshot saved.");
  });
};
setInterval(saveHistoricalSnapshot, 1000 * 60 * 5); // 5 minutes

// 5. Receive Data from Heltec Gateway (Heltec -> Backend)
app.post('/api/push', (req, res) => {
  const payload = req.body;

  if (payload.type === 'water') {
    db.run(`UPDATE borewell_state SET 
      flow_rate = ?, efficiency = ?, voltage = ?, current = ?, run_time_total = ?, water_level = ?, last_updated = CURRENT_TIMESTAMP 
      WHERE id = ?`,
      [payload.flow, payload.eff, payload.v, payload.a, payload.rt, payload.wl, payload.id],
      function (err) {
        if (err) return console.error(err.message);

        // Broadcast to Frontend
        broadcast({
          type: 'water',
          id: payload.id,
          timestamp: new Date().toISOString(),
          data: {
            flowRate: payload.flow,
            efficiency: payload.eff,
            voltage: payload.v,
            current: payload.a,
            runTime: payload.rt,
            waterLevel: payload.wl
          }
        });
      }
    );
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
