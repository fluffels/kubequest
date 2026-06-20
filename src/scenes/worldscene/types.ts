/* ===== KubeQuest – WorldScene-System-Typ (worldscene/types.ts) =====
 * Schritt des WorldScene.ts-Splits (#393, analog scenes.ts-Split #345): die großen
 * Spiel-Systeme der World-Szene (Gefahren-Events, Cluster-Sync, Warps, Terrain,
 * Deko) liegen als eigene, fokussierte Module unter src/scenes/worldscene/ und
 * bekommen die laufende Szene als Parameter (`scene`) – dasselbe „freie Funktion
 * + Host"-Muster wie der sim.ts-Split (#346).
 *
 * `WorldSceneLike` ist der Struktur-Typ dieser Szene. Bewusst lose ([key]: any),
 * genau wie die WorldScene-Klasse selbst – so fassen die Module Phaser über die
 * Szene an, OHNE WorldScene.ts zu importieren. Ein Import von WorldScene.ts wäre
 * ein Import-Zyklus (WorldScene → Modul → WorldScene), den der Arch-Wächter #390
 * verbietet (Typ-Importe zählen dort mit, tsPreCompilationDeps).
 */
import type Phaser from "phaser";

export interface WorldSceneLike extends Phaser.Scene {
  // Die Szene nutzt this.events als eigenen Event-/Timer-Beutel und überschreibt
  // damit Phasers geerbten EventEmitter-Typ (reines Typ-Override, kein Verhalten).
  events: any;
  [key: string]: any;
}
