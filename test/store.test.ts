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
