/* ===== KubeQuest – Terminal-Simulator =====
 * Simuliert einen kleinen Kubernetes-Cluster samt Docker, Helm und Terraform.
 * Kein echtes Cluster nötig – aber die Befehle und Ausgaben fühlen sich echt an.
 */

import type { ExecResult } from "./types";

// Cluster-Zustand & Domänentypen leben seit #372 in ./sim/state.ts (Schritt 1/7 des
// sim.ts-Datei-Splits). Hier für die Sim-Klasse importiert und als Barrel re-exportiert,
// damit bestehende `import … from "../sim"` (game, types, content/*, Tests) unverändert bleiben.
import type {
  Broken, PodInstance, Deployment, ServiceRes, IngressRes, NetworkPolicyRes,
  Secret, ConfigMap, ClusterNode, Container, HistoryEntry, Release,
  Chart, TfResource, GitCommit, GitConflict, GitPending, PipelineStage,
  Pipeline, CiDeploy, ArgoDesired, ArgoChildSpec, ArgoApp, ApplyEffect,
  ServiceMonitorRes, PrometheusRuleRes, GrafanaDatasourceRes, GrafanaDashboardRes, StatefulSetRes, PvcRes,
  PvRes, StorageClassRes, ServiceAccountRes, PolicyRule, RoleRes, RbacSubject,
  RoleBindingRes, SecurityContext, PodSecurityLevel, PodStatus, PodMetrics, NodeMetrics,
  ScrapeTarget, Alert, Scenario, ClusterState,
} from "./sim/state";
export type {
  Broken, PodInstance, Deployment, ServiceRes, IngressRes, NetworkPolicyRes,
  Secret, ConfigMap, ClusterNode, Container, HistoryEntry, Release,
  Chart, TfResource, GitCommit, GitConflict, GitPending, PipelineStage,
  Pipeline, CiDeploy, ArgoDesired, ArgoChildSpec, ArgoApp, ApplyEffect,
  ServiceMonitorRes, PrometheusRuleRes, GrafanaDatasourceRes, GrafanaDashboardRes, StatefulSetRes, PvcRes,
  PvRes, StorageClassRes, ServiceAccountRes, PolicyRule, RoleRes, RbacSubject,
  RoleBindingRes, SecurityContext, PodSecurityLevel, PodStatus, PodMetrics, NodeMetrics,
  ScrapeTarget, Alert, Scenario, ClusterState,
} from "./sim/state";

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

  /** Stabiler kleiner Hash (FNV-1a-artig). Liefert aus einem Namen einen festen
   *  Zahlenwert – Grundlage für deterministische Metrik-Werte (kein Math.random,
   *  damit `kubectl top` über Aufrufe hinweg gleich bleibt und Tests reproduzierbar sind). */
  function hashStr(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
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

  class Sim implements ClusterState {
    // `!` = definite assignment: alle Felder werden in reset() gesetzt, das der
    // Konstruktor aufruft. TS sieht das nicht durch den Methodenaufruf hindurch.
    // Die Cluster-Zustands-Felder erfüllen den `ClusterState`-Vertrag (sim/state.ts, #372).
    scenario: Scenario;
    clock!: number;
    docker!: { pulled: string[]; containers: Container[] };
    nodes!: ClusterNode[];
    deployments!: Deployment[];
    services!: ServiceRes[];
    ingresses!: IngressRes[];
    networkPolicies!: NetworkPolicyRes[];
    secrets!: Secret[];
    configMaps!: ConfigMap[];
    files!: Record<string, string>;
    applyEffects!: Record<string, ApplyEffect>;
    serviceMonitors!: ServiceMonitorRes[];
    prometheusRules!: PrometheusRuleRes[];
    grafanaDatasources!: GrafanaDatasourceRes[];
    grafanaDashboards!: GrafanaDashboardRes[];
    statefulSets!: StatefulSetRes[];
    pvcs!: PvcRes[];
    pvs!: PvRes[];
    storageClasses!: StorageClassRes[];
    // RBAC / ServiceAccounts / Pod-Security (#126)
    serviceAccounts!: ServiceAccountRes[];
    roles!: RoleRes[];                 // Roles UND ClusterRoles (per .cluster unterschieden)
    roleBindings!: RoleBindingRes[];   // RoleBindings UND ClusterRoleBindings (per .cluster)
    podSecurity!: PodSecurityLevel;    // durchgesetzte Pod-Security-Stufe des default-Namespace
    argoApps!: ArgoApp[];
    helmRepos!: string[];
    releases!: Release[];
    charts!: Chart[];
    tf!: { initialized: boolean; applied: boolean; resources: TfResource[] };
    git!: { initialized: boolean; branch: string; branches: string[]; staged: string[]; committed: string[]; commits: GitCommit[]; pushed: boolean; remoteAhead: number; fetched: boolean; conflict: GitConflict | null; pendingConflict: GitPending | null };
    ci!: { pipelines: Pipeline[]; deploy: CiDeploy | null };
    lastDeletedPod: string | null = null;
    lastError!: boolean;
    // Alert-Verlauf der Sitzung (Observability #109). Wie memLimit ein reines
    // Laufzeit-Feld: NICHT serialisiert – Alerts leiten sich aus dem Cluster-Zustand
    // ab, nur der firing→resolved-Übergang braucht ein kurzes Gedächtnis.
    _firingAlerts!: Set<string>;   // brennt gerade
    _resolvedAlerts!: Set<string>; // war mal an, Ursache inzwischen behoben

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

      this.deployments = (sc.deployments || []).map(d => this._makeDeployment(d.name, d.image, d.replicas, d.broken, d.envFrom, d.cpuHeavy));
      this.services = (sc.services || []).map(s => Object.assign({}, s));
      this.ingresses = (sc.ingresses || []).map(i => Object.assign({}, i));
      this.networkPolicies = (sc.networkPolicies || []).map(n => Object.assign({}, n));
      this.secrets = (sc.secrets || []).map(s => Object.assign({}, s));
      this.configMaps = (sc.configMaps || []).map(c => Object.assign({}, c));
      this.files = Object.assign({}, sc.files || {});
      this.applyEffects = sc.applyEffects || {}; // dateiname -> Wirkung von kubectl apply -f
      this.serviceMonitors = (sc.serviceMonitors || []).map(s => Object.assign({}, s));
      this.prometheusRules = (sc.prometheusRules || []).map(r => Object.assign({}, r));
      this.grafanaDatasources = (sc.grafanaDatasources || []).map(d => Object.assign({}, d));
      this.grafanaDashboards = (sc.grafanaDashboards || []).map(d => Object.assign({}, d));

      // Speicher (#122) – Reihenfolge zählt: StorageClass + PVs müssen stehen, bevor
      // PVCs/StatefulSets binden. Ohne explizite Vorgabe gibt es – wie in kind/minikube –
      // genau eine Default-StorageClass "standard", die PVCs dynamisch ein PV beschafft.
      this.storageClasses = (sc.storageClasses || [
        { name: "standard", provisioner: "rancher.io/local-path", reclaimPolicy: "Delete", isDefault: true },
      ]).map(s => ({ name: s.name, provisioner: s.provisioner || "rancher.io/local-path", reclaimPolicy: s.reclaimPolicy || "Delete", isDefault: !!s.isDefault, created: 0 }));
      this.pvs = (sc.pvs || []).map(p => ({ name: p.name, capacity: p.capacity || "1Gi", status: p.status || "Available", claim: p.claim || "", storageClass: p.storageClass || "", accessModes: p.accessModes || "RWO", reclaimPolicy: p.reclaimPolicy || "Retain", created: 0 }));
      this.pvcs = [];
      for (const p of sc.pvcs || []) {
        if (p.status === "Bound" && p.volume) {
          // schon gebunden (z.B. aus einem gespeicherten Stand) – nicht neu provisionieren
          this.pvcs.push({ name: p.name, status: "Bound", volume: p.volume, capacity: p.storage || p.capacity || "1Gi", storageClass: p.storageClass || "", accessModes: p.accessModes || "RWO", created: 0 });
        } else {
          this.pvcs.push(this._makePvc(p.name, p.storage || p.capacity || "1Gi", p.storageClass, p.accessModes));
        }
      }
      this.statefulSets = (sc.statefulSets || []).map(s => this._makeStatefulSet(s));

      // RBAC / ServiceAccounts / Pod-Security (#126). Jeder Namespace hat von Haus
      // aus die "default"-SA; weitere kommen aus dem Szenario oder per `kubectl create`.
      this.serviceAccounts = [{ name: "default", created: 0 }];
      for (const name of sc.serviceAccounts || []) {
        if (!this.serviceAccounts.some(s => s.name === name)) this.serviceAccounts.push({ name, created: 0 });
      }
      this.roles = (sc.roles || []).map(r => ({ name: r.name, cluster: !!r.cluster, rules: r.rules.map(rule => ({ verbs: rule.verbs.slice(), resources: rule.resources.slice() })), created: 0 }));
      this.roleBindings = (sc.roleBindings || []).map(b => ({ name: b.name, cluster: !!b.cluster, roleRef: { kind: b.roleRef.kind, name: b.roleRef.name }, subjects: b.subjects.map(s => Object.assign({}, s)), created: 0 }));
      // Ohne Vorgabe ist die Admission "privileged" (keine Einschränkung) – wie ein frischer Cluster.
      this.podSecurity = sc.podSecurity || "privileged";

      this.argoApps = (sc.argoApps || []).map(a => this._cloneArgoApp(a));

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
        remoteAhead: sc.gitRemoteAhead || 0,
        fetched: !!sc.gitFetched,
        // Aus einem gespeicherten Stand kommen pending/aktiver Konflikt direkt zurück
        // (gitConflict trägt hier das gespeicherte pendingConflict, nicht das Quest-„Scharfstellen“).
        conflict: sc.gitActiveConflict ? Object.assign({}, sc.gitActiveConflict) : null,
        pendingConflict: sc.gitConflict ? Object.assign({}, sc.gitConflict) : null,
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
      this._firingAlerts = new Set();
      this._resolvedAlerts = new Set();
    }

    _makeDeployment(name: string, image: string, replicas: number, broken?: Broken | null, envFrom?: { configMaps: string[]; secrets: string[] }, cpuHeavy?: boolean): Deployment {
      const d: Deployment = {
        name, image, replicas, created: this.clock, pods: [], broken: broken ? Object.assign({}, broken) : null,
        envFrom: { configMaps: (envFrom?.configMaps || []).slice(), secrets: (envFrom?.secrets || []).slice() },
        cpuHeavy: !!cpuHeavy,
      };
      // OOMKilled startet mit einem zu knappen Limit – das ist ja die Ursache.
      if (d.broken && d.broken.type === "oomkilled") d.memLimit = 64;
      for (let i = 0; i < replicas; i++) {
        d.pods.push({ name: makePodName(name), created: this.clock, restarts: 0 });
      }
      return d;
    }

    /** Name der Default-StorageClass (oder "", wenn keine als Default markiert ist).
     *  Ein PVC ohne eigene StorageClass bekommt im echten Cluster genau diese. */
    _defaultStorageClassName(): string {
      const def = this.storageClasses.find(s => s.isDefault);
      return def ? def.name : "";
    }

    /** Bindet ein PVC an Speicher: erst dynamisch über seine StorageClass (legt on-demand
     *  ein passendes PV an), sonst statisch an ein vorhandenes freies PV. Findet sich
     *  beides nicht, bleibt das PVC `Pending` – genau das Lehrbild „kein Speicher da". */
    _bindPvc(pvc: PvcRes) {
      if (pvc.status === "Bound" && pvc.volume) return;
      const sc = pvc.storageClass ? this.storageClasses.find(s => s.name === pvc.storageClass) : null;
      if (sc && sc.provisioner) {
        const pvName = "pvc-" + randSuffix(8);
        this.pvs.push({ name: pvName, capacity: pvc.capacity, status: "Bound", claim: "default/" + pvc.name, storageClass: sc.name, accessModes: pvc.accessModes, reclaimPolicy: sc.reclaimPolicy, created: this.clock });
        pvc.status = "Bound";
        pvc.volume = pvName;
        return;
      }
      const pv = this.pvs.find(p => p.status === "Available" && (!pvc.storageClass || p.storageClass === pvc.storageClass));
      if (pv) {
        pv.status = "Bound";
        pv.claim = "default/" + pvc.name;
        pvc.status = "Bound";
        pvc.volume = pv.name;
        if (pv.capacity) pvc.capacity = pv.capacity;
      }
      // sonst: bleibt Pending (volume "")
    }

    /** Legt ein PVC an und bindet es sofort (siehe _bindPvc). Ohne StorageClass-Angabe
     *  greift die Default-StorageClass; ein leeres "" erzwingt statische Bindung. */
    _makePvc(name: string, storage: string, storageClass?: string, accessModes?: string): PvcRes {
      const pvc: PvcRes = {
        name,
        status: "Pending",
        volume: "",
        capacity: storage || "1Gi",
        storageClass: storageClass !== undefined ? storageClass : this._defaultStorageClassName(),
        accessModes: accessModes || "RWO",
        created: this.clock,
      };
      this._bindPvc(pvc);
      return pvc;
    }

    /** Baut ein StatefulSet: Pods mit STABILER Identität (<name>-0 …) plus je Replica
     *  ein PVC aus dem volumeClaimTemplate (<vct>-<name>-<ordinal>), das gleich gebunden wird. */
    _makeStatefulSet(spec: { name: string; image: string; replicas: number; serviceName?: string; volumeClaimName?: string; storage?: string; storageClass?: string }): StatefulSetRes {
      const vct = spec.volumeClaimName || "data";
      const sts: StatefulSetRes = {
        name: spec.name, image: spec.image, replicas: spec.replicas,
        serviceName: spec.serviceName || spec.name,
        volumeClaimName: vct,
        storage: spec.storage || "1Gi",
        storageClass: spec.storageClass,
        pods: [], created: this.clock,
      };
      for (let i = 0; i < spec.replicas; i++) {
        sts.pods.push({ name: spec.name + "-" + i, created: this.clock, restarts: 0 });
        const pvcName = vct + "-" + spec.name + "-" + i;
        if (!this.pvcs.some(p => p.name === pvcName)) {
          this.pvcs.push(this._makePvc(pvcName, sts.storage, spec.storageClass, "RWO"));
        }
      }
      return sts;
    }

    /** Pod-Status eines Deployments (für get/describe/logs). */
    _podStatus(d: Deployment): PodStatus {
      if (!d.broken) return { status: "Running", ready: "1/1", restarts: 0 };
      if (d.broken.type === "imagepull") return { status: "ImagePullBackOff", ready: "0/1", restarts: 0 };
      if (d.broken.type === "crashloop") return { status: "CrashLoopBackOff", ready: "0/1", restarts: 5 };
      if (d.broken.type === "pending") return { status: "Pending", ready: "0/1", restarts: 0 };
      // oomkilled: Der Container sprengt sein memory-Limit, der Kernel killt ihn,
      // Kubernetes startet neu, er sprengt es wieder … RESTARTS klettern, READY 0/1.
      if (d.broken.type === "oomkilled") return { status: "OOMKilled", ready: "0/1", restarts: 4 };
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
      for (const s of sc.serviceMonitors || []) {
        if (!this.serviceMonitors.some(x => x.name === s.name)) this.serviceMonitors.push(Object.assign({}, s));
      }
      for (const r of sc.prometheusRules || []) {
        if (!this.prometheusRules.some(x => x.name === r.name)) this.prometheusRules.push(Object.assign({}, r));
      }
      for (const d of sc.grafanaDatasources || []) {
        if (!this.grafanaDatasources.some(x => x.name === d.name)) this.grafanaDatasources.push(Object.assign({}, d));
      }
      for (const d of sc.grafanaDashboards || []) {
        if (!this.grafanaDashboards.some(x => x.name === d.name)) this.grafanaDashboards.push(Object.assign({}, d));
      }
      // Speicher (#122) – Reihenfolge wie in reset(): StorageClass + PVs vor PVCs/StatefulSets.
      for (const s of sc.storageClasses || []) {
        if (!this.storageClasses.some(x => x.name === s.name)) this.storageClasses.push({ name: s.name, provisioner: s.provisioner || "rancher.io/local-path", reclaimPolicy: s.reclaimPolicy || "Delete", isDefault: !!s.isDefault, created: this.clock });
      }
      for (const p of sc.pvs || []) {
        if (!this.pvs.some(x => x.name === p.name)) this.pvs.push({ name: p.name, capacity: p.capacity || "1Gi", status: p.status || "Available", claim: p.claim || "", storageClass: p.storageClass || "", accessModes: p.accessModes || "RWO", reclaimPolicy: p.reclaimPolicy || "Retain", created: this.clock });
      }
      for (const p of sc.pvcs || []) {
        if (this.pvcs.some(x => x.name === p.name)) continue;
        if (p.status === "Bound" && p.volume) this.pvcs.push({ name: p.name, status: "Bound", volume: p.volume, capacity: p.storage || p.capacity || "1Gi", storageClass: p.storageClass || "", accessModes: p.accessModes || "RWO", created: this.clock });
        else this.pvcs.push(this._makePvc(p.name, p.storage || p.capacity || "1Gi", p.storageClass, p.accessModes));
      }
      for (const s of sc.statefulSets || []) {
        if (!this.statefulSets.some(x => x.name === s.name)) this.statefulSets.push(this._makeStatefulSet(s));
      }
      // RBAC / ServiceAccounts / Pod-Security (#126) – additiv, ohne Doppler.
      for (const name of sc.serviceAccounts || []) {
        if (!this.serviceAccounts.some(x => x.name === name)) this.serviceAccounts.push({ name, created: this.clock });
      }
      for (const r of sc.roles || []) {
        if (!this.roles.some(x => x.name === r.name && x.cluster === !!r.cluster)) this.roles.push({ name: r.name, cluster: !!r.cluster, rules: r.rules.map(rule => ({ verbs: rule.verbs.slice(), resources: rule.resources.slice() })), created: this.clock });
      }
      for (const b of sc.roleBindings || []) {
        if (!this.roleBindings.some(x => x.name === b.name && x.cluster === !!b.cluster)) this.roleBindings.push({ name: b.name, cluster: !!b.cluster, roleRef: { kind: b.roleRef.kind, name: b.roleRef.name }, subjects: b.subjects.map(s => Object.assign({}, s)), created: this.clock });
      }
      // Höhere enforce-Stufe gewinnt nicht automatisch – eine explizit gesetzte Stufe übernehmen.
      if (sc.podSecurity) this.podSecurity = sc.podSecurity;
      for (const a of sc.argoApps || []) {
        if (!this.argoApps.some(x => x.name === a.name)) this.argoApps.push(this._cloneArgoApp(a));
      }
      if (sc.tfResources) { this.tf.resources = sc.tfResources.slice(); this.tf.initialized = false; this.tf.applied = false; }
      for (const img of sc.dockerImages || []) {
        if (!this.docker.pulled.includes(img)) this.docker.pulled.push(img);
      }
      for (const d of sc.deployments || []) {
        if (!this.deployments.some(x => x.name === d.name)) {
          this.deployments.push(this._makeDeployment(d.name, d.image, d.replicas, d.broken, d.envFrom, d.cpuHeavy));
        }
      }
      for (const cm of sc.configMaps || []) {
        if (!this.configMaps.some(x => x.name === cm.name)) this.configMaps.push(Object.assign({}, cm));
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
      // Kollaborations-Setup (origin voraus + scharf gestellter Konflikt) als EINHEIT
      // einmischen. game.ts re-merged beim Laden alle erreichten Szenarien – ein nacktes
      // `remoteAhead = N` würde dabei nach jedem Pull wieder auf N hochschnellen. Deshalb
      // hängt es am idempotenten Konflikt-Scharfstellen: nur wenn der Branch NEU ist.
      if (sc.gitConflict && !this.git.branches.includes(sc.gitConflict.branch)) {
        if (sc.gitRemoteAhead) this.git.remoteAhead = sc.gitRemoteAhead;
        this._armGitConflict(sc.gitConflict);
      } else if (sc.gitRemoteAhead && !sc.gitConflict) {
        // remoteAhead ohne Konflikt ist nicht reload-idempotent – nur für Tests/Drills,
        // die den Wert ohnehin direkt setzen und nicht über einen Spielstand neu laden.
        this.git.remoteAhead = sc.gitRemoteAhead;
      }
    }

    /** Stellt einen Merge-Konflikt scharf: legt den hereinkommenden Branch an und
     *  merkt sich, welche Datei beim nächsten `git merge <branch>` kollidiert.
     *  Idempotent über Reloads: existiert der Branch schon, wird nichts neu gemacht. */
    _armGitConflict(c?: GitPending | null) {
      if (!c || this.git.branches.includes(c.branch)) return;
      this.git.branches.push(c.branch);
      this.git.pendingConflict = { branch: c.branch, file: c.file, ours: c.ours, theirs: c.theirs };
      if (!this.files[c.file]) this.files[c.file] = c.ours; // unsere Version liegt im Arbeitsverzeichnis
    }

    /** Zustand als speicherbares Szenario ausgeben (für localStorage). */
    snapshot() {
      return {
        dockerImages: this.docker.pulled.slice(),
        dockerContainers: this.docker.containers.map(c => Object.assign({}, c)),
        nodes: this.nodes.map(n => Object.assign({}, n)),
        deployments: this.deployments.map(d => ({ name: d.name, image: d.image, replicas: d.replicas, broken: d.broken ? Object.assign({}, d.broken) : null, envFrom: { configMaps: d.envFrom.configMaps.slice(), secrets: d.envFrom.secrets.slice() }, cpuHeavy: !!d.cpuHeavy })),
        services: this.services.map(s => Object.assign({}, s)),
        ingresses: this.ingresses.map(i => Object.assign({}, i)),
        networkPolicies: this.networkPolicies.map(n => Object.assign({}, n)),
        secrets: this.secrets.map(s => ({ name: s.name, keys: s.keys.slice() })),
        configMaps: this.configMaps.map(c => ({ name: c.name, keys: c.keys.slice() })),
        files: Object.assign({}, this.files),
        applyEffects: JSON.parse(JSON.stringify(this.applyEffects)),
        serviceMonitors: this.serviceMonitors.map(s => Object.assign({}, s)),
        prometheusRules: this.prometheusRules.map(r => Object.assign({}, r)),
        grafanaDatasources: this.grafanaDatasources.map(d => Object.assign({}, d)),
        grafanaDashboards: this.grafanaDashboards.map(d => Object.assign({}, d)),
        // Speicher (#122): PVCs gebunden serialisieren (volume + status), damit ein Reload
        // sie NICHT neu provisioniert; StatefulSets nur als Spezifikation – ihre Pods (stabile
        // Namen) und bereits vorhandene PVCs baut reset() deterministisch wieder auf.
        storageClasses: this.storageClasses.map(s => Object.assign({}, s)),
        pvs: this.pvs.map(p => Object.assign({}, p)),
        pvcs: this.pvcs.map(p => ({ name: p.name, storage: p.capacity, status: p.status, volume: p.volume, storageClass: p.storageClass, accessModes: p.accessModes })),
        statefulSets: this.statefulSets.map(s => ({ name: s.name, image: s.image, replicas: s.replicas, serviceName: s.serviceName, volumeClaimName: s.volumeClaimName, storage: s.storage, storageClass: s.storageClass })),
        // RBAC / ServiceAccounts / Pod-Security (#126). Die "default"-SA legt reset()
        // ohnehin wieder an – nur die selbst erstellten serialisieren.
        serviceAccounts: this.serviceAccounts.filter(s => s.name !== "default").map(s => s.name),
        roles: this.roles.map(r => ({ name: r.name, cluster: r.cluster, rules: r.rules.map(rule => ({ verbs: rule.verbs.slice(), resources: rule.resources.slice() })) })),
        roleBindings: this.roleBindings.map(b => ({ name: b.name, cluster: b.cluster, roleRef: { kind: b.roleRef.kind, name: b.roleRef.name }, subjects: b.subjects.map(s => Object.assign({}, s)) })),
        podSecurity: this.podSecurity,
        argoApps: this.argoApps.map(a => this._cloneArgoApp(a)),
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
        gitRemoteAhead: this.git.remoteAhead,
        gitFetched: this.git.fetched,
        // pendingConflict landet im gitConflict-Feld; _armGitConflict greift beim
        // Wieder-Einmischen nicht (Branch existiert bereits) -> kein Doppel-Scharfstellen.
        gitConflict: this.git.pendingConflict ? Object.assign({}, this.git.pendingConflict) : null,
        gitActiveConflict: this.git.conflict ? Object.assign({}, this.git.conflict) : null,
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
      // Argo CD reconciliert vor jeder Eingabe: Self-Heal-Apps drehen zwischenzeitlichen
      // Drift (z.B. ein `kubectl scale` aus dem letzten Befehl) von selbst auf den Git-Soll zurück.
      this._reconcileAutoSync();
      // Alert-Regeln gegen den (ggf. gerade reconcilten) Zustand auswerten, damit der
      // firing→resolved-Verlauf mitläuft, während gespielt wird (Observability #109).
      this._evaluateAlerts();
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
          case "argocd": out = this._argocd(tokens); break;
          case "glab": out = this._glab(tokens); break;
          case "ls": out = this._ls(); break;
          case "cat": out = this._cat(tokens); break;
          case "clear": return { output: null, error: false, clear: true };
          case "help": out = this._help(); break;
          default: {
            const guess = this._suggest(cmd, ["docker", "kubectl", "helm", "terraform", "git", "argocd", "glab", "ls", "cat", "clear", "help"]);
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

    /** Alle Werte eines (wiederholbaren UND kommagetrennten) Flags einsammeln, z.B.
     *  `--verb=get,list --verb=watch` → ["get","list","watch"]. Für RBAC-Befehle (#126). */
    _multiFlag(raw: string, flag: string): string[] {
      const re = new RegExp("--" + flag + "[=\\s]([^\\s]+)", "g");
      const out: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(raw)) !== null) {
        for (const part of m[1].split(",")) if (part) out.push(part);
      }
      return out;
    }

    _help() {
      return [
        "Verfügbare Befehle im Simulator:",
        "  docker     pull | build -t <name> . | tag <quelle> <ziel> | run | ps [-a] | images | stop | rm",
        "  kubectl    get pods|deployments|services|endpoints|ingress|networkpolicies|servicemonitors|prometheusrules|grafanadatasources|grafanadashboards|alerts|nodes|secrets|configmaps|serviceaccounts|roles|rolebindings | describe pod|ingress|networkpolicy|role|serviceaccount <name>",
        "             create deployment | create secret generic|tls | create configmap | create serviceaccount|role|clusterrole|rolebinding|clusterrolebinding | scale | expose | delete | apply -f <datei>",
        "             auth can-i <verb> <resource> [--as=…] | label namespace <ns> pod-security.kubernetes.io/enforce=<stufe>",
        "             logs [-f] [--previous] <pod> | top pods|nodes | set image deployment/<n> <c>=<img> | set env deployment/<n> --from=configmap|secret/<n> | set resources deployment/<n> --limits=memory=256Mi | rollout restart deployment <n>",
        "  helm       repo add|update | search repo | create | lint | package | install | list | upgrade | rollback | uninstall | status",
        "  terraform  init | plan | apply | destroy | state list",
        "  git        init | status | add <datei> | commit -m \"…\" | log | branch [<name>] | checkout [-b] <name> | merge <name> | push | fetch | pull",
        "  argocd     app list | app get <name> | app sync <name>  (Argo CD / GitOps – den Git-Soll in den Cluster ziehen)",
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

      if (sub === "build") {
        // docker build -t <name[:tag]> <kontext>  – baut aus dem Dockerfile ein eigenes Image.
        const tagSpec = this._flagValue(t, "-t") || this._flagValue(t, "--tag");
        if (!tagSpec) return this._err("docker build: Ohne -t bekommt dein Image keinen Namen.", "Muster: docker build -t <name>:<tag> .");
        // Build-Kontext = das positionale Argument (PATH | URL | -) hinter den Optionen.
        // Fehlt es, bricht echtes Docker mit "requires exactly 1 argument" ab – kein falscher Erfolg.
        const valueFlags = new Set(["-t", "--tag", "-f", "--file"]);
        let hasContext = false;
        for (let i = 2; i < t.length; i++) {
          const tok = t[i];
          if (tok.startsWith("-")) {
            // Wert-Flag ohne "="-Form frisst das nächste Token als seinen Wert.
            if (!tok.includes("=") && valueFlags.has(tok)) i++;
            continue;
          }
          hasContext = true;
        }
        if (!hasContext) {
          return this._err('"docker build" requires exactly 1 argument.',
            "Am Ende fehlt der Build-Kontext-Punkt '.' – er sagt: der Bauplan (Dockerfile) liegt HIER im aktuellen Ordner. Muster: docker build -t <name>:<tag> .");
        }
        if (!this.files["Dockerfile"]) {
          return this._err("ERROR: failed to read dockerfile: open Dockerfile: no such file or directory",
            "docker build liest den Bauplan aus einer Datei namens 'Dockerfile' im aktuellen Ordner. Schau mit 'ls', ob sie da ist.");
        }
        const full = tagSpec.includes(":") ? tagSpec : tagSpec + ":latest";
        const base = (this.files["Dockerfile"].match(/^\s*FROM\s+(\S+)/m) || [])[1] || "scratch";
        const copyLines = (this.files["Dockerfile"].match(/^\s*(COPY|ADD|RUN)\b/gim) || []).length;
        const total = 3 + copyLines; // load definition + FROM + (COPY/ADD/RUN…) + export
        if (!this.docker.pulled.includes(full)) this.docker.pulled.push(full);
        return [
          "[+] Building 2.4s (" + total + "/" + total + ") FINISHED",
          " => [internal] load build definition from Dockerfile",
          " => [internal] load metadata for " + base,
          " => [1/" + Math.max(1, copyLines + 1) + "] FROM " + base,
          copyLines ? " => [2/" + (copyLines + 1) + "] COPY/RUN-Schritte aus dem Dockerfile" : " => (keine weiteren Schichten)",
          " => exporting to image",
          " => => naming to docker.io/library/" + full,
          "Successfully built " + randSuffix(12),
          "Successfully tagged " + full,
        ].join("\n");
      }

      if (sub === "tag") {
        // docker tag <quelle> <ziel>  – hängt einem vorhandenen Image einen zweiten Namen an.
        const src = t[2], dst = t[3];
        if (!src || !dst || src.startsWith("-") || dst.startsWith("-")) {
          return this._err("docker tag: Quelle und Ziel fehlen.", "Muster: docker tag <quelle>[:tag] <ziel>[:tag]");
        }
        const srcFull = src.includes(":") ? src : src + ":latest";
        if (!this.docker.pulled.includes(srcFull) && !this.docker.pulled.includes(src)) {
          return this._err("Error response from daemon: No such image: " + src,
            "Das Quell-Image gibt es (noch) nicht. Mit 'docker images' siehst du, was da ist – oder erst 'docker build -t " + src + " .'.");
        }
        const dstFull = dst.includes(":") ? dst : dst + ":latest";
        if (!this.docker.pulled.includes(dstFull)) this.docker.pulled.push(dstFull);
        return ""; // echtes 'docker tag' ist still (kein Output)
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
        if (list.length === 0) return "CONTAINER ID   IMAGE   COMMAND   CREATED   STATUS   PORTS   NAMES" + (all ? "" : "\n💡 Keine laufenden Container. Mit 'docker ps --all' siehst du auch gestoppte.");
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
      if (sub === "top") return this._kubectlTop(t);
      if (sub === "set") return this._kubectlSet(t, raw);
      if (sub === "rollout") return this._kubectlRollout(t);
      if (sub === "auth") return this._kubectlAuth(t, raw);
      if (sub === "label") return this._kubectlLabel(t, raw);

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
        // StatefulSet-Pods (#122): stabile Namen <sts>-0, immer Running/ready.
        for (const s of this.statefulSets) {
          for (const p of s.pods) rows.push([p.name, "1/1", "Running", String(p.restarts), this._age(p.created)]);
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

      if (["configmaps", "configmap", "cm"].includes(what)) {
        if (this.configMaps.length === 0) return "No resources found in default namespace.";
        return table(["NAME", "DATA", "AGE"],
          this.configMaps.map(c => [c.name, String(c.keys.length), this._age(c.created || 0)]));
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

      if (["servicemonitors", "servicemonitor", "smon"].includes(what)) {
        if (this.serviceMonitors.length === 0) return "No resources found in default namespace.";
        return table(["NAME", "SELECTOR", "ENDPOINT", "AGE"],
          this.serviceMonitors.map(s => [s.name, "app=" + s.selector, s.port + " @ " + s.interval, this._age(s.created || 0)]));
      }

      if (["prometheusrules", "prometheusrule", "promrule", "promrules"].includes(what)) {
        if (this.prometheusRules.length === 0) return "No resources found in default namespace.";
        return table(["NAME", "ALERT", "SEVERITY", "AGE"],
          this.prometheusRules.map(r => [r.name, r.alert, r.severity, this._age(r.created || 0)]));
      }

      if (["grafanadatasources", "grafanadatasource", "grafanadatasrc"].includes(what)) {
        if (this.grafanaDatasources.length === 0) return "No resources found in default namespace.";
        return table(["NAME", "TYPE", "AGE"],
          this.grafanaDatasources.map(d => [d.name, d.dsType, this._age(d.created || 0)]));
      }

      if (["grafanadashboards", "grafanadashboard", "grafanadash"].includes(what)) {
        if (this.grafanaDashboards.length === 0) return "No resources found in default namespace.";
        return table(["NAME", "TITLE", "PANELS", "AGE"],
          this.grafanaDashboards.map(d => [d.name, d.title, String(d.panels), this._age(d.created || 0)]));
      }

      if (["statefulsets", "statefulset", "sts"].includes(what)) {
        if (this.statefulSets.length === 0) return "No resources found in default namespace.";
        return table(["NAME", "READY", "AGE"],
          this.statefulSets.map(s => [s.name, s.pods.length + "/" + s.replicas, this._age(s.created)]));
      }

      if (["persistentvolumeclaims", "persistentvolumeclaim", "pvc"].includes(what)) {
        if (this.pvcs.length === 0) return "No resources found in default namespace.";
        return table(["NAME", "STATUS", "VOLUME", "CAPACITY", "ACCESS MODES", "STORAGECLASS", "AGE"],
          this.pvcs.map(p => [p.name, p.status, p.volume || "", p.status === "Bound" ? p.capacity : "", p.accessModes, p.storageClass || "", this._age(p.created)]));
      }

      if (["persistentvolumes", "persistentvolume", "pv"].includes(what)) {
        if (this.pvs.length === 0) return "No resources found.";
        return table(["NAME", "CAPACITY", "ACCESS MODES", "RECLAIM POLICY", "STATUS", "CLAIM", "STORAGECLASS", "AGE"],
          this.pvs.map(p => [p.name, p.capacity, p.accessModes, p.reclaimPolicy, p.status, p.claim || "", p.storageClass || "", this._age(p.created)]));
      }

      if (["storageclasses", "storageclass", "sc"].includes(what)) {
        if (this.storageClasses.length === 0) return "No resources found.";
        return table(["NAME", "PROVISIONER", "RECLAIMPOLICY", "AGE"],
          this.storageClasses.map(s => [s.name + (s.isDefault ? " (default)" : ""), s.provisioner, s.reclaimPolicy, this._age(s.created)]));
      }

      if (["serviceaccounts", "serviceaccount", "sa"].includes(what)) {
        return table(["NAME", "SECRETS", "AGE"],
          this.serviceAccounts.map(s => [s.name, "0", this._age(s.created)]));
      }

      if (["roles", "role"].includes(what)) {
        const rs = this.roles.filter(r => !r.cluster);
        if (rs.length === 0) return "No resources found in default namespace.";
        return table(["NAME", "AGE"], rs.map(r => [r.name, this._age(r.created)]));
      }

      if (["clusterroles", "clusterrole"].includes(what)) {
        const rs = this.roles.filter(r => r.cluster);
        if (rs.length === 0) return "No resources found.";
        return table(["NAME", "AGE"], rs.map(r => [r.name, this._age(r.created)]));
      }

      if (["rolebindings", "rolebinding", "rb"].includes(what)) {
        const bs = this.roleBindings.filter(b => !b.cluster);
        if (bs.length === 0) return "No resources found in default namespace.";
        return table(["NAME", "ROLE", "AGE"], bs.map(b => [b.name, b.roleRef.kind + "/" + b.roleRef.name, this._age(b.created)]));
      }

      if (["clusterrolebindings", "clusterrolebinding", "crb"].includes(what)) {
        const bs = this.roleBindings.filter(b => b.cluster);
        if (bs.length === 0) return "No resources found.";
        return table(["NAME", "ROLE", "AGE"], bs.map(b => [b.name, b.roleRef.kind + "/" + b.roleRef.name, this._age(b.created)]));
      }

      if (["alerts", "alert"].includes(what)) {
        const active = this.alerts();
        if (active.length === 0) return "No alerts firing.";
        return table(["NAME", "SEVERITY", "STATE", "SUMMARY"],
          active.map(a => [a.name, a.severity, a.state, a.summary]));
      }

      if (!what) return this._err("kubectl get: Was möchtest du sehen?", "z.B. 'kubectl get pods' oder 'kubectl get nodes'");
      return this._err('error: the server doesn\'t have a resource type "' + what + '"', "Gemeint war vielleicht: pods, deployments, services, endpoints, ingress, networkpolicies, servicemonitors, prometheusrules, grafanadashboards, alerts, secrets, configmaps, serviceaccounts, roles, rolebindings oder nodes?");
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
      if (["role", "clusterrole"].includes(what)) {
        const cluster = what === "clusterrole";
        if (!name) return this._err("kubectl describe " + what + ": Welche Rolle?", "Die Namen siehst du mit 'kubectl get " + what + "s'.");
        const role = this.roles.find(r => r.name === name && r.cluster === cluster);
        if (!role) return this._err('Error from server (NotFound): ' + what + 's.rbac.authorization.k8s.io "' + name + '" not found', "Tipp: Namen aus 'kubectl get " + what + "s' kopieren.");
        const lines = [
          "Name:         " + role.name,
          ...(cluster ? [] : ["Namespace:    default"]),
          "PolicyRule:",
          "  Resources  Verbs",
          "  ---------  -----",
        ];
        for (const rule of role.rules) lines.push("  " + rule.resources.join(",") + "  [" + rule.verbs.join(" ") + "]");
        return lines.join("\n");
      }
      if (["serviceaccount", "serviceaccounts", "sa"].includes(what)) {
        if (!name) return this._err("kubectl describe serviceaccount: Welche SA?", "Die Namen siehst du mit 'kubectl get sa'.");
        const acc = this.serviceAccounts.find(s => s.name === name);
        if (!acc) return this._err('Error from server (NotFound): serviceaccounts "' + name + '" not found', "Tipp: Namen aus 'kubectl get sa' kopieren.");
        return ["Name:         " + acc.name, "Namespace:    default", "Mountable secrets:  <none>"].join("\n");
      }
      if (!["pod", "pods"].includes(what)) return this._err("Der Simulator kann nur 'kubectl describe pod|ingress|networkpolicy|role|clusterrole|serviceaccount <name>'.");
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
      } else if (dep.broken.type === "oomkilled") {
        events.push("  Normal   Scheduled  " + this._age(pod.created) + "   Successfully assigned default/" + pod.name);
        events.push("  Normal   Pulled     " + this._age(pod.created) + "   Container image \"" + dep.image + "\" already present");
        events.push("  Warning  BackOff    " + this._age(pod.created) + "   Back-off restarting failed container (zuletzt OOMKilled – Limit zu knapp)");
      }
      // OOMKilled zeigt sich NICHT im State (der ist gerade wieder Waiting), sondern im
      // Last State + Reason und am memory-Limit – genau das ist die Lern-Pointe.
      const oom = !!dep.broken && dep.broken.type === "oomkilled";
      const containerBlock = [
        "  " + dep.name + ":",
        "    Image:        " + dep.image,
        "    State:        " + (oom ? "Waiting (CrashLoopBackOff)" : st.status),
        ...(oom ? [
          "    Last State:   Terminated",
          "      Reason:     OOMKilled",
          "      Exit Code:  137",
          "    Limits:",
          "      memory:     " + (dep.memLimit || 64) + "Mi",
        ] : []),
        "    Restart Count: " + (st.restarts || pod.restarts),
      ];
      return [
        "Name:         " + pod.name,
        "Namespace:    default",
        "Node:         " + (dep.broken && dep.broken.type === "pending" ? "<none>" : this.nodes[1].name),
        "Status:       " + (st.status === "Running" ? "Running" : st.status === "Pending" ? "Pending" : "Waiting (" + st.status + ")"),
        "Ready:        " + st.ready,
        "IP:           " + (dep.broken && dep.broken.type === "pending" ? "<none>" : "10.244.1." + (10 + Math.floor(Math.random() * 200))),
        "Controlled By: ReplicaSet/" + dep.name,
        "Containers:",
        ...containerBlock,
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
      if (t[2] === "configmap" || t[2] === "cm") {
        // kubectl create configmap <name> --from-literal=schluessel=wert
        const name = t[3];
        if (!name || name.startsWith("--")) return this._err("kubectl create configmap: Der Name fehlt.", "Muster: kubectl create configmap <name> --from-literal=schluessel=wert");
        const literals = [...raw.matchAll(/--from-literal[=\s]([\w.-]+)=(\S+)/g)].map(m => m[1]);
        if (literals.length === 0) return this._err("error: at least one --from-literal is required", "Häng '--from-literal=log_level=info' an.");
        if (this.configMaps.some(c => c.name === name)) return this._err('error: configmaps "' + name + '" already exists');
        this.configMaps.push({ name, keys: literals, created: this.clock });
        return "configmap/" + name + " created";
      }
      if (t[2] === "serviceaccount" || t[2] === "sa") {
        const name = t[3];
        if (!name || name.startsWith("--")) return this._err("kubectl create serviceaccount: Der Name fehlt.", "Muster: kubectl create serviceaccount <name>");
        if (this.serviceAccounts.some(s => s.name === name)) return this._err('error: serviceaccounts "' + name + '" already exists');
        this.serviceAccounts.push({ name, created: this.clock });
        return "serviceaccount/" + name + " created";
      }
      if (t[2] === "role" || t[2] === "clusterrole") {
        const cluster = t[2] === "clusterrole";
        const name = t[3];
        if (!name || name.startsWith("--")) return this._err("kubectl create " + t[2] + ": Der Name fehlt.", "Muster: kubectl create " + t[2] + " <name> --verb=get,list --resource=pods");
        const verbs = this._multiFlag(raw, "verb");
        const resources = this._multiFlag(raw, "resource");
        if (verbs.length === 0) return this._err("error: at least one --verb must be specified", "Häng z.B. '--verb=get,list' an.");
        if (resources.length === 0) return this._err("error: at least one --resource must be specified", "Häng z.B. '--resource=pods' an.");
        const kind = cluster ? "clusterrole" : "role";
        if (this.roles.some(r => r.cluster === cluster && r.name === name)) return this._err('error: ' + kind + 's.rbac.authorization.k8s.io "' + name + '" already exists');
        this.roles.push({ name, cluster, rules: [{ verbs, resources }], created: this.clock });
        return kind + ".rbac.authorization.k8s.io/" + name + " created";
      }
      if (t[2] === "rolebinding" || t[2] === "clusterrolebinding") {
        const cluster = t[2] === "clusterrolebinding";
        const name = t[3];
        if (!name || name.startsWith("--")) return this._err("kubectl create " + t[2] + ": Der Name fehlt.", "Muster: kubectl create " + t[2] + " <name> --role=<rolle> --serviceaccount=<ns>:<sa>");
        const roleName = this._flagValue(t, "--role");
        const clusterRoleName = this._flagValue(t, "--clusterrole");
        // ClusterRoleBinding kann sich nur auf eine ClusterRole beziehen.
        if (cluster && roleName) return this._err("error: a ClusterRoleBinding can only reference a ClusterRole", "Nutze '--clusterrole=<name>' statt '--role'.");
        if (!roleName && !clusterRoleName) return this._err("error: exactly one of --role or --clusterrole must be specified", cluster ? "Häng '--clusterrole=<name>' an." : "Häng '--role=<name>' oder '--clusterrole=<name>' an.");
        const roleRef = clusterRoleName ? { kind: "ClusterRole" as const, name: clusterRoleName } : { kind: "Role" as const, name: roleName! };
        const subjects: RbacSubject[] = [];
        for (const u of this._multiFlag(raw, "user")) subjects.push({ kind: "User", name: u });
        for (const sa of this._multiFlag(raw, "serviceaccount")) {
          const [ns, n] = sa.includes(":") ? sa.split(":") : ["default", sa];
          subjects.push({ kind: "ServiceAccount", name: n, namespace: ns });
        }
        if (subjects.length === 0) return this._err("error: at least one of --user or --serviceaccount must be specified", "Muster: '--serviceaccount=default:deploy-bot' oder '--user=alice'.");
        const kind = cluster ? "clusterrolebinding" : "rolebinding";
        if (this.roleBindings.some(b => b.cluster === cluster && b.name === name)) return this._err('error: ' + kind + 's.rbac.authorization.k8s.io "' + name + '" already exists');
        this.roleBindings.push({ name, cluster, roleRef, subjects, created: this.clock });
        return kind + ".rbac.authorization.k8s.io/" + name + " created";
      }
      if (t[2] !== "deployment") return this._err("Der Simulator kann nur 'kubectl create deployment|serviceaccount|role|clusterrole|rolebinding|clusterrolebinding …', 'kubectl create secret generic|tls …' und 'kubectl create configmap …'.");
      const name = t[3];
      const imgMatch = raw.match(/--image[=\s]+(\S+)/);
      if (!name || name.startsWith("--")) return this._err("kubectl create deployment: Der Name fehlt.", "z.B. 'kubectl create deployment kasse --image=nginx'");
      if (!imgMatch) return this._err("error: required flag(s) \"image\" not set", "Häng '--image=nginx' an.");
      if (this.deployments.some(d => d.name === name)) return this._err('error: deployment "' + name + '" already exists');
      // Pod-Security-Admission: ein imperativ erzeugtes Deployment hat keinen securityContext.
      // Unter baseline/restricted wird es deshalb abgelehnt (privileged = keine Prüfung).
      const denied = this._admitPod(name, undefined);
      if (denied) return this._err(denied, "Setz die Stufe mit 'kubectl label namespace default pod-security.kubernetes.io/enforce=privileged' herab oder liefere einen passenden securityContext per Manifest.");
      this.deployments.push(this._makeDeployment(name, imgMatch[1], 1));
      return "deployment.apps/" + name + " created";
    }

    /* ---- RBAC-Auswertung (#126) ---- */

    /** Subjekt → stabiler Schlüssel, damit Bindungs-Subjekt und `--as`-Anfrage vergleichbar sind.
     *  User → "user:<name>", ServiceAccount → "sa:<ns>:<name>". */
    _subjectKey(s: RbacSubject): string {
      return s.kind === "ServiceAccount" ? "sa:" + (s.namespace || "default") + ":" + s.name : "user:" + s.name;
    }

    /** `--as`-Wert (oder null) in einen Subjekt-Schlüssel übersetzen.
     *  Akzeptiert "system:serviceaccount:<ns>:<sa>" (SA) und sonst "<user>" (User). */
    _asKey(as: string | null): string | null {
      if (!as) return null;
      const m = as.match(/^system:serviceaccount:([^:]+):(.+)$/);
      if (m) return "sa:" + m[1] + ":" + m[2];
      return "user:" + as;
    }

    /** Darf das Subjekt (Schlüssel) `verb` auf `resource`? null = Admin (kein --as) → alles erlaubt. */
    _canI(verb: string, resource: string, subjectKey: string | null): boolean {
      if (subjectKey === null) return true; // ohne --as fragt man die eigenen (Admin-)Rechte ab
      for (const b of this.roleBindings) {
        if (!b.subjects.some(s => this._subjectKey(s) === subjectKey)) continue;
        const role = this.roles.find(r => r.name === b.roleRef.name && r.cluster === (b.roleRef.kind === "ClusterRole"));
        if (!role) continue; // baumelnde Referenz: gewährt nichts
        for (const rule of role.rules) {
          const verbOk = rule.verbs.includes("*") || rule.verbs.includes(verb);
          const resOk = rule.resources.includes("*") || rule.resources.includes(resource);
          if (verbOk && resOk) return true;
        }
      }
      return false;
    }

    _kubectlAuth(t: string[], raw: string) {
      if (t[2] !== "can-i") return this._err("Der Simulator kann nur 'kubectl auth can-i <verb> <resource> [--as=…]'.");
      // can-i <verb> <resource>; --as ignorieren wir bei der Positions-Suche.
      const positional = t.slice(3).filter(tok => !tok.startsWith("-"));
      const verb = positional[0];
      const resource = positional[1];
      if (!verb || !resource) return this._err("kubectl auth can-i: Es fehlt verb oder resource.", "Muster: kubectl auth can-i get pods --as=system:serviceaccount:default:deploy-bot");
      const subjectKey = this._asKey(this._flagValue(t, "--as"));
      return this._canI(verb, resource, subjectKey) ? "yes" : "no";
    }

    /* ---- Pod-Security-Admission (#126) ---- */

    /** Setzt die durchgesetzte Stufe per Namespace-Label, z.B.
     *  `kubectl label namespace default pod-security.kubernetes.io/enforce=restricted`. */
    _kubectlLabel(t: string[], raw: string) {
      if (t[2] !== "namespace" && t[2] !== "ns") return this._err("Der Simulator kann nur 'kubectl label namespace <ns> pod-security.kubernetes.io/enforce=<stufe>'.");
      const nsName = t[3];
      if (!nsName || nsName.startsWith("-")) return this._err("kubectl label namespace: Welcher Namespace?", "Muster: kubectl label namespace default pod-security.kubernetes.io/enforce=restricted");
      const m = raw.match(/pod-security\.kubernetes\.io\/enforce=(\S+)/);
      if (!m) return this._err("Der Simulator versteht hier nur das Label 'pod-security.kubernetes.io/enforce=<stufe>'.", "z.B. '…/enforce=baseline' oder '…/enforce=restricted'.");
      const level = m[1];
      if (level !== "privileged" && level !== "baseline" && level !== "restricted") {
        return this._err('error: unbekannte Pod-Security-Stufe "' + level + '"', "Erlaubt sind: privileged, baseline, restricted.");
      }
      this.podSecurity = level;
      return "namespace/" + nsName + " labeled";
    }

    /** Prüft einen Pod gegen die durchgesetzte Stufe. Rückgabe: null = zugelassen,
     *  sonst die (deutsche) Ablehnungs-Begründung. privileged = nie ablehnen. */
    _admitPod(name: string, sc: SecurityContext | undefined): string | null {
      const level = this.podSecurity;
      if (level === "privileged") return null;
      const ctx = sc || {};
      const violations: string[] = [];
      // baseline UND restricted: keine privilegierten Container.
      if (ctx.privileged === true) violations.push("privileged=true ist verboten");
      if (level === "restricted") {
        // restricted verlangt zusätzlich nicht-root + keine Rechte-Eskalation.
        if (ctx.runAsNonRoot !== true) violations.push("runAsNonRoot muss true sein");
        if (ctx.allowPrivilegeEscalation !== false) violations.push("allowPrivilegeEscalation muss false sein");
      }
      if (violations.length === 0) return null;
      return 'Error from server (Forbidden): admission webhook "pod-security" denied the request: '
        + "Pod '" + name + "' verletzt die Pod-Security-Stufe '" + level + "': " + violations.join(", ") + ".";
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
        const effStsDel = eff.statefulSet;
        if (effStsDel) {
          const i = this.statefulSets.findIndex(x => x.name === effStsDel.name);
          if (i >= 0) { this.statefulSets.splice(i, 1); out.push('statefulset.apps "' + effStsDel.name + '" deleted'); } // PVCs bleiben absichtlich (#122)
        }
        const effPvcDel = eff.pvc;
        if (effPvcDel) {
          const i = this.pvcs.findIndex(x => x.name === effPvcDel.name);
          if (i >= 0) { this.pvcs.splice(i, 1); out.push('persistentvolumeclaim "' + effPvcDel.name + '" deleted'); }
        }
        const effPvDel = eff.pv;
        if (effPvDel) {
          const i = this.pvs.findIndex(x => x.name === effPvDel.name);
          if (i >= 0) { this.pvs.splice(i, 1); out.push('persistentvolume "' + effPvDel.name + '" deleted'); }
        }
        const effScDel = eff.storageClass;
        if (effScDel) {
          const i = this.storageClasses.findIndex(x => x.name === effScDel.name);
          if (i >= 0) { this.storageClasses.splice(i, 1); out.push('storageclass.storage.k8s.io "' + effScDel.name + '" deleted'); }
        }
        return out.join("\n") || "nothing deleted";
      }

      if (!name) return this._err("kubectl delete: Was und wie heißt es?", "z.B. 'kubectl delete pod <pod-name>'");

      if (["pod", "pods", "po"].includes(what)) {
        const dep = this._findDeploymentOfPod(name);
        if (dep) {
          const idx = dep.pods.findIndex(p => p.name === name);
          dep.pods.splice(idx, 1);
          this.lastDeletedPod = name;
          // Self-Healing: das Deployment ersetzt den Pod sofort – mit NEUEM Zufallsnamen.
          dep.pods.push({ name: makePodName(dep.name), created: this.clock, restarts: 0 });
          return 'pod "' + name + '" deleted';
        }
        // StatefulSet-Pod (#122): kommt mit GLEICHEM Namen und GLEICHEM PVC zurück –
        // die Daten überleben. Das PVC wird bewusst NICHT angefasst.
        const sts = this.statefulSets.find(s => s.pods.some(p => p.name === name));
        if (sts) {
          const idx = sts.pods.findIndex(p => p.name === name);
          sts.pods.splice(idx, 1);
          this.lastDeletedPod = name;
          sts.pods.splice(idx, 0, { name, created: this.clock, restarts: 0 }); // stabile Identität: gleicher Name, gleiche Ordinalposition
          return 'pod "' + name + '" deleted';
        }
        return this._err('Error from server (NotFound): pods "' + name + '" not found', "Pod-Namen siehst du mit 'kubectl get pods'.");
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

      if (["configmap", "configmaps", "cm"].includes(what)) {
        const idx = this.configMaps.findIndex(c => c.name === name);
        if (idx === -1) return this._err('Error from server (NotFound): configmaps "' + name + '" not found');
        this.configMaps.splice(idx, 1);
        return 'configmap "' + name + '" deleted';
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

      if (["statefulset", "statefulsets", "sts"].includes(what)) {
        const idx = this.statefulSets.findIndex(s => s.name === name);
        if (idx === -1) return this._err('Error from server (NotFound): statefulsets.apps "' + name + '" not found');
        this.statefulSets.splice(idx, 1);
        // Die PVCs bleiben absichtlich erhalten – Kern der Datendauerhaftigkeit (#122).
        return 'statefulset.apps "' + name + '" deleted\n💡 Die PVCs bleiben bestehen – die Daten überleben das Löschen des StatefulSets. Skalierst du es wieder hoch, hängen die alten Volumes wieder dran.';
      }

      if (["pvc", "persistentvolumeclaim", "persistentvolumeclaims"].includes(what)) {
        const idx = this.pvcs.findIndex(p => p.name === name);
        if (idx === -1) return this._err('Error from server (NotFound): persistentvolumeclaims "' + name + '" not found');
        const [removed] = this.pvcs.splice(idx, 1);
        // Gebundenes PV freigeben: Delete-Policy entfernt es, Retain hinterlässt es als "Released".
        const pv = this.pvs.find(p => p.name === removed.volume);
        if (pv) {
          if (pv.reclaimPolicy === "Retain") { pv.status = "Released"; pv.claim = ""; }
          else { const j = this.pvs.findIndex(x => x.name === pv.name); if (j >= 0) this.pvs.splice(j, 1); }
        }
        return 'persistentvolumeclaim "' + name + '" deleted';
      }

      if (["pv", "persistentvolume", "persistentvolumes"].includes(what)) {
        const idx = this.pvs.findIndex(p => p.name === name);
        if (idx === -1) return this._err('Error from server (NotFound): persistentvolumes "' + name + '" not found');
        this.pvs.splice(idx, 1);
        return 'persistentvolume "' + name + '" deleted';
      }

      if (["storageclass", "storageclasses", "sc"].includes(what)) {
        const idx = this.storageClasses.findIndex(s => s.name === name);
        if (idx === -1) return this._err('Error from server (NotFound): storageclasses.storage.k8s.io "' + name + '" not found');
        this.storageClasses.splice(idx, 1);
        return 'storageclass.storage.k8s.io "' + name + '" deleted';
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
          // Pod-Security-Admission (#126): unsichere Pods werden unter baseline/restricted
          // schon beim Anlegen abgewiesen – der Rest des Manifests wird nicht angewandt.
          const denied = this._admitPod(effDep.name, effDep.securityContext);
          if (denied) return this._err(denied, "Ergänze im Manifest einen passenden securityContext (z.B. runAsNonRoot: true) oder senke die enforce-Stufe.");
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
      const effApp = eff.application;
      if (effApp) {
        const existing = this.argoApps.find(a => a.name === effApp.name);
        if (existing) {
          // kubectl apply ist idempotent: ändert sich autoSync/selfHeal, ist das ein "configure"-Vorgang
          // (genau wie bei echtem kubectl, das "configured" statt "unchanged" zurückgibt, wenn sich etwas ändert).
          const newAutoSync = !!effApp.autoSync;
          const newSelfHeal = !!effApp.selfHeal;
          if (existing.autoSync !== newAutoSync || existing.selfHeal !== newSelfHeal) {
            existing.autoSync = newAutoSync;
            existing.selfHeal = newSelfHeal;
            out.push("application.argoproj.io/" + effApp.name + " configured");
            if (existing.autoSync) {
              this._argoReconcile(existing);
              out.push("💡 Sync-Policy 'Automated'" + (existing.selfHeal ? " + Self-Heal" : "") + " aktiv – Argo gleicht den Cluster laufend mit dem Git-Soll ab.");
            }
          } else {
            out.push("application.argoproj.io/" + effApp.name + " unchanged");
          }
        } else {
          const isAppOfApps = !!effApp.childApps && effApp.childApps.length > 0;
          const app: ArgoApp = {
            name: effApp.name,
            repo: effApp.repo || "https://git.hafen.de/apps.git",
            path: effApp.path || effApp.name + "/",
            autoSync: !!effApp.autoSync,
            selfHeal: !!effApp.selfHeal,
            created: this.clock,
            ...(isAppOfApps
              ? { childApps: effApp.childApps!.map(c => this._cloneChildSpec(c)) }
              : { desired: {
                  deployment: Object.assign({}, effApp.deployment!),
                  ...(effApp.service ? { service: Object.assign({}, effApp.service) } : {}),
                } }),
          };
          this.argoApps.push(app);
          out.push("application.argoproj.io/" + effApp.name + " created");
          // Mit auto-sync zieht Argo den Git-Soll sofort in den Cluster (Pull ohne manuelles 'argocd app sync').
          if (app.autoSync) {
            this._argoReconcile(app);
            out.push(isAppOfApps
              ? "💡 App-of-Apps: Argo legt aus dem '" + app.path + "'-Ordner gleich die ganze Flotte an. Schau mit 'argocd app list'."
              : "💡 Sync-Policy 'Automated' – Argo rollt den deklarierten Stand sofort aus. Schau mit 'argocd app get " + app.name + "'.");
          } else {
            out.push("💡 Die App ist angelegt, aber noch OutOfSync. Zieh den Git-Soll mit 'argocd app sync " + app.name + "' in den Cluster.");
          }
        }
      }
      // Observability-CRDs (#110): legen Monitoring-Objekte an, idempotent wie die übrigen.
      const effSm = eff.serviceMonitor;
      if (effSm) {
        if (this.serviceMonitors.some(s => s.name === effSm.name)) {
          out.push("servicemonitor.monitoring.coreos.com/" + effSm.name + " unchanged");
        } else {
          this.serviceMonitors.push({ name: effSm.name, selector: effSm.selector, port: effSm.port || "metrics", interval: effSm.interval || "30s", created: this.clock });
          out.push("servicemonitor.monitoring.coreos.com/" + effSm.name + " created");
        }
      }
      const effPr = eff.prometheusRule;
      if (effPr) {
        if (this.prometheusRules.some(r => r.name === effPr.name)) {
          out.push("prometheusrule.monitoring.coreos.com/" + effPr.name + " unchanged");
        } else {
          this.prometheusRules.push({ name: effPr.name, alert: effPr.alert, expr: effPr.expr || "", forDuration: effPr.forDuration || "5m", severity: effPr.severity || "warning", created: this.clock });
          out.push("prometheusrule.monitoring.coreos.com/" + effPr.name + " created");
        }
      }
      const effDs = eff.grafanaDatasource;
      if (effDs) {
        if (this.grafanaDatasources.some(d => d.name === effDs.name)) {
          out.push("grafanadatasource.grafana.integreatly.org/" + effDs.name + " unchanged");
        } else {
          this.grafanaDatasources.push({ name: effDs.name, dsType: effDs.dsType || "prometheus", url: effDs.url || "", created: this.clock });
          out.push("grafanadatasource.grafana.integreatly.org/" + effDs.name + " created");
        }
      }
      const effGd = eff.grafanaDashboard;
      if (effGd) {
        if (this.grafanaDashboards.some(d => d.name === effGd.name)) {
          out.push("grafanadashboard.grafana.integreatly.org/" + effGd.name + " unchanged");
        } else {
          this.grafanaDashboards.push({ name: effGd.name, title: effGd.title, panels: effGd.panels || 0, created: this.clock });
          out.push("grafanadashboard.grafana.integreatly.org/" + effGd.name + " created");
        }
      }
      // Stateful-Workload-CRDs (#122). Reihenfolge: StorageClass + PV vor PVC/StatefulSet,
      // damit das Binden im selben apply schon greift.
      const effSc = eff.storageClass;
      if (effSc) {
        if (this.storageClasses.some(s => s.name === effSc.name)) {
          out.push("storageclass.storage.k8s.io/" + effSc.name + " unchanged");
        } else {
          this.storageClasses.push({ name: effSc.name, provisioner: effSc.provisioner || "rancher.io/local-path", reclaimPolicy: effSc.reclaimPolicy || "Delete", isDefault: !!effSc.isDefault, created: this.clock });
          out.push("storageclass.storage.k8s.io/" + effSc.name + " created");
        }
      }
      const effPv = eff.pv;
      if (effPv) {
        if (this.pvs.some(p => p.name === effPv.name)) {
          out.push("persistentvolume/" + effPv.name + " unchanged");
        } else {
          this.pvs.push({ name: effPv.name, capacity: effPv.capacity || "1Gi", status: "Available", claim: "", storageClass: effPv.storageClass || "", accessModes: effPv.accessModes || "RWO", reclaimPolicy: effPv.reclaimPolicy || "Retain", created: this.clock });
          out.push("persistentvolume/" + effPv.name + " created");
        }
      }
      const effPvc = eff.pvc;
      if (effPvc) {
        if (this.pvcs.some(p => p.name === effPvc.name)) {
          out.push("persistentvolumeclaim/" + effPvc.name + " unchanged");
        } else {
          const pvc = this._makePvc(effPvc.name, effPvc.storage || "1Gi", effPvc.storageClass, effPvc.accessModes);
          this.pvcs.push(pvc);
          out.push("persistentvolumeclaim/" + effPvc.name + " created");
          out.push(pvc.status === "Bound"
            ? "💡 PVC '" + pvc.name + "' ist Bound – es hat Speicher bekommen (PV " + pvc.volume + ")."
            : "💡 PVC '" + pvc.name + "' ist Pending – kein passendes PV da und keine StorageClass, die eins anlegt.");
        }
      }
      const effSts = eff.statefulSet;
      if (effSts) {
        if (this.statefulSets.some(s => s.name === effSts.name)) {
          out.push("statefulset.apps/" + effSts.name + " unchanged");
        } else {
          const sts = this._makeStatefulSet(effSts);
          this.statefulSets.push(sts);
          out.push("statefulset.apps/" + effSts.name + " created");
          out.push("💡 " + sts.replicas + " Pod(s) mit stabiler Identität (" + sts.name + "-0 …), jeder mit eigenem PVC '" + sts.volumeClaimName + "-" + sts.name + "-0' usw.");
        }
      }
      // RBAC-CRDs (#128): SA / Role(+Cluster) / RoleBinding(+Cluster) deklarativ anlegen,
      // idempotent wie alles andere. Genau diese Objekte wertet `kubectl auth can-i` aus.
      const effSa = eff.serviceAccount;
      if (effSa) {
        if (this.serviceAccounts.some(s => s.name === effSa.name)) {
          out.push("serviceaccount/" + effSa.name + " unchanged");
        } else {
          this.serviceAccounts.push({ name: effSa.name, created: this.clock });
          out.push("serviceaccount/" + effSa.name + " created");
        }
      }
      const effRole = eff.role;
      if (effRole) {
        const cluster = !!effRole.cluster;
        const kind = cluster ? "clusterrole" : "role";
        if (this.roles.some(r => r.name === effRole.name && r.cluster === cluster)) {
          out.push(kind + ".rbac.authorization.k8s.io/" + effRole.name + " unchanged");
        } else {
          this.roles.push({ name: effRole.name, cluster, rules: effRole.rules.map(rule => ({ verbs: rule.verbs.slice(), resources: rule.resources.slice() })), created: this.clock });
          out.push(kind + ".rbac.authorization.k8s.io/" + effRole.name + " created");
        }
      }
      const effRb = eff.roleBinding;
      if (effRb) {
        const cluster = !!effRb.cluster;
        const kind = cluster ? "clusterrolebinding" : "rolebinding";
        if (this.roleBindings.some(b => b.name === effRb.name && b.cluster === cluster)) {
          out.push(kind + ".rbac.authorization.k8s.io/" + effRb.name + " unchanged");
        } else {
          this.roleBindings.push({ name: effRb.name, cluster, roleRef: { kind: effRb.roleRef.kind, name: effRb.roleRef.name }, subjects: effRb.subjects.map(s => Object.assign({}, s)), created: this.clock });
          out.push(kind + ".rbac.authorization.k8s.io/" + effRb.name + " created");
        }
      }
      return out.join("\n");
    }

    _kubectlLogs(t: string[]) {
      // Flags können vor oder hinter dem Pod-Namen stehen: -f/--follow (live folgen),
      // -p/--previous (Logs des abgestürzten Vorgänger-Containers).
      const args = t.slice(2);
      const follow = args.includes("-f") || args.includes("--follow");
      const previous = args.includes("-p") || args.includes("--previous");
      const name = args.find(a => !a.startsWith("-"));
      if (!name) return this._err("kubectl logs: Welcher Pod?", "Pod-Namen siehst du mit 'kubectl get pods'.");
      const pod = this._allPods().find(p => p.name === name);
      if (!pod) return this._err('Error from server (NotFound): pods "' + name + '" not found');
      // Pod via _allPods() gefunden -> Deployment existiert garantiert.
      const dep = this._findDeploymentOfPod(name)!;
      // Nie gestartete Container haben weder aktuelle noch vorherige Logs.
      if (dep.broken && dep.broken.type === "imagepull") {
        return this._err('Error from server (BadRequest): container "' + dep.name + '" in pod "' + name + '" is waiting to start: trying and failing to pull image',
          "Keine Logs ohne Image! Die Ursache steht in den Events: kubectl describe pod " + name);
      }
      if (dep.broken && dep.broken.type === "pending") {
        return this._err('Error from server (BadRequest): pod "' + name + '" is not scheduled yet', "Der Pod wartet auf einen freien Node. Schau in die Events: kubectl describe pod " + name);
      }

      const crashLog = [
        "[start] Dienst " + dep.name + " startet …",
        "[start] Lese Konfiguration …",
        "FATAL: Secret '" + (dep.broken ? dep.broken.needsSecret : "") + "' nicht gefunden – Dienst kann nicht starten!",
        "[exit] Prozess beendet mit Code 1",
      ].join("\n");
      // Tückisch: Die App-Logs sehen normal aus und brechen einfach ab – den OOM-Kill
      // macht der Kernel von außen, die App schreibt dazu nichts. Die Wahrheit steht
      // in 'kubectl describe pod' (Last State: Terminated, Reason: OOMKilled).
      const oomLog = [
        "[start] Dienst " + dep.name + " startet …",
        "[info]  Lade Datensätze in den Arbeitsspeicher …",
        "[info]  Baue Index auf …",
        "(Log endet hier abrupt – kein Fehler, kein Stacktrace.)",
      ].join("\n");

      if (previous) {
        // --previous zeigt die Logs des ABGESTÜRZTEN Vorgänger-Containers.
        // Nur sinnvoll, wenn der Pod überhaupt schon neugestartet ist.
        if (dep.broken && dep.broken.type === "crashloop") return crashLog;
        if (dep.broken && dep.broken.type === "oomkilled") return oomLog;
        return this._err('Error from server (BadRequest): previous terminated container "' + dep.name + '" in pod "' + name + '" not found',
          "--previous zeigt den abgestürzten Vorgänger-Container – dieser Pod ist aber nie neugestartet.");
      }

      let out: string;
      if (dep.broken && dep.broken.type === "crashloop") out = crashLog;
      else if (dep.broken && dep.broken.type === "oomkilled") out = oomLog;
      else out = [
        "10.244.1.1 - - [12/Jun/2026:09:14:02 +0000] \"GET / HTTP/1.1\" 200 615",
        "10.244.1.1 - - [12/Jun/2026:09:14:05 +0000] \"GET /gesundheit HTTP/1.1\" 200 2",
        "10.244.2.7 - - [12/Jun/2026:09:14:11 +0000] \"GET /favicon.ico HTTP/1.1\" 404 153",
      ].join("\n");
      // -f würde im echten Cluster live weiterlaufen; im Simulator endet der Strom hier.
      if (follow) out += "\n^C  (--follow würde live weiterlaufen; im Simulator endet der Stream hier.)";
      return out;
    }

    /* ===================== kubectl top + Observability-Mechanik (#109) ===================== */

    /** Momentane Ressourcen-Last eines Pods – oder null, wenn der Container gar nicht
     *  läuft (ImagePull/Pending), dann gibt es schlicht keine Metriken. Deterministisch
     *  aus dem Pod-Namen abgeleitet, damit `kubectl top` über Aufrufe hinweg stabil bleibt. */
    _podMetric(d: Deployment, p: PodInstance): PodMetrics | null {
      if (d.broken && (d.broken.type === "imagepull" || d.broken.type === "pending")) return null;
      const h = hashStr(p.name);
      let cpuMilli = 4 + (h % 36);          // 4..39m Grundlast
      let memMi = 14 + ((h >>> 7) % 50);    // 14..63Mi Grundverbrauch
      if (d.cpuHeavy) cpuMilli = 850 + (h % 200); // 850..1049m: weit über der HighCPU-Schwelle
      if (d.broken && d.broken.type === "oomkilled") memMi = d.broken.memNeeded || 256; // klettert ans Limit
      return { cpuMilli, memMi };
    }

    /** Metriken aller laufenden Pods (für `kubectl top pods` + Prometheus + Alerts). */
    podMetrics(): Array<{ name: string; cpuMilli: number; memMi: number }> {
      const out: Array<{ name: string; cpuMilli: number; memMi: number }> = [];
      for (const d of this.deployments) {
        for (const p of d.pods) {
          const m = this._podMetric(d, p);
          if (m) out.push({ name: p.name, cpuMilli: m.cpuMilli, memMi: m.memMi });
        }
      }
      return out;
    }

    /** Aggregierte Node-Last: Grundlast (deterministisch aus dem Node-Namen) plus der
     *  gleichmäßig verteilte Pod-Verbrauch – so hebt ein CPU-hungriger Pod auch die Node. */
    nodeMetrics(): NodeMetrics[] {
      const CPU_CAP = 2000, MEM_CAP = 4096; // pro Node vereinfacht: 2 Kerne, 4 GiB
      const pods = this.podMetrics();
      const n = this.nodes.length || 1;
      const cpuShare = Math.round(pods.reduce((s, p) => s + p.cpuMilli, 0) / n);
      const memShare = Math.round(pods.reduce((s, p) => s + p.memMi, 0) / n);
      return this.nodes.map(nd => {
        const h = hashStr(nd.name);
        const ctrl = nd.roles.includes("control-plane");
        const baseCpu = (ctrl ? 120 : 60) + (h % (ctrl ? 80 : 60));
        const baseMem = (ctrl ? 900 : 500) + (h % 300);
        const cpuMilli = Math.min(CPU_CAP, baseCpu + cpuShare);
        const memMi = Math.min(MEM_CAP, baseMem + memShare);
        return { name: nd.name, cpuMilli, cpuPct: Math.round(cpuMilli / CPU_CAP * 100), memMi, memPct: Math.round(memMi / MEM_CAP * 100) };
      });
    }

    _kubectlTop(t: string[]) {
      const what = (t[2] || "").toLowerCase();
      const name = t[3] && !t[3].startsWith("-") ? t[3] : null;
      this._reschedulePending();
      this._recheckReadiness();

      if (["pods", "pod", "po"].includes(what)) {
        let rows = this.podMetrics();
        if (name) {
          rows = rows.filter(r => r.name === name);
          if (rows.length === 0) {
            const exists = this._allPods().some(p => p.name === name);
            return exists
              ? this._err("error: Metrics not available for pod default/" + name, "Metriken gibt es nur für laufende Pods – Status prüfen mit 'kubectl get pods'.")
              : this._err('Error from server (NotFound): pods "' + name + '" not found', "Pod-Namen siehst du mit 'kubectl get pods'.");
          }
        }
        if (rows.length === 0) return "No resources found in default namespace.";
        return table(["NAME", "CPU(cores)", "MEMORY(bytes)"], rows.map(r => [r.name, r.cpuMilli + "m", r.memMi + "Mi"]));
      }

      if (["nodes", "node", "no"].includes(what)) {
        let nodes = this.nodeMetrics();
        if (name) {
          nodes = nodes.filter(nd => nd.name === name);
          if (nodes.length === 0) return this._err('Error from server (NotFound): nodes "' + name + '" not found', "Node-Namen siehst du mit 'kubectl get nodes'.");
        }
        return table(["NAME", "CPU(cores)", "CPU%", "MEMORY(bytes)", "MEMORY%"],
          nodes.map(nd => [nd.name, nd.cpuMilli + "m", nd.cpuPct + "%", nd.memMi + "Mi", nd.memPct + "%"]));
      }

      if (!what) return this._err("kubectl top: pods oder nodes?", "z.B. 'kubectl top pods' oder 'kubectl top nodes'");
      return this._err("kubectl top kennt nur 'pods' und 'nodes'.", "z.B. 'kubectl top nodes'");
    }

    /** Prometheus-Scrape-Ziele aus dem Cluster-Zustand abgeleitet (Grundgerüst #109):
     *  Node-Targets (kubelet) sowie ein App-Target je Service – up/down je nach Erreichbarkeit. */
    scrapeTargets(): ScrapeTarget[] {
      const targets: ScrapeTarget[] = [];
      for (const nd of this.nodes) {
        targets.push({ job: "kubelet", instance: nd.name + ":10250", health: nd.status === "Ready" ? "up" : "down" });
      }
      for (const s of this.services) {
        const dep = this.deployments.find(d => d.name === s.name);
        const healthy = !!dep && this._podReady(dep);
        targets.push({ job: s.name, instance: s.clusterIP + ":" + s.port, health: healthy ? "up" : "down" });
      }
      return targets;
    }

    /** Die Alert-Regeln samt aktueller Bedingung – die EINE Stelle, die festlegt,
     *  was den simulierten Alertmanager auslöst (hohe CPU, CrashLoop, OOM, Node weg). */
    _alertRules(): Array<{ name: string; severity: "warning" | "critical"; summary: string; firing: boolean }> {
      const crash = this.deployments.some(d => d.broken && d.broken.type === "crashloop");
      const oom = this.deployments.some(d => d.broken && d.broken.type === "oomkilled");
      const hotPod = this.podMetrics().some(m => m.cpuMilli > 500);
      const nodeDown = this.nodes.some(nd => nd.status !== "Ready");
      return [
        { name: "KubePodCrashLooping", severity: "critical", summary: "Ein Pod startet immer wieder neu (CrashLoopBackOff).", firing: crash },
        { name: "KubePodOOMKilled", severity: "critical", summary: "Ein Pod sprengt sein Speicher-Limit und wird gekillt (OOMKilled).", firing: oom },
        { name: "HighPodCPU", severity: "warning", summary: "Ein Pod verbraucht ungewöhnlich viel CPU (über 500m).", firing: hotPod },
        { name: "KubeNodeNotReady", severity: "critical", summary: "Ein Node ist nicht mehr bereit (NotReady).", firing: nodeDown },
      ];
    }

    /** Aktuellen Zustand gegen die Regeln prüfen und den firing→resolved-Verlauf fortschreiben. */
    _evaluateAlerts() {
      for (const r of this._alertRules()) {
        if (r.firing) {
          this._firingAlerts.add(r.name);
          this._resolvedAlerts.delete(r.name);
        } else if (this._firingAlerts.has(r.name)) {
          // Bedingung weg, war aber an -> als resolved merken (verschwindet erst beim reset).
          this._firingAlerts.delete(r.name);
          this._resolvedAlerts.add(r.name);
        }
      }
    }

    /** Aktuelle Alerts (firing + resolved), nach Name sortiert. Wertet vorher neu aus,
     *  damit auch eine direkte Abfrage ohne vorausgehenden Befehl stimmt. */
    alerts(): Alert[] {
      this._evaluateAlerts();
      const meta = new Map(this._alertRules().map(r => [r.name, r]));
      const out: Alert[] = [];
      for (const name of this._firingAlerts) {
        const r = meta.get(name)!;
        out.push({ name, severity: r.severity, state: "firing", summary: r.summary });
      }
      for (const name of this._resolvedAlerts) {
        const r = meta.get(name)!;
        out.push({ name, severity: r.severity, state: "resolved", summary: r.summary });
      }
      return out.sort((a, b) => a.name.localeCompare(b.name));
    }

    /** Verteiler für `kubectl set …` (image | env | resources). */
    _kubectlSet(t: string[], raw: string) {
      if (t[2] === "image") return this._kubectlSetImage(t);
      if (t[2] === "env") return this._kubectlSetEnv(t, raw);
      if (t[2] === "resources") return this._kubectlSetResources(t, raw);
      return this._err("Der Simulator kann 'kubectl set image …', 'kubectl set env …' und 'kubectl set resources …'.", "z.B. 'kubectl set env deployment/<name> --from=configmap/<name>'");
    }

    /** kubectl set env deployment/<name> --from=configmap/<name> | --from=secret/<name>
     *  Bindet eine ConfigMap (harmlose Config) oder ein Secret (Vertrauliches) als
     *  Umgebungsvariablen in ein Deployment ein. */
    _kubectlSetEnv(t: string[], raw: string) {
      let depName: string | null = null;
      if (t[3] && t[3].startsWith("deployment/")) depName = t[3].split("/")[1];
      else if (t[3] === "deployment") depName = t[4];
      if (!depName) return this._err("kubectl set env: Welches Deployment?", "Muster: kubectl set env deployment/<name> --from=configmap/<name>");
      const dep = this.deployments.find(d => d.name === depName);
      if (!dep) return this._err('Error from server (NotFound): deployments.apps "' + depName + '" not found', "Welche Deployments es gibt: 'kubectl get deployments'");
      const m = raw.match(/--from[=\s](configmap|secret)\/(\S+)/);
      if (!m) return this._err("kubectl set env: Womit einbinden?", "Muster: kubectl set env deployment/<name> --from=configmap/<name> (oder --from=secret/<name>)");
      const kind = m[1];
      const refName = m[2];
      if (kind === "configmap") {
        if (!this.configMaps.some(c => c.name === refName)) return this._err('error: configmaps "' + refName + '" not found', "Erst anlegen: kubectl create configmap " + refName + " --from-literal=k=v");
        if (!dep.envFrom.configMaps.includes(refName)) dep.envFrom.configMaps.push(refName);
      } else {
        if (!this.secrets.some(s => s.name === refName)) return this._err('error: secrets "' + refName + '" not found', "Erst anlegen: kubectl create secret generic " + refName + " --from-literal=k=v");
        if (!dep.envFrom.secrets.includes(refName)) dep.envFrom.secrets.push(refName);
      }
      return "deployment.apps/" + depName + " env updated";
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

    /** Speicherangabe wie "256Mi", "1Gi", "512M" in Mi umrechnen (null bei Unsinn). */
    _parseMem(spec: string): number | null {
      const m = spec.match(/^(\d+)(Mi|Gi|M|G)?$/);
      if (!m) return null;
      const n = parseInt(m[1], 10);
      const unit = m[2] || "Mi";
      if (unit === "Gi" || unit === "G") return n * 1024;
      return n; // Mi / M ~ als Mi behandeln (didaktisch genau genug)
    }

    /** kubectl set resources deployment/<name> --limits=memory=256Mi [--requests=memory=128Mi]
     *  Setzt das memory-Limit. Ist der Dienst wegen OOMKilled kaputt und das neue Limit
     *  reicht (>= memNeeded), heilt er. Setzt auch --limits=cpu=<N>m: bei ≤ 499 m wird
     *  cpuHeavy gelöscht und der HighPodCPU-Alert fällt auf resolved. */
    _kubectlSetResources(t: string[], raw: string) {
      let depName: string | null = null;
      if (t[3] && t[3].startsWith("deployment/")) depName = t[3].split("/")[1];
      else if (t[3] === "deployment") depName = t[4];
      const limitSpec = (raw.match(/--limits[=\s][^\s]*memory=([0-9]+(?:Mi|Gi|M|G)?)/) || [])[1];
      const requestSpec = (raw.match(/--requests[=\s][^\s]*memory=([0-9]+(?:Mi|Gi|M|G)?)/) || [])[1];
      const cpuMatch = raw.match(/--limits[=\s][^\s]*cpu=([0-9]+)(m)?/);
      const cpuLimitMilli = cpuMatch ? (cpuMatch[2] ? parseInt(cpuMatch[1], 10) : parseInt(cpuMatch[1], 10) * 1000) : null;
      if (!depName) return this._err("kubectl set resources: Welches Deployment?", "Muster: kubectl set resources deployment/<name> --limits=memory=256Mi --requests=memory=128Mi");
      if (!limitSpec && !requestSpec && cpuLimitMilli === null) return this._err("kubectl set resources: Kein Limit/Request angegeben.", "Häng z.B. '--limits=memory=256Mi --requests=memory=128Mi' oder '--limits=cpu=200m' an.");
      const dep = this.deployments.find(d => d.name === depName);
      if (!dep) return this._err('Error from server (NotFound): deployments.apps "' + depName + '" not found', "Welche Deployments es gibt: 'kubectl get deployments'");
      const newLimit = limitSpec ? this._parseMem(limitSpec) : null;
      if (limitSpec && newLimit === null) return this._err('error: invalid resource quantity "' + limitSpec + '"', "Schreib das Limit z.B. als '256Mi' oder '1Gi'.");
      if (newLimit !== null) dep.memLimit = newLimit;
      let healed = false;
      if (dep.broken && dep.broken.type === "oomkilled" && newLimit !== null && newLimit >= (dep.broken.memNeeded || 0)) {
        dep.broken = null;
        dep.pods = dep.pods.map(() => ({ name: makePodName(dep.name), created: this.clock, restarts: 0 }));
        healed = true;
      }
      let cpuThrottled = false;
      if (cpuLimitMilli !== null && cpuLimitMilli < 500 && dep.cpuHeavy) {
        dep.cpuHeavy = false;
        dep.pods = dep.pods.map(() => ({ name: makePodName(dep.name), created: this.clock, restarts: 0 }));
        cpuThrottled = true;
      }
      return "deployment.apps/" + depName + " resource requirements updated" +
        (healed ? "\n💡 Genug Speicher! Die Pods starten neu und bleiben diesmal stehen – kein OOMKilled mehr." : "") +
        (cpuThrottled ? "\n💡 CPU-Limit gesetzt! Die Pods werden gedrosselt – der HighPodCPU-Alert fällt auf resolved." : "");
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

      if (sub === "dependency" || sub === "dep") {
        const action = t[2];
        const ref = t[3];
        if (action === "update" || action === "build" || action === "up") {
          if (!ref) return this._err("helm dependency " + action + ": Chart-Pfad fehlt.", "z.B. 'helm dependency update ./mein-chart'");
          const name = ref.replace(/^\.?\.?\//, "").replace(/\/+$/, "");
          if (!this.charts.some(c => c.name === name)) return this._err('Error: path "' + ref + '" not found', "Chart erst mit 'helm create " + name + "' anlegen.");
          return [
            "Hang tight while we grab the latest from your chart repositories...",
            "Saving " + name + " to " + ref + "/charts",
            "Deleting outdated charts",
            "",
            "Successfully got an update from your chart repositories.",
            "Chart.lock updated.",
          ].join("\n");
        }
        return this._err("helm dependency: unbekannte Aktion '" + (action || "") + "'", "Gültig: update, build, up");
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
        case "fetch": return this._gitFetch();
        case "pull": return this._gitPull();
        default: {
          const guess = this._suggest(sub || "", ["init", "status", "add", "commit", "log", "branch", "checkout", "merge", "push", "fetch", "pull"]);
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
      if (g.conflict) {
        s += "Du hast nicht zusammengeführte Pfade.\n  (behebe die Konflikte und committe das Ergebnis mit 'git commit')\n";
        s += "Nicht zusammengeführte Pfade:\n  beide geändert: " + g.conflict.file + "\n";
        s += "  ▸ Wähle eine Seite: 'git checkout --ours " + g.conflict.file + "' (deine) oder '--theirs " + g.conflict.file + "' (die hereinkommende), dann 'git add " + g.conflict.file + "'.\n";
        return s.trimEnd();
      }
      if (g.staged.length) s += "Zum Commit vorgemerkt:\n" + g.staged.map(f => "  neue Datei: " + f).join("\n") + "\n";
      if (untracked.length) s += "Unversionierte Dateien:\n" + untracked.map(f => "  " + f).join("\n") + "\n  (nutze \"git add <datei>\", um sie aufzunehmen)\n";
      if (!g.staged.length && !untracked.length) s += "Nichts zu committen, Arbeitsverzeichnis sauber ✨";
      return s.trimEnd();
    }

    _gitAdd(t: string[]) {
      const g = this.git;
      const arg = t[2];
      if (!arg) return this._err("git add: Welche Datei?", "z.B. 'git add seekarte.md' – oder 'git add .' für alles.");
      // Mitten im Konflikt markiert 'git add <konfliktdatei>' (oder 'git add .') ihn als gelöst.
      if (g.conflict && (arg === "." || arg === g.conflict.file)) {
        if (this.files[g.conflict.file] && /^(<{7}|={7}|>{7})/m.test(this.files[g.conflict.file])) {
          return this._err("git add: In '" + g.conflict.file + "' stecken noch Konfliktmarker (<<<<<<<, =======, >>>>>>>).",
            "Wähle erst eine Seite: 'git checkout --ours " + g.conflict.file + "' oder '--theirs " + g.conflict.file + "'.");
        }
        const file = g.conflict.file;
        if (!g.staged.includes(file)) g.staged.push(file);
        g.conflict = null;
        return "Konflikt in '" + file + "' als gelöst markiert (vorgemerkt). ▸ Schließe den Merge jetzt mit 'git commit -m \"…\"' ab.";
      }
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
      if (g.conflict) return this._err("git commit: Der Konflikt in '" + g.conflict.file + "' ist noch nicht gelöst.",
        "Seite wählen ('git checkout --ours/--theirs " + g.conflict.file + "'), dann 'git add " + g.conflict.file + "', erst dann committen.");
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
      // Konflikt-Auflösung: eine Seite wählen. 'git checkout --ours/--theirs <datei>'
      if (t[2] === "--ours" || t[2] === "--theirs") {
        const side = t[2] === "--ours" ? "ours" : "theirs";
        const file = t[3];
        if (!g.conflict) return this._err("git checkout " + t[2] + ": Gerade ist kein Konflikt offen.", "Diese Form wählt im Konflikt eine Seite aus.");
        if (!file || file !== g.conflict.file) return this._err("git checkout " + t[2] + ": Welche Konfliktdatei?", "Im Konflikt steckt: " + g.conflict.file + ". Also: 'git checkout " + t[2] + " " + g.conflict.file + "'.");
        this.files[file] = side === "ours" ? g.conflict.ours : g.conflict.theirs;
        const wer = side === "ours" ? "deine eigene (HEAD)" : "die hereinkommende (" + g.conflict.from + ")";
        return "'" + file + "' auf " + wer + " Version gesetzt. ▸ Markier die Lösung mit 'git add " + file + "', dann 'git commit'.";
      }
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
      if (g.conflict) return this._err("git merge: Ein Merge läuft noch – es gibt einen offenen Konflikt in '" + g.conflict.file + "'.",
        "Erst lösen: Seite wählen ('git checkout --ours/--theirs " + g.conflict.file + "'), 'git add', 'git commit'.");
      if (!name) return this._err("git merge: Welchen Branch reinholen?", "Muster: 'git merge <branch>'.");
      if (!g.branches.includes(name)) return this._err("git merge: Branch '" + name + "' gibt es nicht.");
      if (name === g.branch) return this._err("git merge: Das ist schon dein aktueller Branch.", "Wechsle erst auf den Ziel-Branch, dann merge den anderen rein.");
      // Scharf gestellter Konflikt? Beide Branches haben dieselbe Datei geändert -> Merge bricht ab.
      const pc = g.pendingConflict;
      if (pc && pc.branch === name) {
        g.pendingConflict = null;
        g.conflict = { file: pc.file, ours: pc.ours, theirs: pc.theirs, from: name };
        // Die Datei trägt jetzt die Konfliktmarker – mit 'cat' sichtbar.
        this.files[pc.file] =
          "<<<<<<< HEAD (deine Version)\n" + pc.ours +
          "\n=======\n" + pc.theirs +
          "\n>>>>>>> " + name + " (hereinkommend)";
        return "Automatischer Merge von '" + pc.file + "' …\n" +
          "CONFLICT (content): Merge-Konflikt in " + pc.file + ".\n" +
          "Automatischer Merge fehlgeschlagen; behebe die Konflikte und committe das Ergebnis.\n" +
          "▸ Schau rein mit 'cat " + pc.file + "' – zwischen <<<<<<< und >>>>>>> stehen beide Versionen.";
      }
      const hash = (0xc0ffee + g.commits.length * 7).toString(16).slice(-7);
      g.commits.push({ hash, msg: "Merge Branch '" + name + "' in " + g.branch, branch: g.branch, files: [] });
      return "Merge: '" + name + "' → '" + g.branch + "' ✅ Die Arbeit aus beiden Branches ist jetzt vereint.";
    }

    _gitFetch() {
      const g = this.git;
      if (g.remoteAhead > 0) {
        g.fetched = true;
        return "Hole von origin … origin/" + g.branch + " ist " + g.remoteAhead + " Commit(s) voraus.\n" +
          "▸ 'git fetch' LÄDT die Neuigkeiten nur herunter – deine Arbeit bleibt unberührt. Einfügen erst mit 'git pull' (oder 'git merge').";
      }
      return "Hole von origin … Schon aktuell – origin/" + g.branch + " hat nichts Neues.";
    }

    _gitPull() {
      const g = this.git;
      if (g.conflict) return this._err("git pull: Ein Konflikt ist noch offen.", "Erst den Merge abschließen, dann wieder pullen.");
      if (g.remoteAhead > 0) {
        const n = g.remoteAhead;
        for (let i = 0; i < n; i++) {
          const hash = (0xc0ffee + g.commits.length * 7).toString(16).slice(-7);
          g.commits.push({ hash, msg: "Vom Team geholt (#" + (i + 1) + ")", branch: g.branch, files: [] });
        }
        g.remoteAhead = 0;
        g.fetched = false;
        return "Hole von origin und führe zusammen … Fast-forward ✅ " + n + " neue Commit(s) vom Team in '" + g.branch + "' geholt.\n" +
          "▸ Merkregel: erst HOLEN (pull), dann erst deine pushen – so läufst du nicht in vermeidbare Konflikte.";
      }
      return "Hole von origin … Bereits auf dem neuesten Stand. ✨";
    }

    _gitPush() {
      const g = this.git;
      if (g.conflict) return this._err("git push: Ein Merge-Konflikt ist noch offen.", "Erst lösen (Seite wählen, 'git add', 'git commit'), dann pushen.");
      if (g.remoteAhead > 0) return this._err("git push: origin/" + g.branch + " ist dir voraus (" + g.remoteAhead + " Commit(s)).",
        "Hol sie erst mit 'git pull', dann push – sonst weist der Server deinen Push ab.");
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

    /* ===================== argocd (GitOps / Argo CD) ===================== */
    /** Tiefe Kopie einer Kind-App-Spezifikation (App-of-Apps). */
    _cloneChildSpec(c: ArgoChildSpec): ArgoChildSpec {
      return {
        name: c.name,
        ...(c.path ? { path: c.path } : {}),
        deployment: Object.assign({}, c.deployment),
        ...(c.service ? { service: Object.assign({}, c.service) } : {}),
      };
    }

    /** Tiefe Kopie einer Argo-App (für reset/snapshot/mergeScenario). */
    _cloneArgoApp(a: ArgoApp): ArgoApp {
      return {
        name: a.name, repo: a.repo, path: a.path,
        autoSync: !!a.autoSync, selfHeal: !!a.selfHeal,
        created: a.created || 0,
        ...(a.desired ? { desired: {
          deployment: Object.assign({}, a.desired.deployment),
          ...(a.desired.service ? { service: Object.assign({}, a.desired.service) } : {}),
        } } : {}),
        ...(a.childApps ? { childApps: a.childApps.map(c => this._cloneChildSpec(c)) } : {}),
      };
    }

    /** Sync-Status: stimmt der Cluster mit dem im Git deklarierten Soll überein?
     *  Wird IMMER live aus dem Cluster-Zustand berechnet – ein manuelles `kubectl scale`
     *  (Drift) oder ein gelöschtes Deployment macht die App damit sofort OutOfSync. */
    _argoSyncStatus(app: ArgoApp): "Synced" | "OutOfSync" {
      // App-of-Apps-Wurzel: Synced, sobald jede Kind-App existiert UND selbst Synced ist.
      if (app.childApps) {
        return app.childApps.every(c => {
          const child = this.argoApps.find(a => a.name === c.name);
          return !!child && this._argoSyncStatus(child) === "Synced";
        }) ? "Synced" : "OutOfSync";
      }
      const d = app.desired!.deployment;
      const dep = this.deployments.find(x => x.name === d.name);
      if (!dep) return "OutOfSync";                 // Soll-Ressource fehlt im Cluster
      if (dep.image !== d.image || dep.replicas !== d.replicas) return "OutOfSync"; // Drift
      if (app.desired!.service && !this.services.some(s => s.name === app.desired!.service!.name)) return "OutOfSync";
      return "Synced";
    }

    /** Health-Status: läuft die ausgerollte Workload gesund? */
    _argoHealth(app: ArgoApp): "Healthy" | "Progressing" | "Degraded" | "Missing" {
      // App-of-Apps-Wurzel: aggregiert die Gesundheit aller Kind-Apps.
      if (app.childApps) {
        const children = app.childApps.map(c => this.argoApps.find(a => a.name === c.name));
        if (children.some(c => !c)) return "Missing";               // noch nicht ausgerollt
        const healths = children.map(c => this._argoHealth(c!));
        if (healths.includes("Degraded")) return "Degraded";
        if (healths.includes("Missing")) return "Missing";
        if (healths.includes("Progressing")) return "Progressing";
        return "Healthy";
      }
      const dep = this.deployments.find(x => x.name === app.desired!.deployment.name);
      if (!dep) return "Missing";
      if (dep.broken) return "Degraded";
      return this._podReady(dep) ? "Healthy" : "Progressing";
    }

    /** Pull: zieht den im Git deklarierten Soll-Zustand in den Cluster – legt fehlende
     *  Ressourcen an und dreht Drift (falsches Image/abweichende Replikas) zurück. */
    _argoReconcile(app: ArgoApp) {
      // App-of-Apps-Wurzel: legt aus dem `flotte/`-Ordner jede Kind-Application an
      // (eine Wurzel → die ganze Flotte) und gleicht bestehende Kinder gleich mit ab.
      if (app.childApps) {
        for (const c of app.childApps) {
          let child = this.argoApps.find(a => a.name === c.name);
          if (!child) {
            child = {
              name: c.name,
              repo: app.repo,
              path: c.path || c.name + "/",
              autoSync: true,            // von der Flotte verwaltet → läuft mit
              selfHeal: app.selfHeal,    // erbt die Self-Heal-Politik der Wurzel
              desired: {
                deployment: Object.assign({}, c.deployment),
                ...(c.service ? { service: Object.assign({}, c.service) } : {}),
              },
              created: this.clock,
            };
            this.argoApps.push(child);
          }
          this._argoReconcile(child); // Soll-Workload der Kind-App in den Cluster ziehen
        }
        return;
      }
      const d = app.desired!.deployment;
      let dep = this.deployments.find(x => x.name === d.name);
      if (!dep) {
        this.deployments.push(this._makeDeployment(d.name, d.image, d.replicas));
      } else {
        dep.image = d.image;
        while (dep.pods.length < d.replicas) dep.pods.push({ name: makePodName(dep.name), created: this.clock, restarts: 0 });
        while (dep.pods.length > d.replicas) dep.pods.pop();
        dep.replicas = d.replicas;
        dep.broken = null; // ein gesundes Git-Manifest heilt auch eine kaputte Workload
      }
      const s = app.desired!.service;
      if (s && !this.services.some(x => x.name === s.name)) {
        this.services.push({
          name: s.name, type: s.type || "ClusterIP",
          clusterIP: "10.96." + Math.floor(Math.random() * 250) + "." + Math.floor(Math.random() * 250),
          port: s.port, created: this.clock,
        });
      }
    }

    /** Self-Heal-Schleife: läuft vor jeder Eingabe und korrigiert bei auto-sync-Apps mit
     *  self-heal jeden manuellen Drift automatisch zurück (das spürbare Pull-Prinzip). */
    _reconcileAutoSync() {
      if (!this.argoApps) return; // exec() kann theoretisch vor reset() laufen
      for (const app of this.argoApps) {
        if (app.autoSync && app.selfHeal && this._argoSyncStatus(app) === "OutOfSync") {
          this._argoReconcile(app);
        }
      }
    }

    _argocd(t: string[]) {
      if (t[1] !== "app") return this._err("Der Simulator kann nur 'argocd app ...'.", "z.B. 'argocd app list', 'argocd app get <name>' oder 'argocd app sync <name>'.");
      const action = t[2];

      if (action === "list" || action === "ls") {
        if (this.argoApps.length === 0) return "Keine Argo-Applications. (Lege eine an: 'kubectl apply -f <application>.yaml'.)";
        return table(["NAME", "SYNC STATUS", "HEALTH STATUS", "REPO", "PATH"],
          this.argoApps.map(a => [a.name, this._argoSyncStatus(a), this._argoHealth(a), a.repo, a.path]));
      }

      if (action === "get") {
        const name = t[3];
        if (!name || name.startsWith("-")) return this._err("argocd app get: Welche Application?", "Die Namen siehst du mit 'argocd app list'.");
        const app = this.argoApps.find(a => a.name === name);
        if (!app) return this._err('Error: rpc error: code = NotFound desc = applications.argoproj.io "' + name + '" not found', "Die Namen siehst du mit 'argocd app list'.");
        const sync = this._argoSyncStatus(app);
        const lines = [
          "Name:               " + app.name,
          "Project:            default",
          "Source Repo:        " + app.repo,
          "Source Path:        " + app.path,
          "Sync Policy:        " + (app.autoSync ? "Automated" + (app.selfHeal ? " (self-heal)" : "") : "<none> (manuell)"),
          "Sync Status:        " + sync + (sync === "Synced" ? " ✅" : " ⚠️  (der Cluster weicht vom Git-Soll ab)"),
          "Health Status:      " + this._argoHealth(app),
        ];
        if (app.childApps) {
          lines.push("Managed Apps:       " + app.childApps.length + " (App-of-Apps – eine Wurzel verwaltet die ganze Flotte)");
          for (const c of app.childApps) {
            const child = this.argoApps.find(a => a.name === c.name);
            lines.push("  • " + c.name + "  " + (child ? this._argoSyncStatus(child) + "/" + this._argoHealth(child) : "OutOfSync/Missing"));
          }
        }
        if (sync === "OutOfSync") {
          lines.push(app.autoSync && app.selfHeal
            ? "▸ Self-Heal ist an – Argo dreht den Drift beim nächsten Abgleich von selbst auf den Git-Stand zurück."
            : "▸ Bring den Cluster auf den Git-Soll: 'argocd app sync " + app.name + "'. (Git ist die Quelle der Wahrheit, nicht der Cluster.)");
        }
        return lines.join("\n");
      }

      if (action === "sync") {
        const name = t[3];
        if (!name || name.startsWith("-")) return this._err("argocd app sync: Welche Application?", "Die Namen siehst du mit 'argocd app list'.");
        const app = this.argoApps.find(a => a.name === name);
        if (!app) return this._err('Error: rpc error: code = NotFound desc = applications.argoproj.io "' + name + '" not found', "Die Namen siehst du mit 'argocd app list'.");
        const before = this._argoSyncStatus(app);
        this._argoReconcile(app);
        if (before === "Synced") {
          return "Application '" + app.name + "' ist bereits Synced ✅ – Cluster und Git-Soll stimmen überein, nichts zu tun. 🧘";
        }
        return [
          "Synchronisiere Application '" + app.name + "' …",
          app.childApps
            ? "App-of-Apps: Argo legt aus dem '" + app.path + "'-Ordner jede Kind-Application an (eine Wurzel → die ganze Flotte)."
            : "Argo zieht den im Git deklarierten Soll-Zustand in den Cluster (Pull-Prinzip).",
          "Sync Status: Synced ✅   Health: " + this._argoHealth(app),
          app.childApps
            ? "▸ Schau mit 'argocd app list' – die ganze Flotte ist jetzt da."
            : "▸ Schau mit 'kubectl get deployments' – der Cluster entspricht jetzt wieder dem Git-Stand.",
        ].join("\n");
      }

      return this._err("argocd app: unbekannte Aktion '" + (action || "") + "'", "z.B. 'argocd app list', 'argocd app get <name>' oder 'argocd app sync <name>'.");
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
