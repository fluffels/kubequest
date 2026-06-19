/* Tests für die Entity-Registry (#349): datengesteuerte NPC-Platzierung als JSON.
 * Prüft die geladenen ECHTEN Daten (Vollständigkeit, referenzielle Integrität, exakte
 * Standplätze, Verdrahtung der Szenen/Geometrie) UND das Schema-Verhalten von
 * parseEntities bei KAPUTTEN Eingaben – die Validierung muss explizit werfen, nie
 * still durchwinken (Red-Green: ein gültiger Datensatz wird ausdrücklich akzeptiert).
 * Ausführen mit:  npm test
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  ENTITY_NPCS,
  parseEntities,
  npcSpawnsForMap,
  npcSpawnForMap,
} from "../src/content/entities";
import { NPCS, ContentValidationError } from "../src/content/loader";
import { NPC_SPAWNS } from "../src/world";
import { ARCHIPEL_NPC } from "../src/archipel";
import { LIGHTHOUSE_NPC } from "../src/lighthouse";
import { WAREHOUSE_NPC } from "../src/warehouse";

/* ---------- Echte Daten: vollständig, integer & korrekt platziert ---------- */

test("entities: jeder Eintrag referenziert einen bekannten NPC (referenzielle Integrität)", () => {
  assert.ok(ENTITY_NPCS.length > 0, "Registry ist leer");
  for (const e of ENTITY_NPCS) {
    assert.ok(e.id in NPCS, `Standplatz „${e.id}" auf „${e.map}" zeigt auf keinen NPC in npcs.json`);
    assert.ok(e.map.trim().length > 0, `Standplatz „${e.id}": leere Karte`);
    assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y), `Standplatz „${e.id}": x/y keine Zahl`);
  }
});

test("entities: jeder NPC (außer der schiff-relativen Kralle) hat genau einen Standplatz", () => {
  // Stardew-Scope-Wächter: ein NPC in npcs.json, der nirgends platziert ist, würde
  // im Spiel stumm fehlen. Kralle ist die bewusste Ausnahme (Standplatz schiff-relativ
  // in world.ts SHIP_KRALLE, erst zur Laufzeit ergänzt – kein Registry-Eintrag).
  for (const id of Object.keys(NPCS)) {
    if (id === "kralle") {
      assert.equal(ENTITY_NPCS.filter((e) => e.id === id).length, 0, "Kralle darf NICHT in der Registry stehen");
      continue;
    }
    assert.equal(
      ENTITY_NPCS.filter((e) => e.id === id).length,
      1,
      `NPC „${id}" muss genau einen Registry-Standplatz haben`,
    );
  }
});

test("entities: Hafen liefert die erwarteten 7 NPCs in load-bearing Reihenfolge", () => {
  // Diese Reihenfolge/Koordinaten serialisiert harbormap.ts verlustfrei in harbor.tmj –
  // ändert sie sich, brechen harbormap-/world-Tests. Bewusst exakt festgenagelt.
  assert.deepEqual(npcSpawnsForMap("harbor"), [
    { id: "ole", x: 26, y: 14.6 },
    { id: "bo", x: 8, y: 25 },
    { id: "ada", x: 40, y: 13.6 },
    { id: "runa", x: 13, y: 13 },
    { id: "theo", x: 44, y: 20.6 },
    { id: "pelle", x: 31, y: 17.2 },
    { id: "juno", x: 45.8, y: 24.2 },
  ]);
});

test("entities: world.NPC_SPAWNS ist genau die Hafen-Registry (abgeleitet, nicht doppelt)", () => {
  assert.deepEqual([...NPC_SPAWNS], npcSpawnsForMap("harbor"));
});

test("entities: Insel-NPCs stehen an ihren reservierten Standplätzen", () => {
  assert.deepEqual(npcSpawnForMap("archipel"), { id: "argo", x: 12, y: 8 });
  assert.deepEqual(npcSpawnForMap("lighthouse"), { id: "lumi", x: 11, y: 9 });
  assert.deepEqual(npcSpawnForMap("warehouse"), { id: "knut", x: 12, y: 8 });
});

