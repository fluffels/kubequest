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

// Befehls-Module des sim.ts-Splits (Epic #346): die docker-Familie liegt seit #373 in
// ./sim/docker.ts. Geteilte, pure Helfer (Tabellen-Ausgabe, Zufalls-IDs) in ./sim/util.ts –
// von hier UND den Befehls-Modulen importiert (kein Rückimport, der einen Zyklus bauen würde).
import { dockerCommand } from "./sim/docker";
import { kubectlCommand } from "./sim/kubectl";
import { randSuffix, pad, table, makePodName } from "./sim/util";

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
          case "docker": out = dockerCommand(this, tokens, raw); break;
          case "kubectl": out = kubectlCommand(this, tokens, raw); break;
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
