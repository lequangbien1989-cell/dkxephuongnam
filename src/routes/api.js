const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

// Color palette for vehicles
const VEHICLE_COLORS = [
  '#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c',
  '#e67e22', '#34495e', '#16a085', '#c0392b', '#27ae60', '#8e44ad'
];

router.get('/calendar', (req, res) => {
  const db = getDb();
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const startDate = month + '-01';
  // Calculate end of month
  const [y, m] = month.split('-').map(Number);
  const endDay = new Date(y, m, 0).getDate();
  const endDate = month + '-' + String(endDay).padStart(2, '0');

  const trips = db.prepare(
    `SELECT t.*, v.plate_number FROM trips t
     JOIN vehicles v ON t.vehicle_id = v.id
     WHERE t.trip_date >= ? AND t.trip_date <= ?
     ORDER BY t.trip_date, t.time_range`
  ).all(startDate, endDate);

  // Group by day
  const days = {};
  for (const t of trips) {
    if (!days[t.trip_date]) days[t.trip_date] = [];
    days[t.trip_date].push(t);
  }

  // Vehicle list with colors
  const vehicles = db.prepare('SELECT * FROM vehicles WHERE is_active = 1 ORDER BY plate_number').all();
  const vehicleMap = {};
  vehicles.forEach((v, i) => {
    v.color = VEHICLE_COLORS[i % VEHICLE_COLORS.length];
    vehicleMap[v.plate_number] = v.color;
  });

  res.json({ month, startDate, endDate, days, vehicles, vehicleMap, endDay });
});

router.get('/alerts', (req, res) => {
  const db = getDb();
  const vehicles = db.prepare('SELECT * FROM vehicles WHERE is_active = 1').all();
  const today = new Date().toISOString().slice(0, 10);
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

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

router.get('/stats', (req, res) => {
  const db = getDb();
  const totalVehicles = db.prepare('SELECT COUNT(*) as c FROM vehicles WHERE is_active = 1').get().c;
  const activeDrivers = db.prepare('SELECT COUNT(*) as c FROM drivers WHERE is_active = 1').get().c;
  const tripsThisMonth = db.prepare("SELECT COUNT(*) as c FROM trips WHERE trip_date >= date('now','start of month')").get().c;
  res.json({ totalVehicles, activeDrivers, tripsThisMonth });
});

module.exports = router;
