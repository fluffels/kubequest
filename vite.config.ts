/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// base "./" + Single-File-Plugin => `npm run build` erzeugt EINE self-contained
// dist/index.html, die per Doppelklick offline läuft (Headline-Feature des Spiels).
export default defineConfig({
  base: "./",
  plugins: [viteSingleFile()],
  test: {
    // Die Unit-Tests (sim/content) brauchen kein DOM – laufen schnell auf Node.
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
