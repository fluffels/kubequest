/* ===== KubeQuest 3.0 – Spiel-Logik =====
 * Spielstand, XP/Ränge, Dublonen, Hafen-Wirtschaft, Streak, Shop,
 * Quest-Fortschritt und Spaced Repetition.
 * Persistenz läuft über die SaveStore-Schicht (heute localStorage, später + Backend).
 */

import { KQContent } from "./content";
import { Sim as KQSim } from "./sim";
import { SaveStore } from "./store";
import type { GameState, QuestStep } from "./types";

  const BOX_INTERVALS: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };

  // Welche Karteikarten zusätzlich zu den Choice-Fragen pro Quest freigeschaltet werden
  const EXTRA_CARDS: Record<string, string[]> = {
    q3: ["q-ch1-3", "q-ch1-5"],
    q4: ["q-ch2-1", "q-ch2-4"],
    q7: ["q-ch3-2", "q-tools-ingress"],
    q8: ["q-ch4-1", "q-ch4-2", "q-ch4-3"],
    q10: ["q-ch5-3", "q-tools-stack", "q-tools-monitoring"],
    q13: ["q-ch6-1", "q-ch6-4"],
    q14: ["q-sec-2", "q-tools-keycloak"],
    q15: ["q-ts-4"],
    q16: ["q-ts-5"],
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
      player: { x: 0, y: 0 },
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
      stats: { commands: 0, reviews: 0, quizRight: 0, quizWrong: 0, piratesBeaten: 0, krakenBeaten: 0, stackBest: 0 },
      lastSeen: 0,
      clusterSnapshot: null,
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
        this.state = data ? Object.assign(makeDefaultState(), data) : makeDefaultState();
      } catch (e) {
        this.state = makeDefaultState();
      }
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
      const ws = (window as any).WorldScene; // Globals-Shim (siehe vite-env.d.ts)
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
    incomeRate() {
      if (!this.sim) return 0;
      const pods = this.sim.deployments.reduce((sum, d) => sum + (d.broken ? 0 : d.replicas), 0);
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
    /** Ist der aktuelle Schritt einer fürs Funkgerät? */
    isFunkStep(step: QuestStep | null) {
      return step && ["teach", "drill", "terminal"].includes(step.type);
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

  (window as any).Game = Game; // Globals-Shim (siehe vite-env.d.ts)
