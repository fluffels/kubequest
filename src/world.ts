/* ===== Welt-Geometrie (Phaser-frei, pur testbar) =====
 * Liegt bewusst NICHT in scenes.ts: scenes.ts zieht beim Import Phaser (greift
 * auf window/document zu) und läuft daher nicht im Node-Test. Diese reine Mathe
 * – Kachelraster, NPC-Standplätze, Solid-Kacheln – wird von scenes.ts genutzt
 * und in test/world.test.ts direkt abgetestet.
 */

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
  theme: "office" | "forge" | "chart";
  npc: string;
}

export const DOORS: Door[] = [
  { id: "hafenmeisterei", tx: 26, ty: 12, title: "Hafenmeisterei", theme: "office", npc: "ole" },
  { id: "werft",          tx: 10, ty: 10, title: "Werft",          theme: "forge",  npc: "runa" },
  { id: "kartenhaus",     tx: 40, ty: 11, title: "Kartenhaus",     theme: "chart",  npc: "ada" },
];

/** Tür auf der Kachel unter (px,py) (Pixel-Koordinaten, gefloort wie isSolidAt),
 *  oder null. Damit erkennt scenes.ts in der Update-Schleife das Betreten. */
export function doorAt(px: number, py: number): Door | null {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  return DOORS.find((d) => d.tx === tx && d.ty === ty) || null;
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
