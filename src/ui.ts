/* ===== KubeQuest 3.0 – UI & Quest-Steuerung =====
 * Dialoge, Funkgerät (teach/drill/terminal + freies Üben), Shop,
 * Krabben-Quiz, Stapel-Minispiel, Alarm-Leiste, HUD.
 */
import { Game } from "./game";
import { KQContent } from "./content";
import { KQAssets } from "./assets-data";
import { SFX } from "./sfx";

  // Die DOM-Knoten liegen alle fest in index.html – darum geben wir hier ein
  // nicht-nullbares HTMLElement zurück (Migrations-Shim, wie window.* in vite-env.d.ts).
  const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;

  // NPC-/Smalltalk-Tabellen werden per NPC-Id (Laufzeit-String) nachgeschlagen –
  // als String-indizierbare Maps typisiert, statt jeden Zugriff einzeln zu casten.
  const NPCS = KQContent.NPCS as Record<string, { name: string; title: string; sprite: number; tex?: string }>;
  const SMALLTALK = KQContent.SMALLTALK as Record<string, string[]>;

  function esc(s: unknown) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function shuffled<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Spritesheet-Bilder für Porträts (unabhängig von Phaser, geht auch per file://)
  const sheetImgs: Record<string, HTMLImageElement> = {};
  const assets = KQAssets as Record<string, string>;
  for (const key of ["town", "dungeon"]) {
    const img = new Image();
    img.src = assets[key];
    sheetImgs[key] = img;
  }
  // PixelLab-NPC-Figuren fürs Dialog-Porträt vorladen (Kopf/Schulter-Ausschnitt)
  for (const npc of Object.values(KQContent.NPCS) as any[]) {
    if (npc.tex && assets[npc.tex] && !sheetImgs[npc.tex]) {
      const img = new Image();
      img.src = assets[npc.tex];
      sheetImgs[npc.tex] = img;
    }
  }
  // PixelLab-Shop-Grafiken (Haustiere) fürs Shop-Icon vorladen
  for (const item of KQContent.SHOP as any[]) {
    if (item.tex && assets[item.tex] && !sheetImgs[item.tex]) {
      const img = new Image();
      img.src = assets[item.tex];
      sheetImgs[item.tex] = img;
    }
  }

  export const UI = {
    dialogue: null as any,
    termLog: [] as any[],
    review: null as any,
    practice: null as any,   // { npcId, drills, idx, task }
    _drillTask: null as any, // aktuelle generierte Drill-Aufgabe des Quest-Schritts
    stack: null as any,      // Stapel-Minispiel
    failCount: 0,
    choiceBtns: null as any, // Dialog-Antwort-Buttons (für Tastatur-Navigation)
    choiceSel: 0,

    drawPortrait(canvas: HTMLCanvasElement, idx: number) {
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const img = sheetImgs.dungeon;
      const sx = (idx % 12) * 16, sy = Math.floor(idx / 12) * 16;
      if (img.complete) ctx.drawImage(img, sx, sy, 16, 16, 0, 0, canvas.width, canvas.height);
      else img.addEventListener("load", () => ctx.drawImage(img, sx, sy, 16, 16, 0, 0, canvas.width, canvas.height), { once: true });
    },

    // Ganzes PixelLab-Bild (z.B. Haustier) zentriert in ein Icon-Canvas zeichnen (contain).
    drawTexIcon(canvas: HTMLCanvasElement, texKey: string) {
      const img = sheetImgs[texKey];
      if (!img) return;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      const draw = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const s = Math.min(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
        const w = img.naturalWidth * s, h = img.naturalHeight * s;
        ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      };
      if (img.complete && img.naturalWidth) draw();
      else img.addEventListener("load", draw, { once: true });
    },

    // NPC-Porträt aus der PixelLab-Figur (Kopf/Schulter-Ausschnitt der 48x48-Textur),
    // mit Fallback aufs alte Kenney-Icon, falls die Figur (noch) keine tex hat.
    drawNpcPortrait(canvas: HTMLCanvasElement, npc: any) {
      const img = npc && npc.tex ? sheetImgs[npc.tex] : null;
      if (!img) { this.drawPortrait(canvas, npc.sprite); return; }
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      const draw = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 11, 4, 26, 26, 0, 0, canvas.width, canvas.height);
      };
      if (img.complete && img.naturalWidth) draw();
      else img.addEventListener("load", draw, { once: true });
    },

    /* ========== Blockierung ========== */
    blocking() {
      return !!this.dialogue ||
        ["overlay-terminal", "overlay-quest", "overlay-shop", "overlay-review", "overlay-stack", "overlay-menu", "charselect"]
          .some(id => !$(id).classList.contains("hidden"));
    },

    closeOverlays() {
      ["overlay-terminal", "overlay-quest", "overlay-shop", "overlay-review", "overlay-stack", "overlay-menu"].forEach(id => $(id).classList.add("hidden"));
      if (this.practice && this.practice.idx >= this.practice.drills.length) this.practice = null;
    },

    /* ========== Menü / Pause ========== */
    openMenu() {
      this.closeOverlays();
      $("overlay-menu").classList.remove("hidden");
    },

    /* ========== HUD, Toasts, Alarm ========== */
    refreshHud() {
      const s = Game.state;
      const rank = Game.rank();
      const next = Game.nextRank();
      $("hud-rankname").textContent = rank.icon + " " + rank.name;
      $("hud-coins").textContent = String(s.coins);
      $("hud-streak").textContent = String(s.streak.count);
      const rate = Game.incomeRate();
      $("hud-income").textContent = rate > 0 ? "+" + (Math.round(rate * 10) / 10) + "/min" : "";
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
        el.innerHTML = "🏅 Grundausbildung geschafft! Halte den Hafen am Laufen – und übe bei der Crew (E → Üben).";
        return;
      }
      const q = Game.currentQuest();
      const step = Game.currentStep();
      if (!q || !step) { el.textContent = ""; return; }
      if (Game.isFunkStep(step)) {
        el.innerHTML = "📜 <b>" + q.title + "</b> – 📻 Funkgerät öffnen (<b>T</b>)!";
      } else {
        const npc = NPCS[step.npc];
        el.innerHTML = "📜 <b>" + q.title + "</b> – Sprich mit <b>" + npc.name + "</b> (" + npc.title + ")";
      }
    },

    toast(msg: string, cls?: string) {
      const t = document.createElement("div");
      t.className = "toast" + (cls ? " " + cls : "");
      t.innerHTML = msg;
      $("toasts").appendChild(t);
      setTimeout(() => t.remove(), 4200);
    },

    reward(xp: number, coins: number, label?: string) {
      const rankUp = Game.addXp(xp);
      const realCoins = coins > 0 ? Game.addCoins(coins) : 0;
      let msg = "+" + xp + " XP";
      if (realCoins > 0) msg += " · +" + realCoins + " 🪙";
      if (label) msg = label + " " + msg;
      this.toast(msg);
      if (window.SFX) SFX.coin();
      if (rankUp) {
        const r = Game.rank();
        this.toast("🎉 <b>Beförderung!</b> Du bist jetzt <b>" + r.icon + " " + r.name + "</b>!", "rankup");
        if (window.SFX) SFX.fanfare();
        if (window.WorldScene) window.WorldScene.burstAtPlayer("sparkle");
      }
      this.refreshHud();
    },

    showAlarm(html: string, seconds: number) {
      $("alarm").classList.remove("hidden");
      $("alarm-text").innerHTML = html;
      $("alarm-timer").textContent = seconds + "s";
    },
    updateAlarmTimer(seconds: number) {
      $("alarm-timer").textContent = seconds + "s";
    },
    hideAlarm() {
      $("alarm").classList.add("hidden");
    },

    /* ========== Interaktion ========== */
    questMarkerFor(npcId: string) {
      const step = Game.currentStep();
      return !!(step && (step.type === "dialog" || step.type === "choice") && step.npc === npcId);
    },

    updatePrompt() {
      const p = $("prompt");
      if (this.blocking() || !window.WorldScene) { p.classList.add("hidden"); return; }
      const near = window.WorldScene.nearestNpc();
      if (!near) { p.classList.add("hidden"); return; }
      const meta = NPCS[near.id];
      let label = "💬 Mit " + meta.name + " reden";
      if (near.id === "pelle") label = "🛒 Bei Pelle einkaufen";
      if (near.id === "kralle") label = "🦀 Quizrunde mit Kralle";
      p.innerHTML = "<b>E</b> – " + label;
      p.classList.remove("hidden");
    },

    interact() {
      if (!window.WorldScene) return;
      const near = window.WorldScene.nearestNpc();
      if (!near) return;
      const npcId = near.id;
      if (npcId === "pelle") return this.openShop();
      if (npcId === "kralle") return this.openReview();

      const step = Game.currentStep();
      if (step && (step.type === "dialog" || step.type === "choice") && step.npc === npcId) {
        return this.runQuestStep();
      }
      this.showNpcMenu(npcId);
    },

    /** Menü: Plaudern / Üben / Stapel-Spiel */
    showNpcMenu(npcId: string) {
      const drills = Game.practiceDrillsFor(npcId);
      const stackOk = npcId === "bo" && Game.state.completedQuests.includes("q2");
      if (drills.length === 0 && !stackOk) {
        const lines = SMALLTALK[npcId] || ["…"];
        return this.showDialogue(npcId, [lines[Math.floor(Math.random() * lines.length)]]);
      }
      const npc = NPCS[npcId];
      this.dialogue = { npcId, lines: [], idx: 0, choice: { menu: true }, onDone: null };
      $("dlg-name").textContent = npc.name + " · " + npc.title;
      this.drawNpcPortrait($("dlg-portrait-canvas") as HTMLCanvasElement, npc);
      $("dlg-text").innerHTML = "Was kann ich für dich tun?";
      $("dlg-next").classList.add("hidden");
      const box = $("dlg-choices");
      box.innerHTML = "";
      const addBtn = (label: string, fn: () => void) => {
        const b = document.createElement("button");
        b.innerHTML = label;
        b.onclick = fn;
        box.appendChild(b);
      };
      addBtn("💬 Plaudern", () => {
        const lines = SMALLTALK[npcId] || ["…"];
        this.closeDialogue();
        this.showDialogue(npcId, [lines[Math.floor(Math.random() * lines.length)]]);
      });
      if (drills.length > 0) addBtn("🏋️ Üben – 3 Aufgaben (gibt 🪙!)", () => {
        this.closeDialogue();
        this.startPractice(npcId);
      });
      if (stackOk) addBtn("🎮 Stapel-Spiel (Image-Schichten)", () => {
        this.closeDialogue();
        this.openStackGame();
      });
      addBtn("Nichts, schönen Tag! ⚓", () => this.closeDialogue());
      $("dialogue").classList.remove("hidden");
      this._initChoiceNav();
    },

    /* ---------- Tastatur-Navigation für Antwort-Buttons (↑/↓ + Enter, Ziffern) ---------- */
    _initChoiceNav() {
      this.choiceBtns = Array.from(document.querySelectorAll("#dlg-choices button"));
      this.choiceSel = 0;
      this._highlightChoice();
    },
    _highlightChoice() {
      if (!this.choiceBtns) return;
      this.choiceBtns.forEach((b: HTMLButtonElement, i: number) => b.classList.toggle("sel", i === this.choiceSel));
    },
    hasChoices() {
      return !!(this.choiceBtns && this.choiceBtns.length && !this.choiceBtns[0].disabled);
    },
    dlgMoveSel(delta: number) {
      if (!this.hasChoices()) return;
      const n = this.choiceBtns.length;
      this.choiceSel = (this.choiceSel + delta + n) % n;
      this._highlightChoice();
    },
    dlgActivateSel() {
      if (!this.hasChoices()) return false;
      const btn = this.choiceBtns[this.choiceSel];
      if (btn) { btn.click(); return true; }
      return false;
    },
    dlgPickNumber(n: number) {
      if (!this.hasChoices()) return;
      const btn = this.choiceBtns[n - 1];
      if (btn) { this.choiceSel = n - 1; this._highlightChoice(); btn.click(); }
    },

    closeDialogue() {
      this.dialogue = null;
      this.choiceBtns = null;
      $("dialogue").classList.add("hidden");
    },

    /* ========== Quest-Maschine ========== */
    runQuestStep() {
      const step = Game.currentStep();
      if (!step) return;
      if (step.type === "dialog") {
        this.showDialogue(step.npc, step.lines, () => this.afterStep());
      } else if (step.type === "choice") {
        this.showChoice(step, () => this.afterStep());
      }
    },

    afterStep() {
      const result = Game.advanceStep() || {};
      this._drillTask = null;
      if (result.questDone) {
        const q = result.questDone;
        Game.registerQuestCards(q.id);
        this.reward(q.rewardXp, q.rewardCoins, "🏁 Quest „" + q.title + "“ abgeschlossen!");
        if (window.WorldScene) window.WorldScene.burstAtPlayer("sparkle");
        return;
      }
      const next = Game.currentStep();
      if (!next) return;
      if (Game.isFunkStep(next)) {
        if (next.scenario) { Game.sim.mergeScenario(next.scenario); Game.save(); }
        this.refreshHud();
      } else {
        this.refreshHud();
        if (!this.dialogue) this.runQuestStep();
      }
    },

    /* ========== Dialog ========== */
    showDialogue(npcId: string, lines: string[], onDone?: () => void) {
      const npc = NPCS[npcId];
      this.dialogue = { npcId, lines, idx: 0, onDone, choice: null };
      $("dlg-name").textContent = npc.name + " · " + npc.title;
      this.drawNpcPortrait($("dlg-portrait-canvas") as HTMLCanvasElement, npc);
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
        this.closeDialogue();
        if (d.onDone) d.onDone();
      }
    },

    showChoice(step: any, onDone: () => void) {
      const npc = NPCS[step.npc];
      this.dialogue = { npcId: step.npc, lines: [], idx: 0, onDone, choice: step };
      $("dlg-name").textContent = npc.name + " · " + npc.title;
      this.drawNpcPortrait($("dlg-portrait-canvas") as HTMLCanvasElement, npc);
      $("dlg-text").innerHTML = "🤔 " + step.q;
      $("dlg-next").textContent = "↑/↓ wählen · Enter bestätigen";
      $("dlg-next").classList.remove("hidden");
      const box = $("dlg-choices");
      box.innerHTML = "";
      for (const opt of shuffled<any>(step.options)) {
        const btn = document.createElement("button");
        btn.innerHTML = opt.t;
        btn.onclick = () => this.answerChoice(step, opt, btn);
        box.appendChild(btn);
      }
      $("dialogue").classList.remove("hidden");
      this._initChoiceNav();
    },

    answerChoice(step: any, opt: any, btn: HTMLButtonElement) {
      const d = this.dialogue;
      if (!d || d.answered) return;
      d.answered = true;
      this.choiceBtns = null;
      document.querySelectorAll("#dlg-choices button").forEach(b => {
        (b as HTMLButtonElement).disabled = true;
        b.classList.remove("sel");
        if (b === btn) b.classList.add(opt.ok ? "correct" : "wrong");
      });
      Game.choiceResult(step.reviewId, opt.ok);
      if (opt.ok) this.reward(12, 6);
      else if (window.SFX) SFX.wrong();
      $("dlg-text").innerHTML = (opt.ok ? "✅ " : "❌ ") + opt.reply;
      $("dlg-next").textContent = "✔ weiter (E)";
      $("dlg-next").classList.remove("hidden");
      d.choice = null;
      d.lines = [""];
      d.idx = 0;
    },

    /* ========== Funkgerät ========== */
    toggleTerminal() {
      const ov = $("overlay-terminal");
      if (!ov.classList.contains("hidden")) { this.closeOverlays(); return; }
      this.closeOverlays();
      ov.classList.remove("hidden");
      this.renderTermTasks();
      this.termRedraw();
      $("term-input").focus();
    },

    /** Aktive Funk-Session: practice > Quest-Schritt > frei */
    funkSession() {
      if (this.practice && this.practice.idx < this.practice.drills.length) return { kind: "practice" };
      const step = Game.currentStep();
      if (step && Game.isFunkStep(step)) return { kind: "quest", step };
      return { kind: "free" };
    },

    /** Aktuelle Aufgabe der Session (Drills werden hier lazily erzeugt). */
    currentTask() {
      const s = this.funkSession();
      if (s.kind === "practice") {
        const p = this.practice;
        if (!p.task) p.task = KQContent.DRILLS[p.drills[p.idx]](Game.sim);
        return p.task;
      }
      if (s.kind === "quest") {
        const step = s.step!;
        if (step.type === "drill") {
          if ((Game.state.taskIdx || 0) >= step.count) return null;
          if (!this._drillTask) this._drillTask = KQContent.DRILLS[step.pool[Math.floor(Math.random() * step.pool.length)]](Game.sim);
          return this._drillTask;
        }
        const tasks = Game.stepTasks(step);
        return tasks[Game.state.taskIdx || 0] || null;
      }
      return null;
    },

    renderTermTasks() {
      const box = $("term-tasks");
      const actions = $("term-actions");
      const s = this.funkSession();

      if (s.kind === "free") {
        box.innerHTML = `<div class="tt-head">🧪 Freies Funken</div>
          <div class="dim">Gerade kein Auftrag – probier aus, was du gelernt hast!
          Alles, was du hier anrichtest, siehst du draußen in der Welt.
          <br><br>Mit <code>help</code> siehst du alle Befehle.
          <br><br>💡 Übungs-Aufgaben mit Belohnung bekommst du bei der Crew: ansprechen → „Üben“.</div>
          <div id="tt-feedback"></div>`;
        actions.innerHTML = "";
        return;
      }

      let html = "";
      const task = this.currentTask();

      if (s.kind === "practice") {
        const p = this.practice;
        const npc = NPCS[p.npcId];
        html += `<div class="tt-head">🏋️ Üben bei ${npc.name} (${Math.min(p.idx + 1, p.drills.length)}/${p.drills.length})</div>`;
        if (task) html += `<div class="tt-item current">▶️ ${task.text}</div>`;
        html += `<div id="tt-feedback"></div>`;
      } else {
        const step = s.step!;
        const q = Game.currentQuest();
        html += `<div class="tt-head">📜 ${q.title}: ${step.brief}</div>`;
        if (step.type === "teach") {
          html += `<div class="tt-new">${step.cmd.intro}</div>`;
          html += `<div class="tt-item current">▶️ ${step.cmd.text}</div>`;
        } else if (step.type === "drill") {
          html += `<div class="dim" style="margin-bottom:8px">${step.intro}</div>`;
          html += `<div class="dim">Übung ${Math.min((Game.state.taskIdx || 0) + 1, step.count)} von ${step.count}</div>`;
          if (task) html += `<div class="tt-item current">▶️ ${task.text}</div>`;
        } else {
          const taskIdx = Game.state.taskIdx || 0;
          step.tasks.forEach((t: any, i: number) => {
            const cls = i < taskIdx ? "done" : i === taskIdx ? "current" : "";
            const mark = i < taskIdx ? "✅" : i === taskIdx ? "▶️" : "·";
            html += `<div class="tt-item ${cls}">${mark} ${i <= taskIdx ? t.text : "???"}</div>`;
          });
        }
        html += `<div id="tt-feedback"></div>`;
      }
      box.innerHTML = html;

      const fernrohr = Game.state.inventory["fernrohr"] || 0;
      const kompass = Game.state.inventory["kompass"] || 0;
      actions.innerHTML = `
        <button onclick="UI.termHint()">🔭 Hinweis ${fernrohr > 0 ? "(Fernrohr: " + fernrohr + ")" : "(25 🪙)"}</button>
        <button onclick="UI.termSolution()">🧭 Lösung ${kompass > 0 ? "(Kompass: " + kompass + ")" : "(50 🪙)"}</button>
        <span class="dim" style="align-self:center">Selbst tippen statt kopieren – das Tippen ist das Training!</span>`;
    },

    termRedraw() {
      const out = $("term-out");
      out.innerHTML = this.termLog.join("\n");
      out.scrollTop = out.scrollHeight;
    },

    termSubmit(line: string) {
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

      const task = this.currentTask();
      if (!task) return;
      const norm = line.trim().replace(/\s+/g, " ");
      const cmdOk = task.accept.some((re: RegExp) => re.test(norm));
      const checkOk = !task.check || task.check(Game.sim);

      if (cmdOk && !result.error && checkOk) {
        this.failCount = 0;
        if (window.SFX) SFX.success();
        this.taskSolved();
      } else {
        this.failCount++;
        const fb = $("tt-feedback");
        if (fb && this.failCount >= 3) {
          // nach mehreren Versuchen: zum Hinweis-Knopf lotsen
          this.failCount = 0;
          fb.innerHTML = '<div class="tt-feedback">💪 Tippfehler sind der häufigste Stolperstein. Der 🔭 Hinweis unten hilft – das ist keine Schande!</div>';
        } else if (fb && !result.error) {
          // Befehl lief fehlerfrei, erfüllt die Aufgabe aber (noch) nicht → SOFORT sanft rückmelden
          // (sonst bleibt das Spiel stumm, obwohl im Terminal eine Erfolgs-ID steht – siehe Issue #17)
          const tip = /^docker\s+run\b/.test(norm)
            ? "Bei <code>docker run</code>: hinter <code>--name</code> steht dein Wunschname, das Image kommt ganz zuletzt – Muster <code>docker run -d --name &lt;name&gt; &lt;image&gt;</code>."
            : "Vergleich ihn mit dem Muster oben – Reihenfolge und Namen genau prüfen.";
          fb.innerHTML = '<div class="tt-feedback">❌ Fast – der Befehl lief durch, erfüllt die Aufgabe aber noch nicht. ' + tip + '</div>';
        }
      }
    },

    taskSolved() {
      const s = this.funkSession();

      if (s.kind === "practice") {
        const p = this.practice;
        this.reward(8, 6);
        p.idx++; p.task = null;
        if (p.idx >= p.drills.length) {
          this.reward(10, 10, "🏋️ Übungsrunde geschafft!");
          this.practice = null;
        }
        this.renderTermTasks();
        const fb = $("tt-feedback");
        if (fb && this.practice) fb.innerHTML = '<div class="tt-feedback">✅ Stark! Nächste Übung ⤴</div>';
        else if (fb) fb.innerHTML = '<div class="tt-feedback">🎉 Runde komplett! Komm jederzeit wieder – Übung füllt den Beutel.</div>';
        return;
      }

      // Quest-Schritt
      const step = s.step!;
      this.reward(12, 7);
      if (step.type === "drill") {
        this._drillTask = null;
        Game.state.taskIdx = (Game.state.taskIdx || 0) + 1;
        Game.save();
        if (Game.state.taskIdx >= step.count) return this.finishFunkStep();
      } else if (step.type === "teach") {
        return this.finishFunkStep();
      } else {
        Game.state.taskIdx = (Game.state.taskIdx || 0) + 1;
        Game.save();
        if (Game.state.taskIdx >= step.tasks.length) return this.finishFunkStep();
      }
      this.renderTermTasks();
      const fb = $("tt-feedback");
      if (fb) fb.innerHTML = '<div class="tt-feedback">✅ Stark! Weiter ⤴</div>';
    },

    finishFunkStep() {
      const result = Game.advanceStep() || {};
      this._drillTask = null;
      if (result.questDone) {
        const q = result.questDone;
        Game.registerQuestCards(q.id);
        this.reward(q.rewardXp, q.rewardCoins, "🏁 Quest „" + q.title + "“ abgeschlossen!");
      } else {
        this.reward(10, 6, "📻 Auftrag erledigt!");
      }
      const next = Game.currentStep();
      if (next && Game.isFunkStep(next)) {
        if (next.scenario) { Game.sim.mergeScenario(next.scenario); Game.save(); }
      }
      this.renderTermTasks();
      this.refreshHud();
      const fb = $("tt-feedback");
      if (fb) {
        if (next && !Game.isFunkStep(next) && next.npc) {
          const npc = NPCS[next.npc];
          fb.innerHTML = `<div class="tt-feedback">🎉 Geschafft! <b>${npc.name}</b> will dich sprechen. (Esc schließt das Funkgerät)</div>`;
        } else if (next && Game.isFunkStep(next)) {
          fb.innerHTML = `<div class="tt-feedback">🎉 Weiter geht's direkt hier ⤴</div>`;
        }
      }
    },

    termHint() {
      const task = this.currentTask();
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
      const task = this.currentTask();
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

    /* ========== Üben ========== */
    startPractice(npcId: string) {
      const available = Game.practiceDrillsFor(npcId);
      const drills: string[] = [];
      for (let i = 0; i < 3; i++) drills.push(available[Math.floor(Math.random() * available.length)]);
      this.practice = { npcId, drills, idx: 0, task: null };
      this.toggleTerminal();
    },

    /* ========== Stapel-Minispiel ========== */
    openStackGame() {
      this.closeOverlays();
      $("overlay-stack").classList.remove("hidden");
      this.stack = { round: 0, score: 0 };
      this.renderStackRound();
    },

    renderStackRound() {
      const st = this.stack;
      const rounds = KQContent.STACK_ROUNDS;
      if (st.round >= rounds.length) {
        const coins = 5 * st.score;
        if (st.score > (Game.state.stats.stackBest || 0)) Game.state.stats.stackBest = st.score;
        Game.save();
        this.reward(15, coins, "🎮 Stapel-Spiel beendet!");
        $("stack-body").innerHTML = `<div style="text-align:center">
          <div style="font-size:3em">📦</div>
          <h2>${st.score} von ${rounds.reduce((s, r) => s + r.layers.length, 0)} Schichten ohne Fehler!</h2>
          <p class="dim">Merke: Ein Image ist ein <b>Schichtstapel</b>. Unten die Basis (ändert sich selten = bleibt im Cache),
          oben dein Code (ändert sich oft). Gute Reihenfolge = schnelle Builds!</p>
          <button class="primary" onclick="UI.closeOverlays()">Zurück zu Bo</button></div>`;
        this.stack = null;
        return;
      }
      const round = rounds[st.round];
      st.target = round.layers;
      st.placed = 0;
      let html = `<p><b>Runde ${st.round + 1}/${rounds.length}: ${round.name}</b> –
        Bo ruft die Schichten durcheinander. Stapel sie in der <b>richtigen Reihenfolge</b>: unten anfangen (Basis zuerst)!</p>
        <div class="stack-area"><div class="stack-pile" id="stack-pile"></div>
        <div class="stack-choices" id="stack-choices"></div></div>`;
      $("stack-body").innerHTML = html;
      const choices = $("stack-choices");
      for (const layer of shuffled(round.layers)) {
        const b = document.createElement("button");
        b.textContent = "📦 " + layer;
        b.onclick = () => this.placeLayer(layer, b);
        choices.appendChild(b);
      }
    },

    placeLayer(layer: string, btn: HTMLButtonElement) {
      const st = this.stack;
      if (!st) return;
      if (layer === st.target[st.placed]) {
        st.placed++; st.score++;
        btn.remove();
        const div = document.createElement("div");
        div.className = "stack-layer";
        div.textContent = "📦 " + layer;
        $("stack-pile").prepend(div);
        if (window.SFX) SFX.success();
        if (st.placed >= st.target.length) {
          st.round++;
          setTimeout(() => this.renderStackRound(), 700);
        }
      } else {
        st.score = Math.max(0, st.score - 1);
        btn.classList.add("wrong");
        setTimeout(() => btn.classList.remove("wrong"), 400);
        if (window.SFX) SFX.wrong();
        const expected = st.placed === 0 ? "der Basis (FROM …)" : "der nächsten Schicht über „" + st.target[st.placed - 1].split(" (")[0] + "“";
        $("stack-pile").insertAdjacentHTML("beforebegin", "");
        this.toast("❌ Nicht ganz – wir sind bei " + expected + ".");
      }
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
        if (!done && !active) return;
        html += `<div class="ql-quest ${done ? "done" : ""}">
          <div class="ql-title">${done ? "✅" : "▶️"} ${q.title}</div>
          ${active ? `<div>${this.hintForStep()}</div>` : ""}
        </div>`;
      });
      if (Game.allQuestsDone()) {
        html += `<div class="ql-quest"><div class="ql-title">🏅 Grundausbildung abgeschlossen!</div>
          <div>Der Hafen verdient jetzt für dich – aber Piraten 🏴‍☠️ und die Krake 🐙 lauern.
          Übe bei der Crew, spiele Bos Stapel-Spiel und halte den Streak! Neue Inseln (Ingress, GitOps …) in Arbeit.</div></div>`;
      }
      const r = Game.rank();
      const rate = Math.round(Game.incomeRate() * 10) / 10;
      html += `<div class="ql-stats">Rang: ${r.icon} ${r.name} · ${s.xp} XP · 🪙 ${s.coins} (+${rate}/min) · 🔥 Streak: ${s.streak.count}<br>
        Befehle gefunkt: ${s.stats.commands} · Quiz richtig: ${s.stats.quizRight} · Piraten vertrieben: ${s.stats.piratesBeaten} · Kraken vertrieben: ${s.stats.krakenBeaten}<br>
        <div class="actions" style="margin-top:10px">
          <button onclick="UI.exportSave()">💾 Spielstand sichern (Datei)</button>
          <button onclick="document.getElementById('save-import').click()">📂 Spielstand laden</button>
          <button class="linklike" onclick="UI.resetGame()">Zurücksetzen</button>
        </div>
        <div class="dim" style="margin-top:6px">Gespeichert wird automatisch alle 5 Sekunden im Browser. Die Datei brauchst du nur als Backup oder für einen anderen Rechner/Browser.</div></div>`;
      $("quest-body").innerHTML = html;
    },

    hintForStep() {
      const step = Game.currentStep();
      if (!step) return "";
      if (Game.isFunkStep(step)) return "📻 Öffne dein Funkgerät (T) und erledige die Aufgaben.";
      const npc = NPCS[step.npc];
      return "💬 Sprich mit <b>" + npc.name + "</b> (" + npc.title + ").";
    },

    /* ========== Shop ========== */
    openShop() {
      this.closeOverlays();
      $("overlay-shop").classList.remove("hidden");
      const s = Game.state;
      let html = `<p class="dim">„Willkommen! Frische Ware, faire Preise!“ – Du hast <b>${s.coins} 🪙</b>.
        Dein 🔥 Streak (${s.streak.count}) gibt bis zu +50% auf Belohnungen, dein Hafen verdient +${Math.round(Game.incomeRate() * 10) / 10}/min.</p>
        <div class="shop-grid">`;
      for (const item of KQContent.SHOP as any[]) {
        const ownedCount = s.inventory[item.id] || 0;
        const ownedPerm = s.owned.includes(item.id);
        let action;
        if (item.type === "consumable") {
          action = `<button class="primary" onclick="UI.buyItem('${item.id}')">Kaufen – ${item.price} 🪙</button>
            ${ownedCount > 0 ? `<div class="si-owned">Im Beutel: ${ownedCount}</div>` : ""}`;
        } else if (ownedPerm) {
          if (item.type === "upgrade") {
            action = `<div class="si-owned">✅ Installiert</div>`;
          } else {
            const active = s.activePet === item.id || s.activeFlag === item.id;
            action = active
              ? `<button onclick="UI.toggleItem('${item.id}', false)">✅ Aktiv – abschalten</button>`
              : `<button onclick="UI.toggleItem('${item.id}', true)">Aktivieren</button>`;
          }
        } else {
          action = `<button class="primary" onclick="UI.buyItem('${item.id}')">Kaufen – ${item.price} 🪙</button>`;
        }
        const icon = item.tex !== undefined
          ? `<canvas width="16" height="16" data-tex="${item.tex}"></canvas>`
          : item.sprite !== undefined
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
        const c = cv as HTMLCanvasElement;
        this.drawPortrait(c, parseInt(c.dataset.sprite!, 10));
      });
      document.querySelectorAll("#shop-body canvas[data-tex]").forEach(cv => {
        const c = cv as HTMLCanvasElement;
        this.drawTexIcon(c, c.dataset.tex!);
      });
    },

    buyItem(itemId: string) {
      const result = Game.buy(itemId);
      this.toast(result.ok ? "🛒 " + result.msg : "⚠️ " + result.msg);
      if (result.ok && window.SFX) SFX.coin();
      this.refreshHud();
      this.openShop();
    },

    toggleItem(itemId: string, on: boolean) {
      const item = KQContent.SHOP.find(s => s.id === itemId);
      if (!item) return;
      if (item.type === "pet") Game.state.activePet = on ? itemId : null;
      if (item.type === "flag") Game.state.activeFlag = on ? itemId : null;
      Game.save();
      this.openShop();
    },

    /* ========== Krabben-Quiz ========== */
    openReview() {
      this.closeOverlays();
      $("overlay-review").classList.remove("hidden");
      const total = Object.keys(Game.state.review).length;
      const dueIds = Game.dueReviewItems(10);
      if (dueIds.length === 0) {
        // Kein Dead-End mehr: solange Karten existieren, bieten wir freies Üben an.
        $("review-body").innerHTML = total === 0
          ? `<div style="text-align:center">
              <div style="font-size:3em">🦀</div>
              <p>„Schnipp schnapp! Noch keine Karten im Stapel – schließe erst eine Quest ab, dann üben wir täglich!“</p>
              <button class="primary" onclick="UI.closeOverlays()">Alles klar, Kralle!</button></div>`
          : `<div style="text-align:center">
              <div style="font-size:3em">🦀</div>
              <p>„Heute ist nichts mehr fällig – dein Wissen ist frisch wie der Morgenfang! Aber wir können <b>frei üben</b>, so oft du willst. Schnipp!“</p>
              <div class="actions">
                <button class="primary" onclick="UI.startFreePractice()">🦀 Frei üben</button>
                <button onclick="UI.closeOverlays()">Später</button>
              </div></div>`;
        return;
      }
      this.review = { ids: dueIds, idx: 0, right: 0, free: false };
      this.renderReviewItem();
    },

    /** Freies Üben: zieht aus ALLEN gelernten Karten, beliebig oft. Lässt den
     *  Spaced-Repetition-Plan unangetastet und gibt keine Belohnung (kein Farmen). */
    startFreePractice() {
      $("overlay-review").classList.remove("hidden");
      const ids = Game.freeReviewItems(10);
      if (ids.length === 0) { this.openReview(); return; }
      this.review = { ids, idx: 0, right: 0, free: true };
      this.renderReviewItem();
    },

    renderReviewItem(): void {
      const r = this.review;
      if (r.idx >= r.ids.length) {
        const free = !!r.free;
        if (!free) {
          // nur die tägliche fällige Runde zählt für Statistik & Bonus
          Game.state.stats.reviews++;
          Game.save();
          if (r.right === r.ids.length) this.reward(10, 10, "🌟 Perfekte Quizrunde!");
        }
        $("review-body").innerHTML = `<div style="text-align:center">
          <div style="font-size:3em">🦀</div>
          <h2>${r.right} von ${r.ids.length} richtig!</h2>
          <p class="dim">${free
            ? "Freies Üben – so oft du willst! (zählt nicht in den täglichen Wiederholungs-Plan)"
            : "Richtige Karten kommen seltener wieder, falsche öfter – bis alles sitzt. Schnipp!"}</p>
          <div class="actions">
            <button class="primary" onclick="UI.startFreePractice()">🦀 Nochmal frei üben</button>
            <button onclick="UI.closeOverlays()">Zurück ins Abenteuer</button>
          </div></div>`;
        this.review = null;
        return;
      }
      const itemId = r.ids[r.idx];
      const content = Game.findReviewContent(itemId);
      if (!content) { r.idx++; return this.renderReviewItem(); }
      r.current = { itemId, content, answered: false };

      let body;
      if (content.kind === "quiz") {
        const q = content.q!;
        r.current.order = shuffled(q.options.map((_: unknown, i: number) => i));
        body = `<div class="quiz-q">${q.q}</div>
          <div class="quiz-options" id="quiz-options">
            ${r.current.order.map((oi: number) => `<button data-oi="${oi}" onclick="UI.answerReviewQuiz(${oi})">${esc(q.options[oi])}</button>`).join("")}
          </div><div id="review-explain"></div>`;
      } else {
        const card = content.card!;
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

    answerReviewQuiz(optionIndex: number) {
      const r = this.review;
      if (!r || r.current.answered) return;
      r.current.answered = true;
      const q = r.current.content.q;
      const correct = optionIndex === q.correct;
      document.querySelectorAll("#quiz-options button").forEach(btn => {
        const oi = parseInt((btn as HTMLElement).dataset.oi!, 10);
        (btn as HTMLButtonElement).disabled = true;
        if (oi === q.correct) btn.classList.add("correct");
        else if (oi === optionIndex) btn.classList.add("wrong");
      });
      this.finishReviewItem(correct, q.explain);
    },

    answerReviewCmd(ev: any) {
      if (ev.key !== "Enter") return;
      const r = this.review;
      if (!r || r.current.answered) return;
      const line = ev.target.value.trim().replace(/\s+/g, " ");
      if (!line) return;
      r.current.answered = true;
      ev.target.disabled = true;
      const card = r.current.content.card;
      const correct = card.accept.some((re: RegExp) => re.test(line));
      this.finishReviewItem(correct, "Die Lösung: <code>" + esc(card.solution) + "</code>");
    },

    finishReviewItem(correct: boolean, explainHtml: string) {
      const r = this.review;
      if (r.free) {
        // Freies Üben: SR-Plan unangetastet lassen, keine Belohnung (kein Farmen)
        if (correct) { r.right++; if (window.SFX) SFX.success(); }
        else if (window.SFX) SFX.wrong();
      } else {
        Game.reviewResult(r.current.itemId, correct);
        if (correct) { r.right++; this.reward(4, 3); }
        else if (window.SFX) SFX.wrong();
      }
      $("review-explain").innerHTML = `
        <div class="quiz-explain">${correct ? "✅ <b>Richtig!</b> Schnipp-schnapp-applaus! 🦀" : "❌ <b>Nicht ganz.</b>"} ${explainHtml}</div>
        <div class="actions"><button class="primary" onclick="UI.nextReviewItem()">Weiter ➡️</button></div>`;
    },

    nextReviewItem() {
      this.review.idx++;
      this.renderReviewItem();
    },

    /* ========== Spielstand-Datei ========== */
    exportSave() {
      const data = Game.exportData();
      if (data == null) { this.toast("⚠️ Kein Spielstand zum Sichern gefunden."); return; }
      const blob = new Blob([data], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "kubequest-spielstand.json";
      a.click();
      URL.revokeObjectURL(a.href);
      this.toast("💾 Spielstand als Datei gesichert!");
    },

    importSave(ev: any) {
      const file = ev.target.files[0];
      ev.target.value = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          // readAsText liefert immer einen String (nie ArrayBuffer/null) – TS weiß das nicht.
          if (typeof reader.result !== "string") throw new Error("kein Text");
          Game.importData(reader.result);
          this.toast("📂 Spielstand geladen – Spiel startet neu …");
          setTimeout(() => location.reload(), 800);
        } catch (e) {
          this.toast("⚠️ Das ist keine gültige KubeQuest-Spielstand-Datei.");
        }
      };
      reader.readAsText(file);
    },

    /* ========== Sonstiges ========== */
    resetGame() {
      if (!confirm("Wirklich den kompletten Spielstand löschen?")) return;
      Game.reset();
      location.reload();
    },
  };

  window.UI = UI;
