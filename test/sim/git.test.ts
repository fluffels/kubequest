/* Unit-Tests: git-Befehlsfamilie (sim/git.ts) – Teil des sim.test.ts-Splits (#383).
 * fetch/pull, push-Ablehnung und der Merge-Konflikt-Bogen (#69). Fahren über
 * sim.exec("…"); gemeinsame Fixtures in ./helpers. */
import { test, beforeEach } from "vitest";
import assert from "node:assert/strict";
import { KQSim, freshSim } from "./helpers";

let sim: KQSim;
beforeEach(() => { sim = freshSim(); });

/* ===================== git: fetch / pull (#69) ===================== */

test("git fetch: lädt nur herunter, pull holt die Commits wirklich rein", () => {
  sim.exec("git init");
  sim.mergeScenario({ gitRemoteAhead: 2 });
  const before = sim.git.commits.length;
  const fetch = sim.exec("git fetch");
  assert.ok(!fetch.error, "fetch ist kein Fehler");
  assert.match(fetch.output!, /2 Commit/, "fetch nennt die Anzahl voraus");
  assert.equal(sim.git.fetched, true, "fetch markiert geholt");
  assert.equal(sim.git.remoteAhead, 2, "fetch fügt NICHTS ein – remoteAhead bleibt 2");
  assert.equal(sim.git.commits.length, before, "fetch erzeugt keine lokalen Commits");

  const pull = sim.exec("git pull");
  assert.ok(!pull.error, "pull ist kein Fehler");
  assert.equal(sim.git.remoteAhead, 0, "pull holt alles -> nichts mehr voraus");
  assert.equal(sim.git.commits.length, before + 2, "pull fügt die 2 Team-Commits ein");
});

test("git fetch/pull ohne Neuigkeiten meldet 'aktuell' und tut nichts", () => {
  sim.exec("git init");
  assert.match(sim.exec("git fetch").output!, /aktuell|Neues/i);
  assert.match(sim.exec("git pull").output!, /neuesten Stand|aktuell/i);
});

test("git push: wird abgelehnt, solange origin voraus ist (erst pull)", () => {
  sim.exec("git init");
  sim.files["a.md"] = "x"; sim.exec("git add a.md"); sim.exec('git commit -m "a"');
  sim.mergeScenario({ gitRemoteAhead: 1 });
  const push = sim.exec("git push");
  assert.ok(push.error, "Push gegen veralteten Stand muss abgelehnt werden");
  assert.match(push.output!, /pull/i, "Hinweis: erst pullen");
  sim.exec("git pull");
  assert.ok(!sim.exec("git push").error, "nach pull klappt der push");
});

/* ===================== git: Merge-Konflikt (#69) ===================== */

function armConflict(s: KQSim) {
  s.exec("git init");
  s.files["seekarte.md"] = "deine Zeile"; s.exec("git add seekarte.md"); s.exec('git commit -m "start"');
  s.mergeScenario({ gitConflict: { branch: "kollege", file: "seekarte.md", ours: "deine Zeile", theirs: "fremde Zeile" } });
}

test("git merge: gleiche Datei beidseitig geändert -> CONFLICT mit Markern", () => {
  armConflict(sim);
  const merge = sim.exec("git merge kollege");
  assert.ok(!merge.error, "der Konflikt-Merge ist kein Simulator-Fehler, sondern eine Rückfrage");
  assert.match(merge.output!, /CONFLICT/, "meldet CONFLICT");
  assert.ok(sim.git.conflict, "Konflikt ist jetzt aktiv");
  // Datei trägt die Konfliktmarker und beide Versionen
  const f = sim.exec("cat seekarte.md").output!;
  assert.match(f, /<<<<<<</); assert.match(f, /=======/); assert.match(f, />>>>>>>/);
  assert.match(f, /deine Zeile/); assert.match(f, /fremde Zeile/);
  // status zeigt den ungelösten Pfad
  assert.match(sim.exec("git status").output!, /nicht zusammengeführt|beide geändert/i);
});

