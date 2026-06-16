# CLAUDE.md – Einstieg für KI-Agenten

> **Du bist ein Agent in diesem Repo? Hier findest du auf einen Blick alles zum Loslegen.**
> Die **ausführliche Arbeitsanweisung** (harte Regeln, Board-Workflow, Konventionen) steht in **[AGENTS.md](AGENTS.md)** – diese Datei ist der schnelle Einstieg, der dorthin führt.
> Was das Spiel **ist** (Story, Steuerung, Lernpfad), steht in der **[README.md](README.md)** – die ist spielerseitig, nicht für dich als Agent.

## ⚡ Schnellstart (in <1 Minute zum ersten Schritt)

```
1. npm install                              # einmalig
2. npm run dev                              # Dev-Server, angezeigte Adresse im Browser öffnen
3. Freies Ticket wählen                     # niedrigste freie Nummer (nicht assigned), NICHT nach Inhalt/prio aussuchen
4. gh issue edit <nr> --add-assignee @me    # SOFORT claimen = "in Arbeit"-Marker, dann mit gh issue view <nr> prüfen
5. git worktree add .claude/worktrees/kq-<nr> -b feature/kq-<nr>-<slug>   # eigener Worktree, bevor du Dateien anfasst
6. coden                                    # im Worktree umsetzen, deutsche Umlaute in Texten/Kommentaren
7. npm test                                 # muss grün sein (auch Negativfälle abdecken, Red-Green)
8. npm run typecheck                        # muss grün sein (strict)
9. im Browser verifizieren                  # sichtbare Änderungen wirklich anschauen
10. nach main mergen → Worktree/Branch aufräumen → Issue schließen   # Details siehe AGENTS.md
```

⚠️ **Die rohe `index.html` im Root ist die Dev-Version** und braucht den Vite-Server. Per Doppelklick öffnen → leere Seite. Zum Offline-Spielen `npm run build:offline`, dann `dist-offline/index.html` doppelklicken.

## 🟢 Aus IntelliJ starten (Ein-Klick)

Im Repo liegen fertige npm-Run-Configs unter [`.idea/runConfigurations/`](.idea/runConfigurations/) – sie tauchen in IntelliJ/WebStorm automatisch oben rechts im Run-Auswahlmenü auf:

| Run-Config | macht | entspricht |
|---|---|---|
| **dev** | startet den Vite-Dev-Server; Browser über die angezeigte Adresse öffnen | `npm run dev` |
| **build** | Host-/Prod-Build nach `dist/` | `npm run build` |
| **test** | Vitest einmalig | `npm test` |
| **typecheck** | TypeScript voll strict prüfen | `npm run typecheck` |

**Zum Entwickeln musst du nichts extra installieren** – nur einmalig `npm install`, dann Run-Config **dev** wählen und auf ▶ klicken; der Browser zeigt das Spiel über die im Run-Fenster angezeigte Adresse.

