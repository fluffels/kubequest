/* Smoke-Test für KubeQuest 2.0:
 * Spielt alle Quest-Terminal-Aufgaben in Story-Reihenfolge gegen EINE
 * dauerhafte Welt-Simulation durch (wie im echten Spiel) und prüft die
 * Quiz-/Kartendaten auf Konsistenz.
 * Ausführen mit:  node test/smoke.js
 */

global.window = {};
require("../js/sim.js");
require("../js/content.js");
const KQSim = window.KQSim;
const KQContent = window.KQContent;

let failures = 0;
const fail = (msg, detail) => {
  failures++;
  console.error("FAIL:", msg, detail || "");
};

/* ---------- Quests: Musterlösung muss jede Terminal-Aufgabe lösen ---------- */
const sim = new KQSim({}); // EINE Welt über alle Quests hinweg, wie im Spiel
for (const quest of KQContent.QUESTS) {
  for (const step of quest.steps) {
    if (step.type !== "terminal") continue;
    if (step.scenario) sim.mergeScenario(step.scenario);
    for (const task of step.tasks) {
      let cmd = task.solution;
      if (cmd.includes("<")) {
        // Platzhalter durch echten Pod-Namen ersetzen (kantine bzw. kasse)
        const depName = /kasse/.test(cmd) ? "kasse" : "kantine";
        const dep = sim.deployments.find(d => d.name === depName) || sim.deployments[0];
        const pod = dep && dep.pods[0] ? dep.pods[0].name : "unbekannt";
        cmd = cmd.replace(/<[^>]+>/, pod);
      }
      const norm = cmd.trim().replace(/\s+/g, " ");
      const result = sim.exec(cmd);
      const cmdOk = task.accept.some(re => re.test(norm));
      const checkOk = !task.check || task.check(sim);
      if (!cmdOk) fail(quest.id + "/" + task.id + ": Lösung matcht accept-Regex nicht", JSON.stringify(norm));
      if (result.error) fail(quest.id + "/" + task.id + ": Simulator meldet Fehler", JSON.stringify(result.output));
      if (!checkOk) fail(quest.id + "/" + task.id + ": check()-Bedingung nicht erfüllt");
    }
  }
}

/* ---------- Snapshot/Restore: Welt muss speicherbar sein ---------- */
const snap = sim.snapshot();
try {
  const restored = new KQSim(JSON.parse(JSON.stringify(snap)));
  const r = restored.exec("kubectl get pods");
  if (r.error) fail("Restore: kubectl get pods schlägt fehl", r.output);
} catch (e) {
  fail("Snapshot/Restore wirft Fehler", e.message);
}

/* ---------- Befehls-Karten ---------- */
for (const card of KQContent.CMD_CARDS) {
  const norm = card.solution.trim().replace(/\s+/g, " ");
  if (!card.accept.some(re => re.test(norm))) fail("Karte " + card.id + ": Lösung matcht Regex nicht", norm);
}

/* ---------- Quiz & Choices: IDs, Indizes, Verweise ---------- */
const seen = new Set();
for (const q of KQContent.CRAB_QUIZ) {
  if (seen.has(q.id)) fail("Doppelte Quiz-ID: " + q.id);
  seen.add(q.id);
  if (!(q.correct >= 0 && q.correct < q.options.length)) fail("Ungültiger correct-Index: " + q.id);
  if (!q.explain) fail("Erklärung fehlt: " + q.id);
}
for (const quest of KQContent.QUESTS) {
  for (const step of quest.steps) {
    if (step.type === "choice") {
      if (!step.options.some(o => o.ok)) fail("Choice ohne richtige Antwort in " + quest.id);
      if (step.reviewId && !KQContent.CRAB_QUIZ.some(q => q.id === step.reviewId)) {
        fail("Choice verweist auf unbekannte Quiz-ID: " + step.reviewId);
      }
      if (!KQContent.NPCS[step.npc]) fail("Choice mit unbekanntem NPC in " + quest.id);
    }
    if (step.type === "dialog" && !KQContent.NPCS[step.npc]) fail("Dialog mit unbekanntem NPC in " + quest.id);
    if (step.type === "terminal") {
      for (const t of step.tasks) {
        if (seen.has(t.id)) fail("Doppelte Task-ID: " + t.id);
        seen.add(t.id);
        if (!t.hint || !t.solution) fail("Hinweis/Lösung fehlt: " + t.id);
      }
    }
  }
}

if (failures === 0) {
  console.log("✅ Smoke-Test bestanden: alle Quests lösbar, Welt speicherbar, Daten konsistent.");
} else {
  console.error("❌ " + failures + " Problem(e) gefunden.");
  process.exit(1);
}
