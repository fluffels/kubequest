/* ===== Lernreihenfolge-Wächter (#235) =====
 * Datenquelle + reine Prüflogik für den automatischen Schutz: Bei Kralle darf
 * NIE eine Karte im Wiederhol-/Quiz-Pool auftauchen, deren Konzept im Spiel noch
 * nicht eingeführt wurde.
 *
 * Hintergrund: Der Review-Pool wird pro abgeschlossener Quest freigeschaltet
 * (game.ts) – aus drei Quellen:
 *   1. EXTRA_CARDS-Map  (Karte ↔ Quest von Hand zugeordnet)  ← die riskante Quelle
 *   2. Choice-`reviewId` (Frage steht IM Quest-Ablauf, also in-context eingeführt)
 *   3. CMD_CARDS.chapter (die Befehls-Karte drillt genau den Befehl ihres Kapitels)
 *
 * Quellen 2 und 3 sind per Konstruktion in-Ordnung: Die Frage/der Drill erscheint
 * erst an der Stelle, an der das Konzept gerade gelehrt wurde. Nur bei EXTRA_CARDS
 * wird eine Karte von Hand an eine Quest gehängt – und kann dabei VOR ihrer Lektion
 * landen (konkret gefunden: `q-ch2-4` Self-Healing hing an q4, bewiesen wird
 * Self-Healing aber erst in q7, siehe #227).
 *
 * Darum führt diese Map für JEDE über EXTRA_CARDS platzierte Karte die Quest auf,
 * in der ihr Konzept zum ERSTEN Mal eingeführt wird (Beleg jeweils im Kommentar).
 * Der Test (test/learnorder.test.ts) prüft: Freischalt-Quest ≥ Einführungs-Quest
 * (in Spielreihenfolge = Reihenfolge des QUESTS-Arrays, NICHT der Nummer).
 *
 * Reihenfolge im Array weicht von den Nummern ab, z.B. … q14 → q26 → q15 …; deshalb
 * wird die Reihenfolge im Test immer aus dem QUESTS-Array abgeleitet, nie aus der Zahl.
 */

/** Konzept-Karte → Quest, in der ihr Konzept zum ersten Mal eingeführt wird.
 *  Gepflegt für alle Karten, die der Pool über die EXTRA_CARDS-Map (game.ts)
 *  freischaltet. Neue EXTRA_CARDS-Karte? Hier ihren Einführungs-Quest eintragen –
 *  sonst schlägt der Vollständigkeits-Test fehl. */
export const CONCEPT_INTRO: Record<string, string> = {
  // ----- Docker-Grundlagen -----
  "q-flag-ps-a": "q2",        // docker ps -a (Variante "auch gestoppte" in q2 eingeführt)
  "q-ch1-3": "q1",            // Registry/Docker Hub (docker pull aus der Registry, q1)
  "q-ch1-5": "q2",            // Image besteht aus Schichten (Stapel-Spiel bei Bo, q2)
  "q-flag-run-d": "q3",       // docker run -d (q3)
  "q-flag-run-name": "q3",    // docker run --name (q3)
  // ----- Kubernetes-Grundlagen -----
  "q-ch2-1": "q4",            // wofür Kubernetes (Hafen wird Cluster, q4)
  "q-ch2-4": "q7",            // Self-Healing wird erst in q7 bewiesen (war fälschlich an q4)
  "q-flag-kubectl-n": "q5",   // kubectl -n <namespace> (q5)
  "q-ch3-2": "q7",            // Pod gelöscht → ersetzt (Self-Healing live, q7)
  "q-tools-ingress": "q7",    // Ingress (erstmals erklärt im q7-Dialog "Hafentor")
  // ----- YAML / deklarativ -----
  "q-ch4-1": "q8",            // imperativ vs. deklarativ (Adas Seekarten, q8)
  "q-ch4-2": "q8",            // kind-Feld im Manifest (q8)
  "q-ch4-3": "q8",            // YAML-Einrückung (q8)
  "q-flag-apply-f": "q8",     // kubectl apply -f (q8)
  // ----- Helm + reale Tools -----
  "q-ch5-3": "q10",           // values.yaml als Drehknöpfe (q10)
  "q-tools-stack": "q9",      // PostgreSQL/Redis (Werft-Aufzählung im q9-Dialog)
  "q-tools-monitoring": "q9", // Prometheus/Grafana (q9-Dialog)
  "q-flag-helm-set": "q11",   // helm upgrade --set (q11)
  // ----- Terraform -----
  "q-ch6-1": "q12",           // Infrastructure as Code (Theos Neuland, q12)
  "q-ch6-4": "q13",           // Kubernetes vs. Terraform (q13)
  // ----- Security + Tools -----
  "q-sec-2": "q14",           // Klartext-Passwörter in YAML / Secrets (q14)
  "q-tools-keycloak": "q9",   // Keycloak (erstmals erwähnt im q9-Dialog)
  // ----- Troubleshooting -----
  "q-ts-4": "q15",            // Debugging-Mantra get pods → describe → logs (q15)
  "q-ts-5": "q16",            // kubectl rollout restart (q16)
  // ----- Git / CI Bausteine -----
  "q-flag-git-commit-m": "q18",   // git commit -m (q18)
  "q-flag-git-checkout-b": "q19", // git checkout -b (q19)
  "q-flag-git-add-dot": "q20",    // git add . (q20)
};

/** Reine Prüflogik (testbar, ohne Spielzustand): Vergleicht je Karte die
 *  Freischalt-Position mit der Einführungs-Position (beides Indizes in
 *  Spielreihenfolge). Gibt eine Liste lesbarer Verstöße zurück – leer = alles gut.
 *
 *  - `unlockOrder`: Karte → früheste Quest-Position, an der sie in den Pool kommt.
 *  - `introOrder`:  Karte → Quest-Position, an der ihr Konzept eingeführt wird.
 *  Eine Karte ohne bekannte Einführungs-Position ist ebenfalls ein Verstoß
 *  (sonst könnte eine neue Karte ungeprüft durchrutschen). */
export function lernpfadVerstoesse(
  unlockOrder: Record<string, number>,
  introOrder: Record<string, number>,
): string[] {
  const out: string[] = [];
  for (const [card, unlock] of Object.entries(unlockOrder)) {
    const intro = introOrder[card];
    if (intro === undefined) {
      out.push(`${card}: keine Einführungs-Quest bekannt (in CONCEPT_INTRO eintragen)`);
    } else if (unlock < intro) {
      out.push(`${card}: freigeschaltet an Position ${unlock}, Konzept aber erst an Position ${intro} eingeführt`);
    }
  }
  return out;
}
