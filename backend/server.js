const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const db = require('./db');
const { requireApiKey, requireDashboardAuth } = require('./middleware/auth');
const { 
  safeFloat, 
  validateWaterPayload, 
  validateAqiPayload, 
  validateControlPayload 
} = require('./middleware/validate');
const rateLimiter = require('./middleware/rate-limit');

const app = express();

// AUDIT FIX (Finding 4.2 — High): Enable configurable CORS origin restriction
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*'
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter);

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8000;

// Store connected browser clients
const clients = new Set();

// --- API ENDPOINTS ---

// AUDIT FIX (Finding 2.5 — High): Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime_seconds: Math.floor(process.uptime()),
    database: db ? 'connected' : 'disconnected',
    active_websockets: clients.size,
    timestamp: new Date().toISOString()
  });
});

// 1. Get Live State (Restores values on Page Load)
app.get('/api/borewells', requireDashboardAuth, (req, res) => {
  db.all("SELECT * FROM borewell_state", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 2. Get Historical Data (For Trend Graphs)
app.get('/api/history/:id', requireDashboardAuth, (req, res) => {
  const { id } = req.params;
  const limit = parseInt(req.query.limit, 10) || 50; // Last 50 points
  db.all("SELECT * FROM readings_history WHERE borewell_id = ? ORDER BY timestamp DESC LIMIT ?", [id, limit], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.reverse()); // Return in chronological order
  });
});

app.get('/api/aqi/history', requireDashboardAuth, (req, res) => {
  db.all('SELECT * FROM aqi_history ORDER BY timestamp DESC LIMIT 100', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.reverse());
  });
});

