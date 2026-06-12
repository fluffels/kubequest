/* Unit-Tests für den Cluster-Simulator.
 * Ausführen mit:  node --test test/
 */
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

global.window = {};
require("../js/sim.js");
const KQSim = window.KQSim;

let sim;
beforeEach(() => { sim = new KQSim({}); });

test("docker: Tippfehler im Image-Namen wird mit Vorschlag abgefangen", () => {
  const r = sim.exec("docker run busyboy");
  assert.ok(r.error, "Vertipper muss als Fehler gelten");
  assert.match(r.output, /busybox/, "Vorschlag 'busybox' wird angeboten");
  assert.equal(sim.docker.containers.length, 0, "kein Container aus kaputtem Image");
  // korrekte Schreibweise geht durch
  assert.ok(!sim.exec("docker run busybox").error);
  // unbekanntes, aber nicht-tippfehler-Image bleibt erlaubt (Ausprobieren)
  assert.ok(!sim.exec("docker pull mein-eigenes-image").error);
});

test("unbekannter Befehl bekommt einen 'Meintest du?'-Vorschlag", () => {
  const r = sim.exec("kubctl get pods");
  assert.ok(r.error);
  assert.match(r.output, /kubectl/);
});

test("docker: pull, run, ps, stop, ps -a", () => {
  assert.match(sim.exec("docker pull nginx").output, /Downloaded newer image/);
  sim.exec("docker run -d --name web nginx");
  assert.match(sim.exec("docker ps").output, /web/);
  sim.exec("docker stop web");
  assert.doesNotMatch(sim.exec("docker ps").output, /\bweb\b/);
  assert.match(sim.exec("docker ps -a").output, /Exited/);
});

test("kubectl: create, scale, self-healing nach delete", () => {
  sim.exec("kubectl create deployment kasse --image=nginx");
  sim.exec("kubectl scale deployment kasse --replicas=3");
  const dep = sim.deployments.find(d => d.name === "kasse");
  assert.equal(dep.pods.length, 3);
  const victim = dep.pods[0].name;
  sim.exec("kubectl delete pod " + victim);
  assert.equal(dep.pods.length, 3, "Self-Healing: Pod wird sofort ersetzt");
  assert.ok(!dep.pods.some(p => p.name === victim), "der gelöschte Pod ist wirklich weg");
});

test("kubectl: expose erzeugt Service mit fester IP", () => {
  sim.exec("kubectl create deployment kasse --image=nginx");
  sim.exec("kubectl expose deployment kasse --port=80");
  assert.match(sim.exec("kubectl get services").output, /kasse.*10\.96\./);
});

test("kubectl apply ist idempotent", () => {
  sim.files["app.yaml"] = "kind: Deployment …";
  sim.applyEffects["app.yaml"] = { deployment: { name: "lager", image: "redis", replicas: 2 } };
  assert.match(sim.exec("kubectl apply -f app.yaml").output, /created/);
  assert.match(sim.exec("kubectl apply -f app.yaml").output, /unchanged/);
  assert.equal(sim.deployments.filter(d => d.name === "lager").length, 1);
});

test("helm: install, upgrade, rollback stellt Replicas wieder her", () => {
  sim.exec("helm repo add bitnami https://charts.bitnami.com/bitnami");
  sim.exec("helm install web bitnami/nginx");
  sim.exec("helm upgrade web bitnami/nginx --set replicaCount=3");
  const rel = sim.releases[0];
  assert.equal(rel.revision, 2);
  const dep = sim.deployments.find(d => d.name === rel.depName);
  assert.equal(dep.replicas, 3);
  sim.exec("helm rollback web 1");
  assert.equal(rel.revision, 3, "Rollback erzeugt eine NEUE Revision");
  assert.equal(dep.replicas, 1, "Replicas zurück auf Revision-1-Stand");
});

test("terraform: Zyklus init→plan→apply→destroy, apply fügt Nodes hinzu", () => {
  sim.tf.resources = [{ addr: "hafen_server.worker[0]", desc: "x" }];
  assert.match(sim.exec("terraform plan").output, /init/i, "plan ohne init wird abgelehnt");
  sim.exec("terraform init");
  assert.match(sim.exec("terraform plan").output, /1 to add/);
  sim.exec("terraform apply");
  assert.equal(sim.nodes.length, 5, "neue Server werden Cluster-Nodes");
  assert.match(sim.exec("terraform plan").output, /No changes/);
  sim.exec("terraform destroy");
  assert.equal(sim.nodes.length, 3);
});

test("secrets: create, get (ohne Inhalt!), delete", () => {
  sim.exec("kubectl create secret generic db --from-literal=pw=geheim123");
  const out = sim.exec("kubectl get secrets").output;
  assert.match(out, /db.*Opaque/);
  assert.doesNotMatch(out, /geheim123/, "Secret-Werte tauchen NIE in der Liste auf");
  sim.exec("kubectl delete secret db");
  assert.match(sim.exec("kubectl get secrets").output, /No resources/);
});

test("troubleshooting: ImagePullBackOff via set image heilen", () => {
  sim.mergeScenario({ deployments: [{ name: "app", image: "ngnix", replicas: 1, broken: { type: "imagepull", badImage: "ngnix" } }] });
  assert.match(sim.exec("kubectl get pods").output, /ImagePullBackOff/);
  const pod = sim.deployments[0].pods[0].name;
  assert.match(sim.exec("kubectl describe pod " + pod).output, /Failed to pull image/);
  // dasselbe kaputte Image heilt NICHT
  sim.exec("kubectl set image deployment/app app=ngnix");
  assert.ok(sim.deployments[0].broken, "gleiches Image = weiter kaputt");
  sim.exec("kubectl set image deployment/app app=nginx");
  assert.equal(sim.deployments[0].broken, null);
  assert.match(sim.exec("kubectl get pods").output, /Running/);
});

test("troubleshooting: CrashLoop heilt nur mit Secret + rollout restart", () => {
  sim.mergeScenario({ deployments: [{ name: "app", image: "nginx", replicas: 1, broken: { type: "crashloop", needsSecret: "key" } }] });
  const pod = sim.deployments[0].pods[0].name;
  assert.match(sim.exec("kubectl logs " + pod).output, /Secret 'key' nicht gefunden/);
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
  assert.match(sim.exec("kubectl get pods").output, /Pending/);
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
  assert.match(restored.exec("kubectl get pods").output, /kasse/);
  assert.match(restored.exec("kubectl get secrets").output, /db/);
  assert.match(restored.exec("helm list").output, /web/);
});
