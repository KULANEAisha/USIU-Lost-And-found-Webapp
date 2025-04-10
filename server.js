const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const db = require("./db");
const { query } = require('express-validator');

const app = express();

// ========================
// MIDDLEWARE CONFIGURATION
// ========================

// Security Middleware
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// Security Middleware with development-friendly CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:"]
    }
  }
}));

// CORS configuration
app.use(cors({
  origin: ['http://localhost:5500', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  exposedHeaders: ['Content-Length', 'Authorization'] // Add this line
}));

app.use(bodyParser.json());

// Static file serving with proper MIME types
app.use(express.static(path.join(__dirname, "public"), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

// Rate limiting (100 requests per 15 minutes)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 60, // Max 60 requests per minute
  message: {
    error: "Too many requests",
    retryAfter: 60 // Seconds
  },
  skip: (req) => {
    // Don't limit static files or preflight requests
    return req.path.includes('.') || req.method === 'OPTIONS';
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false // Disable deprecated headers
});

// Apply only to API routes, not static files
app.use('/api', limiter);
app.use('/admin', limiter);

// Image upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "public", "uploads"));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// ========================
// AUTHENTICATION MIDDLEWARE
// ========================

// JWT Authentication Middleware
function authenticateToken(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = { id: decoded.id, is_admin: decoded.is_admin };  // Ensure 'id' is included
    next();
});
}

// Admin Check Middleware
function isAdmin(req, res, next) {
  db.query("SELECT is_admin FROM users WHERE id = ?", [req.user.id], (err, results) => {
    if (err || !results[0]?.is_admin) {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  });
}

// ========================
// PAGE ROUTES (SERVE HTML)
// ========================

// Root path serves login page (public)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Authentication Pages (public)
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "signup.html"));
});

// Report Item Page (authenticated)
app.get("/report", authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "report.html"));
});

// Claim Form Page (authenticated)
app.get("/claim", authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "claim-form.html"));
});

// Dashboard (authenticated)
app.get("/dashboard", authenticateToken, (req, res) => {
  if (req.user.is_admin) {
    return res.redirect('/admin');
  }
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// Admin Panel (authenticated + admin-only)
app.get("/admin", authenticateToken, isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Static Pages (public)
app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "about.html"));
});

app.get("/contact", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "contact.html"));
});

// Favicon handler
app.get('/favicon.ico', (req, res) => res.status(204).end());
// ========================
// API ROUTES
// ========================

