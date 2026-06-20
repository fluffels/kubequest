# Tiefendoc: Anwendung, Persistenz, Typen & Einstieg

> On-demand-Detail zur Anwendungs-/Persistenz-Schicht. Der schlanke Always-Index steht in [CLAUDE.md](../../CLAUDE.md). Pfade sind repo-relativ als Inline-Code.

| Modul | Schicht | Inhalt |
|---|---|---|
| `src/main.ts` | Einstieg | Start & Tastatursteuerung; registriert die Szenen (`KQScenes`) und ruft beim Boot `await SaveStore.init()` vor `Game.load()`. |
| `src/types.ts` | Typen | Zentrale Typen (GameState, Quest, …). (Die Cluster-Ressourcen-Typen liegen dagegen in `src/sim/state.ts`, siehe [sim.md](sim.md).) |
| `src/game.ts` | Anwendung | Spielstand, XP, Wirtschaft, Spaced Repetition. **`sanitizeState`** härtet kaputte/fehlende Felder gegen die Defaults ab (auch Migration alter Index-Stände → `currentQuestId`). `LEGACY_QUEST_ID_MAP` mappt umbenannte Quest-IDs. ⚠️ Aufteilung geplant (#392) — dabei Saves/`sanitizeState`/Migration penibel grün halten. |
| `src/runtime.ts` | Anwendung | Laufzeit-Singletons (ersetzt den früheren `window`-Shim; bricht Import-Zyklen). |
| `src/devpanel.ts` | Anwendung | Dev-/Test-Panel (#325): klickbares Panel zum Springen auf beliebigen Quest-Stand (Jump-API #329), Erststart und Reset — nur aktiv wenn `__KQ_DEVPANEL__` true (Devpanel-Build #331); Phaser-frei, DOM-Anbindung in `ui.ts`. |
| `src/store.ts` | Persistenz | **SaveStore** — siehe unten. |

## SaveStore / Persistenz (#350)

`src/store.ts` ist die SaveStore-Schicht: seit #350 **IndexedDB** als unbegrenztes Backend (localStorage/In-Memory als Fallback), Versions-Hülle `{v,data}` + Migrationskette + Backup-Slot. Damit ist das 5–10 MB-localStorage-Limit bei Stardew-Scale-Spielständen aufgehoben.

- **IndexedDB ist async, die SaveStore-API bleibt aber synchron:** ein In-Memory-Cache wird beim Boot via `await SaveStore.init()` (in `main.ts` vor `Game.load()`) aus IndexedDB hydriert; Schreibvorgänge spiegeln async dorthin. Darum musste **kein Aufrufer** auf async umgestellt werden.
- **Storage-Migration statt Versions-Bump:** der Umzug localStorage→IndexedDB hat das **Format nicht geändert** (gleiche `{v,data}`-Hülle), nur den Speicherort. Daher kein `version`-Bump, sondern eine einmalige Storage-Migration in `SaveStore.init()` (alter localStorage-Stand wird beim ersten Start nach IndexedDB gehoben). Ohne IndexedDB (privat/`file:///`/alt) bleibt der synchrone localStorage-Modus aktiv.
- **Format-Version:** aktuell `CURRENT_SAVE_VERSION = 3`. Auto-Save alle 5 s + JSON-Export/Import.

> **Grundregel:** Was live (auf `main`) geht, darf NIE einen bestehenden Spielstand brechen — jede Format-Änderung migrieren (Versions-Bump + Migrationskette in `store.ts`, mit echtem Alt-Stand testen). Quest-Fortschritt persistiert seit #353 per **Quest-ID** (`currentQuestId`), nicht per Zahl-Index. Details siehe [AGENTS.md › Spielstände](../../AGENTS.md).
