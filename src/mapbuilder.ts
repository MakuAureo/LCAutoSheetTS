import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { OverlayOptions } from "sharp";
import { MAP_TILES_DIR } from "./config.ts";
import type { Stats } from "./dataschema.ts";

// Tile floors closer than this (world units) are drawn on the same map floor
const FLOOR_GAP = 2;
// An item can rest slightly below its floor's height
const ITEM_FLOOR_MARGIN = 1;
// Same line the game uses for what's outside when it locks doors
const OUTSIDE_ABOVE_HEIGHT = -160;

interface VersionImages {
  tiles: { [interior: string]: string };
  moons: { default: string; [moon: string]: string };
}

// Which rip's images a game version uses, it's the newest version in the list that isn't above it
function imagesForVersion(version: number): VersionImages {
  const versions: { [version: string]: VersionImages } = JSON.parse(readFileSync(path.join(MAP_TILES_DIR, "versions.json"), "utf8"));
  const known = Object.keys(versions).map(Number).sort((a, b) => a - b);
  return versions[known.findLast((v) => v <= version) ?? known[0]];
}

interface TileManifest {
  size: [number, number];
  pixelsPerUnit: number;
  pivot: [number, number];
  floors: { file: string; height: number }[];
  doorways: { pos: [number, number]; floor: number }[];
  overlays: { [key: string]: { file: string; floor: number } };
}

interface Placement {
  file: string;
  quarterTurns: number;
  left: number;
  top: number;
  height: number;
  isOverlay: boolean;
  pixelsPerUnit: number;
}

export interface MapFloor {
  url: string;
  width: number;
  height: number;
  // Height in the world of a floor of the dungeon, null on the moon's map
  worldHeight: number | null;
  // 0 is the main entrance's floor, below it they go negative. Null on the moon's map
  number: number | null;
  outside: boolean;
}

interface MoonMap {
  floor: number;
  width: number;
  height: number;
  pixelsPerUnit: number;
  originX: number;
  originY: number;
}

export interface MapOutsideObject {
  name: string;
  floor: number;
  x: number;
  y: number;
}

export interface MapRemovedTree {
  floor: number;
  x: number;
  y: number;
}

export interface MapEntrance {
  main: boolean;
  floor: number;
  x: number;
  y: number;
  // Center of the tile it's in
  tileX: number;
  tileY: number;
}

// Stairs of a tile with several floors, as seen from one of those floors
export interface MapFloorLink {
  floor: number;
  x: number;
  y: number;
  up: number | null;
  down: number | null;
}

export interface MapItem {
  id: number;
  name: string;
  value: number;
  fromPreviousDay: boolean;
  floor: number;
  x: number;
  y: number;
}

export interface MapSpawnedItem {
  id: number;
  name: string;
  value: number;
  floor: number;
  x: number;
  y: number;
}

export interface MapEnemy {
  id: number;
  name: string;
  spawnTime: string;
  timeOfDeath: string;
  floor: number;
  x: number;
  y: number;
}

export interface MapDoor {
  startedLocked: boolean;
  unlockTime: string;
  floor: number;
  x: number;
  y: number;
}

export interface MapBigDoor {
  code: string;
  startedOpen: boolean;
  floor: number;
  x: number;
  y: number;
}

export interface MapHazard {
  kind: string;
  code: string;
  floor: number;
  x: number;
  y: number;
}

// What changes from one day to the next on the same dungeon
interface MapDayInfo {
  items: MapItem[];
  spawnedItems: MapSpawnedItem[];
  spawnedEnemies: MapEnemy[];
  endedEnemies: MapEnemy[];
  doors: MapDoor[];
  bigDoors: MapBigDoor[];
  hazards: MapHazard[];
  outsideEntrances: MapEntrance[];
  outsideObjects: MapOutsideObject[];
  removedTrees: MapRemovedTree[];
}

export interface MapInfo extends MapDayInfo {
  id: string;
  seed: number;
  moon: string;
  interior: string;
  width: number;
  height: number;
  originX: number;
  originY: number;
  pixelsPerUnit: number;
  floors: MapFloor[];
  moonMap: MoonMap | null;
  entrances: MapEntrance[];
  floorLinks: MapFloorLink[];
}

function mapId(stats: Stats): string {
  return `${stats.Version}_${stats.Seed}_${stats.MoonInfo.Name}_${stats.DungeonInfo.Interior}`.replace(/[^\w-]+/g, "-");
}

// Nothing goes to disk, only the current map is kept so a repeated dungeon doesn't get built again
let currentMap: { info: MapInfo; images: Map<string, Buffer> } | null = null;

export function getMapImage(id: string, file: string): Buffer | undefined {
  return currentMap?.info.id === id ? currentMap.images.get(file) : undefined;
}

