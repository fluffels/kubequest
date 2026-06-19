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
  QUESTS,
  parseNpcs,
  parseSmalltalk,
  parseQuests,
  assembleQuests,
  ContentValidationError,
} from "../src/content/loader";
import type { Quest } from "../src/types";

/** Minimal-Quest für die Assembler-Tests (Inhalt egal, nur id/giver zählen). */
const mkQuest = (id: string): Quest => ({ id, title: id, giver: "ole", rewardXp: 0, rewardCoins: 0, steps: [] });

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

/* ---------- Quests: echte Daten korrekt in Laufzeit-Form geladen ---------- */

test("loader: QUESTS geladen, accept als RegExp, check als Funktion (Laufzeit-Form)", () => {
  assert.ok(QUESTS.length > 0, "keine Quests geladen");
  let sawAccept = false;
  let sawCheck = false;
  for (const quest of QUESTS) {
    assert.ok(quest.id.length > 0);
    for (const step of quest.steps) {
      const tasks =
        step.type === "teach" ? [step.cmd] : step.type === "terminal" ? step.tasks : [];
      for (const t of tasks) {
        // accept muss zu echten RegExp kompiliert sein (nicht mehr String).
        assert.ok(Array.isArray(t.accept) && t.accept.length > 0, `${quest.id}/${t.id}: kein accept`);
        for (const re of t.accept) {
          assert.ok(re instanceof RegExp, `${quest.id}/${t.id}: accept kein RegExp`);
          sawAccept = true;
        }
        // check (falls vorhanden) muss zur Funktion aufgelöst sein (nicht mehr Key-String).
        if (t.check !== undefined) {
          assert.equal(typeof t.check, "function", `${quest.id}/${t.id}: check keine Funktion`);
          sawCheck = true;
        }
      }
    }
  }
  assert.ok(sawAccept, "kein einziger accept-RegExp – Revival hat nichts getan?");
  assert.ok(sawCheck, "kein einziger aufgelöster check – Revival hat nichts getan?");
});

/* ---------- parseQuests: gültige Daten ---------- */

const minimalQuest = {
  id: "qx",
  title: "Test",
  giver: "ole",
  rewardXp: 10,
  rewardCoins: 5,
  steps: [
    { type: "dialog", npc: "ole", lines: ["Hallo"] },
    { type: "teach", brief: "B", cmd: { id: "t-x", intro: "I", text: "T", accept: ["^x$"], solution: "x", hint: "H", check: "qx/t-x" } },
  ],
};

test("parseQuests: akzeptiert wohlgeformte Quest ohne check", () => {
  const q = parseQuests([{ ...minimalQuest, steps: [{ type: "dialog", npc: "ole", lines: ["Hi"] }] }]);
  assert.equal(q.length, 1);
  assert.equal(q[0].steps[0].type, "dialog");
});

/* ---------- parseQuests: kaputte Daten MÜSSEN explizit werfen ---------- */

test("parseQuests: wirft bei Nicht-Array", () => {
  assert.throws(() => parseQuests({}), ContentValidationError);
});

test("parseQuests: wirft bei unbekanntem Schritt-Typ (mit Pfad)", () => {
  assert.throws(
    () => parseQuests([{ ...minimalQuest, steps: [{ type: "zauberei", npc: "ole", lines: ["x"] }] }]),
    (e: unknown) => e instanceof ContentValidationError && /steps\[0\]\.type/.test((e as Error).message),
  );
});

test("parseQuests: wirft bei leerem accept-Array", () => {
  assert.throws(
    () => parseQuests([{ ...minimalQuest, steps: [{ type: "teach", brief: "B", cmd: { id: "t", intro: "I", text: "T", accept: [], solution: "x", hint: "H" } }] }]),
    ContentValidationError,
  );
});

test("parseQuests: wirft bei ungültigem RegExp-Pattern (mit Pfad)", () => {
  assert.throws(
    () => parseQuests([{ ...minimalQuest, steps: [{ type: "teach", brief: "B", cmd: { id: "t", intro: "I", text: "T", accept: ["("], solution: "x", hint: "H" } }] }]),
    (e: unknown) => e instanceof ContentValidationError && /accept\[0\]/.test((e as Error).message),
  );
});

test("parseQuests: wirft bei unbekanntem check-Key (mit Pfad)", () => {
  assert.throws(
    () => parseQuests([{ ...minimalQuest, steps: [{ type: "teach", brief: "B", cmd: { id: "t", intro: "I", text: "T", accept: ["^x$"], solution: "x", hint: "H", check: "gibtsnicht/nie" } }] }]),
    (e: unknown) => e instanceof ContentValidationError && /check/.test((e as Error).message),
  );
});

test("parseQuests: wirft bei dialog-Schritt ohne Zeilen", () => {
  assert.throws(
    () => parseQuests([{ ...minimalQuest, steps: [{ type: "dialog", npc: "ole", lines: [] }] }]),
    ContentValidationError,
  );
});

test("parseQuests: wirft bei choice ohne wohlgeformte Optionen", () => {
  assert.throws(
    () => parseQuests([{ ...minimalQuest, steps: [{ type: "choice", npc: "ole", q: "?", options: [{ t: "A", ok: "ja", reply: "R" }] }] }]),
    ContentValidationError,
  );
});

/* ---------- assembleQuests: Regionen + explizite Reihenfolge zusammenführen ---------- */

test("assembleQuests: ordnet nach order-Liste, NICHT nach Regionen-Reihenfolge", () => {
  // Regionen liefern q3,q1 / q2,q0 – die order erzwingt q0..q3.
  const regions = [[mkQuest("q3"), mkQuest("q1")], [mkQuest("q2"), mkQuest("q0")]];
  const out = assembleQuests(regions, ["q0", "q1", "q2", "q3"]);
  assert.deepEqual(out.map((q) => q.id), ["q0", "q1", "q2", "q3"]);
});

test("assembleQuests: wirft bei doppelter Quest-ID über Regionen hinweg", () => {
  assert.throws(
    () => assembleQuests([[mkQuest("q1")], [mkQuest("q1")]], ["q1"]),
    (e: unknown) => e instanceof ContentValidationError && /doppelte Quest-ID/.test((e as Error).message),
  );
});

test("assembleQuests: wirft bei order-Eintrag ohne passende Quest (Tippfehler)", () => {
  assert.throws(
    () => assembleQuests([[mkQuest("q1")]], ["q1", "q-tippfehler"]),
    (e: unknown) => e instanceof ContentValidationError && /q-tippfehler/.test((e as Error).message),
  );
});

test("assembleQuests: wirft, wenn eine Quest nicht in der order steht (unerreichbar)", () => {
  assert.throws(
    () => assembleQuests([[mkQuest("q1"), mkQuest("q2")]], ["q1"]),
    (e: unknown) => e instanceof ContentValidationError && /q2.*fehlt in quest-order/.test((e as Error).message),
  );
});

test("assembleQuests: wirft bei doppeltem Eintrag in der order", () => {
  assert.throws(
    () => assembleQuests([[mkQuest("q1")]], ["q1", "q1"]),
    ContentValidationError,
  );
});

test("loader: echte QUESTS sind eindeutig und beginnen mit q0 (Reihenfolge erhalten)", () => {
  assert.equal(QUESTS.length, new Set(QUESTS.map((q) => q.id)).size, "doppelte Quest-IDs geladen");
  assert.equal(QUESTS[0].id, "q0", "erste Quest sollte q0 sein (order-Reihenfolge)");
});
