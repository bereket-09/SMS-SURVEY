const mysql = require("mysql2");

const dbAddresses = ["mysql", "db4free.net", "localhost"];

const connectionPool = mysql.createPool({
  connectionLimit: 20,
  host: "localhost",
  port: 3306,
  user: "root",
  password: "password",
  database: "sms_testing",
  multipleStatements: true,
  idleTimeoutMillis: 60000,
  acquireTimeoutMillis: 20000,
});

const dbConnection = connectionPool.promise();

// Test the connection pool
dbConnection
  .execute("SELECT 1")
  .then(() => {
    console.log("Connected to MySQL database");
  })
  .catch((error) => {
    console.error(`Failed to connect to MySQL database: ${error.message}`);
  });

module.exports = dbConnection;
