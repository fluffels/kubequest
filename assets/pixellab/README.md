# PixelLab-Assets & Autotiling (KubeQuest)

Diese Grafiken wurden mit **PixelLab AI** (https://api.pixellab.ai/mcp) im Stardew-angelehnten
Stil erzeugt und ersetzen nach und nach die ursprünglichen Kenney-Tiny-Platzhalter.
Jede Datei liegt hier als PNG **und** als Base64 in `src/assets-data.ts` (damit der
Single-File-Offline-Build self-contained bleibt). Die `.json` sind die Tileset-Metadaten.

## Einheitlicher Stil (immer mitgeben)
- **Tiles:** 16×16, `selective outline`, `detailed shading`, `highly detailed`, `high top-down`
- **Figuren:** `low top-down`, `chibi`, `selective outline`, `high detail`, size 32, 4 Richtungen (nur `south`-Frame genutzt)
- **Maßstab:** Mensch = **1 Kachel (16px)**. Daran alles ausrichten (Baum ~3 Kacheln, Busch ~1, Fass ~1).

## Terrain-Tilesets (Wang, `create_topdown_tileset` → 16 Tiles, 4×4)
Verkettet über `lower_base_tile_id`, damit gemeinsame Terrains pixelgleich anschließen.

| Datei | Übergang | tileset_id | base tiles (lower→upper) |
|---|---|---|---|
| `water-sand` (coast) | Wasser→Sand | c7e28595-ae17-4840-9c25-31a4a7dd8eb0 | water 356778f0… → sand 096ddbfb… |
| `sand-grass` (meadow) | Sand→Gras | 6de18767-1ba1-4829-b9b8-81a659508612 | sand 096ddbfb… → grass 197809d8… |
| `grass-dirt` (path) | Gras→Weg | c2bd68ef-1b8d-4936-9787-6c3b68d4500f | grass 197809d8… → dirt e8efe511… |
| `water-stone` (kai) | Wasser→Stein | 18b0efb4-f9f4-4e16-97a3-e5e298eb8bb5 | water 356778f0… → stone bcb30e72… |
| `water-wood` (dock) | Wasser→Holz | 8540cac2-06ff-438f-8432-7b5865046011 | water 356778f0… → wood 2cab6bae… |

Gemeinsame Basis-Tile-IDs (zum Weiter-Verketten neuer Sets):
`water 356778f0-9b33-4025-86fe-c7bb75b06d27` · `sand 096ddbfb-6300-4a3e-bed8-d052a947fa64` ·
`grass 197809d8-8637-4344-88d1-f704a7e410f5` · `dirt e8efe511-b484-4a4f-90d9-7efbebebfbe3` ·
`stone bcb30e72-ea60-44e7-87b4-2f6ca52a98c9` · `wood 2cab6bae-8dce-4298-a8df-d1e4ef4644a8`

## Objekte (`create_map_object`, transparent)
`flowers` 0b39f8ca · `tree` 5875d1ff · `pine` 646df3e0 · `bush` 60c32cf5 · `rock` fc3a7be6 ·
`crate` 80a6f6c4 · `barrel` 694b9ecc · `well` edd57bbc · `stall` 1f189047 · `lamppost` ce7a86df · `signpost` b05d7ca2

## Figuren (`create_character`, 4-dir, nur `south.png` genutzt)
`char_player` daae9195 · `char_ole` b89f37e2 · `char_runa` 723246a6 · `char_pelle` 793f0232

> ⚠️ **Map-Objekte & Figuren werden serverseitig nach 8 h gelöscht.** Die IDs sind nur historisch —
> die dauerhafte Quelle sind die PNGs hier + das Base64 in `src/assets-data.ts`. Tilesets bleiben abrufbar.

## Wie das Autotiling funktioniert (`src/scenes.ts`, `renderGround`)
- **Format `tileset15`:** 4×4-Sheet, Tile = Funktion der 4 Eck-Terrains. Eck-Code
  `NW<<3 | NE<<2 | SW<<1 | SE` (Bit=1 wenn „obere" Terrain). Mapping auf den Frame-Index:
  `WANG = [6,7,10,9,2,11,4,15,5,14,1,8,3,0,13,12]` — **bei allen Sets identisch** (aus den Metadaten verifiziert).
- **Terrain-Höhen je Bodenzelle:** Wasser(`-2`)=0 < Sand(`-3`)=1 < Gras/Land(sonst)=2 < Weg(`25`)=3.
- **Pro Zelle:** berührt sie Wasser → Wasser-Rand-Set nach Nachbar-**Material** (Holz `-10/-11` > Stein `96/97/98` > Sand); sonst Weg-Zelle → `path`; sonst → `meadow`. Stein-Kai/Stege innen = volles Tile.
- **Objekte/Figuren** liegen in `BootScene`-`plains` (ohne Slicing, ganzes Bild = ein Sprite),
  werden unten verankert gerendert (Origin ~0.81 = Fußhöhe; Füße sitzen auf dem Schatten).

## Ein neues Asset hinzufügen
1. `create_topdown_tileset` (Terrain, ggf. `lower_base_tile_id` aus obiger Liste) **oder** `create_map_object` / `create_character`.
2. PNG nach `assets/pixellab/` laden, als Base64 in `src/assets-data.ts` (Eintrag `name: "data:image/png;base64,…"`).
3. In `BootScene`: Tileset → `sheets`-Array (4 Spalten); Objekt/Figur → `plains`-Array.
4. Verwenden — **erst referenzieren, wenn eingebettet UND geladen** (sonst grün-schwarzer Phaser-Platzhalter).
