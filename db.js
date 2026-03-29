// ================================================================
// db.js — MySQL Connection (Promise-based)
// ================================================================

const mysql = require('mysql2/promise');

// 🔹 Database Configuration
const DB_CONFIG = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '1202',
  database: 'datalytics',
};

// 🔹 Create Connection Pool
const pool = mysql.createPool({
  ...DB_CONFIG,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// 🔹 Test Connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL connected to database:', DB_CONFIG.database);
    connection.release();
  } catch (error) {
    console.error('❌ MySQL connection failed:', error.message);
    console.error('⚠️  Check that MySQL is running and credentials in db.js are correct.');
  }
}

testConnection();

// 🔹 Export pool
module.exports = pool;