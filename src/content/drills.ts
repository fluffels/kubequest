/* ===== Inhalte: Drills (Zufalls-Übungen) =====
 * Jede Drill-Funktion bekommt den Simulator und liefert eine frische Aufgabe
 * (ggf. mit Vorbereitung der Welt). PRACTICE ordnet die Drills den NPCs zu.
 */
import type { Sim, Deployment, NetworkPolicyRes } from "../sim";
import { pick, rnd } from "./util";
import { NETPOL_YAML, DOCKERFILE } from "./manifests";

const IMAGES = ["redis", "httpd", "busybox", "postgres", "rabbitmq"];
const NAMES = ["leuchtfeuer", "fischtheke", "lotsenfunk", "ankerwinde", "kombuese", "seekiste"];
/** Gültige (kleingeschriebene) Image-Namen für die eigenen Bau-Übungen (#66). */
const BUILD_NAMES = ["hafenwache", "funkdienst", "lotsenbild", "kombuese-app", "kaiapp", "ankerdienst"];

/** Sorgt dafür, dass ein Dockerfile im Sim-Dateisystem liegt (für docker build/tag). */
function ensureDockerfile(sim: Sim) {
  if (!sim.files["Dockerfile"]) sim.files["Dockerfile"] = DOCKERFILE;
}

function ensureDeployment(sim: Sim): Deployment {
  let d = sim.deployments.find(d => !["kantine"].includes(d.name)) || sim.deployments[0];
  if (!d) {
    const name = pick(NAMES);
    sim.exec("kubectl create deployment " + name + " --image=nginx");
    d = sim.deployments.find(x => x.name === name)!;
  }
  return d;
}

function ensureGit(sim: Sim) {
  if (!sim.git.initialized) sim.exec("git init");
}

/** Gültige Chart-Namen (klein, mit Bindestrich) für die Werft-Übungen (#27). */
const CHART_NAMES = ["funkdienst", "hafenkarte", "lotsen-app", "moewenruf", "kombuese-api", "ankerwerk"];

/** Sorgt dafür, dass ein selbst gebautes Chart existiert, und gibt seinen Namen zurück. */
function ensureChart(sim: Sim): string {
  if (sim.charts.length === 0) {
    let name = pick(CHART_NAMES);
    while (sim.charts.some(c => c.name === name)) name = pick(CHART_NAMES) + rnd(2, 99);
    sim.exec("helm create " + name);
  }
  return sim.charts[0].name;
}

/** Namen & geschützte Apps für die Hafenmauer-Übungen (#20). */
const NETPOL_NAMES = ["hafenmauer", "kaimauer", "wellenbrecher", "bollwerk", "schutzwall", "palisade"];
const NETPOL_APPS = ["kasse", "lager", "funkdienst", "lotsen", "leuchtfeuer", "kombuese"];

/** Sorgt dafür, dass mindestens eine Hafenmauer (NetworkPolicy) existiert, und gibt sie zurück. */
function ensureNetworkPolicy(sim: Sim): NetworkPolicyRes {
  if (sim.networkPolicies.length === 0) {
    let name = pick(NETPOL_NAMES);
    while (sim.networkPolicies.some(n => n.name === name)) name = pick(NETPOL_NAMES) + rnd(2, 99);
    const file = "uebung-netpol.yaml";
    sim.files[file] = NETPOL_YAML;
    sim.applyEffects[file] = { networkPolicy: { name, podSelector: pick(NETPOL_APPS), allowFrom: "hafentor" } };
    sim.exec("kubectl apply -f " + file);
  }
  return sim.networkPolicies[0];
}

/** Eine generierte Übungsaufgabe (Drill). */
export type DrillTask = { text: string; accept: RegExp[]; solution: string; hint: string };

