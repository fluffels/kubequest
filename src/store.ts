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
  export const CURRENT_SAVE_VERSION = 1;

  /** Migration von Format-Version n auf n+1 (reine Funktion auf dem `data`-Objekt). */
  type Migration = (data: unknown) => unknown;

  const migrations: Record<number, Migration> = {
    // 0 -> 1: Alt-Stände lagen ohne Hülle als blanker GameState unter dem Key.
    //         Inhaltlich identisch zum heutigen Format – wir übernehmen ihn unverändert
    //         und packen ihn nur in die neue Versions-Hülle.
    0: (data) => data,
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

  export const SaveStore = {
    /** Roh-JSON des Spielstands lesen – oder null, wenn noch nichts gespeichert ist. */
    read() {
      return backend.getItem(SAVE_KEY);
    },

    /** Roh-JSON-String des Spielstands ablegen. */
    write(json: string) {
      backend.setItem(SAVE_KEY, json);
    },

    /** Spielstand löschen (für „Zurücksetzen"). */
    remove() {
      backend.removeItem(SAVE_KEY);
    },

    /**
     * Spielstand lesen und auf das aktuelle Format migrieren.
     * Liefert das Spielstand-Objekt (NICHT die Versions-Hülle) oder null,
     * wenn nichts gespeichert ist bzw. die Datei kaputt ist (→ frischer Start).
     */
    readState(): unknown | null {
      const raw = backend.getItem(SAVE_KEY);
      if (raw == null) return null;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return null; // kaputte/halbe Datei: lieber frisch anfangen als crashen
      }
      // Versionierte Hülle? Sonst Alt-Stand ohne Hülle = Format-Version 0.
      return isEnvelope(parsed) ? migrate(parsed.v, parsed.data) : migrate(0, parsed);
    },

    /** Spielstand in der aktuellen Versions-Hülle ablegen. */
    writeState(state: unknown): void {
      backend.setItem(SAVE_KEY, JSON.stringify({ v: CURRENT_SAVE_VERSION, data: state }));
    },
  };

