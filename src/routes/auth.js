const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('auth/login', { title: 'Đăng nhập', layout: false });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('auth/login', { title: 'Đăng nhập', layout: false, error: 'Vui lòng nhập đầy đủ' });
  }
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.render('auth/login', { title: 'Đăng nhập', layout: false, error: 'Sai tài khoản hoặc mật khẩu' });
  }
  req.session.user = { id: user.id, username: user.username, full_name: user.full_name, role: user.role };
  res.redirect('/');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
