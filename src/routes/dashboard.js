const express = require('express');
const router = express.Router();
const { query } = require('../db/db');

router.get('/', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  // Stats
  const totalVehicles = (await query('SELECT COUNT(*) as c FROM vehicles WHERE is_active = 1')).rows[0].c;
  const activeDrivers = (await query('SELECT COUNT(*) as c FROM drivers WHERE is_active = 1')).rows[0].c;
  const tripsThisMonth = (await query(`SELECT COUNT(*) as c FROM trips WHERE trip_date >= date_trunc('month', CURRENT_DATE)`)).rows[0].c;

  // Expiry alerts
  const vResult = await query('SELECT * FROM vehicles WHERE is_active = 1');
  const vehicles = vResult.rows;
  const alerts = vehicles.map(v => {
    const items = [];
    const daysReg = daysUntil(fmtDate(v.registration_expiry));
    const daysIns = daysUntil(fmtDate(v.insurance_expiry));
    const daysBody = daysUntil(fmtDate(v.body_insurance_expiry));
    if (v.registration_expiry) items.push({ type: 'Đăng kiểm', date: fmtDate(v.registration_expiry), days: daysReg });
    if (v.insurance_expiry) items.push({ type: 'Bảo hiểm', date: fmtDate(v.insurance_expiry), days: daysIns });
    if (v.body_insurance_expiry) items.push({ type: 'BH Thân vỏ', date: fmtDate(v.body_insurance_expiry), days: daysBody });
    const urgency = Math.min(...items.map(i => Math.abs(i.days)));
    const status = items.some(i => i.days <= 0) ? 'expired' : items.some(i => i.days <= 30) ? 'warning' : 'safe';
    return { ...v, items, status, urgency };
  });

  // Next 7 days trips (today + 6 upcoming days)
  const next7 = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const weekTrips = (await query(`SELECT t.*, v.plate_number FROM trips t JOIN vehicles v ON t.vehicle_id = v.id WHERE t.trip_date >= $1 AND t.trip_date <= $2 ORDER BY t.trip_date, t.created_at`, [today, next7])).rows
    .map(t => ({ ...t, trip_date: fmtDate(t.trip_date) }));
  const todayTrips = weekTrips.filter(t => t.trip_date === today);

  // Driver list
  const drivers = (await query('SELECT name FROM drivers WHERE is_active = 1 ORDER BY name')).rows;

  res.render('dashboard/index', {
    title: 'Tổng quan',
    totalVehicles, activeDrivers, tripsThisMonth,
    alerts, todayTrips, weekTrips, today, vehicles, drivers,
    daysUntil, fmtDate
  });
});

function fmtDate(d) {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

module.exports = router;