// Where a world position is on the map, null if it's somewhere there's no map of
function placeOnMap(map: Omit<MapInfo, keyof MapDayInfo>, [worldX, worldY, worldZ]: number[]): { floor: number; x: number; y: number } | null {
  const outside = worldY > OUTSIDE_ABOVE_HEIGHT;
  if (outside && !map.moonMap) return null;

  const { pixelsPerUnit, originX, originY, width, height } = outside ? map.moonMap! : map;
  const x = worldX * pixelsPerUnit - originX;
  const y = -worldZ * pixelsPerUnit - originY;
  if (x < 0 || y < 0 || x > width || y > height) return null;
  if (outside) return { floor: map.moonMap!.floor, x, y };

  const floor = map.floors.findLastIndex((f) => !f.outside && f.worldHeight! - ITEM_FLOOR_MARGIN <= worldY);
  return { floor: Math.max(floor, 0), x, y };
}

function placeDayInfo(stats: Stats, map: Omit<MapInfo, keyof MapDayInfo>): MapDayInfo {
  const placeAll = <From extends { Position: number[] }, To>(list: From[] | undefined, convert: (from: From) => To) =>
    (list ?? []).flatMap((from) => {
      const spot = placeOnMap(map, from.Position);
      return spot ? [{ ...convert(from), ...spot }] : [];
    });

  const enemies = [...(stats.IndoorSpawns ?? []), ...(stats.DayTimeSpawns ?? []), ...(stats.NightTimeSpawns ?? [])];
  const enemyInfo = (enemy: Stats["IndoorSpawns"][number]) => ({
    id: enemy.Id,
    name: enemy.Enemy,
    spawnTime: enemy.SpawnTime,
    timeOfDeath: enemy.TimeOfDeath
  });

  return {
    spawnedEnemies: placeAll(enemies.filter((enemy) => enemy.SpawnPosition).map((enemy) => ({ ...enemy, Position: enemy.SpawnPosition })), enemyInfo),
    endedEnemies: placeAll(enemies.flatMap((enemy) => (enemy.EndPosition ? [{ ...enemy, Position: enemy.EndPosition }] : [])), enemyInfo),
    items: placeAll(stats.MissedItems.map((item) => ({ ...item, Position: item.DespawnPosition })), (item) => ({
      id: item.Id,
      name: item.ItemType,
      value: item.Value,
      fromPreviousDay: item.CollectedOnPreviousDay
    })),
    spawnedItems: placeAll(stats.SpawnedItems?.map((item) => ({ ...item, Position: item.SpawnPosition })), (item) => ({
      id: item.Id,
      name: item.ItemType,
      value: item.Value
    })),
    doors: placeAll(stats.DungeonInfo.Doors, (door) => ({ startedLocked: door.StartedLocked, unlockTime: door.UnlockTime })),
    bigDoors: placeAll(stats.DungeonInfo.BigDoors, (door) => ({ code: door.Code, startedOpen: door.StartedOpen })),
    hazards: placeAll(stats.HazardInfo?.MapHazards, (hazard) => ({ kind: hazard.Kind, code: hazard.Code })),
    outsideEntrances: placeAll(stats.MoonInfo.Entrances, (entrance) => ({ main: entrance.Main })).map((entrance) => ({ ...entrance, tileX: entrance.x, tileY: entrance.y })),
    outsideObjects: placeAll(stats.MoonInfo.OutsideObjects, (object) => ({ name: object.Name })),
    removedTrees: placeAll(stats.MoonInfo.RemovedTrees?.map((tree) => ({ Position: tree })), () => ({}))
  };
}

// The render of a moon, moons go by their name without the number
function loadMoon(stats: Stats): { info: { file: string; size: [number, number]; pixelsPerUnit: number; originX: number; originY: number }; image: Buffer } | null {
  const name = stats.MoonInfo.Name.replace(/^[\d-]+\s*/, "");
  const { moons } = imagesForVersion(stats.Version);
  const folder = path.join(MAP_TILES_DIR, "moons", moons[name] ?? moons.default);
  const file = path.join(folder, `${name}.json`);
  if (!existsSync(file)) return null;
  const info = JSON.parse(readFileSync(file, "utf8"));
  return { info, image: readFileSync(path.join(folder, info.file)) };
}

export function hasMapData(stats: Stats): boolean {
  return Array.isArray(stats.DungeonInfo?.DungeonMap?.Tiles) && stats.DungeonInfo.DungeonMap.Tiles.length > 0;
}

