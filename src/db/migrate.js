// Migrate SQLite data -> Supabase PostgreSQL
// Usage: DATABASE_URL=... node src/db/migrate.js
// Reads old SQLite file, pushes all data to Supabase preserving IDs

require('dotenv').config();
const path = require('path');
const Database = require('better-sqlite3');
const { initSchema, query } = require('./db');

const OLD_DB = path.join(__dirname, '..', '..', 'data', 'database.sqlite');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ Thiếu DATABASE_URL. Chạy: DATABASE_URL=postgresql://... node src/db/migrate.js');
    process.exit(1);
  }
  if (!require('fs').existsSync(OLD_DB)) {
    console.error('❌ Không tìm thấy SQLite cũ tại', OLD_DB);
    process.exit(1);
  }

  console.log('📦 Migrating data từ SQLite lên Supabase...');
  await initSchema();

  const old = new Database(OLD_DB, { readonly: true });

  // --- company_info ---
  const company = old.prepare('SELECT * FROM company_info WHERE id = 1').get();
  if (company) {
    await query(`INSERT INTO company_info (id, name, address, phone, email, website, fine_check_url)
      VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
      [1, company.name, company.address, company.phone, company.email, company.website, company.fine_check_url]);
    console.log('✅ company_info');
  }

  // --- vehicles ---
  const vehicles = old.prepare('SELECT * FROM vehicles').all();
  for (const v of vehicles) {
    await query(`INSERT INTO vehicles (id, plate_number, phone, registration_expiry, insurance_expiry, body_insurance_expiry, maintenance_km, current_km, notes, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
      [v.id, v.plate_number, v.phone, v.registration_expiry, v.insurance_expiry, v.body_insurance_expiry, v.maintenance_km, v.current_km || 0, v.notes, v.is_active]);
  }
  console.log('✅ vehicles:', vehicles.length);

  // --- drivers ---
  const drivers = old.prepare('SELECT * FROM drivers').all();
  for (const d of drivers) {
    await query(`INSERT INTO drivers (id, name, phone, is_active)
      VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
      [d.id, d.name, d.phone, d.is_active]);
  }
  console.log('✅ drivers:', drivers.length);

  // --- trips ---
  const trips = old.prepare('SELECT * FROM trips').all();
  for (const t of trips) {
    await query(`INSERT INTO trips (id, trip_date, vehicle_id, driver_name, time_range, destination, km_reading, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
      [t.id, t.trip_date, t.vehicle_id, t.driver_name, t.time_range, t.destination, t.km_reading, t.notes]);
  }
  console.log('✅ trips:', trips.length);

  // --- maintenances ---
  const maintenances = old.prepare('SELECT * FROM maintenances').all();
  for (const m of maintenances) {
    await query(`INSERT INTO maintenances (id, vehicle_id, maint_date, driver_name, content, cost, km_at_maint, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
      [m.id, m.vehicle_id, m.maint_date, m.driver_name, m.content, m.cost, m.km_at_maint, m.notes]);
  }
  console.log('✅ maintenances:', maintenances.length);

  // Reset sequences so auto-increment continues after migrated IDs
  await query(`SELECT setval(pg_get_serial_sequence('vehicles','id'), (SELECT COALESCE(MAX(id),1) FROM vehicles))`);
  await query(`SELECT setval(pg_get_serial_sequence('drivers','id'), (SELECT COALESCE(MAX(id),1) FROM drivers))`);
  await query(`SELECT setval(pg_get_serial_sequence('trips','id'), (SELECT COALESCE(MAX(id),1) FROM trips))`);
  await query(`SELECT setval(pg_get_serial_sequence('maintenances','id'), (SELECT COALESCE(MAX(id),1) FROM maintenances))`);

  console.log('🎉 Migrate hoàn tất!');
}

main().catch(e => {
  console.error('❌ Lỗi migrate:', e.message);
  process.exit(1);
});
