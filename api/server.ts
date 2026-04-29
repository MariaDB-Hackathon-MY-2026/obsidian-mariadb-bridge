import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import * as mariadb from "mariadb";
import fs from "fs";
import { pipeline, env } from "@xenova/transformers";

// Configure transformers environment
env.allowLocalModels = false; // Force remote download if not cached, avoids some filesystem overhead
env.useBrowserCache = false;

const EMISSION_MODEL = "Xenova/all-MiniLM-L6-v2";
let extractor: any = null;

async function getExtractor(retries = 3) {
  if (extractor) return extractor;

  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[AI] Loading embedding model: ${EMISSION_MODEL} (Attempt ${i + 1}/${retries})...`);
      extractor = await pipeline("feature-extraction", EMISSION_MODEL);
      console.log(`[AI] Model loaded successfully.`);
      return extractor;
    } catch (err: any) {
      console.error(`[AI] Failed to load model (Attempt ${i + 1}):`, err.message);
      if (i === retries - 1) {
        throw new Error(`Failed to load AI model after ${retries} attempts: ${err.message}`);
      }
      // Exponential backoff
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Helper to get DB config from config.json (created by engine/main.py)
  const getConfig = () => {
    try {
      const configPath = path.join(process.cwd(), "config.json");
      if (fs.existsSync(configPath)) {
        return JSON.parse(fs.readFileSync(configPath, "utf-8"));
      }
    } catch (e) {
      return null;
    }
    return null;
  };

  // API Route: Search
  app.get("/api/search", async (req, res) => {
    const { q, tag, mode = "semantic", limit } = req.query;
    const config = getConfig();
    const resultLimit = parseInt(limit as string) || 25;

    if (!config || !config.db_password) {
      return res.status(401).json({ 
        error: "Search Locked", 
        message: "Neural sync process is not active. Please start engine/main.py and provide the password." 
      });
    }

    let conn;
    try {
      conn = await mariadb.createConnection({
        host: config.db_host,
        user: config.db_user,
        password: config.db_password,
        database: config.db_name,
        connectTimeout: 5000
      });

      // Use precise tag matching: wrap tags column in commas to avoid partial matches
      const tagCondition = tag && tag !== "All Tags" ? "CONCAT(',', n.tags, ',') LIKE ?" : "1=1";
      const tagParam = tag && tag !== "All Tags" ? `%,${tag},%` : null;

      // If no query, return most recent notes (Browse Mode)
      if (!q) {
        const sql = `
          SELECT n.file_name, nc.content, 0 as distance
          FROM note_chunks nc
          JOIN notes n ON nc.note_id = n.id
          WHERE ${tagCondition}
          ORDER BY n.id DESC
          LIMIT ?
        `;
        const rows = await conn.query(sql, tagParam ? [tagParam, resultLimit] : [resultLimit]);
        return res.json(rows);
      }

      let sql = "";
      let params: any[] = [];

      if (mode === "semantic") {
        try {
          const getEmbed = await getExtractor();
          const info = await getEmbed(q as string, { pooling: 'mean', normalize: true });
          const queryVector = Array.from(info.data as any);
          const vectorString = `[${queryVector.join(',')}]`;

          sql = `
            SELECT n.file_name, nc.content, VEC_DISTANCE(nc.embedding, VEC_FromText(?)) as distance
            FROM note_chunks nc
            JOIN notes n ON nc.note_id = n.id
            WHERE ${tagCondition}
            ORDER BY distance ASC
            LIMIT ?
          `;
          params = tagParam ? [vectorString, tagParam, resultLimit] : [vectorString, resultLimit];
        } catch (aiErr: any) {
          console.error("AI Semantic Search Error:", aiErr);
          return res.status(500).json({ 
            error: "Neural Engine Error", 
            message: "The AI model encountered a problem. This is usually a temporary network issue. Please try your search again." 
          });
        }
      } else if (mode === "keyword") {
        sql = `
          SELECT n.file_name, nc.content, 0 as distance
          FROM note_chunks nc
          JOIN notes n ON nc.note_id = n.id
          WHERE ${tagCondition} AND (nc.content LIKE ? OR n.file_name LIKE ?)
          ORDER BY n.id DESC
          LIMIT ?
        `;
        params = tagParam ? [tagParam, `%${q}%`, `%${q}%`, resultLimit] : [`%${q}%`, `%${q}%`, resultLimit];
      } else if (mode === "note_name") {
        sql = `
          SELECT n.file_name, nc.content, 0 as distance
          FROM note_chunks nc
          JOIN notes n ON nc.note_id = n.id
          WHERE ${tagCondition} AND n.file_name LIKE ?
          ORDER BY n.id DESC
          LIMIT ?
        `;
        params = tagParam ? [tagParam, `%${q}%`, resultLimit] : [`%${q}%`, resultLimit];
      }
        
      const rows: any[] = await conn.query(sql, params);
      
      // Post-process to limit results per file to max 2
      const counts: Record<string, number> = {};
      const filteredResults = rows.filter((row: any) => {
        const fileName = row.file_name;
        counts[fileName] = (counts[fileName] || 0) + 1;
        return counts[fileName] <= 2;
      });

      res.json(filteredResults.slice(0, resultLimit)); // Return a clean set of top results
    } catch (err: any) {
      console.error("Search Error:", err);
      res.status(500).json({ error: "Search failed", message: err.message });
    } finally {
      if (conn) conn.end().catch(() => {});
    }
  });

  app.get("/api/graph", async (req, res) => {
    const config = getConfig();
    if (!config || !config.db_password) {
      return res.status(401).json({ error: "Locked" });
    }

    let conn;
    try {
      conn = await mariadb.createConnection({
        host: config.db_host,
        user: config.db_user,
        password: config.db_password,
        database: config.db_name
      });

      // 1. Fetch note nodes (limit to 100 recent notes for performance)
      const noteRows: any[] = await conn.query(`
        SELECT id, file_name as name, tags
        FROM notes
        ORDER BY id DESC
        LIMIT 100
      `);

      const nodes: any[] = noteRows.map(n => ({ id: `note-${n.id}`, originalId: n.id, name: n.name, type: 'note' }));
      const links: any[] = [];
      const tagMap = new Map();

      // 2. Process tags and create links
      noteRows.forEach(note => {
        if (note.tags) {
          const tags = note.tags.split(/[\s,]+/).filter((t: string) => t.startsWith('#'));
          tags.forEach((tag: string) => {
            if (!tagMap.has(tag)) {
              const tagId = `tag-${tag}`;
              tagMap.set(tag, tagId);
              nodes.push({ id: tagId, name: tag, type: 'tag' });
            }
            links.push({
              source: `note-${note.id}`,
              target: tagMap.get(tag),
              distance: 0.1,
              type: 'tag-link'
            });
          });
        }
      });

      // 3. Fetch bidirectional semantic links (note to note)
      const semanticLinks = await conn.query(`
        WITH recent_notes AS (
          SELECT id FROM notes ORDER BY id DESC LIMIT 100
        ),
        first_chunks AS (
          SELECT note_id, embedding
          FROM note_chunks
          WHERE note_id IN (SELECT id FROM recent_notes)
          AND id IN (SELECT MIN(id) FROM note_chunks GROUP BY note_id)
        )
        SELECT 
          CONCAT('note-', f1.note_id) as source, 
          CONCAT('note-', f2.note_id) as target,
          VEC_DISTANCE(f1.embedding, f2.embedding) as distance
        FROM first_chunks f1
        JOIN first_chunks f2 ON f1.note_id < f2.note_id
        WHERE VEC_DISTANCE(f1.embedding, f2.embedding) < 0.38 
        LIMIT 200
      `);

      semanticLinks.forEach((l: any) => {
        links.push({ ...l, type: 'note-link' });
      });

      res.json({ nodes, links });
    } catch (err: any) {
      console.error("Graph Error:", err);
      res.status(500).json({ error: "Graph failed", message: err.message });
    } finally {
      if (conn) conn.end().catch(() => {});
    }
  });

  // API Route: Full Note
  app.get("/api/note/:fileName", async (req, res) => {
    const { fileName } = req.params;
    const config = getConfig();
    if (!config) return res.status(400).json({ error: "No config" });

    let conn;
    try {
      conn = await mariadb.createConnection({
        host: config.db_host,
        user: config.db_user,
        password: config.db_password,
        database: config.db_name
      });

      const sql = `
        SELECT nc.content 
        FROM note_chunks nc
        JOIN notes n ON nc.note_id = n.id
        WHERE n.file_name = ?
        ORDER BY nc.id ASC
      `;
      const rows = await conn.query(sql, [fileName]);
      res.json({ fileName, content: rows.map((r: any) => r.content).join('\n\n') });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    } finally {
      if (conn) conn.end().catch(() => {});
    }
  });

  app.get("/api/docs/:name", async (req, res) => {
    try {
      const docName = req.params.name;
      const docPath = path.join(process.cwd(), "docs", docName);
      if (!fs.existsSync(docPath)) {
        // Fallback: check project root if not in /docs
        const rootPath = path.join(process.cwd(), docName);
        if (fs.existsSync(rootPath)) {
          const content = fs.readFileSync(rootPath, "utf-8");
          return res.json({ fileName: docName, content });
        }
        return res.status(404).json({ error: "Document not found" });
      }
      const content = fs.readFileSync(docPath, "utf-8");
      res.json({ fileName: docName, content });
    } catch (err: any) {
      res.status(500).json({ error: "Documentation retrieval failed" });
    }
  });

  app.get("/api/progress", async (req, res) => {
    try {
      const readmePath = path.join(process.cwd(), "README.md");
      const content = fs.readFileSync(readmePath, "utf-8");
      res.json({ fileName: "Project README", content });
    } catch (err: any) {
      res.status(500).json({ error: "Documentation not found" });
    }
  });

  app.get("/api/tags", async (req, res) => {
    const config = getConfig();
    if (!config) return res.json([]);

    let conn;
    try {
      conn = await mariadb.createConnection({
        host: config.db_host,
        user: config.db_user,
        password: config.db_password,
        database: config.db_name
      });

      const rows = await conn.query("SELECT DISTINCT tags FROM notes WHERE tags IS NOT NULL AND tags != ''");
      const tagSet = new Set<string>();
      rows.forEach((row: any) => {
        const rowTags = row.tags.split(/[\s,]+/).filter((t: string) => t.startsWith('#'));
        rowTags.forEach((t: string) => tagSet.add(t));
      });
      res.json(Array.from(tagSet).sort());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    } finally {
      if (conn) conn.end().catch(() => {});
    }
  });

  app.get("/api/stats", async (req, res) => {
    const config = getConfig();
    if (!config) return res.json({ notes: 0, chunks: 0, status: 'unconfigured', vault: null });

    let conn;
    try {
      conn = await mariadb.createConnection({
        host: config.db_host,
        user: config.db_user,
        password: config.db_password,
        database: config.db_name,
        connectTimeout: 2000
      });
      const notes = await conn.query("SELECT COUNT(*) as count FROM notes");
      const chunks = await conn.query("SELECT COUNT(*) as count FROM note_chunks");
      res.json({ 
        notes: Number(notes[0].count), 
        chunks: Number(chunks[0].count),
        status: 'connected',
        vault: config.vault_path
      });
    } catch (err: any) {
      let customMessage = err.message;
      if (err.message.includes("auth_gssapi_client")) {
        customMessage = "MariaDB authentication error (auth_gssapi_client). Your server requires Kerberos/GSSAPI which is not supported by this Node.js client. To fix, change your MariaDB user's authentication method to 'mysql_native_password'.";
      } else if (err.message.includes("Access denied")) {
        customMessage = "Database Access Denied. The password provided in config.json is incorrect or missing. Please restart engine/main.py and provide the correct MariaDB password.";
      }
      console.error("Stats Error:", customMessage);
      res.json({ notes: 0, chunks: 0, status: 'error', message: customMessage, vault: config?.vault_path });
    } finally {
      if (conn) conn.end().catch(() => {});
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
