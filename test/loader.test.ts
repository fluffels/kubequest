/* Tests für den Content-as-Data-Loader (#348): NPCs + Smalltalk als JSON.
 * Prüft sowohl die geladenen ECHTEN Daten (Vollständigkeit, referenzielle
 * Integrität) als auch das Schema-Verhalten der Parser bei KAPUTTEN Eingaben –
 * die Validierung muss explizit fehlschlagen (werfen), nie still durchwinken.
 * Ausführen mit:  npm test
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  NPCS,
  SMALLTALK,
  parseNpcs,
  parseSmalltalk,
  ContentValidationError,
} from "../src/content/loader";

/* ---------- Echte Daten: vollständig & konsistent geladen ---------- */

test("loader: NPCS lädt alle erwarteten NPCs mit vollständigen Feldern", () => {
  // Die zugereisten NPCs (argo/lumi/knut) müssen erhalten bleiben – Szenen
  // (archipel/lighthouse/warehouse) hängen an genau diesen Schlüsseln.
  for (const id of ["ole", "bo", "ada", "runa", "theo", "pelle", "kralle", "juno", "argo", "lumi", "knut"]) {
    const npc = NPCS[id];
    assert.ok(npc, `NPC „${id}" fehlt nach dem Laden`);
    assert.equal(typeof npc.name, "string");
    assert.ok(npc.name.trim().length > 0, `NPC „${id}": leerer Name`);
    assert.equal(typeof npc.title, "string");
    assert.ok(Number.isInteger(npc.sprite), `NPC „${id}": sprite keine Ganzzahl`);
    assert.ok(npc.tex.startsWith("char_"), `NPC „${id}": tex-Key unerwartet`);
  }
  // Stichprobe gegen versehentliche Daten-Verschiebung beim JSON-Umzug.
  assert.equal(NPCS.argo.tex, "char_argos");
  assert.equal(NPCS.kralle.name, "Krabbe Kralle");
  assert.equal(NPCS.knut.sprite, 100);
});

test("loader: SMALLTALK lädt nicht-leere Zeilen, jeder Schlüssel ist ein bekannter NPC", () => {
  assert.ok(Array.isArray(SMALLTALK.bo) && SMALLTALK.bo.length > 0, "bo ohne Smalltalk");
  for (const [id, lines] of Object.entries(SMALLTALK)) {
    assert.ok(NPCS[id], `Smalltalk für unbekannten NPC „${id}"`);
    assert.ok(lines.length > 0, `Smalltalk „${id}": keine Zeilen`);
    for (const line of lines) assert.ok(line.trim().length > 0, `Smalltalk „${id}": leere Zeile`);
  }
});

/* ---------- parseNpcs: gültige Daten ---------- */

test("parseNpcs: akzeptiert wohlgeformte Daten", () => {
  const ok = parseNpcs({ x: { name: "X", title: "Titel", sprite: 7, tex: "char_x" } });
  assert.equal(ok.x.sprite, 7);
  assert.equal(ok.x.name, "X");
});

/* ---------- parseNpcs: kaputte Daten MÜSSEN explizit werfen (Negativfälle) ----------
 * Diese Tests sind die Red-Green-Absicherung: Würde der Loader eine dieser
 * Prüfungen weglassen, bliebe der jeweilige Test rot. Geprüft wird zusätzlich,
 * dass die Fehlermeldung den konkreten Feld-PFAD nennt (nicht nur „ungültig"). */

test("parseNpcs: wirft bei Nicht-Objekt", () => {
  assert.throws(() => parseNpcs([]), ContentValidationError);
  assert.throws(() => parseNpcs(null), ContentValidationError);
  assert.throws(() => parseNpcs("nope"), ContentValidationError);
});

test("parseNpcs: wirft bei leerem Katalog", () => {
  assert.throws(() => parseNpcs({}), ContentValidationError);
});

test("parseNpcs: wirft bei fehlendem Pflichtfeld (mit Pfad)", () => {
  assert.throws(
    () => parseNpcs({ ole: { title: "T", sprite: 1, tex: "char_o" } }),
    (e: unknown) => e instanceof ContentValidationError && /npcs\.ole\.name/.test(e.message),
  );
});

test("parseNpcs: wirft bei leerem Namen", () => {
  assert.throws(
    () => parseNpcs({ ole: { name: "   ", title: "T", sprite: 1, tex: "char_o" } }),
    ContentValidationError,
  );
});

test("parseNpcs: wirft bei sprite ohne Ganzzahl (String oder Float)", () => {
  assert.throws(
    () => parseNpcs({ ole: { name: "Ole", title: "T", sprite: "100", tex: "char_o" } }),
    (e: unknown) => e instanceof ContentValidationError && /npcs\.ole\.sprite/.test(e.message),
  );
  assert.throws(
    () => parseNpcs({ ole: { name: "Ole", title: "T", sprite: 1.5, tex: "char_o" } }),
    ContentValidationError,
  );
});

/* ---------- parseSmalltalk: kaputte Daten MÜSSEN explizit werfen ---------- */

const known = new Set(["ole", "bo"]);

test("parseSmalltalk: wirft bei unbekanntem NPC-Schlüssel (mit Pfad)", () => {
  assert.throws(
    () => parseSmalltalk({ gibtsnicht: ["hi"] }, known),
    (e: unknown) => e instanceof ContentValidationError && /smalltalk\.gibtsnicht/.test(e.message),
  );
});

test("parseSmalltalk: wirft bei leerer Zeilen-Liste", () => {
  assert.throws(() => parseSmalltalk({ ole: [] }, known), ContentValidationError);
});

test("parseSmalltalk: wirft bei nicht-textueller Zeile", () => {
  assert.throws(
    () => parseSmalltalk({ ole: ["ok", 123] }, known),
    (e: unknown) => e instanceof ContentValidationError && /smalltalk\.ole\[1\]/.test(e.message),
  );
});

test("parseSmalltalk: akzeptiert wohlgeformte Daten", () => {
  const ok = parseSmalltalk({ ole: ["Zeile eins", "Zeile zwei"] }, known);
  assert.equal(ok.ole.length, 2);
});
