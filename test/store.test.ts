/* Tests für die Persistenz-Schicht (SaveStore).
 * store.ts greift beim Laden auf window.localStorage zu – im Node-Testlauf
 * stubben wir window selbst, statt jsdom als Dependency reinzuholen.
 * Jeder Test importiert das Modul frisch (resetModules), damit der In-Memory-
 * Fallback und der localStorage-Pfad sauber getrennt geprüft werden.
 */
import { test, expect, vi, afterEach } from "vitest";

function makeLocalStorageStub() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
    _map: map,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

test("SaveStore: write/read/remove-Runde über localStorage", async () => {
  const ls = makeLocalStorageStub();
  vi.stubGlobal("window", { localStorage: ls });
  vi.resetModules();
  const { SaveStore } = await import("../src/store");

  expect(SaveStore.read()).toBe(null);            // frisch: noch nichts gespeichert
  SaveStore.write('{"xp":42}');
  expect(SaveStore.read()).toBe('{"xp":42}');      // exakt das Geschriebene zurück
  expect(ls._map.size).toBe(1);                    // landet wirklich im localStorage
  SaveStore.remove();
  expect(SaveStore.read()).toBe(null);             // nach remove wieder weg
});

test("SaveStore: schreibt unter genau einem, stabilen Schlüssel", async () => {
  const ls = makeLocalStorageStub();
  vi.stubGlobal("window", { localStorage: ls });
  vi.resetModules();
  const { SaveStore } = await import("../src/store");

  SaveStore.write("a");
  SaveStore.write("b"); // zweites Schreiben überschreibt, legt keinen zweiten Key an
  expect(ls._map.size).toBe(1);
  expect(SaveStore.read()).toBe("b");
});

test("SaveStore: fällt auf In-Memory zurück, wenn localStorage blockiert ist", async () => {
  // Privater Modus / blockierte Cookies: localStorage-Zugriff wirft.
  // Das Spiel darf NICHT crashen, sondern muss flüchtig weiterspeichern.
  vi.stubGlobal("window", {
    get localStorage(): Storage { throw new Error("localStorage blockiert"); },
  });
  vi.resetModules();
  const { SaveStore } = await import("../src/store");

  expect(SaveStore.read()).toBe(null);
  SaveStore.write("im-speicher");
  expect(SaveStore.read()).toBe("im-speicher"); // In-Memory-Fallback funktioniert
  SaveStore.remove();
  expect(SaveStore.read()).toBe(null);
});

/* ===== Versionierte Spielstände (readState/writeState + Migration) ===== */

const SAVE_KEY = "kubequest-save-v3"; // muss zum Key in store.ts passen

test("writeState: legt den Stand in einer Versions-Hülle { v, data } ab", async () => {
  const ls = makeLocalStorageStub();
  vi.stubGlobal("window", { localStorage: ls });
  vi.resetModules();
  const { SaveStore, CURRENT_SAVE_VERSION } = await import("../src/store");

  SaveStore.writeState({ xp: 42 });
  expect(ls._map.size).toBe(1); // weiterhin genau ein Key

  const raw = JSON.parse(ls._map.get(SAVE_KEY)!);
  expect(raw.v).toBe(CURRENT_SAVE_VERSION); // Version steht in der Hülle
  expect(raw.data).toEqual({ xp: 42 });     // Nutzlast liegt unter data, nicht roh
});

test("readState: Roundtrip mit writeState gibt den Stand zurück, nicht die Hülle", async () => {
  const ls = makeLocalStorageStub();
  vi.stubGlobal("window", { localStorage: ls });
  vi.resetModules();
  const { SaveStore } = await import("../src/store");

  expect(SaveStore.readState()).toBe(null); // frisch: noch nichts gespeichert
  const state = { xp: 7, coins: 40, owned: ["pet"] };
  SaveStore.writeState(state);
  expect(SaveStore.readState()).toEqual(state); // genau der Stand, ohne v/data drumherum
});

test("readState: migriert einen Alt-Stand OHNE Hülle (Version 0) verlustfrei", async () => {
  const ls = makeLocalStorageStub();
  vi.stubGlobal("window", { localStorage: ls });
  vi.resetModules();
  const { SaveStore } = await import("../src/store");

  // So sah ein Stand vor der Versionierung aus: blanker GameState direkt unter dem Key.
  const legacy = { xp: 999, coins: 5, questIdx: 3 };
  ls._map.set(SAVE_KEY, JSON.stringify(legacy));

  // Wird als Version 0 erkannt und unverändert auf das aktuelle Format gehoben.
  expect(SaveStore.readState()).toEqual(legacy);
});

test("readState: kaputte Datei führt zu frischem Start (null), nicht zum Crash", async () => {
  const ls = makeLocalStorageStub();
  vi.stubGlobal("window", { localStorage: ls });
  vi.resetModules();
  const { SaveStore } = await import("../src/store");

  ls._map.set(SAVE_KEY, "{kaputt-kein-json"); // halbe/zerschossene Datei
  expect(SaveStore.readState()).toBe(null);
});

test("readState: unbekannt neue Version crasht nicht, liefert die Nutzlast best effort", async () => {
  const ls = makeLocalStorageStub();
  vi.stubGlobal("window", { localStorage: ls });
  vi.resetModules();
  const { SaveStore } = await import("../src/store");

  // Stand aus einer FUTURE-Version (z.B. neuerer Build): wir können nicht runter-
  // migrieren, dürfen aber nicht crashen und nicht den Stand wegwerfen.
  const future = { xp: 123 };
  ls._map.set(SAVE_KEY, JSON.stringify({ v: 999, data: future }));
  expect(SaveStore.readState()).toEqual(future);
});
