/* ===== Entity-Registry: datengesteuerte NPC-Platzierung (Content-as-Data, #349) =====
 * Zweiter Baustein des Skalierungs-Fundaments aus ADR 0004
 * (docs/adr/0004-skalierungs-fundament.md, Abschnitt „Entities sind hard-codiert"):
 * WO ein NPC steht, lebt als **Daten** in `./data/entities.json`, nicht mehr als
 * hartcodiertes Array/Objekt im Code. Damit gilt für jede Karte: ein neuer NPC =
 * ein neuer JSON-Eintrag, KEIN Code-Edit. Genau das skaliert auf Stardew-Größe
 * (50+ NPCs über viele Welten), wo NPC-Standplätze wie im Map-Editor platziert
 * werden – nicht aus Geometrie-Konstanten gerechnet.
 *
 * **Trennung wer ↔ wo:** Die *Identität* eines NPC (Name, Titel, Sprite) steht in
 * `./data/npcs.json` (vom Loader `loader.ts` validiert). Diese Registry hier trägt
 * nur die *Platzierung* (welche Karte, welche Kachel) und referenziert die Identität
 * per `id`. Der Validator unten prüft referenzielle Integrität: jede `id` muss ein
 * bekannter NPC aus npcs.json sein (fängt Tippfehler, bevor ein NPC stumm fehlt).
 *
 * **Bewusste Ausnahme – Kralle:** Die Quiz-Krabbe steht NICHT in dieser Registry.
 * Ihr Standplatz ist schiff-relativ (`SHIP_KRALLE` in world.ts) und wird erst zur
 * Laufzeit relativ zum Deck ergänzt – das ist Schiffs-Geometrie, kein Karten-Standplatz.
 *
 * Phaser-frei und unit-getestet (`test/entities.test.ts`), wie der Quest-/NPC-Loader.
 * Validierung läuft beim Modul-Laden (im Browser wie im Node-Test) und wirft bei
 * kaputten Daten explizit `ContentValidationError` (dieselbe Klasse wie loader.ts).
 */
import { ContentValidationError, NPCS } from "./loader";
import entitiesData from "./data/entities.json";

/** Ein NPC-Standplatz auf einer Karte (Kachel-Koordinaten). Bewusst hier definiert
 *  (nicht in world.ts), damit world.ts diese Registry importieren kann, ohne einen
 *  Import-Zyklus zu bauen; world.ts re-exportiert `Spawn` für seine Altaufrufer. */
export interface Spawn { id: string; x: number; y: number }

/** Registry-Eintrag = Standplatz + Karte. Die `map`-ID gruppiert NPCs je Szene
 *  (z.B. "harbor", "archipel", "lighthouse", "warehouse"). */
export interface EntityNpc extends Spawn { map: string }

function fail(path: string, msg: string): never {
  throw new ContentValidationError(`Entity-Registry „${path}": ${msg}`);
}

function asRecord(v: unknown, path: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail(path, "Objekt erwartet");
  return v as Record<string, unknown>;
}

function asArray(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(path, "Array erwartet");
  return v;
}

function asNonEmptyString(v: unknown, path: string): string {
  if (typeof v !== "string") fail(path, "String erwartet");
  if (v.trim() === "") fail(path, "nicht-leerer String erwartet");
  return v;
}

/** Endliche Zahl (Kachel-Koordinaten dürfen Brüche sein, z.B. 14.6 – darum NICHT
 *  asInt). NaN/Infinity werden abgewiesen. */
function asFiniteNumber(v: unknown, path: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) fail(path, "endliche Zahl erwartet");
  return v;
}

/** Validiert die rohe Registry gegen das Schema und gibt sie typisiert + in
 *  Datei-Reihenfolge zurück. Wirft `ContentValidationError` beim ersten Verstoß
 *  (nie still durchwinken). Die Reihenfolge ist load-bearing: der Hafen baut aus
 *  ihr `NPC_SPAWNS` und serialisiert sie verlustfrei in harbor.tmj. */
export function parseEntities(raw: unknown): EntityNpc[] {
  const obj = asRecord(raw, "entities");
  const list = asArray(obj.npcs, "entities.npcs");
  if (list.length === 0) fail("entities.npcs", "mindestens ein Eintrag erwartet");
  const seen = new Set<string>();
  return list.map((entry, i) => {
    const o = asRecord(entry, `entities.npcs[${i}]`);
    const id = asNonEmptyString(o.id, `entities.npcs[${i}].id`);
    const map = asNonEmptyString(o.map, `entities.npcs[${i}].map`);
    const x = asFiniteNumber(o.x, `entities.npcs[${i}].x`);
    const y = asFiniteNumber(o.y, `entities.npcs[${i}].y`);
    if (!(id in NPCS)) fail(`entities.npcs[${i}].id`, `kein bekannter NPC „${id}" (nicht in npcs.json)`);
    const key = `${map}/${id}`;
    if (seen.has(key)) fail(`entities.npcs[${i}]`, `doppelter Standplatz „${key}"`);
    seen.add(key);
    return { id, map, x, y };
  });
}

/** Validierte Registry – Quelle: `./data/entities.json`. */
export const ENTITY_NPCS: EntityNpc[] = parseEntities(entitiesData);

/** Alle NPC-Standplätze einer Karte, in Datei-Reihenfolge. Leeres Array, wenn die
 *  Karte (noch) keine NPCs hat. Szenen loopen darüber → neuer NPC = nur JSON-Eintrag. */
export function npcSpawnsForMap(map: string): Spawn[] {
  return ENTITY_NPCS.filter((e) => e.map === map).map(({ id, x, y }) => ({ id, x, y }));
}

/** Der primäre (erste) NPC-Standplatz einer Karte. Für Geometrie-Module, deren
 *  Bereich genau einen Standplatz hat (Insel-NPCs). Wirft laut, wenn die Karte
 *  keinen Eintrag hat – so fällt ein Karten-Tippfehler beim Laden sofort auf,
 *  statt dass der NPC stumm verschwindet. */
export function npcSpawnForMap(map: string): Spawn {
  const all = npcSpawnsForMap(map);
  if (all.length === 0) fail(`npcSpawnForMap(${map})`, "keine NPC-Platzierung für diese Karte");
  return all[0];
}