export const DRILLS: Record<string, (sim: Sim) => DrillTask> = {
  "docker-pull": sim => {
    const img = pick(IMAGES);
    return { text: "Lade das Image <code>" + img + "</code> aus der Registry.", accept: [new RegExp("^docker\\s+pull\\s+" + img + "(:\\S+)?$")], solution: "docker pull " + img, hint: "Muster: docker pull <image>" };
  },
  "docker-run": sim => {
    const img = pick(IMAGES);
    return { text: "Starte einen Container aus dem Image <code>" + img + "</code> (ohne Extras).", accept: [new RegExp("^docker\\s+run\\s+" + img + "(:\\S+)?$")], solution: "docker run " + img, hint: "Muster: docker run <image>" };
  },
  "docker-run-named": sim => {
    const img = pick(IMAGES);
    let name = pick(NAMES);
    while (sim.docker.containers.some(c => c.name === name && c.running)) name = pick(NAMES) + rnd(2, 99);
    return { text: "Starte aus <code>" + img + "</code> einen Container im Hintergrund mit dem Namen <code>" + name + "</code>.", accept: [new RegExp("^docker\\s+run\\s+(?=.*-d)(?=.*--name\\s+" + name + ").*" + img + "(:\\S+)?$")], solution: "docker run -d --name " + name + " " + img, hint: "Muster: docker run -d --name <name> <image>" };
  },
  "docker-ps": () => ({ text: "Zeig alle <b>laufenden</b> Container.", accept: [/^docker\s+ps$/], solution: "docker ps", hint: "Zwei Buchstaben nach docker." }),
  "docker-ps-a": () => ({ text: "Zeig <b>alle</b> Container – auch gestoppte.", accept: [/^docker\s+ps\s+(-a|--all)$/], solution: "docker ps -a", hint: "docker ps + die Flag für „alle“." }),
  "docker-stop": sim => {
    let c = sim.docker.containers.find(c => c.running);
    if (!c) { const name = pick(NAMES); sim.exec("docker run -d --name " + name + " nginx"); c = sim.docker.containers.find(x => x.name === name)!; }
    return { text: "Stoppe den Container <code>" + c.name + "</code>.", accept: [new RegExp("^docker\\s+stop\\s+" + c.name + "$")], solution: "docker stop " + c.name, hint: "Muster: docker stop <name>" };
  },
  "docker-build": sim => {
    ensureDockerfile(sim);
    const name = pick(BUILD_NAMES);
    const tag = pick(["1.0", "2.0", "0.1", "dev", "stable"]);
    return { text: "Bau aus dem <code>Dockerfile</code> ein eigenes Image <code>" + name + ":" + tag + "</code> (Punkt am Ende!).", accept: [new RegExp("^docker\\s+build\\s+-t\\s+" + name + ":" + tag.replace(/\./g, "\\.") + "\\s+\\.$")], solution: "docker build -t " + name + ":" + tag + " .", hint: "Muster: docker build -t <name>:<tag> ." };
  },
  "docker-tag": sim => {
    ensureDockerfile(sim);
    const name = pick(BUILD_NAMES);
    sim.exec("docker build -t " + name + ":1.0 ."); // sorgt für ein vorhandenes Quell-Image
    const newTag = pick(["latest", "stable", "prod", "v2"]);
    return { text: "Gib deinem Image <code>" + name + ":1.0</code> zusätzlich das Etikett <code>" + name + ":" + newTag + "</code>.", accept: [new RegExp("^docker\\s+tag\\s+" + name + ":1\\.0\\s+" + name + ":" + newTag + "$")], solution: "docker tag " + name + ":1.0 " + name + ":" + newTag, hint: "Muster: docker tag <quelle> <ziel>" };
  },
  "k-get-nodes": () => ({ text: "Zeig die Nodes des Clusters.", accept: [/^kubectl\s+get\s+(nodes|node|no)$/], solution: "kubectl get nodes", hint: "kubectl get <ressourcentyp>" }),
  "k-get-pods": () => ({ text: "Zeig alle Pods.", accept: [/^kubectl\s+get\s+(pods|pod|po)$/], solution: "kubectl get pods", hint: "kubectl get <ressourcentyp>" }),
  "k-get-svc": () => ({ text: "Zeig alle Services.", accept: [/^kubectl\s+get\s+(services|service|svc)$/], solution: "kubectl get services", hint: "Kurzform svc geht auch." }),
  "k-describe": sim => {
    const d = ensureDeployment(sim);
    const pod = d.pods[0].name;
    return { text: "Beschreibe den Pod <code>" + pod + "</code> im Detail.", accept: [new RegExp("^kubectl\\s+describe\\s+pods?\\s+" + pod.replace(/[-]/g, "\\-") + "$")], solution: "kubectl describe pod " + pod, hint: "kubectl describe pod <name> – den Namen kannst du abtippen." };
  },
  "k-create": sim => {
    let name = pick(NAMES);
    while (sim.deployments.some(d => d.name === name)) name = pick(NAMES) + rnd(2, 9);
    const img = pick(IMAGES);
    return { text: "Erstelle ein Deployment <code>" + name + "</code> mit dem Image <code>" + img + "</code>.", accept: [new RegExp("^kubectl\\s+create\\s+deployment\\s+" + name + "\\s+--image[=\\s]" + img + "(:\\S+)?$")], solution: "kubectl create deployment " + name + " --image=" + img, hint: "Muster: kubectl create deployment <name> --image=<image>" };
  },
  "k-scale": sim => {
    const d = ensureDeployment(sim);
    let n = rnd(2, 5);
    if (n === d.replicas) n++;
    return { text: "Skaliere das Deployment <code>" + d.name + "</code> auf <b>" + n + "</b> Kopien. (Blick zum Dock!)", accept: [new RegExp("^kubectl\\s+scale\\s+deployment\\s+" + d.name + "\\s+--replicas[=\\s]" + n + "$")], solution: "kubectl scale deployment " + d.name + " --replicas=" + n, hint: "Muster: kubectl scale deployment <name> --replicas=<zahl>" };
  },
  "k-delete-pod": sim => {
    const d = ensureDeployment(sim);
    const pod = d.pods[0].name;
    return { text: "Versenke den Pod <code>" + pod + "</code> – und beobachte das Self-Healing am Dock!", accept: [new RegExp("^kubectl\\s+delete\\s+pods?\\s+" + pod.replace(/[-]/g, "\\-") + "$")], solution: "kubectl delete pod " + pod, hint: "kubectl delete pod <name>" };
  },
  "k-expose": sim => {
    const d = ensureDeployment(sim);
    if (sim.services.some(s => s.name === d.name)) sim.exec("kubectl delete service " + d.name);
    const port = pick([80, 8080, 3000, 5432]);
    return { text: "Stelle einen Service vor <code>" + d.name + "</code>, Port <b>" + port + "</b>.", accept: [new RegExp("^kubectl\\s+expose\\s+deployment\\s+" + d.name + "\\s+--port[=\\s]" + port + "(\\s.*)?$")], solution: "kubectl expose deployment " + d.name + " --port=" + port, hint: "Muster: kubectl expose deployment <name> --port=<port>" };
  },
  "k-apply": sim => {
    sim.files["uebung.yaml"] = "# Übungs-Manifest\nkind: Deployment\n…";
    sim.applyEffects["uebung.yaml"] = { deployment: { name: "uebung", image: "nginx", replicas: 1 } };
    if (sim.deployments.some(d => d.name === "uebung")) sim.exec("kubectl delete deployment uebung");
    return { text: "Wende die Datei <code>uebung.yaml</code> deklarativ an.", accept: [/^kubectl\s+apply\s+-f\s+uebung\.yaml$/], solution: "kubectl apply -f uebung.yaml", hint: "kubectl apply -f <datei>" };
  },
  "helm-install": sim => {
    if (!sim.helmRepos.includes("bitnami")) sim.exec("helm repo add bitnami https://charts.bitnami.com/bitnami");
    let rel = pick(NAMES);
    while (sim.releases.some(r => r.name === rel)) rel = pick(NAMES) + rnd(2, 9);
    const chart = pick(["nginx", "redis"]);
    return { text: "Installiere <code>bitnami/" + chart + "</code> als Release <code>" + rel + "</code>.", accept: [new RegExp("^helm\\s+install\\s+" + rel + "\\s+bitnami\\/" + chart + "$")], solution: "helm install " + rel + " bitnami/" + chart, hint: "Muster: helm install <release> <repo>/<chart>" };
  },
  "helm-list": () => ({ text: "Zeig alle installierten Releases.", accept: [/^helm\s+(list|ls)$/], solution: "helm list", hint: "Englisch für „auflisten“." }),
  "helm-upgrade": sim => {
    let r = sim.releases[0];
    if (!r) { sim.exec("helm repo add bitnami https://charts.bitnami.com/bitnami"); sim.exec("helm install uebung bitnami/nginx"); r = sim.releases[0]; }
    const n = rnd(2, 4);
    return { text: "Stelle das Release <code>" + r.name + "</code> per <code>--set replicaCount=" + n + "</code> um.", accept: [new RegExp("^helm\\s+upgrade\\s+" + r.name + "\\s+" + r.chart.replace("/", "\\/") + "\\s+--set\\s+replicaCount=" + n + "$")], solution: "helm upgrade " + r.name + " " + r.chart + " --set replicaCount=" + n, hint: "Muster: helm upgrade <release> <chart> --set replicaCount=<n>" };
  },
  "helm-rollback": sim => {
    let r = sim.releases.find(r => r.revision > 1);
    if (!r) {
      r = sim.releases[0];
      if (!r) { sim.exec("helm repo add bitnami https://charts.bitnami.com/bitnami"); sim.exec("helm install uebung bitnami/nginx"); r = sim.releases[0]; }
      sim.exec("helm upgrade " + r.name + " " + r.chart + " --set replicaCount=2");
    }
    return { text: "Hoppla, das Upgrade von <code>" + r.name + "</code> war ein Fehler – rolle auf Revision <b>1</b> zurück!", accept: [new RegExp("^helm\\s+rollback\\s+" + r.name + "\\s+1$")], solution: "helm rollback " + r.name + " 1", hint: "Muster: helm rollback <release> <revision>" };
  },
  "helm-create": sim => {
    let name = pick(CHART_NAMES);
    while (sim.charts.some(c => c.name === name)) name = pick(CHART_NAMES) + rnd(2, 99);
    return { text: "Bau ein eigenes Chart-Gerüst namens <code>" + name + "</code>.", accept: [new RegExp("^helm\\s+create\\s+" + name + "$")], solution: "helm create " + name, hint: "Muster: helm create <chart-name>" };
  },
  "helm-lint": sim => {
    const name = ensureChart(sim);
    return { text: "Prüfe dein Chart <code>" + name + "</code> auf Fehler.", accept: [new RegExp("^helm\\s+lint\\s+(\\.\\/)?" + name + "$")], solution: "helm lint " + name, hint: "Muster: helm lint <chart>" };
  },
  "helm-package": sim => {
    const name = ensureChart(sim);
    return { text: "Pack dein Chart <code>" + name + "</code> in ein verteilbares Archiv.", accept: [new RegExp("^helm\\s+package\\s+(\\.\\/)?" + name + "$")], solution: "helm package " + name, hint: "Muster: helm package <chart>" };
  },
  "helm-install-local": sim => {
    const name = ensureChart(sim);
    let rel = pick(NAMES);
    while (sim.releases.some(r => r.name === rel)) rel = pick(NAMES) + rnd(2, 99);
    return { text: "Installiere aus deinem eigenen Chart <code>./" + name + "</code> ein Release <code>" + rel + "</code>.", accept: [new RegExp("^helm\\s+install\\s+" + rel + "\\s+\\.\\/" + name + "$")], solution: "helm install " + rel + " ./" + name, hint: "Muster: helm install <release> ./<chart>" };
  },
  "tf-plan": sim => {
    if (!sim.tf.initialized) sim.tf.initialized = true; // Übung setzt ein initialisiertes Projekt voraus
    return { text: "Zeig, was Terraform tun WÜRDE – ohne es zu tun.", accept: [/^terraform\s+plan$/], solution: "terraform plan", hint: "Die Generalprobe." };
  },
  "tf-state": sim => {
    if (!sim.tf.applied) { sim.tf.initialized = true; sim.exec("terraform apply"); }
    return { text: "Wirf einen Blick in Terraforms Gedächtnis.", accept: [/^terraform\s+state\s+list$/], solution: "terraform state list", hint: "terraform state …" };
  },
  "k-secret": sim => {
    let name = pick(["schatzkarte", "funkcode", "kombuesen-rezept"]) + rnd(2, 99);
    while (sim.secrets.some(s => s.name === name)) name = "funkcode" + rnd(100, 9999);
    return { text: "Lege ein Secret <code>" + name + "</code> mit <code>--from-literal=passwort=geheim" + rnd(10, 99) + "x</code> an. (Wert frei wählbar!)", accept: [new RegExp("^kubectl\\s+create\\s+secret\\s+generic\\s+" + name + "\\s+--from-literal[=\\s][\\w.-]+=\\S+$")], solution: "kubectl create secret generic " + name + " --from-literal=passwort=geheim123", hint: "Muster: kubectl create secret generic <name> --from-literal=schluessel=wert" };
  },
  "k-get-secrets": () => ({ text: "Zeig alle Secrets an.", accept: [/^kubectl\s+get\s+(secrets|secret)$/], solution: "kubectl get secrets", hint: "kubectl get …" }),
  "k-secret-tls": sim => {
    let name = pick(["hafen-tls", "kasse-tls", "lager-tls"]);
    while (sim.secrets.some(s => s.name === name)) name = "tor-tls-" + rnd(100, 9999);
    return { text: "Lege ein TLS-Secret <code>" + name + "</code> aus <code>tls.crt</code> und <code>tls.key</code> an.", accept: [new RegExp("^kubectl\\s+create\\s+secret\\s+tls\\s+" + name + "\\s+(?=.*--cert[=\\s]\\S+)(?=.*--key[=\\s]\\S+).*$")], solution: "kubectl create secret tls " + name + " --cert=tls.crt --key=tls.key", hint: "Muster: kubectl create secret tls <name> --cert=tls.crt --key=tls.key" };
  },
  "k-get-ingress": () => ({ text: "Zeig alle Hafentore (Ingresses) an.", accept: [/^kubectl\s+get\s+(ingress|ingresses|ing)$/], solution: "kubectl get ingress", hint: "Kurzform 'ing' geht auch." }),
  "k-logs": sim => {
    const d = ensureDeployment(sim);
    const pod = d.pods[0].name;
    return { text: "Lies die Logs des Pods <code>" + pod + "</code>.", accept: [new RegExp("^kubectl\\s+logs\\s+" + pod.replace(/[-]/g, "\\-") + "$")], solution: "kubectl logs " + pod, hint: "kubectl logs <pod-name> – Name per get pods holen." };
  },
  "k-rollout": sim => {
    const d = ensureDeployment(sim);
    return { text: "Starte alle Pods von <code>" + d.name + "</code> sauber neu (Rolling Restart).", accept: [new RegExp("^kubectl\\s+rollout\\s+restart\\s+deployment[\\/\\s]" + d.name + "$")], solution: "kubectl rollout restart deployment " + d.name, hint: "Muster: kubectl rollout restart deployment <name>" };
  },
  "git-status": sim => {
    ensureGit(sim);
    return { text: "Zeig den aktuellen Stand deines Repos (Branch + Änderungen).", accept: [/^git\s+status$/], solution: "git status", hint: "git + ein Wort für „Stand“." };
  },
  "git-add": sim => {
    ensureGit(sim);
    const fn = "seekarte-" + sim.clock + "-" + rnd(100, 9999) + ".md";
    sim.files[fn] = "# Karte";
    return { text: "Merke die neue Datei <code>" + fn + "</code> zum Commit vor.", accept: [new RegExp("^git\\s+add\\s+" + fn.replace(/[.\-]/g, "\\$&") + "$")], solution: "git add " + fn, hint: "Muster: git add <datei>" };
  },
  "git-commit": sim => {
    ensureGit(sim);
    const fn = "notiz-" + sim.clock + "-" + rnd(100, 9999) + ".md";
    sim.files[fn] = "x"; sim.exec("git add " + fn);
    const msg = pick(["Seekarte ergänzt", "Tippfehler behoben", "Route aktualisiert", "Hafen kartiert"]);
    return { text: "Halte die vorgemerkten Änderungen fest – Commit-Nachricht: <code>" + msg + "</code>.", accept: [new RegExp('^git\\s+commit\\s+-m\\s+"' + msg + '"$')], solution: 'git commit -m "' + msg + '"', hint: 'Muster: git commit -m "Nachricht"' };
  },
  "git-branch": sim => {
    ensureGit(sim);
    let name = "karte-" + rnd(2, 99);
    while (sim.git.branches.includes(name)) name = "karte-" + rnd(100, 9999);
    return { text: "Lege einen neuen Branch <code>" + name + "</code> an (nur anlegen, nicht wechseln).", accept: [new RegExp("^git\\s+branch\\s+" + name + "$")], solution: "git branch " + name, hint: "Muster: git branch <name>" };
  },
  "git-checkout": sim => {
    ensureGit(sim);
    let name = "feature-" + rnd(2, 99);
    while (sim.git.branches.includes(name)) name = "feature-" + rnd(100, 9999);
    return { text: "Lege den Branch <code>" + name + "</code> an UND wechsle direkt hinein.", accept: [new RegExp("^git\\s+checkout\\s+-b\\s+" + name + "$")], solution: "git checkout -b " + name, hint: "Muster: git checkout -b <name>" };
  },
  "git-add-all": sim => {
    ensureGit(sim);
    const fn = "aenderung-" + sim.clock + "-" + rnd(100, 9999) + ".md";
    sim.files[fn] = "# Notiz";
    return { text: "Merke <b>alle</b> Änderungen auf einmal zum Commit vor (mit dem Punkt-Kürzel).", accept: [/^git\s+add\s+\.$/], solution: "git add .", hint: "git add + ein einzelner Punkt = alles." };
  },
  "ci-status": sim => {
    ensureGit(sim);
    if (!sim.files[".gitlab-ci.yml"]) sim.files[".gitlab-ci.yml"] = "stages: [build, test, deploy]";
    const fn = "auslieferung-" + sim.clock + "-" + rnd(100, 9999) + ".txt";
    sim.files[fn] = "x"; sim.exec("git add " + fn); sim.exec('git commit -m "Auslieferung"'); sim.exec("git push");
    return { text: "Schau nach, ob die letzte Pipeline durchgelaufen ist.", accept: [/^glab\s+ci\s+status$/], solution: "glab ci status", hint: "glab ci <unterbefehl> – der Befehl fürs Nachschauen." };
  },
  "k-get-netpol": sim => {
    ensureNetworkPolicy(sim);
    return { text: "Zeig alle Hafenmauern (NetworkPolicies) im Cluster.", accept: [/^kubectl\s+get\s+(networkpolicies|networkpolicy|netpol|netpols)$/], solution: "kubectl get networkpolicies", hint: "Kurzform 'netpol' geht auch." };
  },
  "k-apply-netpol": sim => {
    let name = pick(NETPOL_NAMES);
    while (sim.networkPolicies.some(n => n.name === name)) name = pick(NETPOL_NAMES) + rnd(2, 99);
    const file = "drill-netpol.yaml";
    sim.files[file] = NETPOL_YAML;
    sim.applyEffects[file] = { networkPolicy: { name, podSelector: pick(NETPOL_APPS), allowFrom: "hafentor" } };
    return { text: "Wende die Hafenmauer-Karte <code>" + file + "</code> deklarativ an.", accept: [/^kubectl\s+apply\s+-f\s+drill-netpol\.yaml$/], solution: "kubectl apply -f " + file, hint: "kubectl apply -f <datei>" };
  },
  "k-describe-netpol": sim => {
    const np = ensureNetworkPolicy(sim);
    return { text: "Beschreibe die Hafenmauer <code>" + np.name + "</code> – wer darf rein?", accept: [new RegExp("^kubectl\\s+describe\\s+(networkpolicy|networkpolicies|netpol|netpols)\\s+" + np.name.replace(/[-]/g, "\\-") + "$")], solution: "kubectl describe networkpolicy " + np.name, hint: "kubectl describe networkpolicy <name>" };
  },
  "k-delete-netpol": sim => {
    const np = ensureNetworkPolicy(sim);
    return { text: "Reiß die Hafenmauer <code>" + np.name + "</code> wieder ein.", accept: [new RegExp("^kubectl\\s+delete\\s+(networkpolicy|networkpolicies|netpol|netpols)\\s+" + np.name.replace(/[-]/g, "\\-") + "$")], solution: "kubectl delete networkpolicy " + np.name, hint: "kubectl delete networkpolicy <name>" };
  },
};

