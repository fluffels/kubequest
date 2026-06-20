/* Unit-Tests: terraform-Befehlsfamilie (sim/terraform.ts) – Teil des sim.test.ts-Splits (#383).
 * init→plan→apply→destroy + das terraform-getriebene Einplanen von Pending-Pods
 * (neue Nodes). Fahren über sim.exec("…"); gemeinsame Fixtures in ./helpers. */
import { test, beforeEach } from "vitest";
import assert from "node:assert/strict";
import { KQSim, freshSim } from "./helpers";

let sim: KQSim;
beforeEach(() => { sim = freshSim(); });

test("terraform: Zyklus init→plan→apply→destroy, apply fügt Nodes hinzu", () => {
  sim.tf.resources = [{ addr: "hafen_server.worker[0]", desc: "x" }];
  assert.match(sim.exec("terraform plan").output!, /init/i, "plan ohne init wird abgelehnt");
  sim.exec("terraform init");
  assert.match(sim.exec("terraform plan").output!, /1 to add/);
  sim.exec("terraform apply");
  assert.equal(sim.nodes.length, 5, "neue Server werden Cluster-Nodes");
  assert.match(sim.exec("terraform plan").output!, /No changes/);
  sim.exec("terraform destroy");
  assert.equal(sim.nodes.length, 3);
});

test("troubleshooting: Pending heilt durch neue Nodes (Terraform)", () => {
  sim.mergeScenario({
    deployments: [{ name: "app", image: "nginx", replicas: 1, broken: { type: "pending" } }],
    tfResources: [{ addr: "hafen_server.worker[0]", desc: "x" }],
  });
  assert.match(sim.exec("kubectl get pods").output!, /Pending/);
  sim.exec("terraform init");
  sim.exec("terraform apply");
  assert.equal(sim.deployments[0].broken, null, "mit neuen Nodes wird der Pod eingeplant");
});
