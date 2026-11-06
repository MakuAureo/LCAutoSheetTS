import express from "express";
import type { Response } from "express";
import { EventSource } from "eventsource";
import { exec } from "child_process";
import { getAuthUrl, getSheetId, handleOAuthCallback, isAuthenticated, writeStatsToSheet } from "./src/autosheet.ts";
import { MOD_PORT, SERVER_PORT } from "./src/config.ts";
import { statsDB, writeStatsToDB } from "./src/database.ts";
import { buildMap, getMapImage, hasMapData } from "./src/mapbuilder.ts";
import type { MapInfo } from "./src/mapbuilder.ts";

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

// ── Map ──────────────────────────────────────────────────────

type MapState = { status: "none" | "building" | "failed" } | { status: "ready"; map: MapInfo };

let mapState: MapState = { status: "none" };

function setMapState(state: MapState): void {
  mapState = state;
  const payload = `event: map\ndata: ${JSON.stringify(state)}\n\n`;
  for (const client of browserClients) {
    client.write(payload);
  }
}

async function updateMap(stats: Parameters<typeof buildMap>[0]): Promise<void> {
  setMapState({ status: "building" });
  try {
    setMapState({ status: "ready", map: await buildMap(stats) });
  } catch (err) {
    console.error("Failed to build map:", err);
    setMapState({ status: "failed" });
  }
}

// ── Routes ───────────────────────────────────────────────────

// Serve the website
app.use(express.static("public"));

// A day's JSON saved earlier. Only replaces the map, it doesn't count as a new day for the sheet or database
app.post("/map/upload", express.json({ limit: "50mb" }), async (req, res) => {
  if (!req.body || !hasMapData(req.body)) {
    res.status(400).send("This JSON has no map data.");
    return;
  }
  await updateMap(req.body);
  if (mapState.status === "ready") res.sendStatus(204);
  else res.status(500).send("Failed to build the map from this JSON.");
});

// Floor images of the current map, they only exist in memory
app.get("/maps/:id/:file", (req, res) => {
  const image = getMapImage(req.params.id, req.params.file);
  if (!image) {
    res.status(404).send("No such map image.");
    return;
  }
  res.type("png").send(image);
});

// Browser connects here to receive live stat updates
app.get("/live", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  browserClients.add(res);
  console.log(`Browser client connected (${browserClients.size} total)`);

  // Send last known stats immediately so the page isn't blank on connect
  if (lastStats)
    res.write(`data: ${JSON.stringify(lastStats)}\n\n`);
  res.write(`event: map\ndata: ${JSON.stringify(mapState)}\n\n`);

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

    // Doesn't hold up the rest, browsers get told when it's done
    if (hasMapData(stats))
      updateMap(stats);

    // Write to sheets if authenticated
    if (isAuthenticated()) {
      try {
        await writeStatsToSheet(stats);
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

