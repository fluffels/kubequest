/* ===== KubeQuest 3.0 – Start =====
 * Spielstand laden, Phaser starten, Tastatur & Charakterwahl verdrahten.
 */

(function () {
  "use strict";

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
        if (window.WorldScene && WorldScene.playerSprite) {
          WorldScene.playerSprite.setTexture("dungeon", spriteIdx);
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
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        if (e.key === "Escape") { UI.closeOverlays(); e.target.blur(); }
        return;
      }
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      window.KQKeys[k] = true;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();

      if (!$("charselect").classList.contains("hidden")) return;
      if (k === "Escape") { UI.closeOverlays(); return; }
      if (UI.dialogue) {
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
        UI.termSubmit(e.target.value);
        e.target.value = "";
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
})();
