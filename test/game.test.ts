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
let SaveStore: typeof import("../src/store").SaveStore;

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
  ({ SaveStore } = await import("../src/store"));
});

beforeEach(() => {
  Game.reset();          // frischer Default-Spielstand (xp 0, coins 40)
  Game.sim = new Sim({}); // leerer Cluster als bekannte Basis
});

/* ---------- Audio-Einstellungen (#47) ---------- */

test("defaultState: Audio ist standardmäßig an, mit gesetzten Lautstärken", () => {
  expect(Game.state.audio).toEqual({ music: true, sfx: true, musicVol: 0.5, sfxVol: 0.8, track: "hafen" });
});

test("load: alter Spielstand OHNE audio-Feld bekommt die Audio-Defaults", () => {
  // Stand wie vor #47 gespeichert: keine audio-Eigenschaft.
  Game.importData(JSON.stringify({ v: 1, data: { xp: 5, coins: 99 } }));
  Game.load();
  expect(Game.state.coins).toBe(99);                 // Altdaten erhalten
  expect(Game.state.audio).toEqual({ music: true, sfx: true, musicVol: 0.5, sfxVol: 0.8, track: "hafen" });
});

test("load: kaputte/fremde audio-Werte fallen auf Defaults zurück bzw. werden geklemmt", () => {
  // music gültig (false bleibt), sfx falscher Typ -> Default true,
  // musicVol über 1 -> auf 1 geklemmt, sfxVol negativ -> auf 0 geklemmt.
  Game.importData(JSON.stringify({ v: 1, data: { audio: { music: false, sfx: "ja", musicVol: 5, sfxVol: -2 } } }));
  Game.load();
  expect(Game.state.audio).toEqual({ music: false, sfx: true, musicVol: 1, sfxVol: 0, track: "hafen" });
});

/* ---------- Spiel-Feel: Cozy-Modus (#71) ---------- */

test("defaultState: Spiel-Feel steht standardmäßig auf 'normal'", () => {
  expect(Game.state.settings).toEqual({ events: "normal" });
});

test("load: alter Spielstand OHNE settings-Feld bekommt 'normal'", () => {
  // Stand wie vor #71 gespeichert: keine settings-Eigenschaft.
  Game.importData(JSON.stringify({ v: 1, data: { xp: 5, coins: 99 } }));
  Game.load();
  expect(Game.state.coins).toBe(99);                 // Altdaten erhalten
  expect(Game.state.settings).toEqual({ events: "normal" });
});

test("load: unbekannte/kaputte Spiel-Feel-Stufe fällt auf 'normal' zurück", () => {
  Game.importData(JSON.stringify({ v: 1, data: { settings: { events: "ultrahart" } } }));
  Game.load();
  expect(Game.state.settings.events).toBe("normal");
  // auch ganz falscher Typ:
  Game.importData(JSON.stringify({ v: 1, data: { settings: 42 } }));
  Game.load();
  expect(Game.state.settings.events).toBe("normal");
});

test("setEventMode: setzt gültige Stufe + persistiert, ignoriert Unsinn", () => {
  Game.setEventMode("cozy");
  expect(Game.state.settings.events).toBe("cozy");
  Game.load(); // aus dem Speicher neu laden -> beweist Persistenz
  expect(Game.state.settings.events).toBe("cozy");

  Game.setEventMode("quatsch" as never);
  expect(Game.state.settings.events).toBe("cozy"); // unveränderter Wert
});

test("eventProfile: normal/cozy/off liefern die richtigen Stellschrauben", () => {
  Game.setEventMode("normal");
  expect(Game.eventProfile()).toMatchObject({ enabled: true, malusFactor: 0, spawnScale: 1 });
  Game.setEventMode("cozy");
  expect(Game.eventProfile()).toMatchObject({ enabled: true, malusFactor: 0.5 });
  expect(Game.eventProfile().spawnScale).toBeGreaterThan(1); // seltener
  Game.setEventMode("off");
  expect(Game.eventProfile()).toMatchObject({ enabled: false, malusFactor: 1 });
  expect(Game.eventProfile().spawnScale).toBe(Infinity); // nie
});

