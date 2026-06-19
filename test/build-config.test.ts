import { describe, it, expect } from "vitest";
import viteConfig, { devNoFullReload, CODE_CHANGED_EVENT } from "../vite.config";

/* Ticket #58: Der Build hat ZWEI getrennte Wege, die nicht wieder zusammenfallen
 * dürfen. Diese Tests sichern beide Pfade gegen Regressionen ab:
 *  - Prod/Host-Build (Default-Mode) = Multi-File, KEIN Single-File-Plugin, dist/.
 *  - Offline-Build (mode "offline")  = Single-File-Plugin aktiv, dist-offline/.
 * vite.config exportiert via defineConfig die Konfig-Funktion (Funktionsform);
 * wir rufen sie mit dem ConfigEnv selbst auf und prüfen das Ergebnis. */

type ConfigFn = (env: {
  command: "build" | "serve";
  mode: string;
}) => { plugins?: unknown[]; build?: { outDir?: string } };

const resolve = (mode: string) =>
  (viteConfig as unknown as ConfigFn)({ command: "build", mode });

const pluginNames = (plugins: unknown[] | undefined): string[] =>
  (plugins ?? [])
    .flat()
    .map((p) => (p as { name?: string } | null)?.name)
    .filter((n): n is string => typeof n === "string");

const SINGLEFILE = "vite:singlefile";

describe("Build-Strategie #58: Prod-Build (Multi-File)", () => {
  const cfg = resolve("production");

  it("schreibt nach dist/", () => {
    expect(cfg.build?.outDir).toBe("dist");
  });

  it("bindet das Single-File-Plugin NICHT ein (Assets bleiben eigene Dateien)", () => {
    expect(pluginNames(cfg.plugins)).not.toContain(SINGLEFILE);
  });
});

describe("Build-Strategie #58: Offline-Build (Single-File)", () => {
  const cfg = resolve("offline");

  it("schreibt nach dist-offline/ (kollidiert nicht mit dem Prod-Build)", () => {
    expect(cfg.build?.outDir).toBe("dist-offline");
  });

  it("aktiviert das Single-File-Plugin (alles inline für Doppelklick-Offline)", () => {
    expect(pluginNames(cfg.plugins)).toContain(SINGLEFILE);
  });
});

/* #301: Im Dev-Server darf eine Quellcode-Änderung KEINEN automatischen
 * Full-Reload mehr auslösen (riss sonst laufende NPC-Gespräche weg + blaues
 * Flackern). Das Plugin fängt JS/TS-Updates ab (leeres Modul-Array → Vite lädt
 * nicht neu) und meldet die Änderung als Custom-Event; CSS bleibt live-HMR. */
describe("Dev-Server #301: kein Auto-Full-Reload bei Code-Änderungen", () => {
  // Mini-HotUpdate-Kontext mit aufgezeichneten ws.send-Aufrufen.
  const runHotUpdate = (file: string) => {
    const sent: any[] = [];
    const plugin = devNoFullReload();
    const ctx = { file, server: { ws: { send: (m: any) => sent.push(m) } } } as any;
    const result = (plugin.handleHotUpdate as any)(ctx);
    return { result, sent };
  };

  it("ist nur im Dev-Server aktiv (apply: 'serve'), nie im Build", () => {
    expect(devNoFullReload().apply).toBe("serve");
  });

  it("ist im Dev/Prod-Build-Pfad eingehängt, NICHT im Offline-Pfad", () => {
    expect(pluginNames(resolve("development").plugins)).toContain("kq-dev-no-full-reload");
    expect(pluginNames(resolve("offline").plugins)).not.toContain("kq-dev-no-full-reload");
  });

  it("fängt eine .ts-Änderung ab → leeres Modul-Array (kein Reload) + Hinweis-Event", () => {
    const { result, sent } = runHotUpdate("/src/scenes.ts");
    expect(result).toEqual([]); // leeres Array unterdrückt den Full-Reload
    expect(sent).toEqual([{ type: "custom", event: CODE_CHANGED_EVENT, data: { file: "/src/scenes.ts" } }]);
  });

  it("lässt CSS unangetastet (return undefined → normales Live-HMR, kein Event)", () => {
    const { result, sent } = runHotUpdate("/style.css");
    expect(result).toBeUndefined();
    expect(sent).toEqual([]); // kein Custom-Event, Vite macht sein Standard-CSS-HMR
  });

  it("greift auch bei den anderen JS-Endungen, aber nicht bei HTML/Assets", () => {
    expect(runHotUpdate("/src/main.js").result).toEqual([]);
    expect(runHotUpdate("/src/x.tsx").result).toEqual([]);
    expect(runHotUpdate("/index.html").result).toBeUndefined(); // HTML-Shell darf weiter neu laden
    expect(runHotUpdate("/assets/maps/harbor.tmj").result).toBeUndefined();
  });
});

describe("Build-Strategie #58: beide Wege sind wirklich verschieden", () => {
  it("Prod- und Offline-Build landen in getrennten Verzeichnissen", () => {
    expect(resolve("production").build?.outDir).not.toBe(
      resolve("offline").build?.outDir,
    );
  });

  it("nur der Offline-Build ist self-contained (Single-File-Plugin exklusiv dort)", () => {
    const prod = pluginNames(resolve("production").plugins).includes(SINGLEFILE);
    const offline = pluginNames(resolve("offline").plugins).includes(SINGLEFILE);
    expect({ prod, offline }).toEqual({ prod: false, offline: true });
  });
});
