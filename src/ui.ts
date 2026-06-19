/* ===== KubeQuest 3.0 – UI & Quest-Steuerung =====
 * Dialoge, Funkgerät (teach/drill/terminal + freies Üben), Shop,
 * Krabben-Quiz, Stapel-Minispiel, Alarm-Leiste, HUD.
 */
import { Game } from "./game";
import { KQContent } from "./content";
import { KQAssets } from "./assets-data";
import { SFX, MUSIC_THEMES } from "./sfx";
import { worldScene, interiorOpen } from "./runtime";
import { resolveOverlayKey } from "./overlaykbd";
import { ABBREVS, lockedAbbrevInInput, abbrevLockHint } from "./content/abbrev";

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

  // Befehls-Karten im Krabben-Quiz: so viele Tipp-Versuche, bevor die Lösung
  // gezeigt und die Karte als "nicht gekonnt" gewertet wird (#234). Jederzeit
  // kann man per "Lösung zeigen" früher aussteigen – man hängt also nie fest.
  const CMD_MAX_ATTEMPTS = 3;

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
    _gateClearedIdx: -1,     // questIdx, für den das Wiederholungs-Gate schon erledigt ist (#222)
    choiceBtns: null as any, // Dialog-Antwort-Buttons (für Tastatur-Navigation)
    choiceSel: 0,
    reviewSel: -1,           // markierte Quiz-Option in der Wissensrunde (Pfeiltasten, #258)

    /* ========== Event-Delegation ==========
     * Ein einziger delegierter Listener am document übersetzt data-action-
     * Attribute in UI-Methoden – ersetzt die früheren onclick="UI.x()"-Inline-
     * Handler (die den globalen window.UI-Shim brauchten). Auch dynamisch
     * erzeugte Buttons in den Overlays sind damit ohne Neu-Verdrahtung
     * abgedeckt. Wird einmalig beim Start aus main.ts aufgerufen. */
    bindEvents() {
      document.addEventListener("click", ev => {
        const el = (ev.target as HTMLElement).closest("[data-action]") as HTMLElement | null;
        if (!el) return;
        const arg = el.dataset.arg;
        switch (el.dataset.action) {
          case "openMenu": this.openMenu(); break;
          case "closeOverlays": this.closeOverlays(); break;
          case "exportSave": this.exportSave(); break;
          case "resetGame": this.resetGame(); break;
          case "importPick": ($("save-import") as HTMLInputElement).click(); break;
          case "termHint": this.termHint(); break;
          case "termSolution": this.termSolution(); break;
          case "buyItem": if (arg) this.buyItem(arg); break;
          case "toggleItem": if (arg) this.toggleItem(arg, el.dataset.on === "1"); break;
          case "startFreePractice": this.startFreePractice(); break;
          case "nextReviewItem": this.nextReviewItem(); break;
          case "answerReviewQuiz": this.answerReviewQuiz(Number(el.dataset.oi)); break;
          case "revealReviewCmd": this.revealReviewCmd(); break;
        }
      });
      // Audio-Regler/-Schalter im Menü: Checkboxen feuern "change", Slider "input".
      // Beide delegiert am document abgefangen (Block wird dynamisch erzeugt).
      const onAudio = (ev: Event) => {
        const el = (ev.target as HTMLElement).closest("[data-audio]") as HTMLInputElement | null;
        if (el) this.onAudioControl(el);
        const setting = (ev.target as HTMLElement).closest("[data-setting]") as HTMLInputElement | null;
        if (setting) this.onSettingControl(setting);
      };
      document.addEventListener("change", onAudio);
      document.addEventListener("input", onAudio);
      // Spielstand-Datei laden (früher inline onchange am <input>)
      ($("save-import") as HTMLInputElement).addEventListener("change", ev => this.importSave(ev));
      // Quiz-Befehlseingabe: Enter wertet aus. Das Eingabefeld wird dynamisch in
      // #review-body erzeugt, darum delegiert am stabilen Container lauschen.
      $("review-body").addEventListener("keydown", ev => {
        if ((ev.target as HTMLElement).id === "review-input") this.answerReviewCmd(ev);
      });
    },

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
        ["overlay-terminal", "overlay-quest", "overlay-shop", "overlay-review", "overlay-stack", "overlay-menu"]
          .some(id => !$(id).classList.contains("hidden"));
    },

    closeOverlays() {
      ["overlay-terminal", "overlay-quest", "overlay-shop", "overlay-review", "overlay-stack", "overlay-menu"].forEach(id => $(id).classList.add("hidden"));
      if (this.practice && this.practice.idx >= this.practice.drills.length) this.practice = null;
    },

    /* ---------- Generische Tastatur-Bedienung einfacher Modals (#283) ----------
     * Blockierende Overlays ohne eigene Navigation (Stapel-Spiel, Shop, Logbuch,
     * Menü) ganz ohne Maus bedienbar machen: ↑/↓ (w/s) wandert über die Buttons,
     * Enter/Leer/E löst den markierten – sonst den Primär-Button – aus. Dialog,
     * Wissensrunde (reviewKey) und Terminal (Eingabefeld) haben eigene Handler und
     * sind hier bewusst NICHT gelistet. Die Entscheidung selbst liegt im puren,
     * unit-getesteten `overlaykbd.ts`; hier nur die DOM-Anbindung. */
    overlayKey(k: string, ev: KeyboardEvent): boolean {
      const ids = ["overlay-stack", "overlay-shop", "overlay-quest", "overlay-menu"];
      const ov = ids.map($).find(el => !el.classList.contains("hidden"));
      if (!ov) return false;
      const btns = Array.from(ov.querySelectorAll("button")) as HTMLButtonElement[];
      if (!btns.length) return false;
      const current = btns.findIndex(b => b.classList.contains("sel"));
      const res = resolveOverlayKey(btns.map(b => ({ disabled: b.disabled, primary: b.classList.contains("primary") })), current, k);
      if (!res) return false;
      ev.preventDefault();
      if (res.kind === "nav") {
        btns.forEach((b, i) => b.classList.toggle("sel", i === res.sel));
        btns[res.sel].focus();
      } else {
        btns[res.index].click();
      }
      return true;
    },

    /* ========== Menü / Pause ========== */
    openMenu() {
      this.closeOverlays();
      this.renderAudioSettings();
      this.renderEventSettings();
      $("overlay-menu").classList.remove("hidden");
    },

    /** Spiel-Feel-Block im Menü (#71): Frequenz/Härte der Zufalls-Events regelbar
     *  bis hin zu "Cozy"/"Aus". Spiegelt Game.state.settings.events. */
    renderEventSettings() {
      const cur = Game.state.settings.events;
      const opts: { mode: import("./types").EventMode; label: string }[] = [
        { mode: "normal", label: "🌊 Normal" },
        { mode: "cozy", label: "🍵 Cozy" },
        { mode: "off", label: "🌴 Aus" },
      ];
      const radios = opts.map(o =>
        '<label><input type="radio" name="kq-events" data-setting="events" value="' + o.mode + '"' +
        (cur === o.mode ? " checked" : "") + "> " + o.label + "</label>"
      ).join("");
      $("menu-events").innerHTML =
        '<h3 class="menu-audio-title">⛈️ Stürme &amp; Piraten</h3>' +
        '<div class="audio-row">' + radios + "</div>" +
        '<div class="dim">Cozy macht Zufalls-Events seltener &amp; sanfter und mildert den Verdienst-Ausfall kaputter Dienste. „Aus" schaltet sie ganz ab – entspanntes Lernen ohne Zeitdruck.</div>';
    },

    /** Audio-Block im Menü neu aufbauen (spiegelt Game.state.audio). */
    renderAudioSettings() {
      const a = Game.state.audio;
      const pct = (v: number) => Math.round(v * 100);
      const trackOpts = MUSIC_THEMES.map(t =>
        '<option value="' + t.id + '"' + (a.track === t.id ? " selected" : "") + ">" + t.label + "</option>"
      ).join("");
      $("menu-audio").innerHTML =
        '<h3 class="menu-audio-title">🔊 Audio</h3>' +
        '<div class="audio-row">' +
        '<label><input type="checkbox" data-audio="music"' + (a.music ? " checked" : "") + '> 🎵 Musik</label>' +
        '<input type="range" min="0" max="100" value="' + pct(a.musicVol) + '" data-audio="musicVol" aria-label="Musik-Lautstärke">' +
        '</div>' +
        '<div class="audio-row">' +
        '<label>🎼 Musikstück</label>' +
        '<select data-audio="track" aria-label="Musikstück">' + trackOpts + '</select>' +
        '</div>' +
        '<div class="audio-row">' +
        '<label><input type="checkbox" data-audio="sfx"' + (a.sfx ? " checked" : "") + '> 🔔 Soundeffekte</label>' +
        '<input type="range" min="0" max="100" value="' + pct(a.sfxVol) + '" data-audio="sfxVol" aria-label="Sound-Lautstärke">' +
        '</div>';
    },

    /** Reaktion auf einen Audio-Regler/-Schalter im Menü. */
    onAudioControl(el: HTMLInputElement) {
      const a = Game.state.audio;
      switch (el.dataset.audio) {
        case "music": a.music = el.checked; SFX.setMusicEnabled(a.music); break;
        case "sfx": a.sfx = el.checked; SFX.setSfxEnabled(a.sfx); if (a.sfx) SFX.coin(); break;
        case "musicVol": a.musicVol = Number(el.value) / 100; SFX.setMusicVol(a.musicVol); break;
        case "track": a.track = el.value; SFX.setTrack(a.track); if (a.sfx) SFX.coin(); break;
        case "sfxVol": a.sfxVol = Number(el.value) / 100; SFX.setSfxVol(a.sfxVol); if (a.sfx) SFX.coin(); break;
        default: return;
      }
      Game.save();
    },

    /** Reaktion auf einen Spiel-Feel-Schalter im Menü (#71). */
    onSettingControl(el: HTMLInputElement) {
      if (el.dataset.setting !== "events" || !el.checked) return;
      const mode = el.value;
      if (mode === "normal" || mode === "cozy" || mode === "off") {
        Game.setEventMode(mode);
        if (Game.state.audio.sfx) SFX.coin();
      }
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

    /** Uhrzeit + Datum im HUD setzen. Wird vom Tag-Nacht-Zyklus jeden Frame
     *  aufgerufen, damit die Anzeige synchron zum Lichtschleier läuft. (#39) */
    setClock(dateLabel: string, timeLabel: string, title: string) {
      $("hud-date").textContent = dateLabel;
      $("hud-time").textContent = timeLabel;
      $("hud-clock").title = title;
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
      } else if (step.type === "minigame") {
        const npc = NPCS[step.npc];
        el.innerHTML = "📜 <b>" + q.title + "</b> – Sprich <b>" + npc.name + "</b> an und wähle 🎮 Stapel-Spiel";
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
      SFX.coin();
      if (rankUp) {
        const r = Game.rank();
        this.toast("🎉 <b>Beförderung!</b> Du bist jetzt <b>" + r.icon + " " + r.name + "</b>!", "rankup");
        SFX.fanfare();
        worldScene()?.burstAtPlayer("sparkle");
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
      return !!(step && (step.type === "dialog" || step.type === "choice" || step.type === "minigame") && step.npc === npcId);
    },

    updatePrompt() {
      const p = $("prompt");
      const ws = worldScene();
      // Im Hausinnenraum (#6) zeigt die InteriorScene ihren eigenen Hinweis.
      if (this.blocking() || !ws || interiorOpen()) { p.classList.add("hidden"); return; }
      const near = ws.nearestNpc();
      if (!near) { p.classList.add("hidden"); return; }
      const meta = NPCS[near.id];
      let label = "💬 Mit " + meta.name + " reden";
      if (near.id === "pelle") label = "🛒 Bei Pelle einkaufen";
      if (near.id === "kralle") label = "🦀 Quizrunde mit Kralle";
      p.innerHTML = "<b>E</b> – " + label;
      p.classList.remove("hidden");
    },

    interact() {
      // Während ein Hausinnenraum offen ist, gehört die E-Taste der InteriorScene
      // (sonst würde man durch die Wand mit Außen-NPCs der pausierten Welt reden).
      if (interiorOpen()) return;
      const ws = worldScene();
      if (!ws) return;
      const near = ws.nearestNpc();
      if (!near) return;
      this.talkTo(near.id);
    },

    /** Talk-Routing für einen NPC: Pelle→Shop, Kralle→Quiz, laufender Quest-Step,
     *  sonst das NPC-Menü. Bewusst aus interact() herausgezogen und OHNE den
     *  interiorOpen()-Guard, damit die InteriorScene (#201) den Bewohner im
     *  Innenraum direkt ansprechen kann. Der Guard in interact() bleibt – er
     *  verhindert weiterhin, dass man durch die Wand mit Außen-NPCs der
     *  pausierten Welt redet. */
    talkTo(npcId: string): void {
      if (npcId === "pelle") return this.openShop();
      if (npcId === "kralle") return this.openReview();

      const step = Game.currentStep();
      if (step && (step.type === "dialog" || step.type === "choice") && step.npc === npcId) {
        // Sanftes Wiederholungs-Gate (#222): bevor eine NEUE Quest startet (Schritt 0)
        // und nur wenn Karten fällig sind, kurz auffrischen – einmal pro Quest.
        if (Game.shouldReviewGate() && this._gateClearedIdx !== Game.state.questIdx) {
          return this.openReviewGate(npcId);
        }
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
      // Szenario eines Dialog-/Choice-Schritts beim Betreten einmischen. Funk-Schritte
      // bekommen ihr Szenario in afterStep/finishFunkStep; Dialog-/Choice-Schritte liefen
      // bisher durch keinen Merge-Pfad, sodass z.B. das Dockerfile aus q3b live fehlte und
      // erst nach einem Reload (game.ts re-merged erreichte Szenarien) auftauchte (#214).
      if (step.scenario) { Game.sim.mergeScenario(step.scenario); Game.save(); }
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
        worldScene()?.burstAtPlayer("sparkle");
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

    /* ========== Begrüßung / Intro (#288) ========== */
    /** Einmalige Begrüßung beim allerersten Spielstart: Wer bin ich, wie steuere
     *  ich, was ist mein erstes Ziel (zu Ole). Läuft über den normalen Dialog
     *  (Ole als Sprecher) – das setzt zugleich den "!"-Quest-Marker über Ole in
     *  Szene. Gezeigt wird das genau einmal; main.ts merkt sich das per
     *  Game.state.introSeen. */
    showIntro() {
      this.showDialogue("ole", [
        "⚓ Ahoi und herzlich willkommen in <b>Port Kubernia</b>! Ich bin Ole, der Hafenmeister – schön, dass du anheuerst.",
        "Hier wird dein Hafen Stück für Stück zu einem echten Cluster: Du lernst Docker, Kubernetes &amp; Co., indem du den Betrieb am Laufen hältst. Aber der Reihe nach – kurz zur Steuerung:",
        "🕹️ <b>Laufen:</b> Pfeiltasten oder <b>WASD</b>. <b>Reden &amp; bestätigen:</b> <b>E</b> (oder Enter/Leertaste), sobald jemand in der Nähe ist.",
        "📻 <b>T</b> öffnet dein Funkgerät (deine Kommandozeile), 📜 <b>J</b> das Logbuch mit deiner aktuellen Aufgabe, <b>Esc</b> das Menü.",
        "Du stehst ja schon vor meiner <b>Hafenmeisterei</b> – wunderbar! Sprich mich einfach an (drück <b>E</b>), dann gebe ich dir deinen ersten Auftrag. Auf geht's! ⚓",
      ]);
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
      $("dlg-text").innerHTML = KQContent.applyGlossary(d.lines[d.idx]);
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
      $("dlg-text").innerHTML = "🤔 " + KQContent.applyGlossary(step.q);
      $("dlg-next").textContent = "↑/↓ wählen · Enter bestätigen";
      $("dlg-next").classList.remove("hidden");
      const box = $("dlg-choices");
      box.innerHTML = "";
      for (const opt of shuffled<any>(step.options)) {
        const btn = document.createElement("button");
        btn.innerHTML = KQContent.applyGlossary(opt.t);
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
      else SFX.wrong();
      $("dlg-text").innerHTML = (opt.ok ? "✅ " : "❌ ") + KQContent.applyGlossary(opt.reply);
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
        return (tasks && tasks[Game.state.taskIdx || 0]) || null;
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
          <br><br>💡 Übungs-Aufgaben mit Belohnung bekommst du bei der Crew: ansprechen → „Üben”.
          <br><br>💬 Bug gefunden oder Idee? <a href=”https://github.com/fluffels/kubequest/discussions” target=”_blank” rel=”noopener noreferrer”>GitHub Discussions</a></div>
          <div id=”tt-feedback”></div>`;
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
          html += `<div class="tt-new">${KQContent.applyGlossary(step.cmd.intro)}</div>`;
          html += `<div class="tt-item current">▶️ ${KQContent.applyGlossary(step.cmd.text)}</div>`;
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
        <button data-action="termHint">🔭 Hinweis ${fernrohr > 0 ? "(Fernrohr: " + fernrohr + ")" : "(25 🪙)"}</button>
        <button data-action="termSolution">🧭 Lösung ${kompass > 0 ? "(Kompass: " + kompass + ")" : "(50 🪙)"}</button>
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

      // #299: Der Befehl trifft zwar die Lösung, nutzt aber ein noch nicht
      // freigeschaltetes Profi-Kürzel → freundlicher Hinweis (Langform schreiben)
      // statt es als gelöst zu werten. Die Langform gilt immer; nach Freischaltung
      // (Game.unlockAbbrev, #300) zählen beide Formen.
      const lockedHit = cmdOk ? lockedAbbrevInInput(norm, (id) => Game.isAbbrevUnlocked(id)) : undefined;
      if (lockedHit) {
        const fb = $("tt-feedback");
        if (fb) fb.innerHTML = '<div class="tt-feedback">' + abbrevLockHint(lockedHit) + '</div>';
        return;
      }

      if (cmdOk && !result.error && checkOk) {
        this.failCount = 0;
        SFX.success();
        this.taskSolved();
      } else {
        this.failCount++;
        const fb = $("tt-feedback");
        if (fb && this.failCount >= 3) {
          // nach mehreren Versuchen: zum Hinweis-Knopf lotsen
          this.failCount = 0;
          fb.innerHTML = '<div class="tt-feedback">💪 Tippfehler sind der häufigste Stolperstein. Der 🔭 Hinweis unten hilft – das ist keine Schande!</div>';
        } else if (fb) {
          // Aufgabe nicht gelöst → immer Begründung zeigen (#307: auch wenn der Befehl einen
          // Sim-Fehler warf; „Nie nur falsch, immer begründen" #233).
          const tip = (task.diag ? task.diag(norm) : null)
            ?? task.why
            ?? (/^docker\s+run\b/.test(norm)
              ? "Bei <code>docker run</code>: hinter <code>--name</code> steht dein Wunschname, das Image kommt ganz zuletzt – Muster <code>docker run -d --name &lt;name&gt; &lt;image&gt;</code>."
              : "Vergleich ihn mit dem Muster oben – Reihenfolge und Namen genau prüfen.");
          const prefix = result.error
            ? "❌ "
            : "❌ Fast – der Befehl lief durch, erfüllt die Aufgabe aber noch nicht. ";
          fb.innerHTML = '<div class="tt-feedback">' + prefix + tip + '</div>';
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
      // Abkürzungs-Freischaltung vor dem Voranschreiten (#300): unlockAbbrev am fertigen
      // Schritt → Game.unlockAbbrev + Toast, damit der Toast sichtbar bleibt während die
      // Belohnungs-Anzeige erscheint.
      const completedStep = Game.currentStep();
      if (completedStep?.unlockAbbrev && !Game.isAbbrevUnlocked(completedStep.unlockAbbrev)) {
        const id = completedStep.unlockAbbrev;
        Game.unlockAbbrev(id);
        const pair = ABBREVS.find(a => a.id === id);
        if (pair) {
          const shortForm = pair.short[pair.short.length - 1];
          this.toast(`🔓 Profi-Abkürzung freigeschaltet: <code>${shortForm}</code> = <code>${pair.long}</code>`, "rankup");
        }
      }
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
      // „Warum so?" gleich mitliefern (#233), nicht nur die Musterlösung zeigen.
      const why = task.why ? ' <span class="dim">' + task.why + "</span>" : "";
      if (fb) fb.innerHTML = '<div class="tt-feedback">🧭 <b>Lösung:</b> <code>' + esc(task.solution) + "</code> – selbst eintippen!" + why + "</div>";
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
      // Beim ALLERERSTEN Mal wird die Einführung erzwungen; danach geht's direkt
      // los, und die Erklärung bleibt über den „ℹ️ Erklärung“-Knopf jederzeit
      // wieder aufrufbar (#216).
      if (Game.state.stats.stackIntroSeen) this.renderStackRound();
      else this.renderStackIntro();
    },

    /** Kurze Einführung – kein Vorwissen annehmen (#216): erklärt
     *  Image/Schicht/Basis-Image/ubuntu/Cache in wenigen Sätzen. Wird beim ersten
     *  Spielen automatisch gezeigt und ist danach jederzeit wieder aufrufbar. */
    renderStackIntro() {
      Game.state.stats.stackIntroSeen = 1; // gesehen – ab jetzt nur noch auf Wunsch
      Game.save();
      $("stack-body").innerHTML = `<div class="stack-intro">
        <div style="font-size:2.4em;text-align:center">📦</div>
        <h2 style="text-align:center">Wie ein Image aufgebaut ist</h2>
        <p>Ein <b>Docker-Image</b> ist der Bauplan für einen Container – und es entsteht in <b>Schichten</b> (engl. „Layer“), eine auf der anderen, wie ein Stapel Kisten.</p>
        <p>Ganz unten liegt die <b>Basis-Schicht</b>: ein fertiges Image, auf dem du aufbaust – z.B. <code>ubuntu</code> (ein schlankes Linux-System) oder <code>nginx</code> (ein fertiger Webserver). Darüber kommt Schicht für Schicht dein eigenes Zeug: Software installieren, Dateien kopieren, Startbefehl.</p>
        <p><b>Warum die Reihenfolge zählt:</b> Was sich selten ändert (die Basis), gehört nach unten; dein Code (ändert sich oft) nach oben. So kann Docker die unteren Schichten wiederverwenden (den <b>Cache</b>) und nur neu bauen, was sich wirklich geändert hat – das macht das Bauen (<b>Build</b>) schnell.</p>
        <p class="dim">Gleich rührt Bo die Schichten durcheinander – stapel sie richtig: <b>Basis zuerst (unten), Startbefehl zuletzt (oben)</b>.</p>
        <button class="primary" id="stack-start">Verstanden – stapeln!</button></div>`;
      $("stack-start").onclick = () => this.renderStackRound();
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
          <button class="primary" data-action="closeOverlays">Zurück zu Bo</button></div>`;
        this.stack = null;
        // Geführter Minispiel-Quest-Schritt (#276): einmal komplett gespielt = Schritt
        // erfüllt. Ist der aktuelle Quest-Schritt das Stapel-Spiel, schließen wir ihn ab.
        const mgStep = Game.currentStep();
        if (mgStep && mgStep.type === "minigame" && mgStep.game === "stack") this.afterStep();
        return;
      }
      const round = rounds[st.round];
      st.target = round.layers;
      st.placed = 0;
      let html = `<p><b>Runde ${st.round + 1}/${rounds.length}: ${round.name}</b> –
        Bo ruft die Schichten durcheinander. Stapel sie in der <b>richtigen Reihenfolge</b>: unten anfangen (Basis zuerst)!
        <button id="stack-info" title="Erklärung nochmal ansehen" style="float:right;font-size:.85em">ℹ️ Erklärung</button></p>
        <div class="stack-area"><div class="stack-pile" id="stack-pile"></div>
        <div class="stack-choices" id="stack-choices"></div></div>
        <div class="stack-feedback" id="stack-feedback"></div>`;
      $("stack-body").innerHTML = html;
      $("stack-info").onclick = () => this.renderStackIntro();
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
        SFX.success();
        const fb = $("stack-feedback");
        fb.className = "stack-feedback";
        fb.innerHTML = "";
        if (st.placed >= st.target.length) {
          st.round++;
          setTimeout(() => this.renderStackRound(), 700);
        }
      } else {
        st.score = Math.max(0, st.score - 1);
        btn.classList.add("wrong");
        setTimeout(() => btn.classList.remove("wrong"), 400);
        SFX.wrong();
        // Konkrete Begründung, warum diese Schicht (noch) nicht passt – und sie bleibt
        // stehen, bis der nächste Zug kommt, statt nach Sekunden zu verschwinden (#217).
        const clickedName = layer.split(" (")[0];
        const nextName = st.target[st.placed].split(" (")[0];
        let reason: string;
        if (st.placed === 0) {
          reason = `Ganz <b>unten</b> muss die <b>Basis</b> liegen: <code>${nextName}</code> (die <code>FROM …</code>-Schicht). Darauf baut alles andere auf.`;
        } else {
          const belowName = st.target[st.placed - 1].split(" (")[0];
          reason = `<b>${clickedName}</b> kommt erst weiter oben. Als Nächstes fehlt <code>${nextName}</code> direkt über „${belowName}“. Merke: Schichten stapeln von unten nach oben – Basis zuerst (bleibt im Cache), Startbefehl zuletzt.`;
        }
        const fb = $("stack-feedback");
        fb.className = "stack-feedback bad";
        fb.innerHTML = "❌ " + reason;
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
          <button data-action="exportSave">💾 Spielstand sichern (Datei)</button>
          <button data-action="importPick">📂 Spielstand laden</button>
          <button class="linklike" data-action="resetGame">Zurücksetzen</button>
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
          action = `<button class="primary" data-action="buyItem" data-arg="${item.id}">Kaufen – ${item.price} 🪙</button>
            ${ownedCount > 0 ? `<div class="si-owned">Im Beutel: ${ownedCount}</div>` : ""}`;
        } else if (ownedPerm) {
          if (item.type === "upgrade") {
            action = `<div class="si-owned">✅ Installiert</div>`;
          } else {
            const active = s.activePet === item.id || s.activeFlag === item.id;
            action = active
              ? `<button data-action="toggleItem" data-arg="${item.id}" data-on="0">✅ Aktiv – abschalten</button>`
              : `<button data-action="toggleItem" data-arg="${item.id}" data-on="1">Aktivieren</button>`;
          }
        } else {
          action = `<button class="primary" data-action="buyItem" data-arg="${item.id}">Kaufen – ${item.price} 🪙</button>`;
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
      if (result.ok) SFX.coin();
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
              <button class="primary" data-action="closeOverlays">Alles klar, Kralle!</button></div>`
          : `<div style="text-align:center">
              <div style="font-size:3em">🦀</div>
              <p>„Heute ist nichts mehr fällig – dein Wissen ist frisch wie der Morgenfang! Aber wir können <b>frei üben</b>, so oft du willst. Schnipp!“</p>
              <div class="actions">
                <button class="primary" data-action="startFreePractice">🦀 Frei üben</button>
                <button data-action="closeOverlays">Später</button>
              </div></div>`;
        return;
      }
      this.review = { ids: dueIds, idx: 0, right: 0, assisted: 0, free: false };
      this.renderReviewItem();
    },

    /** Wiederholungs-Gate (#222): kurz vor dem Start einer neuen Quest fällige Karten
     *  auffrischen. Freundliche Ankündigung, dann die fälligen Karten; danach geht es
     *  automatisch in die Quest weiter (siehe Gate-Abschluss in renderReviewItem).
     *  Seit #323: feuert auch nach ≥ 3 Quests ohne Gate (Quest-Count-Gate) – zeigt dann
     *  einen sanften Nudge zum freien Üben statt hartem Pflicht-Review. */
    openReviewGate(npcId: string): void {
      this.closeOverlays();
      Game.state.questsSinceGate = 0; // Gate feuert: Zähler immer zurücksetzen (#323).
      Game.save();
      const dueIds = Game.dueReviewItems(10);
      if (dueIds.length === 0) {
        // Quest-Count-Gate (#323): nichts fällig, aber ≥ 3 Quests am Stück – sanfter Nudge.
        this._gateClearedIdx = Game.state.questIdx;
        $("overlay-review").classList.remove("hidden");
        $("review-body").innerHTML = `<div style="text-align:center">
          <div style="font-size:3em">🦀</div>
          <p>„Schon eine ganze Weile unterwegs! Nichts ist überfällig, aber ein bisschen freies Üben schadet nie – Karten bleiben länger sitzen. Willst du kurz mit mir üben?"</p>
          <button class="primary" id="nudge-practice">Kurz üben mit Kralle ⚓</button>
          <button id="nudge-skip">Lieber direkt weiter ⚓</button></div>`;
        $("nudge-practice").onclick = () => { this.closeOverlays(); this.startFreePractice(); };
        $("nudge-skip").onclick = () => { this.closeOverlays(); this.talkTo(npcId); };
        return;
      }
      $("overlay-review").classList.remove("hidden");
      this.review = { ids: dueIds, idx: 0, right: 0, free: false, gate: { npcId, questIdx: Game.state.questIdx } };
      const n = dueIds.length;
      const kartenWort = n === 1 ? "1 Karte" : n + " Karten";
      $("review-body").innerHTML = `<div style="text-align:center">
        <div style="font-size:3em">🦀</div>
        <p>„Halt, Lotse! Bevor die nächste Aufgabe losgeht, frischen wir kurz <b>${kartenWort}</b> auf – dann sitzt das Gelernte für immer. Schnipp, das geht fix!“</p>
        <button class="primary" id="gate-start">${kartenWort} auffrischen, dann weiter ⚓</button></div>`;
      $("gate-start").onclick = () => this.renderReviewItem();
    },

    /** Freies Üben: zieht aus ALLEN gelernten Karten, beliebig oft. Lässt den
     *  Spaced-Repetition-Plan unangetastet und gibt keine Belohnung (kein Farmen). */
    startFreePractice() {
      $("overlay-review").classList.remove("hidden");
      const ids = Game.freeReviewItems(10);
      if (ids.length === 0) { this.openReview(); return; }
      this.review = { ids, idx: 0, right: 0, assisted: 0, free: true };
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
        // Wiederholungs-Gate (#222): erledigt -> nicht erneut blockieren, weiter zur Quest.
        if (r.gate) {
          this._gateClearedIdx = r.gate.questIdx;
          const npcId = r.gate.npcId;
          $("review-body").innerHTML = `<div style="text-align:center">
            <div style="font-size:3em">🦀</div>
            <h2>Aufgefrischt! ${r.right} von ${r.ids.length} richtig.</h2>
            <p class="dim">Schnipp – jetzt sitzt's wieder. Weiter geht dein Abenteuer!</p>
            <button class="primary" id="gate-continue">Weiter geht's! ⚓</button></div>`;
          $("gate-continue").onclick = () => { this.closeOverlays(); this.talkTo(npcId); };
          this.review = null;
          return;
        }
        $("review-body").innerHTML = `<div style="text-align:center">
          <div style="font-size:3em">🦀</div>
          <h2>${r.right} von ${r.ids.length} richtig!</h2>
          ${r.assisted ? `<p class="dim">🪄 ${r.assisted} mit Hilfe gelöst – die üben wir zur Sicherheit bald nochmal.</p>` : ""}
          <p class="dim">${free
            ? "Freies Üben – so oft du willst! (zählt nicht in den täglichen Wiederholungs-Plan)"
            : "Richtige Karten kommen seltener wieder, falsche öfter – bis alles sitzt. Schnipp!"}</p>
          <div class="actions">
            <button class="primary" data-action="startFreePractice">🦀 Nochmal frei üben</button>
            <button data-action="closeOverlays">Zurück ins Abenteuer</button>
          </div></div>`;
        this.review = null;
        return;
      }
      const itemId = r.ids[r.idx];
      const content = Game.findReviewContent(itemId);
      if (!content) { r.idx++; return this.renderReviewItem(); }
      r.current = { itemId, content, answered: false, attempts: 0 };

      let body;
      if (content.kind === "quiz") {
        const q = content.q!;
        r.current.order = shuffled(q.options.map((_: unknown, i: number) => i));
        this.reviewSel = -1;   // Tastatur-Auswahl (#258) je Karte zurücksetzen
        body = `<div class="quiz-q">${q.q}</div>
          <div class="quiz-options" id="quiz-options">
            ${r.current.order.map((oi: number, i: number) => `<button data-action="answerReviewQuiz" data-oi="${oi}"><span class="qnum">${i + 1}</span>${esc(q.options[oi])}</button>`).join("")}
          </div><div id="review-explain"></div>`;
      } else {
        const card = content.card!;
        body = `<div class="quiz-q">⌨️ ${card.q}</div>
          <div class="review-cmd-row"><span class="term-prompt">crew@hafen:~$</span>
            <input type="text" id="review-input" autocomplete="off" spellcheck="false"
              placeholder="Befehl eintippen, Enter drücken …"></div>
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
        btn.classList.remove("sel");   // Tastatur-Markierung weg, sobald korrekt/falsch greift (#258)
        if (oi === q.correct) btn.classList.add("correct");
        else if (oi === optionIndex) btn.classList.add("wrong");
      });
      this.reviewSel = -1;
      this.finishReviewItem(correct, q.explain);
    },

    /** Tastatursteuerung der Wissensrunde (#258). Wird aus dem globalen Keydown
     *  (main.ts) aufgerufen, solange das Review-Overlay offen ist. Gibt `true`
     *  zurück, wenn die Taste verarbeitet wurde (dann kein Spieler-/Default-Effekt).
     *  - Offene Quiz-Frage: Ziffern 1–n wählen direkt, ↑/↓ markieren, Enter bestätigt.
     *  - Beantwortet / Zwischen- & Endscreens / Gate: Enter/Leertaste löst den
     *    sichtbaren Primär-Button („Weiter ➡️", „Frei üben", Gate-Weiter) aus.
     *  Die Befehls-Eingabe hat ihren eigenen Enter-Handler (answerReviewCmd) und
     *  wird von main.ts gar nicht erst hierher geleitet (Fokus liegt im INPUT). */
    reviewKey(k: string, ev: KeyboardEvent): boolean {
      const r = this.review;
      if (r && r.current && !r.current.answered && r.current.content.kind === "quiz") {
        const order: number[] = r.current.order;
        if (/^[1-9]$/.test(k)) {
          const pos = Number(k) - 1;
          if (pos < order.length) { ev.preventDefault(); this.answerReviewQuiz(order[pos]); }
          return true;
        }
        if (k === "ArrowDown" || k === "ArrowUp") {
          const n = order.length;
          const start = k === "ArrowDown" ? -1 : 0;
          const cur = this.reviewSel < 0 ? start : this.reviewSel;
          this.reviewSel = ((cur + (k === "ArrowDown" ? 1 : -1)) % n + n) % n;
          this.highlightReviewOption();
          ev.preventDefault();
          return true;
        }
        if (k === "Enter" || k === " ") {
          if (this.reviewSel >= 0 && this.reviewSel < order.length) {
            ev.preventDefault();
            this.answerReviewQuiz(order[this.reviewSel]);
          }
          return true;   // offene Frage „schluckt" Enter/Leer, damit nichts dahinter feuert
        }
        return false;
      }
      // beantwortet / Zwischen-/Endscreen / Gate: Primär-Button per Enter/Leertaste
      if (k === "Enter" || k === " ") {
        const btn = $("review-body").querySelector(
          "button.primary, #gate-start, #gate-continue, [data-action='nextReviewItem']",
        ) as HTMLButtonElement | null;
        if (btn) { ev.preventDefault(); btn.click(); return true; }
      }
      return false;
    },

    /** Hebt die per Pfeiltasten markierte Quiz-Option hervor (#258). */
    highlightReviewOption() {
      document.querySelectorAll("#quiz-options button").forEach((b, i) => {
        b.classList.toggle("sel", i === this.reviewSel);
      });
    },

    answerReviewCmd(ev: any) {
      if (ev.key !== "Enter") return;
      const r = this.review;
      if (!r || r.current.answered) return;
      const line = ev.target.value.trim().replace(/\s+/g, " ");
      if (!line) return;
      const card = r.current.content.card;
      const correct = card.accept.some((re: RegExp) => re.test(line));
      // #299: richtige Lösung, aber per noch gesperrtem Kürzel → sanfter Hinweis,
      // erneut tippen lassen (NICHT als Fehlversuch zählen, sonst würde nach
      // CMD_MAX_ATTEMPTS die Kürzel-Lösung verraten). Langform gilt immer.
      const lockedHit = correct ? lockedAbbrevInInput(line, (id) => Game.isAbbrevUnlocked(id)) : undefined;
      if (lockedHit) {
        $("review-explain").innerHTML = `<div class="quiz-explain">${abbrevLockHint(lockedHit)}</div>`;
        ev.target.disabled = false; ev.target.focus(); ev.target.select();
        return;
      }
      if (correct) {
        // Beim 1. Versuch richtig zählt voll; erst nach Retry richtig = "mit Hilfe gelöst" (#234).
        const assisted = r.current.attempts > 0;
        r.current.answered = true;
        ev.target.disabled = true;
        this.finishReviewItem(true, card.explain || "", assisted);
        return;
      }
      // Falsch: nicht weiterspringen, sondern erneut tippen lassen (#234). Begründung
      // warum falsch zeigen (#233) – aber NICHT die Musterlösung, sonst wird sie nur
      // abgeschrieben statt gekonnt. Nach CMD_MAX_ATTEMPTS Versuchen die Lösung zeigen.
      r.current.attempts++;
      SFX.wrong();
      if (r.current.attempts >= CMD_MAX_ATTEMPTS) { this.revealReviewCmd(); return; }
      const remaining = CMD_MAX_ATTEMPTS - r.current.attempts;
      $("review-explain").innerHTML = `
        <div class="quiz-explain">❌ <b>Nicht ganz.</b> ${card.explain || ""}
          <div class="dim" style="margin-top:.4em">🦀 „Nochmal tippen, Matrose!“ – noch ${remaining} Versuch${remaining === 1 ? "" : "e"}.</div></div>
        <div class="actions"><button data-action="revealReviewCmd">Lösung zeigen ➡️</button></div>`;
      // Eingabefeld wieder freigeben und markieren, damit gleich neu getippt werden kann.
      ev.target.disabled = false;
      ev.target.focus();
      ev.target.select();
    },

    /** Bricht den Tipp-Versuch bei einer Befehls-Karte ab: zeigt die Musterlösung
     *  und wertet die Karte als "nicht gekonnt" (aufgegeben / Versuche aufgebraucht, #234). */
    revealReviewCmd() {
      const r = this.review;
      if (!r || r.current.answered || r.current.content.kind !== "cmd") return;
      r.current.answered = true;
      const inp = $("review-input") as HTMLInputElement | null;
      if (inp) inp.disabled = true;
      const card = r.current.content.card;
      this.finishReviewItem(false, "Die Lösung: <code>" + esc(card.solution) + "</code>. " + (card.explain || ""));
    },

    finishReviewItem(correct: boolean, explainHtml: string, assisted = false) {
      const r = this.review;
      // "Mit Hilfe gelöst" (erst nach Retry richtig) zählt fürs Spaced Repetition NICHT
      // als sicher gekonnt – die Karte soll bald wiederkommen (#234, offene Frage).
      const secure = correct && !assisted;
      if (r.free) {
        // Freies Üben: SR-Plan unangetastet lassen, keine Belohnung (kein Farmen)
        if (correct) { if (secure) r.right++; else r.assisted++; SFX.success(); }
        else SFX.wrong();
      } else {
        Game.reviewResult(r.current.itemId, secure);
        if (correct) {
          if (secure) { r.right++; this.reward(4, 3); }
          else { r.assisted++; SFX.success(); }   // mit Hilfe: kein voller Reward
        } else SFX.wrong();
      }
      const head = correct
        ? (assisted
            ? "✅ <b>Richtig – mit Hilfe gelöst.</b> 🦀 Die Karte kommt zur Sicherheit bald nochmal."
            : "✅ <b>Richtig!</b> Schnipp-schnapp-applaus! 🦀")
        : "❌ <b>Nicht ganz.</b>";
      $("review-explain").innerHTML = `
        <div class="quiz-explain">${head} ${explainHtml}</div>
        <div class="actions"><button class="primary" data-action="nextReviewItem">Weiter ➡️</button></div>`;
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
