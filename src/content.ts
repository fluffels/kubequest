/* ===== KubeQuest 3.0 – Inhalte =====
 * Kleinschrittiges Lernen: jeder Befehl wird einzeln eingeführt (teach),
 * dann in Zufalls-Varianten geübt (drill), erst dann kommt der nächste.
 * Dazu: Quests, Dialoge, NPCs, Ränge, Shop, Drills, Karteikarten, Events.
 */
import type { Quest } from "./types";

  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

  /* ---------- Ränge (geschlechtsneutral) ---------- */
  const RANKS = [
    { xp: 0,    name: "Landratte",  icon: "🦔" },
    { xp: 110,  name: "Moses",      icon: "🧽" },
    { xp: 280,  name: "Deckshand",  icon: "🧹" },
    { xp: 520,  name: "Matrose",    icon: "⚓" },
    { xp: 820,  name: "Maat",       icon: "🪢" },
    { xp: 1200, name: "Steuermaat", icon: "☸️" },
    { xp: 1700, name: "Navigator",  icon: "🧭" },
    { xp: 2300, name: "Käpt'n",     icon: "🫡" },
    { xp: 3000, name: "Admiral",    icon: "🏅" },
  ];

  /* ---------- Shop ---------- */
  const SHOP = [
    { id: "fernrohr", icon: "🔭", name: "Hinweis-Fernrohr", price: 25, type: "consumable",
      desc: "Zeigt dir beim Funken einen Hinweis zur aktuellen Aufgabe. Einmal benutzbar." },
    { id: "kompass", icon: "🧭", name: "Lösungs-Kompass", price: 50, type: "consumable",
      desc: "Verrät dir beim Funken die komplette Lösung der aktuellen Aufgabe. Einmal benutzbar." },
    { id: "pet-ratte", icon: "🐀", sprite: 124, tex: "pet_ratte", name: "Hafenratte Taki", price: 150, type: "pet",
      desc: "Folgt dir überallhin. Hat schon mehr Häfen gesehen als jeder Admiral." },
    { id: "pet-fledermaus", icon: "🦇", sprite: 120, tex: "pet_fledermaus", name: "Fledermaus Echo", price: 250, type: "pet",
      desc: "Flattert hinter dir her. Findet jeden Weg – auch im Dunkeln." },
    { id: "pet-geist", icon: "👻", sprite: 121, tex: "pet_geist", name: "Archiv-Geist Plotter", price: 400, type: "pet",
      desc: "Spukt seit Jahren im Kartenhaus. Kennt YAML auswendig. Gruselig." },
    { id: "flagge-lila", icon: "🟪", color: 0x9b6bdf, name: "Lila Schiffsflagge", price: 80, type: "flag",
      desc: "Dein Schiff am Pier zeigt Flagge – in Edel-Lila." },
    { id: "flagge-gruen", icon: "🟩", color: 0x6fdc8c, name: "Grüne Schiffsflagge", price: 80, type: "flag",
      desc: "Grün wie ein frisch deploytes Release." },
    { id: "flagge-pirat", icon: "🏴‍☠️", color: 0x202028, name: "Piratenflagge", price: 150, type: "flag",
      desc: "Arrr! Streng genommen nicht erlaubt. Ole drückt ein Auge zu." },
    { id: "kanone", icon: "💣", name: "Hafen-Kanone", price: 300, type: "upgrade",
      desc: "Steht danach am Dock. Piraten-Überfälle bringen dir +50% Kopfgeld." },
  ];

  /* ---------- NPCs ---------- */
  const NPCS = {
    ole:    { name: "Ole",           title: "Hafenmeister",    sprite: 100, tex: "char_ole" },
    bo:     { name: "Bo",            title: "Dock-Golem",      sprite: 109, tex: "char_bo" },
    ada:    { name: "Ada",           title: "Kartenhaus",      sprite: 84,  tex: "char_ada" },
    runa:   { name: "Runa",          title: "Werftchefin",     sprite: 87, tex: "char_runa" },
    theo:   { name: "Theo",          title: "Landvermessung",  sprite: 111, tex: "char_theo" },
    pelle:  { name: "Pelle",         title: "Handelsposten",   sprite: 86, tex: "char_pelle" },
    kralle: { name: "Krabbe Kralle", title: "Quiz-Krabbe",     sprite: 110, tex: "char_kralle" },
    juno:   { name: "Juno",          title: "Sturmwache",      sprite: 97,  tex: "char_juno" },
  };

  const PLAYER_SPRITES = [85, 88, 98, 99, 112, 96];

  /* ---------- Virtuelle Dateien ---------- */
  const DEPLOYMENT_YAML = [
    "apiVersion: apps/v1", "kind: Deployment", "metadata:", "  name: lager", "spec:",
    "  replicas: 2", "  selector:", "    matchLabels:", "      app: lager", "  template:",
    "    metadata:", "      labels:", "        app: lager", "    spec:", "      containers:",
    "        - name: lager", "          image: redis:7", "          ports:", "            - containerPort: 6379",
  ].join("\n");

  const SERVICE_YAML = [
    "apiVersion: v1", "kind: Service", "metadata:", "  name: lager", "spec:",
    "  selector:", "    app: lager", "  ports:", "    - port: 6379",
  ].join("\n");

  const BOESE_CONFIG_YAML = [
    "apiVersion: v1", "kind: ConfigMap", "metadata:", "  name: kasse-config", "data:",
    "  datenbank_host: db.hafen.local", "  # AUTSCH – Passwort im Klartext! Krakenfutter!",
    "  datenbank_passwort: fisch123",
  ].join("\n");

  const MAIN_TF = [
    "terraform {", "  required_providers {", "    hafen = {", "      source = \"kubequest/hafen\"", "    }", "  }", "}",
    "", "# Ein neues Ost-Plateau für Port Kubernia",
    "resource \"hafen_plateau\" \"ost\" {", "  name   = \"ost-erweiterung\"", "  breite = 12", "}",
    "", "# Zwei Server für den wachsenden Cluster",
    "resource \"hafen_server\" \"worker\" {", "  count   = 2", "  name    = \"worker-${count.index + 3}\"", "  groesse = \"mittel\"", "}",
  ].join("\n");

  const GITLAB_CI_YML = [
    "stages:", "  - build", "  - test", "  - deploy", "",
    "build-image:        # baut aus dem Dockerfile ein Docker-Image",
    "  stage: build", "  script:", "    - docker build -t funkdienst:$CI_COMMIT_SHORT_SHA .", "",
    "unit-test:          # prueft den Code, BEVOR etwas live geht",
    "  stage: test", "  script:", "    - npm test", "",
    "deploy-cluster:     # rollt automatisch in den Cluster aus",
    "  stage: deploy", "  script:", "    - kubectl apply -f deployment.yaml",
    "  only:", "    - main          # nur vom main-Branch wird wirklich deployt",
  ].join("\n");

  const DOCKERFILE = [
    "FROM nginx:1.27", "COPY site/ /usr/share/nginx/html", "EXPOSE 80",
  ].join("\n");

  /* =================================================================
   * DRILLS – Zufalls-Übungsaufgaben. Jede Funktion bekommt den Simulator
   * und liefert eine frische Aufgabe (ggf. mit Vorbereitung der Welt).
   * ================================================================= */
  const IMAGES = ["redis", "httpd", "busybox", "postgres", "rabbitmq"];
  const NAMES = ["leuchtfeuer", "fischtheke", "lotsenfunk", "ankerwinde", "kombuese", "seekiste"];

  function ensureDeployment(sim) {
    let d = sim.deployments.find(d => !["kantine"].includes(d.name)) || sim.deployments[0];
    if (!d) {
      const name = pick(NAMES);
      sim.exec("kubectl create deployment " + name + " --image=nginx");
      d = sim.deployments.find(x => x.name === name);
    }
    return d;
  }

  function ensureGit(sim) {
    if (!sim.git.initialized) sim.exec("git init");
  }

  const DRILLS = {
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
      if (!c) { const name = pick(NAMES); sim.exec("docker run -d --name " + name + " nginx"); c = sim.docker.containers.find(x => x.name === name); }
      return { text: "Stoppe den Container <code>" + c.name + "</code>.", accept: [new RegExp("^docker\\s+stop\\s+" + c.name + "$")], solution: "docker stop " + c.name, hint: "Muster: docker stop <name>" };
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
  };

  /* Übungs-Pools pro NPC: freigeschaltet nach bestimmter Quest */
  const PRACTICE = {
    bo:   [{ drill: "docker-pull", after: "q1" }, { drill: "docker-run", after: "q1" }, { drill: "docker-ps", after: "q2" }, { drill: "docker-stop", after: "q2" }, { drill: "docker-ps-a", after: "q2" }, { drill: "docker-run-named", after: "q3" }],
    ole:  [{ drill: "k-get-nodes", after: "q4" }, { drill: "k-get-pods", after: "q4" }, { drill: "k-describe", after: "q5" }, { drill: "k-create", after: "q6" }, { drill: "k-scale", after: "q6" }, { drill: "k-delete-pod", after: "q7" }, { drill: "k-expose", after: "q7" }, { drill: "k-get-svc", after: "q7" }, { drill: "k-secret", after: "q14" }, { drill: "k-get-secrets", after: "q14" }],
    ada:  [{ drill: "k-apply", after: "q8" }, { drill: "git-status", after: "q18" }, { drill: "git-add", after: "q18" }, { drill: "git-commit", after: "q18" }, { drill: "git-branch", after: "q19" }, { drill: "git-checkout", after: "q19" }, { drill: "git-add-all", after: "q20" }, { drill: "ci-status", after: "q20" }],
    runa: [{ drill: "helm-install", after: "q10" }, { drill: "helm-list", after: "q10" }, { drill: "helm-upgrade", after: "q11" }, { drill: "helm-rollback", after: "q11" }],
    theo: [{ drill: "tf-plan", after: "q12" }, { drill: "tf-state", after: "q13" }],
    juno: [{ drill: "k-logs", after: "q15" }, { drill: "k-describe", after: "q15" }, { drill: "k-rollout", after: "q16" }],
  };

  /* =================================================================
   * QUESTS – viele kleine Schritte. Typen:
   *  dialog / choice  – Gespräch
   *  teach            – EIN neuer Befehl: erklärt + selbst tippen
   *  drill            – Zufalls-Übungen aus dem Gelernten
   *  terminal         – feste Aufgabenkette (für Showdowns)
   * ================================================================= */
  const QUESTS: Quest[] = [

    { id: "q0", title: "Anheuern in Port Kubernia", giver: "ole", rewardXp: 15, rewardCoins: 10,
      steps: [
        { type: "dialog", npc: "ole", lines: [
          "Ahoi! Du musst die neue Crew sein. Willkommen in <b>Port Kubernia</b> – dem modernsten Hafen der sieben Meere!",
          "Ich bin Ole, Hafenmeister. Keine Sorge: Hier lernt jede:r in <b>kleinen Schritten</b> – einen Handgriff nach dem anderen, mit viel Übung.",
          "Dein wichtigstes Werkzeug: dein <b>📻 Funkgerät</b>. Drück <b>T</b> und tippe <code>help</code> – mehr nicht!",
        ]},
        { type: "teach", brief: "Funkgerät-Test", cmd: {
          id: "t-help", intro: "🆕 Dein erster Funkspruch!",
          text: "Tippe <code>help</code> und drück Enter.",
          accept: [/^help$/], solution: "help", hint: "Wirklich nur das Wort help." } },
        { type: "dialog", npc: "ole", lines: [
          "Du funkst ja schon wie ein alter Seebär! Geh als Nächstes runter zum <b>Dock im Südwesten</b> zu <b>Bo</b>, unserem Dock-Golem.",
          "Und merk dir: Bei jedem von uns kannst du später jederzeit <b>üben</b> – einfach ansprechen und „Üben“ wählen. Übung füllt den Geldbeutel!",
        ]},
      ]},

    { id: "q1", title: "Die erste Kiste", giver: "bo", rewardXp: 25, rewardCoins: 20,
      steps: [
        { type: "dialog", npc: "bo", lines: [
          "BO. GRÜSST. NEUE CREW. <i>*knirsch*</i> Bo stapelt Fracht. Früher: Chaos – Säcke, Fässer, hundert Formen. Dann kam: <b>DER CONTAINER</b>. Genormte Box. Jeder Kran kann sie heben.",
          "Software genauso: App + alles Drumherum in eine Box → läuft <b>überall gleich</b>. Werkzeug: <b>Docker</b>.",
          "Erster Handgriff: Bauplan holen. Baupläne heißen <b>Images</b> und liegen im Kisten-Supermarkt, der <b>Registry</b>. Bo zeigt: <code>docker pull nginx</code>. Jetzt DU! (T drücken)",
        ]},
        { type: "teach", brief: "Bauplan holen", cmd: {
          id: "t-pull", intro: "🆕 Neuer Befehl: <code>docker pull</code> – lädt ein Image aus der Registry.",
          text: "Lade das Image <code>nginx</code> (ein kleiner Webserver) herunter.",
          accept: [/^docker\s+pull\s+nginx(:\S+)?$/], solution: "docker pull nginx", hint: "Muster: docker pull <image>" } },
        { type: "dialog", npc: "bo", lines: [
          "GUT. Image ist da – das ist nur der <b>Bauplan</b>. Jetzt zum Leben erwecken: <code>docker run</code> baut daraus eine laufende Kiste – einen <b>Container</b>. Schau danach zum Dock!",
        ]},
        { type: "teach", brief: "Kiste starten", cmd: {
          id: "t-run", intro: "🆕 Neuer Befehl: <code>docker run</code> – startet einen Container aus einem Image.",
          text: "Starte einen Container aus dem Image <code>nginx</code>. (Einfachste Form, keine Extras!)",
          accept: [/^docker\s+run\s+nginx(:\S+)?$/], solution: "docker run nginx", hint: "Muster: docker run <image>" } },
        { type: "drill", brief: "Bos Übungsrunde", pool: ["docker-pull", "docker-run"], count: 2,
          intro: "Übung macht den Golem! Zwei schnelle Wiederholungen mit anderen Images:" },
        { type: "choice", npc: "bo", reviewId: "q-ch1-2",
          q: "Bo testet: Image und Container – was ist was?",
          options: [
            { t: "Image = Bauplan/Vorlage, Container = laufende Instanz davon.", ok: true,
              reply: "PERFEKT. Wie Tiefkühlpizza (Image) und Pizza im Ofen (Container). Bo hat jetzt Hunger." },
            { t: "Container = Vorlage, Image = das laufende Programm.", ok: false,
              reply: "ANDERSRUM. Image = Bauplan (pull). Container = läuft (run). Nochmal merken!" },
          ]},
        { type: "dialog", npc: "bo", lines: [
          "Genug für heute. Bo-Regel: <b>Lieber zwei Befehle sicher als zehn halb.</b> Komm wieder, wenn du durchgeatmet hast – oder sprich Bo an und wähle „Üben“.",
        ]},
      ]},

    { id: "q2", title: "Den Überblick behalten", giver: "bo", rewardXp: 30, rewardCoins: 22,
      steps: [
        { type: "dialog", npc: "bo", lines: [
          "ZWEITE LEKTION. Kisten starten kannst du. Aber: Welche laufen gerade? Dafür gibt es <code>docker ps</code> – die Liste aller <b>laufenden</b> Container.",
        ]},
        { type: "teach", brief: "Kisten-Liste", cmd: {
          id: "t-ps", intro: "🆕 Neuer Befehl: <code>docker ps</code> – zeigt laufende Container.",
          text: "Zeig alle laufenden Container an. Die NAMES-Spalte rechts wird gleich wichtig!",
          accept: [/^docker\s+ps$/], solution: "docker ps", hint: "Nur zwei Buchstaben nach docker." } },
        { type: "dialog", npc: "bo", lines: [
          "Siehst du die Namen in der NAMES-Spalte? Docker erfindet welche, wenn du keinen vergibst. Mit dem Namen kannst du eine Kiste gezielt <b>stoppen</b>: <code>docker stop &lt;name&gt;</code>.",
        ]},
        { type: "teach", brief: "Kiste stoppen", cmd: {
          id: "t-stop", intro: "🆕 Neuer Befehl: <code>docker stop</code> – hält einen Container an.",
          text: "Stoppe einen deiner laufenden Container. (Name aus <code>docker ps</code> abtippen!)",
          accept: [/^docker\s+stop\s+\S+$/], check: sim => sim.docker.containers.some(c => !c.running),
          solution: "docker stop <name aus docker ps>", hint: "Erst docker ps für den Namen, dann docker stop <name>." } },
        { type: "dialog", npc: "bo", lines: [
          "WICHTIG: Gestoppt heißt nicht weg! Die Kiste steht noch im Lager. <code>docker ps -a</code> zeigt ALLE – auch gestoppte. Das <code>-a</code> heißt „all“.",
        ]},
        { type: "teach", brief: "Alle Kisten sehen", cmd: {
          id: "t-ps-a", intro: "🆕 Neue Variante: <code>docker ps -a</code> – zeigt auch gestoppte Container.",
          text: "Zeig ALLE Container an. Dein gestoppter müsste mit „Exited“ auftauchen.",
          accept: [/^docker\s+ps\s+(-a|--all)$/], solution: "docker ps -a", hint: "docker ps + Flag für „alle“." } },
        { type: "drill", brief: "Bos Übungsrunde", pool: ["docker-ps", "docker-stop", "docker-ps-a", "docker-run"], count: 3,
          intro: "Drei Wiederholungen, dann sitzt es:" },
        { type: "choice", npc: "bo", reviewId: "q-ch1-4",
          q: "Was zeigt <code>docker ps</code> – ohne Extras?",
          options: [
            { t: "Nur die gerade laufenden Container.", ok: true, reply: "RICHTIG. Für alle (auch gestoppte): docker ps -a. Bo nickt steinern." },
            { t: "Alle Container, die es je gab.", ok: false, reply: "FAST. Das macht docker ps -a. Ohne -a: nur die laufenden." },
          ]},
        { type: "dialog", npc: "bo", lines: [
          "Bo hat eine Überraschung: Sprich Bo nochmal an und wähle <b>🎮 Stapel-Spiel</b>! Da lernst du, wie Images aus <b>Schichten</b> gebaut sind. Macht Spaß. Bo verliert nie. Bo ist Stein.",
        ]},
      ]},

    { id: "q3", title: "Namen und Hintergrund", giver: "bo", rewardXp: 35, rewardCoins: 25,
      steps: [
        { type: "dialog", npc: "bo", lines: [
          "LETZTE DOCKER-LEKTION. Profis geben Kisten <b>eigene Namen</b> (<code>--name</code>) und schicken sie in den <b>Hintergrund</b> (<code>-d</code> wie „detached“), damit das Funkgerät frei bleibt.",
          "Zusammen: <code>docker run -d --name webserver nginx</code>. Sieht lang aus – ist nur run + zwei Extras. Du schaffst das.",
        ]},
        { type: "teach", brief: "Profi-Start", cmd: {
          id: "t-run-named", intro: "🆕 Neue Flags: <code>-d</code> (Hintergrund) und <code>--name</code> (eigener Name).",
          text: "Starte aus <code>nginx</code> einen Container im Hintergrund mit dem Namen <code>webserver</code>.",
          accept: [/^docker\s+run\s+(?=.*-d)(?=.*--name\s+webserver).*nginx(:\S+)?$/], solution: "docker run -d --name webserver nginx",
          hint: "Muster: docker run -d --name <wunschname> <image>" } },
        { type: "drill", brief: "Bos Übungsrunde", pool: ["docker-run-named", "docker-run-named", "docker-stop"], count: 3,
          intro: "Das lange Muster üben wir extra gründlich:" },
        { type: "choice", npc: "bo", reviewId: "q-ch1-1",
          q: "Bos Abschlussfrage: WARUM das alles? Was ist der Kern-Vorteil von Containern?",
          options: [
            { t: "Eine App läuft mit allem Drumherum überall gleich – Laptop, Server, Cloud.", ok: true,
              reply: "RICHTIG. „Bei mir läuft's aber!“ ist Geschichte. <i>*stolzes Steinknirschen*</i>" },
            { t: "Sie machen Apps automatisch schneller.", ok: false,
              reply: "NEIN. Nicht schneller – ÜBERALL GLEICH. Das ist der Schatz." },
          ]},
        { type: "dialog", npc: "bo", lines: [
          "Bo erklärt dich zum <b>Kisten-Profi</b>. <i>*Golem-Applaus*</i> Ole will dich sprechen – es geht um den GROSSEN Umbau. Und vergiss nicht: Üben bei Bo bringt Dublonen!",
        ]},
      ]},

    { id: "q4", title: "Der Hafen wird ein Cluster", giver: "ole", rewardXp: 30, rewardCoins: 22,
      steps: [
        { type: "dialog", npc: "ole", lines: [
          "Bo lobt dich – das passiert alle hundert Jahre! Jetzt die Königsfrage: Eine Kiste kann jeder. Aber <b>hunderte Kisten auf vielen Stegen</b>? Wer startet nachts Ersatz, wenn eine über Bord geht?",
          "Dafür gibt es <b>Kubernetes</b> – griechisch für „Steuermann“, kurz <b>K8s</b>. Schau zum Wasser: Unsere <b>drei Stege</b> sind die <b>Nodes</b> (Arbeits-Server). Alles zusammen: der <b>Cluster</b>.",
          "Dein Funkgerät spricht mit dem Cluster über <code>kubectl</code>. Erster Befehl, ganz harmlos: <code>kubectl get nodes</code> – zeig mir die Stege!",
        ]},
        { type: "teach", brief: "Die Stege zählen", cmd: {
          id: "t-nodes", intro: "🆕 Neuer Befehl: <code>kubectl get nodes</code> – zeigt die Server des Clusters.",
          text: "Zeig die Nodes deines Clusters an. Vergleich mit den Stegen draußen!",
          accept: [/^kubectl\s+get\s+(nodes|node|no)$/], solution: "kubectl get nodes", hint: "Muster: kubectl get <ressourcentyp>" } },
        { type: "dialog", npc: "ole", lines: [
          "Drei Stege, drei Nodes – passt! Und die Fracht? Jede Kiste steht auf einem Liegeplatz namens <b>Pod</b> – der kleinsten Einheit von Kubernetes. Die Bord-Kantine läuft schon. Finde ihre Pods!",
        ]},
        { type: "teach", brief: "Die Fracht finden",
          scenario: { deployments: [{ name: "kantine", image: "nginx:1.27", replicas: 2 }] },
          cmd: {
          id: "t-pods", intro: "🆕 Neuer Befehl: <code>kubectl get pods</code> – zeigt alle Pods.",
          text: "Zeig alle Pods an – und schau dann zum Dock: Die Kisten dort sind GENAU diese Pods!",
          accept: [/^kubectl\s+get\s+(pods|pod|po)$/], solution: "kubectl get pods", hint: "Gleiches Muster wie bei nodes." } },
        { type: "drill", brief: "Oles Übungsrunde", pool: ["k-get-nodes", "k-get-pods"], count: 2,
          intro: "Einmal tief durchatmen und wiederholen:" },
        { type: "choice", npc: "ole", reviewId: "q-ch2-2",
          q: "Kurzer Check: Was ist ein Pod?",
          options: [
            { t: "Die kleinste Einheit in Kubernetes – meist genau ein Container drin.", ok: true,
              reply: "Exakt! Kubernetes verwaltet nie Container direkt, immer Pods – die Liegeplätze mit den Kisten." },
            { t: "Ein anderes Wort für einen Server.", ok: false,
              reply: "Fast-Falle! Der Server ist der <b>Node</b> (Steg). Der Pod ist der kleine Liegeplatz darauf." },
          ]},
        { type: "dialog", npc: "ole", lines: [
          "Ab jetzt siehst du am Dock <b>live</b>, was du im Cluster anrichtest. Übrigens: Deine laufenden Dienste werfen ab sofort <b>🪙 Einnahmen</b> ab – ein gesunder Hafen verdient Geld! Mehr dazu bald.",
        ]},
      ]},

    { id: "q5", title: "Genauer hinsehen", giver: "ole", rewardXp: 30, rewardCoins: 22,
      steps: [
        { type: "dialog", npc: "ole", lines: [
          "Listen sind gut – Details sind besser. Wenn ein Pod zickt, willst du ALLES über ihn wissen: <code>kubectl describe pod &lt;name&gt;</code>. Das ist DER Debugging-Befehl, den du später täglich brauchst.",
        ]},
        { type: "teach", brief: "Pod-Akte öffnen", cmd: {
          id: "t-describe", intro: "🆕 Neuer Befehl: <code>kubectl describe pod &lt;name&gt;</code> – alle Details + Ereignisse.",
          text: "Beschreibe einen <code>kantine</code>-Pod. (Name per <code>kubectl get pods</code> holen und abtippen – das Abtippen trainiert!)",
          accept: [/^kubectl\s+describe\s+pods?\s+kantine-\S+$/], solution: "kubectl describe pod <name aus get pods>",
          hint: "Erst kubectl get pods, dann kubectl describe pod <name>." } },
        { type: "dialog", npc: "ole", lines: [
          "Unten in den <b>Events</b> steht die Lebensgeschichte des Pods – Gold wert bei der Fehlersuche! Eins noch: Kubernetes selbst läuft AUCH als Pods, versteckt im Namespace <code>kube-system</code>.",
        ]},
        { type: "teach", brief: "Hinter die Kulissen", cmd: {
          id: "t-ns", intro: "🆕 Neue Flag: <code>-n &lt;namespace&gt;</code> – in einen anderen Namespace schauen.",
          text: "Zeig die Pods im Namespace <code>kube-system</code> – das Maschinenherz von Kubernetes.",
          accept: [/^kubectl\s+get\s+(pods|pod|po)\s+(-n|--namespace)[=\s]?kube-system$/], solution: "kubectl get pods -n kube-system",
          hint: "kubectl get pods -n kube-system" } },
        { type: "drill", brief: "Oles Übungsrunde", pool: ["k-describe", "k-get-pods", "k-get-nodes"], count: 3,
          intro: "Wiederholen, bis die Finger es allein können:" },
        { type: "choice", npc: "ole", reviewId: "q-ch2-3",
          q: "Und was war nochmal ein Node?",
          options: [
            { t: "Ein einzelner Server (Steg), der Pods ausführt – mehrere Nodes bilden den Cluster.", ok: true,
              reply: "Sitzt! Cluster = Hafen, Node = Steg, Pod = Liegeplatz. Diese drei Begriffe trägst du jetzt für immer bei dir." },
            { t: "Ein besonders großer Pod.", ok: false,
              reply: "Nein – andersrum wird's richtig: Auf einem Node (Steg) stehen viele Pods (Liegeplätze)." },
          ]},
      ]},

    { id: "q6", title: "Der Dauerauftrag", giver: "ole", rewardXp: 35, rewardCoins: 25,
      steps: [
        { type: "dialog", npc: "ole", lines: [
          "Jetzt wird's mächtig. Unbequeme Wahrheit: <b>Pods sind sterblich.</b> Deshalb erstellt man sie nie einzeln, sondern gibt einen Dauerauftrag: ein <b>Deployment</b>.",
          "Ein Deployment sagt: „Halte IMMER N Kopien am Laufen.“ Stirbt eine → sofort Ersatz. Erstellt wird es so: <code>kubectl create deployment kasse --image=nginx</code>.",
        ]},
        { type: "teach", brief: "Dauerauftrag erteilen", cmd: {
          id: "t-create", intro: "🆕 Neuer Befehl: <code>kubectl create deployment</code> – der Dauerauftrag.",
          text: "Erstelle ein Deployment <code>kasse</code> mit dem Image <code>nginx</code>. (Der Fischmarkt braucht eine Kasse!)",
          accept: [/^kubectl\s+create\s+deployment\s+kasse\s+--image[=\s]nginx(:\S+)?$/], solution: "kubectl create deployment kasse --image=nginx",
          hint: "Muster: kubectl create deployment <name> --image=<image>" } },
        { type: "dialog", npc: "ole", lines: [
          "Eine Kasse läuft! Aber bei Hochbetrieb brauchen wir mehr. Das Beste am Deployment: <b>Skalieren ist ein Einzeiler</b> – du änderst nur die Wunsch-Zahl.",
        ]},
        { type: "teach", brief: "Hochskalieren", cmd: {
          id: "t-scale", intro: "🆕 Neuer Befehl: <code>kubectl scale</code> – Anzahl der Kopien ändern.",
          text: "Skaliere <code>kasse</code> auf <b>3</b> Kopien – und beobachte das Dock!",
          accept: [/^kubectl\s+scale\s+deployment\s+kasse\s+--replicas[=\s]3$/], solution: "kubectl scale deployment kasse --replicas=3",
          hint: "Muster: kubectl scale deployment <name> --replicas=<zahl>" } },
        { type: "drill", brief: "Oles Übungsrunde", pool: ["k-create", "k-scale", "k-scale"], count: 3,
          intro: "Skalieren muss in Fleisch und Blut übergehen:" },
        { type: "choice", npc: "ole", reviewId: "q-ch3-1",
          q: "Warum Pods über ein Deployment erstellen statt direkt?",
          options: [
            { t: "Pods sind sterblich – das Deployment ersetzt sie automatisch und hält die Anzahl.", ok: true,
              reply: "Genau. Der Dauerauftrag arbeitet, während du schläfst. Morgen zeige ich dir den Beweis … 😏" },
            { t: "Einzelne Pods sind teurer.", ok: false,
              reply: "Nicht ganz – es geht um Automatik: Das Deployment hält den Soll-Zustand, auch nachts um 3." },
          ]},
      ]},

    { id: "q7", title: "Der Sturm-Test", giver: "ole", rewardXp: 45, rewardCoins: 35,
      steps: [
        { type: "dialog", npc: "ole", lines: [
          "Heute beweise ich dir das <b>Self-Healing</b>. Dein Auftrag klingt verrückt: <b>Versenke eine deiner eigenen Kassen-Kisten.</b> Im Ernst! Und schau dabei zum Dock.",
        ]},
        { type: "terminal", brief: "Der Sturm-Test", tasks: [
          { id: "t-storm-1", text: "Hol dir mit <code>kubectl get pods</code> die Namen der <code>kasse</code>-Pods.",
            accept: [/^kubectl\s+get\s+(pods|pod|po)$/], solution: "kubectl get pods", hint: "Kennst du längst!" },
          { id: "t-storm-2", text: "💥 Lösche einen <code>kasse</code>-Pod – Dock im Blick behalten!",
            accept: [/^kubectl\s+delete\s+pods?\s+kasse-\S+$/], solution: "kubectl delete pod <kasse-pod-name>", hint: "kubectl delete pod <name>" },
          { id: "t-storm-3", text: "Platsch – und der Kran war schneller! Prüfe: Es müssten wieder 3 sein, einer ganz frisch (kleines AGE).",
            accept: [/^kubectl\s+get\s+(pods|pod|po)$/], check: sim => sim.lastDeletedPod !== null, solution: "kubectl get pods", hint: "Nochmal die Pod-Liste." },
        ]},
        { type: "dialog", npc: "ole", lines: [
          "DAS ist Kubernetes! Soll: 3. Ist: 2. → Differenz sofort behoben. Ein letztes Puzzlestück fehlt: Neue Pods bekommen neue Namen und Adressen. Wie sollen Kund:innen die Kasse finden?",
          "Mit einem <b>Service</b> – einer festen Adresse vor den wechselnden Pods. Wie ein Empfangstresen: Die Person dahinter wechselt, der Tresen bleibt.",
        ]},
        { type: "teach", brief: "Feste Adresse", cmd: {
          id: "t-expose", intro: "🆕 Neuer Befehl: <code>kubectl expose</code> – stellt einen Service vor ein Deployment.",
          text: "Stelle einen Service vor <code>kasse</code>, Port <b>80</b>. Draußen geht eine Laterne an!",
          accept: [/^kubectl\s+expose\s+deployment\s+kasse\s+--port[=\s]80(\s.*)?$/], solution: "kubectl expose deployment kasse --port=80",
          hint: "Muster: kubectl expose deployment <name> --port=80" } },
        { type: "teach", brief: "Service-Liste", cmd: {
          id: "t-getsvc", intro: "🆕 Neuer Befehl: <code>kubectl get services</code> – alle festen Adressen.",
          text: "Zeig die Services an – deine <code>kasse</code> hat jetzt eine feste CLUSTER-IP.",
          accept: [/^kubectl\s+get\s+(services|service|svc)$/], check: sim => sim.services.some(s => s.name === "kasse"),
          solution: "kubectl get services", hint: "Kurzform svc geht auch." } },
        { type: "drill", brief: "Oles Übungsrunde", pool: ["k-delete-pod", "k-expose", "k-get-svc"], count: 3,
          intro: "Der ganze Werkzeugkasten einmal durch:" },
        { type: "choice", npc: "ole", reviewId: "q-ch3-3",
          q: "Wozu der Service nochmal?",
          options: [
            { t: "Feste, stabile Adresse vor den Pods – deren Namen und IPs wechseln ständig.", ok: true,
              reply: "Sauber! Und WICHTIG: Ab jetzt verdienen deine Services draußen richtig Dublonen. Gesunder Cluster = volle Kasse. Aber Vorsicht … es gibt Gerüchte über <b>Piraten</b> in der Gegend. 🏴‍☠️" },
            { t: "Der Service startet abgestürzte Pods neu.", ok: false,
              reply: "Das macht das Deployment! Der Service ist nur der Empfangstresen davor – die feste Adresse." },
          ]},
      ]},

    { id: "q8", title: "Adas Seekarten", giver: "ada", rewardXp: 45, rewardCoins: 32,
      steps: [
        { type: "dialog", npc: "ada", lines: [
          "Pssst! Hier wird nicht gebrüllt. Du rufst dem Cluster alles einzeln zu, hm? <code>create</code> hier, <code>scale</code> da … Das ist <b>imperativ</b>. Tssss.",
          "Profis <b>zeichnen Karten</b>: den Wunschzustand in eine Datei. Das ist <b>deklarativ</b> – und die Datei kann in <b>Git</b> liegen! Diese Karten heißen <b>Manifeste</b>, geschrieben in <b>YAML</b>.",
          "Vier Stammdaten hat jedes Manifest: <code>apiVersion</code>, <code>kind</code>, <code>metadata</code>, <code>spec</code>. Und: Einrückung mit <b>Leerzeichen, NIEMALS Tabs</b>. Ich habe dir zwei Karten hingelegt – schau sie dir an!",
        ]},
        { type: "terminal", brief: "Karten lesen",
          scenario: {
            files: { "deployment.yaml": DEPLOYMENT_YAML, "service.yaml": SERVICE_YAML },
            applyEffects: {
              "deployment.yaml": { deployment: { name: "lager", image: "redis:7", replicas: 2 } },
              "service.yaml": { service: { name: "lager", port: "6379" } },
            },
          },
          tasks: [
          { id: "t-ada-1", text: "Schau mit <code>ls</code> nach, was Ada dir hingelegt hat.", accept: [/^ls$/], solution: "ls", hint: "Zwei Buchstaben." },
          { id: "t-ada-2", text: "Lies <code>deployment.yaml</code> mit <code>cat</code>. Findest du <code>kind</code> und <code>replicas</code>?", accept: [/^cat\s+deployment\.yaml$/], solution: "cat deployment.yaml", hint: "cat <datei>" },
        ]},
        { type: "teach", brief: "Karte anwenden", cmd: {
          id: "t-apply", intro: "🆕 Neuer Befehl: <code>kubectl apply -f</code> – „Stelle her, was in der Datei steht.“",
          text: "Wende <code>deployment.yaml</code> auf den Cluster an – und schau zum Dock!",
          accept: [/^kubectl\s+apply\s+-f\s+deployment\.yaml$/], solution: "kubectl apply -f deployment.yaml", hint: "kubectl apply -f <datei>" } },
        { type: "terminal", brief: "Adas Doppeltrick", tasks: [
          { id: "t-ada-3", text: "Wende auch <code>service.yaml</code> an.", accept: [/^kubectl\s+apply\s+-f\s+service\.yaml$/], solution: "kubectl apply -f service.yaml", hint: "Gleicher Befehl, andere Datei." },
          { id: "t-ada-4", text: "Adas Lieblingstrick: Denselben apply <b>nochmal</b> – nichts passiert doppelt („unchanged“)!",
            accept: [/^kubectl\s+apply\s+-f\s+deployment\.yaml$/], solution: "kubectl apply -f deployment.yaml", hint: "Wirklich nochmal exakt derselbe Befehl." },
        ]},
        { type: "choice", npc: "ada", reviewId: "q-ch4-4",
          q: "Du wendest dieselbe Karte zweimal an. Was passiert beim zweiten Mal?",
          options: [
            { t: "Nichts Schlimmes – „unchanged“, alles stimmt ja schon.", ok: true,
              reply: "Wunderbar! apply vergleicht Soll mit Ist und tut nur das Nötige. Das nennt man <b>idempotent</b>. Mein Lieblingswort." },
            { t: "Alles wird doppelt erstellt.", ok: false,
              reply: "Nein! apply gleicht Soll und Ist ab. Schon da? Dann: „unchanged“. Deshalb ist es so sicher." },
          ]},
        { type: "dialog", npc: "ada", lines: [
          "Merke: <b>Wunschzustand aufschreiben, System stellt ihn her.</b> Das Prinzip kommt wieder – frag mal <b>Runa in der Werft</b>. Sie hat ein … Steuerrad-Problem. <i>*kichert*</i>",
        ]},
      ]},

    { id: "q9", title: "Das Steuerrad", giver: "runa", rewardXp: 35, rewardCoins: 25,
      steps: [
        { type: "dialog", npc: "runa", lines: [
          "Ahoi! Runa, Werftchefin. Lass mich raten – bei <b>Helm</b> dachtest du an das Ding für den Kopf? HA! Helm ist Englisch für <b>Steuerrad</b> – und der <b>Paketmanager für Kubernetes</b>.",
          "Bei Ada: 2 Karten für eine Mini-App. Eine ECHTE App: 30 Manifeste, mal drei Umgebungen. 90 Dateien?! NIEMALS. Helm bündelt alles in ein <b>Chart</b> – ein Paket mit Drehknöpfen.",
          "Charts liegen in <b>Repos</b> (wie Docker Hub für Images). Schritt eins: ein Repo hinzufügen.",
        ]},
        { type: "teach", brief: "Chart-Quelle anzapfen", cmd: {
          id: "t-repoadd", intro: "🆕 Neuer Befehl: <code>helm repo add</code> – eine Chart-Quelle hinzufügen.",
          text: "Füge das Repo <code>bitnami</code> hinzu (URL: <code>https://charts.bitnami.com/bitnami</code>).",
          accept: [/^helm\s+repo\s+add\s+bitnami\s+https:\/\/charts\.bitnami\.com\/bitnami$/], solution: "helm repo add bitnami https://charts.bitnami.com/bitnami",
          hint: "Muster: helm repo add <name> <url>" } },
        { type: "terminal", brief: "Stöbern", tasks: [
          { id: "t-runa-1", text: "Aktualisiere die Repo-Infos mit <code>helm repo update</code>.", accept: [/^helm\s+repo\s+update$/], solution: "helm repo update", hint: "helm repo …" },
          { id: "t-runa-2", text: "Suche mit <code>helm search repo nginx</code> nach einem Webserver-Chart.", accept: [/^helm\s+search\s+repo\s+nginx$/], solution: "helm search repo nginx", hint: "helm search repo <begriff>" },
        ]},
        { type: "choice", npc: "runa", reviewId: "q-ch5-1",
          q: "Einmal festnageln: Was IST Helm?",
          options: [
            { t: "Der Paketmanager für Kubernetes – installiert komplette Apps als Charts.", ok: true,
              reply: "Genau! Wie ein App-Store für den Cluster. Morgen hissen wir die erste Flagge!" },
            { t: "Ein Kopfschutz für die Werft.", ok: false,
              reply: "HA! Reingefallen. Steuerrad! Paketmanager! Schau aufs Logo!" },
          ]},
      ]},

    { id: "q10", title: "Flagge hissen", giver: "runa", rewardXp: 40, rewardCoins: 30,
      steps: [
        { type: "dialog", npc: "runa", lines: [
          "Jetzt wird installiert! Eine Installation eines Charts heißt <b>Release</b> und bekommt einen eigenen Namen. Für jedes Release weht hier an der Werft eine <b>Flagge</b> – gleich siehst du's!",
        ]},
        { type: "teach", brief: "Erste Installation", cmd: {
          id: "t-install", intro: "🆕 Neuer Befehl: <code>helm install</code> – ein Chart als Release installieren.",
          text: "Installiere <code>bitnami/nginx</code> als Release <code>mein-web</code>. Flaggen-Blick zur Werft!",
          accept: [/^helm\s+install\s+mein-web\s+bitnami\/nginx$/], solution: "helm install mein-web bitnami/nginx",
          hint: "Muster: helm install <release-name> <repo>/<chart>" } },
        { type: "terminal", brief: "Was ist da passiert?", tasks: [
          { id: "t-runa-3", text: "Zeig die Releases mit <code>helm list</code>.", accept: [/^helm\s+(list|ls)$/], solution: "helm list", hint: "Englisch für „auflisten“." },
          { id: "t-runa-4", text: "Und jetzt der Aha-Moment: Schau mit <b>kubectl</b> nach den Pods – Helm hat ganz normale Kubernetes-Ressourcen gebaut!",
            accept: [/^kubectl\s+get\s+(pods|pod|po)$/], check: sim => sim.releases.length > 0, solution: "kubectl get pods", hint: "Kennst du im Schlaf." },
        ]},
        { type: "drill", brief: "Runas Übungsrunde", pool: ["helm-install", "helm-list"], count: 2,
          intro: "Noch ein Release zum Festigen – mehr Flaggen!" },
        { type: "choice", npc: "runa", reviewId: "q-ch5-2",
          q: "Chart und Release – was ist der Unterschied?",
          options: [
            { t: "Chart = das Paket (Vorlage), Release = eine installierte Instanz davon.", ok: true,
              reply: "Sauber! Wie Image und Container bei Docker. Ein Chart, viele Releases, viele Flaggen!" },
            { t: "Release = die Vorlage, Chart = die Installation.", ok: false,
              reply: "Andersrum: Das Chart liegt im Regal, das Release weht am Mast." },
          ]},
      ]},

    { id: "q11", title: "Auf und ab", giver: "runa", rewardXp: 45, rewardCoins: 35,
      steps: [
        { type: "dialog", npc: "runa", lines: [
          "Heute das Beste an Helm. Apps ändern sich: mehr Kopien, neue Version … Dafür gibt's <code>helm upgrade</code> mit <code>--set</code> – die Drehknöpfe aus <code>values.yaml</code> direkt verstellen.",
        ]},
        { type: "teach", brief: "Drehknopf verstellen", cmd: {
          id: "t-upgrade", intro: "🆕 Neuer Befehl: <code>helm upgrade --set</code> – ein Release ändern.",
          text: "Stelle <code>mein-web</code> per <code>--set replicaCount=3</code> auf 3 Kopien.",
          accept: [/^helm\s+upgrade\s+mein-web\s+bitnami\/nginx\s+--set\s+replicaCount=3$/], solution: "helm upgrade mein-web bitnami/nginx --set replicaCount=3",
          hint: "Muster: helm upgrade <release> <chart> --set replicaCount=3" } },
        { type: "dialog", npc: "runa", lines: [
          "Und wenn ein Upgrade alles kaputt macht? <b>Keine Panik!</b> Helm merkt sich jede Revision. <code>helm rollback</code> bringt dich zurück. Dieser Befehl hat mir mal ein Wochenende gerettet.",
        ]},
        { type: "teach", brief: "Der Lebensretter", cmd: {
          id: "t-rollback", intro: "🆕 Neuer Befehl: <code>helm rollback</code> – zurück zu einer früheren Revision.",
          text: "Befehl von oben: doch wieder zurück! Rolle <code>mein-web</code> auf Revision <b>1</b>.",
          accept: [/^helm\s+rollback\s+mein-web(\s+1)?$/], solution: "helm rollback mein-web 1", hint: "Muster: helm rollback <release> <revision>" } },
        { type: "teach", brief: "Aufräumen", cmd: {
          id: "t-uninstall", intro: "🆕 Neuer Befehl: <code>helm uninstall</code> – Release komplett entfernen.",
          text: "Übung vorbei: Deinstalliere <code>mein-web</code>. (Die Flagge wird eingeholt …)",
          accept: [/^helm\s+uninstall\s+mein-web$/], solution: "helm uninstall mein-web", hint: "Das Gegenteil von install." } },
        { type: "drill", brief: "Runas Übungsrunde", pool: ["helm-upgrade", "helm-rollback"], count: 2,
          intro: "Upgrade & Rollback – das Power-Duo, nochmal:" },
        { type: "choice", npc: "runa", reviewId: "q-ch5-4",
          q: "Dein Upgrade hat alles zerschossen. Panik?",
          options: [
            { t: "Nein – helm rollback bringt das Release auf eine frühere Revision zurück.", ok: true,
              reply: "Eingebrannt! Revisions-Historie = dein Sicherheitsnetz. Jetzt ab zu <b>Theo</b> östlich vom Markt – der Rat plant GROSSES." },
            { t: "Ja – Cluster löschen und neu aufsetzen.", ok: false,
              reply: "Bloß nicht! helm rollback <release> <revision> – zwei Sekunden, gerettet." },
          ]},
      ]},

    { id: "q12", title: "Neues Land", giver: "theo", rewardXp: 45, rewardCoins: 35,
      steps: [
        { type: "dialog", npc: "theo", lines: [
          "Die Funk-Legende persönlich! Theo, Landvermessung. Eine Frage: Wer hat eigentlich den Hafen <b>gebaut</b>, auf dem deine Kisten stehen?",
          "Früher: zusammengeklickt und vergessen. Heute: <b>Infrastructure as Code</b> – die ganze Infrastruktur als Textdatei! Werkzeug: <b>Terraform</b>. Deklarativ, wie Adas Karten – nur baut es <b>den Hafen selbst</b>.",
          "Der Bauplan für die Ost-Erweiterung liegt schon da. Drei Schritte trennen uns von neuem Land: <code>init</code> → <code>plan</code> → <code>apply</code>. Eins nach dem anderen!",
        ]},
        { type: "terminal", brief: "Bauplan lesen",
          scenario: {
            files: { "main.tf": MAIN_TF },
            tfResources: [
              { addr: "hafen_plateau.ost", desc: 'name = "ost-erweiterung"' },
              { addr: "hafen_server.worker[0]", desc: 'name = "worker-3"' },
              { addr: "hafen_server.worker[1]", desc: 'name = "worker-4"' },
            ],
          },
          tasks: [
          { id: "t-theo-1", text: "Lies den Bauplan: <code>cat main.tf</code>. Wie viele <code>resource</code>-Blöcke siehst du?", accept: [/^cat\s+main\.tf$/], solution: "cat main.tf", hint: "Wie bei Ada." },
        ]},
        { type: "teach", brief: "Werkzeug laden", cmd: {
          id: "t-init", intro: "🆕 Neuer Befehl: <code>terraform init</code> – lädt die Provider-Plugins. Immer Schritt 1!",
          text: "Initialisiere das Projekt.",
          accept: [/^terraform\s+init$/], solution: "terraform init", hint: "Der allererste Befehl jedes Terraform-Projekts." } },
        { type: "teach", brief: "Generalprobe", cmd: {
          id: "t-plan", intro: "🆕 Neuer Befehl: <code>terraform plan</code> – zeigt, was passieren WÜRDE. Profis lesen IMMER erst den Plan!",
          text: "Lass dir den Plan zeigen – ohne dass etwas passiert.",
          accept: [/^terraform\s+plan$/], solution: "terraform plan", hint: "Die Generalprobe." } },
        { type: "choice", npc: "theo", reviewId: "q-ch6-2",
          q: "Bevor du baust – plan vs. apply?",
          options: [
            { t: "plan zeigt nur, was passieren würde – apply führt es wirklich aus.", ok: true,
              reply: "Korrekt! Und jetzt … BAU DAS LAND! Ich kann nicht hinsehen. Doch. Ich sehe hin!" },
            { t: "plan ist für kleine, apply für große Projekte.", ok: false,
              reply: "Nein: plan = Generalprobe (passiert nichts), apply = Aufführung. IMMER in der Reihenfolge." },
          ]},
        { type: "teach", brief: "LAND IN SICHT!", cmd: {
          id: "t-apply-tf", intro: "🆕 Neuer Befehl: <code>terraform apply</code> – der Plan wird Wirklichkeit.",
          text: "Baue die Ost-Erweiterung – und schau nach Osten aufs Wasser!! 🏗️",
          accept: [/^terraform\s+apply(\s+-auto-approve)?$/], solution: "terraform apply", hint: "Nach der Generalprobe die Aufführung." } },
        { type: "dialog", npc: "theo", lines: [
          "DA! NEUES LAND! Du hast mit einer TEXTDATEI eine Insel gebaut! <i>*wischt sich eine Träne weg*</i> Geh ruhig mal drauf spazieren. Morgen zeige ich dir Terraforms Gedächtnis.",
        ]},
      ]},

    { id: "q13", title: "Gedächtnis und Abriss", giver: "theo", rewardXp: 45, rewardCoins: 35,
      steps: [
        { type: "dialog", npc: "theo", lines: [
          "Terraform führt Buch über alles, was es gebaut hat: den <b>State</b> – sein Gedächtnis. Beim nächsten plan vergleicht es: Was steht in den Dateien (Soll)? Was existiert (Ist)? Nur die <b>Differenz</b> wird umgesetzt.",
        ]},
        { type: "teach", brief: "Ins Gedächtnis schauen", cmd: {
          id: "t-state", intro: "🆕 Neuer Befehl: <code>terraform state list</code> – was steht im Gedächtnis?",
          text: "Zeig den State an – alle drei gebauten Ressourcen sollten drinstehen.",
          accept: [/^terraform\s+state\s+list$/], solution: "terraform state list", hint: "terraform state …" } },
        { type: "terminal", brief: "Der Beweis", tasks: [
          { id: "t-theo-2", text: "Führe nochmal <code>terraform plan</code> aus. Es muss „No changes“ melden – Soll = Ist!",
            accept: [/^terraform\s+plan$/], check: sim => sim.tf.applied, solution: "terraform plan", hint: "Einfach nochmal plan." },
        ]},
        { type: "teach", brief: "Kontrollierter Abriss", cmd: {
          id: "t-destroy", intro: "🆕 Neuer Befehl: <code>terraform destroy</code> – reißt ALLES wieder ab, was Terraform gebaut hat.",
          text: "Der Rat baut erst nächstes Jahr, und Übungs-Land kostet Miete: Reiß die Erweiterung ab!",
          accept: [/^terraform\s+destroy(\s+-auto-approve)?$/], solution: "terraform destroy", hint: "Das Gegenteil von apply." } },
        { type: "choice", npc: "theo", reviewId: "q-ch6-3",
          q: "Was ist der Terraform-State?",
          options: [
            { t: "Terraforms Gedächtnis: eine Datei mit allem, was es bereits gebaut hat.", ok: true,
              reply: "Perfekt! Soll (Dateien) vs. Ist (State) → nur die Differenz wird gebaut. Du hast den ganzen Zyklus drauf: init → plan → apply → destroy!" },
            { t: "Das Fehlerprotokoll von Terraform.", ok: false,
              reply: "Nein – das Gedächtnis! Es weiß, was schon existiert. Deshalb meldete plan eben „No changes“." },
          ]},
        { type: "dialog", npc: "theo", lines: [
          "Docker, Kubernetes, YAML, Helm, Terraform – fast geschafft! Eine Sache fehlt noch, und sie ist <b>brandgefährlich</b>. Ole wartet schon. Es geht um … die <b>Krake</b>. 🐙",
        ]},
      ]},

    { id: "q14", title: "Die Hacker-Krake", giver: "ole", rewardXp: 60, rewardCoins: 50,
      steps: [
        { type: "dialog", npc: "ole", lines: [
          "Schlechte Nachrichten. In den Gewässern lauert die <b>Hacker-Krake</b> 🐙 – sie liest ALLES mit, was unverschlüsselt im Cluster liegt. Und jetzt rate, was ich in unserer Konfiguration gefunden habe …",
          "Ein <b>Passwort im Klartext</b>! In einer ConfigMap! Schau es dir an – mit <code>cat boese-config.yaml</code> – und schäm dich stellvertretend für uns alle.",
        ]},
        { type: "terminal", brief: "Das Leck finden",
          scenario: { files: { "boese-config.yaml": BOESE_CONFIG_YAML } },
          tasks: [
          { id: "t-ole-sec1", text: "Lies <code>boese-config.yaml</code>. Siehst du das Problem?",
            accept: [/^cat\s+boese-config\.yaml$/], solution: "cat boese-config.yaml", hint: "cat <datei>" },
        ]},
        { type: "dialog", npc: "ole", lines: [
          "<code>datenbank_passwort: fisch123</code> – Krakenfutter! Die Regel lautet: <b>Vertrauliches gehört NIE in YAML-Dateien oder ConfigMaps.</b> Dafür gibt es <b>Secrets</b> – Kubernetes' Schatztruhen.",
        ]},
        { type: "teach", brief: "Die Schatztruhe", cmd: {
          id: "t-secret", intro: "🆕 Neuer Befehl: <code>kubectl create secret generic</code> – Vertrauliches sicher ablegen.",
          text: "Lege ein Secret <code>db-zugang</code> an, mit <code>--from-literal=passwort=tintenfisch88</code>.",
          accept: [/^kubectl\s+create\s+secret\s+generic\s+db-zugang\s+--from-literal[=\s][\w.-]+=\S+$/],
          solution: "kubectl create secret generic db-zugang --from-literal=passwort=tintenfisch88",
          hint: "Muster: kubectl create secret generic <name> --from-literal=schluessel=wert" } },
        { type: "teach", brief: "Truhen zählen", cmd: {
          id: "t-getsecrets", intro: "🆕 Neuer Befehl: <code>kubectl get secrets</code> – alle Schatztruhen anzeigen.",
          text: "Zeig die Secrets an. Beachte: Den INHALT zeigt die Liste nicht – genau das ist der Punkt!",
          accept: [/^kubectl\s+get\s+(secrets|secret)$/], solution: "kubectl get secrets", hint: "kubectl get …" } },
        { type: "drill", brief: "Sicherheits-Drill", pool: ["k-secret", "k-get-secrets"], count: 2,
          intro: "Sicherheit muss sitzen – zwei Wiederholungen:" },
        { type: "choice", npc: "ole", reviewId: "q-sec-1",
          q: "Wohin gehören Passwörter und API-Schlüssel im Cluster?",
          options: [
            { t: "In Secrets – niemals im Klartext in YAML-Dateien oder ConfigMaps.", ok: true,
              reply: "DAS rettet Häfen! Die Krake wird trotzdem immer wieder angreifen – aber jetzt weißt du, wie man sie vertreibt." },
            { t: "In die ConfigMap, da sind sie übersichtlich.", ok: false,
              reply: "NEIN! ConfigMaps sind Klartext – Krakenfutter! Vertrauliches gehört in Secrets." },
          ]},
        { type: "dialog", npc: "ole", lines: [
          "Damit erkläre ich deine <b>Grundausbildung für abgeschlossen</b>! 🎉 Docker, Kubernetes, YAML, Helm, Terraform, Security – du hast den ganzen Werkzeugkasten.",
          "Aber Port Kubernia schläft nie: <b>Piraten</b> überfallen die Stege, die <b>Krake</b> schnüffelt nach Klartext, und deine Dienste verdienen rund um die Uhr. Halte den Hafen am Laufen!",
          "Und … hörst du das Donnergrollen? Die <b>Sturm-Saison</b> beginnt. <b>Juno</b>, unsere Sturmwache am Leuchtturm im Osten, braucht dringend jemanden, der kaputte Dienste reparieren kann. Geh zu ihr – jetzt wird es ernst! ⛈️",
        ]},
      ]},

    /* ========== STURM-SAISON: Troubleshooting wie im echten Betrieb ========== */

    { id: "q15", title: "Sturmwarnung am Leuchtturm", giver: "juno", rewardXp: 50, rewardCoins: 40,
      steps: [
        { type: "dialog", npc: "juno", lines: [
          "Da bist du ja endlich! Juno, Sturmwache. Während die anderen dir beigebracht haben, Dinge zu <b>bauen</b>, lernst du bei mir, sie zu <b>reparieren</b> – das ist die halbe Miete in diesem Job.",
          "Der Sturm letzte Nacht hat das <b>leuchtfeuer</b>-Deployment erwischt. Erste Debugging-Regel: <b>STATUS lesen, nicht raten.</b> Schau dir die Pods an!",
        ]},
        { type: "terminal", brief: "Diagnose",
          scenario: { deployments: [{ name: "leuchtfeuer", image: "ngnix:latest", replicas: 1, broken: { type: "imagepull", badImage: "ngnix:latest" } }] },
          tasks: [
          { id: "t-j15-1", text: "Zeig die Pods – und lies die STATUS-Spalte genau!",
            accept: [/^kubectl\s+get\s+(pods|pod|po)$/], solution: "kubectl get pods", hint: "Der Übersichts-Befehl." },
          { id: "t-j15-2", text: "<code>ImagePullBackOff</code>! Zweite Regel: <b>describe lesen.</b> Beschreibe den <code>leuchtfeuer</code>-Pod und lies die Events ganz unten.",
            accept: [/^kubectl\s+describe\s+pods?\s+leuchtfeuer-\S+$/], solution: "kubectl describe pod <leuchtfeuer-pod>", hint: "kubectl describe pod <name> – Name aus get pods." },
        ]},
        { type: "choice", npc: "juno", reviewId: "q-ts-2",
          q: "In den Events steht: Failed to pull image „ngnix:latest“ – repository does not exist. Was ist die Ursache?",
          options: [
            { t: "Ein Tippfehler im Image-Namen: „ngnix“ statt „nginx“!", ok: true,
              reply: "Scharfes Auge! ImagePullBackOff heißt fast immer: Tippfehler im Namen, falscher Tag oder fehlende Zugriffsrechte auf die Registry." },
            { t: "Der Node ist kaputt.", ok: false,
              reply: "Nein – lies die Events nochmal: Das IMAGE kann nicht geladen werden. „ngnix“ … fällt dir was auf? Tippfehler!" },
            { t: "Zu wenig Speicher im Cluster.", ok: false,
              reply: "Das wäre ein anderes Fehlerbild (Pending/OOM). Hier steht klar: repository does not exist – das Image „ngnix“ gibt es nicht. Tippfehler!" },
          ]},
        { type: "teach", brief: "Die Reparatur", cmd: {
          id: "t-setimage", intro: "🆕 Neuer Befehl: <code>kubectl set image</code> – tauscht das Image eines Deployments aus.",
          text: "Setze das richtige Image: <code>kubectl set image deployment/leuchtfeuer leuchtfeuer=nginx</code>",
          accept: [/^kubectl\s+set\s+image\s+deployment\/leuchtfeuer\s+\S+=nginx(:\S+)?$/],
          solution: "kubectl set image deployment/leuchtfeuer leuchtfeuer=nginx",
          hint: "Muster: kubectl set image deployment/<name> <container>=<richtiges-image>" } },
        { type: "terminal", brief: "Verifizieren", tasks: [
          { id: "t-j15-3", text: "Dritte Regel: <b>Fix immer verifizieren!</b> Laufen die Pods wieder?",
            accept: [/^kubectl\s+get\s+(pods|pod|po)$/], check: sim => { const d = sim.deployments.find(d => d.name === "leuchtfeuer"); return d && !d.broken; },
            solution: "kubectl get pods", hint: "get pods – STATUS muss Running sein." },
        ]},
        { type: "dialog", npc: "juno", lines: [
          "Sauber repariert! Merk dir das Mantra für IMMER: <b>get pods → describe → logs.</b> Erst gucken, dann verstehen, dann fixen, dann verifizieren. Morgen zeige ich dir den fiesesten Fehler von allen …",
        ]},
      ]},

    { id: "q16", title: "Das Flackern", giver: "juno", rewardXp: 55, rewardCoins: 40,
      steps: [
        { type: "dialog", npc: "juno", lines: [
          "Siehst du die <b>funkboje</b> da draußen flackern? Der Pod startet, stürzt ab, startet, stürzt ab … Das nennt sich <b>CrashLoopBackOff</b> – der Klassiker unter den Cluster-Fehlern.",
          "Das Tückische: Das Image ist OK, der Node ist OK – die <b>App selbst</b> stirbt beim Start. Und warum sie stirbt, verrät nur eines: <b>die Logs.</b> Dritte Stufe des Mantras!",
        ]},
        { type: "terminal", brief: "Logs lesen",
          scenario: { deployments: [{ name: "funkboje", image: "nginx", replicas: 1, broken: { type: "crashloop", needsSecret: "funk-schluessel" } }] },
          tasks: [
          { id: "t-j16-1", text: "Verschaff dir den Überblick: get pods. Beachte auch die RESTARTS-Spalte!",
            accept: [/^kubectl\s+get\s+(pods|pod|po)$/], solution: "kubectl get pods", hint: "Wie immer zuerst." },
          { id: "t-j16-2", text: "Jetzt die Wahrheit: Lies die <b>Logs</b> des funkboje-Pods!",
            accept: [/^kubectl\s+logs\s+funkboje-\S+$/], solution: "kubectl logs <funkboje-pod>", hint: "kubectl logs <pod-name>" },
        ]},
        { type: "choice", npc: "juno", reviewId: "q-ts-1",
          q: "Das Log sagt: FATAL: Secret 'funk-schluessel' nicht gefunden. Was ist der Plan?",
          options: [
            { t: "Das fehlende Secret anlegen, dann die Pods neu starten.", ok: true,
              reply: "Exakt! Die App braucht das Secret zum Start. Erst die Ursache beheben, DANN neu starten – andersrum bringt nichts." },
            { t: "Ein anderes Image installieren.", ok: false,
              reply: "Nein – das Image ist in Ordnung! Lies das Log: Der App fehlt das Secret 'funk-schluessel'. Das legen wir an und starten neu." },
          ]},
        { type: "terminal", brief: "Ursache beheben", tasks: [
          { id: "t-j16-3", text: "Lege das fehlende Secret <code>funk-schluessel</code> an (Wert frei wählbar).",
            accept: [/^kubectl\s+create\s+secret\s+generic\s+funk-schluessel\s+--from-literal[=\s][\w.-]+=\S+$/],
            solution: "kubectl create secret generic funk-schluessel --from-literal=code=blinkblink1", hint: "kubectl create secret generic <name> --from-literal=k=v" },
        ]},
        { type: "teach", brief: "Sauberer Neustart", cmd: {
          id: "t-rollout", intro: "🆕 Neuer Befehl: <code>kubectl rollout restart</code> – startet alle Pods eines Deployments sauber neu.",
          text: "Starte das Deployment <code>funkboje</code> neu – jetzt findet es sein Secret!",
          accept: [/^kubectl\s+rollout\s+restart\s+deployment[\/\s]funkboje$/],
          solution: "kubectl rollout restart deployment funkboje",
          hint: "Muster: kubectl rollout restart deployment <name>" } },
        { type: "terminal", brief: "Verifizieren", tasks: [
          { id: "t-j16-4", text: "Verifizieren! Leuchtet die funkboje wieder stabil?",
            accept: [/^kubectl\s+get\s+(pods|pod|po)$/], check: sim => { const d = sim.deployments.find(d => d.name === "funkboje"); return d && !d.broken; },
            solution: "kubectl get pods", hint: "STATUS muss Running sein." },
        ]},
        { type: "dialog", npc: "juno", lines: [
          "Ursache → Fix → Neustart → Verifikation. Du debuggst wie eine alte Sturmwache! Eine Prüfung fehlt noch – und für die brauchen wir … mehr Hafen. Wortwörtlich.",
        ]},
      ]},

    { id: "q17", title: "Kein Platz im Hafen", giver: "juno", rewardXp: 70, rewardCoins: 55,
      steps: [
        { type: "dialog", npc: "juno", lines: [
          "Großauftrag! Die Reederei will ihren <b>frachtplaner</b> bei uns laufen lassen. Aber irgendetwas stimmt nicht – die Pods kommen einfach nicht hoch. Kein Absturz, kein Image-Fehler … sie <b>warten</b> nur.",
        ]},
        { type: "terminal", brief: "Diagnose",
          scenario: {
            deployments: [{ name: "frachtplaner", image: "nginx", replicas: 2, broken: { type: "pending" } }],
            files: { "main.tf": MAIN_TF },
            tfResources: [
              { addr: "hafen_plateau.ost", desc: 'name = "ost-erweiterung"' },
              { addr: "hafen_server.worker[0]", desc: 'name = "ahoi-worker-3"' },
              { addr: "hafen_server.worker[1]", desc: 'name = "ahoi-worker-4"' },
            ],
          },
          tasks: [
          { id: "t-j17-1", text: "Du kennst das Mantra: get pods. Was sagt der STATUS?",
            accept: [/^kubectl\s+get\s+(pods|pod|po)$/], solution: "kubectl get pods", hint: "Schritt 1, immer." },
          { id: "t-j17-2", text: "<code>Pending</code> – die Pods warten auf einen Platz. Warum? describe verrät es in den Events!",
            accept: [/^kubectl\s+describe\s+pods?\s+frachtplaner-\S+$/], solution: "kubectl describe pod <frachtplaner-pod>", hint: "describe + Events lesen." },
        ]},
        { type: "choice", npc: "juno", reviewId: "q-ts-3",
          q: "Events: „0/3 nodes are available: insufficient capacity“. Diagnose?",
          options: [
            { t: "Der Cluster ist voll – wir brauchen mehr Nodes!", ok: true,
              reply: "Genau! Kein Bug, kein Tippfehler – schlicht kein Platz. Und wer baut Infrastruktur? Na? … TERRAFORM! Theos Bauplan für die Ost-Erweiterung liegt noch bereit." },
            { t: "Das Image ist kaputt.", ok: false,
              reply: "Nein – dann stünde da ImagePullBackOff. „insufficient capacity“ = kein Platz auf den Nodes. Wir brauchen MEHR HAFEN!" },
          ]},
        { type: "terminal", brief: "Mehr Hafen bauen!", tasks: [
          { id: "t-j17-3", text: "Der Bauplan liegt bereit (<code>main.tf</code>). Initialisiere Terraform!",
            accept: [/^terraform\s+init$/], solution: "terraform init", hint: "Schritt 1 jedes Terraform-Projekts." },
          { id: "t-j17-4", text: "Generalprobe – was wird gebaut?",
            accept: [/^terraform\s+plan$/], solution: "terraform plan", hint: "Immer erst lesen." },
          { id: "t-j17-5", text: "BAUEN! Und dann beobachte: Ost-Plateau + zwei neue Nodes … 🏗️",
            accept: [/^terraform\s+apply(\s+-auto-approve)?$/], solution: "terraform apply", hint: "Die Aufführung." },
          { id: "t-j17-6", text: "Zähl nach: Wie viele Nodes hat dein Cluster jetzt?",
            accept: [/^kubectl\s+get\s+(nodes|node|no)$/], check: sim => sim.nodes.length > 3, solution: "kubectl get nodes", hint: "kubectl, nicht terraform!" },
          { id: "t-j17-7", text: "Und der Moment der Wahrheit: Haben die frachtplaner-Pods jetzt Platz gefunden?",
            accept: [/^kubectl\s+get\s+(pods|pod|po)$/], check: sim => { const d = sim.deployments.find(d => d.name === "frachtplaner"); return d && !d.broken; },
            solution: "kubectl get pods", hint: "get pods – STATUS lesen." },
        ]},
        { type: "choice", npc: "juno", reviewId: "q-ts-4",
          q: "Letzte Prüfungsfrage: Wie lautet das Debugging-Mantra?",
          options: [
            { t: "get pods → describe → logs. Erst gucken, dann verstehen, dann fixen, dann verifizieren.", ok: true,
              reply: "PERFEKT. Damit löst du draußen 80% aller Cluster-Probleme. Das ist keine Übertreibung." },
            { t: "Erstmal alles neu starten und hoffen.", ok: false,
              reply: "HA! Der Klassiker – und manchmal klappt's sogar. Aber Profis diagnostizieren erst: get pods → describe → logs. Dann fixen. Dann verifizieren." },
          ]},
        { type: "dialog", npc: "juno", lines: [
          "Hiermit ernenne ich dich zur <b>Sturmwache ehrenhalber</b>! 🌩️ Die Ost-Erweiterung bleibt stehen – Port Kubernia ist gewachsen, dank dir.",
          "Ab jetzt gilt: Wenn ein Sturm aufzieht und etwas kaputtgeht, bist DU dran. Du hast das Mantra, du hast die Befehle. Und zwischen den Stürmen? Übe bei mir, halte den Streak, füttere die Krabbe. Der Hafen zählt auf dich, Admiral-Anwärter:in! ⚓",
        ]},
      ]},

    { id: "q18", title: "Seekarten versionieren", giver: "ada", rewardXp: 45, rewardCoins: 32,
      steps: [
        { type: "dialog", npc: "ada",
          scenario: { files: { "seekarte.md": "# Seekarte Port Kubernia\nHafenbecken, drei Stege, Leuchtturm im Osten." } },
          lines: [
            "Pssst. Komm näher. Sieh dir meine <b>Seekarten</b> an – ich ändere sie ständig. Neulich? Falsche Route eingezeichnet, gespeichert, alte Version <b>weg</b>. Eine Woche Arbeit. Futsch.",
            "Nie wieder. Seitdem nutze ich <b>Git</b> – das Logbuch für Dateien. Es merkt sich <b>jede</b> Version, und du kommst immer zur alten zurück. Profis versionieren so ihren Code, ihre YAMLs, einfach alles.",
            "Ich hab dir eine Karte hingelegt: <code>seekarte.md</code> (mit <code>ls</code> und <code>cat</code> ansehbar). Stellen wir sie unter Gits Schutz. Zuerst: aus diesem Ordner ein Repository machen.",
          ] },
        { type: "teach", brief: "Repo anlegen", cmd: {
          id: "t-git-init", intro: "🆕 Neuer Befehl: <code>git init</code> – macht aus dem Ordner ein Git-Repository (legt einen versteckten <code>.git</code>-Ordner an).",
          text: "Initialisiere hier ein Git-Repository.",
          accept: [/^git\s+init$/], solution: "git init", hint: "Wirklich nur: git init" } },
        { type: "dialog", npc: "ada", lines: [
          "Git beobachtet jetzt den Ordner – hält aber nichts von allein fest. Du sagst ihm <b>wann</b>. Frag es zuerst, was es sieht: <code>git status</code> zeigt, welche Dateien noch <b>unversioniert</b> sind.",
        ] },
        { type: "teach", brief: "Stand prüfen", cmd: {
          id: "t-git-status", intro: "🆕 <code>git status</code> – zeigt den aktuellen Stand: welcher Branch, was ist neu / geändert / vorgemerkt.",
          text: "Lass dir den Status anzeigen. <code>seekarte.md</code> müsste als „unversioniert“ auftauchen.",
          accept: [/^git\s+status$/], solution: "git status", hint: "git + ein Wort für „Stand“." } },
        { type: "dialog", npc: "ada", lines: [
          "Da ist sie, unter „Unversionierte Dateien“. Zwei Schritte bis zur sicheren Version: erst <b>vormerken</b> (<code>git add</code>), dann <b>festhalten</b> (<code>git commit</code>). Das Vormerken heißt <i>Staging</i> – du wählst aus, was in den nächsten Schnappschuss soll.",
        ] },
        { type: "teach", brief: "Vormerken", cmd: {
          id: "t-git-add", intro: "🆕 <code>git add &lt;datei&gt;</code> – merkt eine Datei für den nächsten Commit vor (Staging).",
          text: "Merke <code>seekarte.md</code> zum Commit vor.",
          accept: [/^git\s+add\s+seekarte\.md$/], solution: "git add seekarte.md", hint: "Muster: git add <datei>" } },
        { type: "teach", brief: "Festhalten", cmd: {
          id: "t-git-commit", intro: "🆕 <code>git commit -m \"…\"</code> – hält die vorgemerkten Änderungen als Schnappschuss in der Historie fest, mit kurzer Nachricht.",
          text: "Halte die Karte fest – Commit-Nachricht z.B. <code>Erste Seekarte</code>.",
          accept: [/^git\s+commit\s+-m\s+("[^"]+"|'[^']+'|\S+)$/], solution: 'git commit -m "Erste Seekarte"', hint: 'Muster: git commit -m "deine Nachricht"' } },
        { type: "dialog", npc: "ada", lines: [
          "<b>Festgehalten!</b> Diese Version ist für immer sicher. Jede:r kann später nachlesen, was wann geändert wurde. Schau in die Historie: <code>git log</code>.",
        ] },
        { type: "teach", brief: "Historie lesen", cmd: {
          id: "t-git-log", intro: "🆕 <code>git log</code> – zeigt die Liste aller Commits (die Versions-Historie).",
          text: "Zeig die Commit-Historie an.",
          accept: [/^git\s+log$/], solution: "git log", hint: "git + ein Wort für „Logbuch“." } },
        { type: "drill", brief: "Adas Übungsrunde", pool: ["git-status", "git-add", "git-commit"], count: 3,
          intro: "Der Dreiklang sitzt erst mit Übung: status → add → commit." },
        { type: "choice", npc: "ada", reviewId: "q-git-1",
          q: "Ada prüft: Was macht <code>git commit</code>?",
          options: [
            { t: "Es hält die vorgemerkten Änderungen als Schnappschuss mit Nachricht in der Historie fest.", ok: true,
              reply: "GENAU. Ein Commit ist ein Speicherpunkt, zu dem du immer zurückkannst." },
            { t: "Es lädt die Dateien sofort auf den Server hoch.", ok: false,
              reply: "Nein – das wäre git push. Ein Commit bleibt erstmal LOKAL." },
          ] },
        { type: "choice", npc: "ada", reviewId: "q-git-3",
          q: "Und der Unterschied zwischen <code>git add</code> und <code>git commit</code>?",
          options: [
            { t: "add merkt Änderungen vor (Staging), commit hält die vorgemerkten dann dauerhaft fest.", ok: true,
              reply: "Richtig. Erst auswählen (add), dann einrahmen (commit) – zwei bewusste Schritte." },
            { t: "Kein Unterschied, beides speichert dasselbe.", ok: false,
              reply: "Doch! add = vormerken, commit = festhalten. Du kannst gezielt nur EINEN Teil committen." },
          ] },
        { type: "dialog", npc: "ada", lines: [
          "Du hast den wichtigsten Rhythmus der Softwarewelt gelernt: <b>ändern → add → commit</b>. Komm wieder, dann zeig ich dir <b>Zweige</b> – wie man gefahrlos experimentiert. Üben kannst du bei mir jederzeit!",
        ] },
      ]},

    { id: "q19", title: "Ein eigener Zweig", giver: "ada", rewardXp: 50, rewardCoins: 38,
      steps: [
        { type: "dialog", npc: "ada",
          scenario: { files: { "route-neu.md": "# Experimentelle Route\n(Entwurf – noch nicht sicher!)" } },
          lines: [
            "Zurück! Heute das Mächtigste an Git: <b>Branches</b> (Zweige). Stell dir vor, du willst eine <b>riskante neue Route</b> ausprobieren – aber die geprüfte Hauptkarte (<code>main</code>) soll heil bleiben.",
            "Lösung: ein eigener Zweig. Dort arbeitest du frei, und erst wenn es gut ist, führst du ihn mit <code>main</code> zusammen. Genau so arbeiten Teams – jede:r auf eigenem Branch, am Ende wird zusammengeführt (oft nach einem Review).",
            "Ich hab dir <code>route-neu.md</code> hingelegt. Leg einen Zweig an und wechsle hinein – in einem Rutsch mit <code>git checkout -b</code>.",
          ] },
        { type: "teach", brief: "Zweig + wechseln", cmd: {
          id: "t-git-checkout-b", intro: "🆕 <code>git checkout -b &lt;name&gt;</code> – legt einen neuen Branch an UND wechselt direkt hinein.",
          text: "Leg den Branch <code>experiment-route</code> an und wechsle hinein.",
          accept: [/^git\s+checkout\s+-b\s+experiment-route$/], solution: "git checkout -b experiment-route", hint: "Muster: git checkout -b <name>" } },
        { type: "dialog", npc: "ada", lines: [
          "Du bist jetzt auf <code>experiment-route</code> – <code>main</code> bleibt unberührt. Mach hier deine Arbeit fest: <code>route-neu.md</code> vormerken und committen (wie gestern gelernt).",
        ] },
        { type: "teach", brief: "Vormerken", cmd: {
          id: "t-git-add2", intro: "↩︎ Wiederholung: <code>git add</code> merkt die Datei vor.",
          text: "Merke <code>route-neu.md</code> vor.",
          accept: [/^git\s+add\s+route-neu\.md$/], solution: "git add route-neu.md", hint: "Muster: git add <datei>" } },
        { type: "teach", brief: "Festhalten", cmd: {
          id: "t-git-commit2", intro: "↩︎ Wiederholung: <code>git commit -m \"…\"</code> hält es fest.",
          text: "Committe die neue Route, z.B. mit <code>Neue Route skizziert</code>.",
          accept: [/^git\s+commit\s+-m\s+("[^"]+"|'[^']+'|\S+)$/], solution: 'git commit -m "Neue Route skizziert"', hint: 'Muster: git commit -m "Nachricht"' } },
        { type: "dialog", npc: "ada", lines: [
          "Die Route sitzt sicher im Zweig. Jetzt zurück zur Hauptkarte: wechsle nach <code>main</code>.",
        ] },
        { type: "teach", brief: "Zurück zu main", cmd: {
          id: "t-git-checkout-main", intro: "🆕 <code>git checkout &lt;name&gt;</code> (ohne -b) – wechselt auf einen bestehenden Branch.",
          text: "Wechsle zurück auf <code>main</code>.",
          accept: [/^git\s+checkout\s+main$/], solution: "git checkout main", hint: "git checkout <branchname>" } },
        { type: "dialog", npc: "ada", lines: [
          "Auf <code>main</code> ist die neue Route noch nicht zu sehen – sie lebt im Zweig. Jetzt das Finale: <b>zusammenführen</b> mit <code>git merge</code>.",
        ] },
        { type: "teach", brief: "Zusammenführen", cmd: {
          id: "t-git-merge", intro: "🆕 <code>git merge &lt;branch&gt;</code> – holt die Arbeit aus einem anderen Branch in deinen aktuellen.",
          text: "Führe <code>experiment-route</code> in <code>main</code> zusammen.",
          accept: [/^git\s+merge\s+experiment-route$/], solution: "git merge experiment-route", hint: "Muster: git merge <branch>" } },
        { type: "dialog", npc: "ada", lines: [
          "Vereint! Zum Schluss teilst du deine Arbeit mit dem Team: <code>git push</code> schiebt deine Commits auf den Server (z.B. GitLab). Erst dann sehen es die anderen.",
        ] },
        { type: "teach", brief: "Hochladen", cmd: {
          id: "t-git-push", intro: "🆕 <code>git push</code> – lädt deine lokalen Commits auf den entfernten Server (origin).",
          text: "Schiebe deine Arbeit zum Server hoch.",
          accept: [/^git\s+push$/], solution: "git push", hint: "Wirklich nur: git push" } },
        { type: "drill", brief: "Adas Übungsrunde", pool: ["git-branch", "git-checkout", "git-status"], count: 3,
          intro: "Branchen will geübt sein – ein paar Wiederholungen:" },
        { type: "choice", npc: "ada", reviewId: "q-git-2",
          q: "Wozu legt man einen eigenen Branch an?",
          options: [
            { t: "Um Änderungen abseits von main auszuprobieren und erst später (oft nach Review) zusammenzuführen.", ok: true,
              reply: "Genau. main bleibt stabil, dein Experiment stört niemanden – bis du bereit bist." },
            { t: "Damit Git schneller läuft.", ok: false,
              reply: "Nein, mit Tempo hat das nichts zu tun. Es geht um sicheres, paralleles Arbeiten." },
          ] },
        { type: "dialog", npc: "ada", lines: [
          "Du beherrschst jetzt den vollen Git-Kreis: <b>branch → commit → merge → push</b>. Genau dieser Ablauf treibt später auch die <b>Pipelines</b> an (ein push löst automatische Builds & Deployments aus – aber das ist eine andere Insel). Sauber gemacht, Kartograph:in! 🗺️",
        ] },
      ]},

    { id: "q20", title: "Die Pipeline-Passage", giver: "ada", rewardXp: 60, rewardCoins: 45,
      steps: [
        { type: "dialog", npc: "ada",
          scenario: { files: { ".gitlab-ci.yml": GITLAB_CI_YML, "Dockerfile": DOCKERFILE }, ciDeploy: { name: "funkdienst", image: "nginx", replicas: 2 } },
          lines: [
            "Du erinnerst dich: Ich sagte, ein <code>git push</code> treibt später <b>Pipelines</b> an. Willkommen in der <b>Pipeline-Passage</b> – hier wird aus „von Hand deployen“ endlich Automatik.",
            "Auf dem Server (z.B. GitLab) sitzt ein <b>Runner</b> und wartet. Liegt im Repo eine Datei <code>.gitlab-ci.yml</code>, arbeitet er bei <b>jedem Push</b> automatisch eine <b>Pipeline</b> ab – eine Kette von Schritten, klassisch <b>build → test → deploy</b>.",
            "Das ist <b>CI/CD</b>: <b>CI</b> (Continuous Integration) baut & testet jede Änderung sofort, <b>CD</b> (Continuous Delivery/Deployment) liefert sie automatisch aus. Ich hab dir eine <code>.gitlab-ci.yml</code> und ein <code>Dockerfile</code> hingelegt. Sieh dir die Pipeline-Definition an: <code>cat .gitlab-ci.yml</code>.",
          ] },
        { type: "teach", brief: "Pipeline lesen", cmd: {
          id: "t-ci-cat", intro: "🆕 Die <code>.gitlab-ci.yml</code> beschreibt die Pipeline: welche <b>stages</b> es gibt und welche <b>Jobs</b> mit welchen <code>script</code>-Befehlen darin laufen.",
          text: "Lies die Pipeline-Definition <code>.gitlab-ci.yml</code>.",
          accept: [/^cat\s+\.gitlab-ci\.yml$/], solution: "cat .gitlab-ci.yml", hint: "cat <datei> – wie bei meiner Seekarte." } },
        { type: "dialog", npc: "ada", lines: [
          "Siehst du die drei <b>stages</b>? <b>build</b> baut aus dem <code>Dockerfile</code> ein Docker-Image. <b>test</b> prüft den Code – <i>bevor</i> irgendwas live geht. <b>deploy</b> macht ein <code>kubectl apply</code> in den Cluster – also genau das, was du bei mir und Theo von Hand getippt hast, nur <b>automatisch</b>.",
          "Und schau aufs <code>only: main</code> beim deploy: wirklich ausgerollt wird nur, was auf dem <b>main</b>-Branch landet. Feature-Branches werden gebaut & getestet, aber nicht deployt – ein Sicherheitsnetz.",
          "Jetzt der Beweis. Nimm die neuen Dateien ins Repo auf – diesmal alle auf einmal mit <code>git add .</code> (der Punkt = „alles“).",
        ] },
        { type: "teach", brief: "Alles vormerken", cmd: {
          id: "t-ci-addall", intro: "🆕 <code>git add .</code> – der Punkt merkt <b>alle</b> neuen/geänderten Dateien auf einmal vor, statt jede einzeln.",
          text: "Merke alle Änderungen auf einmal vor.",
          accept: [/^git\s+add\s+\.$/], solution: "git add .", hint: "git add + ein einzelner Punkt." } },
        { type: "teach", brief: "Festhalten", cmd: {
          id: "t-ci-commit", intro: "↩︎ Wiederholung: <code>git commit -m \"…\"</code> hält die vorgemerkten Änderungen fest.",
          text: "Committe die Pipeline-Einrichtung, z.B. mit <code>CI-Pipeline eingerichtet</code>.",
          accept: [/^git\s+commit\s+-m\s+("[^"]+"|'[^']+'|\S+)$/], solution: 'git commit -m "CI-Pipeline eingerichtet"', hint: 'Muster: git commit -m "Nachricht"' } },
        { type: "teach", brief: "Push löst Pipeline aus", cmd: {
          id: "t-ci-push", intro: "🆕 Der entscheidende Moment: <code>git push</code> lädt nicht nur hoch – weil jetzt eine <code>.gitlab-ci.yml</code> im Repo liegt, <b>startet der Runner automatisch die Pipeline</b>.",
          text: "Schiebe deine Arbeit zum Server – und lass die erste Pipeline laufen.",
          accept: [/^git\s+push$/], solution: "git push", hint: "Wirklich nur: git push" } },
        { type: "dialog", npc: "ada", lines: [
          "Spürst du das? Du hast nichts deployt – du hast nur <b>gepusht</b>. Den Rest macht die Pipeline. Schau ihr beim Arbeiten zu: <code>glab</code> ist das Kommandozeilen-Werkzeug für GitLab.",
        ] },
        { type: "teach", brief: "Pipeline-Status", cmd: {
          id: "t-ci-status", intro: "🆕 Neuer Befehl: <code>glab ci status</code> – zeigt die Pipeline des aktuellen Branches und ob ihre Stages durchgelaufen sind.",
          text: "Sieh nach, wie weit die Pipeline ist.",
          accept: [/^glab\s+ci\s+status$/], solution: "glab ci status", hint: "glab ci <unterbefehl> fürs Nachschauen." } },
        { type: "dialog", npc: "ada", lines: [
          "Alles grün ✅ – build, test, <b>deploy</b>. Und jetzt das Beste: der deploy-Stage hat den Dienst <b>funkdienst</b> ganz von allein in den Cluster gerollt. Kein <code>kubectl apply</code> von Hand. Überzeug dich: <code>kubectl get pods</code>.",
        ] },
        { type: "teach", brief: "Beweis im Cluster", cmd: {
          id: "t-ci-getpods", intro: "↩︎ Beweis: die Pipeline hat <code>funkdienst</code> für dich deployt – ohne dass du den Cluster angefasst hast.",
          text: "Zeig die Pods – <code>funkdienst</code> müsste jetzt laufen.",
          accept: [/^kubectl\s+get\s+(pods|pod|po)$/], solution: "kubectl get pods", hint: "kubectl get pods" } },
        { type: "choice", npc: "ada", reviewId: "q-ci-1",
          q: "Ada prüft: Was löst die Pipeline aus?",
          options: [
            { t: "Ein git push in ein Repo, das eine .gitlab-ci.yml enthält.", ok: true,
              reply: "Genau. Push → der Runner sieht die .gitlab-ci.yml → Pipeline läuft. Vollautomatisch." },
            { t: "Man muss sie jeden Morgen von Hand starten.", ok: false,
              reply: "Nein – das wäre ja keine Automatik. Der Push ist der Auslöser." },
          ] },
        { type: "choice", npc: "ada", reviewId: "q-ci-2",
          q: "Und in welcher Reihenfolge laufen die Stages?",
          options: [
            { t: "build → test → deploy", ok: true,
              reply: "Richtig. Erst bauen, dann testen (bevor etwas live geht!), dann ausrollen. Fällt test durch, wird gar nicht erst deployt." },
            { t: "deploy → test → build", ok: false,
              reply: "Andersherum – du würdest Ungetestetes ausrollen und erst danach bauen. Genau das verhindert die Reihenfolge." },
          ] },
        { type: "drill", brief: "Adas Pipeline-Übung", pool: ["git-add-all", "ci-status"], count: 2,
          intro: "Der CI/CD-Reflex: alles vormerken, pushen, Status checken." },
        { type: "dialog", npc: "ada", lines: [
          "Du hast die Pipeline-Passage gemeistert: <b>push → build → test → deploy</b>, vollautomatisch. So liefert ein Team hundertmal am Tag aus, ohne Angst – die Pipeline ist Bauanleitung, Prüfer und Auslieferer in einem.",
          "Und es schließt den Kreis: deine Befehle von Bo (Docker-Build), von mir (Git) und von Ole (kubectl apply) – die Pipeline tippt sie jetzt für dich. Das ist das Herz von modernem DevOps. 🚢",
        ] },
      ]},
  ];

  /* ---------- Standard-Dialoge ---------- */
  const SMALLTALK = {
    ole: ["Der Hafen läuft wie geschmiert – dank dir!", "K8s spricht man übrigens „Kates“. Klingt wie ein Vorname, ich weiß."],
    bo: ["BO. STAPELT. <i>*zufriedenes Knirschen*</i>", "Bo-Weisheit: Image ist Bauplan. Container läuft. Bo verwechselt nie. Bo ist Stein."],
    ada: ["Pssst. Ich katalogisiere gerade … alles.", "Leerzeichen, keine Tabs. LEERZEICHEN. KEINE TABS."],
    runa: ["Das Helm-Logo hängt über meinem Bett. Was? Es ist hübsch!", "helm rollback hat mir mal ein Wochenende gerettet."],
    theo: ["Ich vermesse gerade die Möglichkeiten. Sie sind … beachtlich.", "terraform plan lesen. IMMER. Frag nicht, woher ich das weiß."],
    pelle: ["Frische Ware, faire Preise! Na ja – Preise.", "Die Kanone da drüben? Bestseller, seit die Piraten wieder da sind."],
    juno: ["Ruhige See heute. ZU ruhig.", "get pods → describe → logs. Träum es. Lebe es.", "Der Leuchtturm hat 99,99% Uptime. Die fehlenden 0,01% verfolgen mich bis heute."],
  };

  /* ---------- Karteikarten (Krabbe Kralle) ---------- */
  const CRAB_QUIZ = [
    { id: "q-ch1-1", q: "Welches Problem lösen Software-Container hauptsächlich?", options: ["Eine App läuft mit allem Drumherum überall gleich – Laptop, Server, Cloud.", "Sie machen Programme automatisch schneller.", "Sie verschlüsseln Programme gegen Angriffe.", "Sie sparen Speicherplatz."], correct: 0, explain: "Container packen die App mit allen Abhängigkeiten in eine genormte Box. „Bei mir läuft's aber!“ ist damit Geschichte." },
    { id: "q-ch1-2", q: "Image vs. Container – was ist was?", options: ["Image = Bauplan/Vorlage, Container = laufende Instanz davon.", "Kein Unterschied, zwei Wörter für dasselbe.", "Container = Vorlage, Image = das laufende Programm.", "Images sind für Linux, Container für Windows."], correct: 0, explain: "Tiefkühlpizza (Image) und Pizza im Ofen (Container): Aus einem Image kannst du viele Container starten." },
    { id: "q-ch1-3", q: "Was ist Docker Hub?", options: ["Eine Registry – ein öffentlicher „Supermarkt“ für fertige Images.", "Das Hauptquartier der Firma Docker.", "Ein USB-Hub für Container.", "Ein Überwachungstool."], correct: 0, explain: "Eine Registry speichert Images. docker pull nginx lädt z.B. das nginx-Image von Docker Hub." },
    { id: "q-ch1-4", q: "Was zeigt der Befehl docker ps?", options: ["Alle gerade laufenden Container.", "Alle heruntergeladenen Images.", "Die Prozessorlast.", "Alle Images auf Docker Hub."], correct: 0, explain: "docker ps = laufende Container. Mit -a („all“) siehst du auch die gestoppten." },
    { id: "q-ch1-5", q: "Woraus besteht ein Docker-Image intern?", options: ["Aus übereinandergestapelten Schichten (Layern) – unten die Basis, oben die App.", "Aus einer einzigen großen Datei ohne Struktur.", "Aus dem Quellcode der App.", "Aus einer virtuellen Festplatte mit Betriebssystem."], correct: 0, explain: "Image = Schichtstapel: Base-Image unten, dann Bibliotheken, oben die App. Unveränderte Schichten kommen aus dem Cache – deshalb sind gute Schicht-Reihenfolgen so wichtig (Stapel-Spiel bei Bo!)." },
    { id: "q-ch2-1", q: "Wofür braucht man Kubernetes, wenn es Docker gibt?", options: ["Es verwaltet viele Container auf vielen Servern automatisch: neu starten, verteilen, skalieren.", "Es ersetzt Docker, weil Docker veraltet ist.", "Es macht Container kleiner.", "Es ist nur eine grafische Oberfläche für Docker."], correct: 0, explain: "Docker startet Container, Kubernetes orchestriert sie in großem Stil – die Hafenmeisterei für hunderte Kisten." },
    { id: "q-ch2-2", q: "Was ist ein Pod?", options: ["Die kleinste Einheit in Kubernetes – meist genau ein Container drin.", "Ein anderes Wort für einen Server.", "Eine Gruppe von mindestens zehn Containern.", "Das Konfigurationsformat von Kubernetes."], correct: 0, explain: "Kubernetes verwaltet nie Container direkt, sondern immer Pods – die Liegeplätze mit den Kisten drauf." },
    { id: "q-ch2-3", q: "Was ist ein Node?", options: ["Ein einzelner Server, der zum Cluster gehört und Pods ausführt.", "Ein Backup des Clusters.", "Ein spezieller Pod für Datenbanken.", "Das Kabel zwischen zwei Clustern."], correct: 0, explain: "Im Hafenbild: ein Steg. Mehrere Nodes zusammen bilden den Cluster." },
    { id: "q-ch2-4", q: "Ein Container stürzt nachts um 3 Uhr ab. Was passiert?", options: ["Kubernetes merkt es und startet automatisch Ersatz.", "Der Admin bekommt einen Anruf.", "Der Pod bleibt kaputt bis zum Morgen.", "Der Cluster fährt sicherheitshalber herunter."], correct: 0, explain: "Self-Healing: Kubernetes überwacht den Soll-Zustand und stellt ihn automatisch wieder her." },
    { id: "q-ch3-1", q: "Warum erstellt man Pods über ein Deployment statt direkt?", options: ["Pods sind sterblich – das Deployment ersetzt tote Pods automatisch und hält die Anzahl.", "Einzelne Pods verbrauchen mehr Speicher.", "Pods brauchen sonst Admin-Rechte.", "Direkte Pods sind verboten."], correct: 0, explain: "Das Deployment ist der Dauerauftrag: „Halte immer N Kopien am Laufen.“" },
    { id: "q-ch3-2", q: "Du löschst einen Pod eines Deployments (replicas: 3). Was passiert?", options: ["Kubernetes startet sofort einen neuen – es sollen ja 3 sein.", "Es laufen dauerhaft nur noch 2.", "Das Deployment wird ungültig.", "Kubernetes fragt erst nach."], correct: 0, explain: "Soll (3) vs. Ist (2) → Differenz wird sofort behoben. Self-Healing live!" },
    { id: "q-ch3-3", q: "Wozu braucht man einen Service?", options: ["Als feste, stabile Adresse vor den Pods – deren Namen und IPs wechseln ständig.", "Um Pods schneller zu machen.", "Als Backup für Deployments.", "Services starten Nodes neu."], correct: 0, explain: "Der Empfangstresen: Wer die App erreichen will, redet mit dem Service – der leitet an die lebenden Pods weiter." },
    { id: "q-ch4-1", q: "Imperativ vs. deklarativ?", options: ["Imperativ = einzelne Befehle rufen. Deklarativ = Wunschzustand in eine Datei schreiben.", "Imperativ ist für Linux, deklarativ für Windows.", "Deklarativ heißt: mit der Maus klicken.", "Kein Unterschied."], correct: 0, explain: "Deklarativ ist der Profi-Standard, weil die Dateien in Git versioniert werden können." },
    { id: "q-ch4-2", q: "Was gibt das Feld kind in einem Manifest an?", options: ["Welche Art von Ressource beschrieben wird – z.B. Deployment oder Service.", "Wie freundlich der Cluster antworten soll.", "Die Kubernetes-Version.", "Den Namen des Erstellers."], correct: 0, explain: "kind: Deployment, kind: Service … es bestimmt, was die Datei beschreibt." },
    { id: "q-ch4-3", q: "Worauf musst du bei YAML besonders achten?", options: ["Einrückung mit Leerzeichen – niemals Tabs.", "Großschreibung aller Schlüssel.", "Semikolon am Zeilenende.", "Maximal 100 Zeilen."], correct: 0, explain: "YAML lebt von Einrückung. Ein Leerzeichen daneben = Fehler. Ada würde weinen." },
    { id: "q-ch4-4", q: "kubectl apply -f app.yaml – zweimal ausgeführt. Was passiert beim zweiten Mal?", options: ["Nichts Schlimmes – „unchanged“, alles stimmt schon.", "Alles wird doppelt erstellt.", "Fehler: apply geht nur einmal.", "Alles wird gelöscht und neu erstellt."], correct: 0, explain: "apply gleicht Soll mit Ist ab und tut nur das Nötige – idempotent." },
    { id: "q-ch5-1", q: "Was ist Helm?", options: ["Der Paketmanager für Kubernetes – installiert komplette Apps als Charts.", "Eine Schutzausrüstung fürs Rechenzentrum.", "Ein Konkurrent von Kubernetes.", "Das Monitoring-Dashboard."], correct: 0, explain: "Helm = Steuerrad – und der App-Store für Kubernetes-Anwendungen." },
    { id: "q-ch5-2", q: "Chart vs. Release?", options: ["Chart = das Paket (Vorlage), Release = eine installierte Instanz davon.", "Release = die Vorlage, Chart = die Installation.", "Charts sind kostenlos, Releases kosten.", "Kein Unterschied."], correct: 0, explain: "Wie Image und Container! Aus einem Chart können mehrere Releases installiert werden." },
    { id: "q-ch5-3", q: "Wozu dient values.yaml in einem Chart?", options: ["Die einstellbaren Werte (Drehknöpfe) – z.B. Anzahl Kopien – ohne die Vorlage zu ändern.", "Der Preis des Charts.", "Die Passwörter des Clusters.", "Das Änderungsprotokoll."], correct: 0, explain: "Gleiche Vorlage + andere Values = Test, Staging, Produktion aus einem Chart." },
    { id: "q-ch5-4", q: "Dein helm upgrade hat alles kaputt gemacht. Panik?", options: ["Nein – helm rollback bringt das Release auf eine frühere Revision zurück.", "Ja – Cluster löschen, neu aufsetzen.", "Alle YAML-Dateien von Hand zurückändern.", "Nur uninstall + neu installieren hilft."], correct: 0, explain: "Helm führt eine Revisions-Historie pro Release. rollback = Lebensretter." },
    { id: "q-ch6-1", q: "Was bedeutet „Infrastructure as Code“?", options: ["Server, Netze & Co. werden als Textdateien beschrieben statt zusammengeklickt.", "Programme laufen ohne Betriebssystem.", "Die Infrastruktur schreibt eigenen Code.", "Rechenzentren werden durch Software ersetzt."], correct: 0, explain: "Die Dateien liegen in Git – nachvollziehbar, wiederholbar, teilbar." },
    { id: "q-ch6-2", q: "terraform plan vs. apply?", options: ["plan zeigt nur, was passieren würde – apply führt es aus.", "plan für kleine, apply für große Infrastruktur.", "apply zeigt den Plan, plan wendet an.", "Kein Unterschied."], correct: 0, explain: "Immer erst plan lesen, dann apply. Die Generalprobe vor der Aufführung." },
    { id: "q-ch6-3", q: "Was ist der Terraform-State?", options: ["Terraforms Gedächtnis: was es bereits gebaut hat.", "Der Bundesstaat des Rechenzentrums.", "Eine Statusanzeige der Installation.", "Das Fehlerprotokoll."], correct: 0, explain: "Dank State vergleicht Terraform Soll (.tf-Dateien) mit Ist und setzt nur die Differenz um." },
    { id: "q-ch6-4", q: "Kubernetes und Terraform sind beide deklarativ. Unterschied?", options: ["Kubernetes verwaltet Container im Cluster – Terraform baut die Infrastruktur drumherum.", "Terraform ist nur für Windows-Server.", "Kubernetes ersetzt Terraform.", "Terraform verwaltet nur Datenbanken."], correct: 0, explain: "Terraform baut den Hafen, Kubernetes betreibt den Verkehr darin. Oft baut Terraform sogar den K8s-Cluster." },
    { id: "q-sec-1", q: "Wohin gehören Passwörter und API-Schlüssel im Cluster?", options: ["In Secrets – niemals im Klartext in YAML oder ConfigMaps.", "In die ConfigMap, da sind sie übersichtlich.", "Als Kommentar ins Manifest.", "In den Image-Namen."], correct: 0, explain: "ConfigMaps sind Klartext – Krakenfutter! Vertrauliches gehört in Secrets (und echte Profis verschlüsseln zusätzlich, z.B. mit Sealed Secrets oder Vault)." },
    { id: "q-sec-2", q: "Warum sind Klartext-Passwörter in YAML-Dateien doppelt gefährlich?", options: ["Jede:r mit Cluster- oder Git-Zugriff kann sie lesen – YAML landet ja in Git!", "YAML-Dateien werden automatisch veröffentlicht.", "Passwörter machen YAML-Dateien langsam.", "Sie sind nicht gefährlich."], correct: 0, explain: "Deklarative Dateien gehören in Git – und damit wandert jedes Klartext-Passwort in die Versionshistorie. Für immer. Secrets brechen diese Kette." },
    { id: "q-ts-1", q: "Ein Pod zeigt CrashLoopBackOff. Was heißt das?", options: ["Die App startet, stürzt ab, startet wieder … – die Ursache steht in den Logs.", "Das Image kann nicht geladen werden.", "Der Pod wartet auf einen freien Node.", "Der Pod wurde absichtlich gestoppt."], correct: 0, explain: "CrashLoop = die App selbst stirbt beim Start (fehlende Config, fehlendes Secret, Bug). kubectl logs verrät, warum." },
    { id: "q-ts-2", q: "Ein Pod zeigt ImagePullBackOff. Häufigste Ursachen?", options: ["Tippfehler im Image-Namen, falscher Tag oder fehlende Registry-Rechte.", "Zu wenig Arbeitsspeicher.", "Der Service ist falsch konfiguriert.", "Das YAML hat Tabs statt Leerzeichen."], correct: 0, explain: "Das Image kann nicht geladen werden – describe zeigt in den Events den genauen Grund. Fix: kubectl set image mit dem richtigen Namen." },
    { id: "q-ts-3", q: "Ein Pod hängt ewig in Pending. Was ist los?", options: ["Er findet keinen Platz – kein Node hat genug Kapazität (oder passt nicht).", "Das Image lädt noch herunter.", "Die App ist abgestürzt.", "Pending ist der Normalzustand."], correct: 0, explain: "Pending = noch nicht eingeplant. describe → Events zeigt z.B. „0/3 nodes are available“. Lösung: Platz schaffen oder Nodes hinzufügen (Terraform!)." },
    { id: "q-ts-4", q: "Das Debugging-Mantra für kaputte Pods?", options: ["get pods → describe → logs, dann fixen und verifizieren.", "Sofort alles löschen und neu deployen.", "Den Cluster neu starten.", "Im Code nach Bugs suchen."], correct: 0, explain: "Erst STATUS lesen (get), dann Events (describe), dann die App-Sicht (logs). Damit findest du 80% aller Ursachen in Minuten." },
    { id: "q-ts-5", q: "Wann hilft kubectl rollout restart?", options: ["Wenn die Ursache behoben ist (z.B. Secret angelegt) und die Pods sauber neu starten sollen.", "Bei jedem Fehler als erstes.", "Nur bei ImagePullBackOff.", "Um den Node neu zu starten."], correct: 0, explain: "Restart ersetzt alle Pods rollierend. Wichtig: ERST die Ursache beheben, sonst crasht es wieder. Reihenfolge: Ursache → Fix → Restart → Verifikation." },
    { id: "q-git-1", q: "Was macht git commit?", options: ["Hält die vorgemerkten Änderungen als Schnappschuss mit Nachricht in der Historie fest.", "Lädt die Dateien auf den Server hoch.", "Löscht alle ungespeicherten Änderungen.", "Wechselt auf einen anderen Branch."], correct: 0, explain: "Ein Commit ist ein lokaler Speicherpunkt mit Nachricht. Hochladen zum Server macht erst git push." },
    { id: "q-git-2", q: "Wozu legt man in Git einen eigenen Branch (Zweig) an?", options: ["Um Änderungen abseits von main auszuprobieren und erst nach Review zusammenzuführen.", "Damit Git schneller läuft.", "Um Speicherplatz zu sparen.", "Um Dateien endgültig zu löschen."], correct: 0, explain: "Branches erlauben sicheres, paralleles Arbeiten: main bleibt stabil, das Experiment lebt im Zweig – am Ende wird gemergt." },
    { id: "q-git-3", q: "Unterschied zwischen git add und git commit?", options: ["add merkt Änderungen vor (Staging), commit hält die vorgemerkten dauerhaft in der Historie fest.", "Kein Unterschied, beides speichert dasselbe.", "add committet, commit pusht zum Server.", "add ist für neue Dateien, commit für alte."], correct: 0, explain: "Zwei bewusste Schritte: erst auswählen, was in den Schnappschuss soll (add/Staging), dann festhalten (commit)." },
    { id: "q-ci-1", q: "Was löst in GitLab eine Pipeline aus?", options: ["Ein git push in ein Repo, das eine .gitlab-ci.yml enthält.", "Man muss sie jeden Morgen von Hand starten.", "Ein kubectl apply.", "Das Anlegen eines neuen Branches."], correct: 0, explain: "CI heißt Continuous Integration: Bei jedem Push prüft der Runner die .gitlab-ci.yml und arbeitet die Stages automatisch ab – kein Mensch klickt etwas." },
    { id: "q-ci-2", q: "Die typische Stage-Reihenfolge einer CI/CD-Pipeline?", options: ["build → test → deploy", "deploy → test → build", "test → deploy → build", "Die Reihenfolge ist egal."], correct: 0, explain: "Erst bauen (Image erzeugen), dann testen (prüfen, BEVOR etwas live geht), dann deployen (in den Cluster ausrollen). Fällt eine frühe Stage durch, laufen die späteren gar nicht erst." },
    { id: "q-ci-3", q: "Wofür stehen CI und CD?", options: ["Continuous Integration und Continuous Delivery/Deployment.", "Code Inspection und Code Deployment.", "Container Init und Container Deploy.", "Central Integration und Central Delivery."], correct: 0, explain: "CI = Änderungen laufend automatisch bauen & testen. CD = sie automatisch ausliefern/ausrollen. Zusammen: vom Commit bis in den Cluster ohne Handarbeit." },
  ];

  const CMD_CARDS = [
    { id: "c-ch1-1", chapter: "q1", q: "Lade das Image <code>nginx</code> aus der Registry herunter.", accept: [/^docker\s+pull\s+nginx(:\S+)?$/], solution: "docker pull nginx" },
    { id: "c-ch1-2", chapter: "q2", q: "Zeige alle laufenden Docker-Container an.", accept: [/^docker\s+ps$/], solution: "docker ps" },
    { id: "c-ch1-3", chapter: "q2", q: "Zeige ALLE Docker-Container – auch gestoppte.", accept: [/^docker\s+ps\s+(-a|--all)$/], solution: "docker ps -a" },
    { id: "c-ch1-4", chapter: "q3", q: "Starte aus <code>nginx</code> einen Container im Hintergrund namens <code>webserver</code>.", accept: [/^docker\s+run\s+(?=.*-d)(?=.*--name\s+webserver).*nginx(:\S+)?$/], solution: "docker run -d --name webserver nginx" },
    { id: "c-ch2-1", chapter: "q4", q: "Zeige alle Nodes deines Clusters an.", accept: [/^kubectl\s+get\s+(nodes|node|no)$/], solution: "kubectl get nodes" },
    { id: "c-ch2-2", chapter: "q4", q: "Zeige alle Pods an.", accept: [/^kubectl\s+get\s+(pods|pod|po)$/], solution: "kubectl get pods" },
    { id: "c-ch2-3", chapter: "q5", q: "Zeige die Pods im Namespace <code>kube-system</code>.", accept: [/^kubectl\s+get\s+(pods|pod|po)\s+(-n|--namespace)[=\s]?kube-system$/], solution: "kubectl get pods -n kube-system" },
    { id: "c-ch3-1", chapter: "q6", q: "Erstelle ein Deployment <code>shop</code> mit dem Image <code>nginx</code>.", accept: [/^kubectl\s+create\s+deployment\s+shop\s+--image[=\s]nginx(:\S+)?$/], solution: "kubectl create deployment shop --image=nginx" },
    { id: "c-ch3-2", chapter: "q6", q: "Skaliere das Deployment <code>shop</code> auf 4 Kopien.", accept: [/^kubectl\s+scale\s+deployment\s+shop\s+--replicas[=\s]4$/], solution: "kubectl scale deployment shop --replicas=4" },
    { id: "c-ch3-3", chapter: "q7", q: "Stelle einen Service vor das Deployment <code>shop</code>, Port 80.", accept: [/^kubectl\s+expose\s+deployment\s+shop\s+--port[=\s]80(\s.*)?$/], solution: "kubectl expose deployment shop --port=80" },
    { id: "c-ch4-1", chapter: "q8", q: "Wende die Datei <code>app.yaml</code> deklarativ auf den Cluster an.", accept: [/^kubectl\s+apply\s+-f\s+app\.yaml$/], solution: "kubectl apply -f app.yaml" },
    { id: "c-ch5-1", chapter: "q10", q: "Installiere das Chart <code>bitnami/redis</code> als Release <code>cache</code>.", accept: [/^helm\s+install\s+cache\s+bitnami\/redis$/], solution: "helm install cache bitnami/redis" },
    { id: "c-ch5-2", chapter: "q10", q: "Zeige alle installierten Helm-Releases an.", accept: [/^helm\s+(list|ls)$/], solution: "helm list" },
    { id: "c-ch5-3", chapter: "q11", q: "Rolle das Release <code>cache</code> auf Revision 1 zurück.", accept: [/^helm\s+rollback\s+cache\s+1$/], solution: "helm rollback cache 1" },
    { id: "c-ch6-1", chapter: "q12", q: "Initialisiere ein frisches Terraform-Projekt.", accept: [/^terraform\s+init$/], solution: "terraform init" },
    { id: "c-ch6-2", chapter: "q12", q: "Zeige an, was Terraform tun WÜRDE – ohne es zu tun.", accept: [/^terraform\s+plan$/], solution: "terraform plan" },
    { id: "c-ch6-3", chapter: "q13", q: "Setze die Terraform-Konfiguration wirklich um.", accept: [/^terraform\s+apply(\s+-auto-approve)?$/], solution: "terraform apply" },
    { id: "c-sec-1", chapter: "q14", q: "Lege ein Secret <code>api-key</code> mit <code>--from-literal=key=abc123</code> an.", accept: [/^kubectl\s+create\s+secret\s+generic\s+api-key\s+--from-literal[=\s][\w.-]+=\S+$/], solution: "kubectl create secret generic api-key --from-literal=key=abc123" },
    { id: "c-ts-1", chapter: "q15", q: "Tausche das Image des Deployments <code>shop</code> gegen <code>nginx</code> (Container heißt auch <code>shop</code>).", accept: [/^kubectl\s+set\s+image\s+deployment\/shop\s+\S+=nginx(:\S+)?$/], solution: "kubectl set image deployment/shop shop=nginx" },
    { id: "c-ts-2", chapter: "q16", q: "Starte alle Pods des Deployments <code>shop</code> sauber neu.", accept: [/^kubectl\s+rollout\s+restart\s+deployment[\/\s]shop$/], solution: "kubectl rollout restart deployment shop" },
    { id: "c-git-1", chapter: "q18", q: "Mach aus dem aktuellen Ordner ein Git-Repository.", accept: [/^git\s+init$/], solution: "git init" },
    { id: "c-git-2", chapter: "q18", q: "Merke die Datei <code>seekarte.md</code> für den nächsten Commit vor.", accept: [/^git\s+add\s+seekarte\.md$/], solution: "git add seekarte.md" },
    { id: "c-git-3", chapter: "q18", q: "Halte die vorgemerkten Änderungen fest (Nachricht: <code>Erste Seekarte</code>).", accept: [/^git\s+commit\s+-m\s+("[^"]+"|'[^']+'|\S+)$/], solution: 'git commit -m "Erste Seekarte"' },
    { id: "c-git-4", chapter: "q19", q: "Lege den Branch <code>experiment-route</code> an und wechsle hinein.", accept: [/^git\s+checkout\s+-b\s+experiment-route$/], solution: "git checkout -b experiment-route" },
    { id: "c-git-5", chapter: "q19", q: "Führe <code>experiment-route</code> in deinen aktuellen Branch zusammen.", accept: [/^git\s+merge\s+experiment-route$/], solution: "git merge experiment-route" },
    { id: "c-ci-1", chapter: "q20", q: "Schau dir den Status der letzten GitLab-Pipeline an.", accept: [/^glab\s+ci\s+status$/], solution: "glab ci status" },
    { id: "c-ci-2", chapter: "q20", q: "Merke ALLE Änderungen auf einmal für den nächsten Commit vor.", accept: [/^git\s+add\s+\.$/], solution: "git add ." },
  ];

  /* ---------- Stapel-Spiel: Docker-Image-Schichten ---------- */
  const STACK_ROUNDS = [
    { name: "Webserver-Image", layers: ["FROM ubuntu (Basis-Betriebssystem)", "RUN apt install nginx (Software installieren)", "COPY index.html (deine Dateien)", "CMD nginx (Startbefehl)"] },
    { name: "Python-App", layers: ["FROM python:3.12 (Basis mit Python)", "COPY requirements.txt (Abhängigkeiten-Liste)", "RUN pip install (Bibliotheken installieren)", "COPY app.py (dein Code)", "CMD python app.py (Startbefehl)"] },
    { name: "Java-Dienst", layers: ["FROM eclipse-temurin (Basis mit Java)", "COPY build/libs/app.jar (das fertige Programm)", "EXPOSE 8080 (Port freigeben)", "CMD java -jar app.jar (Startbefehl)"] },
  ];

  /** Buchstabendreher für Sturm-Events: macht aus jedem Image-Namen garantiert einen anderen. */
  function corruptImage(img) {
    for (let i = 1; i < img.length - 1; i++) {
      if (img[i] !== img[i + 1]) return img.slice(0, i) + img[i + 1] + img[i] + img.slice(i + 2);
    }
    return img + "x";
  }

  export const KQContent = { RANKS, SHOP, NPCS, PLAYER_SPRITES, QUESTS, SMALLTALK, CRAB_QUIZ, CMD_CARDS, DRILLS, PRACTICE, STACK_ROUNDS, corruptImage };
