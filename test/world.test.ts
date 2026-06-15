/* Regressionstests für #31: NPCs sollen solide sein (man läuft nicht mehr durch
 * sie hindurch), müssen aber weiterhin ansprechbar bleiben.
 *
 * scenes.ts ist Phaser-gekoppelt und nicht im Node-Lauf importierbar; getestet
 * wird daher die pure Geometrie aus src/world.ts, die scenes.ts beim Spawn nutzt.
 * Bewusst auch Grenz-/Negativfälle: out-of-bounds, doppelte Kacheln, Erreichbarkeit.
 */
import { test, expect } from "vitest";
import { NPC_SPAWNS, TILE, TALK_RANGE, npcTile, npcSolidIndices, footprintSolid, resolveMove } from "../src/world";

const W = 52, H = 40; // wie WorldScene.create()

/** Baut ein `solidAt(px,py)` aus den NPC-Solid-Kacheln – wie isSolidAt() in
 *  scenes.ts: Pixel → Kachel flooren, im Grid nachsehen. */
function npcSolidAt() {
  const grid = new Uint8Array(W * H);
  for (const i of npcSolidIndices(NPC_SPAWNS, W, H)) grid[i] = 1;
  return (px: number, py: number) => {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;
    return grid[ty * W + tx] === 1;
  };
}

test("npcTile floored wie isSolidAt: Mittelpunkt x*T+8 / y*T+8", () => {
  // 26 -> floor(26.5)=26 ; 14.6 -> floor(15.1)=15
  expect(npcTile(26, 14.6)).toEqual({ tx: 26, ty: 15 });
  // 45.8 -> floor(46.3)=46 ; 24.2 -> floor(24.7)=24
  expect(npcTile(45.8, 24.2)).toEqual({ tx: 46, ty: 24 });
  // ganze Zahl: 8 -> floor(8.5)=8
  expect(npcTile(8, 25)).toEqual({ tx: 8, ty: 25 });
});

test("jeder NPC bekommt genau eine Solid-Kachel (Bug: gar keine)", () => {
  const idx = npcSolidIndices(NPC_SPAWNS, W, H);
  expect(idx).toHaveLength(NPC_SPAWNS.length);
  expect(idx.every(i => i >= 0 && i < W * H)).toBe(true);
});

test("Solid-Kacheln machen den Spieler im Grid wirklich blockiert", () => {
  const grid = new Uint8Array(W * H);
  for (const i of npcSolidIndices(NPC_SPAWNS, W, H)) grid[i] = 1;
  for (const s of NPC_SPAWNS) {
    const { tx, ty } = npcTile(s.x, s.y);
    expect(grid[ty * W + tx]).toBe(1); // genau hier läuft man jetzt nicht mehr durch
  }
});

test("keine zwei NPCs teilen sich dieselbe Solid-Kachel", () => {
  const idx = npcSolidIndices(NPC_SPAWNS, W, H);
  expect(new Set(idx).size).toBe(idx.length);
});

test("trotz Blockade bleibt jeder NPC ansprechbar (freie Nachbarkachel in Reichweite)", () => {
  const blocked = new Set(npcSolidIndices(NPC_SPAWNS, W, H));
  for (const s of NPC_SPAWNS) {
    const { tx, ty } = npcTile(s.x, s.y);
    const cx = s.x * TILE + 8, cy = s.y * TILE + 8; // NPC-Mittelpunkt (wie nearestNpc)
    const neighbours = [[tx + 1, ty], [tx - 1, ty], [tx, ty + 1], [tx, ty - 1]];
    const reachable = neighbours.some(([nx, ny]) => {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) return false;
      if (blocked.has(ny * W + nx)) return false; // selbst kein NPC
      const dist = Math.hypot(nx * TILE + 8 - cx, ny * TILE + 8 - cy);
      return dist < TALK_RANGE; // nah genug zum Reden
    });
    expect(reachable, `NPC ${s.id} muss von einer freien Nachbarkachel ansprechbar bleiben`).toBe(true);
  }
});

test("out-of-bounds-NPC erzeugt keine Solid-Kachel", () => {
  expect(npcSolidIndices([{ id: "x", x: -5, y: 3 }], W, H)).toEqual([]);
  expect(npcSolidIndices([{ id: "x", x: 3, y: 999 }], W, H)).toEqual([]);
});

/* ===== #36: Anti-Wedge – Figur darf nicht dauerhaft festklemmen ===== */

test("footprintSolid erkennt eine solide Kachel direkt unter der Figur", () => {
  const solidAt = npcSolidAt();
  // Ole: Solid-Kachel (26,15) → Mittelpunkt 26*16+8 / 15*16+8 = 424 / 248
  expect(footprintSolid(solidAt, 424, 248)).toBe(true);
  // Freie Fläche weit weg von jedem NPC
  expect(footprintSolid(solidAt, 8, 8)).toBe(false);
});

test("#36-Repro: steckt der Footprint in einer Solid-Kachel, muss man herauskommen", () => {
  const solidAt = npcSolidAt();
  // Spielstand mitten auf Oles jetzt-solider Kachel (alter Save vor #31)
  const x0 = 424, y0 = 248;
  expect(footprintSolid(solidAt, x0, y0)).toBe(true); // Vorbedingung: festgesteckt
  // Nach links drücken: ohne Anti-Wedge bliebe x unverändert (eingemauert)
  const moved = resolveMove(solidAt, x0, y0, -1.25, 0);
  expect(moved.x).toBeLessThan(x0); // bewegt sich tatsächlich vom Fleck
  // Wer wiederholt nach links läuft, erreicht freie Kacheln und steckt dann nicht mehr
  let p = { x: x0, y: y0 };
  for (let i = 0; i < 40; i++) p = resolveMove(solidAt, p.x, p.y, -1.25, 0);
  expect(footprintSolid(solidAt, p.x, p.y)).toBe(false);
});

test("normale Kollision bleibt: aus dem Freien NICHT in eine Solid-Kachel laufen", () => {
  const solidAt = npcSolidAt();
  // Direkt rechts neben Oles Solid-Kachel (26,15), Footprint frei
  const x0 = (27 * TILE) + 8, y0 = (15 * TILE) + 8; // 440 / 248
  expect(footprintSolid(solidAt, x0, y0)).toBe(false); // Vorbedingung: frei
  // Schritt nach links Richtung Ole muss geblockt werden (man läuft nicht durch NPCs, #31)
  const blocked = resolveMove(solidAt, x0, y0, -8, 0);
  expect(blocked.x).toBe(x0); // keine Bewegung in die solide Kachel
});

test("Achsen-Trennung: an einer Wand blockierte Achse lässt die andere frei gleiten", () => {
  const solidAt = npcSolidAt();
  const x0 = (27 * TILE) + 8, y0 = (15 * TILE) + 8; // frei, links liegt Ole
  // Diagonal nach links-unten: X blockiert (Ole), Y muss trotzdem durchgehen
  const moved = resolveMove(solidAt, x0, y0, -8, 6);
  expect(moved.x).toBe(x0);          // X bleibt (Wand)
  expect(moved.y).toBe(y0 + 6);      // Y gleitet
});
