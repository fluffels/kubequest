/* ===== KubeQuest – Baustein-Katalog: Langform ↔ Kürzel (#287/#298) =====
 * Die EINE zentrale Liste aller Konsolen-Bausteine, die in ZWEI gültigen Formen
 * existieren: eine selbsterklärende Langform und eine (oder mehrere) kürzere
 * Abkürzung(en). Pure Domäne (Phaser-/DOM-frei), damit im Node-Test prüfbar.
 *
 * Wofür: Grundlage der „verdiente Abkürzung"-Mechanik (#287). Die Freischalt-IDs
 * hier sind die IDs, die `Game.unlockAbbrev`/`isAbbrevUnlocked` (#297) verwalten;
 * das Akzeptanz-Gating (#299) erkennt über `findAbbrevByShort` die Kürzel-Tokens
 * und sperrt sie, bis sie freigeschaltet sind; der Lernpfad/Freischalt-Moment
 * (#300) hängt den Unlock an die passende Quest.
 *
 * WICHTIG: Nur ECHTE, am CLI gültige Äquivalente. KEINE erfundenen Formen
 * (z.B. `git checkout -b` hat KEIN `--branch` und steht daher NICHT hier). Der
 * Test in test/abbrev.test.ts erzwingt, dass jede gelistete Form tatsächlich
 * irgendwo im Spiel-Content (accept-Regex) vorkommt – tote/erfundene Einträge
 * fliegen auf.
 */

export interface AbbrevPair {
  /** Stabile Freischalt-ID (Schlüssel für unlockedAbbrev, #297). */
  readonly id: string;
  /** Menschenlesbarer Kontext/Befehl, in dem das Paar gilt (nur Doku/Anzeige). */
  readonly context: string;
  /** Art: Flag (`-a`/`--all`) oder Ressourcen-/Unterbefehl-Kürzel (`pods`/`po`). */
  readonly kind: "flag" | "alias";
  /** Die selbsterklärende Langform (wird zuerst gelehrt, #300). */
  readonly long: string;
  /** Die Abkürzung(en) – gleichwertig, aber Tipp-Ersparnis für Wissende. */
  readonly short: readonly string[];
}

/** Der Katalog. Reihenfolge ~ Lernpfad (Docker → kubectl → helm → git/argocd). */
export const ABBREVS: readonly AbbrevPair[] = [
  // ---- Flags: kurze UND lange Form sind echtes CLI (#286) ----
  { id: "docker-ps-all",      context: "docker ps",                     kind: "flag", long: "--all",       short: ["-a"] },
  { id: "docker-run-detach",  context: "docker run",                    kind: "flag", long: "--detach",    short: ["-d"] },
  { id: "docker-build-tag",   context: "docker build",                  kind: "flag", long: "--tag",       short: ["-t"] },
  { id: "kubectl-namespace",  context: "kubectl … (Namespace)",         kind: "flag", long: "--namespace", short: ["-n"] },
  { id: "kubectl-filename",   context: "kubectl apply/create/delete",   kind: "flag", long: "--filename",  short: ["-f"] },
  { id: "helm-values",        context: "helm install/upgrade",          kind: "flag", long: "--values",    short: ["-f"] },
  { id: "git-commit-message", context: "git commit",                    kind: "flag", long: "--message",   short: ["-m"] },

  // ---- Ressourcen-/Unterbefehl-Kürzel (kubectl/helm/argocd) ----
  { id: "kubectl-pods",       context: "kubectl get pods",              kind: "alias", long: "pods",            short: ["pod", "po"] },
  { id: "kubectl-nodes",      context: "kubectl get nodes",             kind: "alias", long: "nodes",           short: ["node", "no"] },
  { id: "kubectl-services",   context: "kubectl get services",          kind: "alias", long: "services",        short: ["service", "svc"] },
  { id: "kubectl-secrets",    context: "kubectl get secrets",           kind: "alias", long: "secrets",         short: ["secret"] },
  { id: "kubectl-ingress",    context: "kubectl get ingress",           kind: "alias", long: "ingress",         short: ["ingresses", "ing"] },
  { id: "kubectl-netpol",     context: "kubectl get/describe/delete networkpolicies", kind: "alias", long: "networkpolicies", short: ["networkpolicy", "netpol", "netpols"] },
  { id: "helm-list",          context: "helm list",                     kind: "alias", long: "list",            short: ["ls"] },
  { id: "helm-dependency",    context: "helm dependency",               kind: "alias", long: "dependency",      short: ["dep"] },
  { id: "argocd-app-list",    context: "argocd app list",               kind: "alias", long: "list",            short: ["ls"] },
];

