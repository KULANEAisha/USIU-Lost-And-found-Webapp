const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");
const path = require("path");
const db = require("./db");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// Configure storage for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "public/uploads/"); // Save images in 'public/uploads/'
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
    }
});

const upload = multer({ storage });

// Get all lost & found items
app.get("/items", (req, res) => {
    db.query(
        `SELECT 'Lost' AS type, id, item_name, description, location, date_lost AS date, image_path AS image 
         FROM lost_items 
         UNION ALL 
         SELECT 'Found' AS type, id, item_name, description, location, date_found AS date, image_path AS image 
         FROM found_items`,
        (err, results) => {
            if (err) {
                console.error("Error fetching items:", err);
                return res.status(500).json({ error: "Database error" });
            }
            res.json(results);
        }
    );
});

// Report a lost item
app.post("/report/lost", upload.single("item_image"), (req, res) => {
    const { item_name, description, location, date_lost } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    if (!item_name || !description || !location || !date_lost) {
        return res.status(400).json({ error: "All fields are required" });
    }

    db.query(
        "INSERT INTO lost_items (item_name, description, location, date_lost, image_path) VALUES (?, ?, ?, ?, ?)",
        [item_name, description, location, date_lost, imagePath],
        (err) => {
            if (err) {
                console.error("Error reporting lost item:", err);
                return res.status(500).json({ error: "Database error" });
            }
            res.json({ message: "Lost item reported successfully!" });
        }
    );
});

// Report a found item
app.post("/report/found", upload.single("item_image"), (req, res) => {
    const { item_name, description, location, date_found } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    if (!item_name || !description || !location || !date_found) {
        return res.status(400).json({ error: "All fields are required" });
    }

    db.query(
        "INSERT INTO found_items (item_name, description, location, date_found, image_path) VALUES (?, ?, ?, ?, ?)",
        [item_name, description, location, date_found, imagePath],
        (err) => {
            if (err) {
                console.error("Error reporting found item:", err);
                return res.status(500).json({ error: "Database error" });
            }
            res.json({ message: "Found item reported successfully!" });
        }
    );
});

// Claim item route
app.post("/claim-item", (req, res) => {
    const { item_id, full_name, contact, reason } = req.body;
    console.log("Received claim data:", { item_id, full_name, contact, reason });

    if (!item_id || !full_name || !contact || !reason) {
        console.error("Validation failed: Missing fields");
        return res.status(400).json({ error: "All fields are required" });
    }

    const query = "INSERT INTO claims (item_id, full_name, contact, reason) VALUES (?, ?, ?, ?)";
    
    db.query(query, [item_id, full_name, contact, reason], (err, results) => {
        if (err) {
            console.error("Error submitting claim:", err);
            return res.status(500).json({ error: "Database error" });
        }
        console.log("Claim inserted successfully:", results);
        res.json({ message: "Claim submitted successfully!" });
    });
});


// Handle contact form submission
app.post("/submit-contact", (req, res) => {
    const { name, email, message } = req.body;
  
    if (!name || !email || !message) {
      return res.status(400).json({ error: "All fields are required!" });
    }
  
    const sql = "INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)";
    db.query(sql, [name, email, message], (err, result) => {
      if (err) {
        console.error("Error inserting data:", err);
        return res.status(500).json({ error: "Database error" });
      }
      res.json({ success: true, message: "Message submitted successfully!" });
    });
  });

// Start the server
app.listen(3000, () => console.log("Server running on http://localhost:3000"));
