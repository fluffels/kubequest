import { describe, it, expect } from "vitest";
import { ASSET_MANIFEST, KQAssets } from "../src/assets-data";

/* Sichert das Asset-Manifest (#59) ab: Es ist die EINE Datenquelle, aus der
 * BootScene laden + Frame-Slicing ableitet und KQAssets erzeugt wird. Diese Tests
 * decken nicht nur den Happy Path, sondern auch Grenz-/Fehlerfälle ab (doppelte
 * Schlüssel, kaputte Sheet-Parameter, KQAssets läuft aus dem Manifest weg). */

describe("ASSET_MANIFEST", () => {
  it("hat eindeutige Schlüssel (kein Asset doppelt verdrahtet)", () => {
    const keys = ASSET_MANIFEST.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("jeder Eintrag hat einen nicht-leeren Pfad/Quelle", () => {
    for (const a of ASSET_MANIFEST) {
      expect(typeof a.src, a.key).toBe("string");
      expect(a.src.length, a.key).toBeGreaterThan(0);
    }
  });

  it("Sheets haben eine sinnvolle Spalten- und Frame-Größe (>=1)", () => {
    for (const a of ASSET_MANIFEST) {
      if (a.kind !== "sheet") continue;
      expect(a.cols, a.key).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(a.cols), a.key).toBe(true);
      if (a.frame !== undefined) {
        expect(a.frame, a.key).toBeGreaterThanOrEqual(1);
        expect(Number.isInteger(a.frame), a.key).toBe(true);
      }
    }
  });

  it("plains tragen keine Slicing-Parameter (cols nur bei sheets)", () => {
    for (const a of ASSET_MANIFEST) {
      if (a.kind === "plain") {
        expect("cols" in a, a.key).toBe(false);
      }
    }
  });

  it("kennt die geschnittenen Tilesets als sheet mit erwarteter Spaltenzahl", () => {
    // Diese Keys MÜSSEN Sheets bleiben, sonst bricht das Frame-Slicing in scenes.ts
    // (Tiles würden als ganzes Bild geladen → kaputte Karte).
    const expectedCols: Record<string, number> = {
      town: 12, dungeon: 12, creatures: 10,
      coast: 4, meadow: 4, path: 4, kai: 4, dock: 4,
    };
    for (const [key, cols] of Object.entries(expectedCols)) {
      const entry = ASSET_MANIFEST.find((a) => a.key === key);
      expect(entry, key).toBeDefined();
      expect(entry!.kind, key).toBe("sheet");
      expect((entry as { cols: number }).cols, key).toBe(cols);
    }
  });

  it("hält bekannte Einzelobjekte als plain (kein versehentliches Slicing)", () => {
    for (const key of ["ship", "tree", "char_player", "house_office"]) {
      const entry = ASSET_MANIFEST.find((a) => a.key === key);
      expect(entry?.kind, key).toBe("plain");
    }
  });
});

describe("KQAssets", () => {
  it("ist deckungsgleich aus dem Manifest abgeleitet (eine Quelle, kein Drift)", () => {
    expect(Object.keys(KQAssets).sort()).toEqual(
      ASSET_MANIFEST.map((a) => a.key).sort(),
    );
    for (const a of ASSET_MANIFEST) {
      expect(KQAssets[a.key], a.key).toBe(a.src);
    }
  });
});
