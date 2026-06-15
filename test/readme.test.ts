/* Doku-Sync: hält die README ehrlich gegenüber dem Code.
 *
 * Die README ist die spielerseitige Quelle für Story/Lernpfad/Quest-Zahl
 * (siehe AGENTS.md). Solche Texte veralten leise, sobald Quests dazukommen –
 * genau das war der Auslöser dieses Tests (#77): README sagte "22 Quests",
 * real waren es 24. Dieser Test bricht, sobald die in der README genannte
 * Quest-Zahl von der tatsächlichen Quest-Liste abweicht – dann README anpassen.
 *
 * Ausführen mit:  npm test
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { KQContent } from "../src/content";

const readme = readFileSync(fileURLToPath(new URL("../README.md", import.meta.url)), "utf8");

test("README: Headline-Quest-Zahl stimmt mit KQContent.QUESTS überein", () => {
  // Headline-Form: "**24 Quests:** Einstieg (1) → Docker (3) → …"
  const match = readme.match(/\*\*(\d+) Quests:\*\*/);
  assert.ok(match, "Keine Quest-Zahl der Form '**N Quests:**' in der README gefunden");

  const stated = Number(match![1]);
  const actual = KQContent.QUESTS.length;
  assert.equal(
    stated,
    actual,
    `README nennt ${stated} Quests, tatsächlich sind es ${actual}. ` +
      `Bitte die Quest-Zahl (und die Aufschlüsselung dahinter) in README.md aktualisieren.`,
  );
});
