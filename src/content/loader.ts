/* ===== Inhalte: Daten-Loader (Content-as-Data, #348) =====
 * Erster Baustein des Skalierungs-Fundaments aus ADR 0004
 * (docs/adr/0004-skalierungs-fundament.md, Abschnitt „Content ist
 * TypeScript-Code"): Spielinhalt lebt als **Daten-Datei** (JSON), nicht als
 * hartcodiertes TS-Objekt-Literal. TypeScript beschreibt nur noch *Typen und
 * Mechaniken*, die *Inhalte* stehen in `./data/*.json`.
 *
 * Migriert sind hier die **NPC-Stammdaten** (`./data/npcs.json`) und ihre
 * **Standard-Dialoge / Smalltalk** (`./data/smalltalk.json`) – beides reine
 * Daten ohne Logik, genau die im Ticket genannten „NPCs/Dialoge". Quests,
 * Drills und Befehls-Karten bleiben bewusst (noch) TypeScript: ihre Felder
 * sind RegExp (`accept`) bzw. Funktionen (`(sim) => DrillTask`) und in JSON
 * gar nicht ausdrückbar – siehe die ausführliche Abwägung in `validate.ts`.
 * Ihre Migration ist ein eigener, schwerer Folgeschritt.
 *
 * **Warum JSON-`import` statt `fetch` zur Laufzeit?** Der Offline-Build
 * (`vite-plugin-singlefile`) inlinet alle `import`s in eine self-contained
 * `index.html` – ein Laufzeit-`fetch` würde dort ins Leere greifen und den
 * „eine-Datei-zum-Verschenken"-Kernwert brechen. Vite bündelt JSON-`import`s
 * fest in den Build; die Validierung unten läuft trotzdem **zur Laufzeit**
 * (beim Modul-Laden, im Browser wie im Node-Test).
 *
 * **Warum ein handgeschriebener Validator statt Zod?** Das Repo hält bewusst
 * null Laufzeit-Abhängigkeiten außer Phaser (siehe `validate.ts` + package.json).
 * Eine Schema-Library nur fürs Laden wäre unnötiger Bundle-Ballast. Der
 * Validator hier ist klein, Phaser-frei und unit-getestet.
 *
 * Cross-Referenzen (Standplätze der zugereisten NPCs, früher als Kommentar an
 * den NPCS-Einträgen): „argo" → `archipel.ts` ARCHIPEL_NPC (#93), „lumi" →
 * `lighthouse.ts` LIGHTHOUSE_NPC (#112), „knut" → `warehouse.ts` WAREHOUSE_NPC
 * (#125). Diese Schlüssel müssen in npcs.json bleiben, sonst finden die Szenen
 * ihren NPC nicht.
 */
import npcsData from "./data/npcs.json";
import smalltalkData from "./data/smalltalk.json";

/** Wird geworfen, wenn eine Daten-Datei nicht zum erwarteten Schema passt.
 *  Eigene Klasse, damit Tests gezielt darauf prüfen können (statt nur „Error"). */
export class ContentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentValidationError";
  }
}

/** Bricht die Validierung mit einer menschenlesbaren Pfadangabe ab.
 *  `never`-Rückgabe → der Aufrufer weiß danach, dass der Wert gültig ist. */
function fail(path: string, msg: string): never {
  throw new ContentValidationError(`Content „${path}": ${msg}`);
}

function asRecord(v: unknown, path: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail(path, "Objekt erwartet");
  return v as Record<string, unknown>;
}

function asNonEmptyString(v: unknown, path: string): string {
  if (typeof v !== "string") fail(path, "String erwartet");
  if (v.trim() === "") fail(path, "nicht-leerer String erwartet");
  return v;
}

function asInt(v: unknown, path: string): number {
  if (typeof v !== "number" || !Number.isInteger(v)) fail(path, "Ganzzahl erwartet");
  return v;
}

function asNonEmptyStringArray(v: unknown, path: string): string[] {
  if (!Array.isArray(v)) fail(path, "Array erwartet");
  if (v.length === 0) fail(path, "nicht-leeres Array erwartet");
  return v.map((x, i) => asNonEmptyString(x, `${path}[${i}]`));
}

/** NPC-Stammdaten: Anzeigename, Funktions-Titel, Spritesheet-Frame, Textur-Key. */
export interface NpcMeta {
  name: string;
  title: string;
  sprite: number;
  tex: string;
}

/** Validiert rohe NPC-Daten gegen das Schema und gibt sie typisiert zurück.
 *  Wirft `ContentValidationError` beim ersten Verstoß (nie still durchwinken). */
export function parseNpcs(raw: unknown): Record<string, NpcMeta> {
  const obj = asRecord(raw, "npcs");
  const ids = Object.keys(obj);
  if (ids.length === 0) fail("npcs", "mindestens ein NPC erwartet");
  const out: Record<string, NpcMeta> = {};
  for (const id of ids) {
    const m = asRecord(obj[id], `npcs.${id}`);
    out[id] = {
      name: asNonEmptyString(m.name, `npcs.${id}.name`),
      title: asNonEmptyString(m.title, `npcs.${id}.title`),
      sprite: asInt(m.sprite, `npcs.${id}.sprite`),
      tex: asNonEmptyString(m.tex, `npcs.${id}.tex`),
    };
  }
  return out;
}

/** Validiert rohe Smalltalk-Daten. Jeder Schlüssel muss ein bekannter NPC sein
 *  (referenzielle Integrität), jede Zeilen-Liste nicht-leer und rein textuell.
 *  Wirft `ContentValidationError` beim ersten Verstoß. */
export function parseSmalltalk(raw: unknown, knownNpcIds: Set<string>): Record<string, string[]> {
  const obj = asRecord(raw, "smalltalk");
  const out: Record<string, string[]> = {};
  for (const id of Object.keys(obj)) {
    if (!knownNpcIds.has(id)) fail(`smalltalk.${id}`, "kein bekannter NPC (nicht in npcs.json)");
    out[id] = asNonEmptyStringArray(obj[id], `smalltalk.${id}`);
  }
  return out;
}

/** Validierte NPC-Stammdaten – Quelle: `./data/npcs.json`. */
export const NPCS: Record<string, NpcMeta> = parseNpcs(npcsData);

/** Validierte Standard-Dialoge je NPC – Quelle: `./data/smalltalk.json`. */
export const SMALLTALK: Record<string, string[]> = parseSmalltalk(smalltalkData, new Set(Object.keys(NPCS)));
