const express = require('express');
const router = express.Router();
const { query } = require('../db/db');

// Helper: check time conflict for a vehicle on a given date+time
async function findConflict(trip_date, vehicle_id, time_range, excludeId) {
  if (!time_range || !trip_date || !vehicle_id) return null;
  const parsed = parseTimeRange(time_range);
  if (!parsed) return null;

  // Get all trips for this vehicle on same date
  let sql = `SELECT t.*, v.plate_number FROM trips t JOIN vehicles v ON t.vehicle_id = v.id WHERE t.trip_date = $1 AND t.vehicle_id = $2`;
  const params = [trip_date, vehicle_id];
  if (excludeId) { sql += ` AND t.id != $3`; params.push(excludeId); }
  const existing = (await query(sql, params)).rows;

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
  if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  if (parts.length === 1) {
    // "7" → 7h, "630" → 6h30, "1230" → 12h30
    if (parts[0].length <= 2) return parseInt(parts[0]) * 60;
    if (parts[0].length === 3) return parseInt(parts[0][0]) * 60 + parseInt(parts[0].slice(1));
    if (parts[0].length === 4) return parseInt(parts[0].slice(0, 2)) * 60 + parseInt(parts[0].slice(2));
  }
  return null;
}

// "7-9" / "7:30-9:45" → "7h-9h" / "7h30-9h45". Nhập xong có sẵn h.
function normalizeTimeRange(str) {
  if (!str) return str;
  const m = str.match(/^(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return str;
  const fmt = (h, mm) => (mm ? h + 'h' + mm : h + 'h');
  return fmt(m[1], m[2]) + '-' + fmt(m[3], m[4]);
}

// Helper: check if vehicle has valid registration & insurance for a given date
function isVehicleExpired(vehicle, tripDate) {
  if (!vehicle) return 'Xe không tồn tại';
  const d = tripDate || new Date().toISOString().slice(0, 10);
  if (vehicle.registration_expiry && fmtDate(vehicle.registration_expiry) < d) {
    return 'hết hạn đăng kiểm (' + fmtDate(vehicle.registration_expiry) + ')';
  }
  if (vehicle.insurance_expiry && fmtDate(vehicle.insurance_expiry) < d) {
    return 'hết hạn bảo hiểm (' + fmtDate(vehicle.insurance_expiry) + ')';
  }
  return null;
}

function fmtDate(d) {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

async function getVehicles() {
  return (await query('SELECT * FROM vehicles WHERE is_active = 1 ORDER BY plate_number')).rows;
}
async function getDrivers() {
  return (await query('SELECT name FROM drivers WHERE is_active = 1 ORDER BY name')).rows;
}

// List with filters
router.get('/', async (req, res) => {
  const { date_from, date_to, vehicle_id, driver } = req.query;

  let sql = `SELECT t.*, v.plate_number FROM trips t JOIN vehicles v ON t.vehicle_id = v.id WHERE 1=1`;
  const params = [];

  if (date_from) { params.push(date_from); sql += ` AND t.trip_date >= $${params.length}`; }
  if (date_to) { params.push(date_to); sql += ` AND t.trip_date <= $${params.length}`; }
  if (vehicle_id) { params.push(vehicle_id); sql += ` AND t.vehicle_id = $${params.length}`; }
  if (driver) { params.push(`%${driver}%`); sql += ` AND t.driver_name LIKE $${params.length}`; }

  sql += ` ORDER BY t.trip_date DESC, t.created_at DESC LIMIT 200`;

  const tripsResult = await query(sql, params);
  const trips = tripsResult.rows.map(t => ({ ...t, trip_date: fmtDate(t.trip_date) }));
  const vehicles = await getVehicles();
  const drivers = (await query('SELECT DISTINCT driver_name FROM trips ORDER BY driver_name')).rows;

  res.render('trips/index', {
    title: 'Chuyến đi',
    trips, vehicles, drivers,
    filters: { date_from, date_to, vehicle_id, driver }
  });
});

// New form
router.get('/new', async (req, res) => {
  const vehicles = await getVehicles();
  const drivers = await getDrivers();
  const today = new Date().toISOString().slice(0, 10);
  res.render('trips/form', { title: 'Thêm chuyến', trip: {}, vehicles, drivers, today, conflict: null });
});

// Helper: render dashboard (used for conflict/expired errors from dashboard form)
async function renderDashboard(res, vehicle_id, conflict) {
  const today = new Date().toISOString().slice(0, 10);
  const totalVehicles = (await query('SELECT COUNT(*) as c FROM vehicles WHERE is_active = 1')).rows[0].c;
  const activeDrivers = (await query('SELECT COUNT(*) as c FROM drivers WHERE is_active = 1')).rows[0].c;
  const tripsThisMonth = (await query(`SELECT COUNT(*) as c FROM trips WHERE trip_date >= date_trunc('month', CURRENT_DATE) AND trip_date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'`)).rows[0].c;
  const vehiclesData = await getVehicles();
  const alerts = vehiclesData.map(v => {
    const items = [];
    if (v.registration_expiry) items.push({ type: 'Đăng kiểm', date: fmtDate(v.registration_expiry), days: Math.ceil((new Date(fmtDate(v.registration_expiry)) - new Date()) / (1000 * 60 * 60 * 24)) });
    if (v.insurance_expiry) items.push({ type: 'Bảo hiểm', date: fmtDate(v.insurance_expiry), days: Math.ceil((new Date(fmtDate(v.insurance_expiry)) - new Date()) / (1000 * 60 * 60 * 24)) });
    if (v.body_insurance_expiry) items.push({ type: 'BH Thân vỏ', date: fmtDate(v.body_insurance_expiry), days: Math.ceil((new Date(fmtDate(v.body_insurance_expiry)) - new Date()) / (1000 * 60 * 60 * 24)) });
    const status = items.some(i => i.days <= 0) ? 'expired' : items.some(i => i.days <= 15) ? 'warning' : 'safe';
    return { ...v, items, status };
  });
  const next7 = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const weekTrips = (await query(`SELECT t.*, v.plate_number FROM trips t JOIN vehicles v ON t.vehicle_id = v.id WHERE t.trip_date >= $1 AND t.trip_date <= $2 ORDER BY t.trip_date, t.created_at`, [today, next7])).rows
    .map(t => ({ ...t, trip_date: fmtDate(t.trip_date) }));
  const todayTrips = weekTrips.filter(t => t.trip_date === today);
  const drivers = await getDrivers();
  res.render('dashboard/index', {
    title: 'Tổng quan', totalVehicles, activeDrivers, tripsThisMonth,
    alerts, todayTrips, weekTrips, today, vehicles: vehiclesData, drivers,
    vehicle_id, conflict
  });
}

// Create
router.post('/', async (req, res) => {
  const db = { query };
  const { trip_date, vehicle_id, driver_name, time_range, time_range_custom, destination, km_reading, notes } = req.body;
  // Giờ: ưu tiên ô tuỳ chỉnh nếu nhập, còn ko dùng khung chọn. Chuẩn hoá "7-9" → "7h-9h"
  const finalTimeRange = normalizeTimeRange(time_range_custom || time_range) || null;

  // Check vehicle expired
  const vResult = await query('SELECT * FROM vehicles WHERE id = $1', [vehicle_id]);
  const vehicle = vResult.rows[0];
  const expiredMsg = isVehicleExpired(vehicle, trip_date);
  if (expiredMsg) {
    const vehicles = await getVehicles();
    const drivers = await getDrivers();
    const today = new Date().toISOString().slice(0, 10);
    const msg = `🚫 Xe ${vehicle.plate_number} ${expiredMsg} — không thể đăng ký chuyến!`;
    const referer = req.get('Referer') || '';
    if (referer.includes('/trips/new')) {
      return res.render('trips/form', { title: 'Thêm chuyến', trip: req.body, vehicles, drivers, today, conflict: msg });
    }
    return renderDashboard(res, vehicle_id, msg);
  }

  // Check conflict
  const conflict = await findConflict(trip_date, vehicle_id, time_range);
  if (conflict) {
    const vehicles = await getVehicles();
    const drivers = await getDrivers();
    const today = new Date().toISOString().slice(0, 10);
    const msg = `⚠️ Xe ${vehicle.plate_number} đã có chuyến của ${conflict.with} (${conflict.time}) vào ngày này — giờ bị trùng!`;
    const referer = req.get('Referer') || '';
    if (referer.includes('/trips/new')) {
      return res.render('trips/form', { title: 'Thêm chuyến', trip: req.body, vehicles, drivers, today, conflict: msg });
    }
    return renderDashboard(res, vehicle_id, msg);
  }

  try {
    await query(`INSERT INTO trips (trip_date, vehicle_id, driver_name, time_range, destination, km_reading, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [trip_date, vehicle_id, driver_name, finalTimeRange, destination || null, km_reading || null, notes || null]);

    if (km_reading) {
      await query(`UPDATE vehicles SET current_km = GREATEST(COALESCE(current_km,0), $1), updated_at = NOW() WHERE id = $2`, [km_reading, vehicle_id]);
    }

    const referer = req.get('Referer') || '';
    if (referer.includes('/trips/new')) {
      res.redirect('/trips');
    } else {
      res.redirect('/');
    }
  } catch (e) {
    const vehicles = await getVehicles();
    const drivers = await getDrivers();
    const today = new Date().toISOString().slice(0, 10);
    res.render('trips/form', { title: 'Thêm chuyến', trip: req.body, vehicles, drivers, today, error: e.message, conflict: null });
  }
});

// Edit form
router.get('/:id/edit', async (req, res) => {
  const tResult = await query('SELECT * FROM trips WHERE id = $1', [req.params.id]);
  const trip = tResult.rows[0];
  if (!trip) return res.redirect('/trips');
  trip.trip_date = fmtDate(trip.trip_date);
  const vehicles = await getVehicles();
  const drivers = await getDrivers();
  res.render('trips/form', { title: 'Sửa chuyến', trip, vehicles, drivers, today: '', conflict: null });
});

// Update
router.post('/:id', async (req, res) => {
  const { trip_date, vehicle_id, driver_name, time_range, time_range_custom, destination, km_reading, notes } = req.body;
  // Giờ: ưu tiên ô tuỳ chỉnh nếu nhập, còn ko dùng khung chọn. Chuẩn hoá "7-9" → "7h-9h"
  const finalTimeRange = normalizeTimeRange(time_range_custom || time_range) || null;

  // Check vehicle expired
  const vResult = await query('SELECT * FROM vehicles WHERE id = $1', [vehicle_id]);
  const vehicle = vResult.rows[0];
  const expiredMsg = isVehicleExpired(vehicle, trip_date);
  if (expiredMsg) {
    const trip = { ...req.body, id: req.params.id };
    const vehicles = await getVehicles();
    const drivers = await getDrivers();
    const msg = `🚫 Xe ${vehicle.plate_number} ${expiredMsg} — không thể đăng ký chuyến!`;
    return res.render('trips/form', { title: 'Sửa chuyến', trip, vehicles, drivers, today: '', conflict: msg });
  }

  // Check conflict (exclude current trip)
  const conflict = await findConflict(trip_date, vehicle_id, finalTimeRange, req.params.id);
  if (conflict) {
    const trip = { ...req.body, id: req.params.id };
    const vehicles = await getVehicles();
    const drivers = await getDrivers();
    const msg = `⚠️ Xe ${vehicle.plate_number} đã có chuyến của ${conflict.with} (${conflict.time}) vào ngày này — giờ bị trùng!`;
    return res.render('trips/form', { title: 'Sửa chuyến', trip, vehicles, drivers, today: '', conflict: msg });
  }

  try {
    await query(`UPDATE trips SET trip_date=$1, vehicle_id=$2, driver_name=$3, time_range=$4, destination=$5, km_reading=$6, notes=$7, updated_at=NOW() WHERE id=$8`,
      [trip_date, vehicle_id, driver_name, finalTimeRange, destination || null, km_reading || null, notes || null, req.params.id]);
    if (km_reading) {
      await query(`UPDATE vehicles SET current_km = GREATEST(COALESCE(current_km,0), $1), updated_at = NOW() WHERE id = $2`, [km_reading, vehicle_id]);
    }
    res.redirect('/trips');
  } catch (e) {
    res.render('trips/form', { title: 'Sửa chuyến', trip: { ...req.body, id: req.params.id }, vehicles: [], drivers: [], today: '', conflict: null, error: e.message });
  }
});

// Delete
router.post('/:id/delete', async (req, res) => {
  await query('DELETE FROM trips WHERE id = $1', [req.params.id]);
  // Quay về trang xuất phát (dashboard nếu xoá từ đó)
  const referer = req.get('Referer') || '';
  if (referer.includes('/')) {
    res.redirect('/');
  } else {
    res.redirect('/trips');
  }
});

module.exports = router;
