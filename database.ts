import { DatabaseSync, StatementSync } from "node:sqlite";
import type { Stats } from "./autosheet.ts";

function startDB(): DatabaseSync {
  const db = new DatabaseSync("stats.db");

  db.exec(`
          CREATE TABLE IF NOT EXISTS day (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            time      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            type      TEXT,
            version   INTEGER,
            seed      INTEGER,
            moon      TEXT,
            weather   TEXT,
            collected INTEGER,
            available INTEGER,
            data      TEXT
          )
          `);
  
  return db;
}

const statsDB = startDB();

export function writeStatsToDB(stats: Stats): void {
  const runType = [ "Solo", "Duo", "Trio", "Squad" ];

  const insert: StatementSync = statsDB.prepare("INSERT INTO day (type, version, seed, moon, weather, collected, available, data)");
  insert.run(
    runType[Object.keys(stats.Players).length],
    stats.Version,
    stats.Seed,
    stats.MoonInfo.Name,
    stats.MoonInfo.Weather,
    stats.CollectedTotal,
    stats.BottomLineTrue,
    JSON.stringify(stats)
  );
}