// Where a pixel of a tile's image ends up once the image is turned
function turnPixel(manifest: TileManifest, quarterTurns: number, [x, y]: number[]): number[] {
  const [w, h] = manifest.size;
  return [[x, y], [h - y, x], [w - x, h - y], [y, w - x]][quarterTurns];
}

// Where an image goes so that its pivot lands on the tile's position. Images are turned clockwise, x right and y down
function place(file: string, manifest: TileManifest, position: number[], yaw: number, height: number, isOverlay: boolean): Placement {
  // Doorways sit on a grid, so tiles only ever face one of 4 ways
  const quarterTurns = ((Math.round(yaw / 90) % 4) + 4) % 4;
  const [pivotX, pivotY] = turnPixel(manifest, quarterTurns, manifest.pivot);

  return {
    file,
    quarterTurns,
    left: Math.round(position[0] * manifest.pixelsPerUnit - pivotX),
    top: Math.round(-position[2] * manifest.pixelsPerUnit - pivotY),
    height,
    isOverlay,
    pixelsPerUnit: manifest.pixelsPerUnit
  };
}

// Heights of every tile floor, grouped into the floors of the map, lowest first
function groupFloors(heights: number[]): number[][] {
  const floors: number[][] = [];
  for (const height of [...heights].sort((a, b) => a - b)) {
    const floor = floors[floors.length - 1];
    if (floor && height - floor[0] < FLOOR_GAP) floor.push(height);
    else floors.push([height]);
  }
  return floors;
}

interface PlacedEntrance {
  main: boolean;
  position: number[];
  tileFloors: number[];
  tileX: number;
  tileY: number;
}

// Entrances can be far from the floor they lead to (the mineshaft's elevator), so it's the closest floor of their own tile
function entranceFloorHeight(entrance: PlacedEntrance): number {
  return entrance.tileFloors.findLast((h) => h - ITEM_FLOOR_MARGIN <= entrance.position[1]) ?? entrance.tileFloors[0];
}

interface PlacedFloorLink {
  height: number;
  up: number | null;
  down: number | null;
  x: number;
  y: number;
}

function placeTiles(stats: Stats): { placements: Placement[]; entrances: PlacedEntrance[]; floorLinks: PlacedFloorLink[] } {
  // Interiors with no images, like modded ones, get no tiles
  const tilesRip = imagesForVersion(stats.Version).tiles[stats.DungeonInfo.Interior] ?? "none";
  const tilesFolder = path.join(MAP_TILES_DIR, "tiles", tilesRip);
  const manifests = new Map<string, TileManifest | null>();
  const placements: Placement[] = [];
  const entrances: PlacedEntrance[] = [];
  const floorLinks: PlacedFloorLink[] = [];

  for (const tile of stats.DungeonInfo.DungeonMap.Tiles) {
    const tileDir = path.join(tilesFolder, tile.Name);
    if (!manifests.has(tile.Name)) {
      const file = path.join(tileDir, "manifest.json");
      if (!existsSync(file)) console.warn(`Map: no images for tile ${tile.Name} in ${tilesFolder}`);
      manifests.set(tile.Name, existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null);
    }
    const manifest = manifests.get(tile.Name);
    if (!manifest) continue;

    const heightOf = (floor: number) => tile.Position[1] + manifest.floors[floor].height;

    manifest.floors.forEach((floor, i) => {
      placements.push(place(path.join(tileDir, floor.file), manifest, tile.Position, tile.Yaw, heightOf(i), false));
    });
    for (const key of tile.Overlays) {
      // Keys with no entry have nothing to draw
      const overlay = manifest.overlays[key];
      if (overlay) placements.push(place(path.join(tileDir, overlay.file), manifest, tile.Position, tile.Yaw, heightOf(overlay.floor), true));
    }
    const { left, top, quarterTurns } = place("", manifest, tile.Position, tile.Yaw, 0, false);
    const [tileWidth, tileHeight] = quarterTurns % 2 === 0 ? manifest.size : [manifest.size[1], manifest.size[0]];
    if (manifest.floors.length > 1) {
      // Same spot on every floor, the middle of the tile's doorways is more likely to be walkable than the middle of its image
      const doors = manifest.doorways.map((door) => turnPixel(manifest, quarterTurns, door.pos));
      const average = (axis: number) => doors.reduce((sum, door) => sum + door[axis], 0) / doors.length;
      const x = doors.length > 0 ? left + average(0) : left + tileWidth / 2;
      const y = doors.length > 0 ? top + average(1) : top + tileHeight / 2;
      manifest.floors.forEach((_, i) => {
        floorLinks.push({
          height: heightOf(i),
          up: i + 1 < manifest.floors.length ? heightOf(i + 1) : null,
          down: i > 0 ? heightOf(i - 1) : null,
          x,
          y
        });
      });
    }
    for (const entrance of tile.Entrances ?? []) {
      entrances.push({
        main: entrance.Main,
        position: entrance.Position,
        tileFloors: manifest.floors.map((_, i) => heightOf(i)),
        tileX: left + tileWidth / 2,
        tileY: top + tileHeight / 2
      });
    }
  }
  return { placements, entrances, floorLinks };
}

