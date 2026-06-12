/* ===== KubeQuest 2.0 – Start =====
 * Lädt Grafiken, stellt den Spielstand her und verdrahtet Eingabe + Spielschleife.
 */

(function () {
  "use strict";

  const $ = id => document.getElementById(id);

  function showCharSelect() {
    const box = $("cs-chars");
    box.innerHTML = "";
    for (const spriteIdx of KQContent.PLAYER_SPRITES) {
      const cv = document.createElement("canvas");
      cv.width = 16; cv.height = 16;
      Engine.drawPortrait(cv, "dungeon", spriteIdx);
      cv.onclick = () => {
        Game.state.character = spriteIdx;
        Game.save();
        $("charselect").classList.add("hidden");
        UI.toast("⚓ Willkommen in Port Kubernia! Folge dem <b>!</b> – Ole wartet vor der Hafenmeisterei.");
      };
      box.appendChild(cv);
    }
    $("charselect").classList.remove("hidden");
  }

  async function boot() {
    Engine.init();
    try {
      await Engine.loadImages({ town: "assets/town.png", dungeon: "assets/dungeon.png" });
    } catch (e) {
      document.body.innerHTML = "<p style='padding:2em'>Grafiken nicht gefunden. Bitte das Spiel über den Ordner mit dem assets-Verzeichnis starten.</p>";
      return;
    }

    Game.load();
    World.build();

    // Position wiederherstellen oder am Schiff spawnen
    if (Game.state.player && Game.state.player.x) {
      World.player.x = Game.state.player.x;
      World.player.y = Game.state.player.y;
    } else {
      World.player.x = World.player.spawnX;
      World.player.y = World.player.spawnY;
    }

    UI.refreshHud();
    if (Game.state.character === null) showCharSelect();

    // ---- Tastatur ----
    Engine.onKey = k => {
      if (!$("charselect").classList.contains("hidden")) return false;
      if (k === "Escape") {
        UI.closeOverlays();
        return true;
      }
      if (UI.dialogue) {
        if (k === "e" || k === "Enter" || k === " ") { UI.advanceDialogue(); return true; }
        return false;
      }
      const overlayOpen = UI.blocking();
      if (k === "t") { UI.toggleTerminal(); return true; }
      if (k === "j") {
        if ($("overlay-quest").classList.contains("hidden")) UI.openQuestLog();
        else UI.closeOverlays();
        return true;
      }
      if (!overlayOpen && (k === "e" || k === "Enter" || k === " ")) { UI.interact(); return true; }
      return false;
    };

    // Terminal-Eingabe
    $("term-input").addEventListener("keydown", e => {
      if (e.key === "Enter") {
        UI.termSubmit(e.target.value);
        e.target.value = "";
      }
    });

    // ---- Spielschleife ----
    let saveTimer = 0;
    Engine.onUpdate = dt => {
      World.update(dt, UI.blocking());
      UI.updatePrompt();
      saveTimer += dt;
      if (saveTimer > 4) { saveTimer = 0; Game.save(); }
    };
    Engine.onRender = ctx => World.render(ctx);
    Engine.start();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
