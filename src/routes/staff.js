const express = require('express');
const router = express.Router();
const { query } = require('../db/db');

const ROLES = ['Admin', 'NVKD'];

function role(v) {
  return ROLES.includes(v) ? v : 'NVKD';
}

router.get('/', async (req, res) => {
  const { role: filterRole } = req.query;
  const params = [];
  let sql = 'SELECT * FROM staff_contacts WHERE is_active = 1';
  if (filterRole && ROLES.includes(filterRole)) { params.push(filterRole); sql += ` AND role = $${params.length}`; }
  sql += ' ORDER BY role, name';
  const staff = (await query(sql, params)).rows;
  res.render('staff/index', { title: 'Admin/NVKD', staff, roles: ROLES, filterRole: filterRole || '' });
});

router.get('/new', (req, res) => {
  res.render('staff/form', { title: 'Thêm nhân sự', person: { role: req.query.role || 'NVKD' }, roles: ROLES });
});

router.post('/', async (req, res) => {
  const person = { ...req.body, role: role(req.body.role) };
  try {
    await query('INSERT INTO staff_contacts (role, name, phone) VALUES ($1, $2, $3)', [person.role, person.name, person.phone || null]);
    res.redirect('/staff');
  } catch (e) {
    res.render('staff/form', { title: 'Thêm nhân sự', person, roles: ROLES, error: e.message });
  }
});

router.get('/:id/edit', async (req, res) => {
  const person = (await query('SELECT * FROM staff_contacts WHERE id = $1 AND is_active = 1', [req.params.id])).rows[0];
  if (!person) return res.redirect('/staff');
  res.render('staff/form', { title: 'Sửa - ' + person.name, person, roles: ROLES });
});

router.post('/:id', async (req, res) => {
  const person = { ...req.body, id: req.params.id, role: role(req.body.role) };
  try {
    await query('UPDATE staff_contacts SET role=$1, name=$2, phone=$3, updated_at=NOW() WHERE id=$4', [person.role, person.name, person.phone || null, req.params.id]);
    res.redirect('/staff');
  } catch (e) {
    res.render('staff/form', { title: 'Sửa nhân sự', person, roles: ROLES, error: e.message });
  }
});

router.post('/:id/delete', async (req, res) => {
  await query('UPDATE staff_contacts SET is_active = 0, updated_at = NOW() WHERE id = $1', [req.params.id]);
  res.redirect('/staff');
});

module.exports = router;
