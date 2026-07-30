const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

// List
router.get('/', (req, res) => {
  const db = getDb();
  const vehicles = db.prepare('SELECT * FROM vehicles WHERE is_active = 1 ORDER BY plate_number').all();
  const now = new Date();
  vehicles.forEach(v => {
    v.daysReg = daysUntil(v.registration_expiry);
    v.daysIns = daysUntil(v.insurance_expiry);
    v.daysBody = daysUntil(v.body_insurance_expiry);
  });
  res.render('vehicles/index', { title: 'Danh sách xe', vehicles });
});

// New form
router.get('/new', (req, res) => {
  res.render('vehicles/form', { title: 'Thêm xe', vehicle: {} });
});

// Create
router.post('/', (req, res) => {
  const db = getDb();
  const { plate_number, phone, registration_expiry, insurance_expiry, body_insurance_expiry, maintenance_km, notes } = req.body;
  try {
    db.prepare(`INSERT INTO vehicles (plate_number, phone, registration_expiry, insurance_expiry, body_insurance_expiry, maintenance_km, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(plate_number, phone, registration_expiry || null, insurance_expiry || null, body_insurance_expiry || null, maintenance_km || null, notes || null);
    res.redirect('/vehicles');
  } catch (e) {
    res.render('vehicles/form', { title: 'Thêm xe', vehicle: req.body, error: e.message });
  }
});

// Detail
router.get('/:id', (req, res) => {
  const db = getDb();
  const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id);
  if (!vehicle) return res.redirect('/vehicles');
  const trips = db.prepare(`SELECT * FROM trips WHERE vehicle_id = ? ORDER BY trip_date DESC, created_at DESC LIMIT 100`).all(vehicle.id);
  res.render('vehicles/show', { title: vehicle.plate_number, vehicle, trips });
});

// Edit form
router.get('/:id/edit', (req, res) => {
  const db = getDb();
  const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id);
  if (!vehicle) return res.redirect('/vehicles');
  res.render('vehicles/form', { title: 'Sửa xe - ' + vehicle.plate_number, vehicle });
});

// Update
router.post('/:id', (req, res) => {
  const db = getDb();
  const { plate_number, phone, registration_expiry, insurance_expiry, body_insurance_expiry, maintenance_km, current_km, notes } = req.body;
  try {
    db.prepare(`UPDATE vehicles SET plate_number=?, phone=?, registration_expiry=?, insurance_expiry=?, body_insurance_expiry=?, maintenance_km=?, current_km=?, notes=?, updated_at=datetime('now','localtime') WHERE id=?`)
      .run(plate_number, phone || null, registration_expiry || null, insurance_expiry || null, body_insurance_expiry || null, maintenance_km || null, current_km || 0, notes || null, req.params.id);
    res.redirect('/vehicles');
  } catch (e) {
    res.render('vehicles/form', { title: 'Sửa xe', vehicle: { ...req.body, id: req.params.id }, error: e.message });
  }
});

// Delete
router.post('/:id/delete', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM vehicles WHERE id = ?').run(req.params.id);
  res.redirect('/vehicles');
});

function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}

module.exports = router;
