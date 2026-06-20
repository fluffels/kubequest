/* Lernreihenfolge-Wächter (#235): Bei Kralle darf nie eine Karte im
 * Wiederhol-/Quiz-Pool landen, deren Konzept im Spiel noch nicht eingeführt wurde.
 *
 * Der Test fährt die ECHTE Freischalt-Logik (game.ts → registerQuestCards) in
 * Spielreihenfolge ab und vergleicht je Karte die Freischalt-Position mit der
 * Einführungs-Position ihres Konzepts. Deckt alle drei Pool-Quellen ab:
 * EXTRA_CARDS-Map, Choice-`reviewId`, CMD_CARDS.chapter.
 *
 * game.ts setzt beim Import (window as any).Game und nutzt localStorage – im
 * Node-Lauf stubben wir window vorher und importieren das Modul dann dynamisch.
 */
import { test, expect, beforeAll, beforeEach } from "vitest";
import { vi } from "vitest";
import { KQContent } from "../src/content";
import { CONCEPT_INTRO, lernpfadVerstoesse } from "../src/content/learnorder";

let Game: typeof import("../src/game").Game;

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
});

beforeEach(() => Game.reset());

/** Spielreihenfolge = Reihenfolge im QUESTS-Array (NICHT die Nummer). */
function questIndex(): Record<string, number> {
  const idx: Record<string, number> = {};
  KQContent.QUESTS.forEach((q, i) => { idx[q.id] = i; });
  return idx;
}

/** Früheste Quest-Position, an der jede Karte über IRGENDEINE Quelle in den Pool
 *  kommt – ermittelt über die echte registerQuestCards-Logik. */
function unlockOrder(): Record<string, number> {
  Game.reset();
  const first: Record<string, number> = {};
  KQContent.QUESTS.forEach((q, i) => {
    Game.registerQuestCards(q.id);
    for (const id of Object.keys(Game.state.review)) {
      if (first[id] === undefined) first[id] = i;
    }
  });
  return first;
}

/** Karte → früheste In-Context-Einführung: CMD-Karte (chapter) bzw. Choice-Frage
 *  (reviewId) werden per Konstruktion an ihrer Lehrstelle gestellt; ergänzt um die
 *  von Hand gepflegte CONCEPT_INTRO-Map für EXTRA_CARDS-Karten. */
function introOrder(): Record<string, number> {
  const qi = questIndex();
  const intro: Record<string, number> = {};
  const consider = (card: string, questId: string | undefined) => {
    if (questId === undefined || qi[questId] === undefined) return;
    const pos = qi[questId];
    if (intro[card] === undefined || pos < intro[card]) intro[card] = pos;
  };
  // CMD-Karten: chapter = Lehr-Quest
  for (const c of KQContent.CMD_CARDS) consider(c.id, c.chapter);
  // Quiz-Karten mit chapter: ebenfalls per Konstruktion in-order (#371)
  for (const c of KQContent.CRAB_QUIZ) if (c.chapter) consider(c.id, c.chapter);
  // Choice-Fragen: die Quest, in deren Ablauf sie gestellt werden
  for (const q of KQContent.QUESTS) {
    for (const step of q.steps as { type: string; reviewId?: string }[]) {
      if (step.type === "choice" && step.reviewId) consider(step.reviewId, q.id);
    }
  }
  // Konzept-Karten aus EXTRA_CARDS: kuratierte Einführungs-Quest
  for (const [card, questId] of Object.entries(CONCEPT_INTRO)) consider(card, questId);
  return intro;
}

test("Kralle fragt keine Karte ab, deren Konzept noch nicht eingeführt wurde (#235)", () => {
  const verstoesse = lernpfadVerstoesse(unlockOrder(), introOrder());
  expect(verstoesse, "Lernreihenfolge-Verstöße:\n" + verstoesse.join("\n")).toEqual([]);
});

test("jede über EXTRA_CARDS platzierte Konzept-Karte hat eine Einführungs-Quest (#235)", () => {
  // EXTRA-only = im Pool, aber weder CMD-Karte noch Choice-Frage (also nur über die
  // EXTRA_CARDS-Map freigeschaltet). Genau diese Karten MÜSSEN in CONCEPT_INTRO stehen –
  // AUSNAHME: Quiz-Karten mit chapter (#371) sind per Konstruktion in-order, brauchen
  // keinen CONCEPT_INTRO-Eintrag.
  const cmdIds = new Set(KQContent.CMD_CARDS.map(c => c.id));
  const quizWithChapter = new Set(KQContent.CRAB_QUIZ.filter(c => c.chapter).map(c => c.id));
  const choiceIds = new Set<string>();
  for (const q of KQContent.QUESTS) {
    for (const step of q.steps as { type: string; reviewId?: string }[]) {
      if (step.type === "choice" && step.reviewId) choiceIds.add(step.reviewId);
    }
  }
  const fehlend = Object.keys(unlockOrder())
    .filter(id => !cmdIds.has(id) && !choiceIds.has(id) && !quizWithChapter.has(id))
    .filter(id => !(id in CONCEPT_INTRO));
  expect(fehlend, "EXTRA-Karten ohne CONCEPT_INTRO-Eintrag: " + fehlend.join(", ")).toEqual([]);
});

test("jede CONCEPT_INTRO-Karte verweist auf eine existierende Quest", () => {
  const qi = questIndex();
  const kaputt = Object.entries(CONCEPT_INTRO).filter(([, q]) => qi[q] === undefined).map(([c]) => c);
  expect(kaputt, "CONCEPT_INTRO mit unbekannter Quest: " + kaputt.join(", ")).toEqual([]);
});

/* ---- Red-Green: die reine Prüflogik muss Verstöße WIRKLICH fangen ---- */

test("Red-Green: zu früh freigeschaltete Karte wird gemeldet", () => {
  // Karte an Position 3 freigeschaltet, Konzept aber erst an Position 7 eingeführt.
  const v = lernpfadVerstoesse({ "q-ch2-4": 3 }, { "q-ch2-4": 7 });
  expect(v.length).toBe(1);
  expect(v[0]).toContain("q-ch2-4");
});

test("Red-Green: Karte ohne bekannte Einführungs-Quest wird gemeldet", () => {
  const v = lernpfadVerstoesse({ "q-neu": 2 }, {});
  expect(v).toEqual(["q-neu: keine Einführungs-Quest bekannt (in CONCEPT_INTRO eintragen)"]);
});

test("Red-Green: rechtzeitig freigeschaltete Karte ist KEIN Verstoß", () => {
  // gleiche Position (eingeführt == freigeschaltet) und später sind beide ok.
  expect(lernpfadVerstoesse({ a: 7 }, { a: 7 })).toEqual([]);
  expect(lernpfadVerstoesse({ a: 9 }, { a: 7 })).toEqual([]);
});
