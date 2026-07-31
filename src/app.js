const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const { getDb } = require('./db/database');
const { seed } = require('./db/seed');

// 1. Khởi tạo Express app
const app = express();

// 2. Init DB + seed
getDb();
seed();

// 3. Config Middlewares & Public folder
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// 4. View engine (EJS)
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

// 5. Routes
app.use('/', require('./routes/dashboard'));
app.use('/vehicles', require('./routes/vehicles'));
app.use('/drivers', require('./routes/drivers'));
app.use('/trips', require('./routes/trips'));
app.use('/maintenances', require('./routes/maintenances'));
app.use('/company', require('./routes/company'));
app.use('/api', require('./routes/api'));

// 6. 404 Handler
app.use((req, res) => {
  res.status(404).render('404', { title: 'Không tìm thấy' });
});

// 7. BẮT BUỘC NẰM Ở DÒNG CUỐI CÙNG CỦA FILE:
module.exports = app;
