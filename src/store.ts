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
      let mem = Object.create(null);
      return {
        getItem: k => (k in mem ? mem[k] : null),
        setItem: (k, v) => { mem[k] = String(v); },
        removeItem: k => { delete mem[k]; },
      };
    }
  })();

  export const SaveStore = {
    /** Roh-JSON des Spielstands lesen – oder null, wenn noch nichts gespeichert ist. */
    read() {
      return backend.getItem(SAVE_KEY);
    },

    /** Roh-JSON-String des Spielstands ablegen. */
    write(json) {
      backend.setItem(SAVE_KEY, json);
    },

    /** Spielstand löschen (für „Zurücksetzen"). */
    remove() {
      backend.removeItem(SAVE_KEY);
    },
  };

