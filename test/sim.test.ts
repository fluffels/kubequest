/* Unit-Tests für den Cluster-Simulator.
 * Ausführen mit:  node --test test/
 */
import { test, beforeEach } from "vitest";
import assert from "node:assert/strict";
import { Sim as KQSim } from "../src/sim";

let sim: KQSim;
beforeEach(() => { sim = new KQSim({}); });

test("docker: Tippfehler im Image-Namen wird mit Vorschlag abgefangen", () => {
  const r = sim.exec("docker run busyboy");
  assert.ok(r.error, "Vertipper muss als Fehler gelten");
  assert.match(r.output!, /busybox/, "Vorschlag 'busybox' wird angeboten");
  assert.equal(sim.docker.containers.length, 0, "kein Container aus kaputtem Image");
  // korrekte Schreibweise geht durch
  assert.ok(!sim.exec("docker run busybox").error);
  // unbekanntes, aber nicht-tippfehler-Image bleibt erlaubt (Ausprobieren)
  assert.ok(!sim.exec("docker pull mein-eigenes-image").error);
});

test("unbekannter Befehl bekommt einen 'Meintest du?'-Vorschlag", () => {
  const r = sim.exec("kubctl get pods");
  assert.ok(r.error);
  assert.match(r.output!, /kubectl/);
});

test("docker: pull, run, ps, stop, ps -a", () => {
  assert.match(sim.exec("docker pull nginx").output!, /Downloaded newer image/);
  sim.exec("docker run -d --name web nginx");
  assert.match(sim.exec("docker ps").output!, /web/);
  sim.exec("docker stop web");
  assert.doesNotMatch(sim.exec("docker ps").output!, /\bweb\b/);
  assert.match(sim.exec("docker ps -a").output!, /Exited/);
});

test("docker build: baut aus dem Dockerfile ein eigenes, getaggtes Image (#66)", () => {
  sim.files["Dockerfile"] = "FROM nginx:1.27\nCOPY site/ /usr/share/nginx/html\nEXPOSE 80";
  const r = sim.exec("docker build -t hafenwache:1.0 .");
  assert.ok(!r.error, "build mit Dockerfile muss durchgehen");
  assert.match(r.output!, /Successfully tagged hafenwache:1\.0/);
  assert.match(r.output!, /FROM nginx:1\.27/, "die Basis-Schicht aus dem Dockerfile taucht im Build-Log auf");
  assert.ok(sim.docker.pulled.includes("hafenwache:1.0"), "das gebaute Image liegt jetzt lokal bereit");
  // ohne :tag wird :latest angenommen, das Image ist startbar
  assert.ok(!sim.exec("docker run -d --name wache hafenwache:1.0").error, "aus dem selbst gebauten Image lässt sich ein Container starten");
});

test("docker build: ohne Dockerfile UND ohne -t klare Fehler – kein Phantom-Image (#66)", () => {
  // kein Dockerfile vorhanden
  const ohneFile = sim.exec("docker build -t app:1.0 .");
  assert.ok(ohneFile.error, "ohne Dockerfile muss build scheitern");
  assert.match(ohneFile.output!, /no such file|Dockerfile/i);
  assert.equal(sim.docker.pulled.length, 0, "kein Image darf ohne Bauplan entstehen");
  // Dockerfile da, aber -t vergessen
  sim.files["Dockerfile"] = "FROM nginx:1.27";
  const ohneTag = sim.exec("docker build .");
  assert.ok(ohneTag.error, "ohne -t (Name) muss build scheitern");
  assert.equal(sim.docker.pulled.length, 0, "auch hier darf kein Image entstehen");
});

test("docker build: ohne Build-Kontext-Punkt '.' scheitert realistisch + erklärt den Punkt (#220)", () => {
  sim.files["Dockerfile"] = "FROM nginx:1.27";
  // -t und Name sind korrekt, aber der abschließende '.' (Build-Kontext) fehlt –
  // echtes Docker bricht hier mit "requires exactly 1 argument" ab, statt falschen Erfolg zu melden.
  const ohnePunkt = sim.exec("docker build -t hafenwache:1.0");
  assert.ok(ohnePunkt.error, "ohne Build-Kontext darf der Build NICHT als Erfolg gelten");
  assert.doesNotMatch(ohnePunkt.output!, /Successfully (built|tagged)/, "kein falscher Erfolg im Terminal");
  assert.match(ohnePunkt.output!, /requires exactly 1 argument/, "realistische Docker-Fehlermeldung");
  assert.match(ohnePunkt.output!, /Kontext|Punkt|aktuellen Ordner/i, "der Hinweis erklärt den fehlenden Kontext-Punkt");
  assert.equal(sim.docker.pulled.length, 0, "ohne Kontext darf kein Image entstehen");
  // Gegenprobe: derselbe Befehl MIT Punkt geht glatt durch
  const mitPunkt = sim.exec("docker build -t hafenwache:1.0 .");
  assert.ok(!mitPunkt.error, "mit Build-Kontext '.' muss der Build durchgehen");
  assert.match(mitPunkt.output!, /Successfully tagged hafenwache:1\.0/);
});

test("docker tag: zweiter Name fürs Image; unbekannte Quelle scheitert (#66)", () => {
  sim.files["Dockerfile"] = "FROM nginx:1.27";
  sim.exec("docker build -t hafenwache:1.0 .");
  // Negativfall zuerst: taggen, was es nicht gibt
  const fehlt = sim.exec("docker tag gibtsnicht:9.9 hafenwache:latest");
  assert.ok(fehlt.error, "Quell-Image existiert nicht -> Fehler");
  assert.match(fehlt.output!, /No such image/);
  assert.ok(!sim.docker.pulled.includes("hafenwache:latest"), "kein Ziel-Tag aus kaputtem tag");
  // jetzt korrekt taggen
  const ok = sim.exec("docker tag hafenwache:1.0 hafenwache:latest");
  assert.ok(!ok.error, "vorhandenes Image bekommt zweiten Namen");
  assert.ok(sim.docker.pulled.includes("hafenwache:latest"), "das zweite Etikett ist jetzt da");
  assert.ok(sim.docker.pulled.includes("hafenwache:1.0"), "das Original-Etikett bleibt erhalten");
});

test("docker run: Flags nach dem Image gelten nicht (echte Reihenfolge: Optionen VOR dem Image)", () => {
  // Häufiger Anfängerfehler: --name/-d hinter das Image gesetzt
  const r = sim.exec("docker run nginx --name webserver -d");
  assert.ok(r.error, "Flags nach dem Image müssen abgelehnt werden");
  assert.ok(!sim.docker.containers.some(c => c.name === "webserver"), "es darf KEIN Container 'webserver' angelegt werden");
  // korrekte Reihenfolge legt den Hintergrund-Container an
  assert.ok(!sim.exec("docker run -d --name webserver nginx").error, "korrekte Reihenfolge geht durch");
  const c = sim.docker.containers.find(c => c.name === "webserver");
  assert.ok(c && c.running, "webserver läuft im Hintergrund");
  // ein echter Container-Befehl nach dem Image ist erlaubt (kein Flag)
  assert.ok(!sim.exec("docker run --name echo-test nginx echo hallo").error, "Befehl nach dem Image ist ok");
});

test("häufige Anfängerfehler werden auch bei kubectl/helm/git abgefangen – Fehler + Hinweis (Issue #19)", () => {
  // kubectl: Pflicht-Flag fehlt
  const noImg = sim.exec("kubectl create deployment kasse");
  assert.ok(noImg.error, "create deployment ohne --image muss meckern");
  assert.match(noImg.output!, /image/i);
  assert.ok(!sim.deployments.some(d => d.name === "kasse"), "ohne --image wird KEIN Deployment angelegt");
  // kubectl: unbekannte Ressource -> Vorschlag
  const bad = sim.exec("kubectl get bananen");
  assert.ok(bad.error && /pods|deployments|services|nodes/i.test(bad.output!), "unbekannte Ressource wird erklärt");

  // helm: Chart fehlt
  assert.ok(sim.exec("helm install meinrelease").error, "helm install ohne Chart muss meckern");

  // git: ohne init kein Repo
  assert.ok(sim.exec("git status").error, "ohne 'git init' ist es kein Repo");
  sim.exec("git init");
  // git commit ohne -m wird erklärt
  const noMsg = sim.exec("git commit");
  assert.ok(noMsg.error && /Commit-Nachricht/i.test(noMsg.output!), "commit ohne -m wird erklärt");
  // git add ohne Datei wird erklärt
  assert.ok(sim.exec("git add").error, "git add ohne Datei muss meckern");
});

