const path = require("path");
const crypto = require("crypto");
const express = require("express");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();
const port = Number(process.env.PORT || 3000);
const appPassword = process.env.APP_PASSWORD || "";
const sessionSecret = process.env.SESSION_SECRET || appPassword || "local-dev-secret";
const sessionCookieName = "planner_session";

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

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const index = cookie.indexOf("=");
        return [decodeURIComponent(cookie.slice(0, index)), decodeURIComponent(cookie.slice(index + 1))];
      }),
  );
}

function signSession(value) {
  return crypto.createHmac("sha256", sessionSecret).update(value).digest("hex");
}

function isAuthenticated(req) {
  if (!appPassword) {
    return true;
  }

  const cookies = parseCookies(req);
  const token = cookies[sessionCookieName];
  return token === signSession("authenticated");
}

function requireAuth(req, res, next) {
  if (isAuthenticated(req)) {
    return next();
  }

  return res.status(401).json({ message: "비밀번호가 필요합니다." });
}

app.get("/api/session", (req, res) => {
  res.json({ authenticated: isAuthenticated(req), passwordRequired: Boolean(appPassword) });
});

app.post("/api/login", (req, res) => {
  if (!appPassword) {
    return res.json({ ok: true });
  }

  if (req.body.password !== appPassword) {
    return res.status(401).json({ message: "비밀번호가 맞지 않습니다." });
  }

  res.cookie(sessionCookieName, signSession("authenticated"), {
    httpOnly: true,
    sameSite: "lax",
    secure: req.secure || req.headers["x-forwarded-proto"] === "https",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
  res.json({ ok: true });
});

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.get("/api/planners/:id", requireAuth, async (req, res) => {
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

app.put("/api/planners/:id", requireAuth, async (req, res) => {
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
