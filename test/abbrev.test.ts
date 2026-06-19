/* Validierung des Baustein-Katalogs (Langform↔Kürzel, #287/#298).
 *
 * Der Katalog ist die SSOT für die „verdiente Abkürzung"-Mechanik. Dieser Test
 * sichert ihn gegen zwei Fehlerklassen ab:
 *  1. doppelte/leere IDs oder Formen (Datenhygiene),
 *  2. tote/erfundene Einträge: JEDE gelistete Form (Lang UND jedes Kürzel) muss
 *     tatsächlich in einer accept-Regex des Spiel-Contents vorkommen. Damit kann
 *     keine Form im Katalog stehen, die das Spiel gar nicht akzeptiert – und keine
 *     erfundene Langform (z.B. ein nicht existierendes `--branch`) durchrutschen.
 */
import { test, expect, describe } from "vitest";
import assert from "node:assert/strict";
import { ABBREVS, findAbbrevByShort, type AbbrevPair } from "../src/content/abbrev";
import { KQContent } from "../src/content";
import { Sim as KQSim } from "../src/sim";

/** Alle accept-Regex-Quellen des Spiel-Contents einsammeln: Befehlskarten,
 *  Drills (instanziiert – die Alternationen stehen unabhängig von Zufallsnamen
 *  in der Regex) und Quest-Teach-/Terminal-Schritte. */
function allAcceptSources(): string[] {
  const out: string[] = [];
  for (const c of KQContent.CMD_CARDS) for (const re of c.accept) out.push(re.source);
  for (const make of Object.values(KQContent.DRILLS)) for (const re of make(new KQSim({})).accept) out.push(re.source);
  for (const quest of KQContent.QUESTS) for (const step of quest.steps as any[]) {
    if (step.type === "teach") for (const re of step.cmd.accept) out.push(re.source);
    if (step.type === "terminal") for (const t of step.tasks) for (const re of t.accept) out.push(re.source);
  }
  return out;
}

const escapeReg = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Kommt `token` als eigenständige Alternative in der Regex-Quelle vor? Grenzen
 *  sind Nicht-Wort-/Nicht-Bindestrich-Zeichen, damit `po` NICHT im Inneren von
 *  `pods` und `-d` NICHT in `--detach` fälschlich matcht. */
const tokenAppears = (source: string, token: string) =>
  new RegExp(`(?:^|[^\\w-])${escapeReg(token)}(?:$|[^\\w-])`).test(source);

const SOURCES = allAcceptSources();
const appearsAnywhere = (token: string) => SOURCES.some(s => tokenAppears(s, token));

describe("Baustein-Katalog: Datenhygiene", () => {
  test("IDs sind eindeutig und nicht leer", () => {
    const ids = ABBREVS.map(a => a.id);
    assert.deepEqual([...new Set(ids)].sort(), [...ids].sort(), "doppelte Katalog-IDs");
    for (const a of ABBREVS) assert.ok(a.id.trim().length > 0, "leere ID");
  });

  test("jeder Eintrag hat eine Langform und mindestens ein nicht-leeres Kürzel", () => {
    for (const a of ABBREVS) {
      assert.ok(a.long.trim().length > 0, a.id + ": leere Langform");
      assert.ok(a.short.length >= 1, a.id + ": kein Kürzel");
      for (const s of a.short) assert.ok(s.trim().length > 0 && s !== a.long, `${a.id}: Kürzel „${s}" leer oder = Langform`);
    }
  });
});

describe("Baustein-Katalog: keine toten/erfundenen Formen", () => {
  test("jede Langform kommt in einer accept-Regex des Spiels vor", () => {
    const fehlend = ABBREVS.filter(a => !appearsAnywhere(a.long)).map(a => `${a.id} (${a.long})`);
    assert.deepEqual(fehlend, [], "Langformen, die im Content fehlen:\n" + fehlend.join("\n"));
  });

  test("jedes Kürzel kommt in einer accept-Regex des Spiels vor", () => {
    const fehlend: string[] = [];
    for (const a of ABBREVS) for (const s of a.short) if (!appearsAnywhere(s)) fehlend.push(`${a.id} (${s})`);
    assert.deepEqual(fehlend, [], "Kürzel, die im Content fehlen:\n" + fehlend.join("\n"));
  });

  test("Gegenprobe: eine erfundene Langform würde der Test fangen (--branch existiert nicht)", () => {
    // git checkout -b hat KEIN --branch -> darf nirgends auftauchen (Schutz vor Erfindung).
    expect(appearsAnywhere("--branch")).toBe(false);
  });
});

describe("findAbbrevByShort", () => {
  test("liefert den Eintrag zu einem Kürzel-Token", () => {
    expect(findAbbrevByShort("-a")?.id).toBe("docker-ps-all");
    expect(findAbbrevByShort("po")?.id).toBe("kubectl-pods");
    expect(findAbbrevByShort("netpol")?.id).toBe("kubectl-netpol");
  });

  test("liefert undefined für Langformen und Unbekanntes (nur Kürzel sind freischaltpflichtig)", () => {
    expect(findAbbrevByShort("--all")).toBeUndefined();
    expect(findAbbrevByShort("pods")).toBeUndefined();
    expect(findAbbrevByShort("gibtsnicht")).toBeUndefined();
  });
});
