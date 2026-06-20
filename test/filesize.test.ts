/* Dateigröße-Wächter (#390) – Frühwarnung gegen neue God-Files.
 *
 * Große Module sind bei Stardew-Scope teuer: Agenten lesen pro Änderung viel mehr
 * Kontext (Tokens), und je größer eine Datei, desto leichter schleichen sich
 * Regressionen ein (Befund: WorldScene.ts 1344, kubectl.ts 1220). Dieser Test ist
 * das Gate im `npm test`-CI; dieselbe Logik gibt es als CLI `npm run check:size`.
 *
 * Die Mess-/Allowlist-Logik wird aus scripts/check-size.mjs importiert (EINE Quelle
 * der Wahrheit – kein Auseinanderdriften zwischen Test und CLI).
 *
 * Ausführen mit:  npm test   (oder gezielt: npm run check:size)
 */
import { describe, test } from "vitest";
import assert from "node:assert/strict";

// Reines Node-Tooling-Skript ohne Declaration-File (allowJs ist aus, scripts/ nicht im
// tsconfig-include) – der Laufzeit-Import genügt, die Typen deklarieren wir hier lokal.
// @ts-expect-error: kein .d.ts für das .mjs-Tooling-Skript.
import * as checkSize from "../scripts/check-size.mjs";

type Sized = { file: string; loc: number };
type Allow = { file: string; reason: string };

const LOC_BUDGET: number = checkSize.LOC_BUDGET;
const ALLOWLIST: Allow[] = checkSize.ALLOWLIST;
const collectSizes: (rootDir?: string) => Sized[] = checkSize.collectSizes;
const findOversized: (sizes: Sized[], budget?: number) => Sized[] = checkSize.findOversized;
const countLines: (text: string) => number = checkSize.countLines;

const sizes = collectSizes();
const allowedFiles = new Set(ALLOWLIST.map((a) => a.file));

describe("Dateigröße-Budget (#390)", () => {
  test(`kein src-Modul über ${LOC_BUDGET} LOC (außer dokumentierten Ausnahmen)`, () => {
    const violations = findOversized(sizes, LOC_BUDGET).filter((s) => !allowedFiles.has(s.file));
    assert.deepEqual(
      violations,
      [],
      `Module über dem ${LOC_BUDGET}-LOC-Budget ohne Allowlist-Eintrag:\n` +
        violations.map((v) => `  ${v.file}: ${v.loc}`).join("\n") +
        `\nAufteilen (siehe #392/#393) oder – mit offenem Split-Ticket – in scripts/check-size.mjs allowlisten.`,
    );
  });

  test("Allowlist ist ehrlich: jeder Eintrag liegt wirklich noch über Budget (sonst stale)", () => {
    // Sobald ein Split (#393/#397) eine Datei unter Budget bringt, wird der Eintrag stale
    // und dieser Test bricht – das erinnert daran, die Ausnahme wieder zu entfernen.
    const bySize = new Map(sizes.map((s) => [s.file, s.loc]));
    const stale = ALLOWLIST.filter((a) => {
      const loc = bySize.get(a.file);
      return loc === undefined || loc <= LOC_BUDGET;
    });
    assert.deepEqual(
      stale,
      [],
      `Stale Allowlist-Einträge (Datei nicht mehr über Budget oder nicht mehr vorhanden) – ` +
        `aus scripts/check-size.mjs entfernen:\n` +
        stale.map((a) => `  ${a.file}`).join("\n"),
    );
  });

  test("Detektion greift wirklich (Red-Green): mehr Budget ergibt nie mehr Treffer", () => {
    // No-op-Schutz: ein Wächter, der immer grün ist, wäre wertlos. Bei kleinem Budget
    // MÜSSEN Treffer kommen, bei unerreichbar großem KEINE – und monoton dazwischen.
    const small = findOversized(sizes, 50).length;
    const mid = findOversized(sizes, 500).length;
    const huge = findOversized(sizes, 100000).length;
    assert.ok(small > 0, "Budget 50 sollte Treffer liefern – sonst misst der Wächter nicht.");
    assert.ok(small >= mid && mid >= huge, "Höheres Budget darf nie MEHR Treffer ergeben.");
    assert.equal(huge, 0, "Budget 100000 sollte in der heutigen Codebasis nichts melden.");
  });

  test("countLines zählt physische Zeilen wie wc -l", () => {
    assert.equal(countLines("a\nb\nc\n"), 3, "trailing newline darf nicht doppelt zählen");
    assert.equal(countLines("a\nb\nc"), 3, "ohne trailing newline gleich viele Zeilen");
    assert.equal(countLines(""), 0, "leere Datei = 0 Zeilen");
    assert.equal(countLines("a\r\nb\r\n"), 2, "CRLF wird wie LF gezählt");
  });
});