/* Übungs-Pools pro NPC: freigeschaltet nach bestimmter Quest */
export const PRACTICE: Record<string, { drill: string; after: string }[]> = {
  bo:   [{ drill: "docker-pull", after: "q1" }, { drill: "docker-run", after: "q1" }, { drill: "docker-ps", after: "q2" }, { drill: "docker-stop", after: "q2" }, { drill: "docker-ps-a", after: "q2" }, { drill: "docker-run-named", after: "q3" }, { drill: "docker-build", after: "q3b" }, { drill: "docker-tag", after: "q3b" }],
  ole:  [{ drill: "k-get-nodes", after: "q4" }, { drill: "k-get-pods", after: "q4" }, { drill: "k-describe", after: "q5" }, { drill: "k-create", after: "q6" }, { drill: "k-scale", after: "q6" }, { drill: "k-delete-pod", after: "q7" }, { drill: "k-expose", after: "q7" }, { drill: "k-get-svc", after: "q7" }, { drill: "k-secret", after: "q14" }, { drill: "k-get-secrets", after: "q14" }],
  ada:  [{ drill: "k-apply", after: "q8" }, { drill: "git-status", after: "q18" }, { drill: "git-add", after: "q18" }, { drill: "git-commit", after: "q18" }, { drill: "git-branch", after: "q19" }, { drill: "git-checkout", after: "q19" }, { drill: "git-add-all", after: "q20" }, { drill: "ci-status", after: "q20" }, { drill: "k-secret-tls", after: "q23" }, { drill: "k-get-ingress", after: "q23" }],
  runa: [{ drill: "helm-install", after: "q10" }, { drill: "helm-list", after: "q10" }, { drill: "helm-upgrade", after: "q11" }, { drill: "helm-rollback", after: "q11" }, { drill: "helm-create", after: "q21" }, { drill: "helm-lint", after: "q21" }, { drill: "helm-package", after: "q21" }, { drill: "helm-install-local", after: "q21" }],
  theo: [{ drill: "tf-plan", after: "q12" }, { drill: "tf-state", after: "q13" }],
  juno: [{ drill: "k-logs", after: "q15" }, { drill: "k-describe", after: "q15" }, { drill: "k-rollout", after: "q16" }, { drill: "k-apply-netpol", after: "q22" }, { drill: "k-get-netpol", after: "q22" }, { drill: "k-describe-netpol", after: "q22" }, { drill: "k-delete-netpol", after: "q22" }],
};
