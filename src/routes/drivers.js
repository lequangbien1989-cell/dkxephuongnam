const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

router.get('/', (req, res) => {
  const db = getDb();
  const drivers = db.prepare('SELECT * FROM drivers WHERE is_active = 1 ORDER BY name').all();
  res.render('drivers/index', { title: 'Danh sách tài xế', drivers });
});

router.get('/new', (req, res) => {
  res.render('drivers/form', { title: 'Thêm tài xế', driver: {} });
});

router.post('/', (req, res) => {
  const db = getDb();
  try {
    db.prepare('INSERT INTO drivers (name, phone) VALUES (?, ?)').run(req.body.name, req.body.phone || null);
    res.redirect('/drivers');
  } catch (e) {
    res.render('drivers/form', { title: 'Thêm tài xế', driver: req.body, error: e.message });
  }
});

router.get('/:id/edit', (req, res) => {
  const db = getDb();
  const driver = db.prepare('SELECT * FROM drivers WHERE id = ?').get(req.params.id);
  if (!driver) return res.redirect('/drivers');
  res.render('drivers/form', { title: 'Sửa - ' + driver.name, driver });
});

router.post('/:id', (req, res) => {
  const db = getDb();
  try {
    db.prepare('UPDATE drivers SET name=?, phone=? WHERE id=?').run(req.body.name, req.body.phone || null, req.params.id);
    res.redirect('/drivers');
  } catch (e) {
    res.render('drivers/form', { title: 'Sửa tài xế', driver: { ...req.body, id: req.params.id }, error: e.message });
  }
});

router.post('/:id/delete', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM drivers WHERE id = ?').run(req.params.id);
  res.redirect('/drivers');
});

module.exports = router;
