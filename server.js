//import models
const { createUserTable, createExpensesTable } = require("./modules/models");

const path = require("path");
require("dotenv").config();

// Path: server.js
const express = require("express");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const fs = require("fs");
const app = express();
//const PORT = process.env.PORT || 8000;
//const HOST = process.env.HOST || "localhost";
const cors = require("cors");
const jwt = require("jsonwebtoken");
// Secret key used to sign the JWT token (keep it secret and don't hardcode it)
const SECRET_KEY = process.env.SECRET_KEY;

const authenticateToken = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token)
    return res.status(401).json({ message: "Authentication token required" });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
};

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests from localhost and the online frontend
    const allowedOrigins = [
      "http://localhost:3000",
      "https://lastcall-reactfrontend.fly.dev/",
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204,
};

const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  //Comment for local development
  // ssl: {
  //   require: false,
  //   rejectUnauthorized: false,
  // },
});

app.use(express.static(path.join(__dirname, "public")));
app.use(helmet());
app.use(bodyParser.json());
app.use(cors(corsOptions));

app.get("/", (req, res) => {
  // Read the content of index.html
  fs.readFile("index.html", "utf8", (err, data) => {
    if (err) {
      console.error("Error reading index.html:", err);
      res.status(500).send("Internal Server Error");
      return;
    }

    // Send the HTML content as the response
    res.send(data);
  });
});

app.post("/signup", async (req, res) => {
  try {
    console.log("req.body:", req.body);
    const { fullname, email, password } = req.body;

    // Add any validation checks for the data here if needed

    const createUserQuery = `
      INSERT INTO users (fullname, email, password)
      VALUES ($1, $2, $3)
      RETURNING *;`;

    const result = await pool.query(createUserQuery, [
      fullname,
      email,
      password,
    ]);

    const token = jwt.sign({ id: result.rows[0].id }, SECRET_KEY, {
      expiresIn: "1h",
    });
    res.json({ token, Id: result.rows[0].id });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check credentials against the database
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1 AND password = $2",
      [email, password]
    );
    const user = result.rows[0];

    if (result.rows.length > 0) {
      //const token = generateToken(user);
      const token = jwt.sign({ user_id: user.id }, SECRET_KEY, {
        expiresIn: "1h",
      });
      res.json({ token, user_id: user.id, fullname: user.fullname });
    } else {
      res.status(401).json({ message: "Invalid credentials" });
    }
  } catch (error) {
    console.error("Login failed:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/expenses", authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.query; // Extract user_id from the query parameters
    const result = await pool.query(
      "SELECT * FROM expenses WHERE user_id = $1",
      [user_id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching expenses:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/expenses", authenticateToken, async (req, res) => {
  try {
    const { amount, description, date } = req.body;
    const result = await pool.query(
      "INSERT INTO expenses (amount, description, date, user_id) VALUES ($1, $2, $3, $4) RETURNING *",
      [amount, description, date, req.user.user_id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error adding expense:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/expenses/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "DELETE FROM expenses WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Expense not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error deleting expense:", error);
    res.status(500).json({ error: error.message });
  }
});

const startServer = async () => {
  try {
    await pool.connect();
    console.log("Connected to PostgreSQL database");
    app.listen(PORT, function () {
      console.log(`Server is running...`);
    });
  } catch (err) {
    console.error("Error connecting to PostgreSQL database", err);
  }
};

async function createTables() {
  try {
    await pool.query(createUserTable);
    await pool.query(createExpensesTable);
    console.log("Tables created successfully");
  } catch (err) {
    console.error("Error creating tables:", err);
  }
}

createTables();

//.finally(() => pool.end());

startServer();