test("kubectl: create, scale, self-healing nach delete", () => {
  sim.exec("kubectl create deployment kasse --image=nginx");
  sim.exec("kubectl scale deployment kasse --replicas=3");
  const dep = sim.deployments.find(d => d.name === "kasse")!;
  assert.equal(dep.pods.length, 3);
  const victim = dep.pods[0].name;
  sim.exec("kubectl delete pod " + victim);
  assert.equal(dep.pods.length, 3, "Self-Healing: Pod wird sofort ersetzt");
  assert.ok(!dep.pods.some(p => p.name === victim), "der gelöschte Pod ist wirklich weg");
});

test("kubectl: expose erzeugt Service mit fester IP", () => {
  sim.exec("kubectl create deployment kasse --image=nginx");
  sim.exec("kubectl expose deployment kasse --port=80");
  assert.match(sim.exec("kubectl get services").output!, /kasse.*10\.96\./);
});

test("kubectl apply ist idempotent", () => {
  sim.files["app.yaml"] = "kind: Deployment …";
  sim.applyEffects["app.yaml"] = { deployment: { name: "lager", image: "redis", replicas: 2 } };
  assert.match(sim.exec("kubectl apply -f app.yaml").output!, /created/);
  assert.match(sim.exec("kubectl apply -f app.yaml").output!, /unchanged/);
  assert.equal(sim.deployments.filter(d => d.name === "lager").length, 1);
});

test("helm: install, upgrade, rollback stellt Replicas wieder her", () => {
  sim.exec("helm repo add bitnami https://charts.bitnami.com/bitnami");
  sim.exec("helm install web bitnami/nginx");
  sim.exec("helm upgrade web bitnami/nginx --set replicaCount=3");
  const rel = sim.releases[0];
  assert.equal(rel.revision, 2);
  const dep = sim.deployments.find(d => d.name === rel.depName)!;
  assert.equal(dep.replicas, 3);
  sim.exec("helm rollback web 1");
  assert.equal(rel.revision, 3, "Rollback erzeugt eine NEUE Revision");
  assert.equal(dep.replicas, 1, "Replicas zurück auf Revision-1-Stand");
});

/* ---------- Werft-Ausbau: eigene Charts schreiben (Issue #27) ---------- */

test("helm create: legt ein Chart samt Gerüst-Dateien an", () => {
  const out = sim.exec("helm create funkdienst").output!;
  assert.match(out, /Creating funkdienst/);
  assert.equal(sim.charts.length, 1);
  assert.equal(sim.charts[0].name, "funkdienst");
  // Das Gerüst muss als anschaubare Dateien existieren (ls/cat im Spiel).
  const ls = sim.exec("ls").output!;
  assert.match(ls, /funkdienst\/Chart\.yaml/);
  assert.match(ls, /funkdienst\/values\.yaml/);
  assert.match(sim.exec("cat funkdienst/Chart.yaml").output!, /name: funkdienst/);
  assert.match(sim.exec("cat funkdienst/values.yaml").output!, /replicaCount/);
});

test("helm create: zweimal derselbe Name wird abgelehnt (Negativfall)", () => {
  assert.ok(!sim.exec("helm create funkdienst").error);
  const dup = sim.exec("helm create funkdienst");
  assert.ok(dup.error, "doppelter Chart-Name muss meckern");
  assert.match(dup.output!, /already exists/);
  assert.equal(sim.charts.length, 1, "kein doppeltes Chart angelegt");
});

test("helm create: ohne Namen meckert es", () => {
  const r = sim.exec("helm create");
  assert.ok(r.error);
  assert.match(r.output!, /Chart-Name fehlt/);
});

test("helm lint: prüft nur existierende Charts (positiv + negativ)", () => {
  sim.exec("helm create funkdienst");
  const ok = sim.exec("helm lint funkdienst").output!;
  assert.match(ok, /0 chart\(s\) failed/);
  assert.ok(!sim.exec("helm lint ./funkdienst").error, "Pfad-Schreibweise ./chart geht auch");
  const miss = sim.exec("helm lint gibtsnicht");
  assert.ok(miss.error, "lint auf unbekanntes Chart muss meckern");
  assert.match(miss.output!, /not found/);
});

test("helm package: erzeugt ein .tgz und markiert das Chart als gepackt", () => {
  sim.exec("helm create funkdienst");
  const out = sim.exec("helm package funkdienst").output!;
  assert.match(out, /funkdienst-0\.1\.0\.tgz/);
  assert.equal(sim.charts[0].packaged, true);
  assert.match(sim.exec("ls").output!, /funkdienst-0\.1\.0\.tgz/);
  const miss = sim.exec("helm package gibtsnicht");
  assert.ok(miss.error && /not found/.test(miss.output!), "package auf unbekanntes Chart meckert");
});

test("helm install aus lokalem Chart: ./chart erzeugt ein echtes Release + Pods", () => {
  sim.exec("helm create funkdienst");
  const out = sim.exec("helm install mein-funk ./funkdienst").output!;
  assert.match(out, /STATUS: deployed/);
  assert.ok(sim.releases.some(r => r.name === "mein-funk"), "Release angelegt");
  assert.match(sim.exec("kubectl get pods").output!, /mein-funk-funkdienst/);
  // Negativfall: lokaler Pfad auf ein Chart, das es nicht gibt
  const miss = sim.exec("helm install rel ./gibtsnicht");
  assert.ok(miss.error, "Install aus fehlendem lokalem Chart muss scheitern");
  assert.match(miss.output!, /not found/);
});

test("helm install: bekannter Bruchfall bleibt – Repo-Chart ohne Repo meckert weiter", () => {
  // Sicherstellen, dass die neue Lokal-Logik den Repo-Pfad nicht aufweicht (Red-Green).
  const r = sim.exec("helm install web bitnami/nginx");
  assert.ok(r.error && /repo bitnami not found/.test(r.output!), "ohne 'helm repo add' kein Repo-Install");
});

test("snapshot/restore erhält selbst gebaute Charts", () => {
  sim.exec("helm create funkdienst");
  sim.exec("helm package funkdienst");
  const restored = new KQSim(JSON.parse(JSON.stringify(sim.snapshot())));
  assert.equal(restored.charts.length, 1);
  assert.equal(restored.charts[0].packaged, true);
  // und das wiederhergestellte Chart ist sofort wieder installierbar
  assert.ok(!restored.exec("helm install w ./funkdienst").error);
});

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

test("terraform: Zyklus init→plan→apply→destroy, apply fügt Nodes hinzu", () => {
  sim.tf.resources = [{ addr: "hafen_server.worker[0]", desc: "x" }];
  assert.match(sim.exec("terraform plan").output!, /init/i, "plan ohne init wird abgelehnt");
  sim.exec("terraform init");
  assert.match(sim.exec("terraform plan").output!, /1 to add/);
  sim.exec("terraform apply");
  assert.equal(sim.nodes.length, 5, "neue Server werden Cluster-Nodes");
  assert.match(sim.exec("terraform plan").output!, /No changes/);
  sim.exec("terraform destroy");
  assert.equal(sim.nodes.length, 3);
});

test("secrets: create, get (ohne Inhalt!), delete", () => {
  sim.exec("kubectl create secret generic db --from-literal=pw=geheim123");
  const out = sim.exec("kubectl get secrets").output!;
  assert.match(out, /db.*Opaque/);
  assert.doesNotMatch(out, /geheim123/, "Secret-Werte tauchen NIE in der Liste auf");
  sim.exec("kubectl delete secret db");
  assert.match(sim.exec("kubectl get secrets").output!, /No resources/);
});

test("configmaps: create, get, delete – und Duplikat/leer werden abgelehnt (Negativfälle)", () => {
  const created = sim.exec("kubectl create configmap app-config --from-literal=db_host=hafen-db");
  assert.ok(!created.error);
  assert.match(created.output!, /configmap\/app-config created/);
  assert.match(sim.exec("kubectl get configmaps").output!, /app-config.*1/);
  // Negativ: ohne --from-literal legt nichts an
  const leer = sim.exec("kubectl create configmap leer");
  assert.ok(leer.error, "ConfigMap ohne Daten wird abgelehnt");
  assert.equal(sim.configMaps.length, 1, "fehlgeschlagenes create legt nichts an");
  // Negativ: Duplikat
  const doppelt = sim.exec("kubectl create configmap app-config --from-literal=x=y");
  assert.ok(doppelt.error, "doppelte ConfigMap wird abgelehnt");
  assert.equal(sim.configMaps.filter(c => c.name === "app-config").length, 1);
  sim.exec("kubectl delete configmap app-config");
  assert.match(sim.exec("kubectl get configmaps").output!, /No resources/);
});

