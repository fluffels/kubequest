# AGENTS.md – Arbeitsanweisung für KI-Agenten

> Diese Datei ist für dich als Agent (egal welches Tool). Sie sagt dir, **wie** hier gearbeitet wird.
> **Neu hier oder nur kurz reinschauen?** Schnellstart-Checkliste & Repo-Landkarte auf einen Blick: [CLAUDE.md](CLAUDE.md). Diese Datei hier ist die ausführliche Fassung (harte Regeln, Board-Workflow, Konventionen).
> Was das Spiel **ist** (Story, Spielsysteme, Lernpfad), steht in der [README.md](README.md) – nicht doppeln.

## Das Wichtigste zuerst (harte Regeln)

- **Git-Workflow (in kubequest freigegeben).** Hier — und **nur** hier — darf der Agent die komplette Kette selbst fahren: auf eigenem Feature-Branch/Worktree arbeiten → committen → nach `main` mergen → **`main` pushen** → Branch + Worktree aufräumen → Issue schließen. **Push ist hier freigegeben** (seit 2026-06-15) – die komplette Kette inkl. `git push origin main` darf der Agent selbst fahren. Commit-Nachricht trotzdem immer als kopierfertigen Einzeiler im Stil `feat(...): …` mitliefern. ⚠️ Push gilt **nur** für kubequest. ⚠️ In **allen anderen Projekten** bleibt committen/pushen/deployen strikt tabu.
- **Anonymität wahren (öffentliches Repo).** Dieses Repo ist bewusst anonym. Es darf **kein Klarname (Vor-/Nachname), kein früherer/externer Benutzername und keine dienstliche oder private E-Mail-Adresse** der Maintainerin in Dateien, Commit-Nachrichten oder Commit-Metadaten auftauchen. Committe **immer** unter der bereits gesetzten lokalen Git-Identität (`fluffels` + zugehörige GitHub-noreply-Mail) – die lokale Repo-Config nicht überschreiben und **nicht** auf eine globale Identität ausweichen. Wo sonst eine Person genannt würde, neutral „die Maintainerin" schreiben.
- **Tests müssen grün bleiben.** Nach jeder Änderung `npm test` (Vitest). Bricht etwas, erst reparieren, bevor du weitermachst.
- **Alles wird abgetestet – auch Negativfälle.** Neue/geänderte Logik bekommt Tests, die nicht nur den Happy Path prüfen, sondern auch Fehler-/Grenzfälle (kaputter Zustand, falsche Eingabe, „darf NICHT passieren"). Ziel ist echte Abdeckung der Spiel-/Sim-/Wirtschaftslogik, nicht nur ein grüner Lauf.
- **Tests gegen False Positives absichern (Red-Green).** Ein Test, der auch bei kaputtem Code grün bleibt, ist wertlos. Beim Schreiben kurz beweisen, dass der Test wirklich rot wird, wenn die Logik bricht (Assertion/Implementierung testweise verfälschen → rot sehen → zurücksetzen → grün). **Bei Bugfixes test-first:** erst den fehlschlagenden Repro-Test schreiben (rot), dann fixen (grün) – das beweist gleichzeitig, dass der Test den Bug fängt.
- **Im Browser verifizieren**, nicht nur „sollte gehen". Sicht- oder spielbare Änderungen mit `npm run dev` (oder dem Single-File-Build) tatsächlich anschauen. *Tipp fürs Verifizieren per Preview-/Headless-Browser:* im Dev-Build hängt die laufende Phaser-Instanz unter `window.kqGame` (nur `import.meta.env.DEV`, im Prod-Build rausgestrippt) – damit lassen sich Szenen/Position gezielt setzen (`kqGame.scene.get("World").playerPos`, `kqGame.scene.run("Archipel")`), statt blind Tasten zu schicken. Manche Preview-Tools drosseln Timer im Hintergrund und verlieren die Server-Registrierung bei Reload/Navigation – dann Screenshot als *erste* Aktion nach frischem Start machen und hängende Tasten vorher per `keyup`-Event lösen.
- **Deutsch mit echten Umlauten** (ä/ö/ü/ß) in Code-Kommentaren, Dialogen und Texten. Ausnahme: Dateinamen bleiben ASCII (ae/oe/ue/ss).
- **Backlog/TODOs leben in GitHub** (Issues + Project-Board), **nicht** im Code und **nicht** in einem externen Notiz-System. Siehe unten.
- **Doku aktuell halten ist Teil von „fertig".** Die **README** ist die spielerseitige Quelle (Story, Spielsysteme, Steuerung, Lernpfad, **Quest-Zahl**); **CLAUDE.md** trägt die **eine** Datei-für-Datei-Repo-Landkarte. Wer Spielinhalte/Quests/Steuerung ändert, zieht die README im selben PR mit; wer ein `src/`-Modul hinzufügt/umbenennt/verschiebt, aktualisiert die Landkarte in CLAUDE.md. **Die Datei-Landkarte gibt es nur einmal (CLAUDE.md)** – README und AGENTS.md **verweisen** darauf, kopieren sie nicht (genau diese Doppelung hat die README veralten lassen). Die Quest-Zahl in der README wird zusätzlich von [`test/readme.test.ts`](test/readme.test.ts) automatisch gegen den Code geprüft – ändert sich die Quest-Anzahl, schlägt der Test fehl, bis die README stimmt.

## Befehle

| Zweck | Befehl |
|---|---|
| Dev-Server (Hot-Reload) | `npm run dev` → angezeigte Adresse öffnen |
| Host-/Prod-Build (Multi-File nach `dist/`, zum Ausliefern) | `npm run build` |
| Offline-Build (eine self-contained `dist-offline/index.html`) | `npm run build:offline` |
| Tests | `npm test` (Vitest) |
| Typen prüfen (ganzes Projekt, voll strict) | `npm run typecheck` |
| Typen prüfen (Alias, identisch zu `typecheck`) | `npm run typecheck:strict` |

Einmalig vorher: `npm install`.

⚠️ **Die rohe `index.html` im Root ist die Dev-Version** und braucht den Vite-Server. Per Doppelklick / statischem Server öffnen liefert `.ts` als falschen MIME-Typ → leere Seite. Zum Offline-Spielen `npm run build:offline` und dann `dist-offline/index.html` doppelklicken.

## Architektur

Vite + TypeScript + ES-Module. `index.html` lädt nur `src/main.ts`, Vite bündelt den Rest. Phaser 3 als npm-Paket. **Zwei Build-Wege aus derselben Quelle** (Ticket #58, konfiguriert in [`vite.config.ts`](vite.config.ts) über den Vite-`mode`): `npm run build` ist der normale Multi-File-Host-Build nach `dist/` (Assets als eigene, einzeln cachebare Dateien – zum Ausliefern über einen Webserver); `npm run build:offline` (`vite build --mode offline`) erzeugt via `vite-plugin-singlefile` eine self-contained `dist-offline/index.html` (alle Assets inline als Data-URI – das Doppelklick-Offline-Feature). Das Single-File-Plugin ist bewusst **nur** im Offline-Mode aktiv, sonst wäre auch der Host-Build wieder eager-inline.

**Warum Phaser 3 (und nicht Godot/Unity/MonoGame)?** Bewusst festgehalten als ADR: [`docs/adr/0001-engine-phaser.md`](docs/adr/0001-engine-phaser.md). Kurz: Phaser bedient den Kern-Wert (offline, eine Datei, verschenkbar, Lern-Tool); ein Engine-Wechsel wäre ein kompletter Rewrite für marginalen Gewinn. Native Distribution kommt über einen Wrapper (#83 Tauri), nicht über einen Engine-Wechsel. Re-Evaluierungs-Trigger stehen im ADR. **Vor erneuter „Engine wechseln?"-Diskussion bitte dorthin verweisen.**

**Warum kein Multiplayer/Co-op?** Bewusst festgehalten als ADR: [`docs/adr/0003-multiplayer-coop-out-of-scope.md`](docs/adr/0003-multiplayer-coop-out-of-scope.md). Kurz: KubeQuest bleibt Single-Player – Co-op erzwingt den Backend-Stack (Server/Netcode/DB), den wir bewusst nicht bauen (#85), und bricht den Offline-eine-Datei-Wert; der Lern-Kern ist solo. Architektur nicht dafür verbauen, aber auch nichts proaktiv dafür bauen. **Vor erneuter „Sollten wir Co-op machen?"-Diskussion bitte dorthin verweisen.**

**Schichtung** – pure Domäne ↔ Anwendung ↔ Präsentation, Persistenz entkoppelt. Leitidee: Die Spiellogik bleibt **Phaser-frei und damit im Node-Test prüfbar**; nur `scenes.ts`/`ui.ts` fassen Phaser bzw. das DOM an. Deshalb liegen z.B. Welt-Geometrie (`world.ts`), Deko-Platzierung (`decor.ts`) und HUD-Uhr (`clock.ts`) bewusst **außerhalb** von `scenes.ts`.

- **pure Domäne** (kein Phaser, voll unit-testbar): `sim.ts` (Cluster-Simulator), `content.ts` (Fassade über `src/content/*`: Quests/Drills/Quiz/NPCs/Progression/Minispiel), `world.ts`, `decor.ts`, `clock.ts`.
- **Anwendung:** `game.ts` (Spielstand, XP, Wirtschaft, Spaced Repetition), `runtime.ts` (Laufzeit-Singletons statt globalem `window`-Shim, bricht Import-Zyklen).
- **Persistenz:** `store.ts` (SaveStore über localStorage; Andockpunkt fürs spätere Backend).
- **Präsentation** (Phaser/DOM): `scenes.ts`, `ui.ts`, `sfx.ts`.
- **Einstieg/Assets:** `main.ts` (Start & Tastatur), `assets-data.ts` (Spritesheet-`import`s, im Single-File-Build als Data-URI inlinet).

> Welches Modul genau was macht (mit Links), steht **einmal** in der [CLAUDE.md › Repo-Landkarte](CLAUDE.md) – hier steht nur das *Warum* der Schichtung, nicht die Dateiliste.

Tests in `test/` (Vitest), u.a.: `sim.test.ts` (Simulator inkl. Troubleshooting), `content.test.ts` (Konsistenz aller Inhalte), `quests.test.ts` (spielt die ganze Story + alle Drills durch), `readme.test.ts` (Doku-Sync: Quest-Zahl der README gegen den Code).

## Konventionen

- **TS-Strenge (Ratchet abgeschlossen).** Die Basis-`tsconfig.json` steht auf `"strict": true` und deckt das **ganze Projekt** ab: alle `src`-Module (inkl. `scenes`, `ui`, `main`, `sfx`), die Tests und `vite.config`. Echte Param-/Feld-Typen statt `any`, durchgängige Null-Prüfung; die Cluster-Interfaces Pod/Deployment/Service … leben in `src/sim.ts`. `tsconfig.strict.json` ist nur noch ein Alias auf die Basis. **Neuer/geänderter Code muss strict-tauglich bleiben** – `npm run typecheck` muss grün sein.
- **PixelLab-Grafik ablegen:** Quell-PNG nach `assets/pixellab/`, dann in `src/assets-data.ts` per `import` einbinden und ins `KQAssets`-Objekt aufnehmen (Vite inlinet es im Single-File-Build automatisch als Data-URI – kein handgepflegtes Base64 mehr). Asset-Liste + IDs: `assets/pixellab/README.md`.
- **PixelLab-Zugriff** läuft über den **PixelLab-MCP-Server** (Subscription „Pixel Apprentice"). Der API-Key rotiert: bei „kein Zugriff" trägt die Maintainerin den neuen Key selbst in die MCP-Config ein, danach funktional mit `get_balance` verifizieren (Key nie im Chat anfordern/ausgeben). Grafik-/Asset-Aufgaben werden — wie der ganze Backlog — als **GitHub-Issues** geführt, nicht im Vault/Notiz-System.
- **Grafik-Stil – Stardew-Look als verbindliche Messlatte (Nordstern, #44).** Das Spiel-Thema bleibt unser eigenes (DevOps/K8s-Hafen), aber **Qualität, Genauigkeit und Politur auf Stardew-Niveau** sind der verbindliche Maßstab für jede neue oder geänderte Grafik. Der Stardew-Look entsteht **nicht** aus einer bestimmten Rastergröße, sondern aus *Einheitlichkeit* + *ganzzahliger Skalierung*. Konkret prüfbar (das ist die „Messlatte" fürs Audit):
  - **Einheitliche Pixeldichte:** alles auf demselben **16px-Raster** gezeichnet (Tiles 16×16, Figuren auf den etablierten 32²/48²-Canvas mit gleicher Körperhöhe/Fußlinie). **Kein gemischtes Auflösungs-Niveau** – fein detaillierte Assets direkt neben grob gerasterten wirken sofort „nicht Stardew".
  - **Ganzzahlige Skalierung:** nur ×2/×3/×4 usw., **nie 1.5×/2.3×** – krumme Faktoren matschen die Kanten, der `pixelArt`-Renderer braucht ganze Pixel.
  - **Frontale Ansicht** (`view: side`) als Default; die schräge 2.5D-Sicht nur dort, wo sie bewusst etabliert ist (Gebäude via `building()`), siehe offene Stil-Entscheidung #181 im Audit.
  - **Kohärente Palette:** gedämpfte, warme Stardew-nahe Farbwelt statt grell/neon, einheitliche Licht-/Schattenrichtung.
  - **Keine simpel-prozeduralen Platzhalter dort, wo ein Asset hingehört:** code-gezeichnete Primitive (Dreieck-Grashalme, mit `graphics` gemalte Gegner/Boote) sind nur Übergangslösung und bekommen ein Asset-Ticket. *Dynamische Effekte* (rotierender Leuchtturm-Lichtkegel, Schatten/Glow, Tag-Nacht-Schleier) sind **kein** Platzhalter und bleiben bewusst Code.
  - **Hoch auflösen, dann ganzzahlig verkleinern:** große Objekte (Häuser, Bäume, Schiff) in hoher Auflösung generieren (PixelLab-Abo Tier 1 erlaubt große Bilder) statt klein erzeugen + hochskalieren, damit der Renderer scharf bleibt.

  **Voraussetzung für neue Optik-Tickets:** Vor jedem Optik-Ticket die **echte Stardew-Referenz** lesen, statt zu raten — [`docs/stardew-referenz.md`](docs/stardew-referenz.md) (Raster, Palette, Outlines, Gras/Boden, PixelLab-Prompt-Bausteine, „Ist es Stardew-Niveau?"-Checkliste; #106). Lebende Abweichungsliste (Audit gegen diese Messlatte, je Bereich): [`docs/art-direction-audit.md`](docs/art-direction-audit.md). PixelLab-Workflow (Ablegen/Einbinden) siehe oben + `assets/pixellab/README.md`.
- **Spielstände** laufen über die SaveStore-Schicht (`store.ts`), localStorage + Auto-Save alle 5 s + JSON-Export/Import. Formatänderungen brauchen perspektivisch ein `version`-Feld + Migration.

## Wo die TODOs leben

Der Backlog wird als **GitHub Issues** geführt, gruppiert in einem **GitHub Project-Board** (Kanban). Prioritäten als Labels: `prio:hoch` 🔴 / `prio:mittel` 🟠 / `prio:niedrig` 🟡. **Die `prio:`-Labels steuern die Auswahlreihenfolge:** erst alle `prio:hoch`, dann `prio:mittel`, dann `prio:niedrig` (Issues **ohne** prio-Label kommen ganz zuletzt) – **innerhalb derselben Stufe** entscheidet die niedrigste Nummer.

**Auswahl des nächsten Tickets – schnell und deterministisch, NICHT lange suchen, NICHT abwägen.** Sortiere die **freien** Issues (nicht assigned, kein offener PR/Branch/Worktree, kein „in progress") nach **Priorität zuerst** (`prio:hoch` → `prio:mittel` → `prio:niedrig` → ohne prio-Label) und **innerhalb derselben Priorität nach NIEDRIGSTER Nummer** – nimm das oberste. Ist es schon geclaimt, nimm das nächste nach derselben Sortierung. Das bleibt **deterministisch und ohne inhaltliches Abwägen**: nur prio-Label + Nummer entscheiden, **nicht der Inhalt** des Tickets. Nach jedem Ticket `npm test` + `npm run typecheck` grün halten + im Browser verifizieren, dann das Issue schließen.

**Kollisionsschutz bei parallelen Agenten (mehrere Chats gleichzeitig).** Jedes Ticket wird auf einem eigenen Branch + Worktree bearbeitet (`git worktree add -b <typ>/<nr>-<slug> ../kubequest-wt-<nr> main`). Damit sich zwei Agenten nicht dasselbe Ticket greifen:
- **Nur Issues ohne Assignee greifen.** Vor der Auswahl prüfen: `gh issue list --json number,title,assignees,labels` (zusätzlich `git worktree list` + `git branch -a` als Gegencheck). Die `labels` brauchst du für die Prio-Sortierung (siehe oben).
- **Beim Start sofort self-assignen:** `gh issue edit <nr> --add-assignee @me`. Das ist der „in Arbeit"-Marker, den jeder andere Chat sieht — der einzige Zustand, den ein paralleler Agent sonst nicht erkennen kann (ein nur „im Kopf" gewähltes Ticket ohne Branch ist unsichtbar).
- Am Ende: nach `main` mergen, Worktree entfernen (`git worktree remove`), Branch löschen, Issue schließen (schließt den Assignee implizit mit ab).
- **`node_modules` im Worktree:** Im frischen Worktree fehlt `node_modules`. Lass dort einfach einmal `npm install` laufen (ist gitignored, eigener Stand pro Worktree). ⚠️ **Verlinke NICHT** das `node_modules` des Hauptrepos per Junction/Symlink (`mklink /J`, `ln -s`): `git worktree remove --force` folgt dem Link rekursiv und **leert dann die echten `node_modules` des Hauptrepos** (musste schon mit `npm install` repariert werden). Wer trotzdem verlinkt, **muss die Junction zwingend VOR** `git worktree remove` lösen (`cmd /c rmdir <pfad>\node_modules` bzw. `rm node_modules` – das löscht nur den Link, nicht das Ziel).

**Der Agent managt das Board (nur kubequest).** Die Maintainerin hat die Issue-Verwaltung hier an den Agenten delegiert. Das heißt konkret:
- **GitHub ist die Single Source of Truth für den Stand.** Was erledigt ist, wird sofort dort geschlossen (mit kurzem Ergebnis-Kommentar) – nicht nur im Chat berichten. Den Board-Status aktuell halten.
- **Selbst Issues verwalten** ohne Rückfrage: `gh issue close`, kommentieren, Labels setzen, **neue Tickets schreiben, wenn etwas auffällt** (Bug, Lücke, Tech-Debt, Idee). Lieber ein Ticket zu viel als verlorenes Wissen.
- **Zu großes Ticket (Epic/Phase) → aufteilen statt umsetzen.** Ist ein geclaimtes Issue ein Epic / eine ganze Phase / „Far-Future" und nicht in EINER Session vollständig umsetz- und schließbar (z.B. „Phase 4: GitOps-Archipel"): **nicht selbst implementieren.** Stattdessen in **viele konkrete, session-große Kindertickets** zerlegen und anlegen (jeweils **ohne Assignee** — der Assignee ist der „in Arbeit"-Marker, neue Tickets sind frei; passende `area:`/`prio:`-Labels setzen), im Epic einen **Übersichts-Kommentar** mit den Kindernummern + sinnvoller Reihenfolge posten und das Epic dann **auf done schließen** (`gh issue close <nr> --reason completed`, **nicht löschen** — der Datensatz bleibt als erledigtes Aufteilungs-Ticket). Kein Worktree/Branch/Merge nötig (kein Code).
- **Auswahlreihenfolge ist fix, nicht Ermessen.** Das nächste Ticket ergibt sich immer aus der festen Sortierung *Priorität (`hoch` → `mittel` → `niedrig` → ohne) und dann niedrigste Nummer* (siehe oben) – der Agent wägt nicht ab und sucht nicht nach Inhalt aus. Damit ist eindeutig bestimmt, welches Ticket „dran" ist; der Agent labelt und pflegt das Board weiterhin (neue Tickets schreiben, labeln, schließen) – und das prio-Label ist jetzt genau der Hebel, der die Reihenfolge steuert.
- **Git ist hier voll freigegeben** (anders als sonst): committen → nach `main` mergen → **`git push origin main`** → Branch/Worktree aufräumen → Issue schließen darf der Agent in kubequest komplett selbst fahren — **Push inklusive, ohne Extra-Nachfrage**. ⚠️ Das gilt **nur für kubequest**; in **allen anderen Projekten** bleibt committen/pushen/deployen strikt tabu. Issues erst schließen, wenn die Arbeit fertig + getestet (`npm test` grün) + im Browser verifiziert ist; falls ihr Review später was findet, einfach wieder aufmachen.

Issues ansehen: `gh issue list`. Board: `gh project list --owner fluffels`.
