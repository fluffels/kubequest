/// <reference types="vitest/config" />
import { defineConfig, type ConfigEnv, type Plugin, type UserConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// #301: Im Dev-Server löste bisher JEDE Quellcode-Änderung einen vollen
// Page-Reload aus – das Spiel hat keine HMR-Boundaries (Phaser-Instanz +
// globale Singletons lassen sich nicht hot-swappen), also fällt Vite auf einen
// Full-Reload zurück. Mitten im Spielen riss das den In-Memory-Zustand weg
// (laufende NPC-Gespräche verschwanden, kurzes blaues Phaser-Hintergrund-
// Flackern), während die Position über den localStorage-Save erhalten blieb –
// genau das Bug-Bild aus #301. Besonders störend, weil parallele Agenten
// Dateien editieren, WÄHREND gespielt wird (daher „sporadisch nach einer
// Weile"). Im Prod-/Offline-Build gibt es keinen Dev-Server und damit kein HMR,
// also tritt der Bug dort nicht auf.
//
// Dieses Plugin unterbindet für JS/TS-Änderungen den automatischen Full-Reload
// (handleHotUpdate gibt ein leeres Modul-Array zurück → Vite schickt KEINEN
// Reload, siehe Vite-Client: bei 0 Modulen und Nicht-HTML passiert nichts) und
// schickt stattdessen ein sanftes Custom-Event an den Client, der einen Toast
// zeigt („F5 zum Übernehmen"). So bleibt das laufende Spiel inkl. Gespräch
// stehen; Code-Änderungen holt man sich bewusst per Reload. CSS-HMR bleibt
// unangetastet (Style-Edits swappen weiter live). Nur Dev (`apply: "serve"`).
export const CODE_CHANGED_EVENT = "kq:code-changed";
export function devNoFullReload(): Plugin {
  return {
    name: "kq-dev-no-full-reload",
    apply: "serve",
    handleHotUpdate(ctx) {
      // Nur den Spielcode abfangen; CSS/HTML/Assets behalten ihr Standardverhalten
      // (CSS soll weiter live hot-swappen, return undefined = Vite macht das Normale).
      if (!/\.(?:ts|tsx|js|mjs|cjs)$/.test(ctx.file)) return;
      ctx.server.ws.send({ type: "custom", event: CODE_CHANGED_EVENT, data: { file: ctx.file } });
      return []; // leeres Modul-Array → kein Full-Reload (#301)
    },
  };
}

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
    // Offline-Build: alles inline (Single-File). Sonst: im Dev-Server den
    // störenden Auto-Full-Reload unterbinden (#301); im Prod-Build ist das
    // `apply: "serve"`-Plugin inaktiv und bleibt wirkungslos.
    plugins: offline ? [viteSingleFile()] : [devNoFullReload()],
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
