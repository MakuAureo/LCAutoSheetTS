import { DatabaseSync, StatementSync } from "node:sqlite";
import type { Stats } from "./dataschema.ts";

function startDB(): DatabaseSync {
  const db = new DatabaseSync("stats.db");

  db.exec(`
          CREATE TABLE IF NOT EXISTS day (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            time      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            players   INTEGER,
            version   INTEGER,
            seed      INTEGER,
            moon      TEXT,
            weather   TEXT,
            interior  TEXT,
            items     INTEGER,
            collected INTEGER,
            available INTEGER,
            died      INTEGER,
            data      TEXT
          )
          `);
  
  return db;
}

export const statsDB = startDB();

export function writeStatsToDB(stats: Stats): void {
  const insert: StatementSync = statsDB.prepare("INSERT INTO day (players, version, seed, moon, weather, interior, items, collected, available, died, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  insert.run(
    Object.keys(stats.Players).length,
    stats.Version,
    stats.Seed,
    stats.MoonInfo.Name,
    stats.MoonInfo.Weather,
    stats.DungeonInfo.Interior,
    stats.DungeonInfo.ItemCount,
    stats.PerformanceInfo.CollectedTotal,
    stats.PerformanceInfo.TotalAvailableValue,
    ((stats.Players["76561198980273231"].Alive) ? 0 : 1),
    JSON.stringify(stats)
  );
}
