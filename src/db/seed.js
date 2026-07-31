const bcrypt = require('bcryptjs');
const { query } = require('./db');

async function seed() {
  // Only seed if vehicles table is empty
  const count = await query('SELECT COUNT(*) as c FROM vehicles');
  if (count.rows[0].c > 0) {
    // Dữ liệu đã có: gán loại xe theo biển số nếu chưa có
    const vResult = await query(`SELECT id, plate_number, vehicle_type FROM vehicles`);
    const typeByPlate = {
      '51F-784.31': 'Mitsubishi',
      '51H-27821': 'VinFast',
      '51L-682.03': 'VinFast',
      '51H-252.30': 'Toyota',
      '52F-8896': 'Toyota',
      '52X-6133': 'Toyota'
    };
    for (const v of vResult.rows) {
      if (!v.vehicle_type && typeByPlate[v.plate_number]) {
        await query(`UPDATE vehicles SET vehicle_type=$1 WHERE id=$2`, [typeByPlate[v.plate_number], v.id]);
      }
    }
    return;
  }

  console.log('🌱 Seeding initial data...');

  // Admin user
  const hashed = bcrypt.hashSync('admin123', 10);
  await query(`INSERT INTO users (username, password, full_name, role) VALUES ($1, $2, $3, $4)`,
    ['admin', hashed, 'Admin', 'admin']);

  // Company info
  await query(`INSERT INTO company_info (id, name, address, phone, email, fine_check_url) VALUES (1, $1, $2, $3, $4, $5)`,
    ['Công ty TNHH Cách Âm Cách Nhiệt Phương Nam',
      '99 QL 1A, Phường Tân Thới Nhất, Quận 12, TP HCM',
      '028 3590 1968',
      'hi@phuongnampanel.com',
      'https://www.csgt.vn/tra-cuu-phuong-tien-vi-pham.html']);

  // Vehicles [plate, type, phone, reg, ins, body, maint_km]
  const vehicles = [
    ['51F-784.31', 'Mitsubishi', null, '2026-08-21', '2026-08-20', null, 234000],
    ['51H-27821', 'VinFast', '0932038678 (Hải)', '2028-01-15', '2027-05-15', '2027-05-16', 48000],
    ['51L-682.03', 'VinFast', '0932038678 (Hải)', '2028-01-15', '2027-05-15', '2027-05-16', 36000],
    ['51H-252.30', 'Toyota', null, '2026-07-31', '2027-02-04', '2027-02-28', 129000],
    ['52F-8896', 'Toyota', null, '2027-04-14', '2026-10-19', null, 390000],
    ['52X-6133', 'Toyota', null, '2026-09-26', '2026-10-18', null, null],
  ];
  for (const v of vehicles) {
    await query(`INSERT INTO vehicles (plate_number, vehicle_type, phone, registration_expiry, insurance_expiry, body_insurance_expiry, maintenance_km) VALUES ($1, $2, $3, $4, $5, $6, $7)`, v);
  }

  // Drivers
  const drivers = ['Vân', 'Đình Tùng', 'Hoà', 'Thanh', 'Mai', 'Trang', 'Linh', 'Bình An',
    'Chung', 'Phi', 'Biển', 'Huyền Trang', 'Anh Mạnh', 'Sếp Thanh', 'Thanh Tùng', 'Anh Giang'];
  for (const d of drivers) {
    await query(`INSERT INTO drivers (name) VALUES ($1)`, [d]);
  }

  console.log('✅ Seed data created: 6 xe, 16 tài xế');
}

module.exports = { seed };
