const express = require('express');
const router = express.Router();
const { query } = require('../db/db');

// List
router.get('/', async (req, res) => {
  const result = await query('SELECT * FROM vehicles WHERE is_active = 1 ORDER BY plate_number');
  const vehicles = result.rows;
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
router.post('/', async (req, res) => {
  const { plate_number, phone, registration_expiry, insurance_expiry, body_insurance_expiry, maintenance_km, notes } = req.body;
  try {
    await query(`INSERT INTO vehicles (plate_number, phone, registration_expiry, insurance_expiry, body_insurance_expiry, maintenance_km, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [plate_number, phone, registration_expiry || null, insurance_expiry || null, body_insurance_expiry || null, maintenance_km || null, notes || null]);
    res.redirect('/vehicles');
  } catch (e) {
    res.render('vehicles/form', { title: 'Thêm xe', vehicle: req.body, error: e.message });
  }
});

// Detail
router.get('/:id', async (req, res) => {
  const vResult = await query('SELECT * FROM vehicles WHERE id = $1', [req.params.id]);
  const vehicle = vResult.rows[0];
  if (!vehicle) return res.redirect('/vehicles');
  const tResult = await query(`SELECT * FROM trips WHERE vehicle_id = $1 ORDER BY trip_date DESC, created_at DESC LIMIT 100`, [vehicle.id]);
  res.render('vehicles/show', { title: vehicle.plate_number, vehicle, trips: tResult.rows });
});

// Edit form
router.get('/:id/edit', async (req, res) => {
  const result = await query('SELECT * FROM vehicles WHERE id = $1', [req.params.id]);
  const vehicle = result.rows[0];
  if (!vehicle) return res.redirect('/vehicles');
  res.render('vehicles/form', { title: 'Sửa xe - ' + vehicle.plate_number, vehicle });
});

// Update
router.post('/:id', async (req, res) => {
  const { plate_number, phone, registration_expiry, insurance_expiry, body_insurance_expiry, maintenance_km, current_km, notes } = req.body;
  try {
    await query(`UPDATE vehicles SET plate_number=$1, phone=$2, registration_expiry=$3, insurance_expiry=$4, body_insurance_expiry=$5, maintenance_km=$6, current_km=$7, notes=$8, updated_at=NOW() WHERE id=$9`,
      [plate_number, phone || null, registration_expiry || null, insurance_expiry || null, body_insurance_expiry || null, maintenance_km || null, current_km || 0, notes || null, req.params.id]);
    res.redirect('/vehicles');
  } catch (e) {
    res.render('vehicles/form', { title: 'Sửa xe', vehicle: { ...req.body, id: req.params.id }, error: e.message });
  }
});

// Delete
router.post('/:id/delete', async (req, res) => {
  await query('DELETE FROM vehicles WHERE id = $1', [req.params.id]);
  res.redirect('/vehicles');
});

function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}

module.exports = router;
