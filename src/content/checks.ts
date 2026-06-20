/* ===== Inhalte: Quest-Mechanik-Prädikate (#348, Content-as-Data) =====
 * Die `check`-Funktionen der Quests sind MECHANIK, nicht Inhalt: kurze Prädikate,
 * die den Sim-Zustand prüfen ("ist das Deployment jetzt heil?"). Per ADR 0004
 * bleibt Mechanik Code – darum stehen sie hier als benannte Registry, während der
 * Quest-INHALT in data/quests.json liegt und per Key (`<questId>/<cmd|task-id>`)
 * hierher zeigt. Der Loader (loader.ts) löst Key → Funktion beim Laden auf.
 *
 * Automatisch aus den früheren TS-Quests extrahiert (Migration #348); danach
 * von Hand pflegbar. Jeder Eintrag greift ausschließlich auf `sim` zu.
 */
import type { Sim } from "../sim";

export const QUEST_CHECKS: Record<string, (sim: Sim) => unknown> = {
  "docker-list-containers/t-stop": (sim) => sim.docker.containers.some((c) => !c.running),
  "k8s-self-healing/t-storm-3": (sim) => sim.lastDeletedPod !== null,
  "k8s-self-healing/t-getsvc": (sim) => sim.services.some((s) => s.name === "kasse"),
  "k8s-apply-manifests/t-ada-6": (sim) => sim.ingresses.some((i) => i.name === "hafentor"),
  "helm-release-install/t-runa-4": (sim) => sim.releases.length > 0,
  "terraform-state-destroy/t-theo-2": (sim) => sim.tf.applied,
  "k8s-configmap-secret/t-k8s-configmap-secret-bind-secret": (sim) => {
            const d = sim.deployments.find((d2) => d2.name === "passagierliste");
            return d && d.envFrom.configMaps.includes("passagier-config") && d.envFrom.secrets.includes("passagier-geheim");
          },
  "k8s-debug-imagepull/t-j15-3": (sim) => {
            const d = sim.deployments.find((d2) => d2.name === "leuchtfeuer");
            return d && !d.broken;
          },
  "k8s-debug-crashloop/t-j16-4": (sim) => {
            const d = sim.deployments.find((d2) => d2.name === "funkboje");
            return d && !d.broken;
          },
  "k8s-node-capacity/t-j17-6": (sim) => sim.nodes.length > 3,
  "k8s-node-capacity/t-j17-7": (sim) => {
            const d = sim.deployments.find((d2) => d2.name === "frachtplaner");
            return d && !d.broken;
          },
  "git-merge-branches/t-git-fetch": (sim) => sim.git.fetched,
  "git-merge-branches/t-git-pull": (sim) => sim.git.remoteAhead === 0,
  "git-merge-branches/t-git-merge-conflict": (sim) => !!sim.git.conflict,
  "git-merge-branches/t-conf-theirs": (sim) => sim.files["seekarte.md"] === "Nordpassage: weiter Bogen ums Riff – sicher, etwas laenger." && !!sim.git.conflict,
  "git-merge-branches/t-conf-add": (sim) => !sim.git.conflict && sim.git.staged.includes("seekarte.md"),
  "git-merge-branches/t-conf-commit": (sim) => !sim.git.conflict,
  "git-merge-branches/t-git-push-resolved": (sim) => sim.git.pushed,
  "network-policy/t-juno-np-3": (sim) => sim.networkPolicies.some((n) => n.name === "hafenmauer"),
  "secrets-encrypted/t-ada-tls-3": (sim) => sim.ingresses.some((i) => i.name === "hafentor" && !!i.tls),
  "k8s-service-endpoints/t-j24-3": (sim) => sim.services.some((s) => s.name === "kombuese"),
  "k8s-service-endpoints/t-j24-5": (sim) => {
            const d = sim.deployments.find((d2) => d2.name === "kombuese");
            return !!d && !d.broken && sim.services.some((s) => s.name === "kombuese");
          },
  "k8s-service-endpoints/t-j24-6": (sim) => {
            const d = sim.deployments.find((d2) => d2.name === "kombuese");
            return !!d && !d.broken;
          },
  "k8s-resource-limits/t-j26-4": (sim) => {
            const d = sim.deployments.find((d2) => d2.name === "kartograf");
            return d && !d.broken;
          },
  "gitops-self-sync/t-argo-get": (sim) => sim.argoApps.some((a) => a.name === "hafen-lager"),
  "gitops-self-sync/t-argo-sync": (sim) => sim.deployments.some((d) => d.name === "hafen-lager"),
  "gitops-self-sync/t-argo-verify": (sim) => sim.deployments.some((d) => d.name === "hafen-lager"),
  "gitops-drift-detection/t-sh-apply": (sim) => sim.argoApps.some((a) => a.name === "hafen-lager" && a.selfHeal),
  "gitops-drift-detection/t-sh-get-before": (sim) => sim.argoApps.some((a) => a.name === "hafen-lager" && a.selfHeal),
  "gitops-drift-detection/t-sh-scale": (sim) => {
            const d = sim.deployments.find((x) => x.name === "hafen-lager");
            return !!d && d.replicas === 0;
          },
  "gitops-drift-detection/t-sh-get-after": (sim) => {
            const d = sim.deployments.find((x) => x.name === "hafen-lager");
            return !!d && d.replicas === 2;
          },
  "gitops-app-of-apps/t-aoa-apply": (sim) => sim.argoApps.some((a) => a.name === "hafen-flotte" && !!a.childApps) && ["flotte-lager", "flotte-funk", "flotte-kran"].every((n) => sim.argoApps.some((a) => a.name === n)),
  "gitops-app-of-apps/t-aoa-list": (sim) => ["flotte-lager", "flotte-funk", "flotte-kran"].every((n) => sim.argoApps.some((a) => a.name === n)),
  "gitops-app-of-apps/t-aoa-get": (sim) => {
            const a = sim.argoApps.find((x) => x.name === "hafen-flotte");
            return !!a && !!a.childApps && a.childApps.length === 3;
          },
  "gitops-app-of-apps/t-aoa-deploys": (sim) => ["flotte-lager", "flotte-funk", "flotte-kran"].every((n) => sim.deployments.some((d) => d.name === n)),
  "observability-metrics/t-sm-apply": (sim) => sim.serviceMonitors.some((s) => s.name === "lager-monitor"),
  "observability-metrics/t-sm-get": (sim) => sim.serviceMonitors.some((s) => s.name === "lager-monitor"),
  "observability-grafana/t-ds-apply": (sim) => sim.grafanaDatasources.some((d) => d.name === "prometheus-quelle"),
  "observability-grafana/t-ds-get": (sim) => sim.grafanaDatasources.some((d) => d.name === "prometheus-quelle"),
  "observability-grafana/t-gd-apply": (sim) => sim.grafanaDashboards.some((d) => d.name === "hafen-uebersicht"),
  "observability-grafana/t-gd-get": (sim) => sim.grafanaDashboards.some((d) => d.name === "hafen-uebersicht"),
  "observability-alerts/t-pr-apply": (sim) => sim.prometheusRules.some((r) => r.name === "hafen-alarme"),
  "observability-alerts/t-pr-get": (sim) => sim.prometheusRules.some((r) => r.name === "hafen-alarme"),
  "observability-alerts/t-alerts-get": (sim) => sim.alerts().some((a) => a.name === "HighPodCPU" && a.state === "firing"),
  "observability-alerts/t-scale-zero": (sim) => sim.alerts().some((a) => a.name === "HighPodCPU" && a.state === "resolved"),
  "storage-statefulset/t-sts-apply": (sim) => sim.statefulSets.some((s) => s.name === "speicher-datenbank"),
  "storage-statefulset/t-sts-get": (sim) => sim.statefulSets.some((s) => s.name === "speicher-datenbank"),
  "storage-statefulset/t-sts-pods": (sim) => {
            const s = sim.statefulSets.find((x) => x.name === "speicher-datenbank");
            return !!s && s.pods.some((p) => p.name === "speicher-datenbank-0");
          },
  "storage-statefulset/t-sts-delete": (sim) => {
          const s = sim.statefulSets.find((x) => x.name === "speicher-datenbank");
          return !!s && s.pods.some((p) => p.name === "speicher-datenbank-0");
        },
  "storage-pvc/t-sc-apply": (sim) => sim.storageClasses.some((s) => s.name === "kai-ssd"),
  "storage-pvc/t-pvc-apply": (sim) => sim.pvcs.some((p) => p.name === "lager-daten" && p.status === "Bound"),
  "storage-pvc/t-pvc-get": (sim) => sim.pvcs.some((p) => p.name === "lager-daten" && p.status === "Bound"),
  "storage-pvc/t-pv-get": (sim) => sim.pvs.some((p) => p.status === "Bound" && p.claim === "default/lager-daten"),
  "storage-pvc/t-pvc-dep": (sim) => sim.deployments.some((d) => d.name === "datenbank"),
  "storage-pvc/t-pvc-del": (sim) => !sim.deployments.some((d) => d.name === "datenbank"),
  "storage-pvc/t-pvc-still": (sim) => sim.pvcs.some((p) => p.name === "lager-daten" && p.status === "Bound") && !sim.deployments.some((d) => d.name === "datenbank"),
};
