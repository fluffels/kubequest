/* Spaced Repetition (Leitner-System) der Spiel-Logik (#392, game.ts-Split).
 * Verwaltet die Wiederholungs-Karten (Box 1..5 + Fälligkeit), das sanfte Review-Gate
 * (#222/#323) und das freie, planungsneutrale Üben. Anwendungsschicht, Phaser-frei. */
import { KQContent } from "../content";
import { part, today } from "./shared";

const BOX_INTERVALS: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };

// Welche Karteikarten zusätzlich zu den Choice-Fragen pro Quest freigeschaltet werden
// Hinweis: Baustein-Karten (#231, q-flag-*) hängen an genau der Quest, in der ihr
// Flag/Teil per teach-Schritt eingeführt wird – erst eingeführt, dann abgefragt (#227).
const EXTRA_CARDS: Record<string, string[]> = {
  "docker-list-containers": ["q-flag-ps-a"],                                  // docker ps -a (eingeführt in docker-list-containers)
  "docker-run-options": ["q-ch1-3", "q-ch1-5", "q-flag-run-d", "q-flag-run-name"], // -d/--name (docker-run-options)
  "docker-build-image": ["q-flag-build-t"],                              // docker build -t/--tag, „tag“ entwirrt (#285)
  "k8s-first-deployment": ["q-ch2-1"],
  "k8s-inspect-pods": ["q-flag-kubectl-n"],                             // kubectl -n (k8s-inspect-pods)
  // q-ch2-4 (Self-Healing) bewusst erst ab k8s-self-healing: bewiesen wird Self-Healing dort,
  // nicht schon in k8s-first-deployment – Lernreihenfolge-Wächter #235 (siehe content/learnorder.ts).
  "k8s-self-healing": ["q-ch2-4", "q-ch3-2", "q-tools-ingress"],
  "k8s-apply-manifests": ["q-ch4-1", "q-ch4-2", "q-ch4-3", "q-flag-apply-f"], // apply -f (k8s-apply-manifests)
  "helm-release-install": ["q-ch5-3", "q-tools-stack", "q-tools-monitoring"],
  "helm-upgrade-rollback": ["q-flag-helm-set"],                             // helm upgrade --set (helm-upgrade-rollback)
  "terraform-state-destroy": ["q-ch6-1", "q-ch6-4"],
  "kraken-boss": ["q-sec-2", "q-tools-keycloak"],
  "k8s-debug-imagepull": ["q-ts-4"],
  "k8s-debug-crashloop": ["q-ts-5"],
  "git-version-control": ["q-flag-git-commit-m"],                         // git commit -m (git-version-control)
  "git-feature-branch": ["q-flag-git-checkout-b"],                       // git checkout -b (git-feature-branch)
  "git-pipeline": ["q-flag-git-add-dot"],                          // git add . (git-pipeline)
  // Umbrella-/Bundle-Charts (#264): in helm-umbrella-chart im Schluss-Dialog erklärt (dependencies,
  // inoffizieller Begriff, vendored vs. Registry, condition:-Toggle) – hier drillt Kralle nach.
  "helm-umbrella-chart": ["q-helm-deps", "q-helm-lock", "q-helm-umbrella-term", "q-helm-condition", "q-helm-subchart-source"],
  // Monitoring-Leuchtturm (#118, Phase 5): SR-Karten zu Begriffen, die NICHT als
  // Choice-reviewId in den Quests auftauchen – Scrape-Targets (observability-metrics), Log-Follow (observability-logs),
  // PrometheusRule/PromQL/Alertmanager (observability-alerts). Die übrigen q-obs-* hängen schon als
  // Choice-Fragen in observability-metrics–observability-alerts und kommen darüber in den Pool.
  "observability-metrics": ["q-obs-targets"],
  "observability-logs": ["q-obs-logs-follow"],
  "observability-alerts": ["q-obs-prom-rule", "q-obs-promql", "q-obs-alertmanager"],
};

