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