// User Signup
app.post("/signup", 
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
    body("username").trim().notEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { username, email, password } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);

      // Updated with better error handling
      const [result] = await db.query(
        "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
        [username, email, hashedPassword]
      );

      res.status(201).json({ message: "User created!" });
    } catch (err) {
      // Handle duplicate email gracefully
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: "Email already exists" });
      }
      
      console.error("Signup error:", err);
      res.status(500).json({ error: "Server error during signup" });
    }
  }
);
// User Login
app.post("/login", 
  [
    body("email").isEmail().normalizeEmail(),
    body("password").notEmpty()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;
      console.log(`Login attempt for: ${email}`);

      // Using promise-based query
      const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
      
      if (rows.length === 0) {
        console.log('No user found with email:', email);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const user = rows[0];
      console.log('Found user:', user.id);

      const passwordMatch = await bcrypt.compare(password, user.password);
      console.log('Password match result:', passwordMatch);

      if (!passwordMatch) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign(
        { 
            id: user.id, 
            is_admin: user.is_admin || user.email === 'admin@usiu.ac.ke' 
        },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
    );

      console.log('Successful login for user:', user.id);
      res.json({ 
        success: true,
        token,
        user: {
            id: user.id,
            email: user.email,
            is_admin: user.is_admin
        }
      });

    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);
// Report lost item (authenticated users)
app.post("/report/lost", authenticateToken, upload.single("item_image"), 
  [
    body("item_name").trim().notEmpty(),
    body("description").trim().notEmpty(),
    body("location").trim().notEmpty(),
    body("date_lost").isISO8601()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    console.log("Received data:", {
      body: req.body,
      file: req.file ? req.file.filename : null,
      user: req.user.id
  });
  
  if (!req.body.item_name || !req.body.description) {
      return res.status(400).json({ error: "Missing required fields" });
  }

    const { item_name, description, location } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
    const date_lost = req.body.date_lost || req.body.date_reported;

    db.query(
      "INSERT INTO lost_items (user_id, item_name, description, location, date_lost, image_path) VALUES (?, ?, ?, ?, ?, ?)",
      [req.user.id, item_name, description, location, date_lost, imagePath],
      (err) => {
        if (err) {
          console.error("Error reporting lost item:", err);
          return res.status(500).json({ error: "Database error" });
        }
        res.json({ message: "Lost item reported successfully!" });
      }
    );
  }
);

// Report found item (authenticated users)
app.post("/report/found", authenticateToken, upload.single("item_image"), 
  // ... validation rules ...
  async (req, res) => {
    console.log("🔥 1. Request received");
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    let connection;
    try {
      // 1. Acquire database connection
      connection = await db.getConnection();
      console.log("🔥 2. Connection acquired");

      // 2. Set MySQL-level timeout
      await connection.query('SET SESSION max_execution_time=10000');

      // 3. Prepare data
      const { item_name, description, location, date_found } = req.body;
      const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

      // 4. Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Database timeout'));
        }, 10000); // 10 seconds
      });

      // 5. Execute query with race condition
      const [result] = await Promise.race([
        connection.query(
          "INSERT INTO found_items (user_id, item_name, description, location, date_found, image_path, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [req.user.id, item_name, description, location, date_found, imagePath, 'Pending']
        ),
        timeoutPromise
      ]);

      console.log("🔥 3. Query succeeded, ID:", result.insertId);
      return res.status(201).json({ 
        success: true,
        id: result.insertId
      });

    } catch (err) {
      console.error("🔥 4. Error:", {
        name: err.name,
        code: err.code,
        message: err.message
      });

      // Handle specific timeout case
      if (err.message === 'Database timeout') {
        try {
          // Try to kill any hanging queries
          const [processes] = await connection.query('SHOW PROCESSLIST');
          const myProcess = processes.find(p => p.Info && p.Info.includes('found_items'));
          if (myProcess) {
            await connection.query(`KILL ${myProcess.Id}`);
          }
        } catch (killErr) {
          console.error("Failed to kill process:", killErr);
        }
        return res.status(504).json({ error: "Request timed out" });
      }

      return res.status(500).json({ 
        error: "Database operation failed",
        details: err.sqlMessage || err.message
      });

    } finally {
      // 6. Always release connection
      if (connection) {
        console.log("🔥 5. Releasing connection");
        await connection.release();
      }
    }
  }
);

// Claim an item (authenticated users)
app.post("/claim-item", authenticateToken,
  [
    body("item_id").isInt(),
    body("reason").trim().notEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { item_id, reason } = req.body;

    db.query(
      "INSERT INTO claims (user_id, item_id, reason) VALUES (?, ?, ?)",
      [req.user.id, item_id, reason],
      (err) => {
        if (err) {
          console.error("Error submitting claim:", err);
          return res.status(500).json({ error: "Database error" });
        }
        res.json({ message: "Claim submitted successfully!" });
      }
    );
  }
);

// ========================
// ADMIN ROUTES (PROTECTED)
// ========================

// Verify admin status
app.get('/api/user/verify-admin', authenticateToken, isAdmin, (req, res) => {
  res.json({ isAdmin: true });
});

