/* ===== KubeQuest 3.0 – Inhalte (Fassade) =====
 * Kleinschrittiges Lernen: jeder Befehl wird einzeln eingeführt (teach),
 * dann in Zufalls-Varianten geübt (drill), erst dann kommt der nächste.
 *
 * Die Inhalte sind nach Domänen in `./content/` aufgeteilt; diese Datei
 * bündelt sie nur noch zum gewohnten `KQContent`-Objekt (öffentliche API).
 */
import { RANKS, SHOP, NPCS } from "./content/progression";
import { QUESTS } from "./content/quests";
import { DRILLS, PRACTICE } from "./content/drills";
import { SMALLTALK } from "./content/smalltalk";
import { CRAB_QUIZ, CMD_CARDS } from "./content/quiz";
import { STACK_ROUNDS, corruptImage } from "./content/minigame";

export const KQContent = { RANKS, SHOP, NPCS, QUESTS, SMALLTALK, CRAB_QUIZ, CMD_CARDS, DRILLS, PRACTICE, STACK_ROUNDS, corruptImage };
