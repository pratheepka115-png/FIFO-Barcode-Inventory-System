
const express = require("express");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");

dotenv.config({
  path: path.join(__dirname, ".env")
});

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "fifo_inventory",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Health check: confirms that the API and MySQL are working.
app.get("/api/test", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT DATABASE() AS database_name, 1 AS connected"
    );

    res.json({
      success: true,
      message: "Backend and MySQL connected successfully",
      database: rows[0].database_name,
      connected: rows[0].connected === 1
    });
  } catch (error) {
    console.error("Database test failed:", error.message);
    res.status(500).json({
      success: false,
      message: "MySQL connection failed"
    });
  }
});

// Get all products.
app.get("/api/products", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM products ORDER BY product_id DESC"
    );

    res.json(rows);
  } catch (error) {
    console.error("Get products failed:", error.message);
    res.status(500).json({
      error: "Unable to retrieve products"
    });
  }
});

// Add a product.
app.post("/api/products", async (req, res) => {
  try {
    const { product_code, product_name } = req.body;

    if (
      typeof product_name !== "string" ||
      !product_name.trim()
    ) {
      return res.status(400).json({
        error: "Product name is required"
      });
    }

    const code =
      typeof product_code === "string" &&
      product_code.trim()
        ? product_code.trim()
        : null;

    const [result] = await pool.execute(
      `INSERT INTO products (product_code, product_name)
       VALUES (?, ?)`,
      [code, product_name.trim()]
    );

    res.status(201).json({
      success: true,
      message: "Product saved successfully",
      product_id: result.insertId
    });
  } catch (error) {
    console.error("Add product failed:", error.message);

    res.status(
      error.code === "ER_DUP_ENTRY" ? 409 : 500
    ).json({
      error:
        error.code === "ER_DUP_ENTRY"
          ? "This product code already exists"
          : "Unable to save product"
    });
  }
});

// Get inventory batches, ordered using FIFO/earliest expiry.
app.get("/api/batches", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        b.batch_id,
        b.product_id,
        p.product_name,
        p.product_code,
        b.batch_number,
        b.quantity,
        b.manufacturing_date,
        b.expiry_date,
        b.barcode,
        b.created_at
      FROM inventory_batches AS b
      INNER JOIN products AS p
        ON p.product_id = b.product_id
      ORDER BY
        b.expiry_date IS NULL,
        b.expiry_date ASC,
        b.created_at ASC,
        b.batch_id ASC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Get batches failed:", error.message);
    res.status(500).json({
      error: "Unable to retrieve inventory batches"
    });
  }
});

