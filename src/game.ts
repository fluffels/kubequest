/* ===== KubeQuest 3.0 – Spiel-Logik =====
 * Spielstand, XP/Ränge, Dublonen, Hafen-Wirtschaft, Streak, Shop,
 * Quest-Fortschritt und Spaced Repetition.
 * Persistenz läuft über die SaveStore-Schicht (heute localStorage, später + Backend).
 */

import { KQContent } from "./content";
import { Sim as KQSim } from "./sim";
import { SaveStore } from "./store";
import { SFX } from "./sfx";
import { worldScene } from "./runtime";
import type { GameState, QuestStep, FunkStep, EventMode } from "./types";

  /** Konkrete Stellschrauben pro Spiel-Feel-Stufe (#71). Bewusst eine reine
   *  Daten-Tabelle, damit Wirtschaft (game.ts) und Events (scenes.ts) dieselbe
   *  Quelle nutzen und sie testbar bleibt. */
  interface EventProfile {
    /** Faktor auf die Wartezeit bis zum nächsten Event (größer = seltener; Infinity = nie). */
    spawnScale: number;
    /** Faktor auf die Reparatur-Deadline (größer = mehr Zeit = sanfter). */
    deadlineScale: number;
    /** Anteil der Einnahmen, den ein kaputter Dienst trotzdem abwirft (0 = voller Malus, 1 = kein Malus). */
    malusFactor: number;
    /** Schaltet Zufalls-Events ganz an/aus. */
    enabled: boolean;
  }
  const EVENT_PROFILES: Record<EventMode, EventProfile> = {
    normal: { spawnScale: 1, deadlineScale: 1, malusFactor: 0, enabled: true },
    cozy: { spawnScale: 2, deadlineScale: 1.5, malusFactor: 0.5, enabled: true },
    off: { spawnScale: Infinity, deadlineScale: 1, malusFactor: 1, enabled: false },
  };
  function isEventMode(v: unknown): v is EventMode {
    return v === "normal" || v === "cozy" || v === "off";
  }

  const BOX_INTERVALS: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };

  // Welche Karteikarten zusätzlich zu den Choice-Fragen pro Quest freigeschaltet werden
  // Hinweis: Baustein-Karten (#231, q-flag-*) hängen an genau der Quest, in der ihr
  // Flag/Teil per teach-Schritt eingeführt wird – erst eingeführt, dann abgefragt (#227).
  const EXTRA_CARDS: Record<string, string[]> = {
    q2: ["q-flag-ps-a"],                                  // docker ps -a (eingeführt in q2)
    q3: ["q-ch1-3", "q-ch1-5", "q-flag-run-d", "q-flag-run-name"], // -d/--name (q3)
    q3b: ["q-flag-build-t"],                              // docker build -t/--tag, „tag“ entwirrt (#285)
    q4: ["q-ch2-1"],
    q5: ["q-flag-kubectl-n"],                             // kubectl -n (q5)
    // q-ch2-4 (Self-Healing) bewusst erst ab q7: bewiesen wird Self-Healing dort,
    // nicht schon in q4 – Lernreihenfolge-Wächter #235 (siehe content/learnorder.ts).
    q7: ["q-ch2-4", "q-ch3-2", "q-tools-ingress"],
    q8: ["q-ch4-1", "q-ch4-2", "q-ch4-3", "q-flag-apply-f"], // apply -f (q8)
    q10: ["q-ch5-3", "q-tools-stack", "q-tools-monitoring"],
    q11: ["q-flag-helm-set"],                             // helm upgrade --set (q11)
    q13: ["q-ch6-1", "q-ch6-4"],
    q14: ["q-sec-2", "q-tools-keycloak"],
    q15: ["q-ts-4"],
    q16: ["q-ts-5"],
    q18: ["q-flag-git-commit-m"],                         // git commit -m (q18)
    q19: ["q-flag-git-checkout-b"],                       // git checkout -b (q19)
    q20: ["q-flag-git-add-dot"],                          // git add . (q20)
    // Umbrella-/Bundle-Charts (#264): in q21 im Schluss-Dialog erklärt (dependencies,
    // inoffizieller Begriff, vendored vs. Registry, condition:-Toggle) – hier drillt Kralle nach.
    q21: ["q-helm-deps", "q-helm-lock", "q-helm-umbrella-term", "q-helm-condition", "q-helm-subchart-source"],
  };

  function today() {
    const now = new Date();
    return Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);
  }

  /** Frischer Spielstand – genau die Form von GameState. */
  function makeDefaultState(): GameState {
    return {
      xp: 0,
      coins: 40,
      character: null,
      // Erststart direkt neben Ole, dem Hafenmeister (#288): kein orientierungsloses
      // Loslaufen mehr – man steht in Redeweite vor der Hafenmeisterei, der Begrüßungs-
      // Dialog holt ab und der "!"-Marker/erste Auftrag ist sofort da. Ole steht auf
      // Kachel (26; 14,6) -> Solid-Kachel (26;15); dieser Punkt liegt eine Kachel
      // links davon (Pixel), begehbar und innerhalb der Redeweite (1,7 Kacheln).
      // Returning-Spieler überschreiben das mit ihrer gespeicherten Position.
      player: { x: 400, y: 248 },
      questIdx: 0,
      questStep: 0,
      taskIdx: 0,
      completedQuests: [],
      inventory: {},
      owned: [],
      activePet: null,
      activeFlag: null,
      review: {},
      streak: { count: 0, lastDay: 0 },
      streakHintShown: false,
      introSeen: false,
      stats: { commands: 0, reviews: 0, quizRight: 0, quizWrong: 0, piratesBeaten: 0, krakenBeaten: 0, stackBest: 0 },
      lastSeen: 0,
      clusterSnapshot: null,
      audio: { music: true, sfx: true, musicVol: 0.5, sfxVol: 0.8, track: "hafen" },
      settings: { events: "normal" },
    };
  }

  /* ---------- Defensive Validierung beim Laden ----------
   * readState() (store.ts) hebt einen Alt-Stand aufs aktuelle FORMAT, prüft aber
   * nicht den INHALT der Felder. Ein manipulierter Import (importData) oder ein
   * über viele Versionen gewanderter Stand kann kaputte/fremde Werte tragen:
   * falscher Typ, NaN/Infinity, negativ, Array statt Objekt. Früher übernahm
   * Object.assign(makeDefaultState(), data) solche Werte ungeprüft – NaN-Münzen
   * & Co. landeten direkt im Spiel.
   *
   * sanitizeState härtet jeden BEKANNTEN Feldwert gegen die Defaults ab:
   * unplausible Werte fallen auf den Default zurück, fehlende werden ergänzt,
   * unbekannte Zusatzfelder fallen weg. Ergebnis ist immer ein konsistenter
   * GameState – kein Crash, kein NaN. */
  function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
  }
  /** Endliche, nicht-negative Ganzzahl (XP, Münzen, Indizes, Zähler) – sonst Default. */
  function safeCount(v: unknown, def: number): number {
    return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : def;
  }
  /** Endliche Zahl (Weltkoordinaten dürfen auch negativ sein) – sonst Default. */
  function safeNum(v: unknown, def: number): number {
    return typeof v === "number" && Number.isFinite(v) ? v : def;
  }
  /** String oder null – jeder andere Typ wird zu null. */
  function safeStrOrNull(v: unknown): string | null {
    return typeof v === "string" ? v : null;
  }
  /** Array, gefiltert auf reine Strings (verwirft fremde Einträge). */
  function safeStrArray(v: unknown): string[] {
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  }
  /** Lautstärke: endliche Zahl auf [0,1] geklemmt – sonst Default. */
  function safeVol(v: unknown, def: number): number {
    return typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : def;
  }
  /** Spiel-Feel-Einstellungen absichern: nur eine bekannte EventMode übernehmen, sonst Default. */
  function safeSettings(v: unknown): GameState["settings"] {
    const d = makeDefaultState().settings;
    const s = isPlainObject(v) ? v : {};
    return { events: isEventMode(s.events) ? s.events : d.events };
  }
  /** Audio-Einstellungen gegen die Defaults absichern (Booleans + geklemmte Lautstärken). */
  function safeAudio(v: unknown): GameState["audio"] {
    const d = makeDefaultState().audio;
    const a = isPlainObject(v) ? v : {};
    return {
      music: typeof a.music === "boolean" ? a.music : d.music,
      sfx: typeof a.sfx === "boolean" ? a.sfx : d.sfx,
      musicVol: safeVol(a.musicVol, d.musicVol),
      sfxVol: safeVol(a.sfxVol, d.sfxVol),
      // Track als String übernehmen; SFX.applyConfig prüft zur Laufzeit gegen die
      // bekannten Themes und fällt sonst auf den Default zurück.
      track: typeof a.track === "string" ? a.track : d.track,
    };
  }

  function sanitizeState(raw: unknown): GameState {
    const def = makeDefaultState();
    if (!isPlainObject(raw)) return def; // primitiver/kaputter Stand -> komplett frisch

    // Inventar: nur Einträge mit endlicher, nicht-negativer Stückzahl behalten.
    const inventory: Record<string, number> = {};
    if (isPlainObject(raw.inventory)) {
      for (const [id, n] of Object.entries(raw.inventory)) {
        if (typeof n === "number" && Number.isFinite(n) && n >= 0) inventory[id] = Math.floor(n);
      }
    }

    // Spaced-Repetition: nur valide { box (1..5), due } übernehmen.
    const review: GameState["review"] = {};
    if (isPlainObject(raw.review)) {
      for (const [id, info] of Object.entries(raw.review)) {
        if (!isPlainObject(info)) continue;
        const box = Math.min(5, Math.max(1, safeCount(info.box, 1)));
        review[id] = { box, due: safeCount(info.due, 0) };
      }
    }

    // Stats: auf den Default-Stats aufsetzen und nur endliche Zahlen überschreiben;
    // dynamische Zusatz-Stats (z.B. stormsFixed) bleiben erhalten, solange Zahl.
    const stats = def.stats;
    if (isPlainObject(raw.stats)) {
      for (const [k, n] of Object.entries(raw.stats)) {
        if (typeof n === "number" && Number.isFinite(n)) stats[k] = n;
      }
    }

    const player = isPlainObject(raw.player) ? raw.player : {};
    const streak = isPlainObject(raw.streak) ? raw.streak : {};

    return {
      xp: safeCount(raw.xp, def.xp),
      coins: safeCount(raw.coins, def.coins),
      character: typeof raw.character === "number" && Number.isFinite(raw.character) ? raw.character : null,
      player: { x: safeNum(player.x, def.player.x), y: safeNum(player.y, def.player.y) },
      questIdx: safeCount(raw.questIdx, def.questIdx),
      questStep: safeCount(raw.questStep, def.questStep),
      taskIdx: safeCount(raw.taskIdx, def.taskIdx),
      completedQuests: safeStrArray(raw.completedQuests),
      inventory,
      owned: safeStrArray(raw.owned),
      activePet: safeStrOrNull(raw.activePet),
      activeFlag: safeStrOrNull(raw.activeFlag),
      review,
      streak: { count: safeCount(streak.count, 0), lastDay: safeCount(streak.lastDay, 0) },
      streakHintShown: typeof raw.streakHintShown === "boolean" ? raw.streakHintShown : def.streakHintShown,
      introSeen: typeof raw.introSeen === "boolean" ? raw.introSeen : def.introSeen,
      stats,
      lastSeen: safeCount(raw.lastSeen, def.lastSeen),
      // Snapshot ist ein freies Sim-Objekt; nur ein echtes Objekt akzeptieren, sonst null.
      clusterSnapshot: isPlainObject(raw.clusterSnapshot) ? raw.clusterSnapshot : null,
      audio: safeAudio(raw.audio),
      settings: safeSettings(raw.settings),
    };
  }

  export const Game = {
    // state & sim sind ab Modul-Init gesetzt (und werden von load() ersetzt) –
    // nie null. Das spart Null-Prüfungen in der gesamten Spiel-/Szenen-Logik.
    state: makeDefaultState(),
    sim: new KQSim({}),
    incomeAcc: 0,
    offlineEarnings: 0,

    load() {
      try {
        // readState liest die Versions-Hülle und migriert Alt-Stände aufs aktuelle Format.
        const data = SaveStore.readState();
        // Defensive Sanitisierung statt blindem Object.assign: kaputte/fremde
        // Feldwerte fallen auf Defaults zurück, statt ungeprüft ins Spiel zu kommen.
        this.state = sanitizeState(data);
      } catch (e) {
        this.state = makeDefaultState();
      }
      // Audio-Einstellungen aus dem Spielstand an die zentrale SFX-Schicht geben.
      SFX.applyConfig(this.state.audio);
      this.sim = new KQSim(this.state.clusterSnapshot || {});
      // Szenarien bereits erreichter Funk-Schritte wieder einmischen
      for (let qi = 0; qi <= Math.min(this.state.questIdx, KQContent.QUESTS.length - 1); qi++) {
        const quest = KQContent.QUESTS[qi];
        quest.steps.forEach((step, si) => {
          if (step.scenario && (qi < this.state.questIdx || si <= this.state.questStep)) {
            const sc = Object.assign({}, step.scenario);
            if (this.state.clusterSnapshot) delete sc.deployments;
            this.sim.mergeScenario(sc);
          }
        });
      }
      this.touchStreak();
      // Offline-Einnahmen: dein Hafen hat weitergearbeitet (max. 4 Stunden, halber Satz)
      this.offlineEarnings = 0;
      if (this.state.lastSeen) {
        const minutes = Math.min(240, (Date.now() - this.state.lastSeen) / 60000);
        this.offlineEarnings = Math.floor(minutes * this.incomeRate() * 0.5);
        if (this.offlineEarnings > 0) this.state.coins += this.offlineEarnings;
      }
      this.save();
    },

    save() {
      if (this.sim) this.state.clusterSnapshot = this.sim.snapshot();
      const ws = worldScene();
      if (ws && ws.player) {
        this.state.player = { x: ws.player.x, y: ws.player.y };
      }
      this.state.lastSeen = Date.now();
      SaveStore.writeState(this.state); // legt den Stand in der aktuellen Versions-Hülle ab
    },

    reset() {
      SaveStore.remove();
      this.load();
    },

    /* ---------- Spielstand als Datei sichern / laden ---------- */
    exportData() {
      this.save();
      return SaveStore.read();
    },

    importData(json: string) {
      JSON.parse(json); // wirft bei ungültiger Datei
      SaveStore.write(json);
    },

    /* ---------- Hafen-Wirtschaft ---------- */
    /** Dublonen pro Minute: jede GESUNDE Pod-Kopie 0.5, jeder Service 1. Kaputte Deployments verdienen nichts! */
    /** Aktives Spiel-Feel-Profil (Frequenz/Härte der Events + Verdienst-Malus, #71). */
    eventProfile(): EventProfile {
      return EVENT_PROFILES[this.state.settings.events] || EVENT_PROFILES.normal;
    },

    /** Spiel-Feel-Stufe setzen und persistieren (vom Menü aufgerufen). */
    setEventMode(mode: EventMode) {
      if (!isEventMode(mode)) return;
      this.state.settings.events = mode;
      this.save();
    },

    incomeRate() {
      if (!this.sim) return 0;
      // Kaputte Dienste verdienen normal nichts (malusFactor 0). Im Cozy-Modus
      // ist der Malus gemildert (0.5), im Aus-Modus aufgehoben (1) – Anti-Frust (#71).
      const malus = this.eventProfile().malusFactor;
      const pods = this.sim.deployments.reduce((sum, d) => sum + (d.broken ? d.replicas * malus : d.replicas), 0);
      return pods * 0.5 + this.sim.services.length * 1;
    },

    /** Wird von der Spielschleife getickt; gibt ausgezahlte Dublonen zurück. */
    economyTick(dt: number) {
      this.incomeAcc += this.incomeRate() / 60 * dt;
      if (this.incomeAcc >= 1) {
        const payout = Math.floor(this.incomeAcc);
        this.incomeAcc -= payout;
        this.state.coins += payout;
        return payout;
      }
      return 0;
    },

    /* ---------- Streak ---------- */
    touchStreak() {
      const t = today();
      const s = this.state.streak;
      if (s.lastDay === t) return;
      s.count = (s.lastDay === t - 1) ? s.count + 1 : 1;
      s.lastDay = t;
    },

    coinMultiplier() {
      return 1 + Math.min(this.state.streak.count, 10) * 0.05;
    },

    /* ---------- XP & Rang ---------- */
    rankIndex(xp?: number) {
      const v = xp === undefined ? this.state.xp : xp;
      let idx = 0;
      KQContent.RANKS.forEach((r, i) => { if (v >= r.xp) idx = i; });
      return idx;
    },
    rank() { return KQContent.RANKS[this.rankIndex()]; },
    nextRank() {
      const i = this.rankIndex();
      return i < KQContent.RANKS.length - 1 ? KQContent.RANKS[i + 1] : null;
    },

    addXp(amount: number) {
      const before = this.rankIndex();
      this.state.xp += amount;
      const after = this.rankIndex();
      this.save();
      return after > before;
    },

    addCoins(amount: number) {
      const real = Math.round(amount * this.coinMultiplier());
      this.state.coins += real;
      this.save();
      return real;
    },

    spendCoins(amount: number) {
      if (this.state.coins < amount) return false;
      this.state.coins -= amount;
      this.save();
      return true;
    },

    /* ---------- Shop ---------- */
    buy(itemId: string) {
      const item = KQContent.SHOP.find(s => s.id === itemId);
      if (!item) return { ok: false, msg: "Unbekannte Ware." };
      if (item.type !== "consumable" && this.state.owned.includes(itemId)) {
        return { ok: false, msg: "Hast du schon!" };
      }
      if (!this.spendCoins(item.price)) {
        return { ok: false, msg: "Nicht genug Dublonen! Quests, Üben und ein gesunder Hafen füllen den Beutel." };
      }
      if (item.type === "consumable") {
        this.state.inventory[itemId] = (this.state.inventory[itemId] || 0) + 1;
      } else {
        this.state.owned.push(itemId);
        if (item.type === "pet") this.state.activePet = itemId;
        if (item.type === "flag") this.state.activeFlag = itemId;
      }
      this.save();
      return { ok: true, msg: item.name + " gekauft!" };
    },

    useConsumable(itemId: string) {
      if (!this.state.inventory[itemId]) return false;
      this.state.inventory[itemId]--;
      this.save();
      return true;
    },

    hasUpgrade(id: string) { return this.state.owned.includes(id); },

    /* ---------- Quests ---------- */
    currentQuest() { return KQContent.QUESTS[this.state.questIdx] || null; },
    currentStep() {
      const q = this.currentQuest();
      return q ? q.steps[this.state.questStep] || null : null;
    },
    /** Ist der aktuelle Schritt einer fürs Funkgerät? (Typ-Guard fürs Narrowing) */
    isFunkStep(step: QuestStep | null): step is FunkStep {
      return !!step && (step.type === "teach" || step.type === "drill" || step.type === "terminal");
    },
    /** Aufgabenliste eines Funk-Schritts (drills werden von der UI generiert). */
    stepTasks(step: QuestStep) {
      if (step.type === "terminal") return step.tasks;
      if (step.type === "teach") return [step.cmd];
      return null;
    },

    advanceStep() {
      const q = this.currentQuest();
      if (!q) return {};
      this.state.questStep++;
      this.state.taskIdx = 0;
      if (this.state.questStep >= q.steps.length) {
        this.state.completedQuests.push(q.id);
        this.state.questIdx++;
        this.state.questStep = 0;
        this.save();
        return { questDone: q };
      }
      this.save();
      return {};
    },
    allQuestsDone() { return this.state.questIdx >= KQContent.QUESTS.length; },

    /* ---------- Üben (Drills bei NPCs) ---------- */
    practiceDrillsFor(npcId: string) {
      const pool = KQContent.PRACTICE[npcId] || [];
      return pool.filter(p => this.state.completedQuests.includes(p.after)).map(p => p.drill);
    },

    /* ---------- Spaced Repetition (Leitner) ---------- */
    ensureReviewItem(itemId: string) {
      if (!this.state.review[itemId]) {
        this.state.review[itemId] = { box: 1, due: today() + 1 };
      }
    },

    registerQuestCards(questId: string) {
      for (const c of KQContent.CMD_CARDS.filter(c => c.chapter === questId)) this.ensureReviewItem(c.id);
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

    /** Sanftes Wiederholungs-Gate (#222): true, wenn der Spieler gerade am ANFANG
     *  einer Quest steht (Schritt 0) und mindestens eine Karte fällig ist. Dann
     *  frischt er erst kurz auf, bevor die nächste Hauptquest startet. Sind keine
     *  Karten fällig (oder steht man mitten in einer Quest / sind alle durch),
     *  blockiert nichts – das Gate ist weich und nur so oft wie nötig. */
    shouldReviewGate(): boolean {
      if (this.state.questStep !== 0) return false;
      if (!this.currentQuest()) return false;
      return this.dueReviewItems().length > 0;
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
  };
