/* Regressionstests für #31: NPCs sollen solide sein (man läuft nicht mehr durch
 * sie hindurch), müssen aber weiterhin ansprechbar bleiben.
 *
 * scenes.ts ist Phaser-gekoppelt und nicht im Node-Lauf importierbar; getestet
 * wird daher die pure Geometrie aus src/world.ts, die scenes.ts beim Spawn nutzt.
 * Bewusst auch Grenz-/Negativfälle: out-of-bounds, doppelte Kacheln, Erreichbarkeit.
 */
import { test, expect } from "vitest";
import { NPC_SPAWNS, TILE, TALK_RANGE, npcTile, npcSolidIndices, DOORS, doorAt } from "../src/world";

const W = 52, H = 40; // wie WorldScene.create()

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

/* ===== Türen / betretbare Häuser (#6) ===== */

test("doorAt trifft die Tür-Kachel ab dem Mittelpunkt der Kachel", () => {
  for (const d of DOORS) {
    // Mittelpunkt der Tür-Kachel -> genau diese Tür
    expect(doorAt(d.tx * TILE + 8, d.ty * TILE + 8)).toEqual(d);
    // beliebiger Punkt innerhalb derselben Kachel zählt ebenfalls
    expect(doorAt(d.tx * TILE + 1, d.ty * TILE + 15)?.id).toBe(d.id);
  }
});

test("doorAt liefert null neben der Tür (Negativfall, kein versehentliches Betreten)", () => {
  for (const d of DOORS) {
    expect(doorAt((d.tx - 1) * TILE + 8, d.ty * TILE + 8)).toBeNull(); // eine Kachel links
    expect(doorAt(d.tx * TILE + 8, (d.ty + 1) * TILE + 8)).toBeNull(); // eine Kachel darunter (Anlaufpunkt)
  }
  expect(doorAt(0, 0)).toBeNull();
});

test("jede Tür-Kachel liegt im Grid und Türen sind eindeutig", () => {
  expect(DOORS).toHaveLength(3);
  for (const d of DOORS) {
    expect(d.tx >= 0 && d.tx < W && d.ty >= 0 && d.ty < H).toBe(true);
  }
  const keysOf = DOORS.map((d) => d.ty * W + d.tx);
  expect(new Set(keysOf).size).toBe(DOORS.length); // keine zwei Türen auf derselben Kachel
});

test("keine Tür-Kachel kollidiert mit einer NPC-Solid-Kachel (Tür muss begehbar bleiben)", () => {
  const blocked = new Set(npcSolidIndices(NPC_SPAWNS, W, H));
  for (const d of DOORS) {
    expect(blocked.has(d.ty * W + d.tx), `Tür ${d.id} darf nicht auf einer NPC-Kachel liegen`).toBe(false);
  }
});

test("jede Tür verweist auf einen existierenden NPC-Standort", () => {
  const ids = new Set(NPC_SPAWNS.map((s) => s.id));
  for (const d of DOORS) expect(ids.has(d.npc), `Tür ${d.id} -> NPC ${d.npc}`).toBe(true);
});
