/* Tests für die Map-Registry (#193, Teil 3 von Epic #57).
 *
 * Die Registry ist die zentrale Liste aller Spielkarten (Map-ID → rohes .tmj +
 * Metadaten: Maße, Spawnpunkt, Tileset, Layer-Namen, map-spezifischer Parser).
 * Geprüft wird, inkl. Negativ-/Grenzfälle:
 *  1. jeder Eintrag lädt+validiert sein echtes .tmj-Artefakt sauber,
 *  2. die deklarierten Metadaten (Maße, Tilesets, Layer) stimmen mit dem
 *     tatsächlichen Inhalt des .tmj überein (Drift-Schutz – ein Eintrag kann
 *     nicht hinter seiner Datei zurückfallen),
 *  3. der Hafen-Eintrag decodiert zu exakt derselben Geometrie wie der Code,
 *  4. getMapEntry() liefert bekannte IDs und wirft bei unbekannten.
 *
 * Ausführen mit:  npm test
 */
import { describe, it, expect } from "vitest";
import { MAP_REGISTRY, getMapEntry, type MapId } from "../src/mapregistry";
import { harborGeometry } from "../src/harbormap";
import { collisionGrid } from "../src/tilemap";

const ids = Object.keys(MAP_REGISTRY) as MapId[];

describe("Map-Registry – jeder Eintrag ist konsistent zu seinem .tmj", () => {
  it.each(ids)("Eintrag \"%s\" lädt+validiert sein Artefakt", (id) => {
    const entry = MAP_REGISTRY[id];
    expect(entry.id).toBe(id);
    const map = entry.parse(JSON.parse(entry.raw));
    // Deklarierte Maße = tatsächliche Maße im .tmj.
    expect(map.width).toBe(entry.width);
    expect(map.height).toBe(entry.height);
    // Deklarierte Tilesets = tatsächliche Tileset-Namen im .tmj.
    expect(map.tilesets.map((t) => t.name)).toEqual([...entry.tilesets]);
    // Deklarierte Layer existieren wirklich.
    const layerNames = map.layers.map((l) => l.name);
    expect(layerNames).toContain(entry.groundLayer);
    expect(layerNames).toContain(entry.collisionLayer);
  });

  it.each(ids)("Spawn von \"%s\" liegt innerhalb der Karte", (id) => {
    const { spawn, width, height } = MAP_REGISTRY[id];
    expect(spawn.x).toBeGreaterThanOrEqual(0);
    expect(spawn.y).toBeGreaterThanOrEqual(0);
    expect(spawn.x).toBeLessThan(width);
    expect(spawn.y).toBeLessThan(height);
  });
});

describe("Map-Registry – Hafen-Eintrag trägt die echte Welt", () => {
  const harbor = getMapEntry("harbor");
  const map = harbor.parse(JSON.parse(harbor.raw));

  it("decodiert Boden zur selben Geometrie wie der Code", () => {
    expect(harbor.decodeGround).toBeDefined();
    expect(harbor.decodeGround!(map)).toEqual(harborGeometry().ground);
  });

  it("Kollisions-Layer trifft das Solid-Raster exakt", () => {
    expect(collisionGrid(map, harbor.collisionLayer)).toEqual(
      harborGeometry().solid.map((s) => s === 1),
    );
  });
});

describe("getMapEntry – Lookup & Negativfall", () => {
  it("liefert bekannte Einträge per ID", () => {
    expect(getMapEntry("harbor").id).toBe("harbor");
    expect(getMapEntry("test-map").id).toBe("test-map");
  });

  it("wirft mit klarer Meldung bei unbekannter ID", () => {
    expect(() => getMapEntry("gibtsnicht")).toThrow(/unbekannte Map-ID|gibtsnicht/);
  });
});
