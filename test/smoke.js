/* Smoke-Test für KubeQuest: spielt jede Terminal-Aufgabe mit der Musterlösung durch
 * und prüft die Quizdaten auf Konsistenz.
 * Ausführen mit:  node test/smoke.js
 */

global.window = {};
require("../js/sim.js");
require("../js/data.js");
const KQSim = window.KQSim;
const KQData = window.KQData;

let failures = 0;
const fail = (msg, detail) => {
  failures++;
  console.error("FAIL:", msg, detail || "");
};

/* ---------- Terminal-Missionen: Musterlösung muss jede Aufgabe lösen ---------- */
for (const ch of KQData.CHAPTERS) {
  for (const step of ch.steps) {
    if (step.type !== "terminal") continue;
    const sim = new KQSim(step.scenario || {});
    for (const task of step.tasks) {
      let cmd = task.solution;
      if (cmd.includes("<")) {
        // Platzhalter durch echten Pod-Namen aus dem Simulator ersetzen
        const dep = sim.deployments[0];
        const pod = dep && dep.pods[0] ? dep.pods[0].name : "unbekannt";
        cmd = cmd.replace(/<[^>]+>/, pod).replace(/^(kubectl\s+\w+\s+pod\s+).*/, "$1" + pod);
      }
      const norm = cmd.trim().replace(/\s+/g, " ");
      const result = sim.exec(cmd);
      const cmdOk = task.accept.some(re => re.test(norm));
      const checkOk = !task.check || task.check(sim);
      if (!cmdOk) fail(ch.id + "/" + task.id + ": Lösung matcht accept-Regex nicht", JSON.stringify(norm));
      if (result.error) fail(ch.id + "/" + task.id + ": Simulator meldet Fehler", JSON.stringify(result.output));
      if (!checkOk) fail(ch.id + "/" + task.id + ": check()-Bedingung nicht erfüllt");
    }
  }
}

/* ---------- Befehls-Karten: Lösung muss Regex matchen ---------- */
for (const card of KQData.CMD_CARDS) {
  const norm = card.solution.trim().replace(/\s+/g, " ");
  if (!card.accept.some(re => re.test(norm))) {
    fail("Karte " + card.id + ": Lösung matcht accept-Regex nicht", norm);
  }
}

/* ---------- Quizdaten: IDs eindeutig, correct-Index gültig ---------- */
const seen = new Set();
for (const ch of KQData.CHAPTERS) {
  for (const step of ch.steps) {
    if (step.type === "quiz") {
      for (const q of step.items) {
        if (seen.has(q.id)) fail("Doppelte Quiz-ID: " + q.id);
        seen.add(q.id);
        if (!(q.correct >= 0 && q.correct < q.options.length)) fail("Ungültiger correct-Index: " + q.id);
        if (!q.explain) fail("Erklärung fehlt: " + q.id);
      }
    }
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
  console.log("✅ Smoke-Test bestanden: alle Terminal-Aufgaben lösbar, alle Daten konsistent.");
} else {
  console.error("❌ " + failures + " Problem(e) gefunden.");
  process.exit(1);
}
