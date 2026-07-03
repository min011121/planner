const path = require("path");
const express = require("express");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();
const port = Number(process.env.PORT || 3000);

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "couple_planner",
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
});

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.get("/api/planners/:id", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT data FROM planners WHERE id = ?", [req.params.id]);

    if (!rows.length) {
      return res.json({});
    }

    const data = typeof rows[0].data === "string" ? JSON.parse(rows[0].data) : rows[0].data;
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "플래너를 불러오지 못했습니다.", detail: error.message });
  }
});

app.put("/api/planners/:id", async (req, res) => {
  try {
    await pool.execute(
      `
        INSERT INTO planners (id, data)
        VALUES (?, CAST(? AS JSON))
        ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = CURRENT_TIMESTAMP
      `,
      [req.params.id, JSON.stringify(req.body)],
    );

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: "플래너를 저장하지 못했습니다.", detail: error.message });
  }
});

app.use(express.static(__dirname));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, () => {
  console.log(`Planner server: http://localhost:${port}`);
});
