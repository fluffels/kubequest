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
  "q2/t-stop": (sim) => sim.docker.containers.some((c) => !c.running),
  "q7/t-storm-3": (sim) => sim.lastDeletedPod !== null,
  "q7/t-getsvc": (sim) => sim.services.some((s) => s.name === "kasse"),
  "q8/t-ada-6": (sim) => sim.ingresses.some((i) => i.name === "hafentor"),
  "q10/t-runa-4": (sim) => sim.releases.length > 0,
  "q13/t-theo-2": (sim) => sim.tf.applied,
  "q26/t-q26-bind-secret": (sim) => {
            const d = sim.deployments.find((d2) => d2.name === "passagierliste");
            return d && d.envFrom.configMaps.includes("passagier-config") && d.envFrom.secrets.includes("passagier-geheim");
          },
  "q15/t-j15-3": (sim) => {
            const d = sim.deployments.find((d2) => d2.name === "leuchtfeuer");
            return d && !d.broken;
          },
  "q16/t-j16-4": (sim) => {
            const d = sim.deployments.find((d2) => d2.name === "funkboje");
            return d && !d.broken;
          },
  "q17/t-j17-6": (sim) => sim.nodes.length > 3,
  "q17/t-j17-7": (sim) => {
            const d = sim.deployments.find((d2) => d2.name === "frachtplaner");
            return d && !d.broken;
          },
  "q25/t-git-fetch": (sim) => sim.git.fetched,
  "q25/t-git-pull": (sim) => sim.git.remoteAhead === 0,
  "q25/t-git-merge-conflict": (sim) => !!sim.git.conflict,
  "q25/t-conf-theirs": (sim) => sim.files["seekarte.md"] === "Nordpassage: weiter Bogen ums Riff – sicher, etwas laenger." && !!sim.git.conflict,
  "q25/t-conf-add": (sim) => !sim.git.conflict && sim.git.staged.includes("seekarte.md"),
  "q25/t-conf-commit": (sim) => !sim.git.conflict,
  "q25/t-git-push-resolved": (sim) => sim.git.pushed,
  "q22/t-juno-np-3": (sim) => sim.networkPolicies.some((n) => n.name === "hafenmauer"),
  "q23/t-ada-tls-3": (sim) => sim.ingresses.some((i) => i.name === "hafentor" && !!i.tls),
  "q24/t-j24-3": (sim) => sim.services.some((s) => s.name === "kombuese"),
  "q24/t-j24-5": (sim) => {
            const d = sim.deployments.find((d2) => d2.name === "kombuese");
            return !!d && !d.broken && sim.services.some((s) => s.name === "kombuese");
          },
  "q24/t-j24-6": (sim) => {
            const d = sim.deployments.find((d2) => d2.name === "kombuese");
            return !!d && !d.broken;
          },
  "q27/t-j26-4": (sim) => {
            const d = sim.deployments.find((d2) => d2.name === "kartograf");
            return d && !d.broken;
          },
  "q29/t-argo-get": (sim) => sim.argoApps.some((a) => a.name === "hafen-lager"),
  "q29/t-argo-sync": (sim) => sim.deployments.some((d) => d.name === "hafen-lager"),
  "q29/t-argo-verify": (sim) => sim.deployments.some((d) => d.name === "hafen-lager"),
  "q30/t-sh-apply": (sim) => sim.argoApps.some((a) => a.name === "hafen-lager" && a.selfHeal),
  "q30/t-sh-get-before": (sim) => sim.argoApps.some((a) => a.name === "hafen-lager" && a.selfHeal),
  "q30/t-sh-scale": (sim) => {
            const d = sim.deployments.find((x) => x.name === "hafen-lager");
            return !!d && d.replicas === 0;
          },
  "q30/t-sh-get-after": (sim) => {
            const d = sim.deployments.find((x) => x.name === "hafen-lager");
            return !!d && d.replicas === 2;
          },
  "q31/t-aoa-apply": (sim) => sim.argoApps.some((a) => a.name === "hafen-flotte" && !!a.childApps) && ["flotte-lager", "flotte-funk", "flotte-kran"].every((n) => sim.argoApps.some((a) => a.name === n)),
  "q31/t-aoa-list": (sim) => ["flotte-lager", "flotte-funk", "flotte-kran"].every((n) => sim.argoApps.some((a) => a.name === n)),
  "q31/t-aoa-get": (sim) => {
            const a = sim.argoApps.find((x) => x.name === "hafen-flotte");
            return !!a && !!a.childApps && a.childApps.length === 3;
          },
  "q31/t-aoa-deploys": (sim) => ["flotte-lager", "flotte-funk", "flotte-kran"].every((n) => sim.deployments.some((d) => d.name === n)),
  "q32/t-sm-apply": (sim) => sim.serviceMonitors.some((s) => s.name === "lager-monitor"),
  "q32/t-sm-get": (sim) => sim.serviceMonitors.some((s) => s.name === "lager-monitor"),
  "q33/t-ds-apply": (sim) => sim.grafanaDatasources.some((d) => d.name === "prometheus-quelle"),
  "q33/t-ds-get": (sim) => sim.grafanaDatasources.some((d) => d.name === "prometheus-quelle"),
  "q33/t-gd-apply": (sim) => sim.grafanaDashboards.some((d) => d.name === "hafen-uebersicht"),
  "q33/t-gd-get": (sim) => sim.grafanaDashboards.some((d) => d.name === "hafen-uebersicht"),
  "q35/t-pr-apply": (sim) => sim.prometheusRules.some((r) => r.name === "hafen-alarme"),
  "q35/t-pr-get": (sim) => sim.prometheusRules.some((r) => r.name === "hafen-alarme"),
  "q35/t-alerts-get": (sim) => sim.alerts().some((a) => a.name === "HighPodCPU" && a.state === "firing"),
  "q35/t-scale-zero": (sim) => sim.alerts().some((a) => a.name === "HighPodCPU" && a.state === "resolved"),
  "q36/t-sts-apply": (sim) => sim.statefulSets.some((s) => s.name === "speicher-datenbank"),
  "q36/t-sts-get": (sim) => sim.statefulSets.some((s) => s.name === "speicher-datenbank"),
  "q36/t-sts-pods": (sim) => {
            const s = sim.statefulSets.find((x) => x.name === "speicher-datenbank");
            return !!s && s.pods.some((p) => p.name === "speicher-datenbank-0");
          },
  "q36/t-sts-delete": (sim) => {
          const s = sim.statefulSets.find((x) => x.name === "speicher-datenbank");
          return !!s && s.pods.some((p) => p.name === "speicher-datenbank-0");
        },
  "q37/t-sc-apply": (sim) => sim.storageClasses.some((s) => s.name === "kai-ssd"),
  "q37/t-pvc-apply": (sim) => sim.pvcs.some((p) => p.name === "lager-daten" && p.status === "Bound"),
  "q37/t-pvc-get": (sim) => sim.pvcs.some((p) => p.name === "lager-daten" && p.status === "Bound"),
  "q37/t-pv-get": (sim) => sim.pvs.some((p) => p.status === "Bound" && p.claim === "default/lager-daten"),
  "q37/t-pvc-dep": (sim) => sim.deployments.some((d) => d.name === "datenbank"),
  "q37/t-pvc-del": (sim) => !sim.deployments.some((d) => d.name === "datenbank"),
  "q37/t-pvc-still": (sim) => sim.pvcs.some((p) => p.name === "lager-daten" && p.status === "Bound") && !sim.deployments.some((d) => d.name === "datenbank"),
};
