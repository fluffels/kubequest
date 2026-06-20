import { Game } from "../game";
import { KQContent } from "../content";
import { SFX } from "../sfx";
import { part, $, NPCS, shuffled } from "./shared";

export const dialogUI = part({
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

});
