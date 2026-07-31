const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const { initSchema } = require('./db/db');
const { seed } = require('./db/seed');

// 1. Khởi tạo Express app
const app = express();

// 2. Init DB + seed (run before server starts)
async function initDb() {
  await initSchema();
  await seed();
  console.log('✅ Database sẵn sàng');
}

// 3. Config Middlewares & Public folder
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// 4. View engine (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// Helper functions for views
function toDateStr(v) {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}
function formatDate(v) {
  if (!v) return '';
  const dateStr = toDateStr(v);
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}
function daysUntil(v) {
  if (!v) return Infinity;
  return Math.ceil((new Date(toDateStr(v)) - new Date()) / (1000 * 60 * 60 * 24));
}
// Biểu tượng xe theo loại (logo SVG thật của hãng)
function vehicleIcon(type) {
  const t = (type || 'Khác').toLowerCase();
  if (t.includes('vin')) return { img: '/brands/vinfast.svg', label: 'VinFast' };
  if (t.includes('mitsu')) return { img: '/brands/mitsubishi.svg', label: 'Mitsubishi' };
  return { img: '/brands/toyota.svg', label: 'Toyota' };
}

// Middleware: make helpers available to all views
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.fd = formatDate;
  res.locals.du = daysUntil;
  res.locals.vi = vehicleIcon;
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

// 6. 404
app.use((req, res) => {
  res.status(404).render('404', { title: 'Không tìm thấy' });
});

module.exports = app;
module.exports.initDb = initDb;
