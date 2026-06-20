/* Gemeinsame Test-Fixtures für die sim-Modul-Tests (sim.test.ts-Split, #383).
 * Die befehlsfamilien-spezifischen Tests (docker/kubectl/rbac/helm/git/terraform/
 * argocd/glab) liegen je in test/sim/<familie>.test.ts und teilen sich diesen
 * frischen Ausgangs-Simulator – früher das beforeEach in test/sim.test.ts. */
import { Sim as KQSim } from "../../src/sim";

export { KQSim };

/** Frischer Simulator mit leerem Szenario – der gemeinsame Startzustand jeder
 *  sim-Modul-Test-Datei (`beforeEach(() => { sim = freshSim(); })`). */
export function freshSim(): KQSim {
  return new KQSim({});
}
