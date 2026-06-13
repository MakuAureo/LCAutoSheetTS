import { google } from "googleapis";
import fs from "fs";
import {
  CLIENT_ID, CLIENT_SECRET, SERVER_PORT,
  SPREADSHEET_ID, ACTIVE_SHEET_NAME,
  START_STATS_COLUMN, QUOTA_COLUMN, SELL_COLUMN,
  START_PLAYERS_COLUMN, PLAYER_NAME_COLUMN,
  VERSION_CELL, SALE_CELL, FURNITURE_CELL_START
} from "./config.ts";
import type { Stats } from "./dataschema.ts";

const TOKENS_PATH = "./tokens.json";
const REDIRECT_URI = `http://localhost:${SERVER_PORT}/oauth/callback`;

export const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
const sheets = google.sheets({ version: "v4", auth: oauth2Client });

// Load persisted tokens on startup if they exist
if (fs.existsSync(TOKENS_PATH)) {
  const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, "utf-8"));
  oauth2Client.setCredentials(tokens);
  console.log("Loaded saved OAuth tokens.");
}

// Persist tokens whenever they are refreshed
oauth2Client.on("tokens", (tokens) => {
  const existing = fs.existsSync(TOKENS_PATH)
    ? JSON.parse(fs.readFileSync(TOKENS_PATH, "utf-8"))
    : {};
  fs.writeFileSync(TOKENS_PATH, JSON.stringify({ ...existing, ...tokens }));
});

export function getAuthUrl(): string {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: "https://www.googleapis.com/auth/spreadsheets",
    prompt: "consent"
  });
}

export async function handleOAuthCallback(code: string): Promise<void> {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens));
  console.log("OAuth tokens saved.");
}

export function isAuthenticated(): boolean {
  const creds = oauth2Client.credentials;
  return !!(creds.access_token || creds.refresh_token);
}

// ── Sheets helpers ───────────────────────────────────────────

export async function getSheetId(): Promise<number> {
  const sheets = google.sheets({ version: "v4", auth: oauth2Client });

  const res = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: "sheets.properties"
  });

  const sheet = res.data.sheets?.find(
    s => s.properties?.title === ACTIVE_SHEET_NAME
  );

  if (!sheet?.properties?.sheetId)
    throw new Error(`Sheet "${ACTIVE_SHEET_NAME}" not found`);

  return sheet.properties.sheetId;
}

async function addNote(cellRange: string, note: string): Promise<void> {
  const sheets = google.sheets({ version: "v4", auth: oauth2Client });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        updateCells: {
          range: {
            sheetId: SHEET_ID,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: 1
          },
          rows: [{
            values: [{
              note: note
            }]
          }],
          fields: "note"
        }
      }]
    }
  });
}

async function getFirstEmptyRowInColumn(column: string): Promise<number> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${ACTIVE_SHEET_NAME}!${column}:${column}`
  });
  return (res.data.values?.length ?? 0) + 1;
}

async function readCells(cellRange: string) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${ACTIVE_SHEET_NAME}!${cellRange}`
  });
  return res.data;
}

