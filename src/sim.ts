/* ===== KubeQuest – Terminal-Simulator =====
 * Simuliert einen kleinen Kubernetes-Cluster samt Docker, Helm und Terraform.
 * Kein echtes Cluster nötig – aber die Befehle und Ausgaben fühlen sich echt an.
 */

  // Bekannte Container-Images – Grundlage für die „Meintest du …?"-Tippfehlerhilfe.
  // Enthält alle im Spiel benutzten plus echte Tools, die man als DevOps kennt.
  const KNOWN_IMAGES = [
    "nginx", "redis", "httpd", "busybox", "postgres", "rabbitmq",
    "mysql", "mariadb", "mongo", "memcached", "node", "python", "golang",
    "alpine", "ubuntu", "debian", "traefik", "envoy", "haproxy", "vault",
    "keycloak", "grafana", "prometheus", "wordpress", "nextcloud",
  ];

  let podCounter = 0;

  function randSuffix(len) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let s = "";
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  function makePodName(depName) {
    podCounter++;
    return depName + "-" + randSuffix(9) + "-" + randSuffix(5);
  }

  function pad(s, n) {
    s = String(s);
    return s.length >= n ? s + "  " : s + " ".repeat(n - s.length);
  }

  function table(headers, rows) {
    const widths = headers.map((h, i) =>
      Math.max(h.length, ...rows.map(r => String(r[i]).length)) + 3
    );
    const lines = [headers.map((h, i) => pad(h, widths[i])).join("").trimEnd()];
    for (const r of rows) {
      lines.push(r.map((c, i) => pad(c, widths[i])).join("").trimEnd());
    }
    return lines.join("\n");
  }

  class Sim {
    scenario: any;
    clock: number;
    docker: { pulled: string[]; containers: any[] };
    nodes: any[];
    deployments: any[];
    services: any[];
    secrets: any[];
    files: Record<string, string>;
    applyEffects: Record<string, any>;
    helmRepos: string[];
    releases: any[];
    tf: { initialized: boolean; applied: boolean; resources: any[] };
    lastDeletedPod: any;
    lastError: boolean;

    constructor(scenario) {
      this.scenario = scenario || {};
      this.reset();
    }

    reset() {
      const sc = this.scenario;
      this.clock = 0; // jede Eingabe = ~20s Spielzeit, für AGE-Spalten

      this.docker = {
        pulled: (sc.dockerImages || []).slice(),
        containers: (sc.dockerContainers || []).map(c => Object.assign({}, c)),
      };

      this.nodes = (sc.nodes || [
        { name: "ahoi-control", status: "Ready", roles: "control-plane", version: "v1.30.2" },
        { name: "ahoi-worker-1", status: "Ready", roles: "<none>", version: "v1.30.2" },
        { name: "ahoi-worker-2", status: "Ready", roles: "<none>", version: "v1.30.2" },
      ]).map(n => Object.assign({}, n));

      this.deployments = (sc.deployments || []).map(d => this._makeDeployment(d.name, d.image, d.replicas, d.broken));
      this.services = (sc.services || []).map(s => Object.assign({}, s));
      this.secrets = (sc.secrets || []).map(s => Object.assign({}, s));
      this.files = Object.assign({}, sc.files || {});
      this.applyEffects = sc.applyEffects || {}; // dateiname -> Wirkung von kubectl apply -f

      this.helmRepos = (sc.helmRepos || []).slice();
      this.releases = (sc.releases || []).map(r => ({
        name: r.name, chart: r.chart, revision: r.revision, depName: r.depName,
        history: (r.history || []).map(h => Object.assign({}, h)),
      }));

      this.tf = {
        initialized: !!sc.tfInitialized,
        applied: !!sc.tfApplied,
        resources: (sc.tfResources || []).slice(), // [{addr, desc}]
      };

      this.lastDeletedPod = null;
      this.lastError = false;
    }

    _makeDeployment(name, image, replicas, broken?) {
      const d = { name, image, replicas, created: this.clock, pods: [], broken: broken ? Object.assign({}, broken) : null };
      for (let i = 0; i < replicas; i++) {
        d.pods.push({ name: makePodName(name), created: this.clock, restarts: 0 });
      }
      return d;
    }

    /** Pod-Status eines Deployments (für get/describe/logs). */
    _podStatus(d) {
      if (!d.broken) return { status: "Running", ready: "1/1", restarts: 0 };
      if (d.broken.type === "imagepull") return { status: "ImagePullBackOff", ready: "0/1", restarts: 0 };
      if (d.broken.type === "crashloop") return { status: "CrashLoopBackOff", ready: "0/1", restarts: 5 };
      if (d.broken.type === "pending") return { status: "Pending", ready: "0/1", restarts: 0 };
      return { status: "Running", ready: "1/1", restarts: 0 };
    }

    /** Pending-Pods bekommen Platz, sobald genug Nodes da sind. */
    _reschedulePending() {
      if (this.nodes.length <= 3) return;
      for (const d of this.deployments) {
        if (d.broken && d.broken.type === "pending") d.broken = null;
      }
    }

    _age(created) {
      const secs = (this.clock - created) * 20 + 15;
      if (secs < 60) return secs + "s";
      const mins = Math.floor(secs / 60);
      if (mins < 60) return mins + "m";
      return Math.floor(mins / 60) + "h";
    }

    _allPods() {
      const pods = [];
      for (const d of this.deployments) for (const p of d.pods) pods.push(p);
      return pods;
    }

    _findDeploymentOfPod(podName) {
      return this.deployments.find(d => d.pods.some(p => p.name === podName));
    }

    /** Quest-Szenario in die laufende Welt mischen (Dateien, Aufträge, Beispiel-Pods …). */
    mergeScenario(sc) {
      if (!sc) return;
      Object.assign(this.files, sc.files || {});
      Object.assign(this.applyEffects, sc.applyEffects || {});
      if (sc.tfResources) { this.tf.resources = sc.tfResources.slice(); this.tf.initialized = false; this.tf.applied = false; }
      for (const img of sc.dockerImages || []) {
        if (!this.docker.pulled.includes(img)) this.docker.pulled.push(img);
      }
      for (const d of sc.deployments || []) {
        if (!this.deployments.some(x => x.name === d.name)) {
          this.deployments.push(this._makeDeployment(d.name, d.image, d.replicas, d.broken));
        }
      }
      for (const repo of sc.helmRepos || []) {
        if (!this.helmRepos.includes(repo)) this.helmRepos.push(repo);
      }
    }

    /** Zustand als speicherbares Szenario ausgeben (für localStorage). */
    snapshot() {
      return {
        dockerImages: this.docker.pulled.slice(),
        dockerContainers: this.docker.containers.map(c => Object.assign({}, c)),
        nodes: this.nodes.map(n => Object.assign({}, n)),
        deployments: this.deployments.map(d => ({ name: d.name, image: d.image, replicas: d.replicas, broken: d.broken ? Object.assign({}, d.broken) : null })),
        services: this.services.map(s => Object.assign({}, s)),
        secrets: this.secrets.map(s => ({ name: s.name, keys: s.keys.slice() })),
        files: Object.assign({}, this.files),
        applyEffects: JSON.parse(JSON.stringify(this.applyEffects)),
        helmRepos: this.helmRepos.slice(),
        releases: this.releases.map(r => ({
          name: r.name, chart: r.chart, revision: r.revision, depName: r.depName,
          history: r.history.map(h => Object.assign({}, h)),
        })),
        tfResources: this.tf.resources.slice(),
        tfInitialized: this.tf.initialized,
        tfApplied: this.tf.applied,
      };
    }

    /** Führt eine Befehlszeile aus. Rückgabe: { output, error } */
    exec(line) {
      this.clock++;
      this.lastError = false;
      const raw = line.trim();
      if (!raw) return { output: "", error: false };

      const tokens = raw.split(/\s+/);
      const cmd = tokens[0];

      let out;
      try {
        switch (cmd) {
          case "docker": out = this._docker(tokens, raw); break;
          case "kubectl": out = this._kubectl(tokens, raw); break;
          case "helm": out = this._helm(tokens, raw); break;
          case "terraform": out = this._terraform(tokens, raw); break;
          case "ls": out = this._ls(); break;
          case "cat": out = this._cat(tokens); break;
          case "clear": return { output: null, error: false, clear: true };
          case "help": out = this._help(); break;
          default: {
            const guess = this._suggest(cmd, ["docker", "kubectl", "helm", "terraform", "ls", "cat", "clear", "help"]);
            out = this._err("⚠️ Den Befehl '" + cmd + "' gibt es hier nicht.",
              guess ? "Meintest du '" + guess + "'? (Tippe 'help' für alle Befehle.)"
                    : "Tippe 'help' für eine Liste der Befehle, die hier funktionieren.");
          }
        }
      } catch (e) {
        this.lastError = true;
        out = "Hoppla, da ist im Simulator etwas schiefgegangen: " + e.message;
      }
      return { output: out, error: this.lastError };
    }

    _err(msg, tip?) {
      this.lastError = true;
      return msg + (tip ? "\n💡 " + tip : "");
    }

    /** Editierdistanz (Levenshtein) – für „Meintest du …?"-Vorschläge. */
    _editDistance(a, b) {
      const m = a.length, n = b.length;
      const d = Array.from({ length: m + 1 }, (_, i) => [i].concat(new Array(n).fill(0)));
      for (let j = 0; j <= n; j++) d[0][j] = j;
      for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      }
      return d[m][n];
    }

    /** Prüft ein Docker-Image auf Tippfehler. Gibt eine Fehlermeldung zurück oder null (alles ok). */
    _checkImageTypo(img) {
      const bare = img.split(":")[0].split("/").pop().toLowerCase();
      if (KNOWN_IMAGES.includes(bare)) return null;
      const guess = this._suggest(bare, KNOWN_IMAGES);
      if (guess) {
        return this._err('⚠️ Das Image "' + bare + '" kennt die Registry nicht.',
          "Tippfehler? Meintest du \"" + guess + "\"? (So entsteht im echten Cluster ein ImagePullBackOff!)");
      }
      return null; // unbekannt, aber kein klarer Tippfehler -> zum Ausprobieren erlauben
    }

    /** Nächstliegendes bekanntes Wort, wenn nah genug dran (sonst null). */
    _suggest(word, list) {
      let best = null, bestD = Infinity;
      for (const cand of list) {
        const dist = this._editDistance(word.toLowerCase(), cand.toLowerCase());
        if (dist < bestD) { bestD = dist; best = cand; }
      }
      const limit = word.length <= 4 ? 1 : 2; // bei kurzen Wörtern strenger
      return bestD <= limit && bestD > 0 ? best : null;
    }

    /** Wert hinter einer Flag finden: unterstützt "-n wert" und "-n=wert". */
    _flagValue(tokens, flag) {
      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === flag) return tokens[i + 1] || null;
        if (tokens[i].startsWith(flag + "=")) return tokens[i].slice(flag.length + 1);
      }
      return null;
    }

    _help() {
      return [
        "Verfügbare Befehle im Simulator:",
        "  docker     pull | run | ps [-a] | images | stop | rm",
        "  kubectl    get pods|deployments|services|nodes|secrets | describe pod <name>",
        "             create deployment | create secret generic | scale | expose | delete | apply -f <datei>",
        "             logs <pod> | set image deployment/<n> <c>=<img> | rollout restart deployment <n>",
        "  helm       repo add|update | search repo | install | list | upgrade | rollback | uninstall | status",
        "  terraform  init | plan | apply | destroy | state list",
        "  ls, cat <datei>, clear, help",
      ].join("\n");
    }

    /* ===================== docker ===================== */
    _docker(t, _raw?) {
      const sub = t[1];
      if (!sub) return this._err("docker: Unterbefehl fehlt.", "Probier z.B. 'docker ps'.");

      if (sub === "pull") {
        const img = t[2];
        if (!img) return this._err("docker pull: Welches Image denn?", "z.B. 'docker pull nginx'");
        const typo = this._checkImageTypo(img);
        if (typo) return typo;
        const full = img.includes(":") ? img : img + ":latest";
        if (!this.docker.pulled.includes(full)) this.docker.pulled.push(full);
        return [
          "Using default tag: latest",
          "latest: Pulling from library/" + img.split(":")[0],
          "a2abf6c4d29d: Pull complete",
          "f3409a9a9e73: Pull complete",
          "Status: Downloaded newer image for " + full,
          "docker.io/library/" + full,
        ].join("\n");
      }

      if (sub === "images") {
        if (this.docker.pulled.length === 0) return "REPOSITORY   TAG   IMAGE ID   CREATED   SIZE";
        return table(
          ["REPOSITORY", "TAG", "IMAGE ID", "SIZE"],
          this.docker.pulled.map(img => {
            const [repo, tag] = img.split(":");
            return [repo, tag || "latest", randSuffix(12), Math.floor(Math.random() * 150 + 20) + "MB"];
          })
        );
      }

      if (sub === "run") {
        // docker run [-d] [--name X] [-p a:b] IMAGE
        let name = null, image = null;
        for (let i = 2; i < t.length; i++) {
          if (t[i] === "--name") { name = t[i + 1]; i++; }
          else if (t[i] === "-d" || t[i] === "--detach") { /* ok */ }
          else if (t[i] === "-p" || t[i] === "--publish") { i++; }
          else if (!t[i].startsWith("-")) image = t[i];
        }
        if (!image) return this._err("docker run: Es fehlt das Image.", "z.B. 'docker run -d --name webserver nginx'");
        const typo = this._checkImageTypo(image);
        if (typo) return typo;
        if (!name) name = image.split(":")[0] + "-" + randSuffix(4);
        if (this.docker.containers.some(c => c.name === name && c.running)) {
          return this._err('docker: Container-Name "' + name + '" wird schon benutzt.', "Nimm einen anderen Namen oder stoppe den alten Container.");
        }
        const full = image.includes(":") ? image : image + ":latest";
        if (!this.docker.pulled.includes(full)) this.docker.pulled.push(full);
        this.docker.containers.push({ name, image: full, running: true, created: this.clock, id: randSuffix(12) });
        return randSuffix(64);
      }

      if (sub === "ps") {
        const all = t.includes("-a") || t.includes("--all");
        const list = this.docker.containers.filter(c => all || c.running);
        if (list.length === 0) return "CONTAINER ID   IMAGE   COMMAND   CREATED   STATUS   PORTS   NAMES" + (all ? "" : "\n💡 Keine laufenden Container. Mit 'docker ps -a' siehst du auch gestoppte.");
        return table(
          ["CONTAINER ID", "IMAGE", "STATUS", "NAMES"],
          list.map(c => [c.id, c.image, c.running ? "Up " + this._age(c.created) : "Exited (0) " + this._age(c.created) + " ago", c.name])
        );
      }

      if (sub === "stop") {
        const name = t[2];
        if (!name) return this._err("docker stop: Welcher Container?", "Den Namen siehst du mit 'docker ps' in der Spalte NAMES.");
        const c = this.docker.containers.find(c => c.name === name || c.id === name);
        if (!c) return this._err("Error: No such container: " + name, "Mit 'docker ps' siehst du alle laufenden Container.");
        c.running = false;
        return name;
      }

      if (sub === "rm") {
        const name = t[2];
        if (!name) return this._err("docker rm: Welcher Container?");
        const idx = this.docker.containers.findIndex(c => c.name === name || c.id === name);
        if (idx === -1) return this._err("Error: No such container: " + name);
        if (this.docker.containers[idx].running) return this._err("Error: Container läuft noch.", "Erst 'docker stop " + name + "', dann löschen.");
        this.docker.containers.splice(idx, 1);
        return name;
      }

      return this._err("docker: unbekannter Unterbefehl '" + sub + "'", "Tippe 'help' für alle Befehle.");
    }

    /* ===================== kubectl ===================== */
    _kubectl(t, raw) {
      const sub = t[1];
      if (!sub) return this._err("kubectl: Unterbefehl fehlt.", "Probier z.B. 'kubectl get pods'.");

      if (sub === "get") return this._kubectlGet(t);
      if (sub === "describe") return this._kubectlDescribe(t);
      if (sub === "create") return this._kubectlCreate(t, raw);
      if (sub === "scale") return this._kubectlScale(t, raw);
      if (sub === "expose") return this._kubectlExpose(t, raw);
      if (sub === "delete") return this._kubectlDelete(t);
      if (sub === "apply") return this._kubectlApply(t);
      if (sub === "logs") return this._kubectlLogs(t);
      if (sub === "set") return this._kubectlSetImage(t);
      if (sub === "rollout") return this._kubectlRollout(t);

      return this._err("kubectl: unbekannter Unterbefehl '" + sub + "'", "Tippe 'help' für alle Befehle.");
    }

    _kubectlGet(t) {
      const what = (t[2] || "").toLowerCase();
      const ns = this._flagValue(t, "-n") || this._flagValue(t, "--namespace");
      const allNs = t.includes("-A") || t.includes("--all-namespaces");

      if (["pods", "pod", "po"].includes(what)) {
        if (ns === "kube-system" || allNs) {
          const sysPods = [
            ["coredns-7db6d8ff4d-x2x9p", "1/1", "Running", "0", "3d"],
            ["etcd-ahoi-control", "1/1", "Running", "0", "3d"],
            ["kube-apiserver-ahoi-control", "1/1", "Running", "0", "3d"],
            ["kube-scheduler-ahoi-control", "1/1", "Running", "0", "3d"],
          ];
          const rows = allNs
            ? sysPods.map(r => ["kube-system"].concat(r)).concat(this._allPods().map(p => ["default", p.name, "1/1", "Running", String(p.restarts), this._age(p.created)]))
            : sysPods;
          return table(allNs ? ["NAMESPACE", "NAME", "READY", "STATUS", "RESTARTS", "AGE"] : ["NAME", "READY", "STATUS", "RESTARTS", "AGE"], rows);
        }
        this._reschedulePending();
        const rows = [];
        for (const d of this.deployments) {
          const st = this._podStatus(d);
          for (const p of d.pods) rows.push([p.name, st.ready, st.status, String(st.restarts || p.restarts), this._age(p.created)]);
        }
        if (rows.length === 0) return "No resources found in default namespace.";
        return table(["NAME", "READY", "STATUS", "RESTARTS", "AGE"], rows);
      }

      if (["deployments", "deployment", "deploy"].includes(what)) {
        if (this.deployments.length === 0) return "No resources found in default namespace.";
        return table(["NAME", "READY", "UP-TO-DATE", "AVAILABLE", "AGE"],
          this.deployments.map(d => [d.name, d.replicas + "/" + d.replicas, String(d.replicas), String(d.replicas), this._age(d.created)]));
      }

      if (["services", "service", "svc"].includes(what)) {
        const rows = [["kubernetes", "ClusterIP", "10.96.0.1", "<none>", "443/TCP", "3d"]];
        for (const s of this.services) rows.push([s.name, s.type, s.clusterIP, "<none>", s.port + "/TCP", this._age(s.created || 0)]);
        return table(["NAME", "TYPE", "CLUSTER-IP", "EXTERNAL-IP", "PORT(S)", "AGE"], rows);
      }

      if (["nodes", "node", "no"].includes(what)) {
        return table(["NAME", "STATUS", "ROLES", "AGE", "VERSION"],
          this.nodes.map(n => [n.name, n.status, n.roles, "3d", n.version]));
      }

      if (["secrets", "secret"].includes(what)) {
        if (this.secrets.length === 0) return "No resources found in default namespace.";
        return table(["NAME", "TYPE", "DATA", "AGE"],
          this.secrets.map(s => [s.name, "Opaque", String(s.keys.length), this._age(s.created || 0)]));
      }

      if (!what) return this._err("kubectl get: Was möchtest du sehen?", "z.B. 'kubectl get pods' oder 'kubectl get nodes'");
      return this._err('error: the server doesn\'t have a resource type "' + what + '"', "Gemeint war vielleicht: pods, deployments, services oder nodes?");
    }

    _kubectlDescribe(t) {
      const what = (t[2] || "").toLowerCase();
      const name = t[3];
      if (!["pod", "pods"].includes(what)) return this._err("Der Simulator kann nur 'kubectl describe pod <name>'.");
      if (!name) return this._err("kubectl describe pod: Welcher Pod?", "Die Namen siehst du mit 'kubectl get pods'.");
      const pod = this._allPods().find(p => p.name === name);
      if (!pod) return this._err('Error from server (NotFound): pods "' + name + '" not found', "Tipp: Pod-Namen kannst du aus 'kubectl get pods' kopieren.");
      const dep = this._findDeploymentOfPod(name);
      const st = this._podStatus(dep);
      const events = ["  Type    Reason     Age   Message", "  ----    ------     ----  -------"];
      if (!dep.broken) {
        events.push("  Normal  Scheduled  " + this._age(pod.created) + "   Successfully assigned default/" + pod.name);
        events.push("  Normal  Pulled     " + this._age(pod.created) + "   Container image \"" + dep.image + "\" already present");
        events.push("  Normal  Started    " + this._age(pod.created) + "   Started container " + dep.name);
      } else if (dep.broken.type === "imagepull") {
        events.push("  Normal   Scheduled  " + this._age(pod.created) + "   Successfully assigned default/" + pod.name);
        events.push("  Warning  Failed     " + this._age(pod.created) + "   Failed to pull image \"" + dep.image + "\": repository does not exist or may require authorization");
        events.push("  Warning  Failed     " + this._age(pod.created) + "   Error: ImagePullBackOff");
      } else if (dep.broken.type === "crashloop") {
        events.push("  Normal   Scheduled  " + this._age(pod.created) + "   Successfully assigned default/" + pod.name);
        events.push("  Normal   Started    " + this._age(pod.created) + "   Started container " + dep.name);
        events.push("  Warning  BackOff    " + this._age(pod.created) + "   Back-off restarting failed container (Tipp: kubectl logs " + pod.name + ")");
      } else if (dep.broken.type === "pending") {
        events.push("  Warning  FailedScheduling  " + this._age(pod.created) + "   0/" + this.nodes.length + " nodes are available: insufficient capacity.");
      }
      return [
        "Name:         " + pod.name,
        "Namespace:    default",
        "Node:         " + (dep.broken && dep.broken.type === "pending" ? "<none>" : this.nodes[1].name),
        "Status:       " + (st.status === "Running" ? "Running" : st.status === "Pending" ? "Pending" : "Waiting (" + st.status + ")"),
        "IP:           " + (dep.broken && dep.broken.type === "pending" ? "<none>" : "10.244.1." + (10 + Math.floor(Math.random() * 200))),
        "Controlled By: ReplicaSet/" + dep.name,
        "Containers:",
        "  " + dep.name + ":",
        "    Image:        " + dep.image,
        "    State:        " + st.status,
        "    Restart Count: " + (st.restarts || pod.restarts),
        "Events:",
      ].concat(events).join("\n");
    }

    _kubectlCreate(t, raw) {
      if (t[2] === "secret") {
        // kubectl create secret generic <name> --from-literal=schluessel=wert
        if (t[3] !== "generic") return this._err("Der Simulator kann nur 'kubectl create secret generic <name> --from-literal=k=v'.");
        const name = t[4];
        if (!name || name.startsWith("--")) return this._err("kubectl create secret: Der Name fehlt.", "Muster: kubectl create secret generic <name> --from-literal=schluessel=wert");
        const literals = [...raw.matchAll(/--from-literal[=\s]([\w.-]+)=(\S+)/g)].map(m => m[1]);
        if (literals.length === 0) return this._err("error: at least one --from-literal is required", "Häng '--from-literal=passwort=geheim123' an.");
        if (this.secrets.some(s => s.name === name)) return this._err('error: secrets "' + name + '" already exists');
        this.secrets.push({ name, keys: literals, created: this.clock });
        return "secret/" + name + " created";
      }
      if (t[2] !== "deployment") return this._err("Der Simulator kann nur 'kubectl create deployment ...' und 'kubectl create secret generic ...'.");
      const name = t[3];
      const imgMatch = raw.match(/--image[=\s]+(\S+)/);
      if (!name || name.startsWith("--")) return this._err("kubectl create deployment: Der Name fehlt.", "z.B. 'kubectl create deployment kasse --image=nginx'");
      if (!imgMatch) return this._err("error: required flag(s) \"image\" not set", "Häng '--image=nginx' an.");
      if (this.deployments.some(d => d.name === name)) return this._err('error: deployment "' + name + '" already exists');
      this.deployments.push(this._makeDeployment(name, imgMatch[1], 1));
      return "deployment.apps/" + name + " created";
    }

    _kubectlScale(t, raw) {
      const name = t[3] === "deployment" ? t[4] : (t[2] === "deployment" ? t[3] : null);
      const repMatch = raw.match(/--replicas[=\s]+(\d+)/);
      if (!name || !repMatch) return this._err("kubectl scale: So nicht ganz.", "Muster: 'kubectl scale deployment <name> --replicas=3'");
      const dep = this.deployments.find(d => d.name === name);
      if (!dep) return this._err('Error from server (NotFound): deployments.apps "' + name + '" not found', "Welche Deployments es gibt: 'kubectl get deployments'");
      const target = parseInt(repMatch[1], 10);
      while (dep.pods.length < target) dep.pods.push({ name: makePodName(dep.name), created: this.clock, restarts: 0 });
      while (dep.pods.length > target) dep.pods.pop();
      dep.replicas = target;
      return "deployment.apps/" + name + " scaled";
    }

    _kubectlExpose(t, raw) {
      const name = t[3] === "deployment" ? t[4] : (t[2] === "deployment" ? t[3] : null);
      const portMatch = raw.match(/--port[=\s]+(\d+)/);
      if (!name) return this._err("kubectl expose: Welches Deployment?", "Muster: 'kubectl expose deployment <name> --port=80'");
      const dep = this.deployments.find(d => d.name === name);
      if (!dep) return this._err('Error from server (NotFound): deployments.apps "' + name + '" not found');
      if (!portMatch) return this._err("error: couldn't find port via --port flag or introspection", "Häng '--port=80' an.");
      if (this.services.some(s => s.name === name)) return this._err('Error from server (AlreadyExists): services "' + name + '" already exists');
      const typeMatch = raw.match(/--type[=\s]+(\S+)/);
      this.services.push({
        name,
        type: typeMatch ? typeMatch[1] : "ClusterIP",
        clusterIP: "10.96." + Math.floor(Math.random() * 250) + "." + Math.floor(Math.random() * 250),
        port: portMatch[1],
        created: this.clock,
      });
      return "service/" + name + " exposed";
    }

    _kubectlDelete(t) {
      const what = (t[2] || "").toLowerCase();
      const name = t[3];

      if (what === "-f") {
        const file = t[3];
        const eff = this.applyEffects[file];
        if (!eff || !this.files[file]) return this._err("error: the path \"" + (file || "?") + "\" does not exist", "Mit 'ls' siehst du, welche Dateien hier liegen.");
        const out = [];
        if (eff.deployment) {
          const i = this.deployments.findIndex(d => d.name === eff.deployment.name);
          if (i >= 0) { this.deployments.splice(i, 1); out.push('deployment.apps "' + eff.deployment.name + '" deleted'); }
        }
        if (eff.service) {
          const i = this.services.findIndex(s => s.name === eff.service.name);
          if (i >= 0) { this.services.splice(i, 1); out.push('service "' + eff.service.name + '" deleted'); }
        }
        return out.join("\n") || "nothing deleted";
      }

      if (!name) return this._err("kubectl delete: Was und wie heißt es?", "z.B. 'kubectl delete pod <pod-name>'");

      if (["pod", "pods", "po"].includes(what)) {
        const dep = this._findDeploymentOfPod(name);
        if (!dep) return this._err('Error from server (NotFound): pods "' + name + '" not found', "Pod-Namen siehst du mit 'kubectl get pods'.");
        const idx = dep.pods.findIndex(p => p.name === name);
        dep.pods.splice(idx, 1);
        this.lastDeletedPod = name;
        // Self-Healing: das Deployment ersetzt den Pod sofort!
        dep.pods.push({ name: makePodName(dep.name), created: this.clock, restarts: 0 });
        return 'pod "' + name + '" deleted';
      }

      if (["deployment", "deployments", "deploy"].includes(what)) {
        const idx = this.deployments.findIndex(d => d.name === name);
        if (idx === -1) return this._err('Error from server (NotFound): deployments.apps "' + name + '" not found');
        this.deployments.splice(idx, 1);
        return 'deployment.apps "' + name + '" deleted';
      }

      if (["service", "services", "svc"].includes(what)) {
        const idx = this.services.findIndex(s => s.name === name);
        if (idx === -1) return this._err('Error from server (NotFound): services "' + name + '" not found');
        this.services.splice(idx, 1);
        return 'service "' + name + '" deleted';
      }

      if (["secret", "secrets"].includes(what)) {
        const idx = this.secrets.findIndex(s => s.name === name);
        if (idx === -1) return this._err('Error from server (NotFound): secrets "' + name + '" not found');
        this.secrets.splice(idx, 1);
        return 'secret "' + name + '" deleted';
      }

      return this._err("kubectl delete: Ressourcentyp '" + what + "' kennt der Simulator nicht.");
    }

    _kubectlApply(t) {
      const fIdx = t.indexOf("-f");
      const file = fIdx >= 0 ? t[fIdx + 1] : null;
      if (!file) return this._err("error: must specify one of -f or -k", "Muster: 'kubectl apply -f deployment.yaml'");
      if (!this.files[file]) return this._err("error: the path \"" + file + "\" does not exist", "Mit 'ls' siehst du, welche Dateien hier liegen.");
      const eff = this.applyEffects[file];
      if (!eff) return this._err("error: unable to decode " + file);
      const out = [];
      if (eff.deployment) {
        const existing = this.deployments.find(d => d.name === eff.deployment.name);
        if (existing) {
          out.push("deployment.apps/" + eff.deployment.name + " unchanged");
        } else {
          this.deployments.push(this._makeDeployment(eff.deployment.name, eff.deployment.image, eff.deployment.replicas));
          out.push("deployment.apps/" + eff.deployment.name + " created");
        }
      }
      if (eff.service) {
        const existing = this.services.find(s => s.name === eff.service.name);
        if (existing) {
          out.push("service/" + eff.service.name + " unchanged");
        } else {
          this.services.push({
            name: eff.service.name, type: eff.service.type || "ClusterIP",
            clusterIP: "10.96." + Math.floor(Math.random() * 250) + "." + Math.floor(Math.random() * 250),
            port: eff.service.port, created: this.clock,
          });
          out.push("service/" + eff.service.name + " created");
        }
      }
      return out.join("\n");
    }

    _kubectlLogs(t) {
      const name = t[2];
      if (!name) return this._err("kubectl logs: Welcher Pod?", "Pod-Namen siehst du mit 'kubectl get pods'.");
      const pod = this._allPods().find(p => p.name === name);
      if (!pod) return this._err('Error from server (NotFound): pods "' + name + '" not found');
      const dep = this._findDeploymentOfPod(name);
      if (dep.broken && dep.broken.type === "imagepull") {
        return this._err('Error from server (BadRequest): container "' + dep.name + '" in pod "' + name + '" is waiting to start: trying and failing to pull image',
          "Keine Logs ohne Image! Die Ursache steht in den Events: kubectl describe pod " + name);
      }
      if (dep.broken && dep.broken.type === "crashloop") {
        return [
          "[start] Dienst " + dep.name + " startet …",
          "[start] Lese Konfiguration …",
          "FATAL: Secret '" + dep.broken.needsSecret + "' nicht gefunden – Dienst kann nicht starten!",
          "[exit] Prozess beendet mit Code 1",
        ].join("\n");
      }
      if (dep.broken && dep.broken.type === "pending") {
        return this._err('Error from server (BadRequest): pod "' + name + '" is not scheduled yet', "Der Pod wartet auf einen freien Node. Schau in die Events: kubectl describe pod " + name);
      }
      return [
        "10.244.1.1 - - [12/Jun/2026:09:14:02 +0000] \"GET / HTTP/1.1\" 200 615",
        "10.244.1.1 - - [12/Jun/2026:09:14:05 +0000] \"GET /gesundheit HTTP/1.1\" 200 2",
        "10.244.2.7 - - [12/Jun/2026:09:14:11 +0000] \"GET /favicon.ico HTTP/1.1\" 404 153",
      ].join("\n");
    }

    /** kubectl set image deployment/<name> <container>=<image> */
    _kubectlSetImage(t) {
      if (t[2] !== "image") return this._err("Der Simulator kann nur 'kubectl set image deployment/<name> <container>=<image>'.");
      let depName = null;
      if (t[3] && t[3].startsWith("deployment/")) depName = t[3].split("/")[1];
      else if (t[3] === "deployment") { depName = t[4]; t = t.slice(0, 4).concat(t.slice(5)); }
      const kv = t.find(x => x.includes("=") && !x.startsWith("--"));
      if (!depName || !kv) return this._err("kubectl set image: So nicht ganz.", "Muster: kubectl set image deployment/<name> <container>=<image>");
      const dep = this.deployments.find(d => d.name === depName);
      if (!dep) return this._err('Error from server (NotFound): deployments.apps "' + depName + '" not found');
      const newImage = kv.split("=")[1];
      const oldBad = dep.broken && dep.broken.type === "imagepull" ? dep.broken.badImage : null;
      dep.image = newImage;
      if (oldBad && newImage !== oldBad) {
        dep.broken = null;
        dep.pods = dep.pods.map(() => ({ name: makePodName(dep.name), created: this.clock, restarts: 0 }));
      }
      return "deployment.apps/" + depName + " image updated" + (oldBad && newImage === oldBad ? "\n💡 Hmm – das ist exakt dasselbe (kaputte) Image. Schau nochmal genau auf den Namen!" : "");
    }

    /** kubectl rollout restart deployment <name> */
    _kubectlRollout(t) {
      if (t[2] !== "restart") return this._err("Der Simulator kann nur 'kubectl rollout restart deployment <name>'.");
      let depName = null;
      if (t[3] && t[3].startsWith("deployment/")) depName = t[3].split("/")[1];
      else if (t[3] === "deployment") depName = t[4];
      if (!depName) return this._err("kubectl rollout restart: Welches Deployment?", "Muster: kubectl rollout restart deployment <name>");
      const dep = this.deployments.find(d => d.name === depName);
      if (!dep) return this._err('Error from server (NotFound): deployments.apps "' + depName + '" not found');
      if (dep.broken && dep.broken.type === "crashloop" && this.secrets.some(s => s.name === dep.broken.needsSecret)) {
        dep.broken = null;
      }
      dep.pods = dep.pods.map(() => ({ name: makePodName(dep.name), created: this.clock, restarts: 0 }));
      return "deployment.apps/" + depName + " restarted";
    }

    /* ===================== helm ===================== */
    _helm(t, raw) {
      const sub = t[1];
      if (!sub) return this._err("helm: Unterbefehl fehlt.", "Probier z.B. 'helm list'.");

      if (sub === "repo") {
        const action = t[2];
        if (action === "add") {
          const name = t[3], url = t[4];
          if (!name || !url) return this._err("helm repo add: Name und URL fehlen.", "z.B. 'helm repo add bitnami https://charts.bitnami.com/bitnami'");
          if (!this.helmRepos.includes(name)) this.helmRepos.push(name);
          return '"' + name + '" has been added to your repositories';
        }
        if (action === "update") {
          if (this.helmRepos.length === 0) return this._err("Error: no repositories found.", "Erst ein Repo hinzufügen: 'helm repo add ...'");
          return "Hang tight while we grab the latest from your chart repositories...\n" +
            this.helmRepos.map(r => '...Successfully got an update from the "' + r + '" chart repository').join("\n") +
            "\nUpdate Complete. ⎈Happy Helming!⎈";
        }
        if (action === "list") {
          if (this.helmRepos.length === 0) return "Error: no repositories to show";
          return table(["NAME", "URL"], this.helmRepos.map(r => [r, "https://charts.bitnami.com/" + r]));
        }
        return this._err("helm repo: unbekannte Aktion '" + (action || "") + "'");
      }

      if (sub === "search") {
        const term = t[3] || "";
        if (this.helmRepos.length === 0) return this._err("Error: no repositories configured", "Erst 'helm repo add bitnami https://charts.bitnami.com/bitnami'");
        const charts = [
          ["bitnami/nginx", "18.1.0", "1.27.0", "NGINX – der beliebte Webserver"],
          ["bitnami/nginx-ingress-controller", "11.3.1", "1.11.1", "Ingress Controller auf NGINX-Basis"],
          ["bitnami/redis", "19.5.2", "7.2.5", "Redis – In-Memory-Datenbank"],
          ["bitnami/postgresql", "15.5.1", "16.3.0", "PostgreSQL-Datenbank"],
        ].filter(c => !term || c[0].includes(term) || c[3].toLowerCase().includes(term.toLowerCase()));
        if (charts.length === 0) return "No results found";
        return table(["NAME", "CHART VERSION", "APP VERSION", "DESCRIPTION"], charts);
      }

      if (sub === "install") {
        const release = t[2], chart = t[3];
        if (!release || !chart || release.startsWith("-")) return this._err("helm install: Release-Name und Chart fehlen.", "Muster: 'helm install <mein-name> bitnami/nginx'");
        if (chart.includes("/") && !this.helmRepos.includes(chart.split("/")[0])) {
          return this._err("Error: repo " + chart.split("/")[0] + " not found", "Erst 'helm repo add ...' ausführen.");
        }
        if (this.releases.some(r => r.name === release)) return this._err("Error: INSTALLATION FAILED: cannot re-use a name that is still in use", "Der Release-Name ist schon vergeben. Nimm 'helm upgrade' oder einen anderen Namen.");
        const replicas = this._setValue(raw, "replicaCount") || 1;
        const depName = release + "-" + chart.split("/").pop().split(":")[0];
        this.deployments.push(this._makeDeployment(depName, chart.split("/").pop() + ":latest", replicas));
        this.services.push({ name: depName, type: "ClusterIP", clusterIP: "10.96.40." + Math.floor(Math.random() * 250), port: "80", created: this.clock });
        this.releases.push({ name: release, chart, revision: 1, depName, history: [{ revision: 1, replicas }] });
        return [
          "NAME: " + release,
          "LAST DEPLOYED: heute",
          "NAMESPACE: default",
          "STATUS: deployed",
          "REVISION: 1",
          "NOTES:",
          "Das Chart wurde installiert! Schau mit 'kubectl get pods' nach,",
          "welche Pods es für dich erzeugt hat. ⎈",
        ].join("\n");
      }

      if (sub === "list" || sub === "ls") {
        if (this.releases.length === 0) return "NAME   NAMESPACE   REVISION   STATUS   CHART";
        return table(["NAME", "NAMESPACE", "REVISION", "STATUS", "CHART"],
          this.releases.map(r => [r.name, "default", String(r.revision), "deployed", r.chart.split("/").pop() + "-18.1.0"]));
      }

      if (sub === "upgrade") {
        const release = t[2], chart = t[3];
        if (!release || !chart) return this._err("helm upgrade: Release und Chart fehlen.", "Muster: 'helm upgrade <release> bitnami/nginx --set replicaCount=3'");
        const rel = this.releases.find(r => r.name === release);
        if (!rel) return this._err('Error: UPGRADE FAILED: "' + release + '" has no deployed releases', "Welche Releases es gibt: 'helm list'");
        const replicas = this._setValue(raw, "replicaCount");
        rel.revision++;
        const newReplicas = replicas || rel.history[rel.history.length - 1].replicas;
        rel.history.push({ revision: rel.revision, replicas: newReplicas });
        const dep = this.deployments.find(d => d.name === rel.depName);
        if (dep && replicas) {
          while (dep.pods.length < replicas) dep.pods.push({ name: makePodName(dep.name), created: this.clock, restarts: 0 });
          while (dep.pods.length > replicas) dep.pods.pop();
          dep.replicas = replicas;
        }
        return 'Release "' + release + '" has been upgraded. Happy Helming!\nREVISION: ' + rel.revision;
      }

      if (sub === "rollback") {
        const release = t[2];
        const targetRev = t[3] ? parseInt(t[3], 10) : null;
        const rel = this.releases.find(r => r.name === release);
        if (!rel) return this._err("Error: release: not found", "Welche Releases es gibt: 'helm list'");
        const target = targetRev
          ? rel.history.find(h => h.revision === targetRev)
          : rel.history[rel.history.length - 2];
        if (!target) return this._err("Error: revision not found", "Verfügbare Revisionen: 1 bis " + rel.revision);
        rel.revision++;
        rel.history.push({ revision: rel.revision, replicas: target.replicas });
        const dep = this.deployments.find(d => d.name === rel.depName);
        if (dep) {
          while (dep.pods.length < target.replicas) dep.pods.push({ name: makePodName(dep.name), created: this.clock, restarts: 0 });
          while (dep.pods.length > target.replicas) dep.pods.pop();
          dep.replicas = target.replicas;
        }
        return "Rollback was a success! Happy Helming!";
      }

      if (sub === "uninstall" || sub === "delete") {
        const release = t[2];
        const idx = this.releases.findIndex(r => r.name === release);
        if (idx === -1) return this._err("Error: uninstall: Release not loaded: " + (release || "?") + ": release: not found", "Welche Releases es gibt: 'helm list'");
        const rel = this.releases[idx];
        this.deployments = this.deployments.filter(d => d.name !== rel.depName);
        this.services = this.services.filter(s => s.name !== rel.depName);
        this.releases.splice(idx, 1);
        return 'release "' + release + '" uninstalled';
      }

      if (sub === "status") {
        const release = t[2];
        const rel = this.releases.find(r => r.name === release);
        if (!rel) return this._err("Error: release: not found");
        return ["NAME: " + rel.name, "NAMESPACE: default", "STATUS: deployed", "REVISION: " + rel.revision].join("\n");
      }

      return this._err("helm: unbekannter Unterbefehl '" + sub + "'", "Tippe 'help' für alle Befehle.");
    }

    _setValue(raw, key) {
      const m = raw.match(new RegExp("--set\\s+" + key + "=(\\d+)"));
      return m ? parseInt(m[1], 10) : null;
    }

    /* ===================== terraform ===================== */
    _terraform(t, _raw?) {
      const sub = t[1];
      if (!sub) return this._err("terraform: Unterbefehl fehlt.", "Probier 'terraform init'.");
      const tf = this.tf;

      if (sub === "init") {
        tf.initialized = true;
        return [
          "Initializing the backend...",
          "Initializing provider plugins...",
          "- Installing hashicorp/local v2.5.1...",
          "",
          "Terraform has been successfully initialized!",
          "",
          "You may now begin working with Terraform. Try running \"terraform plan\".",
        ].join("\n");
      }

      if (!tf.initialized && ["plan", "apply", "destroy"].includes(sub)) {
        return this._err("Error: Backend initialization required, please run \"terraform init\"", "Der Ordner muss erst initialisiert werden: 'terraform init'");
      }

      if (sub === "plan") {
        if (tf.applied) {
          return "No changes. Your infrastructure matches the configuration.\n\n" +
            "Terraform hat verglichen: Was in main.tf steht, existiert schon genau so. Nichts zu tun. 🧘";
        }
        return tf.resources.map(r =>
          "  # " + r.addr + " will be created\n  + resource " + r.addr.replace(".", " \"") + "\" {\n      + " + r.desc + "\n    }"
        ).join("\n\n") +
          "\n\nPlan: " + tf.resources.length + " to add, 0 to change, 0 to destroy.";
      }

      if (sub === "apply") {
        if (tf.applied) return "No changes. Your infrastructure matches the configuration.\n\nApply complete! Resources: 0 added, 0 changed, 0 destroyed.";
        tf.applied = true;
        // Neue Server werden echte Cluster-Nodes – wartende Pods bekommen Platz!
        if (tf.resources.some(r => r.addr.includes("hafen_server"))) {
          for (const name of ["ahoi-worker-3", "ahoi-worker-4"]) {
            if (!this.nodes.some(n => n.name === name)) {
              this.nodes.push({ name, status: "Ready", roles: "<none>", version: "v1.30.2" });
            }
          }
          this._reschedulePending();
        }
        return tf.resources.map(r => r.addr + ": Creating...\n" + r.addr + ": Creation complete after 2s").join("\n") +
          "\n\nApply complete! Resources: " + tf.resources.length + " added, 0 changed, 0 destroyed.";
      }

      if (sub === "destroy") {
        if (!tf.applied) return "No changes. No objects need to be destroyed.";
        tf.applied = false;
        this.nodes = this.nodes.filter(n => !["ahoi-worker-3", "ahoi-worker-4"].includes(n.name));
        return tf.resources.map(r => r.addr + ": Destroying...\n" + r.addr + ": Destruction complete after 1s").join("\n") +
          "\n\nDestroy complete! Resources: " + tf.resources.length + " destroyed.";
      }

      if (sub === "state") {
        if (t[2] !== "list") return this._err("Der Simulator kann nur 'terraform state list'.");
        if (!tf.applied) return this._err("Noch nichts im State.", "Der State füllt sich erst nach 'terraform apply'.");
        return tf.resources.map(r => r.addr).join("\n");
      }

      if (sub === "fmt") return "main.tf";
      if (sub === "validate") return "Success! The configuration is valid.";

      return this._err("terraform: unbekannter Unterbefehl '" + sub + "'", "Tippe 'help' für alle Befehle.");
    }

    /* ===================== Dateisystem ===================== */
    _ls() {
      const names = Object.keys(this.files);
      if (names.length === 0) return "(dieser Ordner ist leer)";
      return names.join("\n");
    }

    _cat(t) {
      const file = t[1];
      if (!file) return this._err("cat: Welche Datei?", "Mit 'ls' siehst du, was hier liegt.");
      if (!this.files[file]) return this._err("cat: " + file + ": Datei nicht gefunden", "Mit 'ls' siehst du, was hier liegt.");
      return this.files[file];
    }
  }

  export { Sim };
