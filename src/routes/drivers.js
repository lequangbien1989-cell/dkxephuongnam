const express = require('express');
const router = express.Router();
const { query } = require('../db/db');

router.get('/', async (req, res) => {
  const result = await query('SELECT * FROM drivers WHERE is_active = 1 ORDER BY name');
  res.render('drivers/index', { title: 'Danh sách tài xế', drivers: result.rows });
});

router.get('/new', (req, res) => {
  res.render('drivers/form', { title: 'Thêm tài xế', driver: {} });
});

router.post('/', async (req, res) => {
  try {
    await query('INSERT INTO drivers (name, phone) VALUES ($1, $2)', [req.body.name, req.body.phone || null]);
    res.redirect('/drivers');
  } catch (e) {
    res.render('drivers/form', { title: 'Thêm tài xế', driver: req.body, error: e.message });
  }
});

router.get('/:id/edit', async (req, res) => {
  const result = await query('SELECT * FROM drivers WHERE id = $1', [req.params.id]);
  const driver = result.rows[0];
  if (!driver) return res.redirect('/drivers');
  res.render('drivers/form', { title: 'Sửa - ' + driver.name, driver });
});

router.post('/:id', async (req, res) => {
  try {
    await query('UPDATE drivers SET name=$1, phone=$2 WHERE id=$3', [req.body.name, req.body.phone || null, req.params.id]);
    res.redirect('/drivers');
  } catch (e) {
    res.render('drivers/form', { title: 'Sửa tài xế', driver: { ...req.body, id: req.params.id }, error: e.message });
  }
});

router.post('/:id/delete', async (req, res) => {
  await query('DELETE FROM drivers WHERE id = $1', [req.params.id]);
  res.redirect('/drivers');
});

module.exports = router;
