/* ===== KubeQuest 3.0 – Start =====
 * Spielstand laden, Phaser starten, Tastatur verdrahten.
 */
import Phaser from "phaser";
import { Game } from "./game";
import { UI } from "./ui";
import { KQScenes } from "./scenes";
import { SFX } from "./sfx";
import { keys, clearKeys } from "./runtime";

  // Wie in ui.ts: die DOM-Knoten liegen fest in index.html, darum nicht-nullbar.
  const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;

  /* Fester Spielcharakter: Die Spielfigur ist immer der PixelLab-Sprite
   * `char_player` (4 Richtungen, siehe scenes.ts). Die frühere Charakterwahl
   * setzte nur kurz eine `dungeon`-Textur, die der Bewegungs-Loop sofort wieder
   * mit `char_player` überschrieb – Vorschau ≠ Spielfigur (#45). Das Feld
   * `character` bleibt nur als „schon onboarded?"-Marker (null = erster Start)
   * und als Andockpunkt für späteres Customizing à la Stardew erhalten. */
  const FIXED_CHARACTER = 0;

  function wireKeyboard() {
    window.addEventListener("keydown", e => {
      SFX.ensure();
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        if (e.key === "Escape") { UI.closeOverlays(); (e.target as HTMLElement).blur(); }
        return;
      }
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keys[k] = true;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();

      if (k === "Escape") { if (UI.blocking()) UI.closeOverlays(); else UI.openMenu(); return; }
      if (UI.dialogue) {
        if (UI.hasChoices()) {
          // Antwort-Auswahl per Tastatur: ↑/↓ (oder W/S) navigieren, Enter/E/Leer bestätigen, 1–4 direkt
          if (k === "ArrowUp" || k === "w") { UI.dlgMoveSel(-1); e.preventDefault(); return; }
          if (k === "ArrowDown" || k === "s") { UI.dlgMoveSel(1); e.preventDefault(); return; }
          if (k === "e" || k === "Enter" || k === " ") { UI.dlgActivateSel(); e.preventDefault(); return; }
          if (["1", "2", "3", "4"].includes(k)) { UI.dlgPickNumber(parseInt(k, 10)); e.preventDefault(); return; }
          return;
        }
        if (k === "e" || k === "Enter" || k === " ") { UI.advanceDialogue(); e.preventDefault(); }
        return;
      }
      if (k === "t") { UI.toggleTerminal(); e.preventDefault(); return; }
      if (k === "j") {
        if ($("overlay-quest").classList.contains("hidden")) UI.openQuestLog();
        else UI.closeOverlays();
        e.preventDefault();
        return;
      }
      if (!UI.blocking() && (k === "e" || k === "Enter" || k === " ")) { UI.interact(); e.preventDefault(); }
    });
    window.addEventListener("keyup", e => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keys[k] = false;
    });
    window.addEventListener("blur", () => clearKeys());

    $("term-input").addEventListener("keydown", e => {
      if (e.key === "Enter") {
        UI.termSubmit((e.target as HTMLInputElement).value);
        (e.target as HTMLInputElement).value = "";
      }
    });
  }

  function boot() {
    // Dev-Sicherheitsnetz: Inhalts-Schema beim Start prüfen und Querverweis-Fehler
    // (unbekannte NPCs/Drills/Quests/reviewIds …) sofort in der Konsole melden.
    // Nur im Dev-Server aktiv – `import.meta.env.DEV` ist im Prod-Build `false`,
    // der ganze Block fällt beim Bauen weg (kein Gameplay-Einfluss, #81).
    if (import.meta.env.DEV) {
      Promise.all([import("./content/validate"), import("./content")]).then(([{ validateContent }, { KQContent }]) => {
        const probleme = validateContent(KQContent);
        if (probleme.length) console.error("⚠️ KubeQuest-Inhalte inkonsistent (#81):\n" + probleme.join("\n"));
      });
    }
    Game.load();
    wireKeyboard();
    UI.bindEvents();

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: "game-container",
      backgroundColor: "#356dab",
      pixelArt: true,
      scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
      scene: [KQScenes.BootScene, KQScenes.WorldScene, KQScenes.InteriorScene, KQScenes.ArchipelScene],
    });

    // Dev-Affordance: die laufende Phaser-Instanz fürs manuelle Verifizieren im
    // Browser greifbar machen (Szenen-Wechsel/Teleport testen). Im Prod-Build fällt
    // der ganze Block weg (import.meta.env.DEV === false), kein Gameplay-Einfluss.
    if (import.meta.env.DEV) (window as unknown as { kqGame: Phaser.Game }).kqGame = game;

    UI.refreshHud();
    if (Game.state.character === null) {
      // Erster Start: fester Charakter, kein Auswahl-Dialog mehr (#45).
      Game.state.character = FIXED_CHARACTER;
      Game.save();
      setTimeout(() => UI.toast("⚓ Willkommen in Port Kubernia! Folge dem <b>!</b> – Ole wartet vor der Hafenmeisterei."), 600);
    }
    if (Game.offlineEarnings > 0) {
      setTimeout(() => UI.toast("🌙 Während du weg warst, hat dein Hafen <b>+" + Game.offlineEarnings + " 🪙</b> verdient!"), 1200);
    }
    // Einmaliger Erklär-Toast: was die 🔥-Flamme im HUD bedeutet (auch ohne Maus sichtbar).
    if (!Game.state.streakHintShown) {
      setTimeout(() => UI.toast("🔥 <b>Tages-Streak:</b> Spiele täglich für bis zu <b>+50 % Dublonen</b> auf deine Belohnungen!"), 2600);
      Game.state.streakHintShown = true;
      Game.save();
    }

    // Spielstand regelmäßig sichern
    setInterval(() => Game.save(), 5000);

    // Boot-Markierung fürs Sicherheitsnetz in index.html (früher: window.Game)
    document.body.dataset.kqBooted = "1";
  }

  document.addEventListener("DOMContentLoaded", boot);
