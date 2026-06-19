/* ===== Inhalte: Daten-Loader (Content-as-Data, #348) =====
 * Erster Baustein des Skalierungs-Fundaments aus ADR 0004
 * (docs/adr/0004-skalierungs-fundament.md, Abschnitt „Content ist
 * TypeScript-Code"): Spielinhalt lebt als **Daten-Datei** (JSON), nicht als
 * hartcodiertes TS-Objekt-Literal. TypeScript beschreibt nur noch *Typen und
 * Mechaniken*, die *Inhalte* stehen in `./data/*.json`.
 *
 * Migriert sind hier:
 *  - **NPC-Stammdaten** (`./data/npcs.json`) + **Smalltalk** (`./data/smalltalk.json`)
 *  - **Quests** (`./data/quests.json`) – der komplette Story-/Lerninhalt (40 Quests).
 *
 * Quests sind zu ~90% reine Daten (Dialoge, Choices, Texte, Drill-Referenzen,
 * scenario-Zustände). Die zwei „Code"-Ränder werden sauber überbrückt, statt
 * Daten und Mechanik zu vermischen:
 *  - `accept`-RegExp liegen als **String-Pattern** in der JSON und werden hier
 *    beim Laden zu `RegExp` kompiliert.
 *  - `check`-Prädikate (Sim-Zustand prüfen) sind **Mechanik** und bleiben Code:
 *    sie stehen als benannte Registry in `./checks.ts`; die JSON referenziert
 *    sie per Key, der Loader löst Key → Funktion auf. Genau das meint ADR 0004
 *    mit „TS beschreibt Mechanik, Daten beschreiben Inhalt".
 *  - `(sim) => DrillTask`-Generatoren in `drills.ts` sind ebenfalls Mechanik und
 *    bleiben Code; Quests referenzieren Drills ohnehin nur per ID (`pool`).
 *
 * Befehls-Karten (`quiz.ts` CMD_CARDS) sind als Nächstes dran (auch RegExp-accept).
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
import questsData from "./data/quests.json";
import { QUEST_CHECKS } from "./checks";
import type { Sim } from "../sim";
import type {
  Quest,
  QuestStep,
  QuestTask,
  TeachCommand,
  ChoiceOption,
  StepBase,
} from "../types";
import type { Scenario } from "../sim";

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

function asBool(v: unknown, path: string): boolean {
  if (typeof v !== "boolean") fail(path, "Boolean erwartet");
  return v;
}

function asArray(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(path, "Array erwartet");
  return v;
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

/* ===================== Quests (Content-as-Data, #348) ===================== */

/** `accept`-Pattern (Strings aus der JSON) zu `RegExp` kompilieren. */
function reviveAccept(v: unknown, path: string): RegExp[] {
  const arr = asArray(v, path);
  if (arr.length === 0) fail(path, "nicht-leeres accept-Array erwartet");
  return arr.map((s, i) => {
    const src = asNonEmptyString(s, `${path}[${i}]`);
    try {
      return new RegExp(src);
    } catch {
      return fail(`${path}[${i}]`, `ungültiges RegExp-Pattern: ${src}`);
    }
  });
}

/** Optionalen `check`-Key zur Mechanik-Funktion aus `QUEST_CHECKS` auflösen. */
function reviveCheck(v: unknown, path: string): ((sim: Sim) => unknown) | undefined {
  if (v === undefined) return undefined;
  const key = asNonEmptyString(v, path);
  const fn = QUEST_CHECKS[key];
  if (!fn) fail(path, `unbekannter check-Key (nicht in QUEST_CHECKS): ${key}`);
  return fn;
}

/** Gemeinsame Felder von Teach-Befehl und Terminal-Aufgabe (ohne `intro`). */
function reviveTaskCommon(o: Record<string, unknown>, path: string): QuestTask {
  const task: QuestTask = {
    id: asNonEmptyString(o.id, `${path}.id`),
    text: asNonEmptyString(o.text, `${path}.text`),
    accept: reviveAccept(o.accept, `${path}.accept`),
    solution: asNonEmptyString(o.solution, `${path}.solution`),
    hint: asNonEmptyString(o.hint, `${path}.hint`),
  };
  const check = reviveCheck(o.check, `${path}.check`);
  if (check) task.check = check;
  return task;
}

function reviveTeachCmd(v: unknown, path: string): TeachCommand {
  const o = asRecord(v, path);
  return { ...reviveTaskCommon(o, path), intro: asNonEmptyString(o.intro, `${path}.intro`) };
}

