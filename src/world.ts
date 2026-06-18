/* ===== Welt-Geometrie (Phaser-frei, pur testbar) =====
 * Liegt bewusst NICHT in scenes.ts: scenes.ts zieht beim Import Phaser (greift
 * auf window/document zu) und läuft daher nicht im Node-Test. Diese reine Mathe
 * – Kachelraster, NPC-Standplätze, Solid-Kacheln – wird von scenes.ts genutzt
 * und in test/world.test.ts direkt abgetestet.
 */

import { type TiledObjectGroup, tiledProps } from "./tilemap";

/** Kachelgröße in Pixeln (muss zu T in scenes.ts passen). */
export const TILE = 16;

export interface Spawn { id: string; x: number; y: number }

/** Feste NPC-Standplätze (Kachel-Koordinaten). Kralle fehlt hier bewusst – die
 *  Quiz-Krabbe wird relativ zum Schiff platziert und erst zur Laufzeit ergänzt. */
export const NPC_SPAWNS: Spawn[] = [
  { id: "ole", x: 26, y: 14.6 },
  { id: "bo", x: 8, y: 25 },
  { id: "ada", x: 40, y: 13.6 },
  { id: "runa", x: 13, y: 13 },
  { id: "theo", x: 44, y: 20.6 },
  { id: "pelle", x: 31, y: 17.2 },
  { id: "juno", x: 45.8, y: 24.2 },
];

/** Reichweite, ab der mit einem NPC geredet werden kann (nearestNpc in scenes.ts). */
export const TALK_RANGE = 1.7 * TILE;

/* ===== Türen / betretbare Häuser (#6) =====
 * Jede Tür ist eine begehbare Kachel im vorderen Mittelbau eines Gebäudes
 * (die zugehörige Solid-Kachel wird in scenes.ts wieder freigeräumt). Läuft
 * der Spieler auf diese Kachel, startet die InteriorScene mit dem passenden
 * Innenraum. Koordinaten = unterste Reihe der jeweiligen Gebäude-Grundfläche,
 * mittig: house_office(23,10,w7)→(26,12), house_forge(8,8,w5)→(10,10),
 * house_chart(38,9,w5)→(40,11). */
export interface Door {
  id: string;
  tx: number;
  ty: number;
  title: string;
  /** Innenraum-Thema (office/forge/chart/ship …). Bewusst `string`, nicht mehr ein
   *  fest verdrahtetes Enum (#194): die Türen kommen jetzt aus dem Tiled-Objektlayer,
   *  das Thema ist eine Daten-Property. `INTERIORS` in scenes.ts ist über `string`
   *  geschlüsselt; unbekannte Themen fallen dort auf einen leeren Raum zurück. */
  theme: string;
  /** Bewohner-NPC (Deko-Figur im Innenraum). Beim Schiff die Quiz-Krabbe Kralle,
   *  die nicht in NPC_SPAWNS steht – darum optional. */
  npc?: string;
  /** Optionaler Karten-Warp (#194): Ziel-Map-ID aus der Registry. Ist `target`
   *  gesetzt, ist die Tür kein Innenraum, sondern ein Übergang zu einer anderen
   *  Karte – der Warp-Handler löst die Karte über die Registry auf und setzt den
   *  Spieler auf (targetX,targetY). Ohne `target` = Innenraum (theme). Die
   *  bestehenden Hafentüren sind alle Innenräume; das Feld trägt das künftige
   *  Map-zu-Map-Warpen (z.B. Archipel) über dieselbe Objektlayer-Datenform. */
  target?: string;
  targetX?: number;
  targetY?: number;
}

export const DOORS: Door[] = [
  { id: "hafenmeisterei", tx: 26, ty: 12, title: "Hafenmeisterei", theme: "office", npc: "ole" },
  { id: "werft",          tx: 10, ty: 10, title: "Werft",          theme: "forge",  npc: "runa" },
  { id: "kartenhaus",     tx: 40, ty: 11, title: "Kartenhaus",     theme: "chart",  npc: "ada" },
];

/* ===== Eigenes Schiff (#42) – betretbar mit Innenansicht =====
 * Single Source of Truth der Schiffs-Grundfläche (Kachel-Koordinaten); scenes.ts
 * baut sein this.ship daraus, damit Trigger-Luke und Rumpf nicht auseinanderdriften. */
export const SHIP = { x: 30, y: 29, w: 9, h: 6 } as const;

/** Companionway-Luke auf dem Deck: Trigger zum Betreten der Kajüte. Liegt mittig
 *  im Deck (begehbar), nicht am Steg-Rand – so triggert man bewusst beim Drüberlaufen.
 *  Bewusst NICHT in DOORS: das Schiff hängt nicht an einem NPC_SPAWN. */
