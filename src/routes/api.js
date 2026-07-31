const express = require('express');
const router = express.Router();
const { query } = require('../db/db');

// Color palette for vehicles
const VEHICLE_COLORS = [
  '#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c',
  '#e67e22', '#34495e', '#16a085', '#c0392b', '#27ae60', '#8e44ad'
];

// Normalize pg date (Date object) -> 'YYYY-MM-DD' string
function fmtDate(d) {
  if (!d) return null;
  if (d instanceof Date) {
    return d.toISOString().slice(0, 10);
  }
  return String(d).slice(0, 10);
}

router.get('/calendar', async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const startDate = month + '-01';
  const [y, m] = month.split('-').map(Number);
  const endDay = new Date(y, m, 0).getDate();
  const endDate = month + '-' + String(endDay).padStart(2, '0');

  const tripsResult = await query(
    `SELECT t.*, v.plate_number FROM trips t
     JOIN vehicles v ON t.vehicle_id = v.id
     WHERE t.trip_date >= $1 AND t.trip_date <= $2
     ORDER BY t.trip_date, t.time_range`, [startDate, endDate]);

  // Normalize dates
  const trips = tripsResult.rows.map(t => ({ ...t, trip_date: fmtDate(t.trip_date) }));

  // Group by day
  const days = {};
  for (const t of trips) {
    if (!days[t.trip_date]) days[t.trip_date] = [];
    days[t.trip_date].push(t);
  }

  // Vehicle list with colors
  const vResult = await query('SELECT * FROM vehicles WHERE is_active = 1 ORDER BY plate_number');
  const vehicles = vResult.rows.map(v => ({ ...v, color: VEHICLE_COLORS[(v.id - 1) % VEHICLE_COLORS.length] }));
  const vehicleMap = {};
  vehicles.forEach(v => { vehicleMap[v.plate_number] = v.color; });

  res.json({ month, startDate, endDate, days, vehicles, vehicleMap, endDay });
});

router.get('/alerts', async (req, res) => {
  const vResult = await query('SELECT * FROM vehicles WHERE is_active = 1');
  const vehicles = vResult.rows;
  const today = new Date().toISOString().slice(0, 10);
  const in30Days = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  vehicles.forEach(v => {
    v.registration_expiry = fmtDate(v.registration_expiry);
    v.insurance_expiry = fmtDate(v.insurance_expiry);
    v.body_insurance_expiry = fmtDate(v.body_insurance_expiry);
  });

  const expiring = vehicles.filter(v =>
    (v.registration_expiry && v.registration_expiry <= in30Days && v.registration_expiry >= today) ||
    (v.insurance_expiry && v.insurance_expiry <= in30Days && v.insurance_expiry >= today) ||
    (v.body_insurance_expiry && v.body_insurance_expiry <= in30Days && v.body_insurance_expiry >= today)
  );
  const expired = vehicles.filter(v =>
    (v.registration_expiry && v.registration_expiry < today) ||
    (v.insurance_expiry && v.insurance_expiry < today) ||
    (v.body_insurance_expiry && v.body_insurance_expiry < today)
  );

  res.json({ expiring, expired });
});

router.get('/stats', async (req, res) => {
  const totalVehicles = (await query('SELECT COUNT(*) as c FROM vehicles WHERE is_active = 1')).rows[0].c;
  const activeDrivers = (await query('SELECT COUNT(*) as c FROM drivers WHERE is_active = 1')).rows[0].c;
  const tripsThisMonth = (await query(`SELECT COUNT(*) as c FROM trips WHERE trip_date >= date_trunc('month', CURRENT_DATE)`)).rows[0].c;
  res.json({ totalVehicles, activeDrivers, tripsThisMonth });
});

module.exports = router;
