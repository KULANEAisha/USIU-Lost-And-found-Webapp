const mysql = require('mysql2/promise');
require('dotenv').config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0,
  // ↓ Supported timeouts ↓
  connectTimeout: 10000,  // 10s connection timeout
  idleTimeout: 60000,     // 60s idle timeout
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

// In your db.js file, add this:
db.safeQuery = async (sql, params) => {
  try {
    const [results] = await db.query(sql, params);
    return results;
  } catch (err) {
    console.error('Database query error:', err);
    throw err; // Re-throw the error to be caught by the route handler
  }
};

// Test connection
db.getConnection()
  .then(conn => {
    console.log('✅ MySQL connected. Timeout settings:');
    return conn.query(`SHOW VARIABLES LIKE '%timeout%'`)
      .then(([rows]) => {
        console.table(rows);
        conn.release();
      });
  })
  .catch(err => {
    console.error('❌ DB connection failed:', err);
    process.exit(1);
  });

module.exports = db;