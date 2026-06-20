/* ===== KubeQuest – kubectl-Befehle (sim/kubectl.ts) =====
 * Schritt 3/7 des sim.ts-Datei-Splits (#374, aus Epic #346, ADR 0004) – der größte
 * Brocken: die komplette `kubectl`-Befehlsfamilie (get/describe/create/apply/delete/
 * scale/expose/logs/top/set/rollout/auth/label) plus ihre kubectl-eigenen Helfer
 * (RBAC `can-i`: `subjectKey`/`asKey`/`canI`; Pod-Security-Admission `admitPod`;
 * Memory-Parser `parseMem`).
 *
 * Wie bei docker (#373) als freie Funktionen ausgelagert, die die Sim-Instanz über
 * das schmale `KubectlHost`-Interface bekommen – so bleibt der Cluster-Zustand in
 * EINER Hand (die `Sim`-Klasse), die kubectl-Logik aber in einer eigenen, testbaren
 * Datei. Aufgerufen aus dem `exec`-Dispatch in `sim.ts` per `kubectlCommand(this, …)`.
 *
 * Phaser-frei (pure Domäne): Tabellen-Ausgabe + Pod-Namen kommen aus ./util, die
 * Domänentypen aus ./state – kein Rückimport nach sim.ts (kein Zyklus). Die
 * Observability-Methoden (`podMetrics`/`nodeMetrics`/`alerts`) sind bewusst NICHT
 * hier, sondern bleiben als öffentliche API in `sim.ts`; `top`/`get` greifen über
 * das Host-Interface darauf zu.
 */
import type {
  ClusterState, Deployment, PodInstance, PodStatus, PvcRes, StatefulSetRes,
  Broken, ArgoApp, NodeMetrics, Alert, RbacSubject, SecurityContext,
} from "./state";
import { table, makePodName } from "./util";
// Argo-CD-Reconcile/-Klon liegen seit #378 bei der argocd-Familie in ./argocd – `kubectl apply -f`
// einer Application zieht/kloniert den Soll direkt darüber (statt über eine Host-Methode).
import { argoReconcile, cloneChildSpec } from "./argocd";

// Alle Ingresses teilen sich die Adresse des einen Ingress-Controllers (wie im echten
// Cluster). Nur die kubectl-Ausgaben (get/describe ingress) brauchen sie, darum hier.
const INGRESS_ADDRESS = "203.0.113.10";

/** Was die kubectl-Befehle vom Simulator brauchen (von der `Sim`-Klasse erfüllt).
 *  Bewusst ein eng umrissenes Interface statt der ganzen `Sim`-Klasse: es dokumentiert
 *  die (große) Kopplung von kubectl an den Cluster-Zustand und vermeidet einen
 *  Import-Zyklus kubectl ↔ sim. Die Daten-Felder kommen über `extends ClusterState`
 *  (sim/state.ts, #372); hinzu kommen der transiente Sitzungs-Marker `lastDeletedPod`
 *  und die in `sim.ts` verbleibenden Helfer/öffentlichen Methoden, die kubectl ruft. */
export interface KubectlHost extends ClusterState {
  // Transienter Sitzungs-Marker (kein Cluster-Zustand → nicht in ClusterState).
  lastDeletedPod: string | null;
  // Geteilte Sim-Helfer (bleiben in sim.ts): Fehler/Flags, Alter, Pods/Readiness, Fabriken.
  _err(msg: string, tip?: string): string;
  _flagValue(tokens: string[], flag: string): string | null;
  _multiFlag(raw: string, flag: string): string[];
  _age(created: number): string;
  _allPods(): PodInstance[];
  _findDeploymentOfPod(podName: string): Deployment | undefined;
  _podStatus(d: Deployment): PodStatus;
  _podReady(d: Deployment): boolean;
  _reschedulePending(): void;
  _recheckReadiness(): void;
  _makeDeployment(name: string, image: string, replicas: number, broken?: Broken | null, envFrom?: { configMaps: string[]; secrets: string[] }, cpuHeavy?: boolean): Deployment;
  _makePvc(name: string, storage: string, storageClass?: string, accessModes?: string): PvcRes;
  _makeStatefulSet(spec: { name: string; image: string; replicas: number; serviceName?: string; volumeClaimName?: string; storage?: string; storageClass?: string }): StatefulSetRes;
  // Observability-API (öffentlich, bleibt in sim.ts): top/get lesen daraus.
  podMetrics(): Array<{ name: string; cpuMilli: number; memMi: number }>;
  nodeMetrics(): NodeMetrics[];
  alerts(): Alert[];
}

export function kubectlCommand(host: KubectlHost, t: string[], raw: string): string {
  const sub = t[1];
  if (!sub) return host._err("kubectl: Unterbefehl fehlt.", "Probier z.B. 'kubectl get pods'.");

  if (sub === "get") return kubectlGet(host, t);
  if (sub === "describe") return kubectlDescribe(host, t);
  if (sub === "create") return kubectlCreate(host, t, raw);
  if (sub === "scale") return kubectlScale(host, t, raw);
  if (sub === "expose") return kubectlExpose(host, t, raw);
  if (sub === "delete") return kubectlDelete(host, t);
  if (sub === "apply") return kubectlApply(host, t);
  if (sub === "logs") return kubectlLogs(host, t);
  if (sub === "top") return kubectlTop(host, t);
  if (sub === "set") return kubectlSet(host, t, raw);
  if (sub === "rollout") return kubectlRollout(host, t);
  if (sub === "auth") return kubectlAuth(host, t, raw);
  if (sub === "label") return kubectlLabel(host, t, raw);

  return host._err("kubectl: unbekannter Unterbefehl '" + sub + "'", "Tippe 'help' für alle Befehle.");
}


