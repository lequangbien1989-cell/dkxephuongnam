const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
router.get('/', (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Stats
  const totalVehicles = db.prepare('SELECT COUNT(*) as c FROM vehicles WHERE is_active = 1').get().c;
  const activeDrivers = db.prepare('SELECT COUNT(*) as c FROM drivers WHERE is_active = 1').get().c;
  const tripsThisMonth = db.prepare(`SELECT COUNT(*) as c FROM trips WHERE trip_date >= date('now','start of month')`).get().c;

  // Expiry alerts
  const vehicles = db.prepare('SELECT * FROM vehicles WHERE is_active = 1').all();
  const alerts = vehicles.map(v => {
    const items = [];
    const daysReg = daysUntil(v.registration_expiry);
    const daysIns = daysUntil(v.insurance_expiry);
    const daysBody = daysUntil(v.body_insurance_expiry);
    if (v.registration_expiry) items.push({ type: 'Đăng kiểm', date: v.registration_expiry, days: daysReg });
    if (v.insurance_expiry) items.push({ type: 'Bảo hiểm', date: v.insurance_expiry, days: daysIns });
    if (v.body_insurance_expiry) items.push({ type: 'BH Thân vỏ', date: v.body_insurance_expiry, days: daysBody });
    const urgency = Math.min(...items.map(i => Math.abs(i.days)));
    const status = items.some(i => i.days <= 0) ? 'expired' : items.some(i => i.days <= 30) ? 'warning' : 'safe';
    return { ...v, items, status, urgency };
  });

  // Next 7 days trips (today + 6 upcoming days)
  const next7 = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const weekTrips = db.prepare(`SELECT t.*, v.plate_number FROM trips t JOIN vehicles v ON t.vehicle_id = v.id WHERE t.trip_date >= ? AND t.trip_date <= ? ORDER BY t.trip_date, t.created_at`).all(today, next7);
  const todayTrips = weekTrips.filter(t => t.trip_date === today);

  // Driver list for datalist
  const drivers = db.prepare('SELECT name FROM drivers WHERE is_active = 1 ORDER BY name').all();

  res.render('dashboard/index', {
    title: 'Tổng quan',
    totalVehicles, activeDrivers, tripsThisMonth,
    alerts, todayTrips, weekTrips, today, vehicles, drivers,
    daysUntil
  });
});

function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

module.exports = router;