test("set env: bindet ConfigMap UND Secret in ein Deployment ein", () => {
  sim.mergeScenario({ deployments: [{ name: "passagierliste", image: "nginx", replicas: 1 }] });
  sim.exec("kubectl create configmap pc --from-literal=db_host=hafen-db");
  sim.exec("kubectl create secret generic pg --from-literal=db_passwort=tiefsee42");
  assert.ok(!sim.exec("kubectl set env deployment/passagierliste --from=configmap/pc").error);
  assert.ok(!sim.exec("kubectl set env deployment/passagierliste --from=secret/pg").error);
  const dep = sim.deployments.find(d => d.name === "passagierliste")!;
  assert.deepEqual(dep.envFrom.configMaps, ["pc"]);
  assert.deepEqual(dep.envFrom.secrets, ["pg"]);
  // idempotent: zweimal dieselbe Quelle bindet nicht doppelt
  sim.exec("kubectl set env deployment/passagierliste --from=configmap/pc");
  assert.deepEqual(dep.envFrom.configMaps, ["pc"], "doppelte Bindung bleibt einmalig");
});

test("set env: Negativfälle – fehlendes Deployment, fehlende Quelle, keine Bindung bei Fehler", () => {
  sim.mergeScenario({ deployments: [{ name: "passagierliste", image: "nginx", replicas: 1 }] });
  // unbekanntes Deployment
  const keinDep = sim.exec("kubectl set env deployment/gibtsnicht --from=configmap/pc");
  assert.ok(keinDep.error);
  assert.match(keinDep.output!, /not found/);
  // ConfigMap existiert noch nicht -> Fehler, nichts gebunden
  const keineCm = sim.exec("kubectl set env deployment/passagierliste --from=configmap/pc");
  assert.ok(keineCm.error, "nicht existierende ConfigMap wird abgelehnt");
  const dep = sim.deployments.find(d => d.name === "passagierliste")!;
  assert.deepEqual(dep.envFrom.configMaps, [], "fehlgeschlagene Bindung verändert nichts");
  // Secret existiert noch nicht -> Fehler
  assert.ok(sim.exec("kubectl set env deployment/passagierliste --from=secret/pg").error);
  assert.deepEqual(dep.envFrom.secrets, []);
});

test("envFrom übersteht snapshot/restore", () => {
  sim.mergeScenario({ deployments: [{ name: "passagierliste", image: "nginx", replicas: 1 }] });
  sim.exec("kubectl create configmap pc --from-literal=db_host=hafen-db");
  sim.exec("kubectl create secret generic pg --from-literal=db_passwort=x");
  sim.exec("kubectl set env deployment/passagierliste --from=configmap/pc");
  sim.exec("kubectl set env deployment/passagierliste --from=secret/pg");
  const restored = new KQSim(sim.snapshot());
  const dep = restored.deployments.find(d => d.name === "passagierliste")!;
  assert.deepEqual(dep.envFrom.configMaps, ["pc"]);
  assert.deepEqual(dep.envFrom.secrets, ["pg"]);
  assert.match(restored.exec("kubectl get configmaps").output!, /pc/);
});

test("troubleshooting: ImagePullBackOff via set image heilen", () => {
  sim.mergeScenario({ deployments: [{ name: "app", image: "ngnix", replicas: 1, broken: { type: "imagepull", badImage: "ngnix" } }] });
  assert.match(sim.exec("kubectl get pods").output!, /ImagePullBackOff/);
  const pod = sim.deployments[0].pods[0].name;
  assert.match(sim.exec("kubectl describe pod " + pod).output!, /Failed to pull image/);
  // dasselbe kaputte Image heilt NICHT
  sim.exec("kubectl set image deployment/app app=ngnix");
  assert.ok(sim.deployments[0].broken, "gleiches Image = weiter kaputt");
  sim.exec("kubectl set image deployment/app app=nginx");
  assert.equal(sim.deployments[0].broken, null);
  assert.match(sim.exec("kubectl get pods").output!, /Running/);
});

test("troubleshooting: CrashLoop heilt nur mit Secret + rollout restart", () => {
  sim.mergeScenario({ deployments: [{ name: "app", image: "nginx", replicas: 1, broken: { type: "crashloop", needsSecret: "key" } }] });
  const pod = sim.deployments[0].pods[0].name;
  assert.match(sim.exec("kubectl logs " + pod).output!, /Secret 'key' nicht gefunden/);
  sim.exec("kubectl rollout restart deployment app");
  assert.ok(sim.deployments[0].broken, "Restart ohne Secret bringt nichts");
  sim.exec("kubectl create secret generic key --from-literal=k=v");
  sim.exec("kubectl rollout restart deployment app");
  assert.equal(sim.deployments[0].broken, null);
});

test("troubleshooting: OOMKilled heilt erst, wenn das memory-Limit reicht (set resources)", () => {
  sim.mergeScenario({ deployments: [{ name: "kartograf", image: "nginx", replicas: 1, broken: { type: "oomkilled", memNeeded: 256 } }] });
  // get pods zeigt das Fehlerbild
  assert.match(sim.exec("kubectl get pods").output!, /OOMKilled/);
  const pod = sim.deployments[0].pods[0].name;
  // describe ist die EINZIGE Diagnosequelle: Last State / Reason / Limit
  const desc = sim.exec("kubectl describe pod " + pod).output!;
  assert.match(desc, /Reason:\s+OOMKilled/);
  assert.match(desc, /memory:\s+64Mi/, "zu knappes Limit steht im describe");
  // Logs verraten den OOM-Kill bewusst NICHT
  assert.doesNotMatch(sim.exec("kubectl logs " + pod).output!, /OOM/i);
  // Negativfall: ein zu knappes neues Limit heilt NICHT
  sim.exec("kubectl set resources deployment/kartograf --limits=memory=128Mi --requests=memory=64Mi");
  assert.ok(sim.deployments[0].broken, "128Mi < 256Mi benötigt -> weiter OOMKilled");
  assert.match(sim.exec("kubectl get pods").output!, /OOMKilled/);
  // Ausreichendes Limit heilt
  sim.exec("kubectl set resources deployment/kartograf --limits=memory=256Mi --requests=memory=128Mi");
  assert.equal(sim.deployments[0].broken, null, "256Mi >= 256Mi benötigt -> geheilt");
  assert.match(sim.exec("kubectl get pods").output!, /Running/);
});

test("set resources: Gi wird zu Mi umgerechnet, Unsinn wird abgelehnt (Negativfall)", () => {
  sim.exec("kubectl create deployment app --image=nginx");
  // 1Gi = 1024Mi -> als Limit gesetzt
  const ok = sim.exec("kubectl set resources deployment/app --limits=memory=1Gi");
  assert.ok(!ok.error);
  assert.equal(sim.deployments.find(d => d.name === "app")!.memLimit, 1024);
  // krummer Wert -> klarer Fehler, kein stilles Durchwinken
  const bad = sim.exec("kubectl set resources deployment/app --limits=memory=foo");
  assert.ok(bad.error, "ungültige Speicherangabe ist ein Fehler");
  // gar kein Limit/Request -> Fehler
  assert.ok(sim.exec("kubectl set resources deployment/app").error);
  // unbekanntes Deployment -> NotFound
  assert.match(sim.exec("kubectl set resources deployment/gibtsnicht --limits=memory=128Mi").output!, /NotFound/);
});

test("set resources: CPU-Limit unter Schwelle räumt cpuHeavy aus und löst HighPodCPU-Alert auf", () => {
  sim.mergeScenario({ deployments: [{ name: "containergrill", image: "nginx", replicas: 1, cpuHeavy: true }] });
  // Alert muss initial feuern
  const firingBefore = sim.alerts().some(a => a.name === "HighPodCPU" && a.state === "firing");
  assert.ok(firingBefore, "HighPodCPU-Alert soll feuern, bevor das Limit gesetzt ist");
  // CPU-Limit setzen -> cpuHeavy wird gelöscht
  const r = sim.exec("kubectl set resources deployment/containergrill --limits=cpu=200m");
  assert.ok(!r.error, "set resources --limits=cpu=200m soll kein Fehler sein");
  assert.ok(!sim.deployments[0].cpuHeavy, "cpuHeavy muss nach CPU-Limit-Setzung falsch sein");
  // Alert muss jetzt resolved sein
  const resolvedAfter = sim.alerts().some(a => a.name === "HighPodCPU" && a.state === "resolved");
  assert.ok(resolvedAfter, "HighPodCPU-Alert soll resolved sein, nachdem CPU unter die Schwelle fällt");
  // kein Limit/Request überhaupt -> Fehler (auch ohne cpu-Flag)
  assert.ok(sim.exec("kubectl set resources deployment/containergrill").error, "kein Limit -> Fehler");
});