// CSV Export Endpoint - Merges Water and Air historical readings
app.get('/api/export/csv', requireDashboardAuth, (req, res) => {
  db.all('SELECT * FROM readings_history ORDER BY timestamp DESC', [], (err, waterRows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.all('SELECT * FROM aqi_history ORDER BY timestamp DESC', [], (err, aqiRows) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const combined = [];
      
      if (waterRows) {
        waterRows.forEach(row => {
          combined.push({
            timestamp: row.timestamp,
            type: 'Water',
            id: row.borewell_id,
            water_level: row.water_level,
            flow_rate: row.flow_rate,
            efficiency: row.efficiency,
            voltage: row.voltage,
            current: row.current,
            ph: row.ph,
            tds: row.tds,
            turbidity: row.turbidity,
            pm25: '',
            pm10: '',
            co2: '',
            tvoc: '',
            hcho: '',
            temp: '',
            humidity: '',
            aqi: ''
          });
        });
      }
      
      if (aqiRows) {
        aqiRows.forEach(row => {
          combined.push({
            timestamp: row.timestamp,
            type: 'Air',
            id: 'AQI-01',
            water_level: '',
            flow_rate: '',
            efficiency: '',
            voltage: '',
            current: '',
            ph: '',
            tds: '',
            turbidity: '',
            pm25: row.pm25,
            pm10: row.pm10,
            co2: row.co2,
            tvoc: row.tvoc,
            hcho: row.hcho,
            temp: row.temp,
            humidity: row.humidity,
            aqi: row.aqi
          });
        });
      }
      
      // Sort chronologically, newest first
      combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      const headers = [
        'Timestamp', 'Type', 'Source ID', 'Water Level (%)', 'Flow Rate (L/min)', 'Efficiency (%)',
        'Voltage (V)', 'Current (A)', 'pH', 'TDS (ppm)', 'Turbidity (NTU)', 'PM2.5 (ug/m3)',
        'PM10 (ug/m3)', 'CO2 (ppm)', 'TVOC (ppm)', 'HCHO (ppm)', 'Temperature (C)', 'Humidity (%)', 'AQI'
      ];
      
      let csvContent = headers.join(',') + '\n';
      
      combined.forEach(row => {
        const line = [
          row.timestamp,
          row.type,
          row.id,
          row.water_level,
          row.flow_rate,
          row.efficiency,
          row.voltage,
          row.current,
          row.ph,
          row.tds,
          row.turbidity,
          row.pm25,
          row.pm10,
          row.co2,
          row.tvoc,
          row.hcho,
          row.temp,
          row.humidity,
          row.aqi
        ].map(val => {
          const str = String(val === null || val === undefined ? '' : val);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(',');
        
        csvContent += line + '\n';
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=environmental_readings.csv');
      res.status(200).send(csvContent);
    });
  });
});

// 3. Control Toggle (UI -> Backend -> LoRa)
app.post('/api/control', requireDashboardAuth, validateControlPayload, (req, res) => {
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

// 4. Periodically Save Snapshots into History (Keep as fallback, but we now insert on ingest)
const saveHistoricalSnapshot = () => {
  db.all("SELECT * FROM borewell_state", (err, rows) => {
    if (err) return console.error("History Error:", err.message);
    if (!rows) return;
    rows.forEach(row => {
      db.run(`INSERT INTO readings_history 
                (borewell_id, flow_rate, water_level, efficiency, voltage, current, ph, tds, turbidity, total_liters, current_status, water_status, turbidity_status, tds_status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.flow_rate, row.water_level, row.efficiency, row.voltage, row.current, row.ph, row.tds, row.turbidity, row.total_liters, row.current_status, row.water_status, row.turbidity_status, row.tds_status]
      );
    });
    console.log("📈 Periodic historical snapshot saved.");
  });
};
setInterval(saveHistoricalSnapshot, 1000 * 60 * 5); // 5 minutes

// 5. Receive Data from Heltec Gateway (Heltec -> Backend)
app.post('/api/push', requireApiKey, validateWaterPayload, (req, res) => {
  const payload = req.body;

  const id = payload.id || 'BW-01';
  
  // Retrieve current row values to prevent partial updates from clearing other sensors
  db.get("SELECT * FROM borewell_state WHERE id = ?", [id], (err, row) => {
    if (err) {
      console.error("DB read error during ingestion:", err.message);
      return res.status(500).json({ error: err.message });
    }
    
    const current_state = row || {};
    
    // Parse values from payload safely using safeFloat validator helper (Finding 5.4)
    const rawFlow = payload.flow_rate !== undefined ? payload.flow_rate : (payload.flow_lpm !== undefined ? payload.flow_lpm : (payload.flow !== undefined ? payload.flow : null));
    const flow = safeFloat(rawFlow, current_state.flow_rate !== undefined ? current_state.flow_rate : 0.0);

    const rawCurrent = payload.current !== undefined ? payload.current : (payload.a !== undefined ? payload.a : null);
    const a = safeFloat(rawCurrent, current_state.current !== undefined ? current_state.current : 0.0);

    const phVal = safeFloat(payload.ph);
    const tdsVal = safeFloat(payload.tds);
    const rawTurb = payload.turbidity !== undefined ? payload.turbidity : (payload.turbidity_ntu !== undefined ? payload.turbidity_ntu : null);
    const turbVal = safeFloat(rawTurb);

    const incomingLevelTemp = payload.wl !== undefined ? payload.wl : (payload.water_level !== undefined ? payload.water_level : null);
    const wlVal = safeFloat(incomingLevelTemp);

    // Check if incoming payload is a zero-packet (sensor dropout/offline condition)
    const isZeroWaterPayload = (phVal === 0 || phVal === 0.0) && (tdsVal === 0 || tdsVal === 0.0);

    // 1. Derive Voltage (v) based on Current (a)
    let v = payload.v !== undefined ? safeFloat(payload.v) : (a > 0.5 ? (228.0 - (a * 0.4) + (Math.sin(Date.now() / 5000) * 1.5)) : (235.0 + (Math.sin(Date.now() / 10000) * 1.0)));
    v = parseFloat(Number(v).toFixed(1));

    // 2. Derive Pump Efficiency (eff)
    let eff = payload.eff !== undefined ? safeFloat(payload.eff) : 0.0;
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
    let rt = payload.rt !== undefined ? safeFloat(payload.rt) : null;
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
    const total_liters = safeFloat(rawTotalLiters, current_state.total_liters !== undefined ? current_state.total_liters : 0.0);

    const current_status = payload.current_status !== undefined ? payload.current_status : (current_state.current_status !== undefined ? current_state.current_status : 'OFF');
    const water_status = isZeroWaterPayload ? (current_state.water_status || 'PROBE DRY') : (payload.water_status !== undefined ? payload.water_status : (current_state.water_status !== undefined ? current_state.water_status : 'NORMAL'));
    const turbidity_status = isZeroWaterPayload ? (current_state.turbidity_status || 'CLEAR') : (payload.turbidity_status !== undefined ? payload.turbidity_status : (current_state.turbidity_status !== undefined ? current_state.turbidity_status : 'CLEAR'));
    const tds_status = isZeroWaterPayload ? (current_state.tds_status || 'GOOD') : (payload.tds_status !== undefined ? payload.tds_status : (current_state.tds_status !== undefined ? current_state.tds_status : 'GOOD'));

    // Derive motor status: ON if current (amps) > 0.5A, else OFF
    const is_motor_on = a > 0.5 ? 1 : 0;

    // Perform database UPDATE of live state
    db.run(`UPDATE borewell_state SET 
      flow_rate = ?, efficiency = ?, voltage = ?, current = ?, run_time_total = ?, water_level = ?, 
      ph = ?, tds = ?, turbidity = ?, is_motor_on = ?, total_liters = ?, current_status = ?, 
      water_status = ?, turbidity_status = ?, tds_status = ?, last_updated = CURRENT_TIMESTAMP 
      WHERE id = ?`,
      [flow, eff, v, a, rt, wl, ph, tds, turbidity, is_motor_on, total_liters, current_status, water_status, turbidity_status, tds_status, id],
      function (updateErr) {
        if (updateErr) {
          console.error("DB Update Error during ingestion:", updateErr.message);
          return res.status(500).json({ error: "Failed to update borewell state." });
        }

        // AUDIT FIX (Finding 3.1 — Critical): INSERT reading into history on every ingest, not just 5-min intervals
        db.run(`INSERT INTO readings_history 
          (borewell_id, flow_rate, water_level, efficiency, voltage, current, ph, tds, turbidity, total_liters, current_status, water_status, turbidity_status, tds_status) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, flow, wl, eff, v, a, ph, tds, turbidity, total_liters, current_status, water_status, turbidity_status, tds_status],
          function (insertErr) {
            if (insertErr) {
              console.error("DB History insertion error during ingestion:", insertErr.message);
              // Non-fatal to client response, but logged.
            }

            console.log(`💧 Water Data Ingested (Merged & Logged): ID=${id}, Flow=${flow} LPM, TDS=${tds} ppm (${tds_status}), pH=${ph} (${water_status}), Turbidity=${turbidity} NTU (${turbidity_status}), Amps=${a} (${current_status}), MotorOn=${is_motor_on === 1}`);

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

            // AUDIT FIX (Finding 2.2 — Critical): Send response inside the db run callback block only
            res.json({ status: 'Success', id });
          }
        );
      }
    );
  });
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

app.post('/api/aqi', requireApiKey, validateAqiPayload, (req, res) => {
  const { pm25, pm10, co2, tvoc, hcho, temp, humidity } = req.body;
  
  // Safe parsing values
  const safePm25 = safeFloat(pm25, 0);
  const safePm10 = safeFloat(pm10, 0);

  // Compute official CPCB AQI
  const pm25Idx = calculateCpcbSubIndex(safePm25, 'pm25');
  const pm10Idx = calculateCpcbSubIndex(safePm10, 'pm10');
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
    [safePm25, safePm10, safeFloat(co2, 400), safeFloat(tvoc, 0), safeFloat(hcho, 0), safeFloat(temp, 0), safeFloat(humidity, 0), score],
    function(err) {
      if (err) {
        console.error("AQI DB Error:", err.message);
        return res.status(500).json({ error: "Failed to store AQI data." });
      }
      
      broadcast({
        type: 'aqi',
        timestamp: new Date().toISOString(),
        data: {
          pm25: safePm25, 
          pm10: safePm10, 
          co2: safeFloat(co2, 400), 
          tvoc: safeFloat(tvoc, 0), 
          hcho: safeFloat(hcho, 0), 
          temp: safeFloat(temp, 0), 
          humidity: safeFloat(humidity, 0),
          aqi: score,
          category: getCategory(score),
          dominant_pollutant: pm25Idx >= pm10Idx ? "pm25" : "pm10"
        }
      });

      console.log(`🌬️ AQI Data Ingested: ${score} (${getCategory(score)}). PM2.5=${safePm25}`);

      // AUDIT FIX (Finding 2.2 — Critical): Send response inside the db run callback block only
      res.json({
        aqi: score,
        category: getCategory(score),
        dominant_pollutant: pm25Idx >= pm10Idx ? "pm25" : "pm10"
      });
    }
  );
});

// --- AUTHENTICATION ENDPOINTS ---

// 1. User login (supports URL encoded form data)
app.post('/api/auth/login', (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  if (!email || !password) {
    return res.status(400).json({ detail: "Username and password required." });
  }

  db.get('SELECT id, email, full_name FROM users WHERE email = ? AND password = ?', [email, password], (err, user) => {
    if (err) {
      console.error('Login error:', err);
      return res.status(500).json({ detail: "Internal database login error." });
    }
    if (!user) {
      return res.status(401).json({ detail: "Incorrect username or password." });
    }

    const token = Buffer.from(`${email}:${password}`).toString('base64');
    res.json({ access_token: token });
  });
});

// 2. User registration
app.post('/api/auth/register', (req, res) => {
  const { email, password, full_name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ detail: "Username and password required." });
  }

  db.run('INSERT INTO users (email, password, full_name) VALUES (?, ?, ?)', [email, password, full_name || email], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ detail: "Username already exists." });
      }
      console.error('Registration error:', err);
      return res.status(500).json({ detail: "Internal database registration error." });
    }
    res.json({ status: "Success", userId: this.lastID });
  });
});