function kubectlGet(host: KubectlHost, t: string[]) {
  const what = (t[2] || "").toLowerCase();
  const ns = host._flagValue(t, "-n") || host._flagValue(t, "--namespace");
  const allNs = t.includes("-A") || t.includes("--all-namespaces");
  host._recheckReadiness();

  if (["pods", "pod", "po"].includes(what)) {
    if (ns === "kube-system" || allNs) {
      const sysPods = [
        ["coredns-7db6d8ff4d-x2x9p", "1/1", "Running", "0", "3d"],
        ["etcd-ahoi-control", "1/1", "Running", "0", "3d"],
        ["kube-apiserver-ahoi-control", "1/1", "Running", "0", "3d"],
        ["kube-scheduler-ahoi-control", "1/1", "Running", "0", "3d"],
      ];
      const rows = allNs
        ? sysPods.map(r => ["kube-system"].concat(r)).concat(host._allPods().map(p => ["default", p.name, "1/1", "Running", String(p.restarts), host._age(p.created)]))
        : sysPods;
      return table(allNs ? ["NAMESPACE", "NAME", "READY", "STATUS", "RESTARTS", "AGE"] : ["NAME", "READY", "STATUS", "RESTARTS", "AGE"], rows);
    }
    host._reschedulePending();
    const rows: any[] = [];
    for (const d of host.deployments) {
      const st = host._podStatus(d);
      for (const p of d.pods) rows.push([p.name, st.ready, st.status, String(st.restarts || p.restarts), host._age(p.created)]);
    }
    // StatefulSet-Pods (#122): stabile Namen <sts>-0, immer Running/ready.
    for (const s of host.statefulSets) {
      for (const p of s.pods) rows.push([p.name, "1/1", "Running", String(p.restarts), host._age(p.created)]);
    }
    if (rows.length === 0) return "No resources found in default namespace.";
    return table(["NAME", "READY", "STATUS", "RESTARTS", "AGE"], rows);
  }

  if (["deployments", "deployment", "deploy"].includes(what)) {
    if (host.deployments.length === 0) return "No resources found in default namespace.";
    return table(["NAME", "READY", "UP-TO-DATE", "AVAILABLE", "AGE"],
      host.deployments.map(d => {
        const ready = host._podReady(d) ? d.pods.length : 0;
        return [d.name, ready + "/" + d.replicas, String(d.replicas), String(ready), host._age(d.created)];
      }));
  }

  if (["services", "service", "svc"].includes(what)) {
    const rows = [["kubernetes", "ClusterIP", "10.96.0.1", "<none>", "443/TCP", "3d"]];
    for (const s of host.services) rows.push([s.name, s.type, s.clusterIP, "<none>", s.port + "/TCP", host._age(s.created || 0)]);
    return table(["NAME", "TYPE", "CLUSTER-IP", "EXTERNAL-IP", "PORT(S)", "AGE"], rows);
  }

  if (["endpoints", "endpoint", "ep"].includes(what)) {
    // Endpoints = die IPs der BEREITEN Pods hinter einem Service. Genau hier
    // wird die Readiness-Probe sichtbar: ein nicht-bereiter Pod fehlt in der
    // Liste, der Service leitet keinen Verkehr an ihn weiter.
    const wantName = t[3] && !t[3].startsWith("-") ? t[3] : null;
    const svcs = wantName ? host.services.filter(s => s.name === wantName) : host.services.slice();
    if (wantName && svcs.length === 0) {
      return host._err('Error from server (NotFound): endpoints "' + wantName + '" not found', "Service-Namen siehst du mit 'kubectl get services'.");
    }
    if (svcs.length === 0) return "No resources found in default namespace.";
    return table(["NAME", "ENDPOINTS", "AGE"], svcs.map(s => {
      const dep = host.deployments.find(d => d.name === s.name);
      const ips = dep && host._podReady(dep)
        ? dep.pods.map((_, i) => "10.244.1." + (20 + i) + ":" + s.port)
        : [];
      return [s.name, ips.length ? ips.join(",") : "<none>", host._age(s.created || 0)];
    }));
  }

  if (["nodes", "node", "no"].includes(what)) {
    return table(["NAME", "STATUS", "ROLES", "AGE", "VERSION"],
      host.nodes.map(n => [n.name, n.status, n.roles, "3d", n.version]));
  }

  if (["secrets", "secret"].includes(what)) {
    if (host.secrets.length === 0) return "No resources found in default namespace.";
    return table(["NAME", "TYPE", "DATA", "AGE"],
      host.secrets.map(s => [s.name, s.type || "Opaque", String(s.keys.length), host._age(s.created || 0)]));
  }

  if (["configmaps", "configmap", "cm"].includes(what)) {
    if (host.configMaps.length === 0) return "No resources found in default namespace.";
    return table(["NAME", "DATA", "AGE"],
      host.configMaps.map(c => [c.name, String(c.keys.length), host._age(c.created || 0)]));
  }

  if (["ingress", "ingresses", "ing"].includes(what)) {
    if (host.ingresses.length === 0) return "No resources found in default namespace.";
    return table(["NAME", "CLASS", "HOSTS", "ADDRESS", "PORTS", "AGE"],
      host.ingresses.map(i => [i.name, i.className, i.host, INGRESS_ADDRESS, i.tls ? "80, 443" : "80", host._age(i.created || 0)]));
  }

  if (["networkpolicies", "networkpolicy", "netpol", "netpols"].includes(what)) {
    if (host.networkPolicies.length === 0) return "No resources found in default namespace.";
    return table(["NAME", "POD-SELECTOR", "AGE"],
      host.networkPolicies.map(n => [n.name, n.podSelector ? "app=" + n.podSelector : "<none>", host._age(n.created || 0)]));
  }

  if (["servicemonitors", "servicemonitor", "smon"].includes(what)) {
    if (host.serviceMonitors.length === 0) return "No resources found in default namespace.";
    return table(["NAME", "SELECTOR", "ENDPOINT", "AGE"],
      host.serviceMonitors.map(s => [s.name, "app=" + s.selector, s.port + " @ " + s.interval, host._age(s.created || 0)]));
  }

  if (["prometheusrules", "prometheusrule", "promrule", "promrules"].includes(what)) {
    if (host.prometheusRules.length === 0) return "No resources found in default namespace.";
    return table(["NAME", "ALERT", "SEVERITY", "AGE"],
      host.prometheusRules.map(r => [r.name, r.alert, r.severity, host._age(r.created || 0)]));
  }

  if (["grafanadatasources", "grafanadatasource", "grafanadatasrc"].includes(what)) {
    if (host.grafanaDatasources.length === 0) return "No resources found in default namespace.";
    return table(["NAME", "TYPE", "AGE"],
      host.grafanaDatasources.map(d => [d.name, d.dsType, host._age(d.created || 0)]));
  }

  if (["grafanadashboards", "grafanadashboard", "grafanadash"].includes(what)) {
    if (host.grafanaDashboards.length === 0) return "No resources found in default namespace.";
    return table(["NAME", "TITLE", "PANELS", "AGE"],
      host.grafanaDashboards.map(d => [d.name, d.title, String(d.panels), host._age(d.created || 0)]));
  }

  if (["statefulsets", "statefulset", "sts"].includes(what)) {
    if (host.statefulSets.length === 0) return "No resources found in default namespace.";
    return table(["NAME", "READY", "AGE"],
      host.statefulSets.map(s => [s.name, s.pods.length + "/" + s.replicas, host._age(s.created)]));
  }

  if (["persistentvolumeclaims", "persistentvolumeclaim", "pvc"].includes(what)) {
    if (host.pvcs.length === 0) return "No resources found in default namespace.";
    return table(["NAME", "STATUS", "VOLUME", "CAPACITY", "ACCESS MODES", "STORAGECLASS", "AGE"],
      host.pvcs.map(p => [p.name, p.status, p.volume || "", p.status === "Bound" ? p.capacity : "", p.accessModes, p.storageClass || "", host._age(p.created)]));
  }

  if (["persistentvolumes", "persistentvolume", "pv"].includes(what)) {
    if (host.pvs.length === 0) return "No resources found.";
    return table(["NAME", "CAPACITY", "ACCESS MODES", "RECLAIM POLICY", "STATUS", "CLAIM", "STORAGECLASS", "AGE"],
      host.pvs.map(p => [p.name, p.capacity, p.accessModes, p.reclaimPolicy, p.status, p.claim || "", p.storageClass || "", host._age(p.created)]));
  }

  if (["storageclasses", "storageclass", "sc"].includes(what)) {
    if (host.storageClasses.length === 0) return "No resources found.";
    return table(["NAME", "PROVISIONER", "RECLAIMPOLICY", "AGE"],
      host.storageClasses.map(s => [s.name + (s.isDefault ? " (default)" : ""), s.provisioner, s.reclaimPolicy, host._age(s.created)]));
  }

  if (["serviceaccounts", "serviceaccount", "sa"].includes(what)) {
    return table(["NAME", "SECRETS", "AGE"],
      host.serviceAccounts.map(s => [s.name, "0", host._age(s.created)]));
  }

  if (["roles", "role"].includes(what)) {
    const rs = host.roles.filter(r => !r.cluster);
    if (rs.length === 0) return "No resources found in default namespace.";
    return table(["NAME", "AGE"], rs.map(r => [r.name, host._age(r.created)]));
  }

  if (["clusterroles", "clusterrole"].includes(what)) {
    const rs = host.roles.filter(r => r.cluster);
    if (rs.length === 0) return "No resources found.";
    return table(["NAME", "AGE"], rs.map(r => [r.name, host._age(r.created)]));
  }

  if (["rolebindings", "rolebinding", "rb"].includes(what)) {
    const bs = host.roleBindings.filter(b => !b.cluster);
    if (bs.length === 0) return "No resources found in default namespace.";
    return table(["NAME", "ROLE", "AGE"], bs.map(b => [b.name, b.roleRef.kind + "/" + b.roleRef.name, host._age(b.created)]));
  }

  if (["clusterrolebindings", "clusterrolebinding", "crb"].includes(what)) {
    const bs = host.roleBindings.filter(b => b.cluster);
    if (bs.length === 0) return "No resources found.";
    return table(["NAME", "ROLE", "AGE"], bs.map(b => [b.name, b.roleRef.kind + "/" + b.roleRef.name, host._age(b.created)]));
  }

  if (["alerts", "alert"].includes(what)) {
    const active = host.alerts();
    if (active.length === 0) return "No alerts firing.";
    return table(["NAME", "SEVERITY", "STATE", "SUMMARY"],
      active.map(a => [a.name, a.severity, a.state, a.summary]));
  }

  if (!what) return host._err("kubectl get: Was möchtest du sehen?", "z.B. 'kubectl get pods' oder 'kubectl get nodes'");
  return host._err('error: the server doesn\'t have a resource type "' + what + '"', "Gemeint war vielleicht: pods, deployments, services, endpoints, ingress, networkpolicies, servicemonitors, prometheusrules, grafanadashboards, alerts, secrets, configmaps, serviceaccounts, roles, rolebindings oder nodes?");
}


