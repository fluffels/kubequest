/* ===== Tiled-Tilemap-Grundgerüst (Phaser-frei, pur testbar) =====
 * Teil 1 der Tiled-Map-Migration (#191, Epic #57). Hier liegt NUR die reine
 * Logik rund um Tiled-JSON (.tmj): Typen, Validierung, Kollisions-Extraktion und
 * das Mapping Tileset → Asset-Schlüssel. Das eigentliche Phaser-Rendering
 * (`make.tilemap`/`createLayer`) lebt in scenes.ts (TilemapTestScene) – diese
 * Datei kommt bewusst ohne Phaser aus (wie world.ts/decor.ts) und wird in
 * test/tilemap.test.ts direkt im Node-Test geprüft.
 *
 * Bewusst minimal: Teil 1 deckt orthogonale Maps mit eingebetteten Tilesets und
 * Tile-Layern ab (Boden + Kollision). Object-Layer (Türen/NPC-Spawns, #194/#195)
 * und externe Tileset-Dateien kommen erst in späteren Teilen dazu.
 */

/** Ein im .tmj eingebettetes Tileset. Die Pixelmaße/Spalten brauchen wir, damit
 *  Phaser die globalen Tile-IDs (gid) korrekt auf Frames des Tileset-Bilds
 *  abbildet; `name` ist der Schlüssel fürs Mapping auf das ASSET_MANIFEST. */
export interface TiledTileset {
  firstgid: number;
  name: string;
  image: string;
  imagewidth: number;
  imageheight: number;
  tilewidth: number;
  tileheight: number;
  tilecount: number;
  columns: number;
}

/** Ein Tile-Layer: `data` ist row-major (y*width + x); 0 = leere Kachel, sonst
 *  global tile id (gid = firstgid des Tilesets + lokalem Frame-Index). */
export interface TiledTileLayer {
  id: number;
  name: string;
  type: "tilelayer";
  width: number;
  height: number;
  data: number[];
  visible: boolean;
  opacity: number;
}