// 3. Get current authenticated user profile
app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ detail: "Unauthorized." });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = Buffer.from(token, 'base64').toString('ascii').split(':');
    const email = decoded[0];
    const password = decoded[1];

    db.get('SELECT id, email, full_name FROM users WHERE email = ? AND password = ?', [email, password], (err, user) => {
      if (err || !user) {
        return res.status(401).json({ detail: "Unauthorized access token." });
      }
      res.json(user);
    });
  } catch (e) {
    return res.status(401).json({ detail: "Invalid session token." });
  }
});

// 5. Locations & Status Management (Syncs with Frontend Polling)
app.get('/api/locations', requireDashboardAuth, (req, res) => {
  res.json([
    { location_id: "BLR-01", name: "BLR-01", latitude: 12.9716, longitude: 77.5946, online: true, last_seen: new Date().toISOString() }
  ]);
});

app.get('/api/locations/status', requireDashboardAuth, (req, res) => {
  res.json([
    { location_id: "BLR-01", name: "BLR-01", latitude: 12.9716, longitude: 77.5946, online: true, last_seen: new Date().toISOString() }
  ]);
});

app.get('/api/location/:name/capabilities', requireDashboardAuth, (req, res) => {
  res.json({ has_aqi: true, has_water: true });
});

// 6. Devices Listing
app.get('/api/devices', requireDashboardAuth, (req, res) => {
  res.json([
    { device_id: "BW-GW-01", type: "GATEWAY", status: "ONLINE", location_id: "BLR-01", location_name: "BLR-01", last_seen: new Date().toISOString() },
    { device_id: "BW-NODE-01", type: "SENSOR", status: "ONLINE", location_id: "BLR-01", location_name: "BLR-01", last_seen: new Date().toISOString() },
    { device_id: "AQI-NODE-01", type: "SENSOR", status: "ONLINE", location_id: "BLR-01", location_name: "BLR-01", last_seen: new Date().toISOString() },
    { device_id: "LORA-HUB", type: "BASE", status: "ONLINE", location_id: "BLR-01", location_name: "BLR-01", last_seen: new Date().toISOString() }
  ]);
});

