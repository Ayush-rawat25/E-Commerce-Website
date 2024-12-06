const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "ayush2004",
  database: "ecommerce_db",
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to database:", err);
    process.exit(1);
  }
  console.log("Connected to MySQL database");
});

app.post("/register", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (results.length > 0) {
      return res.json({ success: false, message: "Email already in use" });
    }

    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err)
        return res
          .status(500)
          .json({ success: false, message: "Error hashing password" });

      const query = "INSERT INTO users (email, password) VALUES (?, ?)";
      db.query(query, [email, hashedPassword], (err, results) => {
        if (err) {
          return res
            .status(500)
            .json({ success: false, message: "Error registering user" });
        }
        res.json({ success: true, message: "User registered successfully" });
      });
    });
  });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err)
      return res
        .status(500)
        .json({ success: false, message: "Database error" });
    if (results.length === 0)
      return res
        .status(400)
        .json({ success: false, message: "User not found" });

    const user = results[0];

    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (isMatch) {
        res.json({
          success: true,
          user: {
            email: user.email,
            profilePicture: "/images/person.png",
          },
        });
      } else {
        res.json({ success: false, message: "Invalid email or password" });
      }
    });
  });
});

app.get("/cart/:userEmail", (req, res) => {
    const userEmail = req.params.userEmail;
  
    // Fetch cart items with product details (price, image_url) using a JOIN query
    const query = `
      SELECT c.quantity, p.name, p.price, p.image_url
      FROM cart c
      JOIN product p ON c.product_name = p.name
      WHERE c.user_email = ?;
    `;
  
    db.query(query, [userEmail], (err, result) => {
      if (err) {
        console.error("Error fetching cart items:", err);
        return res.status(500).json({ error: "Failed to fetch cart items" });
      }
  
      res.json(result); // Return cart items with product details
    });
  });
  

app.post("/cart", (req, res) => {
  const { userEmail, productName } = req.body;

  const checkSql =
    "SELECT quantity FROM cart WHERE user_email = ? AND product_name = ?";
  const insertSql =
    "INSERT INTO cart (user_email, product_name, quantity) VALUES (?, ?, 1)";
  const updateSql =
    "UPDATE cart SET quantity = quantity + 1 WHERE user_email = ? AND product_name = ?";

  db.query(checkSql, [userEmail, productName], (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).send("Error checking cart");
    } else if (results.length > 0) {
      // Product exists, update quantity
      db.query(updateSql, [userEmail, productName], (err, result) => {
        if (err) {
          console.error(err);
          res.status(500).send("Error updating cart");
        } else {
          res.json({
            success: true,
            message: "Product quantity updated in cart",
          });
        }
      });
    } else {
      // Product doesn't exist, insert new entry
      db.query(insertSql, [userEmail, productName], (err, result) => {
        if (err) {
          console.error(err);
          res.status(500).send("Error adding product to cart");
        } else {
          res.json({ success: true, message: "Product added to cart" });
        }
      });
    }
  });
});

app.delete("/cart", (req, res) => {
  const { userEmail, productName } = req.body;

  // Query to check if the product exists in the cart
  const sql = "SELECT * FROM cart WHERE user_email = ? AND product_name = ?";
  db.query(sql, [userEmail, productName], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Error removing item from cart" });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Item not found in the cart" });
    }

    // Query to delete the product from the cart
    const deleteQuery =
      "DELETE FROM cart WHERE user_email = ? AND product_name = ?";
    db.query(deleteQuery, [userEmail, productName], (err, result) => {
      if (err) {
        console.error(err);
        return res
          .status(500)
          .json({ message: "Error removing product from cart" });
      }

      res.json({ success: true, message: "Product removed from cart" });
    });
  });
});

app.post("/address", (req, res) => {
  const { email, address, city, zipcode } = req.body;

  // Update address fields in the users table
  db.query(
    "UPDATE users SET address = ?, city = ?, zipcode = ? WHERE email = ?",
    [address, city, zipcode, email],
    (err) => {
      if (err) {
        res.status(500).json({ error: "Database error" });
      } else {
        res.json({ message: "Address updated successfully!" });
      }
    }
  );
});

app.post("/order", (req, res) => {
  const { userEmail, cartItems } = req.body;

  if (
    !userEmail ||
    !Array.isArray(cartItems) ||
    cartItems.length === 0 ||
    cartItems.some((item) => !item.productName)
  ) {
    return res
      .status(400)
      .json({ error: "Invalid request data: Missing product name" });
  }

  const insertOrderQuery = `INSERT INTO orders (user_email, product_name, quantity, price, date) VALUES ?`;
  const orderData = cartItems.map((item) => [
    userEmail,
    item.productName,
    item.quantity,
    item.price,
    item.date || new Date().toISOString().split("T")[0],
  ]);

  db.beginTransaction((transactionErr) => {
    if (transactionErr) {
      console.error("Transaction start error:", transactionErr);
      return res.status(500).json({ error: "Failed to start transaction" });
    }

    db.query(insertOrderQuery, [orderData], (err, result) => {
      if (err) {
        console.error("Error inserting order:", err);
        return db.rollback(() => {
          res.status(500).json({ error: "Error placing the order" });
        });
      }

      const clearCartQuery = `DELETE FROM cart WHERE user_email = ?`;
      db.query(clearCartQuery, [userEmail], (err) => {
        if (err) {
          console.error("Error clearing cart:", err);
          return db.rollback(() => {
            res
              .status(500)
              .json({ error: "Order placed but error clearing the cart" });
          });
        }

        db.commit((commitErr) => {
          if (commitErr) {
            console.error("Transaction commit error:", commitErr);
            return db.rollback(() => {
              res.status(500).json({ error: "Failed to complete transaction" });
            });
          }

          res.json({
            success: true,
            message: "Payment Successful: Order placed successfully",
          });
        });
      });
    });
  });
});

app.get('/orders/:userEmail', (req, res) => {
    const userEmail = req.params.userEmail;
    const query = 'SELECT * FROM orders WHERE user_email = ?';
    
    db.query(query, [userEmail], (err, results) => {
        if (err) {
            console.error('Error fetching orders:', err);
            return res.status(500).json({ error: 'Failed to fetch orders' });
        }
        res.json(results);
    });
});


app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
