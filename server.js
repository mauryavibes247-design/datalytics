// ================================================================
// server.js — Datalytics API Server
// ================================================================
// Start: node server.js   OR   npm run dev  (with nodemon)
// Default port: 3000
// ================================================================

const express = require('express');
const cors    = require('cors');
const db      = require('./db');

const app  = express();
const PORT = 3000; // ← Change port here if needed

app.use(cors());
app.use(express.json());

// ── Serve the frontend HTML file at root ────────────────────────
const path = require('path');
app.use(express.static(__dirname));

// Home route → serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ================================================================
// AUTH ROUTES
// ================================================================

// POST /api/auth/login
// Body: { email, password }
// Returns: { role: 'admin'|'customer', user: {...} }
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });

    // Check admin table
    const [admins] = await db.query(
      'SELECT * FROM admins WHERE email = ? AND password = ?', [email, password]
    );
    if (admins.length) {
      const { password: _, ...admin } = admins[0];
      return res.json({ role: 'admin', user: admin });
    }

    // Check customers table
    const [customers] = await db.query(
      'SELECT * FROM customers WHERE email = ? AND password = ?', [email, password]
    );
    if (customers.length) {
      const { password: _, ...customer } = customers[0];
      return res.json({ role: 'customer', user: customer });
    }

    res.status(401).json({ error: 'Invalid email or password.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/auth/signup
// Body: { name, email, password, company }
// Returns: { user: {...} }
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, company = '' } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required.' });
    if (password.length < 6)          return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    // Check duplicate email
    const [existing] = await db.query('SELECT id FROM customers WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ error: 'Email already registered.' });

    const [result] = await db.query(
      'INSERT INTO customers (name, email, password, company) VALUES (?, ?, ?, ?)',
      [name, email, password, company]
    );
    const [rows] = await db.query('SELECT id, name, email, company, status, created_at FROM customers WHERE id = ?', [result.insertId]);
    res.status(201).json({ user: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================================================================
// SERVICES ROUTES
// ================================================================

// GET /api/services — Get all active services
app.get('/api/services', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM services WHERE is_active = 1 ORDER BY id ASC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/services/all — Admin: get all services including hidden
app.get('/api/services/all', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM services ORDER BY id ASC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/services — Admin: add a new service
// Body: { name, icon, description, price, currency, delivery, category }
app.post('/api/services', async (req, res) => {
  try {
    const { name, icon = '📊', description, price, currency = '₹', delivery = '3-5 days', category = 'reporting' } = req.body;
    if (!name || !description || !price) return res.status(400).json({ error: 'name, description and price are required.' });
    const [result] = await db.query(
      'INSERT INTO services (name, icon, description, price, currency, delivery, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, icon, description, price, currency, delivery, category]
    );
    const [rows] = await db.query('SELECT * FROM services WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/services/:id — Admin: edit a service
app.put('/api/services/:id', async (req, res) => {
  try {
    const { name, icon, description, price, currency, delivery, category, is_active } = req.body;
    await db.query(
      'UPDATE services SET name=?, icon=?, description=?, price=?, currency=?, delivery=?, category=?, is_active=? WHERE id=?',
      [name, icon, description, price, currency, delivery, category, is_active ?? 1, req.params.id]
    );
    const [rows] = await db.query('SELECT * FROM services WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/services/:id — Admin: delete a service
app.delete('/api/services/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM services WHERE id = ?', [req.params.id]);
    res.json({ message: 'Service deleted.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================================================================
// CUSTOMERS ROUTES (Admin only)
// ================================================================

// GET /api/customers — Admin: get all customers
app.get('/api/customers', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, company, status, created_at FROM customers ORDER BY created_at DESC'
    );
    // Attach request count per customer
    for (const c of rows) {
      const [[{ cnt }]] = await db.query('SELECT COUNT(*) AS cnt FROM requests WHERE customer_id = ?', [c.id]);
      c.request_count = cnt;
    }
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/customers/:id — Admin: get single customer
app.get('/api/customers/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, company, status, created_at FROM customers WHERE id = ?', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Customer not found.' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/customers/:id — Admin or customer (update profile)
// Body: { name, email, company, password, status }
app.put('/api/customers/:id', async (req, res) => {
  try {
    const { name, email, company, password, status } = req.body;
    const fields = [], values = [];
    if (name)     { fields.push('name = ?');     values.push(name); }
    if (email)    { fields.push('email = ?');    values.push(email); }
    if (company !== undefined) { fields.push('company = ?'); values.push(company); }
    if (password && password.length >= 6) { fields.push('password = ?'); values.push(password); }
    if (status)   { fields.push('status = ?');   values.push(status); }
    if (!fields.length) return res.status(400).json({ error: 'Nothing to update.' });
    values.push(req.params.id);
    await db.query(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`, values);
    const [rows] = await db.query('SELECT id, name, email, company, status FROM customers WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/customers/:id — Admin: delete customer
app.delete('/api/customers/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM customers WHERE id = ?', [req.params.id]);
    res.json({ message: 'Customer deleted.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================================================================
// REQUESTS ROUTES
// ================================================================

// GET /api/requests — Admin: get all requests (with customer & service info)
app.get('/api/requests', async (req, res) => {
  try {
    const { status } = req.query; // optional filter: ?status=pending
    let sql = `
      SELECT r.*, c.name AS customer_name, c.company AS customer_company,
             s.name AS service_name, s.icon AS service_icon
      FROM requests r
      JOIN customers c ON r.customer_id = c.id
      JOIN services  s ON r.service_id  = s.id
    `;
    const params = [];
    if (status && status !== 'all') { sql += ' WHERE r.status = ?'; params.push(status); }
    sql += ' ORDER BY r.created_at DESC';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/requests/customer/:customerId — Customer: get own requests
app.get('/api/requests/customer/:customerId', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT r.*, s.name AS service_name, s.icon AS service_icon
      FROM requests r
      JOIN services s ON r.service_id = s.id
      WHERE r.customer_id = ?
      ORDER BY r.created_at DESC
    `, [req.params.customerId]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/requests — Customer: submit a new request
// Body: { customer_id, service_id, message, priority }
app.post('/api/requests', async (req, res) => {
  try {
    const { customer_id, service_id, message, priority = 'medium' } = req.body;
    if (!customer_id || !service_id || !message) return res.status(400).json({ error: 'customer_id, service_id and message are required.' });
    const [result] = await db.query(
      'INSERT INTO requests (customer_id, service_id, message, priority) VALUES (?, ?, ?, ?)',
      [customer_id, service_id, message, priority]
    );
    const [rows] = await db.query('SELECT * FROM requests WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/requests/:id — Admin: update status, priority, admin_note
// Body: { status, priority, admin_note }
app.put('/api/requests/:id', async (req, res) => {
  try {
    const { status, priority, admin_note } = req.body;
    await db.query(
      'UPDATE requests SET status = ?, priority = ?, admin_note = ? WHERE id = ?',
      [status, priority, admin_note ?? '', req.params.id]
    );
    const [rows] = await db.query('SELECT * FROM requests WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/requests/:id — Admin or Customer: delete a request
app.delete('/api/requests/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM requests WHERE id = ?', [req.params.id]);
    res.json({ message: 'Request deleted.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================================================================
// MESSAGES ROUTES
// ================================================================

// GET /api/messages/:customerId — Get chat between admin and one customer
app.get('/api/messages/:customerId', async (req, res) => {
  try {
    const cid = req.params.customerId;
    const [rows] = await db.query(`
      SELECT * FROM messages
      WHERE (from_type = 'customer' AND from_id = ?)
         OR (to_type   = 'customer' AND to_id   = ?)
      ORDER BY created_at ASC
    `, [cid, cid]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/messages/threads/all — Admin: list all customers who have messages
app.get('/api/messages/threads/all', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT DISTINCT
        c.id, c.name, c.company, c.email,
        (SELECT body FROM messages m2
         WHERE (m2.from_id = c.id AND m2.from_type = 'customer')
            OR (m2.to_id   = c.id AND m2.to_type   = 'customer')
         ORDER BY m2.created_at DESC LIMIT 1) AS last_message,
        (SELECT created_at FROM messages m3
         WHERE (m3.from_id = c.id AND m3.from_type = 'customer')
            OR (m3.to_id   = c.id AND m3.to_type   = 'customer')
         ORDER BY m3.created_at DESC LIMIT 1) AS last_time
      FROM customers c
      JOIN messages m ON (m.from_id = c.id AND m.from_type = 'customer')
                      OR (m.to_id   = c.id AND m.to_type   = 'customer')
      ORDER BY last_time DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/messages — Send a message
// Body: { from_type, from_id, to_type, to_id, body }
app.post('/api/messages', async (req, res) => {
  try {
    const { from_type, from_id, to_type, to_id, body } = req.body;
    if (!from_type || !from_id || !to_type || !to_id || !body) return res.status(400).json({ error: 'All fields required.' });
    const [result] = await db.query(
      'INSERT INTO messages (from_type, from_id, to_type, to_id, body) VALUES (?, ?, ?, ?, ?)',
      [from_type, from_id, to_type, to_id, body]
    );
    const [rows] = await db.query('SELECT * FROM messages WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/messages/read/:customerId — Mark messages as read
app.put('/api/messages/read/:customerId', async (req, res) => {
  try {
    await db.query(
      "UPDATE messages SET is_read = 1 WHERE to_type = 'admin' AND from_id = ?",
      [req.params.customerId]
    );
    res.json({ message: 'Marked as read.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================================================================
// ADMIN STATS
// ================================================================

// GET /api/stats — Admin dashboard numbers
app.get('/api/stats', async (req, res) => {
  try {
    const [[{ total_customers }]] = await db.query('SELECT COUNT(*) AS total_customers FROM customers');
    const [[{ total_requests  }]] = await db.query('SELECT COUNT(*) AS total_requests  FROM requests');
    const [[{ pending         }]] = await db.query("SELECT COUNT(*) AS pending FROM requests WHERE status = 'pending'");
    const [[{ active          }]] = await db.query("SELECT COUNT(*) AS active  FROM requests WHERE status = 'active'");
    const [[{ resolved        }]] = await db.query("SELECT COUNT(*) AS resolved FROM requests WHERE status = 'resolved'");
    const [[{ unread_messages }]] = await db.query("SELECT COUNT(*) AS unread_messages FROM messages WHERE to_type = 'admin' AND is_read = 0");
    res.json({ total_customers, total_requests, pending, active, resolved, unread_messages });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================================================================
// START SERVER
// ================================================================
app.listen(PORT, () => {
  console.log(`\n🚀 Datalytics server running at http://localhost:${PORT}`);
  console.log(`   API base: http://localhost:${PORT}/api`);
  console.log(`   Frontend: http://localhost:${PORT}\n`);
});