/** Findet den Katalog-Eintrag, dessen Kürzel exakt dieses Token ist (für das
 *  Akzeptanz-Gating #299: nur Kürzel sind freischaltpflichtig, Langformen nie).
 *  Achtung: das Token `ls`/`list` kommt in mehreren Kontexten vor – diese Funktion
 *  liefert den ERSTEN Treffer; das Gating wird den Kontext (Befehl) zusätzlich
 *  berücksichtigen müssen. */
export function findAbbrevByShort(token: string): AbbrevPair | undefined {
  return ABBREVS.find(a => a.short.includes(token));
}

/** Der Befehl (erstes Wort des Kontexts) eines Eintrags – „docker", „kubectl",
 *  „helm", „git", „argocd". Disambiguiert mehrdeutige Kürzel anhand des getippten
 *  Befehls (`-f` = kubectl `--filename` ODER helm `--values`; `ls` = helm ODER
 *  argocd). Der Kontext-String ist die SSOT dafür; das erste Wort ist immer der
 *  CLI-Befehl. */
function abbrevCommand(a: AbbrevPair): string {
  return a.context.trim().toLowerCase().split(/\s+/)[0];
}

/** Treffer des Gatings: das gesperrte Paar + das konkret getippte Kürzel-Token. */
export interface LockedAbbrev {
  readonly pair: AbbrevPair;
  readonly used: string;
}

/** Akzeptanz-Gating (#299): Nutzt die Eingabe ein Kürzel, das für IHREN Befehl
 *  gilt, aber noch nicht freigeschaltet ist? Dann liefert die Funktion das
 *  gesperrte Paar + das getippte Kürzel (für den Hinweis), sonst `undefined`.
 *
 *  - Die Langform gilt IMMER (steht nie in `short`, löst also nie aus).
 *  - Der Befehl (erstes Token der Eingabe) muss zum Eintrag passen – so wird
 *    `helm install -f` NICHT von `kubectl --filename` und `argocd app ls` NICHT
 *    von `helm list` blockiert.
 *  - Token-genau (`pods` triggert nicht das Kürzel `pod`/`po`).
 *
 *  Pur: `isUnlocked` wird injiziert (keine Game-Kopplung) → im Node-Test prüfbar.
 *  Das UI ruft das VOR der Erfolgswertung auf und ersetzt einen Treffer durch
 *  einen freundlichen Hinweis statt eines harten „Falsch". */
export function lockedAbbrevInInput(input: string, isUnlocked: (id: string) => boolean): LockedAbbrev | undefined {
  const tokens = input.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return undefined;
  const cmd = tokens[0];
  for (const a of ABBREVS) {
    if (abbrevCommand(a) !== cmd) continue;     // nur Einträge dieses Befehls
    if (isUnlocked(a.id)) continue;             // freigeschaltet → beide Formen gelten
    const used = a.short.find(s => tokens.includes(s));
    if (used) return { pair: a, used };         // gesperrtes Kürzel getippt
  }
  return undefined;
}

/** Freundlicher Hinweis fürs Gating (#299): nennt das getippte Kürzel und die
 *  jetzt zu verwendende Langform. Enthält `<code>` passend zu den übrigen
 *  Eingabe-Rückmeldungen, die per innerHTML gerendert werden. */
export function abbrevLockHint(hit: LockedAbbrev): string {
  return `🔒 <code>${hit.used}</code> ist eine Profi-Abkürzung, die du <b>später freischaltest</b>. `
    + `Schreib sie vorerst aus: <code>${hit.pair.long}</code>.`;
}
