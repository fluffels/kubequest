// Architektur-Wächter (#347) – hält die Schichtung aus AGENTS.md automatisch ein,
// statt sie nur per Review-Disziplin zu hoffen. Befund #292 (game.ts → sfx.ts) hatte
// gezeigt, dass sich eine Verletzung sonst unbemerkt einschleicht.
//
// Schichten (siehe AGENTS.md › Architektur, CLAUDE.md › Repo-Landkarte):
//   • pure Domäne      – Phaser-frei, im Node-Test prüfbar (sim, content*, world, decor,
//                        clock, …). Darf NICHT phaser und NICHT die Präsentation importieren.
//   • Anwendung        – game, runtime, devpanel, store (Persistenz). Wie Domäne: kein
//                        phaser, keine Präsentation; darf nur nach „unten" (Domäne) greifen.
//   • Präsentation     – scenes, ui, sfx. Darf alles (nach unten offen) – keine Regel.
//   • Einstieg/Assets  – main (bootet Phaser + Szenen), assets-data. Bewusst ausgenommen.
//
// Umgesetzt als Negativ-Regel ("alles außer Präsentation/Einstieg bleibt rein"), damit der
// Wächter bei Stardew-Scope mitwächst: jedes NEUE Domänen-Modul ist automatisch geschützt,
// ohne dass man es hier nachträgt.

/** Präsentationsschicht – darf Phaser + alles andere anfassen. */
const PRESENTATION = "^src/(scenes|ui|sfx)\\.ts$";
/** Anwendungs-/Persistenzschicht – muss phaser- und präsentationsfrei bleiben. */
const APPLICATION = "^src/(game|runtime|devpanel|store)\\.ts$";
/** Einstieg/Assets – main bootet bewusst Phaser + Szenen; assets-data hält PNG-Imports. */
const ENTRY = "^src/(main|assets-data)\\.ts$";
/** Phaser, egal über welchen aufgelösten Pfad (Pfad beginnt mit `node_modules/…`, kein führender Slash). */
const PHASER = "node_modules[/\\\\]phaser[/\\\\]";

module.exports = {
  forbidden: [
    {
      name: "domaene-kein-phaser",
      comment:
        "Pure Domäne muss Phaser-frei bleiben (im Node-Test prüfbar). Logik gehört nicht " +
        "in die Präsentationsschicht – siehe AGENTS.md › Architektur.",
      severity: "error",
      from: { path: "^src/", pathNot: `${PRESENTATION}|${APPLICATION}|${ENTRY}|\\.d\\.ts$` },
      to: { path: PHASER },
    },
    {
      name: "domaene-keine-praesentation",
      comment:
        "Pure Domäne darf scenes/ui/sfx NICHT importieren (Schichtung von unten nach oben).",
      severity: "error",
      from: { path: "^src/", pathNot: `${PRESENTATION}|${APPLICATION}|${ENTRY}|\\.d\\.ts$` },
      to: { path: PRESENTATION },
    },
    {
      name: "anwendung-kein-phaser",
      comment:
        "Anwendung/Persistenz (game/runtime/devpanel/store) muss Phaser-frei bleiben.",
      severity: "error",
      from: { path: APPLICATION },
      to: { path: PHASER },
    },
    {
      name: "anwendung-keine-praesentation",
      comment:
        "Anwendung/Persistenz darf scenes/ui/sfx NICHT importieren (nur nach unten in die Domäne).",
      severity: "error",
      from: { path: APPLICATION },
      to: { path: PRESENTATION },
    },
  ],
  options: {
    // TS-Pfade sauber auflösen.
    tsConfig: { fileName: "tsconfig.json" },
    // node_modules als Ziel erfassen (für die Phaser-Grenze), aber nicht hineincruisen.
    // (Kein includeOnly: "^src/" – das würde die Kante zu node_modules/phaser
    //  herausfiltern, sodass die Phaser-Grenze nie anschlagen könnte. Der CLI-Aufruf
    //  `depcruise src` begrenzt die Einstiegspunkte bereits auf den Quellcode.)
    doNotFollow: { path: "node_modules" },
  },
};
