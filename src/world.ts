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