// Admin stats
// Option A: Remove the active users count
app.get("/api/admin/stats", async (req, res) => {
  try {
    const [counts] = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM lost_items WHERE status='Pending') AS lost_pending,
        (SELECT COUNT(*) FROM found_items WHERE status='Pending') AS found_pending,
        (SELECT COUNT(*) FROM claims WHERE status='Verified') AS verified_claims,
        (SELECT COUNT(*) FROM lost_items WHERE status='Flagged') AS lost_flagged,
        (SELECT COUNT(*) FROM found_items WHERE status='Flagged') AS found_flagged
    `);

    res.json({
      pendingItems: counts[0].lost_pending + counts[0].found_pending,
      verifiedClaims: counts[0].verified_claims,
      flaggedItems: counts[0].lost_flagged + counts[0].found_flagged,
      activeUsers: 0 // Default value
    });
  } catch (err) {
    console.error("Error fetching admin stats:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// Get all lost items
app.get("/api/admin/items/lost", async (req, res) => {
  try {
    const [items] = await db.query(`
      SELECT 
        li.id,
        li.item_name AS name,
        li.description,
        li.location,
        li.date_lost AS date,
        li.image_path AS image,
        li.status,
        u.username AS reportedBy
      FROM lost_items li
      JOIN users u ON li.user_id = u.id
      ORDER BY li.date_lost DESC
    `);
    res.json(items);
  } catch (err) {
    console.error("Error fetching lost items:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// Get all found items
app.get("/api/admin/items/found", async (req, res) => {
  try {
    const [items] = await db.query(`
      SELECT 
        fi.id,
        fi.item_name AS name,
        fi.description,
        fi.location,
        fi.date_found AS date,
        fi.image_path AS image,
        fi.status,
        u.username AS reportedBy
      FROM found_items fi
      JOIN users u ON fi.user_id = u.id
      ORDER BY fi.date_found DESC
    `);
    res.json(items);
  } catch (err) {
    console.error("Error fetching found items:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// Get all claims
app.get("/api/admin/claims", async (req, res) => {
  try {
    const [claims] = await db.query(`
      SELECT 
        c.id,
        f.item_name AS name,
        f.description,
        f.location,
        f.date_found AS date,
        f.image_path AS image,
        c.status,
        c.reason,
        c.created_at AS claim_date,
        u.username AS reportedBy,
        u.email AS reporterEmail
      FROM claims c
      JOIN found_items f ON c.item_id = f.id
      JOIN users u ON c.user_id = u.id
      ORDER BY c.created_at DESC
    `);
    res.json(claims);
  } catch (err) {
    console.error("Error fetching claims:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// Get single item details
app.get("/admin/items/:type/:id", async (req, res) => {
  try {
    const { type, id } = req.params;
    const table = type === 'lost' ? 'lost_items' : 'found_items';
    
    const [item] = await db.query(`
      SELECT 
        i.*, 
        u.username, 
        u.email,
        (SELECT COUNT(*) FROM claims WHERE item_id = i.id) AS claim_count
      FROM ${table} i
      JOIN users u ON i.user_id = u.id
      WHERE i.id = ?`, 
      [id]
    );
    
    if (item.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }
    
    res.json({
      ...item[0],
      reportedBy: {
        name: item[0].username,
        email: item[0].email
      }
    });
  } catch (err) {
    console.error("Error fetching item:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// Get approved items for public viewing
// ========================
// PUBLIC ITEMS ENDPOINT
// ========================
app.get('/api/items', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;

    const [lostItems] = await db.query(
      `SELECT 'Lost' AS type, id, item_name AS name, description, location, 
              date_lost AS date, image_path AS image, status
       FROM lost_items 
       ORDER BY date DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [foundItems] = await db.query(
      `SELECT 'Found' AS type, id, item_name AS name, description, location, 
              date_found AS date, image_path AS image, status
       FROM found_items 
       ORDER BY date DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const items = [...lostItems, ...foundItems].sort((a, b) => new Date(b.date) - new Date(a.date));

    const [lostCount] = await db.query(`SELECT COUNT(*) as count FROM lost_items WHERE status='Approved'`);
    const [foundCount] = await db.query(`SELECT COUNT(*) as count FROM found_items WHERE status='Approved'`);
    const total = lostCount[0].count + foundCount[0].count;

    res.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// ========================
// AUTHENTICATED USER ENDPOINTS
// ========================
app.get("/api/user", authenticateToken, async (req, res) => {
  try {
    const [user] = await db.safeQuery(
      `SELECT 
        u.username AS fullName, 
        u.email,
        (SELECT COUNT(*) FROM lost_items WHERE user_id = ?) AS lostItems,
        (SELECT COUNT(*) FROM found_items WHERE user_id = ?) AS foundItems,
        (SELECT COUNT(*) FROM claims WHERE user_id = ?) AS claimedItems
      FROM users u WHERE id = ?`, 
      [req.user.id, req.user.id, req.user.id, req.user.id]
    );
    
    res.json(user);
  } catch (err) {
    console.error("User endpoint failed:", err);
    res.status(500).json({ error: "Failed to load user data" });
  }
});

app.get("/api/user/items", 
  authenticateToken,
  [
    query('type').optional().isIn(['Lost', 'Found']),
    query('status').optional().isIn(['Pending', 'Approved', 'Rejected', 'Flagged']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  async (req, res) => {
    try {
      const { type, status, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;
      
      let whereClause = "WHERE user_id = ?";
      const params = [req.user.id];

      if (type) {
        whereClause += " AND type = ?";
        params.push(type);
      }
      if (status) {
        whereClause += " AND status = ?";
        params.push(status);
      }

      const [items, [count]] = await Promise.all([
        db.safeQuery(
          `WITH user_items AS (
            SELECT 'Lost' AS type, id, item_name AS name, description, location, 
                   date_lost AS date, image_path AS image, status, user_id
            FROM lost_items
            UNION ALL
            SELECT 'Found' AS type, id, item_name AS name, description, location, 
                   date_found AS date, image_path AS image, status, user_id
            FROM found_items
          )
          SELECT * FROM user_items ${whereClause}
          ORDER BY date DESC
          LIMIT ? OFFSET ?`,
          [...params, limit, offset]
        ),
        db.safeQuery(
          `SELECT COUNT(*) as total FROM (
            SELECT id FROM lost_items WHERE user_id = ?
            UNION ALL
            SELECT id FROM found_items WHERE user_id = ?
          ) AS combined`,
          [req.user.id, req.user.id]
        )
      ]);

      res.json({
        items,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count.total,
          totalPages: Math.ceil(count.total / limit)
        }
      });
    } catch (err) {
      console.error("Items endpoint failed:", err);
      res.status(500).json({ 
        error: "Failed to load items",
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
);

app.get("/api/user/claims", 
  authenticateToken,
  [
    query('status').optional().isIn(['Pending', 'Verified', 'Rejected'])
  ],
  async (req, res) => {
    try {
      const { status } = req.query;
      let whereClause = "WHERE c.user_id = ?";
      const params = [req.user.id];

      if (status) {
        whereClause += " AND c.status = ?";
        params.push(status);
      }

      const claims = await db.safeQuery(
        `SELECT 
          c.id AS claim_id,
          f.id AS item_id,
          f.item_name AS name, 
          f.description, 
          f.location, 
          f.date_found AS date, 
          f.image_path AS image, 
          f.status AS item_status,
          c.status AS claim_status,
          c.reason, 
          c.created_at AS claim_date
         FROM found_items f
         JOIN claims c ON f.id = c.item_id
         ${whereClause}
         ORDER BY c.created_at DESC`,
        params
      );

      res.json(claims);
    } catch (err) {
      console.error("Claims endpoint failed:", err);
      res.status(500).json({ 
        error: "Failed to load claims",
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
);

// ========================
// RATE LIMITING FOR AUTHENTICATED ENDPOINTS
// ========================
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later"
});

app.use("/api/user", authLimiter);
app.use("/api/user/items", authLimiter);
app.use("/api/user/claims", authLimiter);
// ========================
// ERROR HANDLING
// ========================

// Handle 404 for unmatched routes
//app.use((req, res) => {
 // res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
//});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'"]
    }
  }
}));
// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// ========================
// SERVER START
// ========================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));