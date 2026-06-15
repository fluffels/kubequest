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
