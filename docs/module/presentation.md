# Tiefendoc: Präsentation (Szenen, UI, SFX, Assets)

> On-demand-Detail zur Präsentations-Schicht — die einzige Schicht, die Phaser bzw. das DOM anfasst. Der schlanke Always-Index steht in [CLAUDE.md](../../CLAUDE.md). Die pure Logik hinter UI/Szenen liegt in [world.md](world.md) (Welt/Karten) bzw. den jeweiligen Domänen-Modulen. Pfade sind repo-relativ als Inline-Code.

## Szenen (`src/scenes.ts` + `src/scenes/*`, Split #345)

`src/scenes.ts` ist ein **Barrel** (#345): es bündelt die Szenen-Module zu `KQScenes` (von `main.ts` registriert). Die 7 Phaser-Szenen liegen seit dem Split **eine Datei je Klasse** unter `src/scenes/`, gemeinsame Helfer in `src/scenes/shared.ts`.

| Modul | Inhalt |
|---|---|
| `src/scenes/shared.ts` | Geteilte Szenen-Bausteine (#345): Karten-/Tile-Konstanten, In-Welt-Pixel-Bitmap-Font (#188, `buildPixelFont`/`pixelText`), Orts-Schilder (#254, `buildSign`), schwebende Belohnungstexte (`floatPixelText`), datengesteuertes Insel-NPC-Rendering (#349, `spawnIslandNpc`). |
| `src/scenes/BootScene.ts` | Lädt alle Grafiken + Frame-Slicing aus `ASSET_MANIFEST`, backt Font/Münz-Icon, startet dann `World` (bzw. `MapTest` via `?maptest`). |
| `src/scenes/WorldScene.ts` | Port Kubernia — **mit Abstand die größte Szene**: Karte, Spieler:in/NPCs, Cluster→Welt-Sync, Piraten-Überfälle, Hacker-Krake, Hafen-Wirtschaft, Warps in die Insel-/Innen-Szenen. (Aufteilung geplant: #393.) |
| `src/scenes/InteriorScene.ts` | Betretbarer Hausinnenraum (#6), von `WorldScene.enterInterior()` gestartet; `INTERIORS` legt die Möbel je Haus-Thema fest. |
| `src/scenes/ArchipelScene.ts` | GitOps-Archipel-Insel (#92); Geometrie/Kollision pur aus `src/archipel.ts`. |
| `src/scenes/LighthouseScene.ts` | Monitoring-Leuchtturm-Klippe (#111); pur aus `src/lighthouse.ts`. |
| `src/scenes/WarehouseScene.ts` | Lagerhallen-Viertel/Hafenkai (#124); pur aus `src/warehouse.ts`. |
| `src/scenes/TilemapTestScene.ts` | Tiled-Loader-Testszene (#191), erreichbar über `?maptest`. |

## UI (`src/ui.ts` + `src/ui/*`, Split #356)

`src/ui.ts` ist **Orchestrator/Barrel** (#356): es deklariert den veränderlichen UI-Zustand (`this.*`) und komponiert das öffentliche `UI`-Objekt aus den Domänen-Bündeln unter `src/ui/` (`export const UI = { …state, ...overlayUI, ...dialogUI, … }`). Die API bleibt unverändert → `main.ts`/`scenes/*` importieren weiter `{ UI }`.

| Modul | Bündel | Inhalt |
|---|---|---|
| `src/ui/shared.ts` | — | Geteilte UI-Helfer: `$`/`esc`/`NPCS`/`SMALLTALK`/`shuffled`/`CMD_MAX_ATTEMPTS`, vorab geladene Porträt-/Shop-Bilder (`sheetImgs`) + der `part()`-Helper (typisiert die Methodenbündel via ThisType-Muster). |
| `src/ui/overlay.ts` | `overlayUI` | Event-Delegation, Blockierung, generische Modal-Tastatur (#283), Menü/Pause. |
| `src/ui/hud.ts` | `hudUI` | HUD/Toasts/Alarm, Interaktion, Tastatur-Navigation der Antwort-Buttons. |
| `src/ui/quest.ts` | `questUI` | Quest-Maschine + Begrüßung/Intro (#288). |
| `src/ui/dialog.ts` | `dialogUI` | NPC-/Bo-Dialoge. |
| `src/ui/radio.ts` | `radioUI` | Funkgerät-Terminal (teach/drill/terminal) + freies Üben. |
| `src/ui/minigame.ts` | `minigameUI` | Stapel-Minispiel. |
| `src/ui/questlog.ts` | `questlogUI` | Logbuch-Übersicht & -Detail (#326); pure Logik in `src/questlog.ts`. |
| `src/ui/shop.ts` | `shopUI` | Shop. |
| `src/ui/quiz.ts` | `quizUI` | Krabben-Quiz (Spaced-Repetition). |
| `src/ui/save.ts` | `saveUI` | Spielstand-Export/Import + `resetGame`. |

## Sound & Assets

| Modul | Inhalt |
|---|---|
| `src/sfx.ts` | WebAudio-Sounds (synthetisiert, keine Audio-Dateien). |
| `src/assets-data.ts` | `ASSET_MANIFEST` — die eine Quelle pro Grafik (Key/Pfad/Typ/Spalten); BootScene leitet Laden + Slicing daraus ab (Host-Build: eigene Dateien; Offline-Build inlinet als Data-URI). |
