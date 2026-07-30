const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'database.sqlite');
let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      username    TEXT    UNIQUE NOT NULL,
      password    TEXT    NOT NULL,
      full_name   TEXT    NOT NULL,
      role        TEXT    NOT NULL DEFAULT 'user',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      plate_number          TEXT    UNIQUE NOT NULL,
      phone                 TEXT,
      registration_expiry   TEXT,
      insurance_expiry      TEXT,
      body_insurance_expiry TEXT,
      maintenance_km        INTEGER,
      current_km            INTEGER DEFAULT 0,
      notes                 TEXT,
      is_active             INTEGER NOT NULL DEFAULT 1,
      created_at            TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at            TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS drivers (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    UNIQUE NOT NULL,
      phone       TEXT,
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS trips (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_date   TEXT    NOT NULL,
      vehicle_id  INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      driver_name TEXT    NOT NULL,
      time_range  TEXT,
      destination TEXT,
      km_reading  INTEGER,
      notes       TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(trip_date);
    CREATE INDEX IF NOT EXISTS idx_trips_vehicle ON trips(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver_name);

    CREATE TABLE IF NOT EXISTS maintenances (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id  INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      maint_date  TEXT    NOT NULL,
      driver_name TEXT    NOT NULL,
      content     TEXT    NOT NULL,
      cost        INTEGER,
      km_at_maint INTEGER,
      notes       TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_maint_vehicle ON maintenances(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_maint_date ON maintenances(maint_date);

    CREATE TABLE IF NOT EXISTS company_info (
      id      INTEGER PRIMARY KEY CHECK (id = 1),
      name    TEXT    NOT NULL,
      address TEXT    NOT NULL,
      phone   TEXT    NOT NULL,
      email   TEXT    NOT NULL,
      website TEXT,
      fine_check_url TEXT NOT NULL
    );
  `);
}

module.exports = { getDb };