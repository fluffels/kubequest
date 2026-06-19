/* ===== KubeQuest 3.0 – Inhalte (Fassade) =====
 * Kleinschrittiges Lernen: jeder Befehl wird einzeln eingeführt (teach),
 * dann in Zufalls-Varianten geübt (drill), erst dann kommt der nächste.
 *
 * Die Inhalte sind nach Domänen in `./content/` aufgeteilt; diese Datei
 * bündelt sie nur noch zum gewohnten `KQContent`-Objekt (öffentliche API).
 */
import { RANKS, SHOP } from "./content/progression";
// NPCs + Smalltalk sind Content-as-Data (#348): als JSON in content/data/,
// geladen & gegen ein Schema validiert vom Loader. Siehe content/loader.ts.
import { NPCS, SMALLTALK } from "./content/loader";
import { QUESTS } from "./content/quests";
import { DRILLS, PRACTICE } from "./content/drills";
import { CRAB_QUIZ, CMD_CARDS } from "./content/quiz";
import { STACK_ROUNDS, corruptImage } from "./content/minigame";
import { GLOSSARY, applyGlossary } from "./content/glossary";

export const KQContent = { RANKS, SHOP, NPCS, QUESTS, SMALLTALK, CRAB_QUIZ, CMD_CARDS, DRILLS, PRACTICE, STACK_ROUNDS, corruptImage, GLOSSARY, applyGlossary };
