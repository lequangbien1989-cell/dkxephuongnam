const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

// Helper: check time conflict for a vehicle on a given date+time
function findConflict(db, trip_date, vehicle_id, time_range, excludeId) {
  if (!time_range || !trip_date || !vehicle_id) return null;
  const parsed = parseTimeRange(time_range);
  if (!parsed) return null;

  // Get all trips for this vehicle on same date
  let sql = `SELECT t.*, v.plate_number FROM trips t JOIN vehicles v ON t.vehicle_id = v.id WHERE t.trip_date = ? AND t.vehicle_id = ?`;
  const params = [trip_date, vehicle_id];
  if (excludeId) { sql += ` AND t.id != ?`; params.push(excludeId); }
  const existing = db.prepare(sql).all(...params);

  for (const e of existing) {
    if (!e.time_range) continue;
    const ep = parseTimeRange(e.time_range);
    if (!ep) continue;
    // Check overlap: (startA < endB) AND (startB < endA)
    if (parsed.start < ep.end && ep.start < parsed.end) {
      return { with: e.driver_name, plate: e.plate_number, time: e.time_range };
    }
  }
  return null;
}

function parseTimeRange(str) {
  const clean = str.replace(/[hH]/g, '').replace(/[gG]/g, '').replace(/\s/g, '');
  const parts = clean.split('-');
  if (parts.length !== 2) return null;
  const s = toMinutes(parts[0]);
  const e = toMinutes(parts[1]);
  if (s == null || e == null) return null;
  return { start: s, end: e };
}

function toMinutes(t) {
  const parts = t.split(':');
  if (parts.length === 1 && parts[0].length <= 2) return parseInt(parts[0]) * 60;
  if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  return null;
}

// Helper: check if vehicle has valid registration & insurance for a given date
function isVehicleExpired(vehicle, tripDate) {
  if (!vehicle) return 'Xe không tồn tại';
  const d = tripDate || new Date().toISOString().slice(0, 10);
  if (vehicle.registration_expiry && vehicle.registration_expiry < d) {
    return 'hết hạn đăng kiểm (' + vehicle.registration_expiry + ')';
  }
  if (vehicle.insurance_expiry && vehicle.insurance_expiry < d) {
    return 'hết hạn bảo hiểm (' + vehicle.insurance_expiry + ')';
  }
  return null;
}

// List with filters
router.get('/', (req, res) => {
  const db = getDb();
  const { date_from, date_to, vehicle_id, driver } = req.query;

  let sql = `SELECT t.*, v.plate_number FROM trips t JOIN vehicles v ON t.vehicle_id = v.id WHERE 1=1`;
  const params = [];

  if (date_from) { sql += ` AND t.trip_date >= ?`; params.push(date_from); }
  if (date_to) { sql += ` AND t.trip_date <= ?`; params.push(date_to); }
  if (vehicle_id) { sql += ` AND t.vehicle_id = ?`; params.push(vehicle_id); }
  if (driver) { sql += ` AND t.driver_name LIKE ?`; params.push(`%${driver}%`); }

  sql += ` ORDER BY t.trip_date DESC, t.created_at DESC LIMIT 200`;

  const trips = db.prepare(sql).all(...params);
  const vehicles = db.prepare('SELECT * FROM vehicles WHERE is_active = 1 ORDER BY plate_number').all();
  const drivers = db.prepare('SELECT DISTINCT driver_name FROM trips ORDER BY driver_name').all();

  res.render('trips/index', {
    title: 'Chuyến đi',
    trips, vehicles, drivers,
    filters: { date_from, date_to, vehicle_id, driver }
  });
});

// New form
router.get('/new', (req, res) => {
  const db = getDb();
  const vehicles = db.prepare('SELECT * FROM vehicles WHERE is_active = 1 ORDER BY plate_number').all();
  const drivers = db.prepare('SELECT name FROM drivers WHERE is_active = 1 ORDER BY name').all();
  const today = new Date().toISOString().slice(0, 10);
  res.render('trips/form', { title: 'Thêm chuyến', trip: {}, vehicles, drivers, today, conflict: null });
});

