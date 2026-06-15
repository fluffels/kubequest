/* Konsistenz-Tests für die Spielinhalte (Quests, Quiz, Drills, Karten).
 * Ausführen mit:  node --test test/
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { KQContent } from "../src/content";

test("Quiz-Karten: IDs eindeutig, correct-Index gültig, Erklärung vorhanden", () => {
  const seen = new Set();
  for (const q of KQContent.CRAB_QUIZ) {
    assert.ok(!seen.has(q.id), "doppelte ID: " + q.id);
    seen.add(q.id);
    assert.ok(q.correct >= 0 && q.correct < q.options.length, "correct-Index kaputt: " + q.id);
    assert.ok(q.explain, "Erklärung fehlt: " + q.id);
  }
});

test("Befehls-Karten: Lösung matcht die eigene accept-Regex", () => {
  for (const card of KQContent.CMD_CARDS) {
    const norm = card.solution.trim().replace(/\s+/g, " ");
    assert.ok(card.accept.some(re => re.test(norm)), card.id + ": " + norm);
    assert.ok(KQContent.QUESTS.some(q => q.id === card.chapter), card.id + ": unbekannte Quest " + card.chapter);
  }
});

test("Quests: NPCs existieren, Choices haben genau richtige Antworten, reviewIds gültig", () => {
  for (const quest of KQContent.QUESTS) {
    assert.ok(KQContent.NPCS[quest.giver as keyof typeof KQContent.NPCS], quest.id + ": unbekannter Questgeber");
    for (const step of quest.steps) {
      if (step.type === "dialog" || step.type === "choice") {
        assert.ok(KQContent.NPCS[step.npc as keyof typeof KQContent.NPCS], quest.id + ": unbekannter NPC " + step.npc);
      }
      if (step.type === "choice") {
        assert.equal(step.options.filter((o: any) => o.ok).length, 1, quest.id + ": Choice braucht genau eine richtige Antwort");
        if (step.reviewId) {
          assert.ok(KQContent.CRAB_QUIZ.some(q => q.id === step.reviewId), quest.id + ": unbekannte reviewId " + step.reviewId);
        }
      }
      if (step.type === "teach") {
        assert.ok(step.cmd.hint && step.cmd.solution && step.cmd.intro, quest.id + ": teach-Schritt unvollständig");
      }
      if (step.type === "drill") {
        for (const d of step.pool) assert.ok(KQContent.DRILLS[d], quest.id + ": unbekannter Drill " + d);
      }
    }
  }
});

test("Übungs-Pools: verweisen auf existierende Drills und Quests", () => {
  for (const [npcId, pool] of Object.entries(KQContent.PRACTICE)) {
    assert.ok(KQContent.NPCS[npcId as keyof typeof KQContent.NPCS], "unbekannter NPC: " + npcId);
    for (const p of pool) {
      assert.ok(KQContent.DRILLS[p.drill], npcId + ": unbekannter Drill " + p.drill);
      assert.ok(KQContent.QUESTS.some(q => q.id === p.after), npcId + ": unbekannte Quest " + p.after);
    }
  }
});

test("Teach-Schritte mit Pflicht-Flag zeigen es im Panel (intro+text), nicht nur im hint (#29)", () => {
  // Befehle, deren Pflicht-Flag man nicht erraten kann, müssen es dauerhaft sichtbar
  // im Aufgaben-Panel führen (intro oder text) – der hint ist erst auf Anforderung sichtbar.
  const muss: Record<string, string> = {
    "t-create": "--image",   // kubectl create deployment <name> --image=<image>
    "t-scale": "--replicas", // kubectl scale deployment <name> --replicas=<zahl>
  };
  const gefunden = new Set<string>();
  for (const quest of KQContent.QUESTS) {
    for (const step of quest.steps) {
      if (step.type !== "teach") continue;
      const flag = muss[step.cmd.id];
      if (!flag) continue;
      gefunden.add(step.cmd.id);
      const panel = step.cmd.intro + " " + step.cmd.text;
      assert.ok(panel.includes(flag), step.cmd.id + ": " + flag + " fehlt im Panel (intro+text)");
    }
  }
  for (const id of Object.keys(muss)) {
    assert.ok(gefunden.has(id), "Teach-Schritt nicht gefunden: " + id);
  }
});

test("Stapel-Spiel hat mindestens 2 Runden mit je 3+ Schichten", () => {
  assert.ok(KQContent.STACK_ROUNDS.length >= 2);
  for (const r of KQContent.STACK_ROUNDS) assert.ok(r.layers.length >= 3, r.name);
});

test("Ränge: aufsteigende XP-Schwellen", () => {
  for (let i = 1; i < KQContent.RANKS.length; i++) {
    assert.ok(KQContent.RANKS[i].xp > KQContent.RANKS[i - 1].xp);
  }
});
