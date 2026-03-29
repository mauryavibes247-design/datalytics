// ================================================================
// db.js — MySQL Connection (Railway compatible)
// ================================================================

const mysql = require('mysql2/promise');

let pool;

if (process.env.MYSQL_URL) {
  // Railway — use the connection URL directly
  pool = mysql.createPool(process.env.MYSQL_URL);
} else {
  // Local development
  pool = mysql.createPool({
    host     : 'localhost',
    port     : 3306,
    user     : 'root',
    password : '1202',
    database : 'datalytics',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL connected successfully!');
    connection.release();
  } catch (error) {
    console.error('❌ MySQL connection failed:', error.message);
    console.error('⚠️  Check that MySQL is running and credentials are correct.');
  }
}

testConnection();

module.exports = pool;
