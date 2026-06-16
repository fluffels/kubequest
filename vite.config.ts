/// <reference types="vitest/config" />
import { defineConfig, type ConfigEnv, type UserConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Zwei getrennte Build-Wege (Ticket #58) aus derselben Quelle (src/ + assets-data.ts):
//
//   • `vite build`                → Prod/Host-Build: normales Vite-Multi-File-Bundle
//     nach dist/. Assets liegen als eigene Dateien neben der HTML, werden vom
//     Webserver ausgeliefert und einzeln vom Browser gecacht. Gedacht zum Hosten.
//
//   • `vite build --mode offline` → Offline-Export: EINE self-contained
//     dist-offline/index.html (alle Assets via vite-plugin-singlefile inline als
//     Data-URI). Das ist das „per Doppelklick offline spielbar"-Feature – braucht
//     keinen Server, ist aber durch das eager-inline-Base64 bewusst nicht mehr der
//     Standardpfad, sondern ein zusätzliches Target.
//
// base "./" hält die Pfade relativ, damit beide Targets aus einem Unterordner bzw.
// per file:// laufen.
export default defineConfig(({ mode }: ConfigEnv): UserConfig => {
  const offline = mode === "offline";
  return {
    base: "./",
    plugins: offline ? [viteSingleFile()] : [],
    build: {
      outDir: offline ? "dist-offline" : "dist",
      emptyOutDir: true,
    },
    test: {
      // Die Unit-Tests (sim/content) brauchen kein DOM – laufen schnell auf Node.
      environment: "node",
      include: ["test/**/*.test.ts"],
    },
  };
});
