/* ===== KubeQuest – Oberfläche =====
 * Rendert alle Bildschirme und verbindet Spiel-Logik, Inhalte und Simulator.
 */

(function () {
  "use strict";

  const app = () => document.getElementById("app");

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

    /* ---------- HUD & Toasts ---------- */
    refreshHud() {
      const s = Game.state;
      const rank = Game.rank();
      const next = Game.nextRank();
      document.getElementById("hud-rankname").textContent = rank.icon + " " + rank.name;
      document.getElementById("hud-coins").textContent = s.coins;
      document.getElementById("hud-streak").textContent = s.streak.count;
      document.getElementById("hud-ship").textContent = Game.ship();
      const fill = document.getElementById("hud-xpfill");
      if (next) {
        const pct = ((s.xp - rank.xp) / (next.xp - rank.xp)) * 100;
        fill.style.width = Math.min(100, pct) + "%";
        document.getElementById("hud-xptext").textContent = s.xp + " / " + next.xp + " XP";
      } else {
        fill.style.width = "100%";
        document.getElementById("hud-xptext").textContent = s.xp + " XP – Maximalrang!";
      }
      document.body.className = s.activeTheme || "theme-see";
    },

    toast(msg, cls) {
      const t = document.createElement("div");
      t.className = "toast" + (cls ? " " + cls : "");
      t.innerHTML = msg;
      document.getElementById("toasts").appendChild(t);
      setTimeout(() => t.remove(), 3800);
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
      }
      this.refreshHud();
    },

    /* ========== Heimathafen (Dashboard) ========== */
    goHome() {
      this.mission = null;
      const s = Game.state;
      const doneCount = s.completedChapters.length;
      const total = KQData.CHAPTERS.length;

      let html = "<h1>⚓ Heimathafen</h1>";

      if (doneCount === 0) {
        html += `<div class="card">👋 <b>Willkommen an Bord!</b> Hier lernst du Schritt für Schritt Kubernetes, Helm und Terraform – ganz ohne Vorwissen.
        Jedes Kapitel hat eine kurze Lektion, ein Quiz und eine Terminal-Mission, in der du echte Befehle tippst (in einem sicheren Simulator).
        Du verdienst XP für Beförderungen und 🪙 Dublonen für den Shop. Starte mit Kapitel 1!</div>`;
      } else if (doneCount < total) {
        html += `<div class="card">Schön, dass du wieder da bist! <b>${doneCount} von ${total} Kapiteln</b> geschafft.
        💡 Tipp: Ein kurzer <b>📋 Tagesrapport</b> pro Tag hält dein Wissen frisch – und bringt Extra-Dublonen.</div>`;
      } else {
        html += `<div class="card">🏆 <b>Alle Kapitel abgeschlossen – Respekt, ${Game.rank().name}!</b>
        Halte dein Wissen mit dem täglichen 📋 Tagesrapport frisch oder tobe dich in der 🧪 Sandbox aus.</div>`;
      }

      html += '<div class="chapter-grid">';
      KQData.CHAPTERS.forEach((ch, i) => {
        const done = Game.isChapterDone(ch.id);
        const unlocked = Game.isChapterUnlocked(i);
        const badge = done ? "✅" : (unlocked ? "▶️" : "🔒");
        const cls = unlocked ? "" : " locked";
        const click = unlocked ? `onclick="UI.startMission(${i})"` : "";
        html += `<div class="chapter-card${cls}" ${click}>
          <div class="ch-badge">${badge}</div>
          <div class="ch-icon">${ch.icon}</div>
          <div class="ch-title">Kapitel ${i + 1}: ${ch.title}</div>
          <div class="ch-sub">${ch.sub}${unlocked ? "" : "<br><i>Schließe erst das vorherige Kapitel ab.</i>"}</div>
        </div>`;
      });
      html += "</div>";

      const due = Game.dueReviewItems().length;
      if (due > 0) {
        html += `<div class="card">📋 <b>${due} Wiederholungskarte${due === 1 ? " ist" : "n sind"} fällig!</b>
        Kurz wiederholen lohnt sich doppelt: fürs Gedächtnis und für die Dublonen.
        <div class="actions"><button class="primary" onclick="UI.goReview()">Tagesrapport starten</button></div></div>`;
      }

      app().innerHTML = html;
      this.refreshHud();
      window.scrollTo(0, 0);
    },

    /* ========== Mission (Kapitel durchspielen) ========== */
    mission: null,

    startMission(chapterIndex) {
      const ch = KQData.CHAPTERS[chapterIndex];
      this.mission = { ch, chapterIndex, stepIdx: 0 };
      this.renderStep();
    },

    renderStep() {
      const m = this.mission;
      if (!m) return this.goHome();
      if (m.stepIdx >= m.ch.steps.length) return this.finishMission();
      const step = m.ch.steps[m.stepIdx];
      if (step.type === "lesson") this.renderLesson(step);
      else if (step.type === "quiz") this.startQuiz(step);
      else if (step.type === "terminal") this.startTerminal(step);
    },

    nextStep() {
      this.mission.stepIdx++;
      this.renderStep();
    },

    finishMission() {
      const m = this.mission;
      const firstTime = !Game.isChapterDone(m.ch.id);
      Game.completeChapter(m.ch.id);
      if (firstTime) this.reward(30, 25, "🏁 Kapitel geschafft!");

      app().innerHTML = `
        <h1>🏁 Kapitel abgeschlossen!</h1>
        <div class="card" style="text-align:center">
          <div style="font-size:3em">${m.ch.icon}</div>
          <h2>${m.ch.title}</h2>
          <p>${firstTime
            ? "Stark! Die Befehle aus diesem Kapitel landen jetzt in deinem 📋 Tagesrapport, damit sie wirklich sitzen."
            : "Wiederholung gemeistert – Übung macht die Admiralin!"}</p>
          <div class="actions" style="justify-content:center">
            <button class="primary" onclick="UI.goHome()">Zurück zum Heimathafen</button>
            ${m.chapterIndex + 1 < KQData.CHAPTERS.length && Game.isChapterUnlocked(m.chapterIndex + 1)
              ? `<button onclick="UI.startMission(${m.chapterIndex + 1})">Weiter zu Kapitel ${m.chapterIndex + 2} ➡️</button>` : ""}
          </div>
        </div>`;
      this.mission = null;
      window.scrollTo(0, 0);
    },

    /* ---------- Lektion ---------- */
    renderLesson(step) {
      const m = this.mission;
      if (m.cardIdx === undefined || m.lessonStep !== m.stepIdx) { m.cardIdx = 0; m.lessonStep = m.stepIdx; }
      const card = step.cards[m.cardIdx];
      const last = m.cardIdx === step.cards.length - 1;

      app().innerHTML = `
        <h1>${m.ch.icon} ${m.ch.title}</h1>
        <p class="dim">📖 Lektion: ${step.title} (${m.cardIdx + 1}/${step.cards.length})</p>
        <div class="card lesson-card">
          <div class="big-icon">${card.icon}</div>
          ${card.html}
        </div>
        <div class="actions">
          ${m.cardIdx > 0 ? '<button onclick="UI.lessonPrev()">⬅️ Zurück</button>' : ""}
          <button class="primary" onclick="UI.lessonNext()">${last ? "Zum Quiz! 🎯" : "Weiter ➡️"}</button>
          <button class="linklike" onclick="UI.goHome()">Mission abbrechen</button>
        </div>`;
      window.scrollTo(0, 0);
    },

    lessonNext() {
      const m = this.mission;
      const step = m.ch.steps[m.stepIdx];
      if (m.cardIdx < step.cards.length - 1) { m.cardIdx++; this.renderLesson(step); }
      else { m.cardIdx = undefined; this.nextStep(); }
    },

    lessonPrev() {
      const m = this.mission;
      if (m.cardIdx > 0) { m.cardIdx--; this.renderLesson(m.ch.steps[m.stepIdx]); }
    },

    /* ---------- Quiz ---------- */
    startQuiz(step) {
      const m = this.mission;
      m.quiz = { items: step.items, qIdx: 0, right: 0, answered: false };
      this.renderQuizQuestion();
    },

    renderQuizQuestion() {
      const m = this.mission;
      const qz = m.quiz;
      if (qz.qIdx >= qz.items.length) {
        const perfect = qz.right === qz.items.length;
        app().innerHTML = `
          <h1>🎯 Quiz beendet</h1>
          <div class="card" style="text-align:center">
            <div style="font-size:3em">${perfect ? "🌟" : qz.right >= qz.items.length / 2 ? "👍" : "💪"}</div>
            <h2>${qz.right} von ${qz.items.length} richtig</h2>
            <p>${perfect ? "Perfekt! Extra-Belohnung für die fehlerfreie Runde!" :
              "Falsch beantwortete Fragen tauchen im 📋 Tagesrapport wieder auf – so lange, bis sie sitzen."}</p>
            <div class="actions" style="justify-content:center">
              <button class="primary" onclick="UI.quizDone(${perfect})">Weiter zur Terminal-Mission 💻</button>
            </div>
          </div>`;
        window.scrollTo(0, 0);
        return;
      }

      const q = qz.items[qz.qIdx];
      qz.order = shuffled(q.options.map((_, i) => i));
      qz.answered = false;
      qz.fiftyUsed = false;

      const papagei = Game.state.inventory["papagei"] || 0;
      app().innerHTML = `
        <h1>${m.ch.icon} Quiz</h1>
        <p class="dim">Frage ${qz.qIdx + 1} von ${qz.items.length} · bisher richtig: ${qz.right}</p>
        <div class="card">
          <div class="quiz-q">${q.q}</div>
          <div class="quiz-options" id="quiz-options">
            ${qz.order.map(oi => `<button data-oi="${oi}" onclick="UI.answerQuiz(${oi})">${esc(q.options[oi])}</button>`).join("")}
          </div>
          <div id="quiz-explain"></div>
          <div class="actions">
            ${papagei > 0 ? `<button id="btn-papagei" onclick="UI.usePapagei()">🦜 Papagei-Joker (${papagei})</button>` : ""}
            <button class="linklike" onclick="UI.goHome()">Mission abbrechen</button>
          </div>
        </div>`;
      window.scrollTo(0, 0);
    },

    usePapagei() {
      const qz = this.mission.quiz;
      if (qz.answered || qz.fiftyUsed) return;
      if (!Game.useConsumable("papagei")) return;
      qz.fiftyUsed = true;
      const q = qz.items[qz.qIdx];
      const wrong = qz.order.filter(oi => oi !== q.correct);
      shuffled(wrong).slice(0, 2).forEach(oi => {
        const btn = document.querySelector(`#quiz-options button[data-oi="${oi}"]`);
        if (btn) { btn.disabled = true; btn.style.opacity = 0.3; }
      });
      const pBtn = document.getElementById("btn-papagei");
      if (pBtn) pBtn.remove();
      this.toast("🦜 Krah! Zwei falsche Antworten weggepickt!");
      this.refreshHud();
    },

    answerQuiz(optionIndex) {
      const m = this.mission;
      const qz = m.quiz;
      if (qz.answered) return;
      qz.answered = true;
      const q = qz.items[qz.qIdx];
      const correct = optionIndex === q.correct;

      document.querySelectorAll("#quiz-options button").forEach(btn => {
        const oi = parseInt(btn.dataset.oi, 10);
        btn.disabled = true;
        if (oi === q.correct) btn.classList.add("correct");
        else if (oi === optionIndex) btn.classList.add("wrong");
      });

      Game.missionQuizResult(q.id, correct);
      if (correct) {
        qz.right++;
        this.reward(10, 5);
      }

      document.getElementById("quiz-explain").innerHTML = `
        <div class="quiz-explain">${correct ? "✅ <b>Richtig!</b>" : "❌ <b>Nicht ganz.</b>"} ${q.explain}</div>
        <div class="actions"><button class="primary" onclick="UI.nextQuizQuestion()">Weiter ➡️</button></div>`;
    },

    nextQuizQuestion() {
      this.mission.quiz.qIdx++;
      this.renderQuizQuestion();
    },

    quizDone(perfect) {
      if (perfect) this.reward(15, 10, "🌟 Fehlerfreies Quiz!");
      this.nextStep();
    },

    /* ---------- Terminal-Mission ---------- */
    startTerminal(step) {
      const m = this.mission;
      m.term = {
        step,
        taskIdx: 0,
        sim: new KQSim(step.scenario || {}),
        fails: 0,
        log: [],
      };
      this.renderTerminal();
    },

    renderTerminal() {
      const m = this.mission;
      const t = m.term;
      const task = t.step.tasks[t.taskIdx];

      const dots = t.step.tasks.map((_, i) =>
        `<span class="${i < t.taskIdx ? "done" : i === t.taskIdx ? "current" : ""}"></span>`).join("");

      const fernrohr = Game.state.inventory["fernrohr"] || 0;
      const kompass = Game.state.inventory["kompass"] || 0;

      app().innerHTML = `
        <h1>${m.ch.icon} Terminal-Mission</h1>
        <p class="dim">${t.step.intro}</p>
        <div class="progress-dots">${dots}</div>
        <div class="card">
          <div class="task-text"><b>Aufgabe ${t.taskIdx + 1} von ${t.step.tasks.length}:</b> ${task.text}</div>
          <div id="task-feedback"></div>
          <div class="terminal">
            <div class="term-out" id="term-out"></div>
            <div class="term-inputrow">
              <span class="term-prompt">crew@ahoi:~$</span>
              <input type="text" id="term-input" autocomplete="off" spellcheck="false"
                placeholder="Befehl eintippen und Enter drücken …" onkeydown="UI.termKey(event)">
            </div>
          </div>
          <div class="actions">
            <button onclick="UI.termHint()">🔭 Hinweis ${fernrohr > 0 ? "(Fernrohr: " + fernrohr + ")" : "(25 🪙)"}</button>
            <button onclick="UI.termSolution()">🧭 Lösung ${kompass > 0 ? "(Kompass: " + kompass + ")" : "(50 🪙)"}</button>
            <button class="linklike" onclick="UI.goHome()">Mission abbrechen</button>
          </div>
        </div>`;

      this.termRedrawLog();
      document.getElementById("term-input").focus();
      window.scrollTo(0, 0);
    },

    termRedrawLog() {
      const out = document.getElementById("term-out");
      out.innerHTML = this.mission.term.log.join("\n");
      out.scrollTop = out.scrollHeight;
    },

    termKey(ev) {
      if (ev.key !== "Enter") return;
      const input = ev.target;
      const line = input.value;
      input.value = "";
      if (!line.trim()) return;

      const m = this.mission;
      const t = m.term;
      const result = t.sim.exec(line);

      if (result.clear) { t.log = []; this.termRedrawLog(); return; }

      t.log.push('<span class="t-cmd">crew@ahoi:~$ ' + esc(line) + "</span>");
      if (result.output) {
        let cls = result.error ? "t-err" : "";
        let text = esc(result.output);
        // Tipps (💡) gesondert einfärben
        text = text.replace(/💡[^\n]*/g, s => '</span><span class="t-tip">' + s + '</span><span>');
        t.log.push(cls ? '<span class="' + cls + '">' + text + "</span>" : "<span>" + text + "</span>");
      }
      this.termRedrawLog();
      Game.state.stats.commands++;

      // Aufgabe erfüllt?
      const task = t.step.tasks[t.taskIdx];
      const cmdOk = task.accept.some(re => re.test(line.trim().replace(/\s+/g, " ")));
      const checkOk = !task.check || task.check(t.sim);

      if (cmdOk && !result.error && checkOk) {
        this.reward(15, 8);
        t.fails = 0;
        t.taskIdx++;
        if (t.taskIdx >= t.step.tasks.length) {
          this.reward(20, 12, "💻 Terminal-Mission geschafft!");
          this.nextStep();
        } else {
          this.renderTerminal();
          const fb = document.getElementById("task-feedback");
          fb.innerHTML = '<div class="quiz-explain task-done">✅ Aufgabe gelöst! Weiter zur nächsten.</div>';
        }
      } else if (cmdOk && result.error) {
        // Richtiger Befehl, aber der Simulator meldete einen Fehler (z.B. Reihenfolge)
        t.fails++;
      } else {
        t.fails++;
        if (t.fails === 3) {
          const fb = document.getElementById("task-feedback");
          fb.innerHTML = '<div class="quiz-explain">💪 Nicht aufgeben! Hol dir oben einen 🔭 Hinweis – oder schau nochmal in die Lektion. Tippfehler sind der häufigste Stolperstein.</div>';
        }
      }
    },

    termHint() {
      const t = this.mission.term;
      const task = t.step.tasks[t.taskIdx];
      if (!Game.useConsumable("fernrohr") && !Game.spendCoins(25)) {
        this.toast("Nicht genug Dublonen für einen Hinweis! 🪙");
        return;
      }
      this.refreshHud();
      document.getElementById("task-feedback").innerHTML =
        '<div class="quiz-explain">🔭 <b>Hinweis:</b> ' + task.hint + "</div>";
    },

    termSolution() {
      const t = this.mission.term;
      const task = t.step.tasks[t.taskIdx];
      if (!Game.useConsumable("kompass") && !Game.spendCoins(50)) {
        this.toast("Nicht genug Dublonen für die Lösung! 🪙");
        return;
      }
      this.refreshHud();
      document.getElementById("task-feedback").innerHTML =
        '<div class="quiz-explain">🧭 <b>Lösung:</b> <code>' + esc(task.solution) + "</code> – tippe sie selbst ein, das Tippen trainiert!</div>";
    },

    /* ========== Tagesrapport (Spaced Repetition) ========== */
    review: null,

    goReview() {
      this.mission = null;
      const dueIds = Game.dueReviewItems(12);
      if (dueIds.length === 0) {
        const total = Object.keys(Game.state.review).length;
        app().innerHTML = `
          <h1>📋 Tagesrapport</h1>
          <div class="card" style="text-align:center">
            <div style="font-size:3em">🏖️</div>
            <p>${total === 0
              ? "Noch keine Karten im Stapel – schließe zuerst ein Kapitel ab, dann gibt es hier täglich etwas zu wiederholen."
              : "Heute ist nichts (mehr) fällig. Dein Wissen ist frisch – komm morgen wieder!"}</p>
            <div class="actions" style="justify-content:center">
              <button class="primary" onclick="UI.goHome()">Zum Heimathafen</button>
            </div>
          </div>`;
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
        const bonus = r.right === r.ids.length ? " Alle richtig – Bonus!" : "";
        if (r.right === r.ids.length) this.reward(10, 10, "🌟 Perfekter Rapport!");
        app().innerHTML = `
          <h1>📋 Rapport beendet</h1>
          <div class="card" style="text-align:center">
            <div style="font-size:3em">⛵</div>
            <h2>${r.right} von ${r.ids.length} richtig${bonus}</h2>
            <p>Richtig beantwortete Karten kommen seltener wieder, falsche öfter – so wandert alles dauerhaft ins Langzeitgedächtnis.</p>
            <div class="actions" style="justify-content:center">
              <button class="primary" onclick="UI.goHome()">Zum Heimathafen</button>
            </div>
          </div>`;
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
        body = `
          <div class="quiz-q">${q.q}</div>
          <div class="quiz-options" id="quiz-options">
            ${r.current.order.map(oi => `<button data-oi="${oi}" onclick="UI.answerReviewQuiz(${oi})">${esc(q.options[oi])}</button>`).join("")}
          </div>
          <div id="review-explain"></div>`;
      } else {
        const card = content.card;
        body = `
          <div class="quiz-q">⌨️ ${card.q}</div>
          <div class="terminal">
            <div class="term-inputrow">
              <span class="term-prompt">crew@ahoi:~$</span>
              <input type="text" id="review-input" autocomplete="off" spellcheck="false"
                placeholder="Befehl eintippen und Enter drücken …" onkeydown="UI.answerReviewCmd(event)">
            </div>
          </div>
          <div id="review-explain"></div>`;
      }

      app().innerHTML = `
        <h1>📋 Tagesrapport</h1>
        <p class="dim">Karte ${r.idx + 1} von ${r.ids.length} · bisher richtig: ${r.right}</p>
        <div class="card">${body}
          <div class="actions"><button class="linklike" onclick="UI.goHome()">Rapport abbrechen</button></div>
        </div>`;
      const inp = document.getElementById("review-input");
      if (inp) inp.focus();
      window.scrollTo(0, 0);
    },

    answerReviewQuiz(optionIndex) {
      const r = this.review;
      if (r.current.answered) return;
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
      if (r.current.answered) return;
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
      document.getElementById("review-explain").innerHTML = `
        <div class="quiz-explain">${correct ? "✅ <b>Richtig!</b>" : "❌ <b>Nicht ganz.</b>"} ${explainHtml}</div>
        <div class="actions"><button class="primary" onclick="UI.nextReviewItem()">Weiter ➡️</button></div>`;
    },

    nextReviewItem() {
      this.review.idx++;
      this.renderReviewItem();
    },

    /* ========== Shop ========== */
    goShop() {
      this.mission = null;
      const s = Game.state;
      let html = `<h1>🛒 Hafenladen</h1>
        <p class="dim">Du hast <b>${s.coins} 🪙 Dublonen</b>. Verdiene mehr in Missionen und im Tagesrapport – dein Streak (🔥 ${s.streak.count}) gibt bis zu +50% Bonus!</p>
        <div class="shop-grid">`;

      for (const item of KQData.SHOP) {
        const ownedCount = s.inventory[item.id] || 0;
        const ownedPerm = s.owned.includes(item.id);
        let action;
        if (item.type === "consumable") {
          action = `<button class="primary" onclick="UI.buyItem('${item.id}')">Kaufen – ${item.price} 🪙</button>
            ${ownedCount > 0 ? `<div class="si-owned">Im Beutel: ${ownedCount}</div>` : ""}`;
        } else if (ownedPerm) {
          const isActive = (item.type === "theme" && s.activeTheme === item.theme) ||
                           (item.type === "ship" && s.activeShip === item.id);
          action = isActive
            ? `<button onclick="UI.deactivateItem('${item.id}')">✅ Aktiv – abschalten</button>`
            : `<button onclick="UI.activateItem('${item.id}')">Aktivieren</button>`;
        } else {
          action = `<button class="primary" onclick="UI.buyItem('${item.id}')">Kaufen – ${item.price} 🪙</button>`;
        }
        html += `<div class="shop-item">
          <div class="si-icon">${item.icon}</div>
          <div class="si-name">${item.name}</div>
          <div class="si-desc">${item.desc}</div>
          ${action}
        </div>`;
      }
      html += "</div>";
      app().innerHTML = html;
      this.refreshHud();
      window.scrollTo(0, 0);
    },

    buyItem(itemId) {
      const result = Game.buy(itemId);
      this.toast(result.ok ? "🛒 " + result.msg : "⚠️ " + result.msg);
      this.goShop();
    },

    activateItem(itemId) {
      const item = KQData.SHOP.find(s => s.id === itemId);
      if (item.type === "theme") Game.setTheme(item.theme);
      if (item.type === "ship") Game.setShip(itemId);
      this.goShop();
    },

    deactivateItem(itemId) {
      const item = KQData.SHOP.find(s => s.id === itemId);
      if (item.type === "theme") Game.setTheme("theme-see");
      if (item.type === "ship") Game.setShip(null);
      this.goShop();
    },

    /* ========== Sandbox ========== */
    sandbox: null,

    goSandbox() {
      this.mission = null;
      if (!this.sandbox) {
        this.sandbox = {
          sim: new KQSim({
            deployments: [{ name: "kantine", image: "nginx:1.27", replicas: 2 }],
            files: { "beispiel.yaml": "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: spielwiese\nspec:\n  replicas: 1\n  template:\n    spec:\n      containers:\n        - image: nginx" },
            applyEffects: { "beispiel.yaml": { deployment: { name: "spielwiese", image: "nginx", replicas: 1 } } },
            tfResources: [{ addr: "hafen_server.test", desc: 'name = "test-server"' }],
          }),
          log: [],
        };
      }
      app().innerHTML = `
        <h1>🧪 Sandbox</h1>
        <p class="dim">Freies Spielen ohne Aufgaben: Hier kannst du alle Befehle ausprobieren, die du gelernt hast.
        Ein paar Pods laufen schon. Mit <code>help</code> siehst du alles, was der Simulator kann. Kaputtmachen unmöglich –
        <button class="linklike" onclick="UI.resetSandbox()">Sandbox zurücksetzen</button> gibt es trotzdem.</p>
        <div class="card">
          <div class="terminal">
            <div class="term-out" id="term-out"></div>
            <div class="term-inputrow">
              <span class="term-prompt">crew@ahoi:~$</span>
              <input type="text" id="term-input" autocomplete="off" spellcheck="false"
                placeholder="Probier z.B. kubectl get pods" onkeydown="UI.sandboxKey(event)">
            </div>
          </div>
        </div>`;
      const out = document.getElementById("term-out");
      out.innerHTML = this.sandbox.log.join("\n");
      out.scrollTop = out.scrollHeight;
      document.getElementById("term-input").focus();
    },

    resetSandbox() {
      this.sandbox = null;
      this.goSandbox();
      this.toast("🧪 Sandbox frisch aufgesetzt!");
    },

    sandboxKey(ev) {
      if (ev.key !== "Enter") return;
      const line = ev.target.value;
      ev.target.value = "";
      if (!line.trim()) return;
      const sb = this.sandbox;
      const result = sb.sim.exec(line);
      if (result.clear) { sb.log = []; }
      else {
        sb.log.push('<span class="t-cmd">crew@ahoi:~$ ' + esc(line) + "</span>");
        if (result.output) {
          let text = esc(result.output).replace(/💡[^\n]*/g, s => '</span><span class="t-tip">' + s + '</span><span>');
          sb.log.push(result.error ? '<span class="t-err">' + text + "</span>" : "<span>" + text + "</span>");
        }
      }
      const out = document.getElementById("term-out");
      out.innerHTML = sb.log.join("\n");
      out.scrollTop = out.scrollHeight;
    },

    /* ========== Sonstiges ========== */
    resetGame() {
      if (!confirm("Wirklich den kompletten Spielstand löschen? Das kann nicht rückgängig gemacht werden!")) return;
      Game.reset();
      this.sandbox = null;
      this.goHome();
      this.toast("Neues Spiel, neues Glück! ⚓");
    },
  };

  window.UI = UI;

  /* ---------- Start ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    Game.load();
    UI.goHome();
  });
})();
