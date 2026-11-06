# LCAutoSheetTS

Typescript Node server that auto-fills a designed Spreadsheet.

# Running LCAutoSheetTS

### Pre-requisites

To run this you'll need:
- [Node and Npm](https://nodejs.org/en/download/current)
- A [Google Sheets API OAuth](https://console.cloud.google.com) setup:
- - Allow `http://localhost:8000` origin
- - Redirect to `http://localhost:8000/oauth/callback`
- A [Spreadsheet with compatible layout](https://docs.google.com/spreadsheets/d/1HVi8b4Wckp96t3JdCr55800SIIptt3KYTdWw7_GzMHI)

### Step 1: Clone the Repository

Either run 

```git clone https://github.com/MakuAureo/LCAutoSheetTS.git```

or download the repository

### Step 2: Setup the Config File

Rename `config.example.ts` to `config.ts` and fill in the necessary fields

#### Config File
``` config.ts
// App config
export const CLIENT_ID            = "YOUR_API_KEY";
export const CLIENT_SECRET        = "YOUR_CLIENT_SECRET";
export const SPREADSHEET_ID       = "YOUR_SHEET_ID";
export const ACTIVE_SHEET_NAME    = "YOUR_SHEET_NAME"; // By default "CurrentRun"

// Database config
export const PLAYER_STEAM_ID = "YOUR_STEAM_ID";

// In sheet config
export const QUOTA_COLUMN             = "B";
export const START_STATS_COLUMN       = "D";
export const SELL_COLUMN              = "AP";
export const START_PLAYERS_COLUMN     = "AQ";
export const PLAYER_NAME_COLUMN       = "AU";
export const VERSION_CELL             = "BU5";
export const SALE_CELL                = "AY4"
export const FURNITURE_CELL_START     = "BE4"

// Port config
export const MOD_PORT    = 2145;
export const SERVER_PORT = 8000;
```

### Step 3: Install dependecies

Run 

``` run.sh
npm install
```

### Step 4: Running the Server

Run the local server

``` run.sh
node index.ts
```

### Step 5 (Optional): Map Images

The Map tab builds an image of each floor of the dungeon when a day ends. It needs the images from `render_tiles.py` and `render_moons.py`: put them in `map_tiles/`, or set `MAP_TILES_DIR` in `config.ts`. `map_tiles/versions.json` says which set of images each game version uses. Maps are kept in memory until the next one, `Save All Floors` is what saves them as files.

### Step 6 (Optional): Customization

You can check out the browser page by going to: http://localhost:8000 in your browser.

If you add a `bg.png` image to `/public` it will be set as your background.

If you add a `favicon.ico` image to `/public` it will be set as your tab icon.

And you're done!

# Day JSON

At the end of each day [StatsTracker](https://github.com/MakuAureo/StatsTracker) sends one JSON object to the server (port `MOD_PORT`). The Map tab's `Upload JSON` takes the same object.

Positions are world coordinates `[x, y, z]` in Unity units, y is up. Times are the in-game clock as a string, `""` means it didn't happen.

### JSON Schema
```
{
  "title": "Stats",
  "type": "object",
  "required": [
    "Seed",
    "Version",
    "MoonInfo",
    "DungeonInfo",
    "HazardInfo",
    "PerformanceInfo",
    "BeeInfo",
    "EggInfo",
    "KnifeInfo",
    "ShotgunInfo",
    "QuotaInfo",
    "EventInfo",
    "Players",
    "IndoorSpawns",
    "DayTimeSpawns",
    "NightTimeSpawns",
    "ShopSales",
    "FurnitureInfo",
    "GiftBoxesOpened",
    "SpawnedItems",
    "MissedItems"
  ],
  "properties": {
    "Seed":    { "type": "integer" },
    "Version": { "type": "integer", "description": "Game version, 81 for v81" },

    "MoonInfo": {
      "type": "object",
      "required": ["Name", "Weather", "Entrances", "OutsideObjects", "RemovedTrees"],
      "properties": {
        "Name":           { "type": "string" },
        "Weather":        { "type": "string" },
        "Entrances":      { "type": "array", "items": { "$ref": "#/$defs/Entrance" }, "description": "The outside side of the main entrance and fire exits" },
        "OutsideObjects": { "type": "array", "items": { "$ref": "#/$defs/OutsideObjectInfo" }, "description": "Objects the game placed outside this day" },
        "RemovedTrees":   { "type": "array", "items": { "$ref": "#/$defs/Position" }, "description": "Trees the outside objects replaced" }
      }
    },

    "DungeonInfo": {
      "type": ["object", "null"],
      "description": "null on moons without a dungeon",
      "required": ["ItemCount", "Interior", "DungeonMap", "Doors", "BigDoors"],
      "properties": {
        "ItemCount":  { "type": "integer" },
        "Interior":   { "type": "string" },
        "DungeonMap": { "$ref": "#/$defs/DungeonMap" },
        "Doors":      { "type": "array", "items": { "$ref": "#/$defs/DoorInfo" } },
        "BigDoors":   { "type": "array", "items": { "$ref": "#/$defs/BigDoorInfo" } }
      }
    },

    "HazardInfo": {
      "type": ["object", "null"],
      "description": "null on moons without a dungeon",
      "required": ["TurretCount", "LandmineCount", "SpiketrapCount", "MapHazards"],
      "properties": {
        "TurretCount":    { "type": "integer" },
        "LandmineCount":  { "type": "integer" },
        "SpiketrapCount": { "type": "integer" },
        "MapHazards":     { "type": "array", "items": { "$ref": "#/$defs/MapHazardInfo" } }
      }
    },

    "PerformanceInfo": {
      "type": "object",
      "required": [
        "CollectedNoExtra",
        "CollectedTotal",
        "InitialAvailableValue",
        "TotalAvailableValue",
        "ExtraFromOldGift"
      ],
      "properties": {
        "CollectedNoExtra":      { "type": "integer" },
        "CollectedTotal":        { "type": "integer" },
        "InitialAvailableValue": { "type": "integer" },
        "TotalAvailableValue":   { "type": "integer" },
        "ExtraFromOldGift":      { "type": "integer" }
      }
    },

    "BeeInfo":     { "$ref": "#/$defs/SpecialItemInfo" },
    "EggInfo":     { "$ref": "#/$defs/SpecialItemInfo" },
    "KnifeInfo":   { "$ref": "#/$defs/SpecialItemInfo" },
    "ShotgunInfo": { "$ref": "#/$defs/SpecialItemInfo" },

    "QuotaInfo": {
      "type": "object",
      "required": ["ValueSold", "NewQuota"],
      "properties": {
        "ValueSold": { "type": "integer" },
        "NewQuota":  { "type": "integer" }
      }
    },

    "EventInfo": {
      "type": "object",
      "required": [
        "AppSpawned",
        "IndoorFog",
        "TakeOffTime",
        "SIDType",
        "InfestationType",
        "MeteorShowerTime"
      ],
      "properties": {
        "AppSpawned":       { "type": "boolean" },
        "IndoorFog":        { "type": "boolean" },
        "TakeOffTime":      { "type": "string" },
        "SIDType":          { "type": "string" },
        "InfestationType":  { "type": "string" },
        "MeteorShowerTime": { "type": "string" }
      }
    },

    "Players": {
      "type": "object",
      "description": "Keyed by Steam ID",
      "additionalProperties": { "$ref": "#/$defs/PlayerStats" }
    },

    "IndoorSpawns":    { "type": "array", "items": { "$ref": "#/$defs/SpawnInfo" } },
    "DayTimeSpawns":   { "type": "array", "items": { "$ref": "#/$defs/SpawnInfo" } },
    "NightTimeSpawns": { "type": "array", "items": { "$ref": "#/$defs/SpawnInfo" } },

    "ShopSales": {
      "type": "object",
      "additionalProperties": { "type": "integer" }
    },

    "FurnitureInfo": {
      "type": "object",
      "additionalProperties": { "$ref": "#/$defs/FurnitureInfo" }
    },

    "GiftBoxesOpened": { "type": "array", "items": { "$ref": "#/$defs/GiftBoxInfo" } },
    "SpawnedItems":    { "type": "array", "items": { "$ref": "#/$defs/SpawnedItemInfo" } },
    "MissedItems":     { "type": "array", "items": { "$ref": "#/$defs/MissingItemInfo" } }
  },

  "$defs": {
    "Position": {
      "type": "array",
      "items": { "type": "number" },
      "minItems": 3,
      "maxItems": 3
    },

    "Entrance": {
      "type": "object",
      "required": ["Position", "Main"],
      "properties": {
        "Position": { "$ref": "#/$defs/Position" },
        "Main":     { "type": "boolean", "description": "Main entrance, otherwise a fire exit" }
      }
    },

    "OutsideObjectInfo": {
      "type": "object",
      "required": ["Name", "Position", "Yaw"],
      "properties": {
        "Name":     { "type": "string" },
        "Position": { "$ref": "#/$defs/Position" },
        "Yaw":      { "type": "number", "description": "Degrees, clockwise from above" }
      }
    },

    "DungeonMap": {
      "type": "object",
      "required": ["Tiles", "Edges"],
      "properties": {
        "Tiles": { "type": "array", "items": { "$ref": "#/$defs/DungeonTile" } },
        "Edges": { "type": "array", "items": { "$ref": "#/$defs/DungeonEdge" } }
      }
    },

    "DungeonTile": {
      "type": "object",
      "required": ["Name", "Position", "BoundsMin", "BoundsMax", "Yaw", "Overlays", "Entrances"],
      "properties": {
        "Name":      { "type": "string", "description": "Tile prefab name, the folder of its images" },
        "Position":  { "$ref": "#/$defs/Position" },
        "BoundsMin": { "$ref": "#/$defs/Position", "description": "World space, axis aligned" },
        "BoundsMax": { "$ref": "#/$defs/Position" },
        "Yaw":       { "type": "number", "description": "Degrees, clockwise from above, relative to the tile's image" },
        "Overlays":  { "type": "array", "items": { "type": "string" }, "description": "Keys into the tile's manifest.json overlays, the parts DunGen picked" },
        "Entrances": { "type": "array", "items": { "$ref": "#/$defs/Entrance" }, "description": "The inside side of entrances in this tile" }
      }
    },

    "DungeonEdge": {
      "type": "object",
      "description": "A connection between two tiles, each side is [tile index, doorway index]",
      "required": ["From", "To"],
      "properties": {
        "From": { "type": "array", "items": { "type": "integer" }, "minItems": 2, "maxItems": 2 },
        "To":   { "type": "array", "items": { "type": "integer" }, "minItems": 2, "maxItems": 2 }
      }
    },

    "DoorInfo": {
      "type": "object",
      "required": ["Position", "StartedLocked", "UnlockTime"],
      "properties": {
        "Position":      { "$ref": "#/$defs/Position" },
        "StartedLocked": { "type": "boolean" },
        "UnlockTime":    { "type": "string" }
      }
    },

    "BigDoorInfo": {
      "type": "object",
      "required": ["Position", "Code", "StartedOpen"],
      "properties": {
        "Position":    { "$ref": "#/$defs/Position" },
        "Code":        { "type": "string", "description": "Terminal code" },
        "StartedOpen": { "type": "boolean" }
      }
    },

    "MapHazardInfo": {
      "type": "object",
      "required": ["Kind", "Position", "Code"],
      "properties": {
        "Kind":     { "type": "string", "enum": ["Turret", "Landmine", "Spike Trap"] },
        "Position": { "$ref": "#/$defs/Position" },
        "Code":     { "type": "string", "description": "Terminal code" }
      }
    },

    "SpecialItemInfo": {
      "type": "object",
      "required": ["Available", "Collected"],
      "properties": {
        "Available": { "type": "array", "items": { "type": "integer" } },
        "Collected": { "type": "array", "items": { "type": "integer" } }
      }
    },

    "PlayerStats": {
      "type": "object",
      "required": ["Name", "Alive", "Disconnected", "TimeOfDeath", "CauseOfDeath"],
      "properties": {
        "Name":         { "type": "string" },
        "Alive":        { "type": "boolean" },
        "Disconnected": { "type": "boolean" },
        "TimeOfDeath":  { "type": "string" },
        "CauseOfDeath": { "type": "string" }
      }
    },

    "SpawnInfo": {
      "type": "object",
      "required": ["Id", "Enemy", "SpawnTime", "TimeOfDeath", "SpawnPosition", "EndPosition"],
      "properties": {
        "Id":            { "type": "integer", "description": "Network object id" },
        "Enemy":         { "type": "string" },
        "SpawnTime":     { "type": "string" },
        "TimeOfDeath":   { "type": "string", "description": "\"\" if it was still alive when the day ended" },
        "SpawnPosition": { "$ref": "#/$defs/Position" },
        "EndPosition":   { "oneOf": [{ "$ref": "#/$defs/Position" }, { "type": "null" }], "description": "Where it died or was despawned" }
      }
    },

    "FurnitureInfo": {
      "type": "object",
      "required": ["InStock", "Owned", "Stored", "ApparentPrice", "RealPrice", "Luck"],
      "properties": {
        "InStock":       { "type": "boolean" },
        "Owned":         { "type": "boolean" },
        "Stored":        { "type": "boolean" },
        "ApparentPrice": { "type": "integer" },
        "RealPrice":     { "type": "integer" },
        "Luck":          { "type": "number" }
      }
    },

    "GiftBoxInfo": {
      "type": "object",
      "required": ["NewScrapValue", "GiftScrapValue", "GiftBoxAge", "Collected"],
      "properties": {
        "NewScrapValue":  { "type": "integer" },
        "GiftScrapValue": { "type": "integer" },
        "GiftBoxAge":     { "type": "integer" },
        "Collected":      { "type": "boolean" }
      }
    },

    "SpawnedItemInfo": {
      "type": "object",
      "required": ["Id", "Value", "ItemType", "SpawnPosition", "ScrapInsideGiftValue"],
      "properties": {
        "Id":                   { "type": "integer", "description": "Network object id, the same one MissedItems uses" },
        "Value":                { "type": "integer" },
        "ItemType":             { "type": "string" },
        "SpawnPosition":        { "$ref": "#/$defs/Position" },
        "ScrapInsideGiftValue": { "type": "integer" }
      }
    },

    "MissingItemInfo": {
      "type": "object",
      "required": ["Id", "Value", "ItemType", "SpawnPosition", "DespawnPosition", "CollectedOnPreviousDay", "ScrapInsideGiftValue"],
      "properties": {
        "Id":                     { "type": "integer", "description": "Network object id" },
        "Value":                  { "type": "integer" },
        "ItemType":               { "type": "string" },
        "SpawnPosition":          { "oneOf": [{ "$ref": "#/$defs/Position" }, { "type": "null" }] },
        "DespawnPosition":        { "$ref": "#/$defs/Position" },
        "CollectedOnPreviousDay": { "type": "boolean" },
        "ScrapInsideGiftValue":   { "type": "integer" }
      }
    }
  }
}
```