> Eine doppelklickbare Desktop-`.exe` (wie bei Stardew) ist ein **separates** Thema (#83 Tauri) und fürs Entwickeln **nicht** nötig.

## 🛠️ Befehle

| Zweck | Befehl |
|---|---|
| Erstinstallation | `npm install` |
| Dev-Server (Hot-Reload) | `npm run dev` |
| Host-/Prod-Build (Multi-File nach `dist/`) | `npm run build` |
| Offline-Build (self-contained `dist-offline/index.html`) | `npm run build:offline` |
| Tests | `npm test` (Vitest) |
| Typen prüfen (voll strict) | `npm run typecheck` |

## 🗺️ Repo-Landkarte – wo finde ich was?

**Code** (`src/`, gebaut mit Vite + TypeScript + Phaser 3; `index.html` lädt nur `src/main.ts`, Vite bündelt den Rest):

| Datei | Schicht | Inhalt |
|---|---|---|
| [`src/main.ts`](src/main.ts) | Einstieg | Start & Tastatursteuerung |
| [`src/sim.ts`](src/sim.ts) | pure Domäne | Cluster-Simulator (docker, kubectl, helm, terraform, secrets, git) |
| [`src/content.ts`](src/content.ts) | pure Domäne | Fassade: bündelt `src/content/*` (Quests, Drills, Quiz, NPCs, Progression, Minispiel) zum `KQContent`-Objekt |
| [`src/world.ts`](src/world.ts) | pure Domäne | Welt-Geometrie (Kachelraster, NPC-Standplätze, Solid-Kacheln) – Phaser-frei, von `scenes.ts` genutzt |
| [`src/decor.ts`](src/decor.ts) | pure Domäne | Deterministische Deko-Platzierung (Büsche, Steine, Laternen, Blumen) – Phaser-frei |
| [`src/clock.ts`](src/clock.ts) | pure Domäne | Zeit-/Datums-Ableitung für die HUD-Uhr (synchron zum Tag-Nacht-Schleier) |
| [`src/cull.ts`](src/cull.ts) | pure Domäne | Off-screen-Culling & FPS-Messung (Sichtfeld-Prüfung, `FrameSampler`) – Phaser-frei; Performance-Budget #82, siehe [`docs/performance-budget.md`](docs/performance-budget.md) |
| [`src/types.ts`](src/types.ts) | Typen | Zentrale Typen (GameState, Quest, …) |
| [`src/game.ts`](src/game.ts) | Anwendung | Spielstand, XP, Wirtschaft, Spaced Repetition |
| [`src/runtime.ts`](src/runtime.ts) | Anwendung | Laufzeit-Singletons (ersetzt den früheren `window`-Shim; bricht Import-Zyklen) |
| [`src/store.ts`](src/store.ts) | Persistenz | SaveStore (kapselt localStorage; Andockpunkt fürs spätere Backend) |
| [`src/scenes.ts`](src/scenes.ts) | Präsentation | Phaser-Welt: Karte, Cluster-Sync, Piraten, Krake |
| [`src/ui.ts`](src/ui.ts) | Präsentation | Dialoge, Funkgerät, Shop, Quiz, Minispiel |
| [`src/sfx.ts`](src/sfx.ts) | Präsentation | WebAudio-Sounds (synthetisiert, keine Audio-Dateien) |
| [`src/assets-data.ts`](src/assets-data.ts) | Assets | `ASSET_MANIFEST` – die eine Quelle pro Grafik (Key/Pfad/Typ/Spalten); BootScene leitet Laden+Slicing daraus ab (Host-Build: eigene Dateien; Offline-Build inlinet sie als Data-URI) |

> Tiefe Architektur-Begründung (Schichtung Domäne ↔ Anwendung ↔ Präsentation): [AGENTS.md › Architektur](AGENTS.md#architektur).

**Weitere Anlaufstellen:**

| Was | Wo |
|---|---|
| 📖 Spiel-Doku (Story, Steuerung, Lernpfad) | [README.md](README.md) |
| 📋 Agenten-Regeln, Board-Workflow, Konventionen | [AGENTS.md](AGENTS.md) |
| 🎨 PixelLab-Assets (Liste + IDs) | [assets/pixellab/README.md](assets/pixellab/README.md) |
| 🧪 Tests (Vitest) | [`test/`](test/) – `sim.test.ts`, `content.test.ts`, `quests.test.ts` u.a. |
| ✅ Backlog / TODOs | GitHub Issues + Project-Board (`gh issue list`, `gh project list --owner fluffels`) |

## ❓ Die vier Einstiegsfragen

- **Was ist das Spiel?** KubeQuest – ein 2D-Lernspiel (Phaser 3) für Docker/K8s/Helm/Terraform; die Spielwelt **ist** der Cluster. → [README.md](README.md)
- **Wie starte ich?** `npm install` → `npm run dev` → angezeigte Adresse im Browser. → Schnellstart oben.
- **Welches Ticket nehme ich?** Deterministisch die **niedrigste freie Nummer** (kein Assignee, kein offener PR/Branch/Worktree) – nicht nach Inhalt/prio aussuchen. Sofort self-assignen. → [AGENTS.md › Kollisionsschutz](AGENTS.md#wo-die-todos-leben).
- **Wie schließe ich ab?** Tests grün + im Browser verifiziert → nach `main` mergen → Worktree/Branch aufräumen → Issue schließen. → [AGENTS.md › Git-Workflow](AGENTS.md#das-wichtigste-zuerst-harte-regeln).

---

**Vollständige Regeln & Begründungen: → [AGENTS.md](AGENTS.md). Bei Konflikt gilt AGENTS.md.**