test("troubleshooting: Pending heilt durch neue Nodes (Terraform)", () => {
  sim.mergeScenario({
    deployments: [{ name: "app", image: "nginx", replicas: 1, broken: { type: "pending" } }],
    tfResources: [{ addr: "hafen_server.worker[0]", desc: "x" }],
  });
  assert.match(sim.exec("kubectl get pods").output!, /Pending/);
  sim.exec("terraform init");
  sim.exec("terraform apply");
  assert.equal(sim.deployments[0].broken, null, "mit neuen Nodes wird der Pod eingeplant");
});

test("snapshot/restore erhält den kompletten Zustand", () => {
  sim.exec("kubectl create deployment kasse --image=nginx");
  sim.exec("kubectl create secret generic db --from-literal=pw=x");
  sim.exec("helm repo add bitnami https://charts.bitnami.com/bitnami");
  sim.exec("helm install web bitnami/nginx");
  const restored = new KQSim(JSON.parse(JSON.stringify(sim.snapshot())));
  assert.match(restored.exec("kubectl get pods").output!, /kasse/);
  assert.match(restored.exec("kubectl get secrets").output!, /db/);
  assert.match(restored.exec("helm list").output!, /web/);
});

/* ===================== Ingress (Hafentor) – Issue #15 ===================== */

// Kleiner Helfer: ein Ingress-Manifest in die Welt legen, so wie es eine Quest täte.
function legeIngressManifest(s: KQSim, datei = "ingress.yaml") {
  s.files[datei] = "kind: Ingress …";
  s.applyEffects[datei] = { ingress: { name: "hafentor", host: "hafen.de", path: "/kasse", service: "kasse", port: "80", className: "nginx" } };
}

test("ingress: get zeigt 'No resources', solange keins existiert", () => {
  // Negativfall: Tor noch nicht aufgestellt -> kein Eintrag, kein Crash.
  const r = sim.exec("kubectl get ingress");
  assert.ok(!r.error, "leere Ingress-Liste ist kein Fehler");
  assert.match(r.output!, /No resources found/);
});

test("ingress: apply -f erzeugt das Hafentor, get zeigt Host/Class/Adresse", () => {
  legeIngressManifest(sim);
  const created = sim.exec("kubectl apply -f ingress.yaml");
  assert.match(created.output!, /ingress\.networking\.k8s\.io\/hafentor created/);
  assert.equal(sim.ingresses.length, 1, "genau ein Ingress angelegt");

  const get = sim.exec("kubectl get ingress");
  assert.match(get.output!, /hafentor/);
  assert.match(get.output!, /hafen\.de/, "HOSTS-Spalte zeigt den Host");
  assert.match(get.output!, /nginx/, "CLASS-Spalte zeigt den Ingress-Controller");
  assert.match(get.output!, /203\.0\.113\.10/, "ADDRESS-Spalte zeigt die Controller-Adresse");
  // Kurzform 'ing' liefert dasselbe.
  assert.match(sim.exec("kubectl get ing").output!, /hafentor/);
});

test("ingress: apply ist idempotent (zweites apply -> unchanged, kein Duplikat)", () => {
  legeIngressManifest(sim);
  assert.match(sim.exec("kubectl apply -f ingress.yaml").output!, /created/);
  assert.match(sim.exec("kubectl apply -f ingress.yaml").output!, /unchanged/);
  assert.equal(sim.ingresses.filter(i => i.name === "hafentor").length, 1, "kein doppeltes Tor");
});

