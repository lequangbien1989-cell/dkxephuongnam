const express = require('express');
const router = express.Router();
const { query } = require('../db/db');

const STATUSES = ['Chờ giao', 'Đang giao', 'Đã giao', 'Huỷ'];

function fmtDate(d) {
  if (!d) return null;
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  return String(d).slice(0, 10);
}

function normalizeTimeRange(str) {
  if (!str) return str;
  const m = str.match(/^(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return str;
  const fmt = (h, mm) => (mm ? h + 'h' + mm : h + 'h');
  return fmt(m[1], m[2]) + '-' + fmt(m[3], m[4]);
}

async function formData() {
  const vehicles = (await query('SELECT * FROM vehicles WHERE is_active = 1 ORDER BY plate_number')).rows;
  const drivers = (await query('SELECT name FROM drivers WHERE is_active = 1 ORDER BY name')).rows;
  const admins = (await query(`SELECT name FROM staff_contacts WHERE is_active = 1 AND role = 'Admin' ORDER BY name`)).rows;
  const salesStaff = (await query(`SELECT name FROM staff_contacts WHERE is_active = 1 AND role = 'NVKD' ORDER BY name`)).rows;
  return { vehicles, drivers, admins, salesStaff, statuses: STATUSES };
}

function bodyToDelivery(body, id) {
  return {
    ...body,
    id,
    time_range: normalizeTimeRange(body.time_range) || null,
    vehicle_id: body.vehicle_id || null,
    vehicle_plate: (body.vehicle_plate || '').trim() || null,
    quantity: body.quantity || null,
    shipping_cost: body.shipping_cost || null,
    status: STATUSES.includes(body.status) ? body.status : 'Chờ giao'
  };
}

function values(d) {
  return [
    d.delivery_date,
    d.customer_name,
    d.sales_person || null,
    d.admin_name || null,
    d.product_type || null,
    d.unit || null,
    d.quantity,
    d.vehicle_id,
    d.vehicle_plate,
    d.driver_name || null,
    d.time_range,
    d.delivery_address || null,
    d.receiver_name || null,
    d.receiver_phone || null,
    d.order_number || null,
    d.voucher_number || null,
    d.status,
    d.shipping_cost,
    d.notes || null
  ];
}

router.get('/', async (req, res) => {
  const { date_from, date_to, status, vehicle_id, customer } = req.query;
  let sql = `SELECT d.*, v.plate_number FROM delivery_plans d LEFT JOIN vehicles v ON d.vehicle_id = v.id WHERE 1=1`;
  const params = [];

  if (date_from) { params.push(date_from); sql += ` AND d.delivery_date >= $${params.length}`; }
  if (date_to) { params.push(date_to); sql += ` AND d.delivery_date <= $${params.length}`; }
  if (status) { params.push(status); sql += ` AND d.status = $${params.length}`; }
  if (vehicle_id) { params.push(vehicle_id); sql += ` AND d.vehicle_id = $${params.length}`; }
  if (customer) { params.push(`%${customer}%`); sql += ` AND d.customer_name ILIKE $${params.length}`; }

  sql += ` ORDER BY d.delivery_date DESC, d.created_at DESC LIMIT 300`;

  const deliveries = (await query(sql, params)).rows.map(d => ({ ...d, delivery_date: fmtDate(d.delivery_date) }));
  const { vehicles } = await formData();
  res.render('deliveries/index', {
    title: 'Kế hoạch giao hàng',
    deliveries,
    vehicles,
    statuses: STATUSES,
    filters: { date_from, date_to, status, vehicle_id, customer }
  });
});

router.get('/new', async (req, res) => {
  const data = await formData();
  res.render('deliveries/form', { title: 'Thêm kế hoạch giao', delivery: { status: 'Chờ giao' }, today: res.locals.todayStr(), ...data });
});

router.post('/', async (req, res) => {
  const delivery = bodyToDelivery(req.body);
  try {
    await query(`INSERT INTO delivery_plans (delivery_date, customer_name, sales_person, admin_name, product_type, unit, quantity, vehicle_id, vehicle_plate, driver_name, time_range, delivery_address, receiver_name, receiver_phone, order_number, voucher_number, status, shipping_cost, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`, values(delivery));
    res.redirect('/deliveries');
  } catch (e) {
    const data = await formData();
    res.render('deliveries/form', { title: 'Thêm kế hoạch giao', delivery: req.body, today: res.locals.todayStr(), error: e.message, ...data });
  }
});

router.get('/:id/edit', async (req, res) => {
  const delivery = (await query('SELECT * FROM delivery_plans WHERE id = $1', [req.params.id])).rows[0];
  if (!delivery) return res.redirect('/deliveries');
  delivery.delivery_date = fmtDate(delivery.delivery_date);
  const data = await formData();
  res.render('deliveries/form', { title: 'Sửa kế hoạch giao', delivery, today: '', ...data });
});

router.post('/:id', async (req, res) => {
  const delivery = bodyToDelivery(req.body, req.params.id);
  try {
    await query(`UPDATE delivery_plans SET delivery_date=$1, customer_name=$2, sales_person=$3, admin_name=$4, product_type=$5, unit=$6, quantity=$7, vehicle_id=$8, vehicle_plate=$9, driver_name=$10, time_range=$11, delivery_address=$12, receiver_name=$13, receiver_phone=$14, order_number=$15, voucher_number=$16, status=$17, shipping_cost=$18, notes=$19, updated_at=NOW() WHERE id=$20`,
      [...values(delivery), req.params.id]);
    res.redirect('/deliveries');
  } catch (e) {
    const data = await formData();
    res.render('deliveries/form', { title: 'Sửa kế hoạch giao', delivery, today: '', error: e.message, ...data });
  }
});

router.post('/:id/delete', async (req, res) => {
  await query('DELETE FROM delivery_plans WHERE id = $1', [req.params.id]);
  res.redirect('/deliveries');
});

module.exports = router;
