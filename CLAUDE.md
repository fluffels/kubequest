# CLAUDE.md – Einstieg für KI-Agenten

> **Du bist ein Agent in diesem Repo? Hier findest du auf einen Blick alles zum Loslegen.**
> Die **ausführliche Arbeitsanweisung** (harte Regeln, Board-Workflow, Konventionen) steht in **[AGENTS.md](AGENTS.md)** – diese Datei ist der schnelle Einstieg, der dorthin führt.
> Was das Spiel **ist** (Story, Steuerung, Lernpfad), steht in der **[README.md](README.md)** – die ist spielerseitig, nicht für dich als Agent.

## ⚡ Schnellstart (in <1 Minute zum ersten Schritt)

```
1. npm install                              # einmalig
2. npm run dev                              # Dev-Server, angezeigte Adresse im Browser öffnen
3. Freies Ticket wählen                     # gh issue list --json number,title,assignees → eins OHNE Assignee
4. gh issue edit <nr> --add-assignee @me    # SOFORT claimen = "in Arbeit"-Marker, dann mit gh issue view <nr> prüfen
5. git worktree add .claude/worktrees/kq-<nr> -b feature/kq-<nr>-<slug>   # eigener Worktree, bevor du Dateien anfasst
6. coden                                    # im Worktree umsetzen, deutsche Umlaute in Texten/Kommentaren
7. npm test                                 # muss grün sein (auch Negativfälle abdecken, Red-Green)
8. npm run typecheck                        # muss grün sein (strict)
9. im Browser verifizieren                  # sichtbare Änderungen wirklich anschauen
10. nach main mergen → Worktree/Branch aufräumen → Issue schließen   # Details siehe AGENTS.md
```

⚠️ **Die rohe `index.html` im Root ist die Dev-Version** und braucht den Vite-Server. Per Doppelklick öffnen → leere Seite. Zum Offline-Spielen `npm run build`, dann `dist/index.html` doppelklicken.

## 🛠️ Befehle

| Zweck | Befehl |
|---|---|
| Erstinstallation | `npm install` |
| Dev-Server (Hot-Reload) | `npm run dev` |
| Offline-Build (self-contained `dist/index.html`) | `npm run build` |
| Tests | `npm test` (Vitest) |
| Typen prüfen (voll strict) | `npm run typecheck` |

## 🗺️ Repo-Landkarte – wo finde ich was?

**Code** (`src/`, gebaut mit Vite + TypeScript + Phaser 3; `index.html` lädt nur `src/main.ts`, Vite bündelt den Rest):

| Datei | Schicht | Inhalt |
|---|---|---|
| [`src/main.ts`](src/main.ts) | Einstieg | Start & Tastatursteuerung |
| [`src/sim.ts`](src/sim.ts) | pure Domäne | Cluster-Simulator (docker, kubectl, helm, terraform, secrets, git) |
| [`src/content.ts`](src/content.ts) | pure Domäne | Quests, Dialoge, Drills, NPCs, Karteikarten, Minispiel |
| [`src/types.ts`](src/types.ts) | Typen | Zentrale Typen (GameState, Quest, …) |
| [`src/game.ts`](src/game.ts) | Anwendung | Spielstand, XP, Wirtschaft, Spaced Repetition |
| [`src/store.ts`](src/store.ts) | Persistenz | SaveStore (kapselt localStorage; Andockpunkt fürs spätere Backend) |
| [`src/scenes.ts`](src/scenes.ts) | Präsentation | Phaser-Welt: Karte, Cluster-Sync, Piraten, Krake |
| [`src/ui.ts`](src/ui.ts) | Präsentation | Dialoge, Funkgerät, Shop, Quiz, Minispiel |
| [`src/sfx.ts`](src/sfx.ts) | Präsentation | WebAudio-Sounds (synthetisiert, keine Audio-Dateien) |
| [`src/assets-data.ts`](src/assets-data.ts) | Assets | Spritesheets als `import`s (Single-File-Build inlinet sie als Data-URI) |

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
- **Welches Ticket nehme ich?** Ein offenes Issue **ohne Assignee**, ohne offenen PR/Branch. Sofort self-assignen. → [AGENTS.md › Kollisionsschutz](AGENTS.md#wo-die-todos-leben).
- **Wie schließe ich ab?** Tests grün + im Browser verifiziert → nach `main` mergen → Worktree/Branch aufräumen → Issue schließen. → [AGENTS.md › Git-Workflow](AGENTS.md#das-wichtigste-zuerst-harte-regeln).

---

**Vollständige Regeln & Begründungen: → [AGENTS.md](AGENTS.md). Bei Konflikt gilt AGENTS.md.**