// Create
router.post('/', (req, res) => {
  const db = getDb();
  const { trip_date, vehicle_id, driver_name, time_range, destination, km_reading, notes } = req.body;

  // Check vehicle expired
  const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicle_id);
  const expiredMsg = isVehicleExpired(vehicle, trip_date);
  if (expiredMsg) {
    const vehicles = db.prepare('SELECT * FROM vehicles WHERE is_active = 1 ORDER BY plate_number').all();
    const drivers = db.prepare('SELECT name FROM drivers WHERE is_active = 1 ORDER BY name').all();
    const today = new Date().toISOString().slice(0, 10);
    const msg = `🚫 Xe ${vehicle.plate_number} ${expiredMsg} — không thể đăng ký chuyến!`;
    const referer = req.get('Referer') || '';
    if (referer.includes('/trips/new')) {
      return res.render('trips/form', { title: 'Thêm chuyến', trip: req.body, vehicles, drivers, today, conflict: msg });
    }
    // Dashboard
    const totalVehicles = db.prepare('SELECT COUNT(*) as c FROM vehicles WHERE is_active = 1').get().c;
    const activeDrivers = db.prepare('SELECT COUNT(*) as c FROM drivers WHERE is_active = 1').get().c;
    const tripsThisMonth = db.prepare(`SELECT COUNT(*) as c FROM trips WHERE trip_date >= date('now','start of month')`).get().c;
    const vehiclesData = db.prepare('SELECT * FROM vehicles WHERE is_active = 1').all();
    const alerts = vehiclesData.map(v => {
      const items = [];
      if (v.registration_expiry) items.push({ type: 'Đăng kiểm', date: v.registration_expiry, days: Math.ceil((new Date(v.registration_expiry) - new Date()) / (1000 * 60 * 60 * 24)) });
      if (v.insurance_expiry) items.push({ type: 'Bảo hiểm', date: v.insurance_expiry, days: Math.ceil((new Date(v.insurance_expiry) - new Date()) / (1000 * 60 * 60 * 24)) });
      if (v.body_insurance_expiry) items.push({ type: 'BH Thân vỏ', date: v.body_insurance_expiry, days: Math.ceil((new Date(v.body_insurance_expiry) - new Date()) / (1000 * 60 * 60 * 24)) });
      const status = items.some(i => i.days <= 0) ? 'expired' : items.some(i => i.days <= 30) ? 'warning' : 'safe';
      return { ...v, items, status };
    });
    const todayTrips = db.prepare(`SELECT t.*, v.plate_number FROM trips t JOIN vehicles v ON t.vehicle_id = v.id WHERE t.trip_date = ? ORDER BY t.created_at`).all(today);
    return res.render('dashboard/index', {
      title: 'Tổng quan', totalVehicles, activeDrivers, tripsThisMonth,
      alerts, todayTrips, today, vehicles: vehiclesData, drivers,
      vehicle_id, conflict: msg
    });
  }

  // Check conflict
  const conflict = findConflict(db, trip_date, vehicle_id, time_range);
  if (conflict) {
    const vehicles = db.prepare('SELECT * FROM vehicles WHERE is_active = 1 ORDER BY plate_number').all();
    const drivers = db.prepare('SELECT name FROM drivers WHERE is_active = 1 ORDER BY name').all();
    const today = new Date().toISOString().slice(0, 10);
    const vehicle = db.prepare('SELECT plate_number FROM vehicles WHERE id = ?').get(vehicle_id);
    const msg = `⚠️ Xe ${vehicle ? vehicle.plate_number : ''} đã có chuyến của ${conflict.with} (${conflict.time}) vào ngày này — giờ bị trùng!`;
    // Check referer to decide which view to render
    const referer = req.get('Referer') || '';
    if (referer.includes('/trips/new')) {
      return res.render('trips/form', { title: 'Thêm chuyến', trip: req.body, vehicles, drivers, today, conflict: msg });
    }
    // Came from dashboard
    const totalVehicles = db.prepare('SELECT COUNT(*) as c FROM vehicles WHERE is_active = 1').get().c;
    const activeDrivers = db.prepare('SELECT COUNT(*) as c FROM drivers WHERE is_active = 1').get().c;
    const tripsThisMonth = db.prepare(`SELECT COUNT(*) as c FROM trips WHERE trip_date >= date('now','start of month')`).get().c;
    const vehiclesData = db.prepare('SELECT * FROM vehicles WHERE is_active = 1').all();
    const alerts = vehiclesData.map(v => {
      const items = [];
      if (v.registration_expiry) items.push({ type: 'Đăng kiểm', date: v.registration_expiry, days: Math.ceil((new Date(v.registration_expiry) - new Date()) / (1000 * 60 * 60 * 24)) });
      if (v.insurance_expiry) items.push({ type: 'Bảo hiểm', date: v.insurance_expiry, days: Math.ceil((new Date(v.insurance_expiry) - new Date()) / (1000 * 60 * 60 * 24)) });
      if (v.body_insurance_expiry) items.push({ type: 'BH Thân vỏ', date: v.body_insurance_expiry, days: Math.ceil((new Date(v.body_insurance_expiry) - new Date()) / (1000 * 60 * 60 * 24)) });
      const status = items.some(i => i.days <= 0) ? 'expired' : items.some(i => i.days <= 30) ? 'warning' : 'safe';
      return { ...v, items, status };
    });
    const todayTrips = db.prepare(`SELECT t.*, v.plate_number FROM trips t JOIN vehicles v ON t.vehicle_id = v.id WHERE t.trip_date = ? ORDER BY t.created_at`).all(today);
    return res.render('dashboard/index', {
      title: 'Tổng quan', totalVehicles, activeDrivers, tripsThisMonth,
      alerts, todayTrips, today, vehicles: vehiclesData, drivers,
      vehicle_id, conflict: msg
    });
  }

  try {
    db.prepare(`INSERT INTO trips (trip_date, vehicle_id, driver_name, time_range, destination, km_reading, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(trip_date, vehicle_id, driver_name, time_range || null, destination || null, km_reading || null, notes || null);

    if (km_reading) {
      db.prepare(`UPDATE vehicles SET current_km = MAX(COALESCE(current_km,0), ?), updated_at = datetime('now','localtime') WHERE id = ?`)
        .run(km_reading, vehicle_id);
    }

    const referer = req.get('Referer') || '';
    if (referer.includes('/trips/new')) {
      res.redirect('/trips');
    } else {
      res.redirect('/');
    }
  } catch (e) {
    const vehicles = db.prepare('SELECT * FROM vehicles WHERE is_active = 1 ORDER BY plate_number').all();
    const drivers = db.prepare('SELECT name FROM drivers WHERE is_active = 1 ORDER BY name').all();
    const today = new Date().toISOString().slice(0, 10);
    res.render('trips/form', { title: 'Thêm chuyến', trip: req.body, vehicles, drivers, today, error: e.message, conflict: null });
  }
});

// Edit form
router.get('/:id/edit', (req, res) => {
  const db = getDb();
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id);
  if (!trip) return res.redirect('/trips');
  const vehicles = db.prepare('SELECT * FROM vehicles WHERE is_active = 1 ORDER BY plate_number').all();
  const drivers = db.prepare('SELECT name FROM drivers WHERE is_active = 1 ORDER BY name').all();
  res.render('trips/form', { title: 'Sửa chuyến', trip, vehicles, drivers, today: '', conflict: null });
});

// Update
router.post('/:id', (req, res) => {
  const db = getDb();
  const { trip_date, vehicle_id, driver_name, time_range, destination, km_reading, notes } = req.body;

  // Check vehicle expired
  const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicle_id);
  const expiredMsg = isVehicleExpired(vehicle, trip_date);
  if (expiredMsg) {
    const trip = { ...req.body, id: req.params.id };
    const vehicles = db.prepare('SELECT * FROM vehicles WHERE is_active = 1 ORDER BY plate_number').all();
    const drivers = db.prepare('SELECT name FROM drivers WHERE is_active = 1 ORDER BY name').all();
    const msg = `🚫 Xe ${vehicle.plate_number} ${expiredMsg} — không thể đăng ký chuyến!`;
    return res.render('trips/form', { title: 'Sửa chuyến', trip, vehicles, drivers, today: '', conflict: msg });
  }

  // Check conflict (exclude current trip)
  const conflict = findConflict(db, trip_date, vehicle_id, time_range, req.params.id);
  if (conflict) {
    const trip = { ...req.body, id: req.params.id };
    const vehicles = db.prepare('SELECT * FROM vehicles WHERE is_active = 1 ORDER BY plate_number').all();
    const drivers = db.prepare('SELECT name FROM drivers WHERE is_active = 1 ORDER BY name').all();
    const vehicle = db.prepare('SELECT plate_number FROM vehicles WHERE id = ?').get(vehicle_id);
    const msg = `⚠️ Xe ${vehicle ? vehicle.plate_number : ''} đã có chuyến của ${conflict.with} (${conflict.time}) vào ngày này — giờ bị trùng!`;
    return res.render('trips/form', { title: 'Sửa chuyến', trip, vehicles, drivers, today: '', conflict: msg });
  }

  try {
    db.prepare(`UPDATE trips SET trip_date=?, vehicle_id=?, driver_name=?, time_range=?, destination=?, km_reading=?, notes=?, updated_at=datetime('now','localtime') WHERE id=?`)
      .run(trip_date, vehicle_id, driver_name, time_range || null, destination || null, km_reading || null, notes || null, req.params.id);
    if (km_reading) {
      db.prepare(`UPDATE vehicles SET current_km = MAX(COALESCE(current_km,0), ?), updated_at = datetime('now','localtime') WHERE id = ?`)
        .run(km_reading, vehicle_id);
    }
    res.redirect('/trips');
  } catch (e) {
    res.render('trips/form', { title: 'Sửa chuyến', trip: { ...req.body, id: req.params.id }, vehicles: [], drivers: [], today: '', conflict: null, error: e.message });
  }
});

// Delete
router.post('/:id/delete', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM trips WHERE id = ?').run(req.params.id);
  res.redirect('/trips');
});

module.exports = router;