const mysql = require('mysql4');

// Create a connection to the database
const connection = mysql.createConnection({
  host: 'localhost',       // Replace with your MySQL host
  user: 'root',            // Replace with your MySQL username
  password: 'root',    // Replace with your MySQL password
  database: 'medicalplants'  // Replace with your database name
});

// Connect to the MySQL server
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err.stack);
    return;
  }
  console.log('Connected to the database as id ' + connection.threadId);
});

module.exports = connection;