test("incomeRate: Cozy mildert den Verdienst-Malus, Aus hebt ihn auf", () => {
  const cluster = {
    deployments: [
      { name: "gesund", image: "nginx", replicas: 2 },                          // 2 * 0.5 = 1.0
      { name: "kaputt", image: "x", replicas: 4, broken: { type: "imagepull" } }, // 4 Replicas
    ],
  };
  // normal: kaputte Replicas tragen 0 bei -> nur die 2 gesunden zählen.
  Game.setEventMode("normal");
  Game.sim = new Sim(cluster);
  expect(Game.incomeRate()).toBe(1.0);

  // cozy: kaputte zahlen halb -> (2 + 4*0.5) * 0.5 = (2 + 2) * 0.5 = 2.0
  Game.setEventMode("cozy");
  Game.sim = new Sim(cluster);
  expect(Game.incomeRate()).toBe(2.0);

  // off: kein Malus -> alle 6 Replicas zählen voll -> 6 * 0.5 = 3.0
  Game.setEventMode("off");
  Game.sim = new Sim(cluster);
  expect(Game.incomeRate()).toBe(3.0);
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

test("freeReviewItems: liefert ALLE Karten (auch nicht fällige) und ändert den SR-Plan nicht", () => {
  const heute = Game.state.streak.lastDay;
  Game.state.review["faellig"] = { box: 1, due: heute };
  Game.state.review["nicht-faellig"] = { box: 3, due: heute + 5 };

  const free = Game.freeReviewItems(10);
  expect(free).toContain("faellig");
  expect(free).toContain("nicht-faellig");           // Kern: nicht-fällige Karten sind beim freien Üben dabei
  expect(free.length).toBe(2);
  for (const id of free) expect(Game.state.review[id]).toBeTruthy(); // nur echte Karten

  // read-only: Box/Fälligkeit dürfen sich NICHT verändert haben
  expect(Game.state.review["nicht-faellig"].box).toBe(3);
  expect(Game.state.review["nicht-faellig"].due).toBe(heute + 5);

  // limit deckelt die Anzahl
  expect(Game.freeReviewItems(1).length).toBe(1);
});

test("registerQuestCards: hängt die EXTRA_CARDS des Kapitels in die Wiederholung ein", () => {
  Game.registerQuestCards("q10");
  // aus EXTRA_CARDS q10 (inkl. der in #5 ergänzten Tool-Karten)
  expect(Game.state.review["q-tools-stack"]).toBeTruthy();
  expect(Game.state.review["q-tools-monitoring"]).toBeTruthy();
});

/* ---------- Defensive Validierung beim Laden (#61) ----------
 * Ein manipulierter Import oder ein über viele Versionen gewanderter Stand kann
 * kaputte/fremde Feldwerte tragen. load() muss daraus IMMER einen konsistenten
 * State machen (kein Crash, keine NaN-Münzen), statt den Müll zu übernehmen.
 * lastSeen wird in den Tests auf 0 gesetzt, damit keine Offline-Einnahmen die
 * geprüften Münzen verändern.
 *
 * Red-Green: mit dem früheren Object.assign(makeDefaultState(), data) blieben
 * String-Münzen, Fremd-Einträge und kaputte Review-Einträge stehen – diese
 * Tests wären rot. */

test("load: kaputte Zahlenfelder (String-Münzen, negative XP) fallen auf Defaults zurück", () => {
  SaveStore.writeState({
    coins: "viel",   // falscher Typ -> KEINE String/NaN-Münzen
    xp: -50,         // negativ = unplausibel
    questIdx: -3,    // negativer Index
    taskIdx: 2.7,    // krumm -> abgerundet
    lastSeen: 0,     // keine Offline-Einnahmen
  } as Parameters<typeof SaveStore.writeState>[0]);
  Game.load();

  expect(Game.state.coins).toBe(40);              // Default, sauber
  expect(Number.isFinite(Game.state.coins)).toBe(true);
  expect(Game.state.xp).toBe(0);
  expect(Game.state.questIdx).toBe(0);
  expect(Game.state.taskIdx).toBe(2);             // 2.7 -> 2 (ganzzahliger Index)
});

test("load: kaputte Sammlungen/Typen werden gefiltert oder verworfen", () => {
  SaveStore.writeState({
    completedQuests: "q1,q2",                       // String statt Array
    owned: ["pet-1", 42, null, "flag"],             // fremde Einträge
    inventory: { potion: 3, ghost: -1, bad: "x" },  // negativ/Nicht-Zahl raus
    character: "Hans",                              // soll number|null sein
    activePet: 7,                                   // soll string|null sein
    review: { good: { box: 2, due: 5 }, bad: "kaputt", over: { box: 99, due: 1 } },
    lastSeen: 0,
  } as Parameters<typeof SaveStore.writeState>[0]);
  Game.load();

  expect(Game.state.completedQuests).toEqual([]);          // String war kein Array
  expect(Game.state.owned).toEqual(["pet-1", "flag"]);     // nur Strings bleiben
  expect(Game.state.inventory).toEqual({ potion: 3 });     // negativ/Nicht-Zahl entfernt
  expect(Game.state.character).toBe(null);                 // falscher Typ -> null
  expect(Game.state.activePet).toBe(null);                 // falscher Typ -> null
  expect(Game.state.review.good).toEqual({ box: 2, due: 5 });
  expect(Game.state.review.bad).toBeUndefined();           // kaputter Eintrag verworfen
  expect(Game.state.review.over.box).toBe(5);              // box auf 1..5 geklemmt
});

test("load: völlig kaputter Stand (kein Objekt) startet sauber mit Defaults, kein Crash", () => {
  SaveStore.write(JSON.stringify({ v: 1, data: 12345 })); // data ist eine Zahl, kein State
  Game.load();
  expect(Game.state.coins).toBe(40);
  expect(Game.state.xp).toBe(0);
  expect(Array.isArray(Game.state.owned)).toBe(true);
});

test("load: ein VOLLSTÄNDIG valider Stand überlebt unverändert (kein Over-Sanitizing)", () => {
  SaveStore.writeState({
    xp: 320, coins: 99, character: 2, player: { x: 100, y: 200 },
    questIdx: 4, questStep: 1, taskIdx: 0,
    completedQuests: ["q1", "q2"], inventory: { potion: 2 }, owned: ["pet-cat"],
    activePet: "pet-cat", activeFlag: null,
    review: { "q-ch1-1": { box: 3, due: 10 } },
    streak: { count: 5, lastDay: 999999 }, streakHintShown: true,
    stats: { commands: 10, reviews: 4, quizRight: 7, quizWrong: 2, piratesBeaten: 1, krakenBeaten: 0, stackBest: 30, stormsFixed: 3 },
    lastSeen: 0, clusterSnapshot: null,
  } as Parameters<typeof SaveStore.writeState>[0]);
  Game.load();

  expect(Game.state.xp).toBe(320);
  expect(Game.state.coins).toBe(99);
  expect(Game.state.character).toBe(2);
  expect(Game.state.player).toEqual({ x: 100, y: 200 });
  expect(Game.state.questIdx).toBe(4);
  expect(Game.state.completedQuests).toEqual(["q1", "q2"]);
  expect(Game.state.owned).toEqual(["pet-cat"]);
  expect(Game.state.inventory).toEqual({ potion: 2 });
  expect(Game.state.review["q-ch1-1"]).toEqual({ box: 3, due: 10 });
  expect(Game.state.streakHintShown).toBe(true);
  expect(Game.state.stats.stackBest).toBe(30);
  expect(Game.state.stats.stormsFixed).toBe(3);            // dynamische Zusatz-Stat bleibt
});

test("Wiederholungs-Gate (#222): greift nur am Quest-Anfang, wenn Karten fällig sind", () => {
  Game.state.questStep = 0;
  // Keine fälligen Karten -> kein Gate (blockiert nicht)
  expect(Game.shouldReviewGate()).toBe(false);
  // Eine fällige Karte (due in der Vergangenheit) am Quest-Anfang -> Gate
  Game.state.review["q-ch1-1"] = { box: 1, due: 0 };
  expect(Game.dueReviewItems().length).toBeGreaterThan(0);
  expect(Game.shouldReviewGate()).toBe(true);
  // Mitten in der Quest (Schritt > 0) -> NICHT unterbrechen
  Game.state.questStep = 3;
  expect(Game.shouldReviewGate()).toBe(false);
});

test("Wiederholungs-Gate (#222): nicht fällige Karten blockieren nicht", () => {
  Game.state.questStep = 0;
  Game.state.review["q-ch1-1"] = { box: 3, due: 9_999_999 }; // weit in der Zukunft
  expect(Game.dueReviewItems().length).toBe(0);
  expect(Game.shouldReviewGate()).toBe(false);
});

test("Wiederholungs-Gate (#222): nach der letzten Quest kein Gate", () => {
  Game.state.questStep = 0;
  Game.state.review["q-ch1-1"] = { box: 1, due: 0 };
  Game.state.questIdx = KQContent.QUESTS.length; // alle Quests durch
  expect(Game.currentQuest()).toBe(null);
  expect(Game.shouldReviewGate()).toBe(false);
});
