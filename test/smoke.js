/* Smoke-Test für KubeQuest 3.0:
 * - spielt alle Quest-Schritte (teach/drill/terminal) in Story-Reihenfolge
 *   gegen EINE dauerhafte Welt-Simulation durch
 * - prüft alle Drill-Generatoren mehrfach (Zufallsaufgaben!)
 * - prüft Quiz-/Karten-/Übungs-Daten auf Konsistenz
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

function resolvePlaceholder(cmd, sim) {
  if (!cmd.includes("<")) return cmd;
  if (/describe/.test(cmd)) {
    const dep = sim.deployments.find(d => d.name === "kantine") || sim.deployments[0];
    return cmd.replace(/<[^>]+>/, dep.pods[0].name);
  }
  if (/delete pod/.test(cmd)) {
    const dep = sim.deployments.find(d => d.name === "kasse") || sim.deployments[0];
    return cmd.replace(/<[^>]+>/, dep.pods[0].name);
  }
  if (/docker stop/.test(cmd)) {
    const c = sim.docker.containers.find(c => c.running);
    return cmd.replace(/<[^>]+>/, c ? c.name : "fehlt");
  }
  return cmd;
}

function runTask(sim, task, label) {
  const cmd = resolvePlaceholder(task.solution, sim);
  const norm = cmd.trim().replace(/\s+/g, " ");
  const result = sim.exec(cmd);
  const cmdOk = task.accept.some(re => re.test(norm));
  const checkOk = !task.check || task.check(sim);
  if (!cmdOk) fail(label + ": Lösung matcht accept-Regex nicht", JSON.stringify(norm));
  if (result.error) fail(label + ": Simulator meldet Fehler", JSON.stringify(result.output));
  if (!checkOk) fail(label + ": check()-Bedingung nicht erfüllt");
}

/* ---------- Quests in Story-Reihenfolge ---------- */
const sim = new KQSim({});
for (const quest of KQContent.QUESTS) {
  for (const step of quest.steps) {
    if (step.scenario) sim.mergeScenario(step.scenario);
    if (step.type === "teach") {
      runTask(sim, step.cmd, quest.id + "/" + step.cmd.id);
    } else if (step.type === "terminal") {
      for (const task of step.tasks) runTask(sim, task, quest.id + "/" + task.id);
    } else if (step.type === "drill") {
      for (let i = 0; i < step.count; i++) {
        const drillId = step.pool[i % step.pool.length];
        const gen = KQContent.DRILLS[drillId];
        if (!gen) { fail(quest.id + ": unbekannter Drill " + drillId); continue; }
        runTask(sim, gen(sim), quest.id + "/drill:" + drillId);
      }
    }
  }
}

/* ---------- Alle Drill-Generatoren je 4x (Zufalls-Parameter!) ---------- */
for (const [id, gen] of Object.entries(KQContent.DRILLS)) {
  for (let i = 0; i < 4; i++) {
    const task = gen(sim);
    if (!task.text || !task.hint || !task.solution) fail("Drill " + id + ": Felder fehlen");
    runTask(sim, task, "DRILL " + id + " #" + i);
  }
}

/* ---------- Snapshot/Restore ---------- */
try {
  const restored = new KQSim(JSON.parse(JSON.stringify(sim.snapshot())));
  const r = restored.exec("kubectl get pods");
  if (r.error) fail("Restore: kubectl get pods schlägt fehl", r.output);
  const r2 = restored.exec("kubectl get secrets");
  if (r2.error) fail("Restore: kubectl get secrets schlägt fehl", r2.output);
} catch (e) {
  fail("Snapshot/Restore wirft Fehler", e.message);
}

/* ---------- Befehls-Karten ---------- */
for (const card of KQContent.CMD_CARDS) {
  const norm = card.solution.trim().replace(/\s+/g, " ");
  if (!card.accept.some(re => re.test(norm))) fail("Karte " + card.id + ": Lösung matcht Regex nicht", norm);
  if (!KQContent.QUESTS.some(q => q.id === card.chapter)) fail("Karte " + card.id + ": unbekannte Quest " + card.chapter);
}

/* ---------- Quiz, Choices, Übungs-Pools, Minispiel ---------- */
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
  }
}
for (const [npcId, pool] of Object.entries(KQContent.PRACTICE)) {
  if (!KQContent.NPCS[npcId]) fail("Übungs-Pool für unbekannten NPC: " + npcId);
  for (const p of pool) {
    if (!KQContent.DRILLS[p.drill]) fail("Übungs-Pool " + npcId + ": unbekannter Drill " + p.drill);
    if (!KQContent.QUESTS.some(q => q.id === p.after)) fail("Übungs-Pool " + npcId + ": unbekannte Quest " + p.after);
  }
}
if (KQContent.STACK_ROUNDS.length < 2) fail("Zu wenige Stapel-Spiel-Runden");

if (failures === 0) {
  console.log("✅ Smoke-Test bestanden: alle Quests & Drills lösbar, Welt speicherbar, Daten konsistent.");
} else {
  console.error("❌ " + failures + " Problem(e) gefunden.");
  process.exit(1);
}
