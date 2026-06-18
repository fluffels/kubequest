/* Konsistenz-Tests für die Spielinhalte (Quests, Quiz, Drills, Karten).
 * Ausführen mit:  node --test test/
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { KQContent } from "../src/content";
import { validateContent, type ContentBundle } from "../src/content/validate";
import { KQAssets } from "../src/assets-data";
import { ARCHIPEL_NPC } from "../src/archipel";
import { Sim as KQSim } from "../src/sim";

/** Findet Befehls-Karten ohne nicht-leere Begründung (`explain`, #233) – sonst
 *  bliebe das Spaced-Repetition-Feedback bei „nur falsch ohne Warum". Als Helfer,
 *  um denselben Check Red-Green abzusichern. */
function cardsMissingExplain(cards: { id: string; explain?: string }[]): string[] {
  return cards.filter(c => !c.explain || !c.explain.trim()).map(c => c.id);
}

/** Findet Drills, deren generierte Aufgabe keine nicht-leere Begründung (`why`, #233)
 *  trägt. Jeder Drill wird gegen einen frischen Sim instanziiert (wie im Spiel). */
function drillsMissingWhy(drills: typeof KQContent.DRILLS): string[] {
  const out: string[] = [];
  for (const [id, make] of Object.entries(drills)) {
    const task = make(new KQSim({}));
    if (!task.why || !task.why.trim()) out.push(id);
  }
  return out;
}

/** Findet NPCs ohne Sprite-Asset (tex fehlt im Manifest) – das macht einen NPC
 *  „tot": Phaser fiele auf den grün-schwarzen Platzhalter zurück. Smalltalk ist
 *  bewusst NICHT universell Pflicht (z.B. Kralle führt direkt ins Quiz, ohne
 *  Smalltalk-Pfad). Als Helfer, um denselben Check Red-Green abzusichern. */
function npcSpriteProblems(npcs: Record<string, { tex?: string }>, assets: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [id, npc] of Object.entries(npcs)) {
    if (!npc.tex || !assets[npc.tex]) out.push(`${id}: Sprite-Asset fehlt (tex=${npc.tex})`);
  }
  return out;
}

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

test("Befehls-Karten: jede trägt eine nicht-leere Begründung (explain, #233)", () => {
  const fehlend = cardsMissingExplain(KQContent.CMD_CARDS);
  assert.deepEqual(fehlend, [], "CMD-Karten ohne explain: " + fehlend.join(", "));
});

test("Red-Green: eine Befehls-Karte ohne explain wird gemeldet", () => {
  // Ein Check, der auch bei fehlender Begründung grün bliebe, wäre wertlos (#233).
  const fehlend = cardsMissingExplain([...KQContent.CMD_CARDS, { id: "c-leer", explain: "  " }]);
  assert.ok(fehlend.includes("c-leer"), "leere Begründung nicht gemeldet: " + fehlend.join(", "));
});

test("Drills: jede generierte Aufgabe trägt eine nicht-leere Begründung (why, #233)", () => {
  const fehlend = drillsMissingWhy(KQContent.DRILLS);
  assert.deepEqual(fehlend, [], "Drills ohne why: " + fehlend.join(", "));
});

