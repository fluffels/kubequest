# CLAUDE.md – Einstieg für KI-Agenten

> **Du bist ein Agent in diesem Repo? Hier findest du auf einen Blick alles zum Loslegen.**
> Die **ausführliche Arbeitsanweisung** (harte Regeln, Board-Workflow, Konventionen) steht in **[AGENTS.md](AGENTS.md)** – diese Datei ist der schnelle Einstieg, der dorthin führt.
> Was das Spiel **ist** (Story, Steuerung, Lernpfad), steht in der **[README.md](README.md)** – die ist spielerseitig, nicht für dich als Agent.

## ⚡ Schnellstart (in <1 Minute zum ersten Schritt)

```
1. npm install                              # einmalig
2. npm run dev                              # Dev-Server, angezeigte Adresse im Browser öffnen
3. gh issue list --state open --limit 500   # GANZE Liste holen! ohne --limit nur die 30 neuesten. Dann nach Prio (hoch→mittel→niedrig) + niedrigster freier Nummer wählen, nicht nach Inhalt
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
| **typecheck** | TypeScript prüfen (Standard-Config) | `npm run typecheck` |
| **typecheck:strict** | TypeScript voll strict prüfen (`tsconfig.strict.json`) | `npm run typecheck:strict` |

**Zum Entwickeln musst du nichts extra installieren** – nur einmalig `npm install`, dann Run-Config **dev** wählen und auf ▶ klicken; der Browser zeigt das Spiel über die im Run-Fenster angezeigte Adresse.

> Eine doppelklickbare Desktop-`.exe` (wie bei Stardew) ist ein **separates** Thema (#83 Tauri) und fürs Entwickeln **nicht** nötig.

## 🛠️ Befehle

| Zweck | Befehl |
|---|---|
| Erstinstallation | `npm install` |
| Dev-Server | `npm run dev` |
| Host-/Prod-Build (Multi-File nach `dist/`) | `npm run build` |
| Offline-Build (self-contained `dist-offline/index.html`) | `npm run build:offline` |
| Dev-Panel-Build (#331, Panel MIT, passwortgated, `dist-devpanel/`) | `npm run build:devpanel` |
| Tests | `npm test` (Vitest) |
| Typen prüfen (voll strict) | `npm run typecheck` |

> ⚠️ **Code-Änderungen laden im Dev-Server NICHT automatisch neu** (#301). Eine JS/TS-Änderung löst bewusst keinen Auto-Reload aus (der riss sonst mitten im Spielen laufende Gespräche weg + blaues Flackern, v.a. wenn parallele Agenten editieren). Stattdessen erscheint ein Toast „🔄 Code geändert – neu laden (F5)". Zum Übernehmen also **F5 / Seite neu laden** (Spielstand bleibt im localStorage). CSS-Edits swappen weiterhin live.

## 🗺️ Repo-Landkarte – wo finde ich was?

**Code** (`src/`, gebaut mit Vite + TypeScript + Phaser 3; `index.html` lädt nur `src/main.ts`, Vite bündelt den Rest):

| Datei | Schicht | Inhalt |
|---|---|---|
| [`src/main.ts`](src/main.ts) | Einstieg | Start & Tastatursteuerung |
| [`src/sim.ts`](src/sim.ts) | pure Domäne | Cluster-Simulator (docker, kubectl inkl. `top`/`logs -f`/`--previous`, helm, terraform, git, argocd/GitOps); Observability-Grundlage #109: Pod-/Node-Metriken, Alert-State (firing→resolved), Prometheus-Scrape-Targets – via `podMetrics()`/`nodeMetrics()`/`alerts()`/`scrapeTargets()`; Monitoring-CRDs (ServiceMonitor/PrometheusRule/Grafana) via `kubectl apply`/`get` #110 (Manifeste in [`src/content/manifests.ts`](src/content/manifests.ts)) |
| [`src/content.ts`](src/content.ts) | pure Domäne | Fassade: bündelt `src/content/*` (Quests, Drills, Quiz, NPCs, Progression, Minispiel) zum `KQContent`-Objekt |
| [`src/content/abbrev.ts`](src/content/abbrev.ts) | pure Domäne | Baustein-Katalog (#287/#298): SSOT aller Langform↔Kürzel-Paare (`-a`/`--all`, `pods`/`po` …) mit Freischalt-ID + `findAbbrevByShort` – Grundlage der „verdiente Abkürzung"-Mechanik (Gating #299, Lernpfad #300); validiert in `test/abbrev.test.ts` gegen den echten Content |
| [`src/world.ts`](src/world.ts) | pure Domäne | Welt-Geometrie (Kachelraster, NPC-Standplätze, Solid-Kacheln) – Phaser-frei, von `scenes.ts` genutzt |
| [`src/archipel.ts`](src/archipel.ts) | pure Domäne | GitOps-Archipel: Insel-Geometrie + Anleger/Warp (Hauptkarte ⇄ Insel), reservierter NPC-/Quest-Trigger-Standplatz – Phaser-frei, von `ArchipelScene` in `scenes.ts` genutzt |
| [`src/lighthouse.ts`](src/lighthouse.ts) | pure Domäne | Monitoring-Leuchtturm (#111, Phase 5): Klippen-Geometrie (Gras-Hochebene + begehbarer Stein-Klippenrand) + Aufgang/Warp (Hauptkarte ⇄ Klippe) am Turmfuß, reservierter NPC-/Quest-Trigger-Standplatz + Monitoring-Deko-Plätze – Phaser-frei, von `LighthouseScene` in `scenes.ts` genutzt; Warp-Primitive (`warpAt`/`Warp`) aus `archipel.ts` wiederverwendet |
| [`src/warehouse.ts`](src/warehouse.ts) | pure Domäne | Lagerhallen-Viertel (#124, Phase 7): Hafenkai-Geometrie (rechteckige Gras-Quay + begehbare Stein-Kai-Wand zum Meer) + Holz-Steg/Warp (Hauptkarte ⇄ Kai) am Westende des Hafenkais, reservierter NPC-/Quest-Trigger-Standplatz + Standplätze für Verladekräne/Frachtcontainer + deterministisch gestreute Lager-Güter (Kisten/Fässer) – Phaser-frei, von `WarehouseScene` in `scenes.ts` genutzt; Warp-Primitive (`warpAt`/`Warp`) aus `archipel.ts` wiederverwendet |
| [`src/decor.ts`](src/decor.ts) | pure Domäne | Deterministische Deko-Platzierung (Büsche, Steine, Laternen, Blumen) – Phaser-frei |
| [`src/clock.ts`](src/clock.ts) | pure Domäne | Zeit-/Datums-Ableitung für die HUD-Uhr (synchron zum Tag-Nacht-Schleier) |
| [`src/pixelfont.ts`](src/pixelfont.ts) | pure Domäne | Glyphen-Daten (5×7) + Helfer der In-Welt-Pixel-Bitmap-Font (#188) – Phaser-frei; `scenes.ts` backt daraus die RetroFont-Textur für alle In-Welt-Texte (Schilder, Tags, Marker, Floats, Titel) |
| [`src/cull.ts`](src/cull.ts) | pure Domäne | Off-screen-Culling & FPS-Messung (Sichtfeld-Prüfung, `FrameSampler`) – Phaser-frei; Performance-Budget #82, siehe [`docs/performance-budget.md`](docs/performance-budget.md) |
| [`src/overlaykbd.ts`](src/overlaykbd.ts) | pure Domäne | Tastatur-Logik für einfache Modals (#283): `resolveOverlayKey` entscheidet aus Button-Liste + Taste über Navigation (↑/↓/w/s) bzw. Auslösen (Enter/Leer/E → markierter → primary → erster) – Phaser-/DOM-frei; `UI.overlayKey` in `ui.ts` ist die dünne DOM-Anbindung |
| [`src/labellayout.ts`](src/labellayout.ts) | pure Domäne | Entzerrt sich überlappende In-Welt-Beschriftungen (#207): schiebt horizontal kollidierende Cluster-Tags/Schilder vertikal auseinander (`spreadLabelsVertically`) – Phaser-frei; `revealNearbyLabels` in `scenes.ts` wendet die Versätze auf die gerade sichtbaren Tags an |
| [`src/tilemap.ts`](src/tilemap.ts) | pure Domäne | Tiled-`.tmj`-Grundgerüst (#191): Typen + Validierung + Kollisions-Raster + Tileset→Asset-Mapping; seit #194 auch Objekt-Layer (`objectgroup` + Custom-Properties) als Datengrundlage fürs Warp-/Tür-System (`objectGroup`/`tiledProps`) – Phaser-frei; das Phaser-Rendering liegt in der `TilemapTestScene` in `scenes.ts`. Maps + Workflow: [`assets/maps/README.md`](assets/maps/README.md) |
| [`src/harbormap.ts`](src/harbormap.ts) | pure Domäne | Hafenkarte als Daten (#192): pure Boden-/Kollisions-Geometrie + Tiled-Serialisierung; Quelle für `assets/maps/harbor.tmj`, das `WorldScene.loadHarborMap()` im Datenpfad (`?tiledmap`) lädt. Phaser-frei |
| [`src/mapregistry.ts`](src/mapregistry.ts) | pure Domäne | Map-Registry (#193): die EINE zentrale Liste aller Karten (Map-ID → rohes `.tmj` + Metadaten: Maße, Spawn, Tileset, Layer, Parser). `getMapEntry(id)` löst sie auf; die Loader in `scenes.ts` (`loadHarborMap`, `TilemapTestScene`, Spawn-Fallback) nutzen sie statt fester Pfade. Phaser-frei |
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
| 🔤 Pixelschrift fürs HUD (`KQPixel`/Silkscreen) | [`fonts.css`](fonts.css) (base64-`@font-face`) + Quelle/Lizenz in [`assets/fonts/`](assets/fonts/) (#189) |
| 🗺️ Tiled-Maps (`.tmj`) + Workflow | [assets/maps/README.md](assets/maps/README.md) |
| 🧪 Tests (Vitest) | [`test/`](test/) – `sim.test.ts`, `content.test.ts`, `quests.test.ts` u.a. |
| ✅ Backlog / TODOs | GitHub Issues + Project-Board (`gh issue list --state open --limit 500`, `gh project list --owner fluffels`) |

## ❓ Die vier Einstiegsfragen

- **Was ist das Spiel?** KubeQuest – ein 2D-Lernspiel (Phaser 3) für Docker/K8s/Helm/Terraform; die Spielwelt **ist** der Cluster. → [README.md](README.md)
- **Wie starte ich?** `npm install` → `npm run dev` → angezeigte Adresse im Browser. → Schnellstart oben.
- **Welches Ticket nehme ich?** Erst die **ganze** offene Liste holen (`gh issue list --state open --limit 500` – ohne `--limit` nur die 30 neuesten!), dann deterministisch nach **Priorität** (`prio:hoch` → `prio:mittel` → `prio:niedrig` → ohne Label), **innerhalb der Prio die niedrigste freie Nummer** (kein Assignee, kein offener PR/Branch/Worktree) – nicht nach Inhalt aussuchen. Sofort self-assignen. → [AGENTS.md › Kollisionsschutz](AGENTS.md#wo-die-todos-leben).
- **Wie schließe ich ab?** Tests grün + im Browser verifiziert → nach `main` mergen → Worktree/Branch aufräumen → Issue schließen. → [AGENTS.md › Git-Workflow](AGENTS.md#das-wichtigste-zuerst-harte-regeln).

---

**Vollständige Regeln & Begründungen: → [AGENTS.md](AGENTS.md). Bei Konflikt gilt AGENTS.md.**