export const SHIP_DOOR: Door = { id: "schiff", tx: 34, ty: 32, title: "Deine Kajüte", theme: "ship", npc: "kralle" };

/* ===== Schiff schwimmt im Wasser + Holz-Steg (#108) =====
 * Früher lag das ganze Schiff auf einem rechteckigen Holz-Deck mitten im Wasser –
 * ein Boot gehört aufs Wasser. Diese reine Geometrie sagt scenes.ts pro Kachel im
 * Schiffsbereich, was dort liegt: Wasser unterm Rumpf (Schiff schwimmt) bzw. eine
 * schmale Holzplanke als Steg/Anleger (Zugang aufs Deck). Phaser-frei und in
 * test/world.test.ts geprüft, damit Rumpf-Wasser und Steg nicht wieder zu einem
 * Holz-Rechteck verschmelzen. */

/** Steg/Anleger zum eigenen Schiff: schmale Holzplanke (2 Kacheln breit), die vom
 *  Land/Wasser bis aufs Deck reicht. y0 liegt VOR dem Rumpf (sichtbarer Steg im
 *  Wasser), y1 reicht bis aufs Deck (an die Kajüten-Luke heran). */
export const SHIP_PIER = { x: 33, w: 2, y0: 27, y1: 31 } as const;

export type ShipTile = "water" | "pier" | null;

/** Was liegt auf Kachel (x,y) im Schiffsbereich?
 *  - `"pier"`: begehbare Holzplanke (Steg/Anleger, Zugang aufs Deck).
 *  - `"water"`: Wasser unterm Rumpf bzw. rund ums Schiff – das Schiff schwimmt.
 *    Bewusst begehbar (solidGrid 0 in scenes.ts), weil das Schiff-Sprite das Deck
 *    abdeckt; so läuft man übers Deck zur Kajüten-Luke (SHIP_DOOR).
 *  - `null`: außerhalb von Schiff und Steg – hier entscheidet die normale Welt-Logik.
 *  Liefert NIE ein Holz-Deck-Rechteck unterm Rumpf zurück (das war Bug #108). */
export function shipTile(x: number, y: number): ShipTile {
  const onPier = x >= SHIP_PIER.x && x < SHIP_PIER.x + SHIP_PIER.w &&
                 y >= SHIP_PIER.y0 && y <= SHIP_PIER.y1;
  if (onPier) return "pier";
  const inHull = x >= SHIP.x && x < SHIP.x + SHIP.w &&
                 y >= SHIP.y && y < SHIP.y + SHIP.h;
  return inHull ? "water" : null;
}

/** Alle betretbaren Eingänge (Häuser + Schiff) als Code-Default. Dient zugleich
 *  als Quelle, aus der die Hafenkarte ihren Tiled-Objektlayer „Türen" serialisiert
 *  (harbormap.ts) – der Datenpfad liest sie von dort zurück (#194). */
export const ENTRANCES: Door[] = [...DOORS, SHIP_DOOR];

/** Tür/Luke auf der Kachel unter (px,py) in einer GEGEBENEN Tür-Liste (Pixel-
 *  Koordinaten, gefloort wie isSolidAt), oder null. Generisch (#194): der
 *  Datenpfad reicht die aus dem Objektlayer geparsten Türen herein, statt die
 *  Hardcode-Liste zu nutzen. */
export function findDoorAt(doors: readonly Door[], px: number, py: number): Door | null {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  return doors.find((d) => d.tx === tx && d.ty === ty) || null;
}

/** Wie findDoorAt, aber gegen die Code-Default-Eingänge (ENTRANCES). Behält die
 *  bisherige Aufrufform für den Nicht-Tiled-Pfad und die Tests bei. */
export function doorAt(px: number, py: number): Door | null {
  return findDoorAt(ENTRANCES, px, py);
}

/** Türen/Warps aus einem Tiled-Objektlayer lesen (#194). Jedes Objekt ist ein
 *  16×16-Rechteck auf einer Kachel; (x,y) sind Pixel der linken oberen Ecke, also
 *  Kachel = floor(px/TILE). Properties: `theme` (Innenraum), `title`, `npc` und –
 *  für künftige Map-Warps – `target`/`targetX`/`targetY`. So ersetzt der Objektlayer
 *  die Hardcode-Liste DOORS, ohne dass scenes.ts Türen kennt. */
