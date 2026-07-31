const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const { getDb } = require('./db/database');
const { seed } = require('./db/seed');

// Chỉ dùng 1 dòng khai báo 'app' này duy nhất:
const app = express();

// ... các cấu hình app.use(), app.set() khác ...

module.exports = app;
// Init DB + seed
getDb();
seed();

const app = express();

// Config
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// Helper functions for views
function formatDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}
function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}

// Middleware: make helpers available to all views
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.fd = formatDate;
  res.locals.du = daysUntil;
  next();
});

// Routes
app.use('/', require('./routes/dashboard'));
app.use('/vehicles', require('./routes/vehicles'));
app.use('/drivers', require('./routes/drivers'));
app.use('/trips', require('./routes/trips'));
app.use('/maintenances', require('./routes/maintenances'));
app.use('/company', require('./routes/company'));
app.use('/api', require('./routes/api'));

// 404
app.use((req, res) => {
  res.status(404).render('404', { title: 'Không tìm thấy' });
});

module.exports = app;
