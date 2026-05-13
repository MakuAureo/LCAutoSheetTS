import { google } from "googleapis";
import fs from "fs";
import {
  CLIENT_ID, CLIENT_SECRET, SERVER_PORT,
  SPREADSHEET_ID, ACTIVE_SHEET_NAME,
  START_COLUMN, QUOTA_COLUMN, SELL_COLUMN,
  START_PLAYERS_COLUMN, PLAYER_NAME_COLUMN
} from "./config.ts";

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

async function getSheetId(): Promise<number> {
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

interface PlayerInfo {
  Name: string;
  Alive: boolean;
  Disconnected: boolean;
  TimeOfDeath: string;
  CauseOfDeath: string;
}

interface SpecialItemInfo {
  Total: number[];
  Collected: number[];
}

interface EnemyInfo {
  Enemy: string;
  SpawnTime: string;
  TimeOfDeath: string;
}

interface Stats {
  MoonInfo: { Name: string; Weather: string };
  DungeonInfo: { Interior: string; ItemCount: number };
  HazardInfo: { TurretCount: number; LandmineCount: number; SpiketrapCount: number };

  BeeInfo: SpecialItemInfo;
  EggInfo: SpecialItemInfo;
  KnifeInfo: SpecialItemInfo;
  ShotgunInfo: SpecialItemInfo;

  Seed: number;

  CollectedNoExtra: number;
  CollectedTotal: number;
  BottomLine: number;
  BottomLineTrue: number;

  ValueSold: number;
  NewQuota: number;

  AppSpawned: boolean;
  IndoorFog: boolean;
  TakeOffTime: string;
  SIDType: string;
  InfestationType: string;
  MeteorShowerTime: string;

  Players: { [key: string]: PlayerInfo };

  IndoorSpawns: EnemyInfo[];
  DayTimeSpawns: EnemyInfo[];
  NightTimeSpawns: EnemyInfo[];

  GiftBoxex: {
    GiftValue: number;
    ScrapValue: number;
    Collected: boolean;
  }[];

  MissedItems: {
    Value: number;
    ItemType: string;
    DespawnPosition: number[];
    CollectedOnPreviousDay: boolean;
  }[];
}

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
    stats.DungeonInfo.ItemCount,
    stats.MissedItems.reduce((acc, cur) => (cur.CollectedOnPreviousDay) ? acc : acc + 1, 0),
    stats.AppSpawned,
    stats.BeeInfo.Total.length,
    stats.BeeInfo.Total.reduce((acc, cur) => acc + cur, 0),
    stats.EggInfo.Total.reduce((acc, cur) => acc + cur, 0),
    stats.IndoorSpawns.filter(e => e.Enemy === "Nutcracker").length,
    stats.IndoorSpawns.filter(e => e.Enemy === "Butler").length,
    stats.ShotgunInfo.Total.length,
    stats.KnifeInfo.Total.length,
    stats.CollectedNoExtra,
    stats.BottomLine,
    stats.CollectedTotal,
    stats.BottomLineTrue,
    stats.TakeOffTime,
    stats.HazardInfo.TurretCount,
    stats.HazardInfo.LandmineCount,
    stats.HazardInfo.SpiketrapCount,
    stats.IndoorFog,
    stats.SIDType,
    stats.InfestationType,
    stats.MeteorShowerTime,
    stats.MissedItems.reduce((acc, cur) => (cur.CollectedOnPreviousDay) ? acc + cur.Value : acc, 0),
  ];
}

export async function writeStats(stats: Stats): Promise<void> {
  if (stats.NewQuota != 0) {
    //Update new quota
    const currentQuotaCount = await getFirstEmptyRowInColumn(QUOTA_COLUMN);
    const sellThisQuotaCell = await readCells(`${SELL_COLUMN}${currentQuotaCount - 1}`);
    const sellThisQuotaAmount = Number(sellThisQuotaCell.values?.[0]?.[0] ?? 0);
    await writeCells(`${QUOTA_COLUMN}${currentQuotaCount + 2}`, [[stats.NewQuota]])
    await writeCells(`${SELL_COLUMN}${currentQuotaCount - 1}`, [[stats.ValueSold + sellThisQuotaAmount]])
  } else if (stats.DungeonInfo == null) {
    //If nothing was sold do nothing
    if (stats.ValueSold == 0)
      return;
    //Update amount sold
    const currentSellCount = await getFirstEmptyRowInColumn(SELL_COLUMN);
    if (currentSellCount == 1) {
      await writeCells(`${SELL_COLUMN}2`, [[stats.ValueSold]]);
      return;
    }
    const sellCell = await readCells(`${SELL_COLUMN}${currentSellCount + 2}`);
    const sellAmount = Number(sellCell.values?.[0]?.[0] ?? 0);
    writeCells(`${SELL_COLUMN}${currentSellCount + 2}`, [[stats.ValueSold + sellAmount]]);
  } else {
    //Add player names
    const playersSorted = Object.keys(stats.Players).sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0));
    let firstEmptyPlayerRow = await getFirstEmptyRowInColumn(START_PLAYERS_COLUMN);
    if (firstEmptyPlayerRow == 1) {
      let playerInits: string[] = [];
      let playerNames: string[][] = [];
      for (const key of playersSorted) {
        const value = stats.Players[key];
        playerInits.push(value.Name.slice(0,2));
        playerNames.push([value.Name]);
      }
      await writeCells(`${START_PLAYERS_COLUMN}${firstEmptyPlayerRow}`, [ playerInits ]);
      await writeCells(`${PLAYER_NAME_COLUMN}2`, playerNames);
      firstEmptyPlayerRow++;
    }
    //Add player status
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

      if (convertTimeToNumber(value.TimeOfDeath) + 120 < convertTimeToNumber(stats.TakeOffTime)) {
        playerStatus.push("X");
        continue;
      }

      playerStatus.push("S");
    }
    await writeCells(`${START_PLAYERS_COLUMN}${firstEmptyPlayerRow}`, [playerStatus]);
    const firstEmptyRow = await getFirstEmptyRowInColumn(START_COLUMN);
    const row = processStats(stats);
    await writeCells(`${START_COLUMN}${firstEmptyRow}`, [row]);
  }
}
