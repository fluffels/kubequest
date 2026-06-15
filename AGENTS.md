# AGENTS.md – Arbeitsanweisung für KI-Agenten

> Diese Datei ist für dich als Agent (egal welches Tool). Sie sagt dir, **wie** hier gearbeitet wird.
> Was das Spiel **ist** (Story, Spielsysteme, Lernpfad), steht in der [README.md](README.md) – nicht doppeln.

## Das Wichtigste zuerst (harte Regeln)

- **NIE committen, pushen, deployen.** Katharina committet immer selbst. Du änderst nur Code/Dateien und lieferst die Commit-Nachricht als kopierfertigen Einzeiler mit (`feat(...): …`).
- **Tests müssen grün bleiben.** Nach jeder Änderung `npm test` (Vitest). Bricht etwas, erst reparieren, bevor du weitermachst.
- **Alles wird abgetestet – auch Negativfälle.** Neue/geänderte Logik bekommt Tests, die nicht nur den Happy Path prüfen, sondern auch Fehler-/Grenzfälle (kaputter Zustand, falsche Eingabe, „darf NICHT passieren"). Ziel ist echte Abdeckung der Spiel-/Sim-/Wirtschaftslogik, nicht nur ein grüner Lauf.
- **Tests gegen False Positives absichern (Red-Green).** Ein Test, der auch bei kaputtem Code grün bleibt, ist wertlos. Beim Schreiben kurz beweisen, dass der Test wirklich rot wird, wenn die Logik bricht (Assertion/Implementierung testweise verfälschen → rot sehen → zurücksetzen → grün). **Bei Bugfixes test-first:** erst den fehlschlagenden Repro-Test schreiben (rot), dann fixen (grün) – das beweist gleichzeitig, dass der Test den Bug fängt.
- **Im Browser verifizieren**, nicht nur „sollte gehen". Sicht- oder spielbare Änderungen mit `npm run dev` (oder dem Single-File-Build) tatsächlich anschauen.
- **Deutsch mit echten Umlauten** (ä/ö/ü/ß) in Code-Kommentaren, Dialogen und Texten. Ausnahme: Dateinamen bleiben ASCII (ae/oe/ue/ss).
- **Backlog/TODOs leben in GitHub** (Issues + Project-Board), **nicht** im Code und **nicht** in einem externen Notiz-System. Siehe unten.

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

**Schichtung** – pure Domäne ↔ Anwendung ↔ Präsentation, Persistenz entkoppelt:

| Modul (`src/`) | Rolle |
|---|---|
| `sim.ts` | Cluster-Simulator (docker, kubectl, helm, terraform, secrets, git) – pure Domäne |
| `content.ts` | Quests, Dialoge, Drills, NPCs, Karteikarten, Minispiel – pure Domäne |
| `types.ts` | Zentrale Typen (GameState, Quest, …) |
| `game.ts` | Spielstand, XP, Wirtschaft, Spaced Repetition – Anwendung |
| `store.ts` | SaveStore-Persistenz (kapselt localStorage; Andockpunkt fürs spätere Backend) |
| `scenes.ts` | Phaser-Welt: Karte, Cluster-Sync, Piraten, Krake – Präsentation |
| `ui.ts` | Dialoge, Funkgerät, Shop, Quiz, Minispiel – Präsentation |
| `sfx.ts` | WebAudio-Sounds (synthetisiert, keine Audio-Dateien) |
| `main.ts` | Start & Tastatur (Einstiegspunkt) |
| `assets-data.ts` | Spritesheets als Base64 (hält den Offline-Build self-contained) |
| `vite-env.d.ts` | Typ-Deklarationen (u.a. window-Shim für Inline-Handler) |

Tests in `test/`: `sim.test.ts` (Simulator-Units inkl. Troubleshooting), `content.test.ts` (Konsistenz aller Inhalte), `quests.test.ts` (spielt die ganze Story + alle Drills durch).

## Konventionen

- **TS-Strenge (Ratchet abgeschlossen).** Die Basis-`tsconfig.json` steht auf `"strict": true` und deckt das **ganze Projekt** ab: alle `src`-Module (inkl. `scenes`, `ui`, `main`, `sfx`), die Tests und `vite.config`. Echte Param-/Feld-Typen statt `any`, durchgängige Null-Prüfung; die Cluster-Interfaces Pod/Deployment/Service … leben in `src/sim.ts`. `tsconfig.strict.json` ist nur noch ein Alias auf die Basis. **Neuer/geänderter Code muss strict-tauglich bleiben** – `npm run typecheck` muss grün sein.
- **PixelLab-Grafik doppelt ablegen:** Quell-PNG nach `assets/pixellab/` **und** Base64 in `src/assets-data.ts` (damit der Single-File-Build self-contained bleibt). Asset-Liste + IDs: `assets/pixellab/README.md`.
- **PixelLab-Zugriff** läuft über den **PixelLab-MCP-Server** (Subscription „Pixel Apprentice"). Der API-Key rotiert: bei „kein Zugriff" trägt Katharina den neuen Key selbst in die MCP-Config ein, danach funktional mit `get_balance` verifizieren (Key nie im Chat anfordern/ausgeben). Grafik-/Asset-Aufgaben werden — wie der ganze Backlog — als **GitHub-Issues** geführt, nicht im Vault/Notiz-System.
- **Grafik-Stil:** Stardew-angelehnt, 16px, frontale Ansicht (`view: side` für Gebäude, nicht die schräge 2.5D-Sicht). Große Objekte (Häuser, Bäume) in hoher Auflösung generieren und möglichst ganzzahlig skalieren, damit der `pixelArt`-Renderer scharf bleibt.
- **Spielstände** laufen über die SaveStore-Schicht (`store.ts`), localStorage + Auto-Save alle 5 s + JSON-Export/Import. Formatänderungen brauchen perspektivisch ein `version`-Feld + Migration.

## Wo die TODOs leben

Der Backlog wird als **GitHub Issues** geführt, gruppiert in einem **GitHub Project-Board** (Kanban). Prioritäten als Labels: `prio:hoch` 🔴 / `prio:mittel` 🟠 / `prio:niedrig` 🟡.

Beim Weitermachen: offene Issues nach Priorität abarbeiten, nach jedem Punkt `npm test` grün halten + im Browser verifizieren, dann das Issue schließen.

**Der Agent managt das Board (nur kubequest).** Katharina hat die Issue-Verwaltung hier an den Agenten delegiert. Das heißt konkret:
- **GitHub ist die Single Source of Truth für den Stand.** Was erledigt ist, wird sofort dort geschlossen (mit kurzem Ergebnis-Kommentar) – nicht nur im Chat berichten. Den Board-Status aktuell halten.
- **Selbst Issues verwalten** ohne Rückfrage: `gh issue close`, kommentieren, Labels setzen, **neue Tickets schreiben, wenn etwas auffällt** (Bug, Lücke, Tech-Debt, Idee). Lieber ein Ticket zu viel als verlorenes Wissen.
- **Der Agent priorisiert.** Reihenfolge der Arbeit selbst festlegen (prio-Labels pflegen) und proaktiv die nächste Aufgabe vorschlagen/starten.
- **Grenze:** Issue-Management ist die einzige nach außen wirkende Aktion, die freigegeben ist — **committen/pushen/deployen bleibt auch hier tabu** (siehe harte Regeln oben, macht Katharina selbst). Da Code uncommitted bleibt: Issues ruhig als erledigt schließen, wenn die Arbeit im Working Tree fertig + getestet ist; falls ihr Review noch was findet, einfach wieder aufmachen.

Issues ansehen: `gh issue list`. Board: `gh project list --owner eckekat`.
