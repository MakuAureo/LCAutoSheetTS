interface DoorInfo {
  Position: number[];
  StartedLocked: boolean;
  UnlockTime: string;
}

interface BigDoorInfo {
  Position: number[];
  Code: string;
  StartedOpen: boolean;
}

interface MapHazardInfo {
  Kind: string;
  Position: number[];
  Code: string;
}

interface OutsideObjectInfo {
  Name: string;
  Position: number[];
  Yaw: number;
}

interface MoonInfo {
  Name: string;
  Weather: string;
  Entrances: DungeonEntrance[];
  OutsideObjects: OutsideObjectInfo[];
  RemovedTrees: number[][];
}

interface DungeonEntrance {
  Position: number[];
  Main: boolean
}

interface DungeonTile {
  Name: string;
  Position: number[];
  BoundsMin: number[];
  BoundsMax: number[];
  Yaw: number;
  Overlays: string[];
  Entrances: DungeonEntrance[]
}

interface DungeonEdge {
  From: number[];
  To: number[]
}

interface DungeonMap {
  Tiles: DungeonTile[];
  Edges: DungeonEdge[]
}

interface DungeonInfo {
  Interior: string;
  ItemCount: number;
  DungeonMap: DungeonMap;
  Doors: DoorInfo[];
  BigDoors: BigDoorInfo[]
}

interface HazardInfo { 
  TurretCount: number;
  LandmineCount: number;
  SpiketrapCount: number;
  MapHazards: MapHazardInfo[]
}

interface PerformanceInfo { 
  CollectedNoExtra: number;
  CollectedTotal: number;
  InitialAvailableValue: number;
  TotalAvailableValue: number;
  ExtraFromOldGift: number
}

interface SpecialItemInfo {
  Available: number[];
  Collected: number[];
}

interface QuotaInfo {
  ValueSold: number;
  NewQuota: number;
}

interface EventInfo {
  AppSpawned: boolean;
  IndoorFog: boolean;
  TakeOffTime: string;
  SIDType: string;
  InfestationType: string;
  MeteorShowerTime: string;
}

interface PlayerStats {
  Name: string;
  Alive: boolean;
  Disconnected: boolean;
  TimeOfDeath: string;
  CauseOfDeath: string;
}

interface SpawnInfo {
  Id: number;
  Enemy: string;
  SpawnTime: string;
  TimeOfDeath: string;
  SpawnPosition: number[];
  EndPosition: number[] | null;
}

interface FurnitureInfo {
  InStock: boolean;
  Owned: boolean;
  Stored: boolean;
  ApparentPrice: number;
  RealPrice: number;
  Luck: number;
}

interface GiftBoxInfo {
  NewScrapValue: number;
  GiftScrapValue: number;
  GiftBoxAge: number;
  Collected: boolean;
}

interface MissingItemInfo {
  Id: number;
  Value: number;
  ItemType: string;
  DespawnPosition: number[];
  CollectedOnPreviousDay: boolean;
  ScrapInsideGiftValue: number;
};

interface SpawnedItemInfo {
  Id: number;
  Value: number;
  ItemType: string;
  SpawnPosition: number[];
  ScrapInsideGiftValue: number;
};

export interface Stats {
  Seed: number;
  Version: number;
  MoonInfo: MoonInfo;
  DungeonInfo: DungeonInfo;
  HazardInfo: HazardInfo;
  PerformanceInfo: PerformanceInfo;
  BeeInfo: SpecialItemInfo;
  EggInfo: SpecialItemInfo;
  KnifeInfo: SpecialItemInfo;
  ShotgunInfo: SpecialItemInfo;
  QuotaInfo: QuotaInfo;
  EventInfo: EventInfo;
  Players: { [key: string]: PlayerStats };
  IndoorSpawns: SpawnInfo[];
  DayTimeSpawns: SpawnInfo[];
  NightTimeSpawns: SpawnInfo[];
  ShopSales: { [key: string]: number };
  FurnitureInfo: { [key: string]: FurnitureInfo };
  GiftBoxesOpened: GiftBoxInfo[];
  SpawnedItems: SpawnedItemInfo[];
  MissedItems: MissingItemInfo[];
}
