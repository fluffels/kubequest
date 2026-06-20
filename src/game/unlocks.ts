/* „Verdiente" Freischaltungen (#392, game.ts-Split): die per Nutzung freigeschalteten
 * Abkürzungen (#287/#297/#313) und die ↑/↓-Befehlshistorie des Funkgerät-Terminals (#316).
 * Beide folgen demselben Muster: additives Flag/Array, das ein Alt-Stand regulär
 * nachverdient (kein Bruch, kein Versions-Bump). Anwendungsschicht, Phaser-frei. */
import { part, ALL_ABBREV_UNLOCKED, ABBREV_EARN_THRESHOLD, CMD_HISTORY_UNLOCK_AT } from "./shared";

/** Freischalt-Methoden der Game-Fassade (Abkürzungen + Befehlshistorie). */
export const unlocksBundle = part({
  /* ---------- „Verdiente Abkürzungen" (#287/#297) ---------- */
  /** Ist die Abkürzung mit dieser ID freigeschaltet? true, sobald sie einzeln
   *  freigeschaltet wurde ODER der Stand grandfathered ist (Sentinel "*").
   *  Das eigentliche Gating der Eingabe-Akzeptanz baut darauf auf (#299). */
  isAbbrevUnlocked(id: string): boolean {
    return this.state.unlockedAbbrev.includes(ALL_ABBREV_UNLOCKED) || this.state.unlockedAbbrev.includes(id);
  },

  /** Schaltet eine Abkürzung frei (idempotent, speichert sofort). Aufgerufen vom
   *  Freischalt-Moment im Lernpfad (#300). Bei bereits grandfathertem Stand No-op. */
  unlockAbbrev(id: string) {
    if (this.isAbbrevUnlocked(id)) return;
    this.state.unlockedAbbrev.push(id);
    this.save();
  },

  /** Zählt eine korrekt getippte Langform Richtung „verdiente Abkürzung" (#313).
   *  Ist die Kurzform noch gesperrt, erhöht das ihren Zähler; bei Erreichen von
   *  `ABBREV_EARN_THRESHOLD` wird sie freigeschaltet. Gibt `true` zurück, wenn GENAU
   *  dieser Aufruf sie verdient hat (für die Freischalt-Feier). No-op + `false`,
   *  sobald sie freigeschaltet ist (auch grandfathered `*`). */
  recordAbbrevLongFormUse(id: string): boolean {
    if (this.isAbbrevUnlocked(id)) return false;
    const n = (this.state.abbrevUsage[id] || 0) + 1;
    this.state.abbrevUsage[id] = n;
    if (n >= ABBREV_EARN_THRESHOLD) {
      this.unlockAbbrev(id); // pusht + speichert
      return true;
    }
    this.save();
    return false;
  },

  /* ---------- Befehlshistorie freischalten (#316) ---------- */
  /** Ist die ↑/↓-Befehlshistorie im Funkgerät-Terminal freigeschaltet? */
  isCmdHistoryUnlocked(): boolean {
    return this.state.cmdHistoryUnlocked;
  },

  /** Schaltet die Befehlshistorie frei, sobald genug Befehle getippt wurden
   *  (`CMD_HISTORY_UNLOCK_AT`, Zähler = `stats.commands`). Idempotent; speichert bei der
   *  Freischaltung. Gibt `true` zurück, wenn GENAU dieser Aufruf sie freigeschaltet hat
   *  (für die einmalige Freischalt-Feier), sonst `false`. */
  maybeUnlockCmdHistory(): boolean {
    if (this.state.cmdHistoryUnlocked) return false;
    if ((this.state.stats.commands || 0) < CMD_HISTORY_UNLOCK_AT) return false;
    this.state.cmdHistoryUnlocked = true;
    this.save();
    return true;
  },
});