export function doorsFromObjectGroup(group: TiledObjectGroup): Door[] {
  return group.objects.map((o) => {
    const p = tiledProps(o);
    const door: Door = {
      id: o.name,
      tx: Math.floor(o.x / TILE),
      ty: Math.floor(o.y / TILE),
      title: typeof p.title === "string" ? p.title : o.name,
      theme: typeof p.theme === "string" ? p.theme : "",
    };
    if (typeof p.npc === "string" && p.npc) door.npc = p.npc;
    if (typeof p.target === "string" && p.target) {
      door.target = p.target;
      if (typeof p.targetX === "number") door.targetX = p.targetX;
      if (typeof p.targetY === "number") door.targetY = p.targetY;
    }
    return door;
  });
}

/** NPC-Standplätze aus einem Tiled-Objektlayer lesen (#195). Jedes Objekt trägt die
 *  NPC-ID als `name`; (x,y) sind Pixel der linken oberen Ecke der Standplatz-Kachel.
 *  Anders als bei den Türen (doorsFromObjectGroup) werden die Koordinaten NICHT
 *  gefloort: NPCs stehen bewusst auf Bruch-Kachelpositionen (z.B. y 14.6), also ist
 *  die Kachelkoordinate px/TILE EXAKT (Multiplikation/Division mit der Zweierpotenz
 *  16 ist verlustfrei, der Round-Trip trifft NPC_SPAWNS punktgenau). So ersetzt der
 *  Objektlayer die Hardcode-Liste NPC_SPAWNS, ohne dass scenes.ts die Standplätze
 *  kennt. */
export function npcsFromObjectGroup(group: TiledObjectGroup): Spawn[] {
  return group.objects.map((o) => ({ id: o.name, x: o.x / TILE, y: o.y / TILE }));
}

/** Die Kachel, auf der ein NPC „steht" – passend zur Flooring-Logik von
 *  isSolidAt(). Der NPC-Mittelpunkt liegt bei (x*TILE+8 / y*TILE+8). */
export function npcTile(x: number, y: number): { tx: number; ty: number } {
  return { tx: Math.floor((x * TILE + 8) / TILE), ty: Math.floor((y * TILE + 8) / TILE) };
}

/** Grid-Indizes (ty*W+tx), die für die NPCs solide gesetzt werden – damit man
 *  nicht mehr durch sie hindurchläuft. Out-of-bounds wird herausgefiltert. */
export function npcSolidIndices(spawns: Spawn[], W: number, H: number): number[] {
  const out: number[] = [];
  for (const s of spawns) {
    const { tx, ty } = npcTile(s.x, s.y);
    if (tx >= 0 && ty >= 0 && tx < W && ty < H) out.push(ty * W + tx);
  }
  return out;
}

/** Solid-Abfrage in Pixel-Koordinaten (in scenes.ts ist das `isSolidAt`). */
export type SolidAt = (px: number, py: number) => boolean;

/** Kollisions-Footprint der Figur: vier Ecken um den Mittelpunkt – ±5 px breit,
 *  von 2 px über dem Mittelpunkt bis 5 px darunter (passend zum Sprite-Fuß).
 *  Identisch zur `probe`-Geometrie, die scenes.ts beim Laufen nutzt. */
export function footprintSolid(solidAt: SolidAt, x: number, y: number): boolean {
  return solidAt(x - 5, y - 2) || solidAt(x + 5, y - 2) ||
         solidAt(x - 5, y + 5) || solidAt(x + 5, y + 5);
}

/** Achsen-getrennte Bewegungsauflösung mit Anti-Wedge.
 *
 *  Normalfall: pro Achse nur verschieben, wenn der Ziel-Footprint frei ist – so
 *  läuft man nicht durch solide Kacheln oder NPCs hindurch (#31).
 *
 *  Sonderfall (#36): Steckt der *aktuelle* Footprint schon in einer soliden
 *  Kachel – etwa weil ein alter Spielstand auf einer erst nachträglich solide
 *  gewordenen NPC-Kachel gespeichert wurde – darf die Bewegung NICHT blockiert
 *  werden. Sonst wäre die Figur für immer eingemauert (dreht sich nur, läuft
 *  aber in keine Richtung). Dann jede Richtung erlauben, damit man sich wieder
 *  herausbewegen kann; sobald der Footprint frei ist, greift die normale
 *  Kollision von selbst wieder. */
export function resolveMove(
  solidAt: SolidAt, x: number, y: number, dx: number, dy: number,
): { x: number; y: number } {
  const stuck = footprintSolid(solidAt, x, y);
  if (stuck || !footprintSolid(solidAt, x + dx, y)) x += dx;
  if (stuck || !footprintSolid(solidAt, x, y + dy)) y += dy;
  return { x, y };
}