test("entities: die Geometrie-Konstanten der Szenen kommen aus der Registry (Verdrahtung)", () => {
  // archipel.ts/lighthouse.ts/warehouse.ts leiten ihre NPC-Konstante aus der Registry ab.
  assert.deepEqual(ARCHIPEL_NPC, npcSpawnForMap("archipel"));
  assert.deepEqual(LIGHTHOUSE_NPC, npcSpawnForMap("lighthouse"));
  assert.deepEqual(WAREHOUSE_NPC, npcSpawnForMap("warehouse"));
});

test("entities: npcSpawnsForMap liefert [] für eine Karte ohne NPCs (kein Wurf)", () => {
  assert.deepEqual(npcSpawnsForMap("gibt-es-nicht"), []);
});

test("entities: npcSpawnForMap wirft laut bei unbekannter Karte (Tippfehler fällt auf)", () => {
  assert.throws(() => npcSpawnForMap("habor"), ContentValidationError);
});

/* ---------- Schema-Verhalten: KAPUTTE Eingaben müssen werfen (Red-Green) ---------- */

const OK = { npcs: [{ id: "ole", map: "harbor", x: 1, y: 2 }] };

test("parseEntities: akzeptiert einen gültigen Datensatz (Gegenprobe gegen False Positives)", () => {
  // Beweist, dass die Negativtests unten NICHT trivial immer werfen: gute Daten gehen durch.
  assert.deepEqual(parseEntities(OK), [{ id: "ole", map: "harbor", x: 1, y: 2 }]);
  // Brüche/0 sind erlaubte Koordinaten (kein asInt!).
  assert.deepEqual(parseEntities({ npcs: [{ id: "ole", map: "harbor", x: 0, y: 14.6 }] }), [
    { id: "ole", map: "harbor", x: 0, y: 14.6 },
  ]);
});

test("parseEntities: wirft bei Nicht-Objekt / fehlendem npcs-Array", () => {
  assert.throws(() => parseEntities(null), ContentValidationError);
  assert.throws(() => parseEntities([]), ContentValidationError);
  assert.throws(() => parseEntities({}), ContentValidationError);
  assert.throws(() => parseEntities({ npcs: {} }), ContentValidationError);
});

test("parseEntities: wirft bei leerem npcs-Array", () => {
  assert.throws(() => parseEntities({ npcs: [] }), ContentValidationError);
});

test("parseEntities: wirft bei fehlender/leerer id oder Karte", () => {
  assert.throws(() => parseEntities({ npcs: [{ map: "harbor", x: 1, y: 2 }] }), ContentValidationError);
  assert.throws(() => parseEntities({ npcs: [{ id: "", map: "harbor", x: 1, y: 2 }] }), ContentValidationError);
  assert.throws(() => parseEntities({ npcs: [{ id: "ole", map: "", x: 1, y: 2 }] }), ContentValidationError);
});

test("parseEntities: wirft bei unbekannter NPC-id (nicht in npcs.json)", () => {
  assert.throws(() => parseEntities({ npcs: [{ id: "niemand", map: "harbor", x: 1, y: 2 }] }), ContentValidationError);
});

test("parseEntities: wirft bei fehlender/ungültiger Koordinate (NaN/Infinity/String)", () => {
  assert.throws(() => parseEntities({ npcs: [{ id: "ole", map: "harbor", y: 2 }] }), ContentValidationError);
  assert.throws(() => parseEntities({ npcs: [{ id: "ole", map: "harbor", x: "1", y: 2 }] }), ContentValidationError);
  assert.throws(() => parseEntities({ npcs: [{ id: "ole", map: "harbor", x: NaN, y: 2 }] }), ContentValidationError);
  assert.throws(() => parseEntities({ npcs: [{ id: "ole", map: "harbor", x: Infinity, y: 2 }] }), ContentValidationError);
});

test("parseEntities: wirft bei doppeltem Standplatz (gleiche Karte + id)", () => {
  assert.throws(
    () => parseEntities({ npcs: [
      { id: "ole", map: "harbor", x: 1, y: 2 },
      { id: "ole", map: "harbor", x: 3, y: 4 },
    ] }),
    ContentValidationError,
  );
  // Gleiche id auf VERSCHIEDENEN Karten ist erlaubt (derselbe NPC kann woanders auftreten).
  assert.doesNotThrow(() => parseEntities({ npcs: [
    { id: "ole", map: "harbor", x: 1, y: 2 },
    { id: "ole", map: "archipel", x: 3, y: 4 },
  ] }));
});
