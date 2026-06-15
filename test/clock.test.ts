/* Tests für die HUD-Uhr/-Datums-Ableitung (#39).
 *
 * Kern: aus der laufenden Spielzeit + Zykluslänge eine Uhrzeit (HH:MM) und ein
 * Stardew-Datum (Tag/Saison/Wochentag) ableiten – synchron zum Tag-Nacht-Schleier
 * (phase 0 = Mittag, 0.5 = Mitternacht). Geprüft werden die Eckpunkte des Zyklus,
 * der Tageswechsel exakt um Mitternacht, Saison-/Wochentags-Rollover sowie
 * harte Invarianten und ein Red-Green-Schutz gegen eine konstante Ausgabe. */
import { test, expect } from "vitest";
import { gameClock } from "../src/clock";

const CYCLE = 1440000; // wie in scenes.ts: 24 min realer Zeit = ein Spieltag

/* ---------- Uhrzeit-Eckpunkte (phase → HH:MM) ---------- */

test("Spielstart (phase 0) ist Mittag 12:00 an Tag 1", () => {
  const c = gameClock(0, CYCLE);
  expect(c.hhmm).toBe("12:00");
  expect(c.day).toBe(1);
});

test("phase 0.5 ist Mitternacht 00:00", () => {
  expect(gameClock(0.5 * CYCLE, CYCLE).hhmm).toBe("00:00");
});

test("phase 0.25 ist 18:00 (Abend), phase 0.75 ist 06:00 (Morgen)", () => {
  expect(gameClock(0.25 * CYCLE, CYCLE).hhmm).toBe("18:00");
  expect(gameClock(0.75 * CYCLE, CYCLE).hhmm).toBe("06:00");
});

/* ---------- Tageswechsel exakt um Mitternacht ---------- */

test("Tag erhöht sich genau bei Mitternacht (phase 0.5), nicht davor", () => {
  expect(gameClock(0.5 * CYCLE - 1, CYCLE).day).toBe(1); // kurz vor Mitternacht
  expect(gameClock(0.5 * CYCLE, CYCLE).day).toBe(2);     // Mitternacht
  expect(gameClock(1.5 * CYCLE, CYCLE).day).toBe(3);     // nächste Mitternacht
});

/* ---------- Stardew-Datum: Saison & Wochentag ---------- */

test("Tag 1 ist 🌱 Frühling, Montag, dayOfSeason 1", () => {
  const c = gameClock(0, CYCLE);
  expect(c.seasonName).toBe("Frühling");
  expect(c.weekday).toBe("Mo");
  expect(c.dayOfSeason).toBe(1);
  expect(c.dateLabel).toBe("🌱 Mo, Tag 1");
});

test("Saison wechselt nach 28 Tagen, Wochentag rolliert nach 7 Tagen", () => {
  const day29 = gameClock(28 * CYCLE, CYCLE); // day = floor(28+0.5)+1 = 29
  expect(day29.day).toBe(29);
  expect(day29.seasonName).toBe("Sommer");
  expect(day29.dayOfSeason).toBe(1);
  // Tag 8 hat wieder Wochentag "Mo" ((8-1) % 7 === 0)
  expect(gameClock(7 * CYCLE, CYCLE).weekday).toBe("Mo");
});

/* ---------- Invarianten über den ganzen Zyklus ---------- */

test("hhmm ist über den ganzen Zyklus eine gültige Zeit in 10-Min-Schritten", () => {
  for (let i = 0; i < 288; i++) { // alle 5 min abtasten
    const c = gameClock((i / 288) * CYCLE, CYCLE);
    expect(c.hhmm).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
    const [, mm] = c.hhmm.split(":").map(Number);
    expect(mm % 10).toBe(0); // auf 10-Min-Schritte gerundet
  }
});

/* ---------- Red-Green-Schutz ---------- */

test("verschiedene Zeitpunkte liefern verschiedene Uhrzeiten (keine Konstante)", () => {
  const morgen = gameClock(0.7 * CYCLE, CYCLE).hhmm;
  const abend = gameClock(0.3 * CYCLE, CYCLE).hhmm;
  expect(morgen).not.toBe(abend);
});