test("git: Konflikt blockiert commit/push/zweiten merge bis zur Auflösung", () => {
  armConflict(sim);
  sim.exec("git merge kollege");
  assert.ok(sim.exec("git commit -m \"x\"").error, "commit mit offenem Konflikt wird abgelehnt");
  assert.ok(sim.exec("git push").error, "push mit offenem Konflikt wird abgelehnt");
  assert.ok(sim.exec("git merge kollege").error, "zweiter merge mitten im Konflikt wird abgelehnt");
  // add VOR der Seitenwahl (Marker noch drin) wird abgelehnt
  assert.ok(sim.exec("git add seekarte.md").error, "add bei noch vorhandenen Markern meckert");
});

test("git checkout --theirs/--ours: Seite wählen, dann add+commit löst den Konflikt", () => {
  armConflict(sim);
  sim.exec("git merge kollege");
  // falsche Datei wird abgelehnt
  assert.ok(sim.exec("git checkout --theirs gibtsnicht.md").error, "nur die Konfliktdatei zählt");
  const co = sim.exec("git checkout --theirs seekarte.md");
  assert.ok(!co.error);
  assert.equal(sim.files["seekarte.md"], "fremde Zeile", "Arbeitsdatei = hereinkommende Version");
  assert.ok(sim.git.conflict, "vor 'git add' gilt der Konflikt noch als offen");
  const add = sim.exec("git add seekarte.md");
  assert.ok(!add.error);
  assert.equal(sim.git.conflict, null, "add markiert den Konflikt als gelöst");
  const commit = sim.exec('git commit -m "geloest"');
  assert.ok(!commit.error, "jetzt schließt der commit den Merge ab");
});

test("git checkout --ours: behält die eigene Version", () => {
  armConflict(sim);
  sim.exec("git merge kollege");
  sim.exec("git checkout --ours seekarte.md");
  assert.equal(sim.files["seekarte.md"], "deine Zeile");
});

test("git checkout --theirs ohne Konflikt meldet einen Fehler", () => {
  sim.exec("git init");
  assert.ok(sim.exec("git checkout --theirs seekarte.md").error, "ohne offenen Konflikt sinnlos");
});

test("Konflikt überlebt snapshot/restore (auch nach Reload lösbar)", () => {
  armConflict(sim);
  sim.exec("git merge kollege");
  const restored = new KQSim(JSON.parse(JSON.stringify(sim.snapshot())));
  assert.ok(restored.git.conflict, "offener Konflikt bleibt nach restore erhalten");
  assert.match(restored.exec("cat seekarte.md").output!, /<<<<<<</, "Marker noch da");
  restored.exec("git checkout --theirs seekarte.md");
  restored.exec("git add seekarte.md");
  assert.ok(!restored.exec('git commit -m "ok"').error, "nach Reload genauso lösbar");
});

test("remoteAhead + scharf gestellter Konflikt überstehen mehrfaches mergeScenario (kein Reset durch Reload)", () => {
  sim.exec("git init");
  const setup = { gitRemoteAhead: 2, gitConflict: { branch: "kollege", file: "k.md", ours: "a", theirs: "b" } };
  sim.mergeScenario(setup);
  assert.equal(sim.git.remoteAhead, 2);
  sim.exec("git pull");
  assert.equal(sim.git.remoteAhead, 0, "nach pull aufgeholt");
  // erneutes Einmischen desselben Szenarios (wie beim Laden eines Spielstands) darf NICHT zurücksetzen
  sim.mergeScenario(setup);
  assert.equal(sim.git.remoteAhead, 0, "remoteAhead bleibt 0 – kein Wiederhochsetzen");
  assert.equal(sim.git.branches.filter(b => b === "kollege").length, 1, "Branch nicht doppelt angelegt");
});
