const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

router.get('/', (req, res) => {
  const db = getDb();
  const info = db.prepare('SELECT * FROM company_info WHERE id = 1').get();
  res.render('company/index', { title: 'Thông tin công ty', info });
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, address, phone, email, website, fine_check_url } = req.body;
  db.prepare('UPDATE company_info SET name=?, address=?, phone=?, email=?, website=?, fine_check_url=? WHERE id=1')
    .run(name, address, phone, email, website || null, fine_check_url);
  res.redirect('/company');
});

module.exports = router;
