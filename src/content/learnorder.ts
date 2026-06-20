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
 * landen (konkret gefunden: `q-ch2-4` Self-Healing hing an k8s-first-deployment, bewiesen wird
 * Self-Healing aber erst in k8s-self-healing, siehe #227).
 *
 * Darum führt diese Map für JEDE über EXTRA_CARDS platzierte Karte die Quest auf,
 * in der ihr Konzept zum ERSTEN Mal eingeführt wird (Beleg jeweils im Kommentar).
 * Der Test (test/learnorder.test.ts) prüft: Freischalt-Quest ≥ Einführungs-Quest
 * (in Spielreihenfolge = Reihenfolge des QUESTS-Arrays, NICHT der Nummer).
 *
 * Reihenfolge im Array weicht von den Nummern ab, z.B. … kraken-boss → k8s-configmap-secret → k8s-debug-imagepull …; deshalb
 * wird die Reihenfolge im Test immer aus dem QUESTS-Array abgeleitet, nie aus der Zahl.
 */

/** Konzept-Karte → Quest, in der ihr Konzept zum ersten Mal eingeführt wird.
 *  Gepflegt für alle Karten, die der Pool über die EXTRA_CARDS-Map (game.ts)
 *  freischaltet. Neue EXTRA_CARDS-Karte? Hier ihren Einführungs-Quest eintragen –
 *  sonst schlägt der Vollständigkeits-Test fehl. */
export const CONCEPT_INTRO: Record<string, string> = {
  // ----- Docker-Grundlagen -----
  "q-flag-ps-a": "docker-list-containers",        // docker ps -a (Variante "auch gestoppte" in docker-list-containers eingeführt)
  "q-ch1-3": "docker-first-container",            // Registry/Docker Hub (docker pull aus der Registry, docker-first-container)
  "q-ch1-5": "docker-list-containers",            // Image besteht aus Schichten (Stapel-Spiel bei Bo, docker-list-containers)
  "q-flag-run-d": "docker-run-options",       // docker run -d (docker-run-options)
  "q-flag-run-name": "docker-run-options",    // docker run --name (docker-run-options)
  "q-flag-build-t": "docker-build-image",    // docker build -t/--tag, „tag“-Bedeutungen (docker-build-image, #285)
  // ----- Kubernetes-Grundlagen -----
  "q-ch2-1": "k8s-first-deployment",            // wofür Kubernetes (Hafen wird Cluster, k8s-first-deployment)
  "q-ch2-4": "k8s-self-healing",            // Self-Healing wird erst in k8s-self-healing bewiesen (war fälschlich an k8s-first-deployment)
  "q-flag-kubectl-n": "k8s-inspect-pods",   // kubectl -n <namespace> (k8s-inspect-pods)
  "q-ch3-2": "k8s-self-healing",            // Pod gelöscht → ersetzt (Self-Healing live, k8s-self-healing)
  "q-tools-ingress": "k8s-self-healing",    // Ingress (erstmals erklärt im k8s-self-healing-Dialog "Hafentor")
  // ----- YAML / deklarativ -----
  "q-ch4-1": "k8s-apply-manifests",            // imperativ vs. deklarativ (Adas Seekarten, k8s-apply-manifests)
  "q-ch4-2": "k8s-apply-manifests",            // kind-Feld im Manifest (k8s-apply-manifests)
  "q-ch4-3": "k8s-apply-manifests",            // YAML-Einrückung (k8s-apply-manifests)
  "q-flag-apply-f": "k8s-apply-manifests",     // kubectl apply -f (k8s-apply-manifests)
  // ----- Helm + reale Tools -----
  "q-ch5-3": "helm-release-install",           // values.yaml als Drehknöpfe (helm-release-install)
  "q-tools-stack": "helm-intro",      // PostgreSQL/Redis (Werft-Aufzählung im helm-intro-Dialog)
  "q-tools-monitoring": "helm-intro", // Prometheus/Grafana (helm-intro-Dialog)
  "q-flag-helm-set": "helm-upgrade-rollback",   // helm upgrade --set (helm-upgrade-rollback)
  // Umbrella-/Bundle-Charts (#264): im helm-umbrella-chart-Schluss-Dialog (Runa) erklärt
  "q-helm-deps": "helm-umbrella-chart",            // Umbrella-Chart = Eltern-Chart mit dependencies:
  "q-helm-lock": "helm-umbrella-chart",            // helm dependency update / Chart.lock
  "q-helm-umbrella-term": "helm-umbrella-chart",   // „Umbrella“ ist inoffizieller Begriff
  "q-helm-condition": "helm-umbrella-chart",       // condition:-Toggle für Subcharts
  "q-helm-subchart-source": "helm-umbrella-chart", // vendored vs. aus Registry
  // ----- Terraform -----
  "q-ch6-1": "terraform-intro",           // Infrastructure as Code (Theos Neuland, terraform-intro)
  "q-ch6-4": "terraform-state-destroy",           // Kubernetes vs. Terraform (terraform-state-destroy)
  // ----- Security + Tools -----
  "q-sec-2": "kraken-boss",           // Klartext-Passwörter in YAML / Secrets (kraken-boss)
  "q-tools-keycloak": "helm-intro",   // Keycloak (erstmals erwähnt im helm-intro-Dialog)
  // ----- Troubleshooting -----
  "q-ts-4": "k8s-debug-imagepull",            // Debugging-Mantra get pods → describe → logs (k8s-debug-imagepull)
  "q-ts-5": "k8s-debug-crashloop",            // kubectl rollout restart (k8s-debug-crashloop)
  // ----- Git / CI Bausteine -----
  "q-flag-git-commit-m": "git-version-control",   // git commit -m (git-version-control)
  "q-flag-git-checkout-b": "git-feature-branch", // git checkout -b (git-feature-branch)
  "q-flag-git-add-dot": "git-pipeline",    // git add . (git-pipeline)
  // ----- Monitoring-Leuchtturm (Phase 5, #118) -----
  "q-obs-targets": "observability-metrics",         // Scrape-Targets up/down (Prometheus-Scrape in observability-metrics eingeführt)
  "q-obs-logs-follow": "observability-logs",     // kubectl logs -f/--follow (teach-Schritt in observability-logs)
  "q-obs-promql": "observability-alerts",          // PromQL erstmals als expr der PrometheusRule gezeigt (observability-alerts)
  "q-obs-prom-rule": "observability-alerts",       // PrometheusRule angewandt & erklärt (observability-alerts)
  "q-obs-alertmanager": "observability-alerts",    // Alertmanager im observability-alerts-Dialog eingeführt
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
