/* Zentrale Typen für KubeQuest.
 * Während der Migration bewusst pragmatisch gehalten (viel `any` an den
 * dynamischen Phaser-/Content-Rändern). Wird beim Hochziehen der TS-Strenge
 * (siehe README „Ausbaustufen") Datei für Datei verfeinert.
 */

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
  clusterSnapshot: any | null;
}

/** Ergebnis einer simulierten Befehlszeile (Sim.exec). */
export interface ExecResult {
  output: string | null;
  error: boolean;
  clear?: boolean;
}

/* ---------- Inhalts-Strukturen ----------
 * Bewusst permissiv (Index-Signatur `[k: string]: any`): die Quest-Daten in
 * content.ts sind sehr heterogen (teach/drill/terminal/choice/dialog-Schritte).
 * Diese Typen sichern die GEMEINSAMEN Pflichtfelder; die feinkörnige Variante
 * (diskriminierte Union pro Schritt-Typ) ist ein Schritt der TS-Verschärfung.
 * Cross-Referenz-Prüfungen (verweist reviewId auf eine existierende Karte?)
 * macht weiterhin content.test.ts. */
export interface QuestStep {
  type: string;
  [k: string]: any;
}

export interface Quest {
  id: string;
  steps: QuestStep[];
  [k: string]: any;
}