function reviveOptions(v: unknown, path: string): ChoiceOption[] {
  const arr = asArray(v, path);
  if (arr.length === 0) fail(path, "nicht-leere Optionsliste erwartet");
  return arr.map((opt, i) => {
    const r = asRecord(opt, `${path}[${i}]`);
    return {
      t: asNonEmptyString(r.t, `${path}[${i}].t`),
      ok: asBool(r.ok, `${path}[${i}].ok`),
      reply: asNonEmptyString(r.reply, `${path}[${i}].reply`),
    };
  });
}

/** Die an jedem Schritt erlaubten Zusatzfelder (`scenario`, `unlockAbbrev`). */
function reviveStepBase(o: Record<string, unknown>, path: string): StepBase {
  const base: StepBase = {};
  if (o.scenario !== undefined) {
    // Scenario ist die serialisierbare Sim-Zustandsform (= GameState.clusterSnapshot);
    // hier nur strukturell als Objekt absichern, die Sim-Semantik prüft der Sim selbst.
    if (typeof o.scenario !== "object" || o.scenario === null || Array.isArray(o.scenario)) {
      fail(`${path}.scenario`, "Scenario-Objekt erwartet");
    }
    base.scenario = o.scenario as Scenario;
  }
  if (o.unlockAbbrev !== undefined) base.unlockAbbrev = asNonEmptyString(o.unlockAbbrev, `${path}.unlockAbbrev`);
  return base;
}

function reviveStep(v: unknown, path: string): QuestStep {
  const o = asRecord(v, path);
  const type = asNonEmptyString(o.type, `${path}.type`);
  const base = reviveStepBase(o, path);
  switch (type) {
    case "dialog":
      return { ...base, type: "dialog", npc: asNonEmptyString(o.npc, `${path}.npc`), lines: asNonEmptyStringArray(o.lines, `${path}.lines`) };
    case "choice": {
      const step = {
        ...base,
        type: "choice" as const,
        npc: asNonEmptyString(o.npc, `${path}.npc`),
        q: asNonEmptyString(o.q, `${path}.q`),
        options: reviveOptions(o.options, `${path}.options`),
      };
      return o.reviewId !== undefined ? { ...step, reviewId: asNonEmptyString(o.reviewId, `${path}.reviewId`) } : step;
    }
    case "teach":
      return { ...base, type: "teach", brief: asNonEmptyString(o.brief, `${path}.brief`), cmd: reviveTeachCmd(o.cmd, `${path}.cmd`) };
    case "drill":
      return {
        ...base,
        type: "drill",
        brief: asNonEmptyString(o.brief, `${path}.brief`),
        pool: asNonEmptyStringArray(o.pool, `${path}.pool`),
        count: asInt(o.count, `${path}.count`),
        intro: asNonEmptyString(o.intro, `${path}.intro`),
      };
    case "terminal":
      return {
        ...base,
        type: "terminal",
        brief: asNonEmptyString(o.brief, `${path}.brief`),
        tasks: asArray(o.tasks, `${path}.tasks`).map((t, i) => reviveTaskCommon(asRecord(t, `${path}.tasks[${i}]`), `${path}.tasks[${i}]`)),
      };
    case "minigame": {
      const game = asNonEmptyString(o.game, `${path}.game`);
      if (game !== "stack") fail(`${path}.game`, `unbekanntes Minispiel: ${game}`);
      return { ...base, type: "minigame", npc: asNonEmptyString(o.npc, `${path}.npc`), game: "stack", brief: asNonEmptyString(o.brief, `${path}.brief`) };
    }
    default:
      return fail(`${path}.type`, `unbekannter Schritt-Typ: ${type}`);
  }
}

/** Validiert rohe Quest-Daten gegen das Schema und gibt sie in der Laufzeit-Form
 *  (`accept` als RegExp, `check` als Funktion) zurück. Wirft `ContentValidationError`
 *  beim ersten Verstoß – kaputter Content fällt explizit auf, nicht still. */
export function parseQuests(raw: unknown): Quest[] {
  const arr = asArray(raw, "quests");
  if (arr.length === 0) fail("quests", "mindestens eine Quest erwartet");
  return arr.map((q, i) => {
    const o = asRecord(q, `quests[${i}]`);
    const id = asNonEmptyString(o.id, `quests[${i}].id`);
    const path = `quest ${id}`;
    return {
      id,
      title: asNonEmptyString(o.title, `${path}.title`),
      giver: asNonEmptyString(o.giver, `${path}.giver`),
      rewardXp: asInt(o.rewardXp, `${path}.rewardXp`),
      rewardCoins: asInt(o.rewardCoins, `${path}.rewardCoins`),
      steps: asArray(o.steps, `${path}.steps`).map((s, j) => reviveStep(s, `${path}.steps[${j}]`)),
    };
  });
}

/** Validierte Quests in Laufzeit-Form – Quelle: `./data/quests.json` + `./checks.ts`. */
export const QUESTS: Quest[] = parseQuests(questsData);
