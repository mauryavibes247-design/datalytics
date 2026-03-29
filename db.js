// ================================================================
// db.js — MySQL Connection (Promise-based)
// ================================================================

const mysql = require('mysql2/promise');

// Uses environment variables on Railway, falls back to localhost for development
const DB_CONFIG = {
  host     : process.env.DB_HOST     || 'localhost',
  port     : process.env.DB_PORT     || 3306,
  user     : process.env.DB_USER     || 'root',
  password : process.env.DB_PASSWORD || '1202',
  database : process.env.DB_NAME     || 'datalytics',
};

const pool = mysql.createPool({
  ...DB_CONFIG,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

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

module.exports = pool;
