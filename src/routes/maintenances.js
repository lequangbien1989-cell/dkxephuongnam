const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

// List
router.get('/', (req, res) => {
  const db = getDb();
  const { vehicle_id } = req.query;

  let sql = `SELECT m.*, v.plate_number FROM maintenances m JOIN vehicles v ON m.vehicle_id = v.id WHERE 1=1`;
  const params = [];
  if (vehicle_id) { sql += ` AND m.vehicle_id = ?`; params.push(vehicle_id); }
  sql += ` ORDER BY m.maint_date DESC, m.created_at DESC LIMIT 200`;

  const maintenances = db.prepare(sql).all(...params);
  const vehicles = db.prepare('SELECT * FROM vehicles WHERE is_active = 1 ORDER BY plate_number').all();

  res.render('maintenances/index', { title: 'Bảo dưỡng', maintenances, vehicles, filter_vehicle: vehicle_id || '' });
});

// New form
router.get('/new', (req, res) => {
  const db = getDb();
  const vehicles = db.prepare('SELECT * FROM vehicles WHERE is_active = 1 ORDER BY plate_number').all();
  const drivers = db.prepare('SELECT name FROM drivers WHERE is_active = 1 ORDER BY name').all();
  const today = new Date().toISOString().slice(0, 10);
  res.render('maintenances/form', { title: 'Thêm bảo dưỡng', maint: {}, vehicles, drivers, today });
});

// Create
router.post('/', (req, res) => {
  const db = getDb();
  const { vehicle_id, maint_date, driver_name, content, cost, km_at_maint, notes } = req.body;
  try {
    db.prepare(`INSERT INTO maintenances (vehicle_id, maint_date, driver_name, content, cost, km_at_maint, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(vehicle_id, maint_date, driver_name, content, cost || null, km_at_maint || null, notes || null);
    res.redirect('/maintenances');
  } catch (e) {
    const vehicles = db.prepare('SELECT * FROM vehicles WHERE is_active = 1 ORDER BY plate_number').all();
    const drivers = db.prepare('SELECT name FROM drivers WHERE is_active = 1 ORDER BY name').all();
    const today = new Date().toISOString().slice(0, 10);
    res.render('maintenances/form', { title: 'Thêm bảo dưỡng', maint: req.body, vehicles, drivers, today, error: e.message });
  }
});

// Edit form
router.get('/:id/edit', (req, res) => {
  const db = getDb();
  const maint = db.prepare('SELECT * FROM maintenances WHERE id = ?').get(req.params.id);
  if (!maint) return res.redirect('/maintenances');
  const vehicles = db.prepare('SELECT * FROM vehicles WHERE is_active = 1 ORDER BY plate_number').all();
  const drivers = db.prepare('SELECT name FROM drivers WHERE is_active = 1 ORDER BY name').all();
  res.render('maintenances/form', { title: 'Sửa bảo dưỡng', maint, vehicles, drivers, today: '' });
});

// Update
router.post('/:id', (req, res) => {
  const db = getDb();
  const { vehicle_id, maint_date, driver_name, content, cost, km_at_maint, notes } = req.body;
  try {
    db.prepare(`UPDATE maintenances SET vehicle_id=?, maint_date=?, driver_name=?, content=?, cost=?, km_at_maint=?, notes=?, updated_at=datetime('now','localtime') WHERE id=?`)
      .run(vehicle_id, maint_date, driver_name, content, cost || null, km_at_maint || null, notes || null, req.params.id);
    res.redirect('/maintenances');
  } catch (e) {
    res.render('maintenances/form', { title: 'Sửa bảo dưỡng', maint: { ...req.body, id: req.params.id }, vehicles: [], drivers: [], today: '', error: e.message });
  }
});

// Delete
router.post('/:id/delete', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM maintenances WHERE id = ?').run(req.params.id);
  res.redirect('/maintenances');
});

module.exports = router;