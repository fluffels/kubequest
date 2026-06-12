/* ===== KubeQuest 2.0 – Spiel-Logik =====
 * Spielstand, XP/Ränge, Dublonen, Streak, Shop, Quest-Fortschritt
 * und Spaced Repetition (Leitner-System). Alles in localStorage.
 */

(function () {
  "use strict";

  const SAVE_KEY = "kubequest-save-v2";
  const BOX_INTERVALS = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };

  function today() {
    const now = new Date();
    return Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);
  }

  const Game = {
    state: null,
    sim: null, // die eine, dauerhafte Cluster-Welt

    defaultState() {
      return {
        xp: 0,
        coins: 40,
        character: null,          // Sprite-Index, bei Spielstart gewählt
        player: { x: 0, y: 0 },   // Position (Welt-Pixel), 0 = Spawn benutzen
        questIdx: 0,              // Index in KQContent.QUESTS
        questStep: 0,             // Schritt innerhalb der Quest
        completedQuests: [],
        inventory: {},            // consumables: id -> Anzahl
        owned: [],                // pets/flaggen
        activePet: null,
        activeFlag: null,
        review: {},               // itemId -> { box, due }
        streak: { count: 0, lastDay: 0 },
        stats: { commands: 0, reviews: 0, quizRight: 0, quizWrong: 0 },
        clusterSnapshot: null,    // gespeicherter Sim-Zustand
      };
    },

    load() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        this.state = raw ? Object.assign(this.defaultState(), JSON.parse(raw)) : this.defaultState();
      } catch (e) {
        this.state = this.defaultState();
      }
      this.sim = new KQSim(this.state.clusterSnapshot || {});
      // Szenarien aller bereits erreichten Terminal-Schritte wieder einmischen
      // (Dateien & applyEffects stecken nicht komplett im Snapshot)
      for (let qi = 0; qi <= Math.min(this.state.questIdx, KQContent.QUESTS.length - 1); qi++) {
        const quest = KQContent.QUESTS[qi];
        quest.steps.forEach((step, si) => {
          if (step.type === "terminal" && step.scenario &&
              (qi < this.state.questIdx || si <= this.state.questStep)) {
            const sc = Object.assign({}, step.scenario);
            if (this.state.clusterSnapshot) delete sc.deployments; // schon im Snapshot enthalten
            this.sim.mergeScenario(sc);
          }
        });
      }
      this.touchStreak();
      this.save();
    },

    save() {
      if (this.sim) this.state.clusterSnapshot = this.sim.snapshot();
      if (window.World && World.player && World.player.x) {
        this.state.player = { x: World.player.x, y: World.player.y };
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
    },

    reset() {
      localStorage.removeItem(SAVE_KEY);
      this.load();
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
    rankIndex(xp) {
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

    addXp(amount) {
      const before = this.rankIndex();
      this.state.xp += amount;
      const after = this.rankIndex();
      this.save();
      return after > before;
    },

    addCoins(amount) {
      const real = Math.round(amount * this.coinMultiplier());
      this.state.coins += real;
      this.save();
      return real;
    },

    spendCoins(amount) {
      if (this.state.coins < amount) return false;
      this.state.coins -= amount;
      this.save();
      return true;
    },

    /* ---------- Shop ---------- */
    buy(itemId) {
      const item = KQContent.SHOP.find(s => s.id === itemId);
      if (!item) return { ok: false, msg: "Unbekannte Ware." };
      if (item.type !== "consumable" && this.state.owned.includes(itemId)) {
        return { ok: false, msg: "Hast du schon!" };
      }
      if (!this.spendCoins(item.price)) {
        return { ok: false, msg: "Nicht genug Dublonen! Quests und Krabben-Quiz füllen den Beutel." };
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

    useConsumable(itemId) {
      if (!this.state.inventory[itemId]) return false;
      this.state.inventory[itemId]--;
      this.save();
      return true;
    },

    /* ---------- Quests ---------- */
    currentQuest() {
      return KQContent.QUESTS[this.state.questIdx] || null;
    },
    currentStep() {
      const q = this.currentQuest();
      return q ? q.steps[this.state.questStep] || null : null;
    },
    advanceStep() {
      const q = this.currentQuest();
      if (!q) return;
      this.state.questStep++;
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
    allQuestsDone() {
      return this.state.questIdx >= KQContent.QUESTS.length;
    },

    /* ---------- Spaced Repetition (Leitner) ---------- */
    ensureReviewItem(itemId) {
      if (!this.state.review[itemId]) {
        this.state.review[itemId] = { box: 1, due: today() + 1 };
      }
    },

    registerQuestCards(questId) {
      for (const c of KQContent.CMD_CARDS.filter(c => c.chapter === questId)) this.ensureReviewItem(c.id);
      // Quiz-Karten des Kapitels (gleiche Nummer) ebenfalls aktivieren
      const chapterNo = questId.replace("q", "");
      for (const qz of KQContent.CRAB_QUIZ.filter(q => q.id.startsWith("q-ch" + chapterNo + "-"))) {
        this.ensureReviewItem(qz.id);
      }
      this.save();
    },

    reviewResult(itemId, correct) {
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

    choiceResult(itemId, correct) {
      if (!itemId) return;
      this.ensureReviewItem(itemId);
      if (!correct) {
        this.state.review[itemId].box = 1;
        this.state.review[itemId].due = today() + 1;
      }
      if (correct) this.state.stats.quizRight++; else this.state.stats.quizWrong++;
      this.save();
    },

    dueReviewItems(limit) {
      const t = today();
      const due = [];
      for (const [id, info] of Object.entries(this.state.review)) {
        if (info.due <= t) due.push({ id, box: info.box });
      }
      due.sort((a, b) => a.box - b.box);
      return due.slice(0, limit || 10).map(d => d.id);
    },

    findReviewContent(itemId) {
      const card = KQContent.CMD_CARDS.find(c => c.id === itemId);
      if (card) return { kind: "cmd", card };
      const q = KQContent.CRAB_QUIZ.find(q => q.id === itemId);
      if (q) return { kind: "quiz", q };
      return null;
    },
  };

  window.Game = Game;
})();
