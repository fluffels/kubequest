# AGENTS.md – Arbeitsanweisung für KI-Agenten

> Diese Datei ist für dich als Agent (egal welches Tool). Sie sagt dir, **wie** hier gearbeitet wird.
> **Neu hier oder nur kurz reinschauen?** Schnellstart-Checkliste & Repo-Landkarte auf einen Blick: [CLAUDE.md](CLAUDE.md). Diese Datei hier ist die ausführliche Fassung (harte Regeln, Board-Workflow, Konventionen).
> Was das Spiel **ist** (Story, Spielsysteme, Lernpfad), steht in der [README.md](README.md) – nicht doppeln.

## Das Wichtigste zuerst (harte Regeln)

- **Git-Workflow (in kubequest freigegeben).** Hier — und **nur** hier — darf der Agent die komplette Kette selbst fahren: auf eigenem Feature-Branch/Worktree arbeiten → committen → nach `main` mergen → **`main` pushen** → Branch + Worktree aufräumen → Issue schließen. **Push ist hier freigegeben** (seit 2026-06-15) – die komplette Kette inkl. `git push origin main` darf der Agent selbst fahren. Commit-Nachricht trotzdem immer als kopierfertigen Einzeiler im Stil `feat(...): …` mitliefern. ⚠️ Push gilt **nur** für kubequest. ⚠️ In **allen anderen Projekten** bleibt committen/pushen/deployen strikt tabu.
- **Tests müssen grün bleiben.** Nach jeder Änderung `npm test` (Vitest). Bricht etwas, erst reparieren, bevor du weitermachst.
- **Alles wird abgetestet – auch Negativfälle.** Neue/geänderte Logik bekommt Tests, die nicht nur den Happy Path prüfen, sondern auch Fehler-/Grenzfälle (kaputter Zustand, falsche Eingabe, „darf NICHT passieren"). Ziel ist echte Abdeckung der Spiel-/Sim-/Wirtschaftslogik, nicht nur ein grüner Lauf.
- **Tests gegen False Positives absichern (Red-Green).** Ein Test, der auch bei kaputtem Code grün bleibt, ist wertlos. Beim Schreiben kurz beweisen, dass der Test wirklich rot wird, wenn die Logik bricht (Assertion/Implementierung testweise verfälschen → rot sehen → zurücksetzen → grün). **Bei Bugfixes test-first:** erst den fehlschlagenden Repro-Test schreiben (rot), dann fixen (grün) – das beweist gleichzeitig, dass der Test den Bug fängt.
- **Im Browser verifizieren**, nicht nur „sollte gehen". Sicht- oder spielbare Änderungen mit `npm run dev` (oder dem Single-File-Build) tatsächlich anschauen.
- **Deutsch mit echten Umlauten** (ä/ö/ü/ß) in Code-Kommentaren, Dialogen und Texten. Ausnahme: Dateinamen bleiben ASCII (ae/oe/ue/ss).
- **Backlog/TODOs leben in GitHub** (Issues + Project-Board), **nicht** im Code und **nicht** in einem externen Notiz-System. Siehe unten.
- **Doku aktuell halten ist Teil von „fertig".** Die **README** ist die spielerseitige Quelle (Story, Spielsysteme, Steuerung, Lernpfad, **Quest-Zahl**); **CLAUDE.md** trägt die **eine** Datei-für-Datei-Repo-Landkarte. Wer Spielinhalte/Quests/Steuerung ändert, zieht die README im selben PR mit; wer ein `src/`-Modul hinzufügt/umbenennt/verschiebt, aktualisiert die Landkarte in CLAUDE.md. **Die Datei-Landkarte gibt es nur einmal (CLAUDE.md)** – README und AGENTS.md **verweisen** darauf, kopieren sie nicht (genau diese Doppelung hat die README veralten lassen). Die Quest-Zahl in der README wird zusätzlich von [`test/readme.test.ts`](test/readme.test.ts) automatisch gegen den Code geprüft – ändert sich die Quest-Anzahl, schlägt der Test fehl, bis die README stimmt.

## Befehle

| Zweck | Befehl |
|---|---|
| Dev-Server (Hot-Reload) | `npm run dev` → angezeigte Adresse öffnen |
| Offline-Build (eine self-contained `dist/index.html`) | `npm run build` |
| Tests | `npm test` (Vitest) |
| Typen prüfen (ganzes Projekt, voll strict) | `npm run typecheck` |
| Typen prüfen (Alias, identisch zu `typecheck`) | `npm run typecheck:strict` |

Einmalig vorher: `npm install`.

⚠️ **Die rohe `index.html` im Root ist die Dev-Version** und braucht den Vite-Server. Per Doppelklick / statischem Server öffnen liefert `.ts` als falschen MIME-Typ → leere Seite. Zum Offline-Spielen `npm run build` und dann `dist/index.html` doppelklicken.

## Architektur

Vite + TypeScript + ES-Module. `index.html` lädt nur `src/main.ts`, Vite bündelt den Rest. Phaser 3 als npm-Paket. `npm run build` erzeugt via `vite-plugin-singlefile` eine self-contained `dist/index.html` (offline-tauglich).

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
- **PixelLab-Zugriff** läuft über den **PixelLab-MCP-Server** (Subscription „Pixel Apprentice"). Der API-Key rotiert: bei „kein Zugriff" trägt fluffels den neuen Key selbst in die MCP-Config ein, danach funktional mit `get_balance` verifizieren (Key nie im Chat anfordern/ausgeben). Grafik-/Asset-Aufgaben werden — wie der ganze Backlog — als **GitHub-Issues** geführt, nicht im Vault/Notiz-System.
- **Grafik-Stil:** Stardew-angelehnt, 16px, frontale Ansicht (`view: side` für Gebäude, nicht die schräge 2.5D-Sicht). Große Objekte (Häuser, Bäume) in hoher Auflösung generieren und möglichst ganzzahlig skalieren, damit der `pixelArt`-Renderer scharf bleibt.
- **Spielstände** laufen über die SaveStore-Schicht (`store.ts`), localStorage + Auto-Save alle 5 s + JSON-Export/Import. Formatänderungen brauchen perspektivisch ein `version`-Feld + Migration.

## Wo die TODOs leben

Der Backlog wird als **GitHub Issues** geführt, gruppiert in einem **GitHub Project-Board** (Kanban). Prioritäten als Labels: `prio:hoch` 🔴 / `prio:mittel` 🟠 / `prio:niedrig` 🟡.

Beim Weitermachen: offene Issues nach Priorität abarbeiten, nach jedem Punkt `npm test` grün halten + im Browser verifizieren, dann das Issue schließen.

**Kollisionsschutz bei parallelen Agenten (mehrere Chats gleichzeitig).** Jedes Ticket wird auf einem eigenen Branch + Worktree bearbeitet (`git worktree add -b <typ>/<nr>-<slug> ../kubequest-wt-<nr> main`). Damit sich zwei Agenten nicht dasselbe Ticket greifen:
- **Nur Issues ohne Assignee greifen.** Vor der Auswahl prüfen: `gh issue list --json number,title,assignees` (zusätzlich `git worktree list` + `git branch -a` als Gegencheck).
- **Beim Start sofort self-assignen:** `gh issue edit <nr> --add-assignee @me`. Das ist der „in Arbeit"-Marker, den jeder andere Chat sieht — der einzige Zustand, den ein paralleler Agent sonst nicht erkennen kann (ein nur „im Kopf" gewähltes Ticket ohne Branch ist unsichtbar).
- Am Ende: nach `main` mergen, Worktree entfernen (`git worktree remove`), Branch löschen, Issue schließen (schließt den Assignee implizit mit ab).

**Der Agent managt das Board (nur kubequest).** fluffels hat die Issue-Verwaltung hier an den Agenten delegiert. Das heißt konkret:
- **GitHub ist die Single Source of Truth für den Stand.** Was erledigt ist, wird sofort dort geschlossen (mit kurzem Ergebnis-Kommentar) – nicht nur im Chat berichten. Den Board-Status aktuell halten.
- **Selbst Issues verwalten** ohne Rückfrage: `gh issue close`, kommentieren, Labels setzen, **neue Tickets schreiben, wenn etwas auffällt** (Bug, Lücke, Tech-Debt, Idee). Lieber ein Ticket zu viel als verlorenes Wissen.
- **Der Agent priorisiert.** Reihenfolge der Arbeit selbst festlegen (prio-Labels pflegen) und proaktiv die nächste Aufgabe vorschlagen/starten.
- **Git ist hier freigegeben** (anders als sonst): committen → nach `main` mergen → Branch/Worktree aufräumen → Issue schließen darf der Agent selbst, siehe Git-Workflow oben. **Push bleibt fluffelss Job**, außer sie sagt ausdrücklich „und pushen". Issues erst schließen, wenn die Arbeit fertig + getestet (`npm test` grün) + im Browser verifiziert ist; falls ihr Review später was findet, einfach wieder aufmachen.

Issues ansehen: `gh issue list`. Board: `gh project list --owner fluffels`.