test("ingress: delete per Name und per -f entfernt das Tor; Unbekanntes meldet NotFound", () => {
  legeIngressManifest(sim);
  sim.exec("kubectl apply -f ingress.yaml");

  // Negativfall: löschen, was es nicht gibt.
  const miss = sim.exec("kubectl delete ingress gibtsnicht");
  assert.ok(miss.error, "unbekanntes Ingress -> Fehler");
  assert.match(miss.output!, /NotFound/);
  assert.equal(sim.ingresses.length, 1, "fehlgeschlagenes delete fasst Bestand nicht an");

  // per Name löschen
  assert.match(sim.exec("kubectl delete ingress hafentor").output!, /hafentor" deleted/);
  assert.equal(sim.ingresses.length, 0);

  // erneut anlegen und diesmal per -f löschen
  sim.exec("kubectl apply -f ingress.yaml");
  assert.equal(sim.ingresses.length, 1);
  assert.match(sim.exec("kubectl delete -f ingress.yaml").output!, /hafentor" deleted/);
  assert.equal(sim.ingresses.length, 0);
});

test("ingress: describe zeigt Backend – und warnt, wenn der Ziel-Service fehlt", () => {
  // Tor zeigt auf Service 'kasse', den es (noch) NICHT gibt -> Lern-Warnung.
  legeIngressManifest(sim);
  sim.exec("kubectl apply -f ingress.yaml");
  const ohneSvc = sim.exec("kubectl describe ingress hafentor");
  assert.match(ohneSvc.output!, /hafen\.de/);
  assert.match(ohneSvc.output!, /kasse:80/, "Backend Service:Port wird gezeigt");
  assert.match(ohneSvc.output!, /lotst ins Leere/, "fehlender Service wird angewarnt");

  // Service anlegen -> Warnung verschwindet.
  sim.exec("kubectl create deployment kasse --image=nginx");
  sim.exec("kubectl expose deployment kasse --port=80");
  const mitSvc = sim.exec("kubectl describe ingress hafentor");
  assert.doesNotMatch(mitSvc.output!, /lotst ins Leere/);

  // Negativfall: describe auf nicht existierendes Tor.
  const miss = sim.exec("kubectl describe ingress geist");
  assert.ok(miss.error);
  assert.match(miss.output!, /NotFound/);
});

test("ingress: Szenario-Seeding + snapshot/restore erhalten das Tor", () => {
  // Über das Szenario vorbelegt (wie eine Quest-Welt).
  const seeded = new KQSim({ ingresses: [{ name: "tor-1", className: "nginx", host: "alt.de", path: "/", service: "alt", port: "80" }] });
  assert.match(seeded.exec("kubectl get ingress").output!, /tor-1/);

  // mergeScenario fügt ein zweites hinzu, ohne das erste zu doppeln.
  seeded.mergeScenario({ ingresses: [{ name: "tor-1", className: "nginx", host: "alt.de", path: "/", service: "alt", port: "80" }, { name: "tor-2", className: "nginx", host: "neu.de", path: "/", service: "neu", port: "80" }] });
  assert.equal(seeded.ingresses.length, 2, "Duplikat wird nicht erneut angelegt");

  // snapshot/restore behält beide Tore.
  const restored = new KQSim(JSON.parse(JSON.stringify(seeded.snapshot())));
  assert.match(restored.exec("kubectl get ingress").output!, /tor-1/);
  assert.match(restored.exec("kubectl get ingress").output!, /tor-2/);
});

/* ===================== TLS-Terminierung am Hafentor – Issue #64 ===================== */

// Helfer: Ingress-Manifest MIT TLS in die Welt legen (verschlüsseltes Tor).
function legeTlsIngressManifest(s: KQSim, datei = "ingress-tls.yaml") {
  s.files[datei] = "kind: Ingress … spec.tls …";
  s.applyEffects[datei] = { ingress: { name: "hafentor", host: "hafen.de", path: "/lager", service: "lager", port: "6379", className: "nginx", tls: { secretName: "hafen-tls" } } };
}

test("secret tls: create legt ein TLS-Secret an, get zeigt Typ kubernetes.io/tls", () => {
  const created = sim.exec("kubectl create secret tls hafen-tls --cert=tls.crt --key=tls.key");
  assert.ok(!created.error);
  assert.match(created.output!, /secret\/hafen-tls created/);
  const get = sim.exec("kubectl get secrets").output!;
  assert.match(get, /hafen-tls/);
  assert.match(get, /kubernetes\.io\/tls/, "TYPE-Spalte zeigt den TLS-Typ, nicht Opaque");
  assert.match(get, /\b2\b/, "DATA zeigt 2 Schlüssel (tls.crt + tls.key)");
});

test("secret tls: fehlende --cert/--key und Duplikat werden abgelehnt (Negativfälle)", () => {
  const ohneFlags = sim.exec("kubectl create secret tls hafen-tls");
  assert.ok(ohneFlags.error, "ohne --cert/--key -> Fehler");
  assert.match(ohneFlags.output!, /--cert.*--key|--key/);
  assert.equal(sim.secrets.length, 0, "fehlgeschlagenes create legt nichts an");

  const nurCert = sim.exec("kubectl create secret tls hafen-tls --cert=tls.crt");
  assert.ok(nurCert.error, "nur --cert reicht nicht");

  sim.exec("kubectl create secret tls hafen-tls --cert=tls.crt --key=tls.key");
  const doppelt = sim.exec("kubectl create secret tls hafen-tls --cert=tls.crt --key=tls.key");
  assert.ok(doppelt.error, "gleicher Name zweimal -> Fehler");
  assert.match(doppelt.output!, /already exists/);
  assert.equal(sim.secrets.filter(s => s.name === "hafen-tls").length, 1, "kein doppeltes Secret");
});

test("ingress TLS: apply rüstet das bestehende Tor auf HTTPS nach (configured), get zeigt 443", () => {
  // Erst das normale Tor, dann TLS nachrüsten – wie in der Quest (q23).
  legeIngressManifest(sim, "ingress.yaml");
  // legeIngressManifest zeigt auf service 'kasse'; für q23-Optik egal, wir prüfen nur TLS.
  sim.exec("kubectl apply -f ingress.yaml");
  assert.match(sim.exec("kubectl get ingress").output!, /\b80\b/);
  assert.doesNotMatch(sim.exec("kubectl get ingress").output!, /443/, "vor TLS kein 443");

  legeTlsIngressManifest(sim);
  const configured = sim.exec("kubectl apply -f ingress-tls.yaml");
  assert.match(configured.output!, /hafentor configured/, "bestehendes Tor wird umkonfiguriert, nicht 'unchanged'");
  assert.equal(sim.ingresses.filter(i => i.name === "hafentor").length, 1, "kein doppeltes Tor");
  assert.ok(sim.ingresses[0].tls && sim.ingresses[0].tls.secretName === "hafen-tls");

  assert.match(sim.exec("kubectl get ingress").output!, /80, 443/, "PORTS zeigt jetzt 80, 443");

  // Erneutes apply ist wieder idempotent (TLS schon da -> unchanged).
  assert.match(sim.exec("kubectl apply -f ingress-tls.yaml").output!, /unchanged/);
});

test("ingress TLS: apply auf neues Tor legt es direkt mit TLS an", () => {
  legeTlsIngressManifest(sim);
  const created = sim.exec("kubectl apply -f ingress-tls.yaml");
  assert.match(created.output!, /hafentor created/);
  assert.ok(sim.ingresses[0].tls?.secretName === "hafen-tls");
});

test("ingress TLS: describe zeigt den TLS-Block und warnt bei fehlendem Zertifikats-Secret", () => {
  legeTlsIngressManifest(sim);
  sim.exec("kubectl apply -f ingress-tls.yaml");

  // Secret existiert noch nicht -> describe warnt.
  const ohneSecret = sim.exec("kubectl describe ingress hafentor");
  assert.match(ohneSecret.output!, /TLS:/);
  assert.match(ohneSecret.output!, /hafen-tls terminates hafen\.de/);
  assert.match(ohneSecret.output!, /HTTPS bleibt zu/, "fehlendes TLS-Secret wird angewarnt");

  // Secret anlegen -> Warnung verschwindet.
  sim.exec("kubectl create secret tls hafen-tls --cert=tls.crt --key=tls.key");
  assert.doesNotMatch(sim.exec("kubectl describe ingress hafentor").output!, /HTTPS bleibt zu/);
});

test("ingress ohne TLS: describe zeigt KEINEN TLS-Block (kein False Positive)", () => {
  legeIngressManifest(sim);
  sim.exec("kubectl apply -f ingress.yaml");
  assert.doesNotMatch(sim.exec("kubectl describe ingress hafentor").output!, /TLS:/);
});

test("ingress TLS: snapshot/restore erhält die TLS-Konfiguration", () => {
  legeTlsIngressManifest(sim);
  sim.exec("kubectl apply -f ingress-tls.yaml");
  const restored = new KQSim(JSON.parse(JSON.stringify(sim.snapshot())));
  assert.ok(restored.ingresses[0].tls?.secretName === "hafen-tls", "TLS übersteht snapshot/restore");
  assert.match(restored.exec("kubectl get ingress").output!, /80, 443/);
});

/* ===================== NetworkPolicy (Hafenmauer) – Issue #20 ===================== */

// Kleiner Helfer: ein NetworkPolicy-Manifest in die Welt legen, so wie es eine Quest täte.
function legeNetpolManifest(s: KQSim, datei = "netpol.yaml") {
  s.files[datei] = "kind: NetworkPolicy …";
  s.applyEffects[datei] = { networkPolicy: { name: "hafenmauer", podSelector: "lager", allowFrom: "hafentor" } };
}

test("networkpolicy: get zeigt 'No resources', solange keine existiert", () => {
  // Negativfall: noch keine Mauer -> kein Eintrag, kein Crash.
  const r = sim.exec("kubectl get networkpolicies");
  assert.ok(!r.error, "leere Liste ist kein Fehler");
  assert.match(r.output!, /No resources found/);
});

test("networkpolicy: apply -f zieht die Hafenmauer hoch, get zeigt Name + Selektor", () => {
  legeNetpolManifest(sim);
  const created = sim.exec("kubectl apply -f netpol.yaml");
  assert.match(created.output!, /networkpolicy\.networking\.k8s\.io\/hafenmauer created/);
  assert.equal(sim.networkPolicies.length, 1, "genau eine NetworkPolicy angelegt");

  const get = sim.exec("kubectl get networkpolicies");
  assert.match(get.output!, /hafenmauer/);
  assert.match(get.output!, /app=lager/, "POD-SELECTOR-Spalte zeigt das geschützte Label");
  // Kurzformen liefern dasselbe.
  assert.match(sim.exec("kubectl get netpol").output!, /hafenmauer/);
  assert.match(sim.exec("kubectl get networkpolicy").output!, /hafenmauer/);
});

test("networkpolicy: apply ist idempotent (zweites apply -> unchanged, kein Duplikat)", () => {
  legeNetpolManifest(sim);
  assert.match(sim.exec("kubectl apply -f netpol.yaml").output!, /created/);
  assert.match(sim.exec("kubectl apply -f netpol.yaml").output!, /unchanged/);
  assert.equal(sim.networkPolicies.filter(n => n.name === "hafenmauer").length, 1, "keine doppelte Mauer");
});

test("networkpolicy: describe nennt Selektor + erlaubte Quelle; Unbekanntes meldet NotFound", () => {
  legeNetpolManifest(sim);
  sim.exec("kubectl apply -f netpol.yaml");
  const d = sim.exec("kubectl describe networkpolicy hafenmauer");
  assert.ok(!d.error);
  assert.match(d.output!, /PodSelector:\s+app=lager/);
  assert.match(d.output!, /Allowing ingress traffic/);
  assert.match(d.output!, /app=hafentor/, "die erlaubte Quelle steht in den from-Regeln");

  // Negativfall: describe auf nicht existierende Mauer.
  const miss = sim.exec("kubectl describe netpol geistermauer");
  assert.ok(miss.error);
  assert.match(miss.output!, /NotFound/);
});

test("networkpolicy: default-deny – eine Policy ganz ohne erlaubte Quelle macht dicht", () => {
  // allowFrom leer = niemand darf rein (default-deny), describe macht das transparent.
  sim.files["deny.yaml"] = "kind: NetworkPolicy …";
  sim.applyEffects["deny.yaml"] = { networkPolicy: { name: "abriegelung", podSelector: "kasse" } };
  sim.exec("kubectl apply -f deny.yaml");
  const d = sim.exec("kubectl describe networkpolicy abriegelung");
  assert.match(d.output!, /default-deny/);
});

test("networkpolicy: delete per Name und per -f entfernt die Mauer; Unbekanntes meldet NotFound", () => {
  legeNetpolManifest(sim);
  sim.exec("kubectl apply -f netpol.yaml");

  // per Name (inkl. Kurzform).
  assert.match(sim.exec("kubectl delete netpol hafenmauer").output!, /hafenmauer" deleted/);
  assert.equal(sim.networkPolicies.length, 0);

  // per -f.
  sim.exec("kubectl apply -f netpol.yaml");
  assert.match(sim.exec("kubectl delete -f netpol.yaml").output!, /hafenmauer" deleted/);
  assert.equal(sim.networkPolicies.length, 0);

  // Negativfall: Unbekanntes löschen.
  const miss = sim.exec("kubectl delete networkpolicy geistermauer");
  assert.ok(miss.error);
  assert.match(miss.output!, /NotFound/);
});

test("networkpolicy: Szenario-Seeding + snapshot/restore erhalten die Mauer", () => {
  const seeded = new KQSim({ networkPolicies: [{ name: "wall-1", podSelector: "db", allowFrom: "api" }] });
  assert.match(seeded.exec("kubectl get netpol").output!, /wall-1/);

  // mergeScenario fügt eine zweite hinzu, ohne die erste zu doppeln.
  seeded.mergeScenario({ networkPolicies: [{ name: "wall-1", podSelector: "db", allowFrom: "api" }, { name: "wall-2", podSelector: "web", allowFrom: "lb" }] });
  assert.equal(seeded.networkPolicies.length, 2, "Duplikat wird nicht erneut angelegt");

  // snapshot/restore behält beide Mauern.
  const restored = new KQSim(JSON.parse(JSON.stringify(seeded.snapshot())));
  assert.match(restored.exec("kubectl get netpol").output!, /wall-1/);
  assert.match(restored.exec("kubectl get netpol").output!, /wall-2/);
});

/* ===================== Health-Checks: Readiness/Liveness – Issue #67 ===================== */

// Kleiner Helfer: ein Deployment, das läuft, aber wegen fehlender Readiness
// (es fehlt ihm sein Secret) nicht bereit ist – plus Service davor.
function legeNotreadyDeployment(s: KQSim, name = "kombuese", secret = "kombuese-menue") {
  s.mergeScenario({ deployments: [{ name, image: "nginx", replicas: 1, broken: { type: "notready", needsSecret: secret } }] });
  s.exec("kubectl expose deployment " + name + " --port=80");
}

test("readiness: notready-Pod läuft (Running), ist aber READY 0/1 ohne Restarts", () => {
  legeNotreadyDeployment(sim);
  const pods = sim.exec("kubectl get pods");
  assert.ok(!pods.error);
  // Genau das Lehrbild: STATUS Running, aber READY 0/1 – kein Crash, keine Restarts.
  assert.match(pods.output!, /kombuese-\S+\s+0\/1\s+Running\s+0\b/);
  assert.doesNotMatch(pods.output!, /CrashLoopBackOff/);
});

test("readiness: get endpoints zeigt <none>, solange der Pod nicht bereit ist", () => {
  legeNotreadyDeployment(sim);
  const ep = sim.exec("kubectl get endpoints kombuese");
  assert.ok(!ep.error, "leere Endpoints sind kein Fehler");
  assert.match(ep.output!, /kombuese\s+<none>/, "nicht-bereiter Pod fehlt im Service");
  // Kurzform 'ep' liefert dasselbe.
  assert.match(sim.exec("kubectl get ep kombuese").output!, /<none>/);
});

test("readiness: describe pod nennt die fehlgeschlagene Readiness-Probe + Ready: 0/1", () => {
  legeNotreadyDeployment(sim);
  const podName = sim.deployments.find(d => d.name === "kombuese")!.pods[0].name;
  const d = sim.exec("kubectl describe pod " + podName);
  assert.ok(!d.error);
  assert.match(d.output!, /Readiness probe failed/);
  assert.match(d.output!, /Ready:\s+0\/1/);
  // Es LÄUFT trotzdem – Status bleibt Running (liveness ok).
  assert.match(d.output!, /Status:\s+Running/);
});

test("readiness: Secret anlegen macht den Pod von SELBST bereit – ohne rollout restart", () => {
  legeNotreadyDeployment(sim);
  // Ursache beheben: das Secret, an dem die Readiness-Probe hängt.
  assert.match(sim.exec("kubectl create secret generic kombuese-menue --from-literal=menue=fisch").output!, /created/);
  // KEIN Neustart! Allein das nächste Abfragen lässt die Probe durchgehen.
  const ep = sim.exec("kubectl get endpoints kombuese");
  assert.match(ep.output!, /kombuese\s+10\.244\.1\.20:80/, "bereiter Pod taucht als Endpoint auf");
  assert.match(sim.exec("kubectl get pods").output!, /kombuese-\S+\s+1\/1\s+Running/);
  assert.equal(sim.deployments.find(d => d.name === "kombuese")!.broken, null, "notready ist geheilt");
});

test("readiness: das FALSCHE Secret heilt NICHT (kein False Positive)", () => {
  legeNotreadyDeployment(sim);
  sim.exec("kubectl create secret generic irgendwas-anderes --from-literal=k=v");
  // Solange das benötigte Secret fehlt, bleibt der Pod draußen.
  assert.match(sim.exec("kubectl get endpoints kombuese").output!, /<none>/);
  assert.match(sim.exec("kubectl get pods").output!, /kombuese-\S+\s+0\/1\s+Running/);
  assert.ok(sim.deployments.find(d => d.name === "kombuese")!.broken, "notready besteht weiter");
});

test("readiness: ein GESUNDES Deployment liefert echte Endpoints (Gegenprobe)", () => {
  sim.exec("kubectl create deployment kantine --image=nginx");
  sim.exec("kubectl expose deployment kantine --port=80");
  const ep = sim.exec("kubectl get endpoints kantine");
  assert.match(ep.output!, /kantine\s+10\.244\.1\.20:80/, "gesunder Pod ist sofort Endpoint");
  assert.doesNotMatch(ep.output!, /<none>/);
});

test("endpoints: unbekannter Service meldet NotFound", () => {
  const miss = sim.exec("kubectl get endpoints gibtsnicht");
  assert.ok(miss.error);
  assert.match(miss.output!, /NotFound/);
});

test("deployments-Liste spiegelt Readiness: notready zeigt 0/1, geheilt 1/1", () => {
  legeNotreadyDeployment(sim);
  assert.match(sim.exec("kubectl get deployments").output!, /kombuese\s+0\/1/);
  sim.exec("kubectl create secret generic kombuese-menue --from-literal=menue=fisch");
  assert.match(sim.exec("kubectl get deployments").output!, /kombuese\s+1\/1/);
});

/* ===================== argocd / GitOps (Issue #90) ===================== */

// Legt eine Argo-Application-CRD als apply-Effekt an (manuelle Sync-Policy, falls nicht anders gesagt).
function legeArgoApp(s: KQSim, opts: { autoSync?: boolean; selfHeal?: boolean } = {}) {
  s.files["kasse-app.yaml"] = "kind: Application …";
  s.applyEffects["kasse-app.yaml"] = {
    application: {
      name: "kasse", repo: "https://git.hafen.de/apps.git", path: "kasse/",
      autoSync: opts.autoSync, selfHeal: opts.selfHeal,
      deployment: { name: "kasse", image: "nginx", replicas: 3 },
      service: { name: "kasse", port: "80" },
    },
  };
}

test("argocd: apply einer Application-CRD legt eine Argo-App an – erst OutOfSync/Missing", () => {
  legeArgoApp(sim);
  const r = sim.exec("kubectl apply -f kasse-app.yaml");
  assert.match(r.output!, /application\.argoproj\.io\/kasse created/);
  assert.equal(sim.argoApps.length, 1, "App liegt im Sim-State");
  // Noch nichts ausgerollt: Deployment fehlt -> OutOfSync, Health Missing
  assert.equal(sim.deployments.length, 0, "ohne sync wird nichts materialisiert");
  const get = sim.exec("argocd app get kasse");
  assert.match(get.output!, /Sync Status:\s+OutOfSync/);
  assert.match(get.output!, /Health Status:\s+Missing/);
});

test("argocd: app sync zieht den Git-Soll in den Cluster (Pull) -> Synced/Healthy", () => {
  legeArgoApp(sim);
  sim.exec("kubectl apply -f kasse-app.yaml");
  const sync = sim.exec("argocd app sync kasse");
  assert.ok(!sync.error);
  assert.match(sync.output!, /Synced/);
  const dep = sim.deployments.find(d => d.name === "kasse");
  assert.ok(dep, "Deployment wurde materialisiert");
  assert.equal(dep!.replicas, 3, "Replikas wie im Git deklariert");
  assert.equal(dep!.image, "nginx");
  assert.ok(sim.services.some(s => s.name === "kasse"), "Service wurde mit angelegt");
  assert.match(sim.exec("argocd app get kasse").output!, /Sync Status:\s+Synced/);
  assert.match(sim.exec("argocd app get kasse").output!, /Health Status:\s+Healthy/);
});

test("argocd: list zeigt Sync- und Health-Status", () => {
  legeArgoApp(sim);
  sim.exec("kubectl apply -f kasse-app.yaml");
  assert.match(sim.exec("argocd app list").output!, /kasse\s+OutOfSync\s+Missing/);
  sim.exec("argocd app sync kasse");
  assert.match(sim.exec("argocd app list").output!, /kasse\s+Synced\s+Healthy/);
});

test("argocd: Drift durch kubectl scale macht OutOfSync, erneutes sync dreht ihn zurück", () => {
  legeArgoApp(sim); // manuelle Policy, kein self-heal
  sim.exec("kubectl apply -f kasse-app.yaml");
  sim.exec("argocd app sync kasse");
  // manueller Eingriff am Cluster -> weicht vom Git-Soll ab
  sim.exec("kubectl scale deployment kasse --replicas=7");
  assert.equal(sim.deployments.find(d => d.name === "kasse")!.replicas, 7, "Drift bleibt zunächst stehen (kein self-heal)");
  assert.match(sim.exec("argocd app get kasse").output!, /Sync Status:\s+OutOfSync/);
  // Pull bringt den Cluster wieder auf den deklarierten Stand
  sim.exec("argocd app sync kasse");
  assert.equal(sim.deployments.find(d => d.name === "kasse")!.replicas, 3, "Sync stellt den Git-Soll wieder her");
  assert.match(sim.exec("argocd app get kasse").output!, /Sync Status:\s+Synced/);
});

test("argocd: Drift durch set image macht OutOfSync, sync setzt das Image zurück", () => {
  legeArgoApp(sim);
  sim.exec("kubectl apply -f kasse-app.yaml");
  sim.exec("argocd app sync kasse");
  sim.exec("kubectl set image deployment/kasse kasse=redis");
  assert.match(sim.exec("argocd app get kasse").output!, /OutOfSync/);
  sim.exec("argocd app sync kasse");
  assert.equal(sim.deployments.find(d => d.name === "kasse")!.image, "nginx", "Git-Image gewinnt");
});

test("argocd: gelöschtes Deployment macht OutOfSync/Missing, sync legt es neu an", () => {
  legeArgoApp(sim);
  sim.exec("kubectl apply -f kasse-app.yaml");
  sim.exec("argocd app sync kasse");
  sim.exec("kubectl delete deployment kasse");
  const get = sim.exec("argocd app get kasse");
  assert.match(get.output!, /OutOfSync/);
  assert.match(get.output!, /Missing/);
  sim.exec("argocd app sync kasse");
  assert.ok(sim.deployments.some(d => d.name === "kasse"), "sync materialisiert die fehlende Ressource neu");
});

test("argocd: auto-sync rollt den Soll beim apply sofort aus (kein manuelles sync nötig)", () => {
  legeArgoApp(sim, { autoSync: true, selfHeal: true });
  const r = sim.exec("kubectl apply -f kasse-app.yaml");
  assert.match(r.output!, /Automated/);
  assert.ok(sim.deployments.some(d => d.name === "kasse"), "auto-sync materialisiert sofort");
  assert.match(sim.exec("argocd app get kasse").output!, /Sync Status:\s+Synced/);
});

test("argocd: self-heal dreht manuellen Drift beim nächsten Tick automatisch zurück (Pull spürbar)", () => {
  legeArgoApp(sim, { autoSync: true, selfHeal: true });
  sim.exec("kubectl apply -f kasse-app.yaml");
  sim.exec("kubectl scale deployment kasse --replicas=9");
  // direkt nach dem Scale steht der Drift noch (reconcile läuft VOR dem nächsten Befehl)
  assert.equal(sim.deployments.find(d => d.name === "kasse")!.replicas, 9);
  // der nächste Befehl tickt die Self-Heal-Schleife -> Drift weg
  const get = sim.exec("argocd app get kasse");
  assert.equal(sim.deployments.find(d => d.name === "kasse")!.replicas, 3, "self-heal hat zurückgedreht");
  assert.match(get.output!, /Sync Status:\s+Synced/);
});

test("argocd: ohne self-heal bleibt der Drift bei auto-sync stehen (Gegenprobe)", () => {
  legeArgoApp(sim, { autoSync: true, selfHeal: false });
  sim.exec("kubectl apply -f kasse-app.yaml");
  sim.exec("kubectl scale deployment kasse --replicas=9");
  sim.exec("argocd app get kasse"); // Tick – darf NICHT heilen
  assert.equal(sim.deployments.find(d => d.name === "kasse")!.replicas, 9, "ohne self-heal kein Auto-Zurückdrehen");
  assert.match(sim.exec("argocd app get kasse").output!, /OutOfSync/);
});

test("argocd: Snapshot/Reset bewahrt Argo-Apps inkl. Sync-Status", () => {
  legeArgoApp(sim, { autoSync: true, selfHeal: true });
  sim.exec("kubectl apply -f kasse-app.yaml");
  const snap = sim.snapshot();
  const wieder = new KQSim(snap);
  assert.equal(wieder.argoApps.length, 1, "App überlebt das Speichern");
  assert.equal(wieder.argoApps[0].name, "kasse");
  assert.equal(wieder.argoApps[0].autoSync, true);
  assert.match(wieder.exec("argocd app get kasse").output!, /Synced/);
});

test("argocd: Fehlerfälle – unbekannter Unterbefehl, fehlende/unbekannte App", () => {
  assert.ok(sim.exec("argocd cluster list").error, "nur 'argocd app ...' wird unterstützt");
  assert.ok(sim.exec("argocd app get").error, "Name fehlt");
  const miss = sim.exec("argocd app get gibtsnicht");
  assert.ok(miss.error);
  assert.match(miss.output!, /NotFound/);
  assert.ok(sim.exec("argocd app sync gibtsnicht").error, "sync auf unbekannte App ist Fehler");
  assert.ok(sim.exec("argocd app huh kasse").error, "unbekannte Aktion");
});

test("argocd: doppeltes apply ist idempotent (unchanged, keine zweite App)", () => {
  legeArgoApp(sim);
  assert.match(sim.exec("kubectl apply -f kasse-app.yaml").output!, /created/);
  assert.match(sim.exec("kubectl apply -f kasse-app.yaml").output!, /unchanged/);
  assert.equal(sim.argoApps.length, 1);
});

test("argocd: apply mit neuen selfHeal/autoSync-Einstellungen gibt 'configured' zurück (#96)", () => {
  // Erst ohne selfHeal anlegen
  legeArgoApp(sim, { autoSync: false, selfHeal: false });
  sim.exec("kubectl apply -f kasse-app.yaml");
  sim.exec("argocd app sync kasse");
  assert.equal(sim.argoApps[0].selfHeal, false, "selfHeal ist initial aus");

  // Update-YAML: selfHeal und autoSync einschalten
  sim.files["kasse-selfheal.yaml"] = "kind: Application (selfHeal)";
  sim.applyEffects["kasse-selfheal.yaml"] = {
    application: {
      name: "kasse", repo: "https://git.hafen.de/apps.git", path: "kasse/",
      autoSync: true, selfHeal: true,
      deployment: { name: "kasse", image: "nginx", replicas: 3 },
    },
  };
  const r = sim.exec("kubectl apply -f kasse-selfheal.yaml");
  assert.match(r.output!, /configured/, "apply mit geänderter Policy gibt 'configured' zurück");
  assert.equal(sim.argoApps.length, 1, "keine zweite App angelegt");
  assert.equal(sim.argoApps[0].selfHeal, true, "selfHeal ist jetzt aktiv");
  assert.equal(sim.argoApps[0].autoSync, true, "autoSync ist jetzt aktiv");
});

test("argocd: nach selfHeal-Aktivierung per apply dreht Self-Heal Drift zurück (#96)", () => {
  // Anlegen ohne selfHeal, synced
  legeArgoApp(sim, { autoSync: false, selfHeal: false });
  sim.exec("kubectl apply -f kasse-app.yaml");
  sim.exec("argocd app sync kasse");

  // selfHeal via zweites apply aktivieren
  sim.files["kasse-selfheal.yaml"] = "kind: Application (selfHeal)";
  sim.applyEffects["kasse-selfheal.yaml"] = {
    application: {
      name: "kasse", repo: "https://git.hafen.de/apps.git", path: "kasse/",
      autoSync: true, selfHeal: true,
      deployment: { name: "kasse", image: "nginx", replicas: 3 },
    },
  };
  sim.exec("kubectl apply -f kasse-selfheal.yaml");

  // manueller Drift
  sim.exec("kubectl scale deployment kasse --replicas=0");
  assert.equal(sim.deployments.find(d => d.name === "kasse")!.replicas, 0, "Drift erzeugt");

  // nächster Befehl → reconcileAutoSync dreht zurück
  sim.exec("kubectl get deployments");
  assert.equal(sim.deployments.find(d => d.name === "kasse")!.replicas, 3, "selfHeal stellt Git-Soll wieder her");
});

test("argocd: 'argcd' bekommt einen Meintest-du-Vorschlag", () => {
  const r = sim.exec("argcd app list");
  assert.ok(r.error);
  assert.match(r.output!, /argocd/);
});

/* ----- App-of-Apps-Muster (#97) ----- */

// Legt eine App-of-Apps-Wurzel als apply-Effekt an: eine Application, die selbst nichts
// ausrollt, sondern nur auf einen Ordner voller weiterer Applications zeigt (#97).
function legeAppOfApps(s: KQSim, opts: { autoSync?: boolean; selfHeal?: boolean } = {}) {
  s.files["flotte.yaml"] = "kind: Application (App-of-Apps) …";
  s.applyEffects["flotte.yaml"] = {
    application: {
      name: "hafen-flotte", repo: "https://git.hafen.de/seekarten.git", path: "flotte",
      autoSync: opts.autoSync, selfHeal: opts.selfHeal,
      childApps: [
        { name: "flotte-lager", path: "flotte/lager", deployment: { name: "flotte-lager", image: "nginx:1.27", replicas: 2 } },
        { name: "flotte-funk",  path: "flotte/funk",  deployment: { name: "flotte-funk",  image: "nginx:1.27", replicas: 2 } },
        { name: "flotte-kran",  path: "flotte/kran",  deployment: { name: "flotte-kran",  image: "nginx:1.27", replicas: 1 } },
      ],
    },
  };
}

test("App-of-Apps: ein apply der Wurzel legt die ganze Flotte an (eine Wurzel → n Apps)", () => {
  legeAppOfApps(sim, { autoSync: true, selfHeal: true });
  const r = sim.exec("kubectl apply -f flotte.yaml");
  assert.match(r.output!, /application\.argoproj\.io\/hafen-flotte created/);
  // Wurzel + drei Kind-Apps
  assert.equal(sim.argoApps.length, 4, "Wurzel plus drei Kind-Apps");
  for (const n of ["flotte-lager", "flotte-funk", "flotte-kran"]) {
    assert.ok(sim.argoApps.some(a => a.name === n), n + " als Kind-App angelegt");
    assert.ok(sim.deployments.some(d => d.name === n), n + " Deployment ausgerollt");
  }
  // Gegenprobe: die Wurzel selbst rollt KEIN eigenes Deployment aus
  assert.ok(!sim.deployments.some(d => d.name === "hafen-flotte"), "die Wurzel verwaltet nur, sie deployt selbst nichts");
  // Replikas wie in den Kind-Specs deklariert
  assert.equal(sim.deployments.find(d => d.name === "flotte-lager")!.replicas, 2);
  assert.equal(sim.deployments.find(d => d.name === "flotte-kran")!.replicas, 1);
});

test("App-of-Apps: 'argocd app get' der Wurzel listet die verwalteten Kind-Apps und ist Synced/Healthy", () => {
  legeAppOfApps(sim, { autoSync: true, selfHeal: true });
  sim.exec("kubectl apply -f flotte.yaml");
  const get = sim.exec("argocd app get hafen-flotte");
  assert.match(get.output!, /Managed Apps:\s+3/);
  assert.match(get.output!, /flotte-lager/);
  assert.match(get.output!, /Sync Status:\s+Synced/);
  assert.match(get.output!, /Health Status:\s+Healthy/);
  // list zeigt Wurzel UND Kinder
  const list = sim.exec("argocd app list").output!;
  assert.match(list, /hafen-flotte/);
  assert.match(list, /flotte-funk\s+Synced\s+Healthy/);
});

test("App-of-Apps: ohne auto-sync ist die Wurzel erst OutOfSync, 'app sync' zieht dann die ganze Flotte", () => {
  legeAppOfApps(sim, { autoSync: false, selfHeal: false });
  sim.exec("kubectl apply -f flotte.yaml");
  // nur die Wurzel, noch keine Kinder, nichts ausgerollt
  assert.equal(sim.argoApps.length, 1, "nur die Wurzel angelegt");
  assert.equal(sim.deployments.length, 0, "ohne sync wird nichts materialisiert");
  assert.match(sim.exec("argocd app get hafen-flotte").output!, /Sync Status:\s+OutOfSync/);
  // Pull der Wurzel legt die ganze Flotte an
  const sync = sim.exec("argocd app sync hafen-flotte");
  assert.match(sync.output!, /Flotte/);
  assert.equal(sim.argoApps.length, 4, "Wurzel + drei Kinder nach dem Sync");
  assert.ok(sim.deployments.some(d => d.name === "flotte-funk"), "Kind-Dienst ist jetzt ausgerollt");
  assert.match(sim.exec("argocd app get hafen-flotte").output!, /Sync Status:\s+Synced/);
});

test("App-of-Apps: ausgefallener Kind-Dienst macht die Wurzel OutOfSync; vererbtes Self-Heal stellt ihn wieder her", () => {
  legeAppOfApps(sim, { autoSync: true, selfHeal: true });
  sim.exec("kubectl apply -f flotte.yaml");
  // ein Dienst der Flotte fällt aus -> Wurzel weicht vom Git-Soll ab
  sim.exec("kubectl delete deployment flotte-funk");
  assert.ok(!sim.deployments.some(d => d.name === "flotte-funk"), "Drift: Dienst weg");
  // der nächste Befehl tickt die Self-Heal-Schleife (Kind erbt Self-Heal von der Wurzel)
  sim.exec("kubectl get deployments");
  assert.ok(sim.deployments.some(d => d.name === "flotte-funk"), "Self-Heal hat den Dienst neu angelegt");
  assert.match(sim.exec("argocd app get hafen-flotte").output!, /Sync Status:\s+Synced/);
});

test("App-of-Apps: Snapshot/Reset bewahrt die Wurzel inkl. Kind-Apps", () => {
  legeAppOfApps(sim, { autoSync: true, selfHeal: true });
  sim.exec("kubectl apply -f flotte.yaml");
  const wieder = new KQSim(sim.snapshot());
  const root = wieder.argoApps.find(a => a.name === "hafen-flotte");
  assert.ok(root, "Wurzel überlebt das Speichern");
  assert.equal(root!.childApps!.length, 3, "Kind-Apps bleiben im Snapshot erhalten");
  assert.ok(wieder.argoApps.some(a => a.name === "flotte-lager"), "Kind-App überlebt das Speichern");
  assert.match(wieder.exec("argocd app get hafen-flotte").output!, /Synced/);
});

// #307: Drill-Feedback verstummt, wenn die Eingabe einen Sim-Fehler produziert.
// Die UI-Bedingung `!result.error` blockierte das Anzeigen des `why`-Hinweises.
// Dieser Test beweist das Sim-Verhalten, das den Bug auslöst:
// Ein falscher Befehl (docker build ohne Dockerfile) während einer docker-run-Drill
// liefert error:true → der Drill-Hinweis muss dennoch erscheinen (#307 fix in ui.ts).
test("#307 Szenario: falscher Befehl produziert Sim-Fehler (error:true)", () => {
  // Ohne Dockerfile schlägt docker build fehl – das ist der Auslöser für das Verstummen
  const r = sim.exec("docker build .");
  assert.ok(r.error, "docker build ohne Dockerfile liefert error:true");
  // Gleichzeitig würde cmdOk für eine docker-run-Aufgabe false sein → Bug: UI zeigte nichts
  // Die zugehörige UI-Korrektur steht in src/ui.ts (else-if entfernt !result.error)
});

test("#307 Szenario: Subcommand-Vertauscher produziert Sim-Fehler", () => {
  // docker stop auf nicht-existenten Container → error:true, aber cmdOk für docker-run-Task = false
  const r = sim.exec("docker stop nicht-vorhanden");
  assert.ok(r.error, "docker stop auf unbekannten Container liefert error:true");
});
