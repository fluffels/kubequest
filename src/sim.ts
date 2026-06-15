/* ===== KubeQuest – Terminal-Simulator =====
 * Simuliert einen kleinen Kubernetes-Cluster samt Docker, Helm und Terraform.
 * Kein echtes Cluster nötig – aber die Befehle und Ausgaben fühlen sich echt an.
 */

import type { ExecResult } from "./types";

/* ---------- Cluster-Domänentypen ----------
 * Echte Interfaces für die simulierten Ressourcen (Pod/Deployment/Service …)
 * statt `any`. Sie sichern Felder + Mutationen im ganzen Simulator ab. */

/** Art einer absichtlich kaputten Workload (für die Troubleshooting-Quests). */
export interface Broken {
  type: string; // "imagepull" | "crashloop" | "pending" | "notready"
  badImage?: string;
  // Fehlendes Secret, das die App braucht. Bei "crashloop" stirbt sie ohne es,
  // bei "notready" läuft sie zwar (liveness ok), meldet sich aber erst als
  // bereit, sobald das Secret da ist (readiness). Sobald es existiert, heilt
  // crashloop per `rollout restart`, notready ganz von selbst (Probe prüft weiter).
  needsSecret?: string;
}
/** Eine einzelne Pod-Instanz eines Deployments. */
export interface PodInstance {
  name: string;
  created: number;
  restarts: number;
}
export interface Deployment {
  name: string;
  image: string;
  replicas: number;
  created: number;
  pods: PodInstance[];
  broken: Broken | null;
}
export interface ServiceRes {
  name: string;
  type: string;
  clusterIP: string;
  port: string | number;
  created?: number;
}
/** Hafentor: leitet eine Außen-Adresse (host/pfad) an einen Service im Cluster. */
export interface IngressRes {
  name: string;
  className: string;      // z.B. "nginx" – welcher Ingress-Controller zuständig ist
  host: string;          // z.B. "hafen.de"
  path: string;          // z.B. "/kasse"
  service: string;       // Ziel-Service im Cluster
  port: string | number; // Ziel-Port des Services
  tls?: { secretName: string }; // verschlüsseltes Hafentor: TLS-Terminierung mit diesem Secret
  created?: number;
}
/** Hafenmauer: regelt, welche Pods überhaupt zu einem Ziel-Pod durchdürfen (Firewall im Cluster). */
export interface NetworkPolicyRes {
  name: string;
  podSelector: string;   // app-Label der geschützten Pods ("" = alle Pods im Namespace)
  allowFrom: string;     // app-Label der einzigen erlaubten Quelle ("" = niemand: default-deny)
  created?: number;
}
export interface Secret {
  name: string;
  keys: string[];
  type?: string;         // z.B. "kubernetes.io/tls" für TLS-Secrets; sonst "Opaque"
  created?: number;
}
export interface ClusterNode {
  name: string;
  status: string;
  roles: string;
  version: string;
}
export interface Container {
  name: string;
  image: string;
  running: boolean;
  created: number;
  id: string;
}
export interface HistoryEntry {
  revision: number;
  replicas: number;
}
export interface Release {
  name: string;
  chart: string;
  revision: number;
  depName: string;
  history: HistoryEntry[];
}
/** Ein lokal mit `helm create` gerüstetes Chart (Werft-Ausbau, Issue #27). */
export interface Chart {
  name: string;
  version: string;
  packaged: boolean;
}
export interface TfResource {
  addr: string;
  desc: string;
}
export interface GitCommit {
  hash: string;
  msg: string;
  branch: string;
  files: string[];
}
export interface PipelineStage {
  name: string;
  status: string;
}
export interface Pipeline {
  id: number;
  ref: string;
  status: string;
  stages: PipelineStage[];
  created: number;
}
export interface CiDeploy {
  name: string;
  image: string;
  replicas: number;
}
/** Wirkung eines `kubectl apply -f <datei>` (was die Datei im Cluster erzeugt). */
export interface ApplyEffect {
  deployment?: { name: string; image: string; replicas: number };
  service?: { name: string; type?: string; port: string | number };
  ingress?: { name: string; host: string; path?: string; service: string; port: string | number; className?: string; tls?: { secretName: string } };
  networkPolicy?: { name: string; podSelector?: string; allowFrom?: string };
}
/** Berechneter Anzeige-Status eines Pods (für get/describe). */
export interface PodStatus {
  status: string;
  ready: string;
  restarts: number;
}

