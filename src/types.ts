/* Zentrale Typen für KubeQuest.
 * Die Content-Ränder sind inzwischen scharf typisiert: `QuestStep` ist eine
 * diskriminierte Union pro Schritt-Typ, `clusterSnapshot` trägt die Sim-Form.
 * Kein `any` mehr an diesen Rändern – der Compiler fängt falsch gebaute Inhalte.
 */

// Reiner Typ-Import (zur Laufzeit gelöscht) – sim.ts importiert seinerseits nur
// `ExecResult` als Typ aus dieser Datei, der Zyklus ist daher unkritisch.
import type { Sim, Scenario } from "./sim";

/** Vollständiger, serialisierbarer Spielstand (genau die Form aus Game.defaultState). */
export interface GameState {
  xp: number;
  coins: number;
  character: number | null;
  player: { x: number; y: number };
  questIdx: number;
  questStep: number;
  taskIdx: number;
  completedQuests: string[];
  inventory: Record<string, number>;
  owned: string[];
  activePet: string | null;
  activeFlag: string | null;
  review: Record<string, { box: number; due: number }>;
  streak: { count: number; lastDay: number };
  /** Wurde der einmalige Erklär-Toast zum 🔥 Streak bereits gezeigt? */
  streakHintShown: boolean;
  stats: {
    commands: number;
    reviews: number;
    quizRight: number;
    quizWrong: number;
    piratesBeaten: number;
    krakenBeaten: number;
    stackBest: number;
    [k: string]: number; // dynamische Zusatz-Stats (z.B. stormsFixed)
  };
  lastSeen: number;
  /** Serialisierter Cluster-Zustand (genau die Form von Sim.snapshot()). */
  clusterSnapshot: Scenario | null;
  /** Audio-Einstellungen (Musik & Sounds getrennt schaltbar, je mit Lautstärke). */
  audio: { music: boolean; sfx: boolean; musicVol: number; sfxVol: number };
  /** Spiel-Feel: Frequenz/Härte der Zufalls-Events (Anti-Frust, #71). */
  settings: { events: EventMode };
}

/** Spiel-Feel-Stufe: regelt Häufigkeit & Härte der Zufalls-Events (Stürme,
 *  Piraten, Krake) und den Verdienst-Malus kaputter Dienste.
 *  `normal` = volle Härte, `cozy` = seltener/sanfter + gemilderter Malus,
 *  `off` = keine Zufalls-Events und kein Malus. */
export type EventMode = "normal" | "cozy" | "off";

/** Ergebnis einer simulierten Befehlszeile (Sim.exec). */
export interface ExecResult {
  output: string | null;
  error: boolean;
  clear?: boolean;
}

/* ---------- Inhalts-Strukturen ----------
 * `QuestStep` ist eine echte diskriminierte Union über `type`: jeder Schritt-Typ
 * führt genau seine Pflichtfelder, der Compiler meckert bei falsch aufgebauten
 * Schritten (Tippfehler im Feldnamen, fehlendes Pflichtfeld). Die zusätzlichen
 * Cross-Referenz-Prüfungen (verweist reviewId auf eine existierende Karte? matcht
 * die Lösung ihre accept-Regex?) bleiben als zweite Sicherung in content.test.ts. */

/** Eine zu tippende Terminal-Aufgabe bzw. – um `intro` erweitert – ein Teach-Befehl. */
export interface QuestTask {
  id: string;
  text: string;
  /** Erlaubte Eingaben; mindestens eine Regex muss matchen. */
  accept: RegExp[];
  /** Musterlösung (Anzeige + Selbsttest in content.test.ts). */
  solution: string;
  hint: string;
  /** Optionale Zusatzbedingung gegen den Sim-Zustand – es zählt nur die Truthiness. */
  check?: (sim: Sim) => unknown;
}

/** Der „neue Befehl" eines Teach-Schritts: eine Aufgabe mit erklärendem Intro. */
export interface TeachCommand extends QuestTask {
  intro: string;
}

/** Eine Antwortoption eines Choice-Schritts. */
export interface ChoiceOption {
  t: string;
  ok: boolean;
  reply: string;
}

/** Gemeinsame, an jedem Schritt-Typ erlaubte Felder. */
export interface StepBase {
  /** Bereitet die Welt vor (Dateien, kaputte Deployments, Pipelines …), bevor
   *  der Schritt läuft – kann an Dialog-, Teach- oder Terminal-Schritten hängen. */
  scenario?: Scenario;
}

/** Gespräch: der NPC sagt mehrere Zeilen. */
export interface DialogStep extends StepBase {
  type: "dialog";
  npc: string;
  lines: string[];
}

/** Verständnisfrage beim NPC; genau eine Option ist richtig (`ok`). */
export interface ChoiceStep extends StepBase {
  type: "choice";
  npc: string;
  q: string;
  options: ChoiceOption[];
  /** Verknüpfte Karteikarte (Spaced Repetition); muss in CRAB_QUIZ existieren. */
  reviewId?: string;
}

/** Ein neuer Befehl: erklärt und selbst getippt (im Funkgerät). */
export interface TeachStep extends StepBase {
  type: "teach";
  brief: string;
  cmd: TeachCommand;
}

/** Zufalls-Übungen aus dem Gelernten (Drills werden von der UI gezogen). */
export interface DrillStep extends StepBase {
  type: "drill";
  brief: string;
  /** Drill-IDs aus DRILLS, aus denen zufällig gezogen wird. */
  pool: string[];
  count: number;
  intro: string;
}

/** Feste Aufgabenkette (Showdowns/Diagnose). */
export interface TerminalStep extends StepBase {
  type: "terminal";
  brief: string;
  tasks: QuestTask[];
}

/** Ein Quest-Schritt – diskriminierte Union über `type`. */
export type QuestStep = DialogStep | ChoiceStep | TeachStep | DrillStep | TerminalStep;

/** Schritte, die im Funkgerät-Terminal laufen (statt im Dialog beim NPC). */
export type FunkStep = TeachStep | DrillStep | TerminalStep;

export interface Quest {
  id: string;
  title: string;
  giver: string;
  rewardXp: number;
  rewardCoins: number;
  steps: QuestStep[];
}