test("Red-Green: ein Drill ohne why wird gemeldet", () => {
  const kaputt = { ...KQContent.DRILLS, "drill-leer": (_sim: KQSim) => ({ text: "x", accept: [/^x$/], solution: "x", hint: "x", why: "" }) };
  const fehlend = drillsMissingWhy(kaputt as typeof KQContent.DRILLS);
  assert.ok(fehlend.includes("drill-leer"), "Drill ohne why nicht gemeldet: " + fehlend.join(", "));
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

test("jeder NPC hat ein Sprite-Asset (tex im Manifest)", () => {
  const problems = npcSpriteProblems(KQContent.NPCS, KQAssets);
  assert.deepEqual(problems, [], "NPCs ohne Sprite-Asset:\n" + problems.join("\n"));
});

test("der GitOps-Insel-NPC (#93) ist in der Registry verdrahtet, mit Sprite + Smalltalk", () => {
  // archipel.ts reserviert den Standplatz mit fester id – die MUSS einem NPC der
  // Registry entsprechen, sonst rendert die Insel eine Figur ohne Daten.
  const npc = (KQContent.NPCS as Record<string, { tex?: string }>)[ARCHIPEL_NPC.id];
  assert.ok(npc, "Insel-NPC-Id '" + ARCHIPEL_NPC.id + "' fehlt in NPCS");
  assert.ok(npc.tex && KQAssets[npc.tex], "Insel-NPC ohne Sprite-Asset");
  // Bis #94 die erste Quest einhängt, ist Smalltalk das, was Argo zu sagen hat.
  const lines = (KQContent.SMALLTALK as Record<string, string[]>)[ARCHIPEL_NPC.id];
  assert.ok(Array.isArray(lines) && lines.length > 0, "Insel-NPC ohne Smalltalk");
});

test("Red-Green: ein NPC mit fehlendem Sprite-Asset wird gemeldet", () => {
  // Ein Check, der auch bei fehlendem Sprite grün bliebe, wäre wertlos.
  const npcs = { ...KQContent.NPCS, geist: { name: "Geist", title: "?", sprite: 0, tex: "char_gibtsnicht" } };
  const problems = npcSpriteProblems(npcs as Record<string, { tex?: string }>, KQAssets);
  assert.ok(problems.some(p => p.includes("geist") && p.includes("Sprite-Asset")), "fehlendes Sprite-Asset nicht gemeldet:\n" + problems.join("\n"));
});

test("Ränge: aufsteigende XP-Schwellen", () => {
  for (let i = 1; i < KQContent.RANKS.length; i++) {
    assert.ok(KQContent.RANKS[i].xp > KQContent.RANKS[i - 1].xp);
  }
});

/* ===== Zentrale Schema-Validierung (#81) =====
 * Der Validator (src/content/validate.ts) prüft das ganze Inhalts-Bündel auf
 * strukturelle & referenzielle Konsistenz. Hier wird er einmal gegen die echten
 * Inhalte gefahren (muss sauber sein) und mit absichtlich kaputten Referenzen
 * Red-Green abgesichert: ein Validator, der auch bei kaputtem Inhalt grün bleibt,
 * wäre wertlos. */

test("Schema-Validierung: die echten Inhalte sind konsistent (keine Fehler)", () => {
  const errors = validateContent(KQContent);
  assert.deepEqual(errors, [], "validateContent meldet Probleme:\n" + errors.join("\n"));
});

test("Red-Green: kaputte Quest-Referenz (unbekannter Questgeber) macht den Check rot", () => {
  // Akzeptanzkriterium #81: eine absichtlich kaputte Quest-Referenz MUSS gemeldet werden.
  const kaputt: ContentBundle = {
    ...KQContent,
    QUESTS: [
      ...KQContent.QUESTS,
      { id: "q-bad", title: "Geister-Quest", giver: "niemand", rewardXp: 1, rewardCoins: 1, steps: [] },
    ],
  };
  const errors = validateContent(kaputt);
  assert.ok(errors.some(e => e.includes("q-bad") && e.includes("niemand")), "kaputter Questgeber wurde NICHT gemeldet – Validator ohne Zähne:\n" + errors.join("\n"));
});

test("Red-Green: unbekannter Drill in einem Übungs-Pool macht den Check rot", () => {
  const kaputt: ContentBundle = {
    ...KQContent,
    PRACTICE: { ...KQContent.PRACTICE, ole: [{ drill: "gibt-es-nicht", after: "q4" }] },
  };
  const errors = validateContent(kaputt);
  assert.ok(errors.some(e => e.includes("gibt-es-nicht")), "unbekannter Drill wurde NICHT gemeldet:\n" + errors.join("\n"));
});

test("Red-Green: CMD-Karte mit unbekanntem chapter und nicht matchender Lösung wird gemeldet", () => {
  const kaputt: ContentBundle = {
    ...KQContent,
    CMD_CARDS: [
      ...KQContent.CMD_CARDS,
      { id: "c-bad", chapter: "q-existiert-nicht", q: "?", accept: [/^kubectl get pods$/], solution: "ganz was anderes" },
    ],
  };
  const errors = validateContent(kaputt);
  assert.ok(errors.some(e => e.includes("c-bad") && e.includes("q-existiert-nicht")), "unbekanntes chapter nicht gemeldet:\n" + errors.join("\n"));
  assert.ok(errors.some(e => e.includes("c-bad") && e.includes("accept")), "nicht matchende Musterlösung nicht gemeldet:\n" + errors.join("\n"));
});
