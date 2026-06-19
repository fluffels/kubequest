/* Architektur-/Schichtungs-Tests (#344).
 * Die Anwendungs-Schicht (game.ts) darf die Präsentations-Schicht (sfx.ts) NICHT
 * importieren. Audio-Settings laufen entkoppelt über den Laufzeit-Sink in runtime.ts.
 *
 * Dieser Guard wäre VOR dem Fix rot gewesen (game.ts hatte `import { SFX } from "./sfx"`)
 * und ist jetzt grün – ein dependency-cruiser-CI-Wächter kommt separat (#347).
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { AudioConfig } from "../src/types";
import { setAudioSink, applyAudioConfig } from "../src/runtime";

const gameSrc = readFileSync(fileURLToPath(new URL("../src/game.ts", import.meta.url)), "utf8");

test("game.ts (Anwendung) importiert sfx.ts (Präsentation) NICHT", () => {
  assert.ok(!/from\s+["']\.\/sfx["']/.test(gameSrc), "game.ts darf sfx nicht importieren (Schichtverletzung #344)");
  assert.ok(!/\bSFX\./.test(gameSrc), "game.ts darf das SFX-Objekt nicht direkt benutzen");
});

const cfg: AudioConfig = { music: true, sfx: true, musicVol: 0.5, sfxVol: 0.8, track: "hafen" };

test("applyAudioConfig leitet an den registrierten Sink (Präsentation registriert, Anwendung ruft)", () => {
  const seen: AudioConfig[] = [];
  setAudioSink((c) => seen.push(c));
  applyAudioConfig(cfg);
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0], cfg);
});

test("applyAudioConfig ist ohne registrierten Sink ein No-op (kein Wurf)", () => {
  setAudioSink(null);
  assert.doesNotThrow(() => applyAudioConfig(cfg));
});