/** Spaced-Repetition-Methoden der Game-Fassade (Leitner-Plan, Review-Gate, freies Üben). */
export const spacedRepetitionBundle = part({
  /* ---------- Spaced Repetition (Leitner) ---------- */
  ensureReviewItem(itemId: string) {
    if (!this.state.review[itemId]) {
      this.state.review[itemId] = { box: 1, due: today() + 1 };
    }
  },

  registerQuestCards(questId: string) {
    for (const c of KQContent.CMD_CARDS.filter(c => c.chapter === questId)) this.ensureReviewItem(c.id);
    for (const c of KQContent.CRAB_QUIZ.filter(c => c.chapter === questId)) this.ensureReviewItem(c.id);
    const quest = KQContent.QUESTS.find(q => q.id === questId);
    if (quest) {
      for (const step of quest.steps) {
        if (step.type === "choice" && step.reviewId) this.ensureReviewItem(step.reviewId);
      }
    }
    for (const id of EXTRA_CARDS[questId] || []) this.ensureReviewItem(id);
    this.save();
  },

  reviewResult(itemId: string, correct: boolean) {
    this.ensureReviewItem(itemId);
    const item = this.state.review[itemId];
    if (correct) {
      item.box = Math.min(5, item.box + 1);
      item.due = today() + BOX_INTERVALS[item.box];
    } else {
      item.box = 1;
      item.due = today();
    }
    this.save();
  },

  choiceResult(itemId: string, correct: boolean) {
    if (itemId) {
      this.ensureReviewItem(itemId);
      if (!correct) {
        this.state.review[itemId].box = 1;
        this.state.review[itemId].due = today() + 1;
      }
    }
    if (correct) this.state.stats.quizRight++; else this.state.stats.quizWrong++;
    this.save();
  },

  dueReviewItems(limit?: number) {
    const t = today();
    const due: { id: string; box: number }[] = [];
    for (const [id, info] of Object.entries(this.state.review)) {
      if (info.due <= t) due.push({ id, box: info.box });
    }
    due.sort((a, b) => a.box - b.box);
    return due.slice(0, limit || 10).map(d => d.id);
  },

  /** Sanftes Wiederholungs-Gate (#222/#323): true, wenn der Spieler am ANFANG einer
   *  Quest steht UND (a) mindestens eine Karte fällig ist ODER (b) seit dem letzten
   *  Gate-Feuern ≥ 3 Quests abgeschlossen wurden und es überhaupt Review-Items gibt.
   *  Variante (b) ist ein Quest-Count-Nudge (#323): bei verketteten Quests (z.B. docker-run-options→docker-build-image)
   *  kommt auch ohne Fälligkeiten ein Kralle-Beat. */
  shouldReviewGate(): boolean {
    if (this.state.questStep !== 0) return false;
    if (!this.currentQuest()) return false;
    if (this.dueReviewItems().length > 0) return true;
    return this.state.questsSinceGate >= 3 && Object.keys(this.state.review).length > 0;
  },

  /** Fürs FREIE Üben: alle gelernten Karten, unabhängig von der Fälligkeit, in
   *  zufälliger Reihenfolge. Rein lesend – verändert den Spaced-Repetition-Plan
   *  NICHT (anders als reviewResult). So kann man so oft üben, wie man will. */
  freeReviewItems(limit?: number) {
    const ids = Object.keys(this.state.review);
    for (let i = ids.length - 1; i > 0; i--) {       // Fisher-Yates-Shuffle
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids.slice(0, limit || 10);
  },

  findReviewContent(itemId: string) {
    const card = KQContent.CMD_CARDS.find(c => c.id === itemId);
    if (card) return { kind: "cmd", card };
    const q = KQContent.CRAB_QUIZ.find(q => q.id === itemId);
    if (q) return { kind: "quiz", q };
    return null;
  },
});
