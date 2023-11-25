const mysql = require("mysql2");

const dbAddresses = ["mysql", "db4free.net", "localhost"];

const connection = mysql.createPool({
  connectionLimit: 20, // maximum number of connections to create
  host: "localhost",
  port: 3306,
  user: "root",
  password: "password",
  database: "sms_testing",
  multipleStatements: true,
  idleTimeoutMillis: 60000, // Close connections that have been idle for 60 seconds
  acquireTimeoutMillis: 20000, // Wait no longer than 10 seconds for a connection
});

// test the connection pool
connection.getConnection((err, conn) => {
  if (err) {
    console.error(`Failed to get connection: ${err.message}`);
    return;
  }
  console.log("Connected to MySQL database");
  conn.release(); // release the connection back to the pool after use
});

module.exports = connection;
