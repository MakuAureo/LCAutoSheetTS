import express from "express";
import type { Response } from "express";
import { EventSource } from "eventsource";
import { exec } from "child_process";
import { getAuthUrl, getSheetId, handleOAuthCallback, isAuthenticated, writeStatsToSheet } from "./src/autosheet.ts";
import { MOD_PORT, SERVER_PORT } from "./src/config.ts";
import { statsDB, writeStatsToDB } from "./src/database.ts";

function openBrowser(url: string): void {
  exec(`xdg-open "${url}"`, (err) => {
    if (err) console.error("Failed to open browser automatically. Visit manually:", url);
  });
}

const app = express();

// ── Browser SSE clients ──────────────────────────────────────

const browserClients = new Set<Response>();
let lastStats: unknown = null;

function notifyBrowserClients(stats: unknown): void {
  const payload = `data: ${JSON.stringify(stats)}\n\n`;
  for (const client of browserClients) {
    client.write(payload);
  }
}

// ── Routes ───────────────────────────────────────────────────

// Serve the website
app.use(express.static("public"));

// Browser connects here to receive live stat updates
app.get("/live", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  browserClients.add(res);
  console.log(`Browser client connected (${browserClients.size} total)`);

  // Send last known stats immediately so the page isn't blank on connect
  if (lastStats)
    res.write(`data: ${JSON.stringify(lastStats)}\n\n`);

  req.on("close", () => {
    browserClients.delete(res);
    console.log(`Browser client disconnected (${browserClients.size} remaining)`);
  });
});

// OAuth login — redirect user to Google
app.get("/oauth/login", (req, res) => {
  res.redirect(getAuthUrl());
});

// OAuth callback — Google redirects here after login
app.get("/oauth/callback", async (req, res) => {
  const code = req.query.code as string;
  if (!code) {
    res.status(400).send("Missing OAuth code.");
    return;
  }
  try {
    await handleOAuthCallback(code);
    res.send(`
      <p>Authentication successful! You can close this tab.</p>
      <script>window.close();</script>
    `);
  } catch (e) {
    console.error("OAuth callback error:", e);
    res.status(500).send("Authentication failed.");
  }
});

app.get("/stats/filters", (req, res) => {
  const players  = (statsDB.prepare("SELECT DISTINCT players FROM day").all() as {players: number}[]).map(r => r.players);
  const versions = (statsDB.prepare("SELECT DISTINCT version FROM day").all() as {version: number}[]).map(r => r.version);
  const moons    = (statsDB.prepare("SELECT DISTINCT moon    FROM day").all() as {moon:    string}[]).map(r => r.moon);
  res.json({ players, versions, moons });
});

app.get("/stats/history", (req, res) => {
  const { players, moon, version } = req.query;

  const recent = statsDB.prepare(`SELECT collected FROM day WHERE players = ${players} AND moon = ${moon} AND version = ${version} ORDER BY time DESC LIMIT 10`).all() as { collected: number }[];
  const avg = statsDB.prepare(`SELECT AVG(collected) as avg FROM day WHERE players = ${players} AND moon = ${moon} AND version = ${version}`).get() as { avg: number };
  const recentReversed = recent.map(r => r.collected).reverse();

  res.json({
    labels: recentReversed.map((_, i) => `${i + 1}`),
    recent: recentReversed,
    average: Math.round(avg.avg ?? 0)
  });
});

// Status endpoint — useful for debugging
app.get("/status", (req, res) => {
  res.json({
    authenticated: isAuthenticated(),
    browserClients: browserClients.size,
    hasLastStats: lastStats !== null
  });
});

// ── Mod listener ─────────────────────────────────────────────

function connectToMod(): void {
  console.log(`Connecting to mod SSE at http://localhost:${MOD_PORT}...`);

  const source = new EventSource(`http://localhost:${MOD_PORT}`);

  source.onopen = () => {
    console.log("Connected to mod. Waiting for match to end...");
  };

  source.onmessage = async (e) => {
    source.close();

    console.log("Match data received.");
    const stats = JSON.parse(e.data as string);
    lastStats = stats;

    // Push to any open browser tabs immediately
    notifyBrowserClients(stats);

    // Write to sheets if authenticated
    if (isAuthenticated()) {
      try {
        console.log("Writing to spreadsheet...");
        await writeStatsToSheet(stats);
        console.log("Spreadsheet updated.");
      } catch (err) {
        console.error("Failed to write to spreadsheet:", err);
      }
    } else {
      console.warn(`Not authenticated — skipping spreadsheet write. Visit http://localhost:${SERVER_PORT}/oauth/login`);
    }
    
    // Push to database
    writeStatsToDB(stats);

    // Reconnect for the next match
    setTimeout(connectToMod, 100);
  };

  source.onerror = () => {
    source.close();
    console.log("Mod connection lost. Retrying in 3s...");
    setTimeout(connectToMod, 3000);
  };
}

// ── Start ────────────────────────────────────────────────────

app.listen(SERVER_PORT, async () => {
  console.log(`Server running at http://localhost:${SERVER_PORT}`);

  if (!isAuthenticated()) {
    const loginUrl = `http://localhost:${SERVER_PORT}/oauth/login`;
    console.log(`Not authenticated. Opening browser for Google login...`);
    openBrowser(loginUrl);
  }

  connectToMod();
});

