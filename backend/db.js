const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'environment.db');
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

  // Seed initial data if empty
  db.get("SELECT COUNT(*) as count FROM borewell_state", (err, row) => {
    if (row && row.count === 0) {
      db.run(`INSERT INTO borewell_state (id, name, water_level) VALUES ('BW-01', 'Borewell 1', 45.5)`);
      db.run(`INSERT INTO borewell_state (id, name, water_level) VALUES ('BW-02', 'Borewell 2', 12.2)`);
      db.run(`INSERT INTO borewell_state (id, name, water_level) VALUES ('BW-03', 'Borewell 3', 78.9)`);
    }
  });
});

module.exports = db;