// --- WEBSOCKET LOGIC ---

wss.on('connection', (ws, req) => {
  // AUDIT FIX (Finding 4.3 — Critical): Require dynamic token checking on WebSocket connection
  const urlParams = new URL(req.url, `http://${req.headers.host || 'localhost'}`).searchParams;
  const token = urlParams.get('token');
  const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN || null;

  if (DASHBOARD_TOKEN && token !== DASHBOARD_TOKEN) {
    console.warn(`🚫 WebSocket connection rejected: Invalid or missing token from ${req.socket.remoteAddress}`);
    ws.close(4001, 'Unauthorized');
    return;
  }

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

  ws.on('error', () => {
    clients.delete(ws);
  });
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

// Auto-start simulator for testing if env var SIMULATE_HARDWARE is set to true
if (process.env.SIMULATE_HARDWARE === 'true') {
  simulateHardware();
}

// 7. Start the Server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🛠️ Starting Edge Backend Hub...`);
  console.log(`🚀 Edge Backend Hub Running on http://localhost:${PORT}`);
});

// AUDIT FIX (Finding 7.3 — High): Graceful Shutdown Hook
// Ensure database is safely closed on SIGTERM / SIGINT to prevent SQLite file corruption.
const gracefulShutdown = () => {
  console.log('🔄 Server shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed.');
    db.close((err) => {
      if (err) console.error('Error closing SQLite DB during shutdown:', err.message);
      else console.log('Database connection closed.');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
