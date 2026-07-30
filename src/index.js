const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ App quản lý xe đang chạy tại http://localhost:${PORT}`);
});