/** Die für Teil 1 relevante Teilmenge einer Tiled-Map (orthogonal, Tile-Layer). */
export interface TiledMap {
  type: "map";
  orientation: "orthogonal";
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  tilesets: TiledTileset[];
  layers: TiledTileLayer[];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function posInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

/** Validiert und typisiert rohes Tiled-JSON. Wirft mit klarer Meldung, sobald
 *  etwas fehlt oder nicht zur Erwartung passt – ein still falsch geladenes
 *  Layout (falsche Maße, fehlender Layer) wäre sonst erst im Browser sichtbar.
 *  Gibt dasselbe Objekt typisiert zurück (kann direkt an Phaser weitergereicht
 *  werden). */
export function parseTiledMap(raw: unknown): TiledMap {
  if (!isObj(raw)) throw new Error("Tiled-Map: kein JSON-Objekt");
  if (raw.type !== "map") throw new Error(`Tiled-Map: type muss "map" sein, ist "${String(raw.type)}"`);
  if (raw.orientation !== "orthogonal") {
    throw new Error(`Tiled-Map: orientation muss "orthogonal" sein, ist "${String(raw.orientation)}" (Teil 1 unterstützt nur orthogonale Maps)`);
  }
  if (!posInt(raw.width) || !posInt(raw.height)) throw new Error("Tiled-Map: width/height müssen positive Ganzzahlen sein");
  if (!posInt(raw.tilewidth) || !posInt(raw.tileheight)) throw new Error("Tiled-Map: tilewidth/tileheight müssen positive Ganzzahlen sein");

  if (!Array.isArray(raw.tilesets) || raw.tilesets.length === 0) throw new Error("Tiled-Map: mindestens ein Tileset erwartet");
  const tilesets = raw.tilesets.map((t, i) => parseTileset(t, i));

  if (!Array.isArray(raw.layers) || raw.layers.length === 0) throw new Error("Tiled-Map: mindestens ein Layer erwartet");
  const layers = raw.layers.map((l, i) => parseLayer(l, i, raw.width as number, raw.height as number));

  return {
    type: "map",
    orientation: "orthogonal",
    width: raw.width,
    height: raw.height,
    tilewidth: raw.tilewidth,
    tileheight: raw.tileheight,
    tilesets,
    layers,
  };
}

function parseTileset(raw: unknown, i: number): TiledTileset {
  if (!isObj(raw)) throw new Error(`Tiled-Map: Tileset #${i} ist kein Objekt`);
  if (typeof raw.name !== "string" || raw.name.length === 0) throw new Error(`Tiled-Map: Tileset #${i} braucht einen name`);
  if (typeof raw.image !== "string") throw new Error(`Tiled-Map: Tileset "${raw.name}" braucht ein image (externe Tilesets sind in Teil 1 nicht unterstützt)`);
  if (!posInt(raw.firstgid)) throw new Error(`Tiled-Map: Tileset "${raw.name}" braucht eine positive firstgid`);
  if (!posInt(raw.columns) || !posInt(raw.tilecount)) throw new Error(`Tiled-Map: Tileset "${raw.name}" braucht positive columns/tilecount`);
  if (!posInt(raw.imagewidth) || !posInt(raw.imageheight)) throw new Error(`Tiled-Map: Tileset "${raw.name}" braucht positive imagewidth/imageheight`);
  if (!posInt(raw.tilewidth) || !posInt(raw.tileheight)) throw new Error(`Tiled-Map: Tileset "${raw.name}" braucht positive tilewidth/tileheight`);
  return {
    firstgid: raw.firstgid,
    name: raw.name,
    image: raw.image,
    imagewidth: raw.imagewidth,
    imageheight: raw.imageheight,
    tilewidth: raw.tilewidth,
    tileheight: raw.tileheight,
    tilecount: raw.tilecount,
    columns: raw.columns,
  };
}

function parseLayer(raw: unknown, i: number, mapW: number, mapH: number): TiledTileLayer {
  if (!isObj(raw)) throw new Error(`Tiled-Map: Layer #${i} ist kein Objekt`);
  if (raw.type !== "tilelayer") throw new Error(`Tiled-Map: Layer "${String(raw.name)}" hat type "${String(raw.type)}" – Teil 1 unterstützt nur "tilelayer"`);
  if (typeof raw.name !== "string" || raw.name.length === 0) throw new Error(`Tiled-Map: Layer #${i} braucht einen name`);
  if (raw.width !== mapW || raw.height !== mapH) {
    throw new Error(`Tiled-Map: Layer "${raw.name}" (${String(raw.width)}×${String(raw.height)}) passt nicht zur Map-Größe (${mapW}×${mapH})`);
  }
  if (!Array.isArray(raw.data)) throw new Error(`Tiled-Map: Layer "${raw.name}" braucht ein data-Array`);
  if (raw.data.length !== mapW * mapH) {
    throw new Error(`Tiled-Map: Layer "${raw.name}" hat ${raw.data.length} Kacheln, erwartet ${mapW * mapH}`);
  }
  for (const gid of raw.data) {
    if (typeof gid !== "number" || !Number.isInteger(gid) || gid < 0) {
      throw new Error(`Tiled-Map: Layer "${raw.name}" enthält eine ungültige gid (${String(gid)}) – erwartet Ganzzahl ≥ 0`);
    }
  }
  return {
    id: typeof raw.id === "number" ? raw.id : i + 1,
    name: raw.name,
    type: "tilelayer",
    width: mapW,
    height: mapH,
    data: raw.data as number[],
    visible: raw.visible !== false,
    opacity: typeof raw.opacity === "number" ? raw.opacity : 1,
  };
}

/** Findet einen Tile-Layer per Name; wirft, wenn er fehlt. */
export function tileLayer(map: TiledMap, name: string): TiledTileLayer {
  const layer = map.layers.find((l) => l.name === name);
  if (!layer) throw new Error(`Tiled-Map: Layer "${name}" nicht gefunden (vorhanden: ${map.layers.map((l) => l.name).join(", ")})`);
  return layer;
}

/** Kollisionsraster aus einem benannten Layer: `true`, wo eine Kachel liegt
 *  (gid !== 0). Row-major (y*width + x) – dasselbe Layout wie `solidGrid` in
 *  scenes.ts/world.ts, damit die Bewegungslogik es direkt nutzen kann. */
export function collisionGrid(map: TiledMap, layerName: string): boolean[] {
  return tileLayer(map, layerName).data.map((gid) => gid !== 0);
}

/** Auflösung Tiled-Tileset → Asset-Schlüssel. Konvention: der Tileset-`name` im
 *  .tmj entspricht exakt einem Schlüssel im ASSET_MANIFEST (assets-data.ts). So
 *  weiß der Loader, welche bereits geladene Textur er per `addTilesetImage` an
 *  das Tileset hängt. Wirft, wenn ein Tileset keinen Manifest-Schlüssel trifft –
 *  sonst lüde Phaser ins Leere und die Map bliebe unsichtbar. */
export function resolveTilesets(
  map: TiledMap,
  manifestKeys: readonly string[],
): { tiledName: string; assetKey: string; firstgid: number }[] {
  return map.tilesets.map((ts) => {
    if (!manifestKeys.includes(ts.name)) {
      throw new Error(`Tiled-Map: Tileset "${ts.name}" hat keinen passenden Asset-Schlüssel im ASSET_MANIFEST – bekannte Schlüssel u.a.: ${manifestKeys.slice(0, 8).join(", ")}…`);
    }
    return { tiledName: ts.name, assetKey: ts.name, firstgid: ts.firstgid };
  });
}
