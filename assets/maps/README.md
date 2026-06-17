# Tiled-Maps (`assets/maps/`)

Hier liegen die Spielkarten als **Tiled-JSON** (`.tmj`). Das ist Teil 1 der
Tiled-Migration ([#191](https://github.com/fluffels/kubequest/issues/191), Epic
[#57](https://github.com/fluffels/kubequest/issues/57)) – das Fundament:
ein Export-Format + ein generischer Loader, der **eine** Map rendert. Die echte
Hafenkarte wird hier noch **nicht** abgelöst (das ist #192); die prozedurale
`buildMap()` in [`src/scenes.ts`](../../src/scenes.ts) bleibt vorerst die Welt.

## Format-Konvention

- **Export aus Tiled als `.tmj`** (JSON, *nicht* `.tmx`/XML). In Tiled:
  *Map → Export As… → JSON map files (`*.tmj`)*. So bleibt die Datei direkt
  parsbar (kein XML-Parser nötig) und gut im Diff lesbar.
- **Orthogonal, 16×16 px Tiles.** Teil 1 unterstützt bewusst nur orthogonale
  Maps mit 16er-Raster (passt zum `pixelArt`-Renderer und zu `TILE = 16` in
  [`src/world.ts`](../../src/world.ts)).
- **Eingebettete Tilesets** (kein „Embed in map"-Häkchen weglassen). Externe
  `.tsx`-Tilesets sind in Teil 1 noch nicht unterstützt – der Validator lehnt
  Tilesets ohne `image`-Feld ab.
- **Tileset-Name = Asset-Schlüssel.** Der `name` eines Tilesets im `.tmj` muss
  exakt einem Schlüssel im `ASSET_MANIFEST`
  ([`src/assets-data.ts`](../../src/assets-data.ts)) entsprechen (z. B. `town`).
  Darüber hängt der Loader die bereits geladene Textur per
  `addTilesetImage(name, key)` an – kein zweites Mal laden, kein Pfad-Raten.
- **Layer:** mindestens ein Tile-Layer fürs Sichtbare und ein Tile-Layer für die
  Kollision. Im Kollisionslayer gilt jede gesetzte Kachel (`gid != 0`) als
  solide; leere Kacheln (`0`) sind begehbar. Layer-Namen sind frei wählbar, der
  Loader spricht sie über den Namen an (Beispiel hier: `Boden` + `Kollision`).

## Wer lädt das?

- Reine, Phaser-freie Logik (Typen, Validierung, Kollisions-Raster,
  Tileset→Asset-Mapping): [`src/tilemap.ts`](../../src/tilemap.ts), getestet in
  [`test/tilemap.test.ts`](../../test/tilemap.test.ts) (parst u. a. das echte
  `test-map.tmj` und prüft die Fehlerfälle).
- Phaser-Rendering (`make.tilemap` / `addTilesetImage` / `createLayer` +
  Kollision): die `TilemapTestScene` in [`src/scenes.ts`](../../src/scenes.ts).

## Im Browser ansehen

`npm run dev` starten und die angezeigte Adresse mit `?maptest` öffnen, z. B.
`http://localhost:5173/?maptest`. Statt der Welt startet dann die
`TilemapTestScene` und rendert `test-map.tmj`: ein Boden-Layer mit einem
Kollisions-Ring, dessen kollidierbare Kacheln rot eingefärbt sind.

## Dateien

| Datei | Inhalt |
|---|---|
| `test-map.tmj` | minimale 8×6-Demo-Map: Tileset `town`, Layer `Boden` + `Kollision` (Rand-Ring solide). Dient als Loader-Beweis und als Fixture für `test/tilemap.test.ts`. |
