const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const ejs = require('ejs');
const path = require('path');
const db = require('./db');  // Import your database connection

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
// Set up EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve the signup form
app.get('/signup', (req, res) => {
  res.render('signup');
});
app.get('/quiz', (req, res) => {
  res.render('quiz');
});
// Handle signup form submission
app.post('/signup', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).send('All fields are required.');
  }

  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      console.error('Error hashing password:', err);
      return res.status(500).send('Internal Server Error');
    }

    const query = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
    db.query(query, [name, email, hashedPassword], (err, results) => {
      if (err) {
        console.error('Error inserting user into the database:', err);
        return res.status(500).send('Internal Server Error');
      }
    res.redirect("/login");
    });
  });
});


// Serve the login form
app.get('/login', (req, res) => {
  res.render('login');
});

// Handle login form submission
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send('Both email and password are required.');
  }

  const query = 'SELECT * FROM users WHERE email = ?';
  db.query(query, [email], (err, results) => {
    if (err) {
      console.error('Error querying the database:', err);
      return res.status(500).send('Internal Server Error');
    }

    if (results.length === 0) {
      return res.status(401).send('No user found with that email.');
    }

    const user = results[0];

    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        console.error('Error comparing passwords:', err);
        return res.status(500).send('Internal Server Error');
      }

      if (isMatch) {
        res.redirect('/home');
      } else {
        res.status(401).send('Incorrect password.');
      }
    });
  });
});
app.get('/home', (req, res) => {
  const query = 'SELECT herb_id, name, photo1 FROM herbs';

  db.query(query, (err, results) => {
      if (err) {
          console.error('Error fetching herbs:', err);
          return res.status(500).send('Internal Server Error');
      }
console.log(results);
      // Render the home page with list of herbs
      res.render('home', { herbs: results });
  });
});
app.get('/herb/:id', (req, res) => {
  const herbId = req.params.id;

  const query = 'SELECT * FROM herbs WHERE herb_id = ?';
  db.query(query, [herbId], (err, results) => {
      if (err) {
          console.error('Error fetching herb details:', err);
          return res.status(500).send('Internal Server Error');
      }

      if (results.length === 0) {
          return res.status(404).send('Herb not found');
      }
console.log(results);
      const herb = results[0];
console.log(herb.photo2);
      // Render the detailed herb page
      res.render('page', { herb });
  });
});
// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
