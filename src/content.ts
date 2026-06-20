/* ===== KubeQuest 3.0 – Inhalte (Fassade) =====
 * Kleinschrittiges Lernen: jeder Befehl wird einzeln eingeführt (teach),
 * dann in Zufalls-Varianten geübt (drill), erst dann kommt der nächste.
 *
 * Die Inhalte sind nach Domänen in `./content/` aufgeteilt; diese Datei
 * bündelt sie nur noch zum gewohnten `KQContent`-Objekt (öffentliche API).
 */
import { RANKS, SHOP } from "./content/progression";
// NPCs, Smalltalk, Quests, Befehls-Karten und Quiz-Karten sind Content-as-Data
// (#348/#352/#368): als JSON in content/data/, geladen & gegen ein Schema validiert vom
// Loader (accept→RegExp, check→Mechanik-Registry). Siehe content/loader.ts + content/checks.ts.
import { NPCS, SMALLTALK, QUESTS, CMD_CARDS, CRAB_QUIZ, QUEST_TOPICS, groupQuestsByTopic } from "./content/loader";
import { DRILLS, PRACTICE } from "./content/drills";
import { STACK_ROUNDS, corruptImage } from "./content/minigame";
import { GLOSSARY, applyGlossary } from "./content/glossary";

export const KQContent = { RANKS, SHOP, NPCS, QUESTS, QUEST_TOPICS, SMALLTALK, CRAB_QUIZ, CMD_CARDS, DRILLS, PRACTICE, STACK_ROUNDS, corruptImage, GLOSSARY, applyGlossary, groupQuestsByTopic };