/** Eingabe-Szenario einer Quest-Welt. Alle Felder optional – reset() füllt Defaults. */
export interface Scenario {
  dockerImages?: string[];
  dockerContainers?: Container[];
  nodes?: ClusterNode[];
  deployments?: Array<{ name: string; image: string; replicas: number; broken?: Broken | null }>;
  services?: ServiceRes[];
  ingresses?: IngressRes[];
  networkPolicies?: NetworkPolicyRes[];
  secrets?: Secret[];
  files?: Record<string, string>;
  applyEffects?: Record<string, ApplyEffect>;
  helmRepos?: string[];
  releases?: Array<{ name: string; chart: string; revision: number; depName: string; history?: HistoryEntry[] }>;
  charts?: Array<{ name: string; version?: string; packaged?: boolean }>;
  tfInitialized?: boolean;
  tfApplied?: boolean;
  tfResources?: TfResource[];
  gitInitialized?: boolean;
  gitBranch?: string;
  gitBranches?: string[];
  gitStaged?: string[];
  gitCommitted?: string[];
  gitCommits?: GitCommit[];
  gitPushed?: boolean;
  ciPipelines?: Pipeline[];
  ciDeploy?: CiDeploy | null;
}

  // Bekannte Container-Images – Grundlage für die „Meintest du …?"-Tippfehlerhilfe.
  // Enthält alle im Spiel benutzten plus echte Tools, die man als DevOps kennt.
  const KNOWN_IMAGES = [
    "nginx", "redis", "httpd", "busybox", "postgres", "rabbitmq",
    "mysql", "mariadb", "mongo", "memcached", "node", "python", "golang",
    "alpine", "ubuntu", "debian", "traefik", "envoy", "haproxy", "vault",
    "keycloak", "grafana", "prometheus", "wordpress", "nextcloud",
  ];

  // Alle Ingresses teilen sich die Adresse des einen Ingress-Controllers (wie im echten Cluster).
  const INGRESS_ADDRESS = "203.0.113.10";

  let podCounter = 0;

  function randSuffix(len: number) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let s = "";
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  function makePodName(depName: string) {
    podCounter++;
    return depName + "-" + randSuffix(9) + "-" + randSuffix(5);
  }

  function pad(s: string | number, n: number) {
    const str = String(s);
    return str.length >= n ? str + "  " : str + " ".repeat(n - str.length);
  }

  function table(headers: string[], rows: (string | number)[][]) {
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
    // `!` = definite assignment: alle Felder werden in reset() gesetzt, das der
    // Konstruktor aufruft. TS sieht das nicht durch den Methodenaufruf hindurch.
    scenario: Scenario;
    clock!: number;
    docker!: { pulled: string[]; containers: Container[] };
    nodes!: ClusterNode[];
    deployments!: Deployment[];
    services!: ServiceRes[];
    ingresses!: IngressRes[];
    networkPolicies!: NetworkPolicyRes[];
    secrets!: Secret[];
    files!: Record<string, string>;
    applyEffects!: Record<string, ApplyEffect>;
    helmRepos!: string[];
    releases!: Release[];
    charts!: Chart[];
    tf!: { initialized: boolean; applied: boolean; resources: TfResource[] };
    git!: { initialized: boolean; branch: string; branches: string[]; staged: string[]; committed: string[]; commits: GitCommit[]; pushed: boolean };
    ci!: { pipelines: Pipeline[]; deploy: CiDeploy | null };
    lastDeletedPod: string | null = null;
    lastError!: boolean;

    constructor(scenario: Scenario = {}) {
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
      this.ingresses = (sc.ingresses || []).map(i => Object.assign({}, i));
      this.networkPolicies = (sc.networkPolicies || []).map(n => Object.assign({}, n));
      this.secrets = (sc.secrets || []).map(s => Object.assign({}, s));
      this.files = Object.assign({}, sc.files || {});
      this.applyEffects = sc.applyEffects || {}; // dateiname -> Wirkung von kubectl apply -f

      this.helmRepos = (sc.helmRepos || []).slice();
      this.releases = (sc.releases || []).map(r => ({
        name: r.name, chart: r.chart, revision: r.revision, depName: r.depName,
        history: (r.history || []).map(h => Object.assign({}, h)),
      }));
      this.charts = (sc.charts || []).map(c => ({ name: c.name, version: c.version || "0.1.0", packaged: !!c.packaged }));

      this.tf = {
        initialized: !!sc.tfInitialized,
        applied: !!sc.tfApplied,
        resources: (sc.tfResources || []).slice(), // [{addr, desc}]
      };

      this.git = {
        initialized: !!sc.gitInitialized,
        branch: sc.gitBranch || "main",
        branches: (sc.gitBranches || ["main"]).slice(),
        staged: (sc.gitStaged || []).slice(),
        committed: (sc.gitCommitted || []).slice(),
        commits: (sc.gitCommits || []).map(c => Object.assign({}, c)),
        pushed: !!sc.gitPushed,
      };

      this.ci = {
        pipelines: (sc.ciPipelines || []).map(p => ({
          id: p.id, ref: p.ref, status: p.status, created: p.created,
          stages: (p.stages || []).map(s => Object.assign({}, s)),
        })),
        deploy: sc.ciDeploy ? Object.assign({}, sc.ciDeploy) : null, // {name, image, replicas}, den die deploy-Stage ausrollt
      };

      this.lastDeletedPod = null;
      this.lastError = false;
    }

    _makeDeployment(name: string, image: string, replicas: number, broken?: Broken | null): Deployment {
      const d: Deployment = { name, image, replicas, created: this.clock, pods: [], broken: broken ? Object.assign({}, broken) : null };
      for (let i = 0; i < replicas; i++) {
        d.pods.push({ name: makePodName(name), created: this.clock, restarts: 0 });
      }
      return d;
    }

    /** Pod-Status eines Deployments (für get/describe/logs). */
    _podStatus(d: Deployment): PodStatus {
      if (!d.broken) return { status: "Running", ready: "1/1", restarts: 0 };
      if (d.broken.type === "imagepull") return { status: "ImagePullBackOff", ready: "0/1", restarts: 0 };
      if (d.broken.type === "crashloop") return { status: "CrashLoopBackOff", ready: "0/1", restarts: 5 };
      if (d.broken.type === "pending") return { status: "Pending", ready: "0/1", restarts: 0 };
      // notready: Container läuft (liveness ok) – aber die Readiness-Probe meldet
      // "noch nicht bereit", also Running mit READY 0/1 und kein Restart.
      if (d.broken.type === "notready") return { status: "Running", ready: "0/1", restarts: 0 };
      return { status: "Running", ready: "1/1", restarts: 0 };
    }

    /** Ein Pod ist bereit (zählt für den Service), wenn er läuft UND ready ist. */
    _podReady(d: Deployment): boolean {
      return this._podStatus(d).ready === "1/1";
    }

    /** Pending-Pods bekommen Platz, sobald genug Nodes da sind. */
    _reschedulePending() {
      if (this.nodes.length <= 3) return;
      for (const d of this.deployments) {
        if (d.broken && d.broken.type === "pending") d.broken = null;
      }
    }

    /** Readiness-Probe prüft fortlaufend: liegt das benötigte Secret vor, wird
     * der notready-Pod von selbst bereit – ganz ohne Neustart (anders als Crash). */
    _recheckReadiness() {
      for (const d of this.deployments) {
        if (d.broken && d.broken.type === "notready" &&
            (!d.broken.needsSecret || this.secrets.some(s => s.name === d.broken!.needsSecret))) {
          d.broken = null;
        }
      }
    }

    _age(created: number) {
      const secs = (this.clock - created) * 20 + 15;
      if (secs < 60) return secs + "s";
      const mins = Math.floor(secs / 60);
      if (mins < 60) return mins + "m";
      return Math.floor(mins / 60) + "h";
    }

    _allPods(): PodInstance[] {
      const pods: PodInstance[] = [];
      for (const d of this.deployments) for (const p of d.pods) pods.push(p);
      return pods;
    }

    _findDeploymentOfPod(podName: string): Deployment | undefined {
      return this.deployments.find(d => d.pods.some(p => p.name === podName));
    }

    /** Quest-Szenario in die laufende Welt mischen (Dateien, Aufträge, Beispiel-Pods …). */
    mergeScenario(sc: Scenario | null | undefined) {
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
      for (const c of sc.charts || []) {
        if (!this.charts.some(x => x.name === c.name)) this.charts.push({ name: c.name, version: c.version || "0.1.0", packaged: !!c.packaged });
      }
      for (const ing of sc.ingresses || []) {
        if (!this.ingresses.some(x => x.name === ing.name)) this.ingresses.push(Object.assign({}, ing));
      }
      for (const np of sc.networkPolicies || []) {
        if (!this.networkPolicies.some(x => x.name === np.name)) this.networkPolicies.push(Object.assign({}, np));
      }
      if (sc.ciDeploy) this.ci.deploy = Object.assign({}, sc.ciDeploy);
    }

    /** Zustand als speicherbares Szenario ausgeben (für localStorage). */
    snapshot() {
      return {
        dockerImages: this.docker.pulled.slice(),
        dockerContainers: this.docker.containers.map(c => Object.assign({}, c)),
        nodes: this.nodes.map(n => Object.assign({}, n)),
        deployments: this.deployments.map(d => ({ name: d.name, image: d.image, replicas: d.replicas, broken: d.broken ? Object.assign({}, d.broken) : null })),
        services: this.services.map(s => Object.assign({}, s)),
        ingresses: this.ingresses.map(i => Object.assign({}, i)),
        networkPolicies: this.networkPolicies.map(n => Object.assign({}, n)),
        secrets: this.secrets.map(s => ({ name: s.name, keys: s.keys.slice() })),
        files: Object.assign({}, this.files),
        applyEffects: JSON.parse(JSON.stringify(this.applyEffects)),
        helmRepos: this.helmRepos.slice(),
        releases: this.releases.map(r => ({
          name: r.name, chart: r.chart, revision: r.revision, depName: r.depName,
          history: r.history.map(h => Object.assign({}, h)),
        })),
        charts: this.charts.map(c => Object.assign({}, c)),
        tfResources: this.tf.resources.slice(),
        tfInitialized: this.tf.initialized,
        tfApplied: this.tf.applied,
        gitInitialized: this.git.initialized,
        gitBranch: this.git.branch,
        gitBranches: this.git.branches.slice(),
        gitStaged: this.git.staged.slice(),
        gitCommitted: this.git.committed.slice(),
        gitCommits: this.git.commits.map(c => Object.assign({}, c)),
        gitPushed: this.git.pushed,
        ciPipelines: this.ci.pipelines.map(p => ({
          id: p.id, ref: p.ref, status: p.status, created: p.created,
          stages: p.stages.map(s => Object.assign({}, s)),
        })),
        ciDeploy: this.ci.deploy ? Object.assign({}, this.ci.deploy) : null,
      };
    }

    /** Führt eine Befehlszeile aus. Rückgabe: { output, error } */
    exec(line: string): ExecResult {
      this.clock++;
      this.lastError = false;
      const raw = line.trim();
      if (!raw) return { output: "", error: false };

      const tokens = raw.split(/\s+/);
      const cmd = tokens[0];

      let out: string;
      try {
        switch (cmd) {
          case "docker": out = this._docker(tokens, raw); break;
          case "kubectl": out = this._kubectl(tokens, raw); break;
          case "helm": out = this._helm(tokens, raw); break;
          case "terraform": out = this._terraform(tokens, raw); break;
          case "git": out = this._git(tokens, raw); break;
          case "glab": out = this._glab(tokens); break;
          case "ls": out = this._ls(); break;
          case "cat": out = this._cat(tokens); break;
          case "clear": return { output: null, error: false, clear: true };
          case "help": out = this._help(); break;
          default: {
            const guess = this._suggest(cmd, ["docker", "kubectl", "helm", "terraform", "git", "glab", "ls", "cat", "clear", "help"]);
            out = this._err("⚠️ Den Befehl '" + cmd + "' gibt es hier nicht.",
              guess ? "Meintest du '" + guess + "'? (Tippe 'help' für alle Befehle.)"
                    : "Tippe 'help' für eine Liste der Befehle, die hier funktionieren.");
          }
        }
      } catch (e) {
        this.lastError = true;
        out = "Hoppla, da ist im Simulator etwas schiefgegangen: " + (e instanceof Error ? e.message : String(e));
      }
      return { output: out, error: this.lastError };
    }

    _err(msg: string, tip?: string) {
      this.lastError = true;
      return msg + (tip ? "\n💡 " + tip : "");
    }

    /** Editierdistanz (Levenshtein) – für „Meintest du …?"-Vorschläge. */
    _editDistance(a: string, b: string) {
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
    _checkImageTypo(img: string) {
      const bare = (img.split(":")[0].split("/").pop() || "").toLowerCase();
      if (KNOWN_IMAGES.includes(bare)) return null;
      const guess = this._suggest(bare, KNOWN_IMAGES);
      if (guess) {
        return this._err('⚠️ Das Image "' + bare + '" kennt die Registry nicht.',
          "Tippfehler? Meintest du \"" + guess + "\"? (So entsteht im echten Cluster ein ImagePullBackOff!)");
      }
      return null; // unbekannt, aber kein klarer Tippfehler -> zum Ausprobieren erlauben
    }

    /** Nächstliegendes bekanntes Wort, wenn nah genug dran (sonst null). */
    _suggest(word: string, list: string[]): string | null {
      let best: string | null = null, bestD = Infinity;
      for (const cand of list) {
        const dist = this._editDistance(word.toLowerCase(), cand.toLowerCase());
        if (dist < bestD) { bestD = dist; best = cand; }
      }
      const limit = word.length <= 4 ? 1 : 2; // bei kurzen Wörtern strenger
      return bestD <= limit && bestD > 0 ? best : null;
    }

    /** Wert hinter einer Flag finden: unterstützt "-n wert" und "-n=wert". */
    _flagValue(tokens: string[], flag: string): string | null {
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
        "  kubectl    get pods|deployments|services|endpoints|ingress|networkpolicies|nodes|secrets | describe pod|ingress|networkpolicy <name>",
        "             create deployment | create secret generic|tls | scale | expose | delete | apply -f <datei>",
        "             logs <pod> | set image deployment/<n> <c>=<img> | rollout restart deployment <n>",
        "  helm       repo add|update | search repo | create | lint | package | install | list | upgrade | rollback | uninstall | status",
        "  terraform  init | plan | apply | destroy | state list",
        "  git        init | status | add <datei> | commit -m \"…\" | log | branch [<name>] | checkout [-b] <name> | merge <name> | push",
        "  glab       ci status | ci list  (Pipeline-Status in GitLab)",
        "  ls, cat <datei>, clear, help",
      ].join("\n");
    }

    /* ===================== docker ===================== */
    _docker(t: string[], _raw?: string) {
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
        // docker run [-d] [--name X] [-p a:b] IMAGE [BEFEHL ...]
        // Reihenfolge wie echtes Docker: Optionen stehen VOR dem Image. Sobald das
        // Image gelesen ist, gehört alles Weitere zum Container-Befehl – Flags danach
        // wirken NICHT (sonst lernt man die falsche Reihenfolge, siehe Issue #17).
        let name: string | null = null, image: string | null = null, flagAfterImage = false;
        for (let i = 2; i < t.length; i++) {
          if (image) {                                   // alles nach dem Image = Container-Befehl
            if (t[i].startsWith("-")) flagAfterImage = true;
            continue;
          }
          if (t[i] === "--name") { name = t[i + 1]; i++; }
          else if (t[i] === "-d" || t[i] === "--detach") { /* ok */ }
          else if (t[i] === "-p" || t[i] === "--publish") { i++; }
          else if (!t[i].startsWith("-")) image = t[i];
        }
        if (!image) return this._err("docker run: Es fehlt das Image.", "z.B. 'docker run -d --name webserver nginx'");
        if (flagAfterImage) return this._err("docker run: Optionen wie -d/--name müssen VOR das Image.", "Alles nach dem Image ist der Container-Befehl. Muster: docker run [-d] [--name <name>] <image>");
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
    _kubectl(t: string[], raw: string) {
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

    _kubectlGet(t: string[]) {
      const what = (t[2] || "").toLowerCase();
      const ns = this._flagValue(t, "-n") || this._flagValue(t, "--namespace");
      const allNs = t.includes("-A") || t.includes("--all-namespaces");
      this._recheckReadiness();

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
        const rows: any[] = [];
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
          this.deployments.map(d => {
            const ready = this._podReady(d) ? d.pods.length : 0;
            return [d.name, ready + "/" + d.replicas, String(d.replicas), String(ready), this._age(d.created)];
          }));
      }

      if (["services", "service", "svc"].includes(what)) {
        const rows = [["kubernetes", "ClusterIP", "10.96.0.1", "<none>", "443/TCP", "3d"]];
        for (const s of this.services) rows.push([s.name, s.type, s.clusterIP, "<none>", s.port + "/TCP", this._age(s.created || 0)]);
        return table(["NAME", "TYPE", "CLUSTER-IP", "EXTERNAL-IP", "PORT(S)", "AGE"], rows);
      }

      if (["endpoints", "endpoint", "ep"].includes(what)) {
        // Endpoints = die IPs der BEREITEN Pods hinter einem Service. Genau hier
        // wird die Readiness-Probe sichtbar: ein nicht-bereiter Pod fehlt in der
        // Liste, der Service leitet keinen Verkehr an ihn weiter.
        const wantName = t[3] && !t[3].startsWith("-") ? t[3] : null;
        const svcs = wantName ? this.services.filter(s => s.name === wantName) : this.services.slice();
        if (wantName && svcs.length === 0) {
          return this._err('Error from server (NotFound): endpoints "' + wantName + '" not found', "Service-Namen siehst du mit 'kubectl get services'.");
        }
        if (svcs.length === 0) return "No resources found in default namespace.";
        return table(["NAME", "ENDPOINTS", "AGE"], svcs.map(s => {
          const dep = this.deployments.find(d => d.name === s.name);
          const ips = dep && this._podReady(dep)
            ? dep.pods.map((_, i) => "10.244.1." + (20 + i) + ":" + s.port)
            : [];
          return [s.name, ips.length ? ips.join(",") : "<none>", this._age(s.created || 0)];
        }));
      }

      if (["nodes", "node", "no"].includes(what)) {
        return table(["NAME", "STATUS", "ROLES", "AGE", "VERSION"],
          this.nodes.map(n => [n.name, n.status, n.roles, "3d", n.version]));
      }

      if (["secrets", "secret"].includes(what)) {
        if (this.secrets.length === 0) return "No resources found in default namespace.";
        return table(["NAME", "TYPE", "DATA", "AGE"],
          this.secrets.map(s => [s.name, s.type || "Opaque", String(s.keys.length), this._age(s.created || 0)]));
      }

      if (["ingress", "ingresses", "ing"].includes(what)) {
        if (this.ingresses.length === 0) return "No resources found in default namespace.";
        return table(["NAME", "CLASS", "HOSTS", "ADDRESS", "PORTS", "AGE"],
          this.ingresses.map(i => [i.name, i.className, i.host, INGRESS_ADDRESS, i.tls ? "80, 443" : "80", this._age(i.created || 0)]));
      }

      if (["networkpolicies", "networkpolicy", "netpol", "netpols"].includes(what)) {
        if (this.networkPolicies.length === 0) return "No resources found in default namespace.";
        return table(["NAME", "POD-SELECTOR", "AGE"],
          this.networkPolicies.map(n => [n.name, n.podSelector ? "app=" + n.podSelector : "<none>", this._age(n.created || 0)]));
      }

      if (!what) return this._err("kubectl get: Was möchtest du sehen?", "z.B. 'kubectl get pods' oder 'kubectl get nodes'");
      return this._err('error: the server doesn\'t have a resource type "' + what + '"', "Gemeint war vielleicht: pods, deployments, services, endpoints, ingress, networkpolicies oder nodes?");
    }

    _kubectlDescribe(t: string[]) {
      const what = (t[2] || "").toLowerCase();
      const name = t[3];
      if (["ingress", "ingresses", "ing"].includes(what)) {
        if (!name) return this._err("kubectl describe ingress: Welches Hafentor?", "Die Namen siehst du mit 'kubectl get ingress'.");
        const ing = this.ingresses.find(i => i.name === name);
        if (!ing) return this._err('Error from server (NotFound): ingresses.networking.k8s.io "' + name + '" not found', "Tipp: Namen aus 'kubectl get ingress' kopieren.");
        const svcExists = this.services.some(s => s.name === ing.service);
        const secretExists = ing.tls ? this.secrets.some(s => s.name === ing.tls!.secretName) : true;
        return [
          "Name:             " + ing.name,
          "Namespace:        default",
          "Address:          " + INGRESS_ADDRESS,
          "Ingress Class:    " + ing.className,
          ...(ing.tls ? [
            "TLS:",
            "  " + ing.tls.secretName + " terminates " + ing.host +
              (secretExists ? "" : "  (⚠ Secret '" + ing.tls.secretName + "' gibt es nicht – HTTPS bleibt zu!)"),
          ] : []),
          "Rules:",
          "  Host        Path  Backends",
          "  ----        ----  --------",
          "  " + ing.host + "  " + ing.path + "   " + ing.service + ":" + ing.port +
            (svcExists ? "" : "  (⚠ Service '" + ing.service + "' gibt es nicht – das Tor lotst ins Leere!)"),
        ].join("\n");
      }
      if (["networkpolicy", "networkpolicies", "netpol", "netpols"].includes(what)) {
        if (!name) return this._err("kubectl describe networkpolicy: Welche Hafenmauer?", "Die Namen siehst du mit 'kubectl get networkpolicies'.");
        const np = this.networkPolicies.find(n => n.name === name);
        if (!np) return this._err('Error from server (NotFound): networkpolicies.networking.k8s.io "' + name + '" not found', "Tipp: Namen aus 'kubectl get networkpolicies' kopieren.");
        return [
          "Name:         " + np.name,
          "Namespace:    default",
          "PodSelector:  " + (np.podSelector ? "app=" + np.podSelector : "<none> (gilt für alle Pods im Namespace)"),
          "PolicyTypes:  Ingress",
          "Allowing ingress traffic:",
          np.allowFrom
            ? "  From: Pods mit Label app=" + np.allowFrom
            : "  <none> (default-deny: niemand darf rein, bis du eine Quelle erlaubst)",
        ].join("\n");
      }
      if (!["pod", "pods"].includes(what)) return this._err("Der Simulator kann nur 'kubectl describe pod <name>', 'kubectl describe ingress <name>' und 'kubectl describe networkpolicy <name>'.");
      if (!name) return this._err("kubectl describe pod: Welcher Pod?", "Die Namen siehst du mit 'kubectl get pods'.");
      const pod = this._allPods().find(p => p.name === name);
      if (!pod) return this._err('Error from server (NotFound): pods "' + name + '" not found', "Tipp: Pod-Namen kannst du aus 'kubectl get pods' kopieren.");
      // Pod wurde via _allPods() gefunden -> sein Deployment existiert garantiert.
      const dep = this._findDeploymentOfPod(name)!;
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
      } else if (dep.broken.type === "notready") {
        events.push("  Normal   Scheduled  " + this._age(pod.created) + "   Successfully assigned default/" + pod.name);
        events.push("  Normal   Started    " + this._age(pod.created) + "   Started container " + dep.name);
        events.push("  Warning  Unhealthy  " + this._age(pod.created) + "   Readiness probe failed: HTTP probe returned statuscode 503 (Liveness probe ok – der Pod LÄUFT, ist aber nicht bereit)");
      }
      return [
        "Name:         " + pod.name,
        "Namespace:    default",
        "Node:         " + (dep.broken && dep.broken.type === "pending" ? "<none>" : this.nodes[1].name),
        "Status:       " + (st.status === "Running" ? "Running" : st.status === "Pending" ? "Pending" : "Waiting (" + st.status + ")"),
        "Ready:        " + st.ready,
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

    _kubectlCreate(t: string[], raw: string) {
      if (t[2] === "secret") {
        // kubectl create secret tls <name> --cert=<datei> --key=<datei>
        if (t[3] === "tls") {
          const name = t[4];
          if (!name || name.startsWith("--")) return this._err("kubectl create secret tls: Der Name fehlt.", "Muster: kubectl create secret tls <name> --cert=tls.crt --key=tls.key");
          const hasCert = /--cert[=\s]\S+/.test(raw);
          const hasKey = /--key[=\s]\S+/.test(raw);
          if (!hasCert || !hasKey) return this._err("error: a TLS secret needs --cert and --key", "Häng '--cert=tls.crt --key=tls.key' an.");
          if (this.secrets.some(s => s.name === name)) return this._err('error: secrets "' + name + '" already exists');
          this.secrets.push({ name, keys: ["tls.crt", "tls.key"], type: "kubernetes.io/tls", created: this.clock });
          return "secret/" + name + " created";
        }
        // kubectl create secret generic <name> --from-literal=schluessel=wert
        if (t[3] !== "generic") return this._err("Der Simulator kann nur 'kubectl create secret generic <name> --from-literal=k=v' und 'kubectl create secret tls <name> --cert=… --key=…'.");
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

    _kubectlScale(t: string[], raw: string) {
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

    _kubectlExpose(t: string[], raw: string) {
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

    _kubectlDelete(t: string[]) {
      const what = (t[2] || "").toLowerCase();
      const name = t[3];

      if (what === "-f") {
        const file = t[3];
        const eff = this.applyEffects[file];
        if (!eff || !this.files[file]) return this._err("error: the path \"" + (file || "?") + "\" does not exist", "Mit 'ls' siehst du, welche Dateien hier liegen.");
        const out: string[] = [];
        const effDep = eff.deployment;
        if (effDep) {
          const i = this.deployments.findIndex(d => d.name === effDep.name);
          if (i >= 0) { this.deployments.splice(i, 1); out.push('deployment.apps "' + effDep.name + '" deleted'); }
        }
        const effSvc = eff.service;
        if (effSvc) {
          const i = this.services.findIndex(s => s.name === effSvc.name);
          if (i >= 0) { this.services.splice(i, 1); out.push('service "' + effSvc.name + '" deleted'); }
        }
        const effIng = eff.ingress;
        if (effIng) {
          const i = this.ingresses.findIndex(x => x.name === effIng.name);
          if (i >= 0) { this.ingresses.splice(i, 1); out.push('ingress.networking.k8s.io "' + effIng.name + '" deleted'); }
        }
        const effNp = eff.networkPolicy;
        if (effNp) {
          const i = this.networkPolicies.findIndex(x => x.name === effNp.name);
          if (i >= 0) { this.networkPolicies.splice(i, 1); out.push('networkpolicy.networking.k8s.io "' + effNp.name + '" deleted'); }
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

      if (["ingress", "ingresses", "ing"].includes(what)) {
        const idx = this.ingresses.findIndex(i => i.name === name);
        if (idx === -1) return this._err('Error from server (NotFound): ingresses.networking.k8s.io "' + name + '" not found');
        this.ingresses.splice(idx, 1);
        return 'ingress.networking.k8s.io "' + name + '" deleted';
      }

      if (["networkpolicy", "networkpolicies", "netpol", "netpols"].includes(what)) {
        const idx = this.networkPolicies.findIndex(n => n.name === name);
        if (idx === -1) return this._err('Error from server (NotFound): networkpolicies.networking.k8s.io "' + name + '" not found');
        this.networkPolicies.splice(idx, 1);
        return 'networkpolicy.networking.k8s.io "' + name + '" deleted';
      }

      return this._err("kubectl delete: Ressourcentyp '" + what + "' kennt der Simulator nicht.");
    }

    _kubectlApply(t: string[]) {
      const fIdx = t.indexOf("-f");
      const file = fIdx >= 0 ? t[fIdx + 1] : null;
      if (!file) return this._err("error: must specify one of -f or -k", "Muster: 'kubectl apply -f deployment.yaml'");
      if (!this.files[file]) return this._err("error: the path \"" + file + "\" does not exist", "Mit 'ls' siehst du, welche Dateien hier liegen.");
      const eff = this.applyEffects[file];
      if (!eff) return this._err("error: unable to decode " + file);
      const out: string[] = [];
      const effDep = eff.deployment;
      if (effDep) {
        const existing = this.deployments.find(d => d.name === effDep.name);
        if (existing) {
          out.push("deployment.apps/" + effDep.name + " unchanged");
        } else {
          this.deployments.push(this._makeDeployment(effDep.name, effDep.image, effDep.replicas));
          out.push("deployment.apps/" + effDep.name + " created");
        }
      }
      const effSvc = eff.service;
      if (effSvc) {
        const existing = this.services.find(s => s.name === effSvc.name);
        if (existing) {
          out.push("service/" + effSvc.name + " unchanged");
        } else {
          this.services.push({
            name: effSvc.name, type: effSvc.type || "ClusterIP",
            clusterIP: "10.96." + Math.floor(Math.random() * 250) + "." + Math.floor(Math.random() * 250),
            port: effSvc.port, created: this.clock,
          });
          out.push("service/" + effSvc.name + " created");
        }
      }
      const effIng = eff.ingress;
      if (effIng) {
        const existing = this.ingresses.find(i => i.name === effIng.name);
        if (existing) {
          // TLS am bestehenden Hafentor nachrüsten: aus HTTP wird HTTPS ("configured").
          if (effIng.tls && !existing.tls) {
            existing.tls = { secretName: effIng.tls.secretName };
            out.push("ingress.networking.k8s.io/" + effIng.name + " configured");
          } else {
            out.push("ingress.networking.k8s.io/" + effIng.name + " unchanged");
          }
        } else {
          this.ingresses.push({
            name: effIng.name, className: effIng.className || "nginx",
            host: effIng.host, path: effIng.path || "/",
            service: effIng.service, port: effIng.port,
            ...(effIng.tls ? { tls: { secretName: effIng.tls.secretName } } : {}),
            created: this.clock,
          });
          out.push("ingress.networking.k8s.io/" + effIng.name + " created");
        }
      }
      const effNp = eff.networkPolicy;
      if (effNp) {
        const existing = this.networkPolicies.find(n => n.name === effNp.name);
        if (existing) {
          out.push("networkpolicy.networking.k8s.io/" + effNp.name + " unchanged");
        } else {
          this.networkPolicies.push({
            name: effNp.name, podSelector: effNp.podSelector || "",
            allowFrom: effNp.allowFrom || "", created: this.clock,
          });
          out.push("networkpolicy.networking.k8s.io/" + effNp.name + " created");
        }
      }
      return out.join("\n");
    }

    _kubectlLogs(t: string[]) {
      const name = t[2];
      if (!name) return this._err("kubectl logs: Welcher Pod?", "Pod-Namen siehst du mit 'kubectl get pods'.");
      const pod = this._allPods().find(p => p.name === name);
      if (!pod) return this._err('Error from server (NotFound): pods "' + name + '" not found');
      // Pod via _allPods() gefunden -> Deployment existiert garantiert.
      const dep = this._findDeploymentOfPod(name)!;
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
    _kubectlSetImage(t: string[]) {
      if (t[2] !== "image") return this._err("Der Simulator kann nur 'kubectl set image deployment/<name> <container>=<image>'.");
      let depName: string | null = null;
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
    _kubectlRollout(t: string[]) {
      if (t[2] !== "restart") return this._err("Der Simulator kann nur 'kubectl rollout restart deployment <name>'.");
      let depName: string | null = null;
      if (t[3] && t[3].startsWith("deployment/")) depName = t[3].split("/")[1];
      else if (t[3] === "deployment") depName = t[4];
      if (!depName) return this._err("kubectl rollout restart: Welches Deployment?", "Muster: kubectl rollout restart deployment <name>");
      const dep = this.deployments.find(d => d.name === depName);
      if (!dep) return this._err('Error from server (NotFound): deployments.apps "' + depName + '" not found');
      const broken = dep.broken;
      if (broken && broken.type === "crashloop" && this.secrets.some(s => s.name === broken.needsSecret)) {
        dep.broken = null;
      }
      dep.pods = dep.pods.map(() => ({ name: makePodName(dep.name), created: this.clock, restarts: 0 }));
      return "deployment.apps/" + depName + " restarted";
    }

    /* ===================== helm ===================== */
    _helm(t: string[], raw: string) {
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

      if (sub === "create") {
        const name = t[2];
        if (!name || name.startsWith("-")) return this._err("helm create: Chart-Name fehlt.", "Muster: 'helm create <mein-chart>'");
        if (this.charts.some(c => c.name === name)) return this._err('Error: file "' + name + '" already exists', "Den Namen gibt es schon. Nimm einen anderen.");
        this.charts.push({ name, version: "0.1.0", packaged: false });
        // Das Gerüst, das echtes 'helm create' anlegt – als virtuelle Dateien zum Anschauen (ls/cat).
        this.files[name + "/Chart.yaml"] = [
          "apiVersion: v2", "name: " + name, "description: Ein Helm-Chart für Kubernetes",
          "type: application", "version: 0.1.0", "appVersion: \"1.16.0\"",
        ].join("\n");
        this.files[name + "/values.yaml"] = [
          "# Drehknöpfe des Charts – hier ohne die Vorlage zu ändern einstellbar.",
          "replicaCount: 1", "image:", "  repository: nginx", "  tag: \"latest\"",
          "service:", "  type: ClusterIP", "  port: 80",
        ].join("\n");
        this.files[name + "/templates/deployment.yaml"] = "# Vorlage: rendert mit den Werten aus values.yaml zu einem Deployment.";
        this.files[name + "/templates/service.yaml"] = "# Vorlage: rendert zum Service.";
        return "Creating " + name;
      }

      if (sub === "lint") {
        const ref = t[2];
        if (!ref) return this._err("helm lint: Welches Chart?", "Muster: 'helm lint <chart>' – z.B. das von 'helm create'.");
        const name = ref.replace(/^\.?\.?\//, "").replace(/\/+$/, "");
        if (!this.charts.some(c => c.name === name)) return this._err('Error: path "' + ref + '" not found', "Erst 'helm create " + name + "' – oder den Pfad prüfen.");
        return [
          "==> Linting " + ref,
          "[INFO] Chart.yaml: icon is recommended",
          "",
          "1 chart(s) linted, 0 chart(s) failed",
        ].join("\n");
      }

      if (sub === "package") {
        const ref = t[2];
        if (!ref) return this._err("helm package: Welches Chart?", "Muster: 'helm package <chart>'.");
        const name = ref.replace(/^\.?\.?\//, "").replace(/\/+$/, "");
        const chart = this.charts.find(c => c.name === name);
        if (!chart) return this._err('Error: path "' + ref + '" not found', "Erst 'helm create " + name + "' – oder den Pfad prüfen.");
        chart.packaged = true;
        const tgz = name + "-" + chart.version + ".tgz";
        this.files[tgz] = "(gepacktes Chart-Archiv – bereit zum Teilen oder Installieren)";
        return "Successfully packaged chart and saved it to: /werft/" + tgz;
      }

      if (sub === "install") {
        const release = t[2], chart = t[3];
        if (!release || !chart || release.startsWith("-")) return this._err("helm install: Release-Name und Chart fehlen.", "Muster: 'helm install <mein-name> bitnami/nginx' oder '<mein-name> ./<eigenes-chart>'");
        // Lokales Chart (eigenes, mit 'helm create' gebautes) vs. Repo-Chart unterscheiden.
        const localName = chart.replace(/^\.?\.?\//, "").replace(/\/+$/, "");
        const isLocal = chart.startsWith(".") || chart.startsWith("/") || this.charts.some(c => c.name === localName);
        if (isLocal) {
          if (!this.charts.some(c => c.name === localName)) return this._err('Error: path "' + chart + '" not found', "Erst mit 'helm create " + localName + "' ein Chart anlegen – oder den Pfad prüfen.");
        } else if (chart.includes("/") && !this.helmRepos.includes(chart.split("/")[0])) {
          return this._err("Error: repo " + chart.split("/")[0] + " not found", "Erst 'helm repo add ...' ausführen.");
        }
        if (this.releases.some(r => r.name === release)) return this._err("Error: INSTALLATION FAILED: cannot re-use a name that is still in use", "Der Release-Name ist schon vergeben. Nimm 'helm upgrade' oder einen anderen Namen.");
        const replicas = this._setValue(raw, "replicaCount") || 1;
        const chartShort = isLocal ? localName : (chart.split("/").pop() || chart);
        const depName = release + "-" + chartShort.split(":")[0];
        this.deployments.push(this._makeDeployment(depName, chartShort + ":latest", replicas));
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
          this.releases.map(r => [r.name, "default", String(r.revision), "deployed", (r.chart.split("/").pop() || r.chart) + "-18.1.0"]));
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

    _setValue(raw: string, key: string): number | null {
      const m = raw.match(new RegExp("--set\\s+" + key + "=(\\d+)"));
      return m ? parseInt(m[1], 10) : null;
    }

    /* ===================== terraform ===================== */
    _terraform(t: string[], _raw?: string) {
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
    /* ===================== git ===================== */
    _git(t: string[], raw: string) {
      const sub = t[1];
      const g = this.git;
      if (sub === "init") {
        if (g.initialized) return "Hinweis: Hier liegt schon ein Git-Repository (.git existiert bereits).";
        g.initialized = true;
        return "Initialisiertes leeres Git-Repository in /hafen/.git/\n📜 Ab jetzt kann Git jede Änderung an deinen Dateien festhalten.";
      }
      if (!g.initialized) {
        return this._err("⚠️ Das hier ist (noch) kein Git-Repository.", "Starte eins mit 'git init'.");
      }
      switch (sub) {
        case "status": return this._gitStatus();
        case "add": return this._gitAdd(t);
        case "commit": return this._gitCommit(raw);
        case "log": return this._gitLog();
        case "branch": return this._gitBranch(t);
        case "checkout": return this._gitCheckout(t);
        case "merge": return this._gitMerge(t);
        case "push": return this._gitPush();
        default: {
          const guess = this._suggest(sub || "", ["init", "status", "add", "commit", "log", "branch", "checkout", "merge", "push"]);
          return this._err("⚠️ 'git " + (sub || "") + "' kenne ich hier nicht.",
            guess ? "Meintest du 'git " + guess + "'?" : "Versuch's mit status, add, commit, log, branch, checkout, merge oder push.");
        }
      }
    }

    _gitUntracked() {
      const g = this.git;
      return Object.keys(this.files).filter(f => !g.staged.includes(f) && !g.committed.includes(f));
    }

    _gitStatus() {
      const g = this.git;
      const untracked = this._gitUntracked();
      let s = "Auf Branch " + g.branch + "\n";
      if (g.staged.length) s += "Zum Commit vorgemerkt:\n" + g.staged.map(f => "  neue Datei: " + f).join("\n") + "\n";
      if (untracked.length) s += "Unversionierte Dateien:\n" + untracked.map(f => "  " + f).join("\n") + "\n  (nutze \"git add <datei>\", um sie aufzunehmen)\n";
      if (!g.staged.length && !untracked.length) s += "Nichts zu committen, Arbeitsverzeichnis sauber ✨";
      return s.trimEnd();
    }

    _gitAdd(t: string[]) {
      const g = this.git;
      const arg = t[2];
      if (!arg) return this._err("git add: Welche Datei?", "z.B. 'git add seekarte.md' – oder 'git add .' für alles.");
      let toAdd: string[];
      if (arg === ".") {
        toAdd = this._gitUntracked();
      } else {
        if (!this.files[arg]) return this._err("git add: Die Datei '" + arg + "' gibt es hier nicht.", "Tippe 'ls' für die Dateien in diesem Ordner.");
        toAdd = g.committed.includes(arg) && !this._gitUntracked().includes(arg) ? [] : [arg];
      }
      for (const f of toAdd) if (!g.staged.includes(f)) g.staged.push(f);
      return toAdd.length ? "Vorgemerkt: " + toAdd.join(", ") + " (bereit zum Commit)." : "Nichts Neues zum Vormerken.";
    }

    _gitCommit(raw: string) {
      const g = this.git;
      const m = raw.match(/-m\s+"([^"]*)"|-m\s+'([^']*)'|-m\s+(\S+)/);
      const msg = m ? (m[1] || m[2] || m[3]) : null;
      if (!msg) return this._err("git commit: Die Commit-Nachricht fehlt.", 'Muster: git commit -m "Was du geändert hast"');
      if (!g.staged.length) return this._err("git commit: Nichts vorgemerkt (nothing to commit).", "Erst 'git add <datei>', dann committen.");
      const files = g.staged.slice();
      for (const f of files) if (!g.committed.includes(f)) g.committed.push(f);
      g.staged = [];
      const hash = (0xc0ffee + g.commits.length * 7).toString(16).slice(-7);
      g.commits.push({ hash, msg, branch: g.branch, files });
      return "[" + g.branch + " " + hash + "] " + msg + "\n " + files.length + " Datei(en) festgehalten.";
    }

    _gitLog() {
      const g = this.git;
      if (!g.commits.length) return "Noch keine Commits. Mach deinen ersten mit 'git commit -m \"…\"'.";
      return g.commits.slice().reverse()
        .map(c => "commit " + c.hash + "  (" + c.branch + ")\n    " + c.msg).join("\n");
    }

    _gitBranch(t: string[]) {
      const g = this.git;
      const name = t[2];
      if (!name) return "Branches:\n" + g.branches.map(b => (b === g.branch ? "* " : "  ") + b).join("\n");
      if (name.startsWith("-")) return this._err("git branch: So nicht.", "Zum Anlegen: 'git branch <name>'.");
      if (g.branches.includes(name)) return this._err("git branch: Branch '" + name + "' gibt es schon.");
      g.branches.push(name);
      return "Branch '" + name + "' angelegt. (Wechseln mit 'git checkout " + name + "'.)";
    }

    _gitCheckout(t: string[]) {
      const g = this.git;
      let name = t[2], create = false;
      if (t[2] === "-b") { create = true; name = t[3]; }
      if (!name) return this._err("git checkout: Welcher Branch?", "Neu + wechseln: 'git checkout -b <name>'. Nur wechseln: 'git checkout <name>'.");
      if (create) {
        if (g.branches.includes(name)) return this._err("git checkout -b: Branch '" + name + "' gibt es schon.", "Wechsle mit 'git checkout " + name + "'.");
        g.branches.push(name);
      } else if (!g.branches.includes(name)) {
        return this._err("git checkout: Branch '" + name + "' gibt es nicht.", "Neu anlegen + wechseln: 'git checkout -b " + name + "'.");
      }
      g.branch = name;
      return "Gewechselt zu Branch '" + name + "'" + (create ? " (neu angelegt)" : "") + ".";
    }

    _gitMerge(t: string[]) {
      const g = this.git;
      const name = t[2];
      if (!name) return this._err("git merge: Welchen Branch reinholen?", "Muster: 'git merge <branch>'.");
      if (!g.branches.includes(name)) return this._err("git merge: Branch '" + name + "' gibt es nicht.");
      if (name === g.branch) return this._err("git merge: Das ist schon dein aktueller Branch.", "Wechsle erst auf den Ziel-Branch, dann merge den anderen rein.");
      const hash = (0xc0ffee + g.commits.length * 7).toString(16).slice(-7);
      g.commits.push({ hash, msg: "Merge Branch '" + name + "' in " + g.branch, branch: g.branch, files: [] });
      return "Merge: '" + name + "' → '" + g.branch + "' ✅ Die Arbeit aus beiden Branches ist jetzt vereint.";
    }

    _gitPush() {
      const g = this.git;
      if (!g.commits.length) return this._err("git push: Noch nichts zu pushen.", "Erst committen, dann pushen.");
      g.pushed = true;
      let msg = "Schiebe nach origin/" + g.branch + " … ✅ Deine Commits liegen jetzt auf dem Server (z.B. GitLab) – sichtbar fürs Team.";
      // Liegt eine .gitlab-ci.yml im Repo, startet der Runner bei jedem Push automatisch eine Pipeline.
      if (this.files[".gitlab-ci.yml"]) {
        const p = this._runPipeline();
        msg += "\n🏃 Eine .gitlab-ci.yml liegt im Repo – der Runner startet Pipeline #" + p.id +
          " (build → test → deploy). Status checken mit 'glab ci status'.";
      }
      return msg;
    }

    /** Baut eine Pipeline für den aktuellen Branch und lässt ihre Stages laufen. */
    _runPipeline() {
      const g = this.git;
      const onMain = g.branch === "main";
      const stages = [
        { name: "build", status: "passed" },
        { name: "test", status: "passed" },
        { name: "deploy", status: onMain ? "passed" : "skipped" }, // 'only: main' – Feature-Branches werden nicht ausgerollt
      ];
      const p = { id: 1001 + this.ci.pipelines.length, ref: g.branch, status: "passed", stages, created: this.clock };
      this.ci.pipelines.push(p);
      // Die deploy-Stage rollt den Dienst automatisch in den Cluster (nur auf main).
      if (this.ci.deploy && onMain) {
        const d = this.ci.deploy;
        if (!this.deployments.some(x => x.name === d.name)) {
          this.deployments.push(this._makeDeployment(d.name, d.image, d.replicas));
        }
      }
      return p;
    }

    /* ===================== glab (GitLab CLI) ===================== */
    _glab(t: string[]) {
      if (t[1] !== "ci") return this._err("Der Simulator kann nur 'glab ci ...'.", "z.B. 'glab ci status' oder 'glab ci list'.");
      const action = t[2];

      if (action === "status" || action === "view") {
        const p = this.ci.pipelines[this.ci.pipelines.length - 1];
        if (!p) return this._err("Keine Pipeline gefunden.", "Eine Pipeline entsteht beim 'git push' – wenn eine .gitlab-ci.yml im Repo liegt.");
        const icon = (s: string) => (s === "passed" ? "✓" : s === "skipped" ? "–" : "•");
        const lines = [
          "Pipeline #" + p.id + "  (Branch " + p.ref + ")   Status: " + (p.status === "passed" ? "passed ✅" : p.status),
        ];
        for (const s of p.stages) lines.push("  " + icon(s.status) + " " + pad(s.name, 8) + s.status);
        if (p.stages.some(s => s.name === "deploy" && s.status === "passed")) {
          lines.push("🚀 Die deploy-Stage hat den Dienst automatisch ausgerollt – schau mit 'kubectl get pods'.");
        } else if (p.ref !== "main") {
          lines.push("ℹ️  deploy übersprungen ('only: main') – auf diesem Branch wird gebaut & getestet, aber nicht deployt.");
        }
        return lines.join("\n");
      }

      if (action === "list") {
        if (!this.ci.pipelines.length) return "Keine Pipelines. (Entstehen beim 'git push' mit .gitlab-ci.yml im Repo.)";
        return table(["ID", "BRANCH", "STATUS"],
          this.ci.pipelines.slice().reverse().map(p => ["#" + p.id, p.ref, p.status]));
      }

      return this._err("glab ci: unbekannte Aktion '" + (action || "") + "'", "z.B. 'glab ci status' oder 'glab ci list'.");
    }

    _ls() {
      const names = Object.keys(this.files);
      if (names.length === 0) return "(dieser Ordner ist leer)";
      return names.join("\n");
    }

    _cat(t: string[]) {
      const file = t[1];
      if (!file) return this._err("cat: Welche Datei?", "Mit 'ls' siehst du, was hier liegt.");
      if (!this.files[file]) return this._err("cat: " + file + ": Datei nicht gefunden", "Mit 'ls' siehst du, was hier liegt.");
      return this.files[file];
    }
  }

  export { Sim };
