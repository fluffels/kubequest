/* ===== KubeQuest 3.0 – Start =====
 * Spielstand laden, Phaser starten, Tastatur & Charakterwahl verdrahten.
 */
import Phaser from "phaser";
import { Game } from "./game";
import { UI } from "./ui";
import { KQContent } from "./content";
import { KQScenes } from "./scenes";
import { SFX } from "./sfx";

  const $ = id => document.getElementById(id);

  // Tasten-Zustand für die Szene (window-Listener statt Phaser-Keyboard,
  // damit Eingabefelder in Overlays normal funktionieren)
  window.KQKeys = {};

  function showCharSelect() {
    const box = $("cs-chars");
    box.innerHTML = "";
    for (const spriteIdx of KQContent.PLAYER_SPRITES) {
      const cv = document.createElement("canvas");
      cv.width = 16; cv.height = 16;
      UI.drawPortrait(cv, spriteIdx);
      cv.onclick = () => {
        Game.state.character = spriteIdx;
        Game.save();
        if (window.WorldScene && window.WorldScene.playerSprite) {
          window.WorldScene.playerSprite.setTexture("dungeon", spriteIdx);
        }
        $("charselect").classList.add("hidden");
        UI.toast("⚓ Willkommen in Port Kubernia! Folge dem <b>!</b> – Ole wartet vor der Hafenmeisterei.");
      };
      box.appendChild(cv);
    }
    $("charselect").classList.remove("hidden");
  }

  function wireKeyboard() {
    window.addEventListener("keydown", e => {
      if (window.SFX) SFX.ensure();
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        if (e.key === "Escape") { UI.closeOverlays(); (e.target as HTMLElement).blur(); }
        return;
      }
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      window.KQKeys[k] = true;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();

      if (!$("charselect").classList.contains("hidden")) return;
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
      window.KQKeys[k] = false;
    });
    window.addEventListener("blur", () => { window.KQKeys = {}; });

    $("term-input").addEventListener("keydown", e => {
      if (e.key === "Enter") {
        UI.termSubmit((e.target as HTMLInputElement).value);
        (e.target as HTMLInputElement).value = "";
      }
    });
  }

  function boot() {
    Game.load();
    wireKeyboard();

    new Phaser.Game({
      type: Phaser.AUTO,
      parent: "game-container",
      backgroundColor: "#356dab",
      pixelArt: true,
      scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
      scene: [KQScenes.BootScene, KQScenes.WorldScene],
    });

    UI.refreshHud();
    if (Game.state.character === null) {
      // kleinen Moment warten, bis die Spritesheet-Images für die Porträts da sind
      setTimeout(showCharSelect, 150);
    }
    if (Game.offlineEarnings > 0) {
      setTimeout(() => UI.toast("🌙 Während du weg warst, hat dein Hafen <b>+" + Game.offlineEarnings + " 🪙</b> verdient!"), 1200);
    }

    // Spielstand regelmäßig sichern
    setInterval(() => Game.save(), 5000);
  }

  document.addEventListener("DOMContentLoaded", boot);
