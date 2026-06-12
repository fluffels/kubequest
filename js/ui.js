/* ===== KubeQuest 2.0 – UI & Quest-Steuerung =====
 * Dialoge, Funkgerät (Terminal), Shop, Krabben-Quiz, Logbuch, HUD.
 */

(function () {
  "use strict";

  const $ = id => document.getElementById(id);

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const UI = {
    dialogue: null,   // { npc, lines, idx, choice, onDone }
    termLog: [],
    review: null,

    /* ========== Blockierung (Welt einfrieren?) ========== */
    blocking() {
      return !!this.dialogue ||
        !$("overlay-terminal").classList.contains("hidden") ||
        !$("overlay-quest").classList.contains("hidden") ||
        !$("overlay-shop").classList.contains("hidden") ||
        !$("overlay-review").classList.contains("hidden") ||
        !$("charselect").classList.contains("hidden");
    },

    closeOverlays() {
      ["overlay-terminal", "overlay-quest", "overlay-shop", "overlay-review"].forEach(id => $(id).classList.add("hidden"));
    },

    /* ========== HUD & Toasts ========== */
    refreshHud() {
      const s = Game.state;
      const rank = Game.rank();
      const next = Game.nextRank();
      $("hud-rankname").textContent = rank.icon + " " + rank.name;
      $("hud-coins").textContent = s.coins;
      $("hud-streak").textContent = s.streak.count;
      if (next) {
        $("hud-xpfill").style.width = Math.min(100, ((s.xp - rank.xp) / (next.xp - rank.xp)) * 100) + "%";
        $("hud-xptext").textContent = s.xp + " / " + next.xp + " XP";
      } else {
        $("hud-xpfill").style.width = "100%";
        $("hud-xptext").textContent = s.xp + " XP – Maximalrang!";
      }
      this.refreshQuestHint();
    },

    refreshQuestHint() {
      const el = $("hud-quest");
      if (Game.allQuestsDone()) {
        el.innerHTML = "🏅 Grundausbildung geschafft – tägliche Quizrunde bei Krabbe Kralle auf deinem Schiff!";
        return;
      }
      const q = Game.currentQuest();
      const step = Game.currentStep();
      if (!q || !step) { el.textContent = ""; return; }
      if (step.type === "terminal") {
        el.innerHTML = "📜 <b>" + q.title + "</b> – 📻 Öffne dein Funkgerät (<b>T</b>)!";
      } else {
        const npc = KQContent.NPCS[step.npc];
        el.innerHTML = "📜 <b>" + q.title + "</b> – Sprich mit <b>" + npc.name + "</b> (" + npc.title + ")";
      }
    },

    toast(msg, cls) {
      const t = document.createElement("div");
      t.className = "toast" + (cls ? " " + cls : "");
      t.innerHTML = msg;
      $("toasts").appendChild(t);
      setTimeout(() => t.remove(), 4000);
    },

    reward(xp, coins, label) {
      const rankUp = Game.addXp(xp);
      const realCoins = coins > 0 ? Game.addCoins(coins) : 0;
      let msg = "+" + xp + " XP";
      if (realCoins > 0) msg += " · +" + realCoins + " 🪙";
      if (label) msg = label + " " + msg;
      this.toast(msg);
      if (rankUp) {
        const r = Game.rank();
        this.toast("🎉 <b>Beförderung!</b> Du bist jetzt <b>" + r.icon + " " + r.name + "</b>!", "rankup");
        World.burst(World.player.x, World.player.y - 10, "#ffc857", 18);
      }
      this.refreshHud();
    },

    /* ========== Interaktion in der Welt ========== */
    questMarkerFor(npcId) {
      const step = Game.currentStep();
      return !!(step && (step.type === "dialog" || step.type === "choice") && step.npc === npcId);
    },

    updatePrompt() {
      const p = $("prompt");
      if (this.blocking()) { p.classList.add("hidden"); return; }
      const near = World.nearestInteractable();
      if (!near) { p.classList.add("hidden"); return; }
      const n = near.npc;
      let label = "💬 Mit " + n.name + " reden";
      if (n.id === "pelle") label = "🛒 Bei Pelle einkaufen";
      if (n.id === "kralle") label = "🦀 Quizrunde mit Kralle";
      p.innerHTML = "<b>E</b> – " + label;
      p.classList.remove("hidden");
    },

    interact() {
      const near = World.nearestInteractable();
      if (!near) return;
      const npc = near.npc;
      if (npc.id === "pelle") return this.openShop();
      if (npc.id === "kralle") return this.openReview();

      const step = Game.currentStep();
      if (step && (step.type === "dialog" || step.type === "choice") && step.npc === npc.id) {
        this.runQuestStep();
      } else {
        // Smalltalk
        const lines = KQContent.SMALLTALK[npc.id] || ["…"];
        this.showDialogue(npc.id, [lines[Math.floor(Math.random() * lines.length)]]);
      }
    },

    /* ========== Quest-Maschine ========== */
    runQuestStep() {
      const step = Game.currentStep();
      if (!step) return;
      if (step.type === "dialog") {
        this.showDialogue(step.npc, step.lines, () => {
          this.afterStep();
        });
      } else if (step.type === "choice") {
        this.showChoice(step, () => {
          this.afterStep();
        });
      }
    },

    afterStep() {
      const result = Game.advanceStep() || {};
      if (result.questDone) {
        const q = result.questDone;
        Game.registerQuestCards(q.id);
        this.reward(q.rewardXp, q.rewardCoins, "🏁 Quest „" + q.title + "“ abgeschlossen!");
        World.burst(World.player.x, World.player.y - 8, "#6fdc8c", 16);
        Game.state.taskIdx = 0;
        Game.save();
        this.refreshHud();
        return;
      }
      const next = Game.currentStep();
      if (!next) return;
      if (next.type === "terminal") {
        Game.state.taskIdx = 0;
        if (next.scenario) Game.sim.mergeScenario(next.scenario);
        Game.save();
        this.refreshHud();
      } else if (next.type === "dialog" || next.type === "choice") {
        // Direkt weiterreden (gleicher Gesprächsfluss)
        this.refreshHud();
        if (!this.dialogue) this.runQuestStep();
      }
    },

    /* ========== Dialog-Anzeige ========== */
    showDialogue(npcId, lines, onDone) {
      const npc = KQContent.NPCS[npcId];
      this.dialogue = { npcId, lines, idx: 0, onDone, choice: null };
      $("dlg-name").textContent = npc.name + " · " + npc.title;
      Engine.drawPortrait($("dlg-portrait-canvas"), "dungeon", npc.sprite);
      $("dlg-choices").innerHTML = "";
      $("dialogue").classList.remove("hidden");
      this.renderDialogueLine();
    },

    renderDialogueLine() {
      const d = this.dialogue;
      $("dlg-text").innerHTML = d.lines[d.idx];
      $("dlg-next").textContent = d.idx < d.lines.length - 1 ? "▼ weiter (E)" : "✔ fertig (E)";
      $("dlg-next").classList.remove("hidden");
    },

    advanceDialogue() {
      const d = this.dialogue;
      if (!d || d.choice) return;
      d.idx++;
      if (d.idx < d.lines.length) {
        this.renderDialogueLine();
      } else {
        this.dialogue = null;
        $("dialogue").classList.add("hidden");
        if (d.onDone) d.onDone();
      }
    },

    showChoice(step, onDone) {
      const npc = KQContent.NPCS[step.npc];
      this.dialogue = { npcId: step.npc, lines: [], idx: 0, onDone, choice: step };
      $("dlg-name").textContent = npc.name + " · " + npc.title;
      Engine.drawPortrait($("dlg-portrait-canvas"), "dungeon", npc.sprite);
      $("dlg-text").innerHTML = "🤔 " + step.q;
      $("dlg-next").classList.add("hidden");
      const box = $("dlg-choices");
      box.innerHTML = "";
      for (const opt of shuffled(step.options)) {
        const btn = document.createElement("button");
        btn.innerHTML = opt.t;
        btn.onclick = () => this.answerChoice(step, opt, btn);
        box.appendChild(btn);
      }
      $("dialogue").classList.remove("hidden");
    },

    answerChoice(step, opt, btn) {
      const d = this.dialogue;
      if (!d || d.answered) return;
      d.answered = true;
      document.querySelectorAll("#dlg-choices button").forEach(b => {
        b.disabled = true;
        if (b === btn) b.classList.add(opt.ok ? "correct" : "wrong");
      });
      Game.choiceResult(step.reviewId, opt.ok);
      if (opt.ok) this.reward(12, 6);
      $("dlg-text").innerHTML = (opt.ok ? "✅ " : "❌ ") + opt.reply;
      $("dlg-next").textContent = "✔ weiter (E)";
      $("dlg-next").classList.remove("hidden");
      // E schließt jetzt den Dialog ab (letzte „Zeile“ erreicht)
      d.choice = null;
      d.lines = [""];
      d.idx = 0;
    },

    /* ========== Funkgerät / Terminal ========== */
    toggleTerminal() {
      const ov = $("overlay-terminal");
      if (!ov.classList.contains("hidden")) { this.closeOverlays(); return; }
      this.closeOverlays();
      ov.classList.remove("hidden");
      this.renderTermTasks();
      this.termRedraw();
      $("term-input").focus();
    },

    currentTerminalStep() {
      const step = Game.currentStep();
      return step && step.type === "terminal" ? step : null;
    },

    renderTermTasks() {
      const box = $("term-tasks");
      const step = this.currentTerminalStep();
      const actions = $("term-actions");
      if (!step) {
        box.innerHTML = `<div class="tt-head">🧪 Freies Funken</div>
          <div class="dim">Gerade kein Auftrag – probier aus, was du gelernt hast!
          Alles, was du hier anrichtest, siehst du draußen in der Welt.
          <br><br>Mit <code>help</code> siehst du alle Befehle.</div>
          <div id="tt-feedback"></div>`;
        actions.innerHTML = "";
        return;
      }
      const taskIdx = Game.state.taskIdx || 0;
      const q = Game.currentQuest();
      let html = `<div class="tt-head">📜 ${q.title}: ${step.brief}</div>`;
      step.tasks.forEach((t, i) => {
        const cls = i < taskIdx ? "done" : i === taskIdx ? "current" : "";
        const mark = i < taskIdx ? "✅" : i === taskIdx ? "▶️" : "·";
        html += `<div class="tt-item ${cls}">${mark} ${i === taskIdx || i < taskIdx ? t.text : "???"}</div>`;
      });
      html += `<div id="tt-feedback"></div>`;
      box.innerHTML = html;

      const fernrohr = Game.state.inventory["fernrohr"] || 0;
      const kompass = Game.state.inventory["kompass"] || 0;
      actions.innerHTML = `
        <button onclick="UI.termHint()">🔭 Hinweis ${fernrohr > 0 ? "(Fernrohr: " + fernrohr + ")" : "(25 🪙)"}</button>
        <button onclick="UI.termSolution()">🧭 Lösung ${kompass > 0 ? "(Kompass: " + kompass + ")" : "(50 🪙)"}</button>
        <span class="dim" style="align-self:center">Tipp: selbst tippen statt kopieren – das Tippen ist das Training!</span>`;
    },

    termRedraw() {
      const out = $("term-out");
      out.innerHTML = this.termLog.join("\n");
      out.scrollTop = out.scrollHeight;
    },

    termSubmit(line) {
      if (!line.trim()) return;
      const result = Game.sim.exec(line);
      if (result.clear) { this.termLog = []; this.termRedraw(); return; }
      this.termLog.push('<span class="t-cmd">crew@hafen:~$ ' + esc(line) + "</span>");
      if (result.output) {
        let text = esc(result.output).replace(/💡[^\n]*/g, s => '</span><span class="t-tip">' + s + '</span><span>');
        this.termLog.push(result.error ? '<span class="t-err">' + text + "</span>" : "<span>" + text + "</span>");
      }
      if (this.termLog.length > 160) this.termLog = this.termLog.slice(-120);
      this.termRedraw();
      Game.state.stats.commands++;
      Game.save();

      const step = this.currentTerminalStep();
      if (!step) return;
      const taskIdx = Game.state.taskIdx || 0;
      const task = step.tasks[taskIdx];
      if (!task) return;
      const norm = line.trim().replace(/\s+/g, " ");
      const cmdOk = task.accept.some(re => re.test(norm));
      const checkOk = !task.check || task.check(Game.sim);

      if (cmdOk && !result.error && checkOk) {
        this.reward(15, 8);
        Game.state.taskIdx = taskIdx + 1;
        Game.save();
        if (Game.state.taskIdx >= step.tasks.length) {
          this.reward(20, 12, "📻 Auftrag erledigt!");
          this.afterTerminalStep();
        } else {
          this.renderTermTasks();
          const fb = $("tt-feedback");
          if (fb) fb.innerHTML = '<div class="tt-feedback">✅ Stark! Nächste Aufgabe ⤴</div>';
        }
      } else {
        this.failCount = (this.failCount || 0) + 1;
        if (this.failCount >= 3) {
          this.failCount = 0;
          const fb = $("tt-feedback");
          if (fb) fb.innerHTML = '<div class="tt-feedback">💪 Tippfehler sind der häufigste Stolperstein. Der 🔭 Hinweis unten hilft!</div>';
        }
      }
    },

    afterTerminalStep() {
      // Terminal-Schritt der Quest abgeschlossen
      const result = Game.advanceStep() || {};
      if (result.questDone) {
        const q = result.questDone;
        Game.registerQuestCards(q.id);
        this.reward(q.rewardXp, q.rewardCoins, "🏁 Quest „" + q.title + "“ abgeschlossen!");
      }
      Game.state.taskIdx = 0;
      Game.save();
      this.renderTermTasks();
      this.refreshHud();
      const next = Game.currentStep();
      if (next && (next.type === "dialog" || next.type === "choice")) {
        const npc = KQContent.NPCS[next.npc];
        const fb = $("tt-feedback");
        if (fb) fb.innerHTML = `<div class="tt-feedback">🎉 Geschafft! <b>${npc.name}</b> will dich sprechen. (Esc schließt das Funkgerät)</div>`;
      }
    },

    termHint() {
      const step = this.currentTerminalStep();
      if (!step) return;
      const task = step.tasks[Game.state.taskIdx || 0];
      if (!task) return;
      if (!Game.useConsumable("fernrohr") && !Game.spendCoins(25)) {
        this.toast("Nicht genug Dublonen für einen Hinweis! 🪙");
        return;
      }
      this.refreshHud();
      this.renderTermTasks();
      const fb = $("tt-feedback");
      if (fb) fb.innerHTML = '<div class="tt-feedback">🔭 <b>Hinweis:</b> ' + task.hint + "</div>";
    },

    termSolution() {
      const step = this.currentTerminalStep();
      if (!step) return;
      const task = step.tasks[Game.state.taskIdx || 0];
      if (!task) return;
      if (!Game.useConsumable("kompass") && !Game.spendCoins(50)) {
        this.toast("Nicht genug Dublonen für die Lösung! 🪙");
        return;
      }
      this.refreshHud();
      this.renderTermTasks();
      const fb = $("tt-feedback");
      if (fb) fb.innerHTML = '<div class="tt-feedback">🧭 <b>Lösung:</b> <code>' + esc(task.solution) + "</code> – selbst eintippen!</div>";
    },

    /* ========== Logbuch ========== */
    openQuestLog() {
      this.closeOverlays();
      $("overlay-quest").classList.remove("hidden");
      const s = Game.state;
      let html = "";
      KQContent.QUESTS.forEach((q, i) => {
        const done = s.completedQuests.includes(q.id);
        const active = i === s.questIdx;
        if (!done && !active) return; // Zukünftiges bleibt geheim
        html += `<div class="ql-quest ${done ? "done" : ""}">
          <div class="ql-title">${done ? "✅" : "▶️"} ${q.title}</div>
          ${active ? `<div>${this.hintForStep()}</div>` : ""}
        </div>`;
      });
      if (Game.allQuestsDone()) {
        html += `<div class="ql-quest"><div class="ql-title">🏅 Grundausbildung abgeschlossen!</div>
          <div>Halte dein Wissen mit Krabbe Kralle frisch. Gerüchte über neue Inseln (Ingress, GitOps, Monitoring …) machen die Runde – Fortsetzung folgt!</div></div>`;
      }
      const r = Game.rank();
      html += `<div class="ql-stats">Rang: ${r.icon} ${r.name} · ${s.xp} XP · 🪙 ${s.coins} · 🔥 Streak: ${s.streak.count} Tag(e)<br>
        Befehle gefunkt: ${s.stats.commands} · Quizfragen richtig: ${s.stats.quizRight} · Quizrunden: ${s.stats.reviews}<br>
        <button class="linklike" style="margin-top:8px" onclick="UI.resetGame()">Spielstand zurücksetzen</button></div>`;
      $("quest-body").innerHTML = html;
    },

    hintForStep() {
      const step = Game.currentStep();
      if (!step) return "";
      if (step.type === "terminal") return "📻 Öffne dein Funkgerät (T) und erledige die Aufgaben.";
      const npc = KQContent.NPCS[step.npc];
      return "💬 Sprich mit <b>" + npc.name + "</b> (" + npc.title + ").";
    },

    /* ========== Shop ========== */
    openShop() {
      this.closeOverlays();
      $("overlay-shop").classList.remove("hidden");
      const s = Game.state;
      let html = `<p class="dim">„Willkommen! Frische Ware, faire Preise!“ – Du hast <b>${s.coins} 🪙</b>. Dein 🔥 Streak (${s.streak.count}) gibt bis zu +50% auf alle Einnahmen.</p>
        <div class="shop-grid">`;
      for (const item of KQContent.SHOP) {
        const ownedCount = s.inventory[item.id] || 0;
        const ownedPerm = s.owned.includes(item.id);
        let action;
        if (item.type === "consumable") {
          action = `<button class="primary" onclick="UI.buyItem('${item.id}')">Kaufen – ${item.price} 🪙</button>
            ${ownedCount > 0 ? `<div class="si-owned">Im Beutel: ${ownedCount}</div>` : ""}`;
        } else if (ownedPerm) {
          const active = s.activePet === item.id || s.activeFlag === item.id;
          action = active
            ? `<button onclick="UI.toggleItem('${item.id}', false)">✅ Aktiv – abschalten</button>`
            : `<button onclick="UI.toggleItem('${item.id}', true)">Aktivieren</button>`;
        } else {
          action = `<button class="primary" onclick="UI.buyItem('${item.id}')">Kaufen – ${item.price} 🪙</button>`;
        }
        const icon = item.sprite !== undefined
          ? `<canvas width="16" height="16" data-sprite="${item.sprite}"></canvas>`
          : item.icon;
        html += `<div class="shop-item">
          <div class="si-icon">${icon}</div>
          <div class="si-name">${item.name}</div>
          <div class="si-desc">${item.desc}</div>
          ${action}
        </div>`;
      }
      html += "</div>";
      $("shop-body").innerHTML = html;
      document.querySelectorAll("#shop-body canvas[data-sprite]").forEach(cv => {
        Engine.drawPortrait(cv, "dungeon", parseInt(cv.dataset.sprite, 10));
      });
    },

    buyItem(itemId) {
      const result = Game.buy(itemId);
      this.toast(result.ok ? "🛒 " + result.msg : "⚠️ " + result.msg);
      this.refreshHud();
      this.openShop();
    },

    toggleItem(itemId, on) {
      const item = KQContent.SHOP.find(s => s.id === itemId);
      if (item.type === "pet") Game.state.activePet = on ? itemId : null;
      if (item.type === "flag") Game.state.activeFlag = on ? itemId : null;
      Game.save();
      this.openShop();
    },

    /* ========== Krabben-Quiz (Spaced Repetition) ========== */
    openReview() {
      this.closeOverlays();
      $("overlay-review").classList.remove("hidden");
      const dueIds = Game.dueReviewItems(10);
      if (dueIds.length === 0) {
        const total = Object.keys(Game.state.review).length;
        $("review-body").innerHTML = `<div style="text-align:center">
          <div style="font-size:3em">🦀</div>
          <p>${total === 0
            ? "„Schnipp schnapp! Noch keine Karten im Stapel – schließe erst eine Quest ab, dann üben wir täglich!“"
            : "„Heute ist nichts (mehr) fällig! Dein Wissen ist frisch wie der Morgenfang. Komm morgen wieder – schnipp!“"}</p>
          <button class="primary" onclick="UI.closeOverlays()">Bis morgen, Kralle!</button></div>`;
        return;
      }
      this.review = { ids: dueIds, idx: 0, right: 0 };
      this.renderReviewItem();
    },

    renderReviewItem() {
      const r = this.review;
      if (r.idx >= r.ids.length) {
        Game.state.stats.reviews++;
        Game.save();
        if (r.right === r.ids.length) this.reward(10, 10, "🌟 Perfekte Quizrunde!");
        $("review-body").innerHTML = `<div style="text-align:center">
          <div style="font-size:3em">🦀</div>
          <h2>${r.right} von ${r.ids.length} richtig!</h2>
          <p class="dim">Richtige Karten kommen seltener wieder, falsche öfter – bis alles sitzt. Schnipp!</p>
          <button class="primary" onclick="UI.closeOverlays()">Zurück ins Abenteuer</button></div>`;
        this.review = null;
        return;
      }
      const itemId = r.ids[r.idx];
      const content = Game.findReviewContent(itemId);
      if (!content) { r.idx++; return this.renderReviewItem(); }
      r.current = { itemId, content, answered: false };

      let body;
      if (content.kind === "quiz") {
        const q = content.q;
        r.current.order = shuffled(q.options.map((_, i) => i));
        body = `<div class="quiz-q">${q.q}</div>
          <div class="quiz-options" id="quiz-options">
            ${r.current.order.map(oi => `<button data-oi="${oi}" onclick="UI.answerReviewQuiz(${oi})">${esc(q.options[oi])}</button>`).join("")}
          </div><div id="review-explain"></div>`;
      } else {
        const card = content.card;
        body = `<div class="quiz-q">⌨️ ${card.q}</div>
          <div class="review-cmd-row"><span class="term-prompt">crew@hafen:~$</span>
            <input type="text" id="review-input" autocomplete="off" spellcheck="false"
              placeholder="Befehl eintippen, Enter drücken …" onkeydown="UI.answerReviewCmd(event)"></div>
          <div id="review-explain"></div>`;
      }
      $("review-body").innerHTML = `<p class="dim">🦀 Karte ${r.idx + 1} von ${r.ids.length} · richtig: ${r.right}</p>` + body;
      const inp = $("review-input");
      if (inp) inp.focus();
    },

    answerReviewQuiz(optionIndex) {
      const r = this.review;
      if (!r || r.current.answered) return;
      r.current.answered = true;
      const q = r.current.content.q;
      const correct = optionIndex === q.correct;
      document.querySelectorAll("#quiz-options button").forEach(btn => {
        const oi = parseInt(btn.dataset.oi, 10);
        btn.disabled = true;
        if (oi === q.correct) btn.classList.add("correct");
        else if (oi === optionIndex) btn.classList.add("wrong");
      });
      this.finishReviewItem(correct, q.explain);
    },

    answerReviewCmd(ev) {
      if (ev.key !== "Enter") return;
      const r = this.review;
      if (!r || r.current.answered) return;
      const line = ev.target.value.trim().replace(/\s+/g, " ");
      if (!line) return;
      r.current.answered = true;
      ev.target.disabled = true;
      const card = r.current.content.card;
      const correct = card.accept.some(re => re.test(line));
      this.finishReviewItem(correct, "Die Lösung: <code>" + esc(card.solution) + "</code>");
    },

    finishReviewItem(correct, explainHtml) {
      const r = this.review;
      Game.reviewResult(r.current.itemId, correct);
      if (correct) { r.right++; this.reward(4, 3); }
      $("review-explain").innerHTML = `
        <div class="quiz-explain">${correct ? "✅ <b>Richtig!</b> Schnipp-schnapp-applaus! 🦀" : "❌ <b>Nicht ganz.</b>"} ${explainHtml}</div>
        <div class="actions"><button class="primary" onclick="UI.nextReviewItem()">Weiter ➡️</button></div>`;
    },

    nextReviewItem() {
      this.review.idx++;
      this.renderReviewItem();
    },

    /* ========== Sonstiges ========== */
    resetGame() {
      if (!confirm("Wirklich den kompletten Spielstand löschen?")) return;
      Game.reset();
      location.reload();
    },
  };

  window.UI = UI;
})();
