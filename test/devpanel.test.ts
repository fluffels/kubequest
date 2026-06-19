/* Dev-/Test-Panel: pure Logik (#325).
 *
 * Prüft die DOM-/Phaser-freien Bausteine des Dev-Panels (das die #329-Jump-API
 * als klickbares, passwortgegatetes Panel zugänglich macht):
 *  - checkDevPanelPassword: die "weiche Sperre" gegen versehentliches Reinrutschen
 *    – inkl. der Negativfälle, die zählen (falsch / leer / gar kein Passwort gesetzt).
 *  - isDevPanelConfigured: ist überhaupt ein Passwort konfiguriert?
 *  - roadmapToRows: Mapping der Content-Roadmap auf Anzeige-Zeilen (Label,
 *    completed-/current-Marker).
 * Die Tastatur-Navigation selbst lebt im schon getesteten overlaykbd.ts und wird
 * dort abgedeckt; hier prüfen wir nur die Panel-eigene Logik.
 */
import { describe, it, expect } from "vitest";
import {
  checkDevPanelPassword,
  isDevPanelConfigured,
  roadmapToRows,
  type QuestRoadmapEntry,
} from "../src/devpanel";

describe("checkDevPanelPassword – weiche Sperre (#325)", () => {
  it("akzeptiert das exakt passende Passwort", () => {
    expect(checkDevPanelPassword("geheim123", "geheim123")).toBe(true);
  });

  it("lehnt ein falsches Passwort ab", () => {
    expect(checkDevPanelPassword("falsch", "geheim123")).toBe(false);
  });

  it("ist gesperrt, wenn KEIN Passwort konfiguriert ist (Repo-Cloner: undefined)", () => {
    // Wert nie im Repo → der Cloner hat keine .env → expected ist undefined.
    expect(checkDevPanelPassword("egal", undefined)).toBe(false);
    expect(checkDevPanelPassword("", undefined)).toBe(false);
  });

  it("ist gesperrt, wenn das konfigurierte Passwort leer ist (leere .env-Zeile)", () => {
    expect(checkDevPanelPassword("", "")).toBe(false);
    expect(checkDevPanelPassword("irgendwas", "")).toBe(false);
  });

  it("ist case-sensitive und vergleicht exakt (kein Trim)", () => {
    expect(checkDevPanelPassword("Geheim", "geheim")).toBe(false);
    expect(checkDevPanelPassword(" geheim ", "geheim")).toBe(false);
  });
});

describe("isDevPanelConfigured – ist ein Passwort gesetzt? (#325)", () => {
  it("true nur bei nicht-leerem Passwort", () => {
    expect(isDevPanelConfigured("x")).toBe(true);
  });
  it("false ohne Passwort (undefined / leer)", () => {
    expect(isDevPanelConfigured(undefined)).toBe(false);
    expect(isDevPanelConfigured("")).toBe(false);
  });
});

describe("roadmapToRows – Roadmap → Anzeige-Zeilen (#325)", () => {
  const roadmap: QuestRoadmapEntry[] = [
    { idx: 0, id: "q-anker", title: "Anker lichten", giver: "ole", giverName: "Ole", steps: 3, completed: true },
    { idx: 1, id: "q-docker", title: "Docker-Grundlagen", giver: "bo", giverName: "Bo", steps: 4, completed: false },
    { idx: 2, id: "q-k8s", title: "Erste Pods", giver: "juno", giverName: "Juno", steps: 2, completed: false },
  ];

  it("erzeugt genau eine Zeile pro Quest, idx erhalten", () => {
    const rows = roadmapToRows(roadmap, 1);
    expect(rows.map(r => r.idx)).toEqual([0, 1, 2]);
  });

  it("baut ein Label aus idx, Titel und Giver-Name", () => {
    const rows = roadmapToRows(roadmap, 1);
    expect(rows[1].label).toContain("Docker-Grundlagen");
    expect(rows[1].label).toContain("Bo");
    expect(rows[1].label).toContain("1");
  });

  it("übernimmt das completed-Flag aus dem Spielstand", () => {
    const rows = roadmapToRows(roadmap, 1);
    expect(rows.map(r => r.completed)).toEqual([true, false, false]);
  });

  it("markiert GENAU die aktuelle Quest als current", () => {
    const rows = roadmapToRows(roadmap, 1);
    expect(rows.map(r => r.current)).toEqual([false, true, false]);
  });

  it("markiert keine Zeile als current im Endzustand (currentIdx jenseits der Liste)", () => {
    const rows = roadmapToRows(roadmap, 3);
    expect(rows.some(r => r.current)).toBe(false);
  });

  it("liefert für eine leere Roadmap eine leere Liste (Grenzfall)", () => {
    expect(roadmapToRows([], 0)).toEqual([]);
  });
});