function kubectlDescribe(host: KubectlHost, t: string[]) {
  const what = (t[2] || "").toLowerCase();
  const name = t[3];
  if (["ingress", "ingresses", "ing"].includes(what)) {
    if (!name) return host._err("kubectl describe ingress: Welches Hafentor?", "Die Namen siehst du mit 'kubectl get ingress'.");
    const ing = host.ingresses.find(i => i.name === name);
    if (!ing) return host._err('Error from server (NotFound): ingresses.networking.k8s.io "' + name + '" not found', "Tipp: Namen aus 'kubectl get ingress' kopieren.");
    const svcExists = host.services.some(s => s.name === ing.service);
    const secretExists = ing.tls ? host.secrets.some(s => s.name === ing.tls!.secretName) : true;
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
    if (!name) return host._err("kubectl describe networkpolicy: Welche Hafenmauer?", "Die Namen siehst du mit 'kubectl get networkpolicies'.");
    const np = host.networkPolicies.find(n => n.name === name);
    if (!np) return host._err('Error from server (NotFound): networkpolicies.networking.k8s.io "' + name + '" not found', "Tipp: Namen aus 'kubectl get networkpolicies' kopieren.");
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
    if (!name) return host._err("kubectl describe " + what + ": Welche Rolle?", "Die Namen siehst du mit 'kubectl get " + what + "s'.");
    const role = host.roles.find(r => r.name === name && r.cluster === cluster);
    if (!role) return host._err('Error from server (NotFound): ' + what + 's.rbac.authorization.k8s.io "' + name + '" not found', "Tipp: Namen aus 'kubectl get " + what + "s' kopieren.");
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
    if (!name) return host._err("kubectl describe serviceaccount: Welche SA?", "Die Namen siehst du mit 'kubectl get sa'.");
    const acc = host.serviceAccounts.find(s => s.name === name);
    if (!acc) return host._err('Error from server (NotFound): serviceaccounts "' + name + '" not found', "Tipp: Namen aus 'kubectl get sa' kopieren.");
    return ["Name:         " + acc.name, "Namespace:    default", "Mountable secrets:  <none>"].join("\n");
  }
  if (!["pod", "pods"].includes(what)) return host._err("Der Simulator kann nur 'kubectl describe pod|ingress|networkpolicy|role|clusterrole|serviceaccount <name>'.");
  if (!name) return host._err("kubectl describe pod: Welcher Pod?", "Die Namen siehst du mit 'kubectl get pods'.");
  const pod = host._allPods().find(p => p.name === name);
  if (!pod) return host._err('Error from server (NotFound): pods "' + name + '" not found', "Tipp: Pod-Namen kannst du aus 'kubectl get pods' kopieren.");
  // Pod wurde via _allPods() gefunden -> sein Deployment existiert garantiert.
  const dep = host._findDeploymentOfPod(name)!;
  const st = host._podStatus(dep);
  const events = ["  Type    Reason     Age   Message", "  ----    ------     ----  -------"];
  if (!dep.broken) {
    events.push("  Normal  Scheduled  " + host._age(pod.created) + "   Successfully assigned default/" + pod.name);
    events.push("  Normal  Pulled     " + host._age(pod.created) + "   Container image \"" + dep.image + "\" already present");
    events.push("  Normal  Started    " + host._age(pod.created) + "   Started container " + dep.name);
  } else if (dep.broken.type === "imagepull") {
    events.push("  Normal   Scheduled  " + host._age(pod.created) + "   Successfully assigned default/" + pod.name);
    events.push("  Warning  Failed     " + host._age(pod.created) + "   Failed to pull image \"" + dep.image + "\": repository does not exist or may require authorization");
    events.push("  Warning  Failed     " + host._age(pod.created) + "   Error: ImagePullBackOff");
  } else if (dep.broken.type === "crashloop") {
    events.push("  Normal   Scheduled  " + host._age(pod.created) + "   Successfully assigned default/" + pod.name);
    events.push("  Normal   Started    " + host._age(pod.created) + "   Started container " + dep.name);
    events.push("  Warning  BackOff    " + host._age(pod.created) + "   Back-off restarting failed container (Tipp: kubectl logs " + pod.name + ")");
  } else if (dep.broken.type === "pending") {
    events.push("  Warning  FailedScheduling  " + host._age(pod.created) + "   0/" + host.nodes.length + " nodes are available: insufficient capacity.");
  } else if (dep.broken.type === "notready") {
    events.push("  Normal   Scheduled  " + host._age(pod.created) + "   Successfully assigned default/" + pod.name);
    events.push("  Normal   Started    " + host._age(pod.created) + "   Started container " + dep.name);
    events.push("  Warning  Unhealthy  " + host._age(pod.created) + "   Readiness probe failed: HTTP probe returned statuscode 503 (Liveness probe ok – der Pod LÄUFT, ist aber nicht bereit)");
  } else if (dep.broken.type === "oomkilled") {
    events.push("  Normal   Scheduled  " + host._age(pod.created) + "   Successfully assigned default/" + pod.name);
    events.push("  Normal   Pulled     " + host._age(pod.created) + "   Container image \"" + dep.image + "\" already present");
    events.push("  Warning  BackOff    " + host._age(pod.created) + "   Back-off restarting failed container (zuletzt OOMKilled – Limit zu knapp)");
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
    "Node:         " + (dep.broken && dep.broken.type === "pending" ? "<none>" : host.nodes[1].name),
    "Status:       " + (st.status === "Running" ? "Running" : st.status === "Pending" ? "Pending" : "Waiting (" + st.status + ")"),
    "Ready:        " + st.ready,
    "IP:           " + (dep.broken && dep.broken.type === "pending" ? "<none>" : "10.244.1." + (10 + Math.floor(Math.random() * 200))),
    "Controlled By: ReplicaSet/" + dep.name,
    "Containers:",
    ...containerBlock,
    "Events:",
  ].concat(events).join("\n");
}