// Receive stock into an existing product's batch.
app.post("/api/batches", async (req, res) => {
  const {
    product_id,
    batch_number,
    quantity,
    manufacturing_date,
    expiry_date,
    barcode
  } = req.body;

  const productId = Number(product_id);
  const qty = Number(quantity);

  if (
    !Number.isInteger(productId) ||
    productId <= 0 ||
    !Number.isInteger(qty) ||
    qty <= 0
  ) {
    return res.status(400).json({
      error: "Valid product_id and positive integer quantity are required"
    });
  }

  const validDate = (value) =>
    value == null ||
    value === "" ||
    (typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value));

  if (
    !validDate(manufacturing_date) ||
    !validDate(expiry_date)
  ) {
    return res.status(400).json({
      error: "Dates must use YYYY-MM-DD format"
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [products] = await connection.execute(
      "SELECT product_id FROM products WHERE product_id = ?",
      [productId]
    );

    if (products.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        error: "Product not found"
      });
    }

    const [result] = await connection.execute(
      `INSERT INTO inventory_batches
       (product_id, batch_number, quantity,
        manufacturing_date, expiry_date, barcode)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        productId,
        batch_number || null,
        qty,
        manufacturing_date || null,
        expiry_date || null,
        barcode || null
      ]
    );

    await connection.execute(
      `INSERT INTO inventory_transactions
       (batch_id, transaction_type, quantity)
       VALUES (?, 'RECEIPT', ?)`,
      [result.insertId, qty]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: "Stock received successfully",
      batch_id: result.insertId
    });
  } catch (error) {
    if (connection) await connection.rollback();

    console.error("Receive stock failed:", error.message);
    res.status(500).json({
      error: "Unable to receive stock"
    });
  } finally {
    if (connection) connection.release();
  }
});

// Record a stock issue using earliest-expiry-first ordering.
// The transaction locks batches to prevent concurrent over-picking.
app.post("/api/pick", async (req, res) => {
  const productId = Number(req.body.product_id);
  const requestedQty = Number(req.body.quantity);

  if (
    !Number.isInteger(productId) ||
    productId <= 0 ||
    !Number.isInteger(requestedQty) ||
    requestedQty <= 0
  ) {
    return res.status(400).json({
      error: "Valid product_id and positive integer quantity are required"
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [batches] = await connection.execute(
      `SELECT batch_id, quantity
       FROM inventory_batches
       WHERE product_id = ? AND quantity > 0
       ORDER BY
         expiry_date IS NULL,
         expiry_date ASC,
         created_at ASC,
         batch_id ASC
       FOR UPDATE`,
      [productId]
    );

    const available = batches.reduce(
      (sum, batch) => sum + Number(batch.quantity),
      0
    );

    if (available < requestedQty) {
      await connection.rollback();

      return res.status(409).json({
        error: "Insufficient stock",
        available,
        requested: requestedQty
      });
    }

    let remaining = requestedQty;
    const picked = [];

    for (const batch of batches) {
      if (remaining === 0) break;

      const take = Math.min(
        Number(batch.quantity),
        remaining
      );

      await connection.execute(
        `UPDATE inventory_batches
         SET quantity = quantity - ?
         WHERE batch_id = ?`,
        [take, batch.batch_id]
      );

      await connection.execute(
        `INSERT INTO inventory_transactions
         (batch_id, transaction_type, quantity)
         VALUES (?, 'ISSUE', ?)`,
        [batch.batch_id, take]
      );

      picked.push({
        batch_id: batch.batch_id,
        quantity: take
      });

      remaining -= take;
    }

    await connection.commit();

    res.json({
      success: true,
      message: "Stock picked successfully",
      picked
    });
  } catch (error) {
    if (connection) await connection.rollback();

    console.error("Stock pick failed:", error.message);
    res.status(500).json({
      error: "Unable to pick stock"
    });
  } finally {
    if (connection) connection.release();
  }
});

// Inventory transaction ledger.
app.get("/api/transactions", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        t.transaction_id,
        t.batch_id,
        p.product_name,
        b.batch_number,
        t.transaction_type,
        t.quantity,
        t.reference_document,
        t.created_at
      FROM inventory_transactions AS t
      INNER JOIN inventory_batches AS b
        ON b.batch_id = t.batch_id
      INNER JOIN products AS p
        ON p.product_id = b.product_id
      ORDER BY t.transaction_id DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Transaction history failed:", error.message);
    res.status(500).json({
      error: "Unable to retrieve transaction history"
    });
  }
});

// Do not expose database errors or credentials to the browser.
app.use((error, req, res, next) => {
  console.error("Unexpected API error:", error.message);
  res.status(500).json({
    error: "Internal server error"
  });
});

const PORT = Number(process.env.API_PORT || 5000);
let httpServer;

async function startServer() {
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    connection = null;

    httpServer = app.listen(PORT, "127.0.0.1", () => {
      console.log(`Backend: http://127.0.0.1:${PORT}`);
      console.log("MySQL connected successfully");
    });

    httpServer.on("error", (error) => {
      console.error("HTTP server error:", error.message);
      process.exitCode = 1;
    });
  } catch (error) {
    if (connection) connection.release();

    console.error("Cannot start backend:", error.message);
    process.exitCode = 1;
  }
}

async function shutdown() {
  if (httpServer) {
    httpServer.close();
  }

  await pool.end();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startServer();
