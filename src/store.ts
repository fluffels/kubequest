/* ===== KubeQuest – Persistenz-Schicht (SaveStore) =====
 * Eine dünne Schicht zwischen Spiellogik und Speicher. Heute: localStorage.
 *
 * Die Spiellogik (game.js) kennt NUR dieses Interface – read() / write() / remove().
 * Wenn später ein Backend + Datenbank dazukommt (siehe README, Phase 10), wird
 * NUR diese Datei erweitert: localStorage bleibt der schnelle lokale Cache, die
 * Server-Synchronisation kommt hier INTERN dazu. game.js muss dafür nicht
 * angefasst werden – das ist der ganze Sinn dieser Schicht.
 */
  const SAVE_KEY = "kubequest-save-v3";
  // Ein-Slot-Sicherungskopie der Roh-Spielstanddatei. Wird befüllt, BEVOR ein Stand
  // migriert/heruntergestuft/verworfen würde (siehe readState). Damit ist garantiert,
  // dass selbst eine fehlerhafte Migration oder eine kaputte Datei nicht den einzigen
  // vorhandenen Stand vernichtet – er bleibt hier wiederherstellbar (readBackup).
  const BACKUP_KEY = "kubequest-save-backup-v1";

  // localStorage ist nicht überall verfügbar (privater Modus, blockierte Cookies,
  // Node-Tests). Dann fallen wir auf einen flüchtigen In-Memory-Speicher zurück,
  // damit das Spiel weiterläuft – nur eben ohne Speichern über die Sitzung hinaus.
  const backend = (function () {
    try {
      const probe = "__kq_probe__";
      window.localStorage.setItem(probe, probe);
      window.localStorage.removeItem(probe);
      return window.localStorage;
    } catch (e) {
      let mem: Record<string, string> = Object.create(null);
      return {
        getItem: (k: string) => (k in mem ? mem[k] : null),
        setItem: (k: string, v: string) => { mem[k] = String(v); },
        removeItem: (k: string) => { delete mem[k]; },
      };
    }
  })();

  // Schreiben kann auch ZUR LAUFZEIT fehlschlagen, obwohl die Init-Probe oben durchlief:
  // localStorage hat ein Kontingent (meist ~5 MB) – ist es voll, wirft setItem einen
  // QuotaExceededError. Ein echter Nutzer mit wachsendem Stand läuft da irgendwann rein,
  // und der Fehler würde sonst durch den 5-Sekunden-Auto-Save propagieren und das Spiel
  // reißen. Deshalb fängt safeSet jeden Schreibfehler ab, meldet ihn EINMALIG (nicht im
  // 5-s-Takt) und gibt zurück, ob das Schreiben geklappt hat.
  let warnedWriteFailed = false;
  function safeSet(key: string, value: string): boolean {
    try {
      backend.setItem(key, value);
      return true;
    } catch (e) {
      if (!warnedWriteFailed) {
        warnedWriteFailed = true;
        // eslint-disable-next-line no-console
        console.warn("SaveStore: Speichern fehlgeschlagen (localStorage voll/blockiert?) – Spiel läuft weiter, dieser Stand wurde nicht persistiert.", e);
      }
      return false;
    }
  }

  /* ===== Versionierung der Spielstände =====
   * Persistierte Stände tragen ab jetzt eine Hülle: { v: <Format-Version>, data: <Spielstand> }.
   * So überleben alte Stände spätere Formatänderungen: beim Lesen wird die Hülle erkannt
   * und der Inhalt über eine Migrationskette auf die aktuelle Version gehoben.
   *
   * Erweitern bei einer Formatänderung:
   *   1. CURRENT_SAVE_VERSION um 1 erhöhen.
   *   2. Eine Migration migrations[n] ergänzen, die `data` von Version n auf n+1 bringt.
   * Die Kette läuft dann automatisch jede Zwischenstufe der Reihe nach durch.
   */
  export const CURRENT_SAVE_VERSION = 3;

  /** Migration von Format-Version n auf n+1 (reine Funktion auf dem `data`-Objekt). */
  type Migration = (data: unknown) => unknown;

  const migrations: Record<number, Migration> = {
    // 0 -> 1: Alt-Stände lagen ohne Hülle als blanker GameState unter dem Key.
    //         Inhaltlich identisch zum heutigen Format – wir übernehmen ihn unverändert
    //         und packen ihn nur in die neue Versions-Hülle.
    0: (data) => data,
    // 1 -> 2 (#353): Quest-Fortschritt wird zusätzlich als Quest-ID (currentQuestId) statt
    //         nur als Zahl-Index geführt, damit Einfügen/Umsortieren von Quests keinen
    //         Spielstand mehr bricht. Strukturell ein No-op: die Ableitung der ID aus dem
    //         alten questIdx (und das Auflösen ID -> Index) passiert ZENTRAL in
    //         game.ts › sanitizeState, weil sie ALLE Ladewege gleich treffen muss
    //         (localStorage UND der rohe JSON-Import via Game.importData umgeht diese
    //         Migrationskette). Der Versions-Bump sorgt hier dafür, dass jeder bestehende
    //         v1-Stand vor dem ersten Überschreiben in den Backup-Slot gesichert wird
    //         (readState) – kein Spieler verliert beim Update seinen Fortschritt.
    1: (data) => data,
    // 2 -> 3 (#354): Quest-IDs von numerisch (q5, q2b) auf sprechende Slugs umbenannt
    //         (harbor-/k8s-/git-… ). Quest-IDs sind persistiert (completedQuests +
    //         currentQuestId), also remappt die Migration alt -> neu. Wie bei 1->2 strukturell
    //         ein No-op auf store-Ebene: das eigentliche Remapping liegt in game.ts ›
    //         sanitizeState (LEGACY_QUEST_ID_MAP), damit es ALLE Ladewege trifft (auch der
    //         rohe JSON-Import). Der Bump sichert jeden v2-Stand vor dem Überschreiben.
    2: (data) => data,
  };

  /** Hebt `data` von `version` schrittweise auf CURRENT_SAVE_VERSION. */
  function migrate(version: number, data: unknown): unknown {
    let v = version;
    let d = data;
    // Nur hochmigrieren, solange eine passende Migration existiert. Fehlt eine Stufe
    // (Lücke) oder ist der Stand bereits neuer als wir verstehen, brechen wir ab und
    // liefern den besten verfügbaren Stand zurück, statt zu crashen.
    while (v < CURRENT_SAVE_VERSION) {
      const step = migrations[v];
      if (!step) break;
      d = step(d);
      v++;
    }
    return d;
  }

  /** Erkennt die Versions-Hülle { v: number, data: ... }. */
  function isEnvelope(x: unknown): x is { v: number; data: unknown } {
    return (
      typeof x === "object" && x !== null &&
      typeof (x as { v?: unknown }).v === "number" &&
      "data" in (x as object)
    );
  }

  /**
   * Sichert die Roh-Datei in den Backup-Slot, BEVOR der Hauptschlüssel durch einen
   * migrierten/heruntergestuften/frischen Stand überschrieben wird. Best effort:
   * schlägt das Backup-Schreiben fehl (Kontingent voll), läuft das Laden trotzdem
   * weiter – wir wollten nur eine zusätzliche Rettungskopie, kein Muss.
   */
  function backup(raw: string): void {
    safeSet(BACKUP_KEY, raw);
  }

  export const SaveStore = {
    /** Roh-JSON des Spielstands lesen – oder null, wenn noch nichts gespeichert ist. */
    read() {
      return backend.getItem(SAVE_KEY);
    },

    /**
     * Roh-JSON-String des Spielstands ablegen.
     * Gibt zurück, ob das Schreiben geklappt hat (false z.B. bei vollem localStorage) –
     * wirft NIE, damit ein fehlschlagendes Speichern den Aufrufer nicht reißt.
     */
    write(json: string): boolean {
      return safeSet(SAVE_KEY, json);
    },

    /** Spielstand löschen (für „Zurücksetzen"). */
    remove() {
      backend.removeItem(SAVE_KEY);
    },

    /** Roh-JSON der letzten Sicherungskopie lesen – oder null, wenn es keine gibt.
     *  Quelle für eine Wiederherstellung, falls eine Migration einen Stand zerschossen hat. */
    readBackup(): string | null {
      return backend.getItem(BACKUP_KEY);
    },

    /**
     * Spielstand lesen und auf das aktuelle Format migrieren.
     * Liefert das Spielstand-Objekt (NICHT die Versions-Hülle) oder null,
     * wenn nichts gespeichert ist bzw. die Datei kaputt ist (→ frischer Start).
     *
     * Schutz vor Datenverlust: Sobald die gelesene Datei NICHT schon exakt in der
     * aktuellen Version vorliegt – also migriert (Alt-Stand), heruntergestuft
     * (Zukunfts-Version) oder gar nicht parsebar (kaputt) wäre – wird die Original-
     * Rohdatei zuerst in den Backup-Slot kopiert. So überschreibt das anschließende
     * Zurückschreiben in game.ts (load → save) niemals den einzigen Stand unrettbar.
     */
    readState(): unknown | null {
      const raw = backend.getItem(SAVE_KEY);
      if (raw == null) return null;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        backup(raw); // kaputte/halbe Datei sichern, dann frisch starten statt crashen
        return null;
      }
      if (isEnvelope(parsed)) {
        // Schon exakt aktuelle Version? Dann nichts zu sichern (kein unnötiges Verdoppeln).
        // Sonst (älter ODER neuer als wir) zuerst das Original sichern.
        if (parsed.v !== CURRENT_SAVE_VERSION) backup(raw);
        return migrate(parsed.v, parsed.data);
      }
      // Keine Hülle = Alt-Stand der Format-Version 0 → wird migriert, also vorher sichern.
      backup(raw);
      return migrate(0, parsed);
    },

    /**
     * Spielstand in der aktuellen Versions-Hülle ablegen.
     * Gibt zurück, ob das Schreiben geklappt hat (false z.B. bei vollem localStorage) –
     * wirft NIE, damit der Auto-Save den Aufrufer nicht reißt.
     */
    writeState(state: unknown): boolean {
      return safeSet(SAVE_KEY, JSON.stringify({ v: CURRENT_SAVE_VERSION, data: state }));
    },
  };
