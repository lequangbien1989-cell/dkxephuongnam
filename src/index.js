require('dotenv').config();
const app = require('./app');
const { initDb } = require('./app');

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await initDb();
  } catch (e) {
    console.error('❌ Không kết nối được database:', e.message);
    console.error('   Kiểm tra DATABASE_URL. App sẽ THOÁT.');
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log(`✅ App quản lý xe đang chạy tại http://localhost:${PORT}`);
  });
}

start();