function kubectlCreate(host: KubectlHost, t: string[], raw: string) {
  if (t[2] === "secret") {
    // kubectl create secret tls <name> --cert=<datei> --key=<datei>
    if (t[3] === "tls") {
      const name = t[4];
      if (!name || name.startsWith("--")) return host._err("kubectl create secret tls: Der Name fehlt.", "Muster: kubectl create secret tls <name> --cert=tls.crt --key=tls.key");
      const hasCert = /--cert[=\s]\S+/.test(raw);
      const hasKey = /--key[=\s]\S+/.test(raw);
      if (!hasCert || !hasKey) return host._err("error: a TLS secret needs --cert and --key", "Häng '--cert=tls.crt --key=tls.key' an.");
      if (host.secrets.some(s => s.name === name)) return host._err('error: secrets "' + name + '" already exists');
      host.secrets.push({ name, keys: ["tls.crt", "tls.key"], type: "kubernetes.io/tls", created: host.clock });
      return "secret/" + name + " created";
    }
    // kubectl create secret generic <name> --from-literal=schluessel=wert
    if (t[3] !== "generic") return host._err("Der Simulator kann nur 'kubectl create secret generic <name> --from-literal=k=v' und 'kubectl create secret tls <name> --cert=… --key=…'.");
    const name = t[4];
    if (!name || name.startsWith("--")) return host._err("kubectl create secret: Der Name fehlt.", "Muster: kubectl create secret generic <name> --from-literal=schluessel=wert");
    const literals = [...raw.matchAll(/--from-literal[=\s]([\w.-]+)=(\S+)/g)].map(m => m[1]);
    if (literals.length === 0) return host._err("error: at least one --from-literal is required", "Häng '--from-literal=passwort=geheim123' an.");
    if (host.secrets.some(s => s.name === name)) return host._err('error: secrets "' + name + '" already exists');
    host.secrets.push({ name, keys: literals, created: host.clock });
    return "secret/" + name + " created";
  }
  if (t[2] === "configmap" || t[2] === "cm") {
    // kubectl create configmap <name> --from-literal=schluessel=wert
    const name = t[3];
    if (!name || name.startsWith("--")) return host._err("kubectl create configmap: Der Name fehlt.", "Muster: kubectl create configmap <name> --from-literal=schluessel=wert");
    const literals = [...raw.matchAll(/--from-literal[=\s]([\w.-]+)=(\S+)/g)].map(m => m[1]);
    if (literals.length === 0) return host._err("error: at least one --from-literal is required", "Häng '--from-literal=log_level=info' an.");
    if (host.configMaps.some(c => c.name === name)) return host._err('error: configmaps "' + name + '" already exists');
    host.configMaps.push({ name, keys: literals, created: host.clock });
    return "configmap/" + name + " created";
  }
  if (t[2] === "serviceaccount" || t[2] === "sa") {
    const name = t[3];
    if (!name || name.startsWith("--")) return host._err("kubectl create serviceaccount: Der Name fehlt.", "Muster: kubectl create serviceaccount <name>");
    if (host.serviceAccounts.some(s => s.name === name)) return host._err('error: serviceaccounts "' + name + '" already exists');
    host.serviceAccounts.push({ name, created: host.clock });
    return "serviceaccount/" + name + " created";
  }
  if (t[2] === "role" || t[2] === "clusterrole") {
    const cluster = t[2] === "clusterrole";
    const name = t[3];
    if (!name || name.startsWith("--")) return host._err("kubectl create " + t[2] + ": Der Name fehlt.", "Muster: kubectl create " + t[2] + " <name> --verb=get,list --resource=pods");
    const verbs = host._multiFlag(raw, "verb");
    const resources = host._multiFlag(raw, "resource");
    if (verbs.length === 0) return host._err("error: at least one --verb must be specified", "Häng z.B. '--verb=get,list' an.");
    if (resources.length === 0) return host._err("error: at least one --resource must be specified", "Häng z.B. '--resource=pods' an.");
    const kind = cluster ? "clusterrole" : "role";
    if (host.roles.some(r => r.cluster === cluster && r.name === name)) return host._err('error: ' + kind + 's.rbac.authorization.k8s.io "' + name + '" already exists');
    host.roles.push({ name, cluster, rules: [{ verbs, resources }], created: host.clock });
    return kind + ".rbac.authorization.k8s.io/" + name + " created";
  }
  if (t[2] === "rolebinding" || t[2] === "clusterrolebinding") {
    const cluster = t[2] === "clusterrolebinding";
    const name = t[3];
    if (!name || name.startsWith("--")) return host._err("kubectl create " + t[2] + ": Der Name fehlt.", "Muster: kubectl create " + t[2] + " <name> --role=<rolle> --serviceaccount=<ns>:<sa>");
    const roleName = host._flagValue(t, "--role");
    const clusterRoleName = host._flagValue(t, "--clusterrole");
    // ClusterRoleBinding kann sich nur auf eine ClusterRole beziehen.
    if (cluster && roleName) return host._err("error: a ClusterRoleBinding can only reference a ClusterRole", "Nutze '--clusterrole=<name>' statt '--role'.");
    if (!roleName && !clusterRoleName) return host._err("error: exactly one of --role or --clusterrole must be specified", cluster ? "Häng '--clusterrole=<name>' an." : "Häng '--role=<name>' oder '--clusterrole=<name>' an.");
    const roleRef = clusterRoleName ? { kind: "ClusterRole" as const, name: clusterRoleName } : { kind: "Role" as const, name: roleName! };
    const subjects: RbacSubject[] = [];
    for (const u of host._multiFlag(raw, "user")) subjects.push({ kind: "User", name: u });
    for (const sa of host._multiFlag(raw, "serviceaccount")) {
      const [ns, n] = sa.includes(":") ? sa.split(":") : ["default", sa];
      subjects.push({ kind: "ServiceAccount", name: n, namespace: ns });
    }
    if (subjects.length === 0) return host._err("error: at least one of --user or --serviceaccount must be specified", "Muster: '--serviceaccount=default:deploy-bot' oder '--user=alice'.");
    const kind = cluster ? "clusterrolebinding" : "rolebinding";
    if (host.roleBindings.some(b => b.cluster === cluster && b.name === name)) return host._err('error: ' + kind + 's.rbac.authorization.k8s.io "' + name + '" already exists');
    host.roleBindings.push({ name, cluster, roleRef, subjects, created: host.clock });
    return kind + ".rbac.authorization.k8s.io/" + name + " created";
  }
  if (t[2] !== "deployment") return host._err("Der Simulator kann nur 'kubectl create deployment|serviceaccount|role|clusterrole|rolebinding|clusterrolebinding …', 'kubectl create secret generic|tls …' und 'kubectl create configmap …'.");
  const name = t[3];
  const imgMatch = raw.match(/--image[=\s]+(\S+)/);
  if (!name || name.startsWith("--")) return host._err("kubectl create deployment: Der Name fehlt.", "z.B. 'kubectl create deployment kasse --image=nginx'");
  if (!imgMatch) return host._err("error: required flag(s) \"image\" not set", "Häng '--image=nginx' an.");
  if (host.deployments.some(d => d.name === name)) return host._err('error: deployment "' + name + '" already exists');
  // Pod-Security-Admission: ein imperativ erzeugtes Deployment hat keinen securityContext.
  // Unter baseline/restricted wird es deshalb abgelehnt (privileged = keine Prüfung).
  const denied = admitPod(host, name, undefined);
  if (denied) return host._err(denied, "Setz die Stufe mit 'kubectl label namespace default pod-security.kubernetes.io/enforce=privileged' herab oder liefere einen passenden securityContext per Manifest.");
  host.deployments.push(host._makeDeployment(name, imgMatch[1], 1));
  return "deployment.apps/" + name + " created";
}

/* ---- RBAC-Auswertung (#126) ---- */

/** Subjekt → stabiler Schlüssel, damit Bindungs-Subjekt und `--as`-Anfrage vergleichbar sind.
 *  User → "user:<name>", ServiceAccount → "sa:<ns>:<name>". */

function subjectKeyOf(host: KubectlHost, s: RbacSubject): string {
  return s.kind === "ServiceAccount" ? "sa:" + (s.namespace || "default") + ":" + s.name : "user:" + s.name;
}

/** `--as`-Wert (oder null) in einen Subjekt-Schlüssel übersetzen.
 *  Akzeptiert "system:serviceaccount:<ns>:<sa>" (SA) und sonst "<user>" (User). */

function asKey(as: string | null): string | null {
  if (!as) return null;
  const m = as.match(/^system:serviceaccount:([^:]+):(.+)$/);
  if (m) return "sa:" + m[1] + ":" + m[2];
  return "user:" + as;
}

/** Darf das Subjekt (Schlüssel) `verb` auf `resource`? null = Admin (kein --as) → alles erlaubt. */

function canI(host: KubectlHost, verb: string, resource: string, subjectKey: string | null): boolean {
  if (subjectKey === null) return true; // ohne --as fragt man die eigenen (Admin-)Rechte ab
  for (const b of host.roleBindings) {
    if (!b.subjects.some(s => subjectKeyOf(host, s) === subjectKey)) continue;
    const role = host.roles.find(r => r.name === b.roleRef.name && r.cluster === (b.roleRef.kind === "ClusterRole"));
    if (!role) continue; // baumelnde Referenz: gewährt nichts
    for (const rule of role.rules) {
      const verbOk = rule.verbs.includes("*") || rule.verbs.includes(verb);
      const resOk = rule.resources.includes("*") || rule.resources.includes(resource);
      if (verbOk && resOk) return true;
    }
  }
  return false;
}


function kubectlAuth(host: KubectlHost, t: string[], raw: string) {
  if (t[2] !== "can-i") return host._err("Der Simulator kann nur 'kubectl auth can-i <verb> <resource> [--as=…]'.");
  // can-i <verb> <resource>; --as ignorieren wir bei der Positions-Suche.
  const positional = t.slice(3).filter(tok => !tok.startsWith("-"));
  const verb = positional[0];
  const resource = positional[1];
  if (!verb || !resource) return host._err("kubectl auth can-i: Es fehlt verb oder resource.", "Muster: kubectl auth can-i get pods --as=system:serviceaccount:default:deploy-bot");
  const subjectKey = asKey(host._flagValue(t, "--as"));
  return canI(host, verb, resource, subjectKey) ? "yes" : "no";
}

/* ---- Pod-Security-Admission (#126) ---- */

/** Setzt die durchgesetzte Stufe per Namespace-Label, z.B.
 *  `kubectl label namespace default pod-security.kubernetes.io/enforce=restricted`. */

function kubectlLabel(host: KubectlHost, t: string[], raw: string) {
  if (t[2] !== "namespace" && t[2] !== "ns") return host._err("Der Simulator kann nur 'kubectl label namespace <ns> pod-security.kubernetes.io/enforce=<stufe>'.");
  const nsName = t[3];
  if (!nsName || nsName.startsWith("-")) return host._err("kubectl label namespace: Welcher Namespace?", "Muster: kubectl label namespace default pod-security.kubernetes.io/enforce=restricted");
  const m = raw.match(/pod-security\.kubernetes\.io\/enforce=(\S+)/);
  if (!m) return host._err("Der Simulator versteht hier nur das Label 'pod-security.kubernetes.io/enforce=<stufe>'.", "z.B. '…/enforce=baseline' oder '…/enforce=restricted'.");
  const level = m[1];
  if (level !== "privileged" && level !== "baseline" && level !== "restricted") {
    return host._err('error: unbekannte Pod-Security-Stufe "' + level + '"', "Erlaubt sind: privileged, baseline, restricted.");
  }
  host.podSecurity = level;
  return "namespace/" + nsName + " labeled";
}

