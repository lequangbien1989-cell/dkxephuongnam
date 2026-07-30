const bcrypt = require('bcryptjs');
const { getDb } = require('./database');

function seed() {
  const db = getDb();

  // Only seed if vehicles table is empty
  const count = db.prepare('SELECT COUNT(*) as c FROM vehicles').get().c;
  if (count > 0) return;

  console.log('🌱 Seeding initial data...');

  // Admin user
  const hashed = bcrypt.hashSync('admin123', 10);
  db.prepare(`INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)`)
    .run('admin', hashed, 'Admin', 'admin');

  // Company info
  db.prepare(`INSERT INTO company_info (id, name, address, phone, email, fine_check_url) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(1, 'Công ty TNHH Cách Âm Cách Nhiệt Phương Nam',
      '99 QL 1A, Phường Tân Thới Nhất, Quận 12, TP HCM',
      '028 3590 1968',
      'hi@phuongnampanel.com',
      'https://www.csgt.vn/tra-cuu-phuong-tien-vi-pham.html');

  // Vehicles
  const insertVehicle = db.prepare(`INSERT INTO vehicles
    (plate_number, phone, registration_expiry, insurance_expiry, body_insurance_expiry, maintenance_km)
    VALUES (?, ?, ?, ?, ?, ?)`);

  const vehicles = [
    ['51F-784.31', null, '2026-08-21', '2026-08-20', null, 234000],
    ['51H-27821', '0932038678 (Hải)', '2028-01-15', '2027-05-15', '2027-05-16', 48000],
    ['51L-682.03', '0932038678 (Hải)', '2028-01-15', '2027-05-15', '2027-05-16', 36000],
    ['51H-252.30', null, '2026-07-31', '2027-02-04', '2027-02-28', 129000],
    ['52F-8896', null, '2027-04-14', '2026-10-19', null, 390000],
    ['52X-6133', null, '2026-09-26', '2026-10-18', null, null],
  ];
  for (const v of vehicles) insertVehicle.run(...v);

  // Drivers
  const insertDriver = db.prepare(`INSERT INTO drivers (name) VALUES (?)`);
  const drivers = ['Vân', 'Đình Tùng', 'Hoà', 'Thanh', 'Mai', 'Trang', 'Linh', 'Bình An',
    'Chung', 'Phi', 'Biển', 'Huyền Trang', 'Anh Mạnh', 'Sếp Thanh', 'Thanh Tùng', 'Anh Giang'];
  for (const d of drivers) insertDriver.run(d);

  console.log('✅ Seed data created: admin/admin123, 6 xe, 16 tài xế');
}

module.exports = { seed };
