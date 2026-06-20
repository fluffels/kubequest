/* Quest-Fortschritt, Dev-/Test-Sprung und freies Üben (#392, game.ts-Split).
 * Der aktuelle Quest/Schritt, das Weiterschalten (advanceStep), die Roadmap-Übersicht
 * und der quest-genaue Sprung (jumpToQuest, Grundlage fürs Dev-Panel #325) – alles
 * Phaser-frei und unit-testbar (Anwendungsschicht). */
import { KQContent } from "../content";
import { Sim as KQSim } from "../sim";
import { NPC_SPAWNS, TILE } from "../world";
import type { QuestStep, FunkStep } from "../types";
import { part, makeDefaultState, questIdForIndex } from "./shared";

/** Quest-Fortschritt, Dev-Sprung und Üben der Game-Fassade. */
export const progressionBundle = part({
  /* ---------- Quests ---------- */
  currentQuest() { return KQContent.QUESTS[this.state.questIdx] || null; },
  currentStep() {
    const q = this.currentQuest();
    return q ? q.steps[this.state.questStep] || null : null;
  },
  /** Ist der aktuelle Schritt einer fürs Funkgerät? (Typ-Guard fürs Narrowing) */
  isFunkStep(step: QuestStep | null): step is FunkStep {
    return !!step && (step.type === "teach" || step.type === "drill" || step.type === "terminal");
  },
  /** Aufgabenliste eines Funk-Schritts (drills werden von der UI generiert). */
  stepTasks(step: QuestStep) {
    if (step.type === "terminal") return step.tasks;
    if (step.type === "teach") return [step.cmd];
    return null;
  },

  advanceStep() {
    const q = this.currentQuest();
    if (!q) return {};
    this.state.questStep++;
    this.state.taskIdx = 0;
    if (this.state.questStep >= q.steps.length) {
      this.state.completedQuests.push(q.id);
      this.state.questIdx++;
      this.state.currentQuestId = questIdForIndex(this.state.questIdx); // ID synchron halten (#353)
      this.state.questStep = 0;
      this.state.questsSinceGate++;
      this.save();
      return { questDone: q };
    }
    this.save();
    return {};
  },
  allQuestsDone() { return this.state.questIdx >= KQContent.QUESTS.length; },

  /* ---------- Dev-/Test-Sprung (#329, Grundlage fürs Dev-Panel #325) ----------
   * Reine Anwendungs-API (Phaser-frei, unit-testbar): stellt einen beliebigen
   * Quest-/Story-Stand zum Testen her, statt sich jedes Mal von vorn durch-
   * zuspielen. Granularität bewusst PRO QUEST (Sprung an den Quest-Anfang,
   * questStep 0) – nicht pro Schritt. Das klickbare Panel + Passwort-Gating
   * dockt später hier an (#325); der Reload zum Anwenden lebt im DEV-Aufrufer
   * (window.kqDev), damit diese Methoden DOM-frei bleiben. */

  /** Liste aller Quests, AUS DEM CONTENT abgeleitet (nicht handgepflegt, sonst
   *  veraltet sie) – Grundlage der Roadmap-Übersicht. `completed` spiegelt den
   *  aktuellen Spielstand. */
  getQuestRoadmap() {
    const npcs = KQContent.NPCS as Record<string, { name: string } | undefined>;
    return KQContent.QUESTS.map((q, idx) => ({
      idx,
      id: q.id,
      title: q.title,
      giver: q.giver,
      giverName: npcs[q.giver]?.name ?? q.giver,
      steps: q.steps.length,
      completed: this.state.completedQuests.includes(q.id),
    }));
  },

  /** Setzt die Spielfigur auf den Standplatz des Quest-Givers (Kachel → Pixel).
   *  Giver ohne festen Standplatz (z.B. Kralle, relativ zum Schiff platziert)
   *  → Default-Startposition als Fallback. */
  spawnAtQuestGiver(questIdx: number) {
    const quest = KQContent.QUESTS[questIdx];
    const spawn = quest ? NPC_SPAWNS.find(s => s.id === quest.giver) : undefined;
    this.state.player = spawn
      ? { x: spawn.x * TILE, y: spawn.y * TILE }
      : { ...makeDefaultState().player };
  },

  /** Springt an den ANFANG der Quest `questIdx` (questStep 0): setzt den
   *  Quest-Stand, markiert alle vorherigen Quests als erledigt, baut den Cluster
   *  frisch aus den Szenarien der erreichten Schritte auf (spiegelt die
   *  Merge-Schleife aus `load()`, startet aber von leerem Cluster) und spawnt
   *  beim Giver. `questIdx === QUESTS.length` ist erlaubt = Endzustand (alles
   *  durch). Ungültiger Index → `false`, Stand bleibt unverändert. */
  jumpToQuest(questIdx: number): boolean {
    const quests = KQContent.QUESTS;
    if (!Number.isInteger(questIdx) || questIdx < 0 || questIdx > quests.length) return false;

    this.state.questIdx = questIdx;
    this.state.currentQuestId = questIdForIndex(questIdx); // ID synchron halten (#353)
    this.state.questStep = 0;
    this.state.taskIdx = 0;
    this.state.completedQuests = quests.slice(0, questIdx).map(q => q.id);

    // Cluster frisch aus den erreichten Schritt-Szenarien aufbauen – exakt wie
    // load() es nach diesem Stand täte, nur von leerem Cluster (kein Snapshot),
    // damit jump + Reload denselben Welt-Zustand ergibt wie natürliches Ankommen.
    this.state.clusterSnapshot = null;
    this.sim = new KQSim({});
    for (let qi = 0; qi <= Math.min(questIdx, quests.length - 1); qi++) {
      quests[qi].steps.forEach((step, si) => {
        if (step.scenario && (qi < questIdx || si <= this.state.questStep)) {
          this.sim.mergeScenario(Object.assign({}, step.scenario));
        }
      });
    }

    this.spawnAtQuestGiver(questIdx);
    // save(false): die gerade gesetzte Giver-Position NICHT von der noch
    // lebenden WorldScene überschreiben lassen (#335) – sonst spawnt man nach
    // dem reload wieder am alten Ort statt beim Quest-Giver.
    this.save(false);
    return true;
  },

  /* ---------- Üben (Drills bei NPCs) ---------- */
  practiceDrillsFor(npcId: string) {
    const pool = KQContent.PRACTICE[npcId] || [];
    return pool.filter(p => this.state.completedQuests.includes(p.after)).map(p => p.drill);
  },
});
