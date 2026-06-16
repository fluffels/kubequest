/* Tests fürs Off-screen-Culling & die FPS-Messung (#82).
 *
 * Geprüft werden die harten Garantien des puren Culling-Kerns: erweitertes
 * Sichtfeld, Sichtbar-Toggle, korrekte Sichtbar-Zählung – inklusive Grenz-/
 * Negativfällen (Kante, leere Liste, pausierter Tab) und Red-Green-Schutz
 * (ein Objekt weit draußen MUSS ausgeblendet werden, sonst cullt nichts). */
import { test, expect } from "vitest";
import { expandRect, inView, cull, FrameSampler, type Cullable, type Rect } from "../src/cull";

const view: Rect = { x: 100, y: 100, width: 200, height: 120 };

/* ---------- expandRect ---------- */

test("expandRect wächst um margin nach allen Seiten", () => {
  const r = expandRect(view, 16);
  expect(r).toEqual({ x: 84, y: 84, width: 232, height: 152 });
});

test("expandRect mit margin 0 lässt das Rechteck unverändert", () => {
  expect(expandRect(view, 0)).toEqual(view);
});

/* ---------- inView ---------- */

test("inView: Punkt mittig drin ist sichtbar, Punkt weit weg nicht", () => {
  expect(inView(150, 150, view)).toBe(true);
  expect(inView(5000, 5000, view)).toBe(false);
  expect(inView(-50, 150, view)).toBe(false);
});

test("inView: Kanten zählen als drin (inklusive)", () => {
  expect(inView(100, 100, view)).toBe(true);           // obere linke Ecke
  expect(inView(300, 220, view)).toBe(true);           // untere rechte Ecke (x+w, y+h)
  expect(inView(99.9, 150, view)).toBe(false);         // knapp links daneben
  expect(inView(300.1, 150, view)).toBe(false);        // knapp rechts daneben
});

test("inView: der Rand aus expandRect rettet knapp-draußen-Objekte (Pop-in-Schutz)", () => {
  // 20px links der linken Kante -> ohne Rand draußen, mit 32px-Rand sichtbar.
  expect(inView(80, 150, view)).toBe(false);
  expect(inView(80, 150, expandRect(view, 32))).toBe(true);
});

/* ---------- cull ---------- */

function mk(x: number, y: number, visible = true): Cullable {
  return { x, y, obj: { visible } };
}

test("cull blendet Draußen aus, Drinnen ein – und zählt die Sichtbaren", () => {
  const items = [mk(150, 150), mk(290, 200), mk(-100, 150), mk(150, 9999)];
  const visible = cull(items, view);
  expect(visible).toBe(2);
  expect(items.map((i) => i.obj.visible)).toEqual([true, true, false, false]);
});

test("cull schaltet bereits ausgeblendete Objekte wieder sichtbar, wenn sie hereinscrollen", () => {
  // Red-Green-Schutz: Würde cull nur ein-Weg ausblenden (visible nie zurück auf
  // true), bliebe dieses Objekt für immer unsichtbar.
  const it = mk(150, 150, false);
  expect(cull([it], view)).toBe(1);
  expect(it.obj.visible).toBe(true);
});

test("cull: ein Objekt weit draußen MUSS ausgeblendet werden (Red-Green)", () => {
  const it = mk(10000, 10000, true);
  expect(cull([it], view)).toBe(0);
  expect(it.obj.visible).toBe(false);
});

test("cull auf leerer Liste liefert 0 und wirft nicht", () => {
  expect(cull([], view)).toBe(0);
});

/* ---------- FrameSampler ---------- */

test("FrameSampler: konstante 16.67ms-Frames ergeben ~60 FPS", () => {
  const s = new FrameSampler(10);
  for (let i = 0; i < 10; i++) s.push(1000 / 60);
  expect(s.fps).toBe(60);
  expect(s.frames).toBe(10);
});

test("FrameSampler: 50ms-Frames ergeben ~20 FPS", () => {
  const s = new FrameSampler();
  for (let i = 0; i < 30; i++) s.push(50);
  expect(s.fps).toBe(20);
});

test("FrameSampler hält nur die letzten `size` Frames (gleitendes Fenster)", () => {
  const s = new FrameSampler(5);
  for (let i = 0; i < 4; i++) s.push(50);   // 20 FPS …
  for (let i = 0; i < 5; i++) s.push(1000 / 60); // … dann 5x 60 FPS, verdrängt die alten
  expect(s.frames).toBe(5);
  expect(s.fps).toBe(60);
});

test("FrameSampler ohne Frames meldet 0 FPS (kein NaN/Division durch 0)", () => {
  expect(new FrameSampler().fps).toBe(0);
});

test("FrameSampler ignoriert nicht-positive Deltas (pausierter Tab, erster Frame)", () => {
  const s = new FrameSampler();
  s.push(0);
  s.push(-5);
  expect(s.frames).toBe(0);
  expect(s.fps).toBe(0);
  s.push(1000 / 60);
  expect(s.fps).toBe(60);
});
