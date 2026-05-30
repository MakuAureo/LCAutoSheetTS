interface MoonInfo {
  Name: string;
  Weather: string
}

interface DungeonInfo {
  Interior: string;
  ItemCount: number 
}

interface HazardInfo { 
  TurretCount: number;
  LandmineCount: number;
  SpiketrapCount: number
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
  Enemy: string;
  SpawnTime: string;
  TimeOfDeath: string;
}

interface FurnitureInfo {
  InStock: boolean;
  Owned: boolean;
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
  Value: number;
  ItemType: string;
  DespawnPosition: number[];
  CollectedOnPreviousDay: boolean;
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
  MissedItems: MissingItemInfo[];
}
