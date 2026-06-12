/* ===== KubeQuest – Spiel-Logik =====
 * Spielstand, XP/Ränge, Dublonen, Streak, Shop und Spaced Repetition (Leitner-System).
 * Gespeichert wird alles in localStorage – kein Server nötig.
 */

(function () {
  "use strict";

  const SAVE_KEY = "kubequest-save-v1";

  // Leitner-Boxen: Box 1 = täglich wiederholen, Box 5 = alle 16 Tage
  const BOX_INTERVALS = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };

  function today() {
    // Tagesnummer seit 1970 (lokale Zeit), für Streak & Wiederholungs-Fälligkeit
    const now = new Date();
    return Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);
  }

  const Game = {
    state: null,

    /* ---------- Spielstand ---------- */
    defaultState() {
      return {
        xp: 0,
        coins: 40, // kleines Startkapital für den ersten Shop-Besuch
        completedChapters: [],
        inventory: {},          // itemId -> Anzahl (Verbrauchsgegenstände)
        owned: [],              // gekaufte Themes/Schiffe
        activeTheme: "theme-see",
        activeShip: null,       // null = Schiff vom Rang
        review: {},             // itemId -> { box, due }
        streak: { count: 0, lastDay: 0 },
        stats: { quizRight: 0, quizWrong: 0, commands: 0, reviews: 0 },
      };
    },

    load() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        this.state = raw ? Object.assign(this.defaultState(), JSON.parse(raw)) : this.defaultState();
      } catch (e) {
        this.state = this.defaultState();
      }
      this.touchStreak();
      this.save();
    },

    save() {
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
      if (s.lastDay === t) return;            // heute schon gezählt
      s.count = (s.lastDay === t - 1) ? s.count + 1 : 1;
      s.lastDay = t;
    },

    coinMultiplier() {
      // Bis zu +50% Dublonen bei 10+ Tagen Streak
      return 1 + Math.min(this.state.streak.count, 10) * 0.05;
    },

    /* ---------- XP & Rang ---------- */
    rankIndex(xp) {
      const xpVal = xp === undefined ? this.state.xp : xp;
      let idx = 0;
      KQData.RANKS.forEach((r, i) => { if (xpVal >= r.xp) idx = i; });
      return idx;
    },

    rank() { return KQData.RANKS[this.rankIndex()]; },

    nextRank() {
      const i = this.rankIndex();
      return i < KQData.RANKS.length - 1 ? KQData.RANKS[i + 1] : null;
    },

    /** XP gutschreiben; gibt true zurück, wenn ein Rang-Aufstieg passiert ist. */
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

    /* ---------- Schiff (Anzeige) ---------- */
    ship() {
      if (this.state.activeShip) {
        const item = KQData.SHOP.find(s => s.id === this.state.activeShip);
        if (item) return item.ship;
      }
      return this.rank().ship;
    },

    /* ---------- Shop ---------- */
    buy(itemId) {
      const item = KQData.SHOP.find(s => s.id === itemId);
      if (!item) return { ok: false, msg: "Unbekannter Gegenstand." };
      if (item.type !== "consumable" && this.state.owned.includes(itemId)) {
        return { ok: false, msg: "Hast du schon!" };
      }
      if (!this.spendCoins(item.price)) {
        return { ok: false, msg: "Nicht genug Dublonen! Verdiene mehr in Missionen und im Tagesrapport." };
      }
      if (item.type === "consumable") {
        this.state.inventory[itemId] = (this.state.inventory[itemId] || 0) + 1;
      } else {
        this.state.owned.push(itemId);
        if (item.type === "theme") this.state.activeTheme = item.theme;
        if (item.type === "ship") this.state.activeShip = itemId;
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

    setTheme(themeIdOrDefault) {
      this.state.activeTheme = themeIdOrDefault;
      this.save();
    },

    setShip(shipIdOrNull) {
      this.state.activeShip = shipIdOrNull;
      this.save();
    },

    /* ---------- Kapitel-Fortschritt ---------- */
    isChapterDone(chapterId) {
      return this.state.completedChapters.includes(chapterId);
    },

    isChapterUnlocked(index) {
      if (index === 0) return true;
      return this.isChapterDone(KQData.CHAPTERS[index - 1].id);
    },

    completeChapter(chapterId) {
      if (!this.isChapterDone(chapterId)) {
        this.state.completedChapters.push(chapterId);
        // Befehls-Karten dieses Kapitels in die Wiederholung aufnehmen
        for (const card of KQData.CMD_CARDS.filter(c => c.chapter === chapterId)) {
          this.ensureReviewItem(card.id);
        }
        this.save();
      }
    },

    /* ---------- Spaced Repetition (Leitner) ---------- */
    ensureReviewItem(itemId) {
      if (!this.state.review[itemId]) {
        this.state.review[itemId] = { box: 1, due: today() + 1 };
      }
    },

    reviewResult(itemId, correct) {
      this.ensureReviewItem(itemId);
      const item = this.state.review[itemId];
      if (correct) {
        item.box = Math.min(5, item.box + 1);
        item.due = today() + BOX_INTERVALS[item.box];
      } else {
        item.box = 1;
        item.due = today(); // gleich nochmal fällig
      }
      this.save();
    },

    /** Quiz-Antwort aus einer Mission verbuchen (landet auch im Wiederholungs-Stapel). */
    missionQuizResult(itemId, correct) {
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
      // Schwierige (niedrige Box) zuerst
      due.sort((a, b) => a.box - b.box);
      return due.slice(0, limit || 12).map(d => d.id);
    },

    findReviewContent(itemId) {
      // Befehls-Karte?
      const card = KQData.CMD_CARDS.find(c => c.id === itemId);
      if (card) return { kind: "cmd", card };
      // Quizfrage aus einem Kapitel?
      for (const ch of KQData.CHAPTERS) {
        for (const step of ch.steps) {
          if (step.type === "quiz") {
            const q = step.items.find(i => i.id === itemId);
            if (q) return { kind: "quiz", q };
          }
        }
      }
      return null;
    },
  };

  window.Game = Game;
})();
