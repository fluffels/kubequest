/* Tests für die Spiel-Logik (game.ts): Wirtschaft, XP/Rang, Shop, Spaced
 * Repetition. game.ts setzt beim Import (window as any).Game und nutzt
 * window.localStorage über store.ts – im Node-Lauf stubben wir window vorher
 * und importieren das Modul dann dynamisch.
 *
 * Bewusst auch Negativ-/Grenzfälle: kaputte Deployments verdienen nichts,
 * zu wenig Dublonen -> kein Kauf, falsche Antwort -> Box zurück auf 1.
 */
import { test, expect, beforeAll, beforeEach } from "vitest";
import { vi } from "vitest";
import { KQContent } from "../src/content";

let Game: typeof import("../src/game").Game;
let Sim: typeof import("../src/sim").Sim;

beforeAll(async () => {
  const map = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => { map.set(k, String(v)); },
      removeItem: (k: string) => { map.delete(k); },
    },
  });
  ({ Game } = await import("../src/game"));
  ({ Sim } = await import("../src/sim"));
});

beforeEach(() => {
  Game.reset();          // frischer Default-Spielstand (xp 0, coins 40)
  Game.sim = new Sim({}); // leerer Cluster als bekannte Basis
});

/* ---------- XP & Rang ---------- */

test("rankIndex: Schwellen greifen genau, nicht zu früh", () => {
  const letzterRang = KQContent.RANKS.length - 1; // abgeleitet, klebt nicht an fester Zahl
  expect(Game.rankIndex(0)).toBe(0);     // Landratte
  expect(Game.rankIndex(109)).toBe(0);   // eins UNTER Moses -> noch Landratte
  expect(Game.rankIndex(110)).toBe(1);   // genau Moses
  expect(Game.rankIndex(Number.MAX_SAFE_INTEGER)).toBe(letzterRang); // höchster Rang
});

test("addXp: meldet Rang-Aufstieg nur, wenn wirklich eine Schwelle überschritten wird", () => {
  Game.state.xp = 100;
  expect(Game.addXp(20)).toBe(true);   // 100 -> 120 überschreitet 110 (Moses)
  expect(Game.state.xp).toBe(120);     // XP wirklich addiert
  expect(Game.addXp(5)).toBe(false);   // 120 -> 125, keine neue Schwelle
  expect(Game.state.xp).toBe(125);
});

/* ---------- Wirtschaft ---------- */

test("incomeRate: gesunde Pods + Services zahlen, kaputte Deployments NICHT", () => {
  Game.sim = new Sim({
    deployments: [
      { name: "gesund", image: "nginx", replicas: 2 },
      { name: "kaputt", image: "x", replicas: 3, broken: { type: "imagepull" } },
    ],
  });
  // 2 gesunde Replicas * 0.5 = 1.0; kaputte 3 Replicas tragen 0 bei
  expect(Game.incomeRate()).toBe(1.0);

  Game.sim = new Sim({
    deployments: [{ name: "gesund", image: "nginx", replicas: 2 }],
    services: [{ name: "gesund", type: "ClusterIP", clusterIP: "10.96.0.2", port: 80 }],
  });
  expect(Game.incomeRate()).toBe(2.0); // 1.0 aus Pods + 1 aus Service
});

test("economyTick: zahlt erst ganze Dublonen aus und schreibt sie gut", () => {
  Game.sim = new Sim({ deployments: [{ name: "a", image: "nginx", replicas: 2 }] });
  // incomeRate 1.0/min -> pro Sekunde 1/60. Ein kurzer Tick zahlt noch nichts.
  expect(Game.economyTick(1)).toBe(0);
  const coinsVorher = Game.state.coins;
  // Großer Tick (120 s) -> >= 2 Dublonen fällig
  const payout = Game.economyTick(120);
  expect(payout).toBeGreaterThanOrEqual(2);
  expect(Game.state.coins).toBe(coinsVorher + payout);
});

