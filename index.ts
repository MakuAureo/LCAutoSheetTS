import express from "express";
import type { Response } from "express";
import { EventSource } from "eventsource";
import { exec } from "child_process";
import { getAuthUrl, handleOAuthCallback, isAuthenticated, writeStats } from "./autosheet.ts";
import { MOD_PORT, SERVER_PORT } from "./config.ts";

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
        await writeStats(stats);
        console.log("Spreadsheet updated.");
      } catch (err) {
        console.error("Failed to write to spreadsheet:", err);
      }
    } else {
      console.warn(`Not authenticated — skipping spreadsheet write. Visit http://localhost:${SERVER_PORT}/oauth/login`);
    }

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

app.listen(SERVER_PORT, () => {
  console.log(`Server running at http://localhost:${SERVER_PORT}`);

  if (!isAuthenticated()) {
    const loginUrl = `http://localhost:${SERVER_PORT}/oauth/login`;
    console.log(`Not authenticated. Opening browser for Google login...`);
    openBrowser(loginUrl);
  }

  connectToMod();
});