// Builds the images of a day's map, or reuses the current ones if it's the same dungeon. What's on it can change, so that's always redone
export async function buildMap(stats: Stats): Promise<MapInfo> {
  const id = mapId(stats);
  if (currentMap?.info.id === id) {
    currentMap.info = { ...currentMap.info, ...placeDayInfo(stats, currentMap.info) };
    return currentMap.info;
  }

  const { placements, entrances, floorLinks } = placeTiles(stats);
  if (placements.length === 0) throw new Error("no tile of this map has images");

  const tileImages = new Map<string, Promise<Buffer>>();
  const imageOf = (p: Placement): Promise<Buffer> => {
    const key = `${p.file}|${p.quarterTurns}`;
    if (!tileImages.has(key)) tileImages.set(key, sharp(p.file).rotate(p.quarterTurns * 90).png().toBuffer());
    return tileImages.get(key)!;
  };

  // Every floor gets the same canvas so they line up when switching between them
  const sizes = await Promise.all(placements.map(async (p) => {
    const { width, height } = await sharp(await imageOf(p)).metadata();
    return { width, height };
  }));
  const originX = Math.min(...placements.map((p) => p.left));
  const originY = Math.min(...placements.map((p) => p.top));
  const width = Math.max(...placements.map((p, i) => p.left + sizes[i].width)) - originX;
  const height = Math.max(...placements.map((p, i) => p.top + sizes[i].height)) - originY;
  const pixelsPerUnit = placements[0].pixelsPerUnit;

  const groups = groupFloors(placements.map((p) => p.height));
  const floorOf = (floorHeight: number) => groups.findIndex((group) => group.includes(floorHeight));

  const mapEntrances = entrances.map((entrance) => ({
    main: entrance.main,
    floor: floorOf(entranceFloorHeight(entrance)),
    x: entrance.position[0] * pixelsPerUnit - originX,
    y: -entrance.position[2] * pixelsPerUnit - originY,
    tileX: entrance.tileX - originX,
    tileY: entrance.tileY - originY
  }));
  // Without a main entrance (old exports) the lowest floor is 0
  const mainFloor = Math.max(mapEntrances.find((entrance) => entrance.main)?.floor ?? 0, 0);

  const images = new Map<string, Buffer>();
  const floors: MapFloor[] = [];
  for (const [i, group] of groups.entries()) {
    const heights = new Set(group);
    const onFloor = placements.filter((p) => heights.has(p.height));
    // Overlays can reach over neighbouring tiles, so all of the base goes down first
    const ordered = [...onFloor.filter((p) => !p.isOverlay), ...onFloor.filter((p) => p.isOverlay)];
    const layers: OverlayOptions[] = await Promise.all(ordered.map(async (p) => ({
      input: await imageOf(p),
      left: p.left - originX,
      top: p.top - originY
    })));

    const number = i - mainFloor;
    const file = `floor${number}.png`;
    images.set(file, await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite(layers)
      .png()
      .toBuffer());
    floors.push({ url: `/maps/${id}/${file}`, width, height, worldHeight: group[0], number, outside: false });
  }

  const moon = loadMoon(stats);
  let moonMap: MoonMap | null = null;
  if (moon) {
    images.set("outside.png", moon.image);
    const [moonWidth, moonHeight] = moon.info.size;
    moonMap = { floor: floors.length, width: moonWidth, height: moonHeight, pixelsPerUnit: moon.info.pixelsPerUnit, originX: moon.info.originX, originY: moon.info.originY };
    floors.push({ url: `/maps/${id}/outside.png`, width: moonWidth, height: moonHeight, worldHeight: null, number: null, outside: true });
  }

  const map = {
    id,
    seed: stats.Seed,
    moon: stats.MoonInfo.Name,
    interior: stats.DungeonInfo.Interior,
    width,
    height,
    originX,
    originY,
    pixelsPerUnit,
    floors,
    moonMap,
    entrances: mapEntrances,
    floorLinks: floorLinks.map((link) => ({
      floor: floorOf(link.height),
      x: link.x - originX,
      y: link.y - originY,
      up: link.up === null ? null : floorOf(link.up),
      down: link.down === null ? null : floorOf(link.down)
    }))
  };
  const info: MapInfo = { ...map, ...placeDayInfo(stats, map) };
  currentMap = { info, images };
  return info;
}