test("addCoins: Streak-Multiplikator wirkt und ist bei 10 gedeckelt", () => {
  Game.state.streak.count = 0;
  expect(Game.addCoins(100)).toBe(100);   // Faktor 1.0
  Game.state.streak.count = 10;
  expect(Game.addCoins(100)).toBe(150);   // Faktor 1.5
  Game.state.streak.count = 25;           // über dem Deckel
  expect(Game.addCoins(100)).toBe(150);   // weiterhin 1.5, nicht mehr
});

/* ---------- Shop ---------- */

test("buy: scheitert bei zu wenig Dublonen, ohne etwas abzubuchen", () => {
  Game.state.coins = 10; // Fernrohr kostet 25
  const res = Game.buy("fernrohr");
  expect(res.ok).toBe(false);
  expect(Game.state.coins).toBe(10);                 // nichts abgezogen
  expect(Game.state.inventory["fernrohr"]).toBeFalsy();
});

test("buy: Verbrauchsgut wird gekauft, Dublonen abgezogen, Inventar erhöht", () => {
  Game.state.coins = 100;
  const res = Game.buy("fernrohr");
  expect(res.ok).toBe(true);
  expect(Game.state.coins).toBe(75);                 // 100 - 25
  expect(Game.state.inventory["fernrohr"]).toBe(1);
});

test("buy: nicht-verbrauchbare Ware lässt sich nicht doppelt kaufen", () => {
  Game.state.coins = 1000;
  expect(Game.buy("pet-ratte").ok).toBe(true);       // Haustier (150)
  const zweiter = Game.buy("pet-ratte");
  expect(zweiter.ok).toBe(false);                    // schon im Besitz
  expect(zweiter.msg).toMatch(/schon/i);
});

test("useConsumable: ohne Bestand false, mit Bestand true + Dekrement", () => {
  expect(Game.useConsumable("fernrohr")).toBe(false); // nichts da
  Game.state.inventory["fernrohr"] = 2;
  expect(Game.useConsumable("fernrohr")).toBe(true);
  expect(Game.state.inventory["fernrohr"]).toBe(1);
});

/* ---------- Spaced Repetition (Leitner) ---------- */

test("reviewResult: richtig schiebt die Box hoch (max 5), falsch setzt auf 1 zurück", () => {
  Game.ensureReviewItem("k1");
  expect(Game.state.review["k1"].box).toBe(1);
  Game.reviewResult("k1", true);
  expect(Game.state.review["k1"].box).toBe(2);       // richtig -> hoch
  Game.reviewResult("k1", false);
  expect(Game.state.review["k1"].box).toBe(1);       // falsch -> komplett zurück

  // Deckel bei 5
  for (let i = 0; i < 10; i++) Game.reviewResult("k1", true);
  expect(Game.state.review["k1"].box).toBe(5);
});

test("dueReviewItems: liefert nur fällige Karten, niedrigste Box zuerst", () => {
  const heute = Game.state.streak.lastDay; // today() wurde beim reset gesetzt
  // fällig, hohe Box
  Game.state.review["spaeter"] = { box: 4, due: heute };
  // fällig, niedrige Box -> soll zuerst kommen
  Game.state.review["zuerst"] = { box: 1, due: heute };
  // NICHT fällig (Zukunft) -> darf nicht auftauchen
  Game.state.review["nicht-faellig"] = { box: 1, due: heute + 5 };

  const due = Game.dueReviewItems(10);
  expect(due).toContain("zuerst");
  expect(due).toContain("spaeter");
  expect(due).not.toContain("nicht-faellig"); // Negativfall
  expect(due.indexOf("zuerst")).toBeLessThan(due.indexOf("spaeter")); // Sortierung
});

test("registerQuestCards: hängt die EXTRA_CARDS des Kapitels in die Wiederholung ein", () => {
  Game.registerQuestCards("q10");
  // aus EXTRA_CARDS q10 (inkl. der in #5 ergänzten Tool-Karten)
  expect(Game.state.review["q-tools-stack"]).toBeTruthy();
  expect(Game.state.review["q-tools-monitoring"]).toBeTruthy();
});
