const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const ejs = require('ejs');
const path = require('path');
const db = require('./db');  // Import your database connection
const session = require('express-session');  // Import express-session

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Set up EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Configure Sessions
app.use(session({
  secret: 'yourSecretKey',  // Replace with a strong secret key
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }  // Set 'true' if using HTTPS
}));

// Middleware to make user session available in templates
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

// Serve the signup form
app.get('/signup', (req, res) => {
  res.render('signup');
});

app.get('/quiz', (req, res) => {
  res.render('quiz');
});

app.get('/contact', (req, res) => {
  res.render('contact');
});

app.get('/about', (req, res) => {
  res.render('about');
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
        // Save user data in the session
        req.session.user = { id: user.id, email: user.email, name: user.name };
        res.redirect('/home');
      } else {
        res.status(401).send('Incorrect password.');
      }
    });
  });
});

// Serve the home page
app.get('/home', (req, res) => {
  const query = 'SELECT herb_id, name, photo1, cure FROM herbs';

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching herbs:', err);
      return res.status(500).send('Internal Server Error');
    }
    // Render the home page with list of herbs
    res.render('home', { herbs: results ,searchString:null});
  });
});

// Serve the detailed herb page
app.get('/herb/:id', (req, res) => {
  const herbId = req.params.id;
  const userId = req.session.user ? req.session.user.id : null; // Ensure the user is logged in

  if (!userId) {
      return res.redirect('/login'); // Redirect if user is not logged in
  }

  // Fetch herb details
  const herbQuery = 'SELECT * FROM herbs WHERE herb_id = ?';
  db.query(herbQuery, [herbId], (err, herbResults) => {
      if (err) {
          console.error('Error fetching herb details:', err);
          return res.status(500).send('Internal Server Error');
      }

      if (herbResults.length === 0) {
          return res.status(404).send('Herb not found');
      }

      const herb = herbResults[0];

      // Check if the herb is already bookmarked by the user
      const bookmarkQuery = 'SELECT * FROM bookmark WHERE id = ? AND herb_id = ?';
      db.query(bookmarkQuery, [userId, herbId], (err, bookmarkResults) => {
          if (err) {
              console.error('Error checking bookmark status:', err);
              return res.status(500).send('Internal Server Error');
          }

          // Pass the bookmark status to the template
          const isBookmarked = bookmarkResults.length > 0;
          res.render('page', { herb, isBookmarked });
      });
  });
});


// Bookmark a herb
app.post('/bookmark', (req, res) => {
  const { herb_id } = req.body;
  const user_id = req.session.user ? req.session.user.id : null;

  if (!user_id) {
    return res.status(401).send('You must be logged in to bookmark herbs.');
  }

  // Check if the bookmark already exists
  const checkQuery = 'SELECT * FROM bookmark WHERE id = ? AND herb_id = ?';
  db.query(checkQuery, [user_id, herb_id], (err, results) => {
    if (err) {
      console.error('Error checking bookmark:', err);
      return res.status(500).send('Internal Server Error');
    }

    if (results.length > 0) {
      return res.send('This herb is already bookmarked.');
    }

    // Insert the bookmark into the database
    const insertQuery = 'INSERT INTO bookmark (id, herb_id) VALUES (?, ?)';
    db.query(insertQuery, [user_id, herb_id], (err, results) => {
      if (err) {
        console.error('Error bookmarking herb:', err);
        return res.status(500).send('Internal Server Error');
      }
      res.redirect(`/herb/${herb_id}`); // Redirect to a relevant page after bookmarking
    });
  });
});
// Serve the garden page with bookmarked herbs
app.get('/garden', (req, res) => {
  // Ensure the user is logged in
  if (!req.session.user) {
    return res.redirect('/login');
  }

  const user_id = req.session.user.id;

  // Query to fetch bookmarked herbs for the logged-in user
  const query = `
    SELECT herbs.herb_id, herbs.name, herbs.photo1, herbs.cure
    FROM herbs
    JOIN bookmark ON herbs.herb_id = bookmark.herb_id
    WHERE bookmark.id = ?
  `;

  db.query(query, [user_id], (err, results) => {
    if (err) {
      console.error('Error fetching bookmarked herbs:', err);
      return res.status(500).send('Internal Server Error');
    }

    // Render the garden page with the bookmarked herbs
    res.render('garden', { bookmarkedHerbs: results });
  });
});
// Serve the season page with herbs data
app.get('/season', (req, res) => {
  // Fetch all herbs from the database
  const query = 'SELECT herb_id, name, photo1, cure, season FROM herbs';

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching herbs:', err);
      return res.status(500).send('Internal Server Error');
    }

    // Render the season page with all herbs data
    res.render('season', { herbs: results });
  });
});
// Search herbs based on user query
app.get('/search', (req, res) => {
  const searchString = req.query.query;

  // SQL query to search in multiple attributes using LIKE
  const query = `
    SELECT herb_id, name, photo1, cure, scientific_name, description, uses, active_compounds, precautions, season
    FROM herbs
    WHERE name LIKE ? OR
          scientific_name LIKE ? OR
          description LIKE ? OR
          uses LIKE ? OR
          active_compounds LIKE ? OR
          precautions LIKE ? OR
          cure LIKE ? OR
          season LIKE ?
  `;

  // Prepare the search string for SQL LIKE operation
  const searchValue = `%${searchString}%`;

  db.query(query, [searchValue, searchValue, searchValue, searchValue, searchValue, searchValue, searchValue, searchValue], (err, results) => {
    if (err) {
      console.error('Error searching herbs:', err);
      return res.status(500).send('Internal Server Error');
    }

    // Render the home page with the search results
    res.render('home', { herbs: results, searchString });
  });
});
// Delete a bookmark
app.post('/delete-bookmark', (req, res) => {
  const { herb_id } = req.body;
  const user_id = req.session.user ? req.session.user.id : null; // Ensure the user is logged in

  if (!user_id) {
      return res.status(401).send('You must be logged in to delete bookmarks.');
  }

  // Delete the bookmark from the database
  const deleteQuery = 'DELETE FROM bookmark WHERE id = ? AND herb_id = ?';
  db.query(deleteQuery, [user_id, herb_id], (err, results) => {
      if (err) {
          console.error('Error deleting bookmark:', err);
          return res.status(500).send('Internal Server Error');
      }

      // Redirect back to the garden page after deletion
      res.redirect('/garden');
  });
});
app.get('/logout', (req, res) => {
  // Destroy the session
  req.session.destroy(err => {
    if (err) {
      console.log(err);
      return res.redirect('/home');
    }
    // Clear cookie and redirect to login page or home
    res.clearCookie('connect.sid'); // 'connect.sid' is the default cookie name for express-session
    res.redirect('/login'); // Redirect to home or login page after logout
  });
});
// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
