/* ===== KubeQuest 3.0 – UI & Quest-Steuerung (Orchestrator/Barrel, #356) =====
 * Das öffentliche UI-Objekt entsteht aus den Domänen-Bündeln unter src/ui/
 * (Dialog/Funkgerät/Quiz/Minispiel/Shop/Logbuch/HUD …); der veränderliche
 * UI-Zustand (this.*) ist hier zentral deklariert, gemeinsame Helfer liegen in
 * src/ui/shared.ts. Schwester-Refactor zu #345 (scenes.ts) und #346 (sim.ts). */
import { overlayUI } from "./ui/overlay";
import { hudUI } from "./ui/hud";
import { questUI } from "./ui/quest";
import { dialogUI } from "./ui/dialog";
import { radioUI } from "./ui/radio";
import { minigameUI } from "./ui/minigame";
import { questlogUI } from "./ui/questlog";
import { shopUI } from "./ui/shop";
import { quizUI } from "./ui/quiz";
import { saveUI } from "./ui/save";

export const UI = {
  dialogue: null as any,
  termLog: [] as any[],
  review: null as any,
  practice: null as any,   // { npcId, drills, idx, task }
  _drillTask: null as any, // aktuelle generierte Drill-Aufgabe des Quest-Schritts
  stack: null as any,      // Stapel-Minispiel
  failCount: 0,
  _gateClearedIdx: -1,     // questIdx, für den das Wiederholungs-Gate schon erledigt ist (#222)
  _lastClock: "",          // zuletzt gesetzte HUD-Uhr-Signatur – die Uhr tickt jede reale Sekunde, aber updateDayNight feuert jeden Frame; nur bei echter Änderung in den DOM schreiben (#121)
  choiceBtns: null as any, // Dialog-Antwort-Buttons (für Tastatur-Navigation)
  choiceSel: 0,
  questLogViewIdx: null as number | null, // welche Quest im Logbuch gerade „nachgelesen" wird (null = Übersicht, #326)
  reviewSel: -1,           // markierte Quiz-Option in der Wissensrunde (Pfeiltasten, #258)
  ...overlayUI,
  ...hudUI,
  ...questUI,
  ...dialogUI,
  ...radioUI,
  ...minigameUI,
  ...questlogUI,
  ...shopUI,
  ...quizUI,
  ...saveUI,
};
