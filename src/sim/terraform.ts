/* ===== KubeQuest – terraform-Befehle (sim/terraform.ts) =====
 * Schritt 5/7 des sim.ts-Datei-Splits (#376, aus Epic #346, ADR 0004) – der
 * kleinste Befehlsblock, guter Einstieg.
 *
 * Hier liegt die komplette `terraform`-Befehlsfamilie (init/plan/apply/destroy/
 * state list/fmt/validate). Wie bei docker (#373), kubectl (#374) und helm (#375)
 * als freie Funktion ausgelagert, die die Sim-Instanz über das schmale
 * `TerraformHost`-Interface bekommt – so bleibt der Cluster-Zustand in EINER Hand
 * (die `Sim`-Klasse), die terraform-Logik aber in einer eigenen, testbaren Datei.
 * Aufgerufen aus dem `exec`-Dispatch in `sim.ts` per `terraformCommand(this, …)`.
 *
 * Phaser-frei (pure Domäne): die Domänentypen kommen aus ./state – kein Rückimport
 * nach sim.ts (kein Zyklus). Eigene Helfer braucht terraform keine.
 */
import type { ClusterState } from "./state";

/** Was die terraform-Befehle vom Simulator brauchen (von der `Sim`-Klasse erfüllt).
 *  Bewusst ein schmales Interface statt der ganzen `Sim`-Klasse: es dokumentiert
 *  die Kopplung von terraform an den Cluster-Zustand und vermeidet einen
 *  Import-Zyklus terraform ↔ sim. Die Daten-Felder (`tf`/`nodes`) kommen über
 *  `extends ClusterState` (sim/state.ts, #372); hinzu kommen die in `sim.ts`
 *  verbleibenden Helfer, die terraform ruft. */
export interface TerraformHost extends ClusterState {
  _err(msg: string, tip?: string): string;
  _reschedulePending(): void;
}

export function terraformCommand(host: TerraformHost, t: string[], _raw?: string): string {
  const sub = t[1];
  if (!sub) return host._err("terraform: Unterbefehl fehlt.", "Probier 'terraform init'.");
  const tf = host.tf;

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
    return host._err("Error: Backend initialization required, please run \"terraform init\"", "Der Ordner muss erst initialisiert werden: 'terraform init'");
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
        if (!host.nodes.some(n => n.name === name)) {
          host.nodes.push({ name, status: "Ready", roles: "<none>", version: "v1.30.2" });
        }
      }
      host._reschedulePending();
    }
    return tf.resources.map(r => r.addr + ": Creating...\n" + r.addr + ": Creation complete after 2s").join("\n") +
      "\n\nApply complete! Resources: " + tf.resources.length + " added, 0 changed, 0 destroyed.";
  }

  if (sub === "destroy") {
    if (!tf.applied) return "No changes. No objects need to be destroyed.";
    tf.applied = false;
    host.nodes = host.nodes.filter(n => !["ahoi-worker-3", "ahoi-worker-4"].includes(n.name));
    return tf.resources.map(r => r.addr + ": Destroying...\n" + r.addr + ": Destruction complete after 1s").join("\n") +
      "\n\nDestroy complete! Resources: " + tf.resources.length + " destroyed.";
  }

  if (sub === "state") {
    if (t[2] !== "list") return host._err("Der Simulator kann nur 'terraform state list'.");
    if (!tf.applied) return host._err("Noch nichts im State.", "Der State füllt sich erst nach 'terraform apply'.");
    return tf.resources.map(r => r.addr).join("\n");
  }

  if (sub === "fmt") return "main.tf";
  if (sub === "validate") return "Success! The configuration is valid.";

  return host._err("terraform: unbekannter Unterbefehl '" + sub + "'", "Tippe 'help' für alle Befehle.");
}
