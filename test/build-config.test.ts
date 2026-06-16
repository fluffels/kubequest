import { describe, it, expect } from "vitest";
import viteConfig from "../vite.config";

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
