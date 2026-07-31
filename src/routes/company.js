const express = require('express');
const router = express.Router();
const { query } = require('../db/db');

router.get('/', async (req, res) => {
  const result = await query('SELECT * FROM company_info WHERE id = 1');
  res.render('company/index', { title: 'Thông tin công ty', info: result.rows[0] });
});

router.post('/', async (req, res) => {
  const { name, address, phone, email, website, fine_check_url } = req.body;
  await query('UPDATE company_info SET name=$1, address=$2, phone=$3, email=$4, website=$5, fine_check_url=$6 WHERE id=1',
    [name, address, phone, email, website || null, fine_check_url]);
  res.redirect('/company');
});

module.exports = router;
