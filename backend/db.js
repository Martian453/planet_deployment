const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, 'environment.db');
const db = new sqlite3.Database(dbPath);

// Initialize tables
db.serialize(() => {
  // 1. Live state for all 3 borewells
  db.run(`CREATE TABLE IF NOT EXISTS borewell_state (
    id TEXT PRIMARY KEY,
    name TEXT,
    is_motor_on BOOLEAN DEFAULT 0,
    flow_rate REAL DEFAULT 0,
    efficiency REAL DEFAULT 0,
    voltage REAL DEFAULT 0,
    current REAL DEFAULT 0,
    run_time_total REAL DEFAULT 0,
    water_level REAL DEFAULT 0,
    ph REAL DEFAULT 7.2,
    tds REAL DEFAULT 250,
    turbidity REAL DEFAULT 1.2,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 2. Historical readings for trends
  db.run(`CREATE TABLE IF NOT EXISTS readings_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    borewell_id TEXT,
    flow_rate REAL,
    water_level REAL,
    efficiency REAL,
    voltage REAL,
    current REAL,
    ph REAL,
    tds REAL,
    turbidity REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 3. AQI History (Environmental Data - CPCB Compliant)
  db.run(`CREATE TABLE IF NOT EXISTS aqi_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pm25 REAL,
    pm10 REAL,
    co2 REAL,
    tvoc REAL,
    hcho REAL,
    temp REAL,
    humidity REAL,
    aqi REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Ensure new columns exist for existing databases
  const aqiCols = ['pm25', 'pm10', 'co2', 'tvoc', 'hcho', 'temp', 'humidity', 'aqi'];
  aqiCols.forEach(col => {
    db.run(`ALTER TABLE aqi_history ADD COLUMN ${col} REAL`, (err) => { /* Ignore errors if col exists */ });
  });

  const waterCols = ['ph', 'tds', 'turbidity'];
  waterCols.forEach(col => {
    db.run(`ALTER TABLE borewell_state ADD COLUMN ${col} REAL`, (err) => { /* Ignore */ });
    db.run(`ALTER TABLE readings_history ADD COLUMN ${col} REAL`, (err) => { /* Ignore */ });
  });

  const statusCols = ['total_liters', 'current_status', 'water_status', 'turbidity_status', 'tds_status'];
  statusCols.forEach(col => {
    const colType = col.endsWith('_status') ? 'TEXT' : 'REAL';
    db.run(`ALTER TABLE borewell_state ADD COLUMN ${col} ${colType}`, (err) => { /* Ignore */ });
    db.run(`ALTER TABLE readings_history ADD COLUMN ${col} ${colType}`, (err) => { /* Ignore */ });
  });

  // Seed initial data if empty
  db.get("SELECT COUNT(*) as count FROM borewell_state", (err, row) => {
    if (row && row.count === 0) {
      db.run(`INSERT INTO borewell_state (id, name, water_level) VALUES ('BW-01', 'Borewell 1', 45.5)`);
      db.run(`INSERT INTO borewell_state (id, name, water_level) VALUES ('BW-02', 'Borewell 2', 12.2)`);
      db.run(`INSERT INTO borewell_state (id, name, water_level) VALUES ('BW-03', 'Borewell 3', 78.9)`);
    }
  });

  db.get("SELECT COUNT(*) as count FROM readings_history", (err, row) => {
    if (row && row.count === 0) {
      const stmt = db.prepare(`INSERT INTO readings_history 
        (borewell_id, flow_rate, water_level, efficiency, voltage, current, ph, tds, turbidity, timestamp) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      
      const now = Date.now();
      for (let i = 24; i >= 0; i--) {
        const timeOffset = now - i * 3600 * 1000;
        const timeStr = new Date(timeOffset).toISOString().replace('T', ' ').substring(0, 19);
        
        const t = (24 - i) / 24;
        const lvl = parseFloat((5.2 + Math.sin(t * Math.PI * 2) * 0.4 + Math.random() * 0.1).toFixed(2));
        const ph = parseFloat((7.35 + Math.sin(t * Math.PI * 4) * 0.15 + Math.random() * 0.05).toFixed(2));
        const tds = parseFloat((215 + Math.sin(t * Math.PI * 2) * 15 + Math.random() * 4).toFixed(1));
        const turb = parseFloat((1.4 + Math.cos(t * Math.PI * 2) * 0.3 + Math.random() * 0.08).toFixed(2));
        const flow = 0.0;
        const eff = 0.0;
        const v = 230.0;
        const a = 0.0;
        
        stmt.run('BW-01', flow, lvl, eff, v, a, ph, tds, turb, timeStr);
      }
      stmt.finalize();
    }
  });
});

module.exports = db;