/** Prüft einen Pod gegen die durchgesetzte Stufe. Rückgabe: null = zugelassen,
 *  sonst die (deutsche) Ablehnungs-Begründung. privileged = nie ablehnen. */

function admitPod(host: KubectlHost, name: string, sc: SecurityContext | undefined): string | null {
  const level = host.podSecurity;
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


function kubectlScale(host: KubectlHost, t: string[], raw: string) {
  const name = t[3] === "deployment" ? t[4] : (t[2] === "deployment" ? t[3] : null);
  const repMatch = raw.match(/--replicas[=\s]+(\d+)/);
  if (!name || !repMatch) return host._err("kubectl scale: So nicht ganz.", "Muster: 'kubectl scale deployment <name> --replicas=3'");
  const dep = host.deployments.find(d => d.name === name);
  if (!dep) return host._err('Error from server (NotFound): deployments.apps "' + name + '" not found', "Welche Deployments es gibt: 'kubectl get deployments'");
  const target = parseInt(repMatch[1], 10);
  while (dep.pods.length < target) dep.pods.push({ name: makePodName(dep.name), created: host.clock, restarts: 0 });
  while (dep.pods.length > target) dep.pods.pop();
  dep.replicas = target;
  return "deployment.apps/" + name + " scaled";
}


function kubectlExpose(host: KubectlHost, t: string[], raw: string) {
  const name = t[3] === "deployment" ? t[4] : (t[2] === "deployment" ? t[3] : null);
  const portMatch = raw.match(/--port[=\s]+(\d+)/);
  if (!name) return host._err("kubectl expose: Welches Deployment?", "Muster: 'kubectl expose deployment <name> --port=80'");
  const dep = host.deployments.find(d => d.name === name);
  if (!dep) return host._err('Error from server (NotFound): deployments.apps "' + name + '" not found');
  if (!portMatch) return host._err("error: couldn't find port via --port flag or introspection", "Häng '--port=80' an.");
  if (host.services.some(s => s.name === name)) return host._err('Error from server (AlreadyExists): services "' + name + '" already exists');
  const typeMatch = raw.match(/--type[=\s]+(\S+)/);
  host.services.push({
    name,
    type: typeMatch ? typeMatch[1] : "ClusterIP",
    clusterIP: "10.96." + Math.floor(Math.random() * 250) + "." + Math.floor(Math.random() * 250),
    port: portMatch[1],
    created: host.clock,
  });
  return "service/" + name + " exposed";
}


function kubectlDelete(host: KubectlHost, t: string[]) {
  const what = (t[2] || "").toLowerCase();
  const name = t[3];

  if (what === "-f") {
    const file = t[3];
    const eff = host.applyEffects[file];
    if (!eff || !host.files[file]) return host._err("error: the path \"" + (file || "?") + "\" does not exist", "Mit 'ls' siehst du, welche Dateien hier liegen.");
    const out: string[] = [];
    const effDep = eff.deployment;
    if (effDep) {
      const i = host.deployments.findIndex(d => d.name === effDep.name);
      if (i >= 0) { host.deployments.splice(i, 1); out.push('deployment.apps "' + effDep.name + '" deleted'); }
    }
    const effSvc = eff.service;
    if (effSvc) {
      const i = host.services.findIndex(s => s.name === effSvc.name);
      if (i >= 0) { host.services.splice(i, 1); out.push('service "' + effSvc.name + '" deleted'); }
    }
    const effIng = eff.ingress;
    if (effIng) {
      const i = host.ingresses.findIndex(x => x.name === effIng.name);
      if (i >= 0) { host.ingresses.splice(i, 1); out.push('ingress.networking.k8s.io "' + effIng.name + '" deleted'); }
    }
    const effNp = eff.networkPolicy;
    if (effNp) {
      const i = host.networkPolicies.findIndex(x => x.name === effNp.name);
      if (i >= 0) { host.networkPolicies.splice(i, 1); out.push('networkpolicy.networking.k8s.io "' + effNp.name + '" deleted'); }
    }
    const effStsDel = eff.statefulSet;
    if (effStsDel) {
      const i = host.statefulSets.findIndex(x => x.name === effStsDel.name);
      if (i >= 0) { host.statefulSets.splice(i, 1); out.push('statefulset.apps "' + effStsDel.name + '" deleted'); } // PVCs bleiben absichtlich (#122)
    }
    const effPvcDel = eff.pvc;
    if (effPvcDel) {
      const i = host.pvcs.findIndex(x => x.name === effPvcDel.name);
      if (i >= 0) { host.pvcs.splice(i, 1); out.push('persistentvolumeclaim "' + effPvcDel.name + '" deleted'); }
    }
    const effPvDel = eff.pv;
    if (effPvDel) {
      const i = host.pvs.findIndex(x => x.name === effPvDel.name);
      if (i >= 0) { host.pvs.splice(i, 1); out.push('persistentvolume "' + effPvDel.name + '" deleted'); }
    }
    const effScDel = eff.storageClass;
    if (effScDel) {
      const i = host.storageClasses.findIndex(x => x.name === effScDel.name);
      if (i >= 0) { host.storageClasses.splice(i, 1); out.push('storageclass.storage.k8s.io "' + effScDel.name + '" deleted'); }
    }
    return out.join("\n") || "nothing deleted";
  }

  if (!name) return host._err("kubectl delete: Was und wie heißt es?", "z.B. 'kubectl delete pod <pod-name>'");

  if (["pod", "pods", "po"].includes(what)) {
    const dep = host._findDeploymentOfPod(name);
    if (dep) {
      const idx = dep.pods.findIndex(p => p.name === name);
      dep.pods.splice(idx, 1);
      host.lastDeletedPod = name;
      // Self-Healing: das Deployment ersetzt den Pod sofort – mit NEUEM Zufallsnamen.
      dep.pods.push({ name: makePodName(dep.name), created: host.clock, restarts: 0 });
      return 'pod "' + name + '" deleted';
    }
    // StatefulSet-Pod (#122): kommt mit GLEICHEM Namen und GLEICHEM PVC zurück –
    // die Daten überleben. Das PVC wird bewusst NICHT angefasst.
    const sts = host.statefulSets.find(s => s.pods.some(p => p.name === name));
    if (sts) {
      const idx = sts.pods.findIndex(p => p.name === name);
      sts.pods.splice(idx, 1);
      host.lastDeletedPod = name;
      sts.pods.splice(idx, 0, { name, created: host.clock, restarts: 0 }); // stabile Identität: gleicher Name, gleiche Ordinalposition
      return 'pod "' + name + '" deleted';
    }
    return host._err('Error from server (NotFound): pods "' + name + '" not found', "Pod-Namen siehst du mit 'kubectl get pods'.");
  }

  if (["deployment", "deployments", "deploy"].includes(what)) {
    const idx = host.deployments.findIndex(d => d.name === name);
    if (idx === -1) return host._err('Error from server (NotFound): deployments.apps "' + name + '" not found');
    host.deployments.splice(idx, 1);
    return 'deployment.apps "' + name + '" deleted';
  }

  if (["service", "services", "svc"].includes(what)) {
    const idx = host.services.findIndex(s => s.name === name);
    if (idx === -1) return host._err('Error from server (NotFound): services "' + name + '" not found');
    host.services.splice(idx, 1);
    return 'service "' + name + '" deleted';
  }

  if (["configmap", "configmaps", "cm"].includes(what)) {
    const idx = host.configMaps.findIndex(c => c.name === name);
    if (idx === -1) return host._err('Error from server (NotFound): configmaps "' + name + '" not found');
    host.configMaps.splice(idx, 1);
    return 'configmap "' + name + '" deleted';
  }

  if (["secret", "secrets"].includes(what)) {
    const idx = host.secrets.findIndex(s => s.name === name);
    if (idx === -1) return host._err('Error from server (NotFound): secrets "' + name + '" not found');
    host.secrets.splice(idx, 1);
    return 'secret "' + name + '" deleted';
  }

  if (["ingress", "ingresses", "ing"].includes(what)) {
    const idx = host.ingresses.findIndex(i => i.name === name);
    if (idx === -1) return host._err('Error from server (NotFound): ingresses.networking.k8s.io "' + name + '" not found');
    host.ingresses.splice(idx, 1);
    return 'ingress.networking.k8s.io "' + name + '" deleted';
  }

  if (["networkpolicy", "networkpolicies", "netpol", "netpols"].includes(what)) {
    const idx = host.networkPolicies.findIndex(n => n.name === name);
    if (idx === -1) return host._err('Error from server (NotFound): networkpolicies.networking.k8s.io "' + name + '" not found');
    host.networkPolicies.splice(idx, 1);
    return 'networkpolicy.networking.k8s.io "' + name + '" deleted';
  }

  if (["statefulset", "statefulsets", "sts"].includes(what)) {
    const idx = host.statefulSets.findIndex(s => s.name === name);
    if (idx === -1) return host._err('Error from server (NotFound): statefulsets.apps "' + name + '" not found');
    host.statefulSets.splice(idx, 1);
    // Die PVCs bleiben absichtlich erhalten – Kern der Datendauerhaftigkeit (#122).
    return 'statefulset.apps "' + name + '" deleted\n💡 Die PVCs bleiben bestehen – die Daten überleben das Löschen des StatefulSets. Skalierst du es wieder hoch, hängen die alten Volumes wieder dran.';
  }

  if (["pvc", "persistentvolumeclaim", "persistentvolumeclaims"].includes(what)) {
    const idx = host.pvcs.findIndex(p => p.name === name);
    if (idx === -1) return host._err('Error from server (NotFound): persistentvolumeclaims "' + name + '" not found');
    const [removed] = host.pvcs.splice(idx, 1);
    // Gebundenes PV freigeben: Delete-Policy entfernt es, Retain hinterlässt es als "Released".
    const pv = host.pvs.find(p => p.name === removed.volume);
    if (pv) {
      if (pv.reclaimPolicy === "Retain") { pv.status = "Released"; pv.claim = ""; }
      else { const j = host.pvs.findIndex(x => x.name === pv.name); if (j >= 0) host.pvs.splice(j, 1); }
    }
    return 'persistentvolumeclaim "' + name + '" deleted';
  }

  if (["pv", "persistentvolume", "persistentvolumes"].includes(what)) {
    const idx = host.pvs.findIndex(p => p.name === name);
    if (idx === -1) return host._err('Error from server (NotFound): persistentvolumes "' + name + '" not found');
    host.pvs.splice(idx, 1);
    return 'persistentvolume "' + name + '" deleted';
  }

  if (["storageclass", "storageclasses", "sc"].includes(what)) {
    const idx = host.storageClasses.findIndex(s => s.name === name);
    if (idx === -1) return host._err('Error from server (NotFound): storageclasses.storage.k8s.io "' + name + '" not found');
    host.storageClasses.splice(idx, 1);
    return 'storageclass.storage.k8s.io "' + name + '" deleted';
  }

  return host._err("kubectl delete: Ressourcentyp '" + what + "' kennt der Simulator nicht.");
}


function kubectlApply(host: KubectlHost, t: string[]) {
  const fIdx = t.indexOf("-f");
  const file = fIdx >= 0 ? t[fIdx + 1] : null;
  if (!file) return host._err("error: must specify one of -f or -k", "Muster: 'kubectl apply -f deployment.yaml'");
  if (!host.files[file]) return host._err("error: the path \"" + file + "\" does not exist", "Mit 'ls' siehst du, welche Dateien hier liegen.");
  const eff = host.applyEffects[file];
  if (!eff) return host._err("error: unable to decode " + file);
  const out: string[] = [];
  const effDep = eff.deployment;
  if (effDep) {
    const existing = host.deployments.find(d => d.name === effDep.name);
    if (existing) {
      out.push("deployment.apps/" + effDep.name + " unchanged");
    } else {
      // Pod-Security-Admission (#126): unsichere Pods werden unter baseline/restricted
      // schon beim Anlegen abgewiesen – der Rest des Manifests wird nicht angewandt.
      const denied = admitPod(host, effDep.name, effDep.securityContext);
      if (denied) return host._err(denied, "Ergänze im Manifest einen passenden securityContext (z.B. runAsNonRoot: true) oder senke die enforce-Stufe.");
      host.deployments.push(host._makeDeployment(effDep.name, effDep.image, effDep.replicas));
      out.push("deployment.apps/" + effDep.name + " created");
    }
  }
  const effSvc = eff.service;
  if (effSvc) {
    const existing = host.services.find(s => s.name === effSvc.name);
    if (existing) {
      out.push("service/" + effSvc.name + " unchanged");
    } else {
      host.services.push({
        name: effSvc.name, type: effSvc.type || "ClusterIP",
        clusterIP: "10.96." + Math.floor(Math.random() * 250) + "." + Math.floor(Math.random() * 250),
        port: effSvc.port, created: host.clock,
      });
      out.push("service/" + effSvc.name + " created");
    }
  }
  const effIng = eff.ingress;
  if (effIng) {
    const existing = host.ingresses.find(i => i.name === effIng.name);
    if (existing) {
      // TLS am bestehenden Hafentor nachrüsten: aus HTTP wird HTTPS ("configured").
      if (effIng.tls && !existing.tls) {
        existing.tls = { secretName: effIng.tls.secretName };
        out.push("ingress.networking.k8s.io/" + effIng.name + " configured");
      } else {
        out.push("ingress.networking.k8s.io/" + effIng.name + " unchanged");
      }
    } else {
      host.ingresses.push({
        name: effIng.name, className: effIng.className || "nginx",
        host: effIng.host, path: effIng.path || "/",
        service: effIng.service, port: effIng.port,
        ...(effIng.tls ? { tls: { secretName: effIng.tls.secretName } } : {}),
        created: host.clock,
      });
      out.push("ingress.networking.k8s.io/" + effIng.name + " created");
    }
  }
  const effNp = eff.networkPolicy;
  if (effNp) {
    const existing = host.networkPolicies.find(n => n.name === effNp.name);
    if (existing) {
      out.push("networkpolicy.networking.k8s.io/" + effNp.name + " unchanged");
    } else {
      host.networkPolicies.push({
        name: effNp.name, podSelector: effNp.podSelector || "",
        allowFrom: effNp.allowFrom || "", created: host.clock,
      });
      out.push("networkpolicy.networking.k8s.io/" + effNp.name + " created");
    }
  }
  const effApp = eff.application;
  if (effApp) {
    const existing = host.argoApps.find(a => a.name === effApp.name);
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
          argoReconcile(host, existing);
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
        created: host.clock,
        ...(isAppOfApps
          ? { childApps: effApp.childApps!.map(c => cloneChildSpec(c)) }
          : { desired: {
              deployment: Object.assign({}, effApp.deployment!),
              ...(effApp.service ? { service: Object.assign({}, effApp.service) } : {}),
            } }),
      };
      host.argoApps.push(app);
      out.push("application.argoproj.io/" + effApp.name + " created");
      // Mit auto-sync zieht Argo den Git-Soll sofort in den Cluster (Pull ohne manuelles 'argocd app sync').
      if (app.autoSync) {
        argoReconcile(host, app);
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
    if (host.serviceMonitors.some(s => s.name === effSm.name)) {
      out.push("servicemonitor.monitoring.coreos.com/" + effSm.name + " unchanged");
    } else {
      host.serviceMonitors.push({ name: effSm.name, selector: effSm.selector, port: effSm.port || "metrics", interval: effSm.interval || "30s", created: host.clock });
      out.push("servicemonitor.monitoring.coreos.com/" + effSm.name + " created");
    }
  }
  const effPr = eff.prometheusRule;
  if (effPr) {
    if (host.prometheusRules.some(r => r.name === effPr.name)) {
      out.push("prometheusrule.monitoring.coreos.com/" + effPr.name + " unchanged");
    } else {
      host.prometheusRules.push({ name: effPr.name, alert: effPr.alert, expr: effPr.expr || "", forDuration: effPr.forDuration || "5m", severity: effPr.severity || "warning", created: host.clock });
      out.push("prometheusrule.monitoring.coreos.com/" + effPr.name + " created");
    }
  }
  const effDs = eff.grafanaDatasource;
  if (effDs) {
    if (host.grafanaDatasources.some(d => d.name === effDs.name)) {
      out.push("grafanadatasource.grafana.integreatly.org/" + effDs.name + " unchanged");
    } else {
      host.grafanaDatasources.push({ name: effDs.name, dsType: effDs.dsType || "prometheus", url: effDs.url || "", created: host.clock });
      out.push("grafanadatasource.grafana.integreatly.org/" + effDs.name + " created");
    }
  }
  const effGd = eff.grafanaDashboard;
  if (effGd) {
    if (host.grafanaDashboards.some(d => d.name === effGd.name)) {
      out.push("grafanadashboard.grafana.integreatly.org/" + effGd.name + " unchanged");
    } else {
      host.grafanaDashboards.push({ name: effGd.name, title: effGd.title, panels: effGd.panels || 0, created: host.clock });
      out.push("grafanadashboard.grafana.integreatly.org/" + effGd.name + " created");
    }
  }
  // Stateful-Workload-CRDs (#122). Reihenfolge: StorageClass + PV vor PVC/StatefulSet,
  // damit das Binden im selben apply schon greift.
  const effSc = eff.storageClass;
  if (effSc) {
    if (host.storageClasses.some(s => s.name === effSc.name)) {
      out.push("storageclass.storage.k8s.io/" + effSc.name + " unchanged");
    } else {
      host.storageClasses.push({ name: effSc.name, provisioner: effSc.provisioner || "rancher.io/local-path", reclaimPolicy: effSc.reclaimPolicy || "Delete", isDefault: !!effSc.isDefault, created: host.clock });
      out.push("storageclass.storage.k8s.io/" + effSc.name + " created");
    }
  }
  const effPv = eff.pv;
  if (effPv) {
    if (host.pvs.some(p => p.name === effPv.name)) {
      out.push("persistentvolume/" + effPv.name + " unchanged");
    } else {
      host.pvs.push({ name: effPv.name, capacity: effPv.capacity || "1Gi", status: "Available", claim: "", storageClass: effPv.storageClass || "", accessModes: effPv.accessModes || "RWO", reclaimPolicy: effPv.reclaimPolicy || "Retain", created: host.clock });
      out.push("persistentvolume/" + effPv.name + " created");
    }
  }
  const effPvc = eff.pvc;
  if (effPvc) {
    if (host.pvcs.some(p => p.name === effPvc.name)) {
      out.push("persistentvolumeclaim/" + effPvc.name + " unchanged");
    } else {
      const pvc = host._makePvc(effPvc.name, effPvc.storage || "1Gi", effPvc.storageClass, effPvc.accessModes);
      host.pvcs.push(pvc);
      out.push("persistentvolumeclaim/" + effPvc.name + " created");
      out.push(pvc.status === "Bound"
        ? "💡 PVC '" + pvc.name + "' ist Bound – es hat Speicher bekommen (PV " + pvc.volume + ")."
        : "💡 PVC '" + pvc.name + "' ist Pending – kein passendes PV da und keine StorageClass, die eins anlegt.");
    }
  }
  const effSts = eff.statefulSet;
  if (effSts) {
    if (host.statefulSets.some(s => s.name === effSts.name)) {
      out.push("statefulset.apps/" + effSts.name + " unchanged");
    } else {
      const sts = host._makeStatefulSet(effSts);
      host.statefulSets.push(sts);
      out.push("statefulset.apps/" + effSts.name + " created");
      out.push("💡 " + sts.replicas + " Pod(s) mit stabiler Identität (" + sts.name + "-0 …), jeder mit eigenem PVC '" + sts.volumeClaimName + "-" + sts.name + "-0' usw.");
    }
  }
  // RBAC-CRDs (#128): SA / Role(+Cluster) / RoleBinding(+Cluster) deklarativ anlegen,
  // idempotent wie alles andere. Genau diese Objekte wertet `kubectl auth can-i` aus.
  const effSa = eff.serviceAccount;
  if (effSa) {
    if (host.serviceAccounts.some(s => s.name === effSa.name)) {
      out.push("serviceaccount/" + effSa.name + " unchanged");
    } else {
      host.serviceAccounts.push({ name: effSa.name, created: host.clock });
      out.push("serviceaccount/" + effSa.name + " created");
    }
  }
  const effRole = eff.role;
  if (effRole) {
    const cluster = !!effRole.cluster;
    const kind = cluster ? "clusterrole" : "role";
    if (host.roles.some(r => r.name === effRole.name && r.cluster === cluster)) {
      out.push(kind + ".rbac.authorization.k8s.io/" + effRole.name + " unchanged");
    } else {
      host.roles.push({ name: effRole.name, cluster, rules: effRole.rules.map(rule => ({ verbs: rule.verbs.slice(), resources: rule.resources.slice() })), created: host.clock });
      out.push(kind + ".rbac.authorization.k8s.io/" + effRole.name + " created");
    }
  }
  const effRb = eff.roleBinding;
  if (effRb) {
    const cluster = !!effRb.cluster;
    const kind = cluster ? "clusterrolebinding" : "rolebinding";
    if (host.roleBindings.some(b => b.name === effRb.name && b.cluster === cluster)) {
      out.push(kind + ".rbac.authorization.k8s.io/" + effRb.name + " unchanged");
    } else {
      host.roleBindings.push({ name: effRb.name, cluster, roleRef: { kind: effRb.roleRef.kind, name: effRb.roleRef.name }, subjects: effRb.subjects.map(s => Object.assign({}, s)), created: host.clock });
      out.push(kind + ".rbac.authorization.k8s.io/" + effRb.name + " created");
    }
  }
  return out.join("\n");
}


function kubectlLogs(host: KubectlHost, t: string[]) {
  // Flags können vor oder hinter dem Pod-Namen stehen: -f/--follow (live folgen),
  // -p/--previous (Logs des abgestürzten Vorgänger-Containers).
  const args = t.slice(2);
  const follow = args.includes("-f") || args.includes("--follow");
  const previous = args.includes("-p") || args.includes("--previous");
  const name = args.find(a => !a.startsWith("-"));
  if (!name) return host._err("kubectl logs: Welcher Pod?", "Pod-Namen siehst du mit 'kubectl get pods'.");
  const pod = host._allPods().find(p => p.name === name);
  if (!pod) return host._err('Error from server (NotFound): pods "' + name + '" not found');
  // Pod via _allPods() gefunden -> Deployment existiert garantiert.
  const dep = host._findDeploymentOfPod(name)!;
  // Nie gestartete Container haben weder aktuelle noch vorherige Logs.
  if (dep.broken && dep.broken.type === "imagepull") {
    return host._err('Error from server (BadRequest): container "' + dep.name + '" in pod "' + name + '" is waiting to start: trying and failing to pull image',
      "Keine Logs ohne Image! Die Ursache steht in den Events: kubectl describe pod " + name);
  }
  if (dep.broken && dep.broken.type === "pending") {
    return host._err('Error from server (BadRequest): pod "' + name + '" is not scheduled yet', "Der Pod wartet auf einen freien Node. Schau in die Events: kubectl describe pod " + name);
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
    return host._err('Error from server (BadRequest): previous terminated container "' + dep.name + '" in pod "' + name + '" not found',
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

function kubectlTop(host: KubectlHost, t: string[]) {
  const what = (t[2] || "").toLowerCase();
  const name = t[3] && !t[3].startsWith("-") ? t[3] : null;
  host._reschedulePending();
  host._recheckReadiness();

  if (["pods", "pod", "po"].includes(what)) {
    let rows = host.podMetrics();
    if (name) {
      rows = rows.filter(r => r.name === name);
      if (rows.length === 0) {
        const exists = host._allPods().some(p => p.name === name);
        return exists
          ? host._err("error: Metrics not available for pod default/" + name, "Metriken gibt es nur für laufende Pods – Status prüfen mit 'kubectl get pods'.")
          : host._err('Error from server (NotFound): pods "' + name + '" not found', "Pod-Namen siehst du mit 'kubectl get pods'.");
      }
    }
    if (rows.length === 0) return "No resources found in default namespace.";
    return table(["NAME", "CPU(cores)", "MEMORY(bytes)"], rows.map(r => [r.name, r.cpuMilli + "m", r.memMi + "Mi"]));
  }

  if (["nodes", "node", "no"].includes(what)) {
    let nodes = host.nodeMetrics();
    if (name) {
      nodes = nodes.filter(nd => nd.name === name);
      if (nodes.length === 0) return host._err('Error from server (NotFound): nodes "' + name + '" not found', "Node-Namen siehst du mit 'kubectl get nodes'.");
    }
    return table(["NAME", "CPU(cores)", "CPU%", "MEMORY(bytes)", "MEMORY%"],
      nodes.map(nd => [nd.name, nd.cpuMilli + "m", nd.cpuPct + "%", nd.memMi + "Mi", nd.memPct + "%"]));
  }

  if (!what) return host._err("kubectl top: pods oder nodes?", "z.B. 'kubectl top pods' oder 'kubectl top nodes'");
  return host._err("kubectl top kennt nur 'pods' und 'nodes'.", "z.B. 'kubectl top nodes'");
}

/** Prometheus-Scrape-Ziele aus dem Cluster-Zustand abgeleitet (Grundgerüst #109):
 *  Node-Targets (kubelet) sowie ein App-Target je Service – up/down je nach Erreichbarkeit. */

function kubectlSet(host: KubectlHost, t: string[], raw: string) {
  if (t[2] === "image") return kubectlSetImage(host, t);
  if (t[2] === "env") return kubectlSetEnv(host, t, raw);
  if (t[2] === "resources") return kubectlSetResources(host, t, raw);
  return host._err("Der Simulator kann 'kubectl set image …', 'kubectl set env …' und 'kubectl set resources …'.", "z.B. 'kubectl set env deployment/<name> --from=configmap/<name>'");
}

/** kubectl set env deployment/<name> --from=configmap/<name> | --from=secret/<name>
 *  Bindet eine ConfigMap (harmlose Config) oder ein Secret (Vertrauliches) als
 *  Umgebungsvariablen in ein Deployment ein. */

function kubectlSetEnv(host: KubectlHost, t: string[], raw: string) {
  let depName: string | null = null;
  if (t[3] && t[3].startsWith("deployment/")) depName = t[3].split("/")[1];
  else if (t[3] === "deployment") depName = t[4];
  if (!depName) return host._err("kubectl set env: Welches Deployment?", "Muster: kubectl set env deployment/<name> --from=configmap/<name>");
  const dep = host.deployments.find(d => d.name === depName);
  if (!dep) return host._err('Error from server (NotFound): deployments.apps "' + depName + '" not found', "Welche Deployments es gibt: 'kubectl get deployments'");
  const m = raw.match(/--from[=\s](configmap|secret)\/(\S+)/);
  if (!m) return host._err("kubectl set env: Womit einbinden?", "Muster: kubectl set env deployment/<name> --from=configmap/<name> (oder --from=secret/<name>)");
  const kind = m[1];
  const refName = m[2];
  if (kind === "configmap") {
    if (!host.configMaps.some(c => c.name === refName)) return host._err('error: configmaps "' + refName + '" not found', "Erst anlegen: kubectl create configmap " + refName + " --from-literal=k=v");
    if (!dep.envFrom.configMaps.includes(refName)) dep.envFrom.configMaps.push(refName);
  } else {
    if (!host.secrets.some(s => s.name === refName)) return host._err('error: secrets "' + refName + '" not found', "Erst anlegen: kubectl create secret generic " + refName + " --from-literal=k=v");
    if (!dep.envFrom.secrets.includes(refName)) dep.envFrom.secrets.push(refName);
  }
  return "deployment.apps/" + depName + " env updated";
}

/** kubectl set image deployment/<name> <container>=<image> */

function kubectlSetImage(host: KubectlHost, t: string[]) {
  if (t[2] !== "image") return host._err("Der Simulator kann nur 'kubectl set image deployment/<name> <container>=<image>'.");
  let depName: string | null = null;
  if (t[3] && t[3].startsWith("deployment/")) depName = t[3].split("/")[1];
  else if (t[3] === "deployment") { depName = t[4]; t = t.slice(0, 4).concat(t.slice(5)); }
  const kv = t.find(x => x.includes("=") && !x.startsWith("--"));
  if (!depName || !kv) return host._err("kubectl set image: So nicht ganz.", "Muster: kubectl set image deployment/<name> <container>=<image>");
  const dep = host.deployments.find(d => d.name === depName);
  if (!dep) return host._err('Error from server (NotFound): deployments.apps "' + depName + '" not found');
  const newImage = kv.split("=")[1];
  const oldBad = dep.broken && dep.broken.type === "imagepull" ? dep.broken.badImage : null;
  dep.image = newImage;
  if (oldBad && newImage !== oldBad) {
    dep.broken = null;
    dep.pods = dep.pods.map(() => ({ name: makePodName(dep.name), created: host.clock, restarts: 0 }));
  }
  return "deployment.apps/" + depName + " image updated" + (oldBad && newImage === oldBad ? "\n💡 Hmm – das ist exakt dasselbe (kaputte) Image. Schau nochmal genau auf den Namen!" : "");
}

/** Speicherangabe wie "256Mi", "1Gi", "512M" in Mi umrechnen (null bei Unsinn). */

function parseMem(spec: string): number | null {
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

function kubectlSetResources(host: KubectlHost, t: string[], raw: string) {
  let depName: string | null = null;
  if (t[3] && t[3].startsWith("deployment/")) depName = t[3].split("/")[1];
  else if (t[3] === "deployment") depName = t[4];
  const limitSpec = (raw.match(/--limits[=\s][^\s]*memory=([0-9]+(?:Mi|Gi|M|G)?)/) || [])[1];
  const requestSpec = (raw.match(/--requests[=\s][^\s]*memory=([0-9]+(?:Mi|Gi|M|G)?)/) || [])[1];
  const cpuMatch = raw.match(/--limits[=\s][^\s]*cpu=([0-9]+)(m)?/);
  const cpuLimitMilli = cpuMatch ? (cpuMatch[2] ? parseInt(cpuMatch[1], 10) : parseInt(cpuMatch[1], 10) * 1000) : null;
  if (!depName) return host._err("kubectl set resources: Welches Deployment?", "Muster: kubectl set resources deployment/<name> --limits=memory=256Mi --requests=memory=128Mi");
  if (!limitSpec && !requestSpec && cpuLimitMilli === null) return host._err("kubectl set resources: Kein Limit/Request angegeben.", "Häng z.B. '--limits=memory=256Mi --requests=memory=128Mi' oder '--limits=cpu=200m' an.");
  const dep = host.deployments.find(d => d.name === depName);
  if (!dep) return host._err('Error from server (NotFound): deployments.apps "' + depName + '" not found', "Welche Deployments es gibt: 'kubectl get deployments'");
  const newLimit = limitSpec ? parseMem(limitSpec) : null;
  if (limitSpec && newLimit === null) return host._err('error: invalid resource quantity "' + limitSpec + '"', "Schreib das Limit z.B. als '256Mi' oder '1Gi'.");
  if (newLimit !== null) dep.memLimit = newLimit;
  let healed = false;
  if (dep.broken && dep.broken.type === "oomkilled" && newLimit !== null && newLimit >= (dep.broken.memNeeded || 0)) {
    dep.broken = null;
    dep.pods = dep.pods.map(() => ({ name: makePodName(dep.name), created: host.clock, restarts: 0 }));
    healed = true;
  }
  let cpuThrottled = false;
  if (cpuLimitMilli !== null && cpuLimitMilli < 500 && dep.cpuHeavy) {
    dep.cpuHeavy = false;
    dep.pods = dep.pods.map(() => ({ name: makePodName(dep.name), created: host.clock, restarts: 0 }));
    cpuThrottled = true;
  }
  return "deployment.apps/" + depName + " resource requirements updated" +
    (healed ? "\n💡 Genug Speicher! Die Pods starten neu und bleiben diesmal stehen – kein OOMKilled mehr." : "") +
    (cpuThrottled ? "\n💡 CPU-Limit gesetzt! Die Pods werden gedrosselt – der HighPodCPU-Alert fällt auf resolved." : "");
}

/** kubectl rollout restart deployment <name> */

function kubectlRollout(host: KubectlHost, t: string[]) {
  if (t[2] !== "restart") return host._err("Der Simulator kann nur 'kubectl rollout restart deployment <name>'.");
  let depName: string | null = null;
  if (t[3] && t[3].startsWith("deployment/")) depName = t[3].split("/")[1];
  else if (t[3] === "deployment") depName = t[4];
  if (!depName) return host._err("kubectl rollout restart: Welches Deployment?", "Muster: kubectl rollout restart deployment <name>");
  const dep = host.deployments.find(d => d.name === depName);
  if (!dep) return host._err('Error from server (NotFound): deployments.apps "' + depName + '" not found');
  const broken = dep.broken;
  if (broken && broken.type === "crashloop" && host.secrets.some(s => s.name === broken.needsSecret)) {
    dep.broken = null;
  }
  dep.pods = dep.pods.map(() => ({ name: makePodName(dep.name), created: host.clock, restarts: 0 }));
  return "deployment.apps/" + depName + " restarted";
}

/* ===================== helm ===================== */
