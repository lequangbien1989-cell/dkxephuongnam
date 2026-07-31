const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('❌ Chưa có DATABASE_URL. Tạo Supabase project rồi thêm connection string vào .env');
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 20000,
      // SSL: Supabase/Render need it; local doesn't. Auto-detect.
      ssl: process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('/var/run')
        ? undefined
        : { rejectUnauthorized: false }
    });
  }
  return pool;
}

// Async query helper
async function query(text, params) {
  const result = await getPool().query(text, params);
  return result;
}

async function initSchema() {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          SERIAL PRIMARY KEY,
      username    TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      full_name   TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'user',
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id                    SERIAL PRIMARY KEY,
      plate_number          TEXT UNIQUE NOT NULL,
      phone                 TEXT,
      registration_expiry   DATE,
      insurance_expiry      DATE,
      body_insurance_expiry DATE,
      maintenance_km        INTEGER,
      current_km            INTEGER DEFAULT 0,
      notes                 TEXT,
      is_active             INTEGER NOT NULL DEFAULT 1,
      created_at            TIMESTAMPTZ DEFAULT NOW(),
      updated_at            TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS drivers (
      id          SERIAL PRIMARY KEY,
      name        TEXT UNIQUE NOT NULL,
      phone       TEXT,
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS trips (
      id          SERIAL PRIMARY KEY,
      trip_date   DATE NOT NULL,
      vehicle_id  INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      driver_name TEXT NOT NULL,
      time_range  TEXT,
      destination TEXT,
      km_reading  INTEGER,
      notes       TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(trip_date);
    CREATE INDEX IF NOT EXISTS idx_trips_vehicle ON trips(vehicle_id);

    CREATE TABLE IF NOT EXISTS maintenances (
      id          SERIAL PRIMARY KEY,
      vehicle_id  INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      maint_date  DATE NOT NULL,
      driver_name TEXT NOT NULL,
      content     TEXT NOT NULL,
      cost        INTEGER,
      km_at_maint INTEGER,
      notes       TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_maint_vehicle ON maintenances(vehicle_id);

    CREATE TABLE IF NOT EXISTS company_info (
      id      INTEGER PRIMARY KEY CHECK (id = 1),
      name    TEXT NOT NULL,
      address TEXT NOT NULL,
      phone   TEXT NOT NULL,
      email   TEXT NOT NULL,
      website TEXT,
      fine_check_url TEXT NOT NULL
    );
  `);
}

module.exports = { getPool, query, initSchema };
