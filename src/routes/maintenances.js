const express = require('express');
const router = express.Router();
const { query } = require('../db/db');

// List
router.get('/', async (req, res) => {
  const { vehicle_id } = req.query;

  let sql = `SELECT m.*, v.plate_number FROM maintenances m JOIN vehicles v ON m.vehicle_id = v.id WHERE 1=1`;
  const params = [];
  if (vehicle_id) { sql += ` AND m.vehicle_id = $${params.length + 1}`; params.push(vehicle_id); }
  sql += ` ORDER BY m.maint_date DESC, m.created_at DESC LIMIT 200`;

  const mResult = await query(sql, params);
  const vResult = await query('SELECT * FROM vehicles WHERE is_active = 1 ORDER BY plate_number');

  res.render('maintenances/index', { title: 'Bảo dưỡng', maintenances: mResult.rows, vehicles: vResult.rows, filter_vehicle: vehicle_id || '' });
});

// New form
router.get('/new', async (req, res) => {
  const vResult = await query('SELECT * FROM vehicles WHERE is_active = 1 ORDER BY plate_number');
  const dResult = await query('SELECT name FROM drivers WHERE is_active = 1 ORDER BY name');
  const today = res.locals.todayStr();
  res.render('maintenances/form', { title: 'Thêm bảo dưỡng', maint: {}, vehicles: vResult.rows, drivers: dResult.rows, today });
});

// Create
router.post('/', async (req, res) => {
  const { vehicle_id, maint_date, driver_name, content, cost, km_at_maint, notes } = req.body;
  try {
    await query(`INSERT INTO maintenances (vehicle_id, maint_date, driver_name, content, cost, km_at_maint, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [vehicle_id, maint_date, driver_name, content, cost || null, km_at_maint || null, notes || null]);
    res.redirect('/maintenances');
  } catch (e) {
    const vResult = await query('SELECT * FROM vehicles WHERE is_active = 1 ORDER BY plate_number');
    const dResult = await query('SELECT name FROM drivers WHERE is_active = 1 ORDER BY name');
    const today = res.locals.todayStr();
    res.render('maintenances/form', { title: 'Thêm bảo dưỡng', maint: req.body, vehicles: vResult.rows, drivers: dResult.rows, today, error: e.message });
  }
});

// Edit form
router.get('/:id/edit', async (req, res) => {
  const mResult = await query('SELECT * FROM maintenances WHERE id = $1', [req.params.id]);
  const maint = mResult.rows[0];
  if (!maint) return res.redirect('/maintenances');
  const vResult = await query('SELECT * FROM vehicles WHERE is_active = 1 ORDER BY plate_number');
  const dResult = await query('SELECT name FROM drivers WHERE is_active = 1 ORDER BY name');
  res.render('maintenances/form', { title: 'Sửa bảo dưỡng', maint, vehicles: vResult.rows, drivers: dResult.rows, today: '' });
});

// Update
router.post('/:id', async (req, res) => {
  const { vehicle_id, maint_date, driver_name, content, cost, km_at_maint, notes } = req.body;
  try {
    await query(`UPDATE maintenances SET vehicle_id=$1, maint_date=$2, driver_name=$3, content=$4, cost=$5, km_at_maint=$6, notes=$7, updated_at=NOW() WHERE id=$8`,
      [vehicle_id, maint_date, driver_name, content, cost || null, km_at_maint || null, notes || null, req.params.id]);
    res.redirect('/maintenances');
  } catch (e) {
    res.render('maintenances/form', { title: 'Sửa bảo dưỡng', maint: { ...req.body, id: req.params.id }, vehicles: [], drivers: [], today: '', error: e.message });
  }
});

// Delete
router.post('/:id/delete', async (req, res) => {
  await query('DELETE FROM maintenances WHERE id = $1', [req.params.id]);
  res.redirect('/maintenances');
});

module.exports = router;
