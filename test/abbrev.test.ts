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
import { ABBREVS, findAbbrevByShort, lockedAbbrevInInput, abbrevLockHint, type AbbrevPair } from "../src/content/abbrev";
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

/* #299: Akzeptanz-Gating – Kürzel erst nach Freischaltung, Langform immer. */
describe("lockedAbbrevInInput – Gating der Eingabe-Akzeptanz (#299)", () => {
  const NICHTS_FREI = (_id: string) => false;       // frischer Spielstand: alles gesperrt
  const ALLES_FREI = (_id: string) => true;         // grandfathered / alles freigeschaltet
  const nurFrei = (...ids: string[]) => (id: string) => ids.includes(id);

  test("gesperrtes Kürzel wird erkannt (Paar + getipptes Token)", () => {
    const hit = lockedAbbrevInInput("docker ps -a", NICHTS_FREI);
    expect(hit?.pair.id).toBe("docker-ps-all");
    expect(hit?.used).toBe("-a");
  });

  test("Langform löst NIE aus (gilt immer, auch bei allem gesperrt)", () => {
    expect(lockedAbbrevInInput("docker ps --all", NICHTS_FREI)).toBeUndefined();
    expect(lockedAbbrevInInput("kubectl get pods", NICHTS_FREI)).toBeUndefined();
  });

  test("nach Freischaltung gilt das Kürzel (kein Treffer mehr)", () => {
    expect(lockedAbbrevInInput("docker ps -a", nurFrei("docker-ps-all"))).toBeUndefined();
    expect(lockedAbbrevInInput("docker ps -a", ALLES_FREI)).toBeUndefined();
  });

  test("token-genau: Langform „pods“ triggert nicht das Kürzel „pod“/„po“", () => {
    expect(lockedAbbrevInInput("kubectl get pods", NICHTS_FREI)).toBeUndefined();
    expect(lockedAbbrevInInput("kubectl get po", NICHTS_FREI)?.pair.id).toBe("kubectl-pods");
    expect(lockedAbbrevInInput("kubectl get po", NICHTS_FREI)?.used).toBe("po");
  });

  test("Kontext-Disambiguierung „-f“: kubectl vs. helm", () => {
    // -f gehört zu zwei Einträgen – der getippte Befehl entscheidet.
    expect(lockedAbbrevInInput("kubectl apply -f app.yaml", NICHTS_FREI)?.pair.id).toBe("kubectl-filename");
    expect(lockedAbbrevInInput("helm install rel ./c -f values.yaml", NICHTS_FREI)?.pair.id).toBe("helm-values");
  });

  test("ein anderer Befehl mit gleichem Kürzel blockiert NICHT (Negativfall)", () => {
    // helm-values gesperrt, kubectl-filename frei: ein kubectl -f darf nicht über helm-values stolpern.
    expect(lockedAbbrevInInput("kubectl apply -f app.yaml", nurFrei("kubectl-filename"))).toBeUndefined();
    // umgekehrt: helm -f bleibt frei, wenn nur kubectl-filename gesperrt ist.
    expect(lockedAbbrevInInput("helm install rel ./c -f values.yaml", nurFrei("helm-values"))).toBeUndefined();
  });

  test("Kontext-Disambiguierung „ls“: helm vs. argocd", () => {
    expect(lockedAbbrevInInput("helm ls", NICHTS_FREI)?.pair.id).toBe("helm-list");
    expect(lockedAbbrevInInput("argocd app ls", NICHTS_FREI)?.pair.id).toBe("argocd-app-list");
  });

  test("leere Eingabe / fremder Befehl ohne Katalog-Kürzel → kein Treffer", () => {
    expect(lockedAbbrevInInput("", NICHTS_FREI)).toBeUndefined();
    expect(lockedAbbrevInInput("   ", NICHTS_FREI)).toBeUndefined();
    expect(lockedAbbrevInInput("ls -a", NICHTS_FREI)).toBeUndefined();          // „ls" ist hier der Befehl, kein kubectl/helm
    expect(lockedAbbrevInInput("kubectl get deployments", NICHTS_FREI)).toBeUndefined();
  });

  test("der Hinweis nennt das getippte Kürzel und die auszuschreibende Langform", () => {
    const hit = lockedAbbrevInInput("kubectl get svc", NICHTS_FREI)!;
    expect(hit.pair.id).toBe("kubectl-services");
    const msg = abbrevLockHint(hit);
    expect(msg).toContain("svc");        // das getippte Kürzel
    expect(msg).toContain("services");   // die Langform
  });
});

/* #308: Gating-Regression — gültige Musterlösungen dürfen nicht geblockt werden. */
describe("lockedAbbrevInInput – Regressionsfixes #308", () => {
  const NICHTS_FREI = (_id: string) => false;

  test("kubectl create secret generic … darf NICHT geblockt werden (secret ist Unterbefehl von create, kein Alias)", () => {
    expect(lockedAbbrevInInput("kubectl create secret generic db-zugang --from-literal=pass=secret123", NICHTS_FREI)).toBeUndefined();
    expect(lockedAbbrevInInput("kubectl create secret generic webapp-credentials --from-literal=user=admin", NICHTS_FREI)).toBeUndefined();
    expect(lockedAbbrevInInput("kubectl create secret tls my-tls --cert=tls.crt --key=tls.key", NICHTS_FREI)).toBeUndefined();
  });

  test("kubectl get secret (Singular) blockiert weiterhin — echter Alias für secrets", () => {
    const hit = lockedAbbrevInInput("kubectl get secret", NICHTS_FREI);
    expect(hit?.pair.id).toBe("kubectl-secrets");
    expect(hit?.used).toBe("secret");
  });

  test("kubectl describe pod <name> darf NICHT geblockt werden — Singular ist kanonisch, kein Profi-Kürzel", () => {
    expect(lockedAbbrevInInput("kubectl describe pod my-pod", NICHTS_FREI)).toBeUndefined();
  });

  test("kubectl delete pod <name> darf NICHT geblockt werden — Singular ist kanonisch", () => {
    expect(lockedAbbrevInInput("kubectl delete pod my-pod", NICHTS_FREI)).toBeUndefined();
  });

  test("kubectl get po blockiert weiterhin — po ist echter Profi-Shortcut für pods", () => {
    const hit = lockedAbbrevInInput("kubectl get po", NICHTS_FREI);
    expect(hit?.pair.id).toBe("kubectl-pods");
    expect(hit?.used).toBe("po");
  });

  test("kubectl get node darf NICHT geblockt werden — Singular ist kanonisch", () => {
    expect(lockedAbbrevInInput("kubectl get node", NICHTS_FREI)).toBeUndefined();
  });

  test("kubectl get service darf NICHT geblockt werden — Singular ist kanonisch", () => {
    expect(lockedAbbrevInInput("kubectl get service", NICHTS_FREI)).toBeUndefined();
  });
});
