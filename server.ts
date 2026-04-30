import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Database Connection Pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("supabase") ? { rejectUnauthorized: false } : false
  });

  app.use(express.json());

  // --- API Routes ---

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Proxy to GeoServer to avoid CORS and hide credentials
  app.get("/api/geoserver/*", async (req, res) => {
    try {
      const geoServerUrl = process.env.GEOSERVER_URL || "http://localhost:8080/geoserver";
      const pathPart = req.params[0];
      const targetUrl = `${geoServerUrl}/${pathPart}`;

      const response = await axios({
        method: "get",
        url: targetUrl,
        params: req.query,
        auth: {
          username: process.env.GEOSERVER_USER || "admin",
          password: process.env.GEOSERVER_PASS || "geoserver",
        },
        responseType: "stream",
      });

      res.set(response.headers);
      response.data.pipe(res);
    } catch (error: any) {
      console.error("GeoServer Proxy Error:", error.message);
      res.status(error.response?.status || 500).json({ error: error.message });
    }
  });

  // Basic SQL Query Endpoint (Cautious! In production use proper validation)
  app.post("/api/query", async (req, res) => {
    const { sql, params } = req.body;
    try {
      const result = await pool.query(sql, params);
      res.json(result.rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get Table Metadata from PostGIS
  app.get("/api/tables", async (req, res) => {
    try {
      const query = `
        SELECT table_name, table_schema 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE';
      `;
      const result = await pool.query(query);
      res.json(result.rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Vite / Static Handling ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

startServer();