async function writeCells(startPos: string, values: unknown[][]): Promise<void> {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${ACTIVE_SHEET_NAME}!${startPos}`,
    valueInputOption: "RAW",
    requestBody: { values }
  });
}

// ── Stat processing ──────────────────────────────────────────

function convertTimeToNumber(time: string): number {
  const allNumbers = time.match(/\d+/g);
  const dayMod = time.match(/AM|PM/);
  if (allNumbers == null || dayMod == null)
    return 0;
  return (60*(Number(allNumbers[0])%12) + Number(allNumbers[1]) + (dayMod[0] == "AM" ? 0 : 720 ));
}

function processStats(stats: Stats): unknown[] {
  return [
    stats.Seed,
    stats.MoonInfo.Name.replace(/\d*\s/, ""),
    stats.MoonInfo.Weather,
    stats.DungeonInfo.Interior.replace(/flow|interior/gi,""),
    stats.EventInfo.AppSpawned,
    stats.DungeonInfo.ItemCount,
    stats.MissedItems.reduce((acc, cur) => (cur.CollectedOnPreviousDay) ? acc : acc + 1, 0),
    stats.BeeInfo.Available.length,
    stats.BeeInfo.Available.reduce((acc, cur) => acc + cur, 0),
    stats.BeeInfo.Collected.length,
    stats.BeeInfo.Collected.reduce((acc, cur) => acc + cur, 0),
    stats.EggInfo.Available.length,
    stats.EggInfo.Available.reduce((acc, cur) => acc + cur, 0),
    stats.EggInfo.Collected.length,
    stats.EggInfo.Collected.reduce((acc, cur) => acc + cur, 0),
    stats.ShotgunInfo.Available.length,
    stats.ShotgunInfo.Available.reduce((acc, cur) => acc + cur, 0),
    stats.ShotgunInfo.Collected.length,
    stats.ShotgunInfo.Collected.reduce((acc, cur) => acc + cur, 0),
    stats.KnifeInfo.Available.length,
    stats.KnifeInfo.Available.reduce((acc, cur) => acc + cur, 0),
    stats.KnifeInfo.Collected.length,
    stats.KnifeInfo.Collected.reduce((acc, cur) => acc + cur, 0),
    stats.PerformanceInfo.CollectedNoExtra,
    stats.PerformanceInfo.InitialAvailableValue,
    stats.PerformanceInfo.CollectedTotal,
    stats.PerformanceInfo.TotalAvailableValue,
    stats.HazardInfo.TurretCount,
    stats.HazardInfo.LandmineCount,
    stats.HazardInfo.SpiketrapCount,
    stats.EventInfo.TakeOffTime,
    stats.EventInfo.IndoorFog,
    stats.EventInfo.SIDType,
    stats.EventInfo.InfestationType,
    stats.EventInfo.MeteorShowerTime,
    stats.MissedItems.reduce((acc, cur) => (cur.CollectedOnPreviousDay) ? acc + cur.Value : acc, 0),
  ];
}

async function writeNewQuota(stats: Stats): Promise<void> {
  const currentQuotaRow = await getFirstEmptyRowInColumn(QUOTA_COLUMN) - 1;
  const nextQuotaRow = currentQuotaRow + 3;

  const alreadySoldThisQuotaVRange = await readCells(`${SELL_COLUMN}${currentQuotaRow}`);
  const alreadySoldThisQuotaNumber = Number(alreadySoldThisQuotaVRange.values?.[0]?.[0] ?? 0);

  await writeCells(`${QUOTA_COLUMN}${nextQuotaRow}`, [[stats.QuotaInfo.NewQuota]])
  await writeCells(`${SELL_COLUMN}${currentQuotaRow}`, [[stats.QuotaInfo.ValueSold + alreadySoldThisQuotaNumber]])
}

async function updateSoldThisQuota(stats: Stats): Promise<void> {
  const currentSellRow = await getFirstEmptyRowInColumn(SELL_COLUMN) - 1;

  if (currentSellRow == 1) {
    await writeCells(`${SELL_COLUMN}3`, [[stats.QuotaInfo.ValueSold]]);
    return;
  }

  const alreadySoldThisQuotaVRange = await readCells(`${SELL_COLUMN}${currentSellRow}`);
  const alreadySoldThisQuotaNumber = Number(alreadySoldThisQuotaVRange.values?.[0]?.[0] ?? 0);

  writeCells(`${SELL_COLUMN}${currentSellRow}`, [[stats.QuotaInfo.ValueSold + alreadySoldThisQuotaNumber]]);
}

async function writeInitalValues(stats: Stats, playersSorted: string[]): Promise<void> {
  let playerInits: string[] = [];
  let playerNames: string[][] = [];
  for (const key of playersSorted) {
    const value = stats.Players[key];
    playerInits.push(value.Name.slice(0,2));
    playerNames.push([value.Name]);
  }

  await writeCells(`${START_PLAYERS_COLUMN}1`, [ playerInits ]);
  await writeCells(`${PLAYER_NAME_COLUMN}3`, playerNames);
  await writeCells(VERSION_CELL, [[ stats.Version ]]);
}

async function writeNewDay(stats: Stats): Promise<void> {
  const playersSorted: string[] = Object.keys(stats.Players).sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0));
  let firstEmptyPlayerRow = await getFirstEmptyRowInColumn(START_PLAYERS_COLUMN);
  if (firstEmptyPlayerRow == 1) {
    writeInitalValues(stats, playersSorted);
    firstEmptyPlayerRow = 3;
  }

  let playerStatus: string[] = [];
  for (const key of playersSorted) {
    const value = stats.Players[key];
    if (value.Alive == true) {
      playerStatus.push(value.Disconnected ? "D" : "A");
      continue;
    }

    if (value.CauseOfDeath == "Abandoned") {
      playerStatus.push("M");
      continue;
    }

    if (convertTimeToNumber(value.TimeOfDeath) + 120 < convertTimeToNumber(stats.EventInfo.TakeOffTime)) {
      playerStatus.push("X");
      continue;
    }

    playerStatus.push("S");
  }

  await writeCells(`${START_PLAYERS_COLUMN}${firstEmptyPlayerRow}`, [playerStatus]);

  let nextEmptyRow = await getFirstEmptyRowInColumn(START_STATS_COLUMN);
  if (nextEmptyRow < 3) nextEmptyRow = 3;

  const newRow = processStats(stats);
  await writeCells(`${START_STATS_COLUMN}${nextEmptyRow}`, [newRow]);
}

async function updateShopSales(stats: Stats): Promise<void> {
  let sales: number[][] = [];
  const itemList = Object.keys(stats.ShopSales);
  for (const key of itemList) {
    const value = stats.ShopSales[key];
    sales.push([value]);
  }

  await writeCells(SALE_CELL, sales);
}

async function updateFurnitureState(stats: Stats): Promise<void> {
  let furniture: any[][] = [];
  const furnList = Object.keys(stats.FurnitureInfo);
  for (const key of furnList) {
    const value = stats.FurnitureInfo[key];
    furniture.push([ key, value.Luck, value.RealPrice, value.Owned && !value.Stored, value.InStock ]);
  }

  await writeCells(FURNITURE_CELL_START, furniture);
}

let SHEET_ID: number;
export async function writeStatsToSheet(stats: Stats): Promise<void> {
  SHEET_ID = await getSheetId();
  await updateShopSales(stats);
  await updateFurnitureState(stats);

  if (stats.QuotaInfo.NewQuota != 0) {
    await writeNewQuota(stats);
  } else if (stats.DungeonInfo == null) {
    if (stats.QuotaInfo.ValueSold == 0) return;
    await updateSoldThisQuota(stats);
  } else {
    await writeNewDay(stats);
  }
}
