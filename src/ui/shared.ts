// Geteilte UI-Bausteine (#356, ui.ts-Split): read-only DOM-/Content-Helfer ($, esc, NPCS,
// SMALLTALK, shuffled, vorab geladene Porträt-/Shop-Bilder) und der part()-Helper, der die
// Domänen-Methodenbündel typisiert (this = UISelf, permissiv) – die öffentlichen Methoden-
// Signaturen bleiben dabei erhalten (ThisType-Muster). Präsentationsschicht (DOM).
import { KQContent } from "../content";
import { KQAssets } from "../assets-data";

/** this-Typ der UI-Methodenbündel: permissiv, da Methoden quer über Bündel auf this.* zugreifen. */
export type UISelf = Record<string, any>;
/** Typisiert ein Methodenbündel so, dass this = UISelf ist, ohne die Methoden-Signaturen zu verlieren. */
export function part<T>(b: T & ThisType<UISelf>): T { return b; }

// Die DOM-Knoten liegen alle fest in index.html – darum geben wir hier ein
// nicht-nullbares HTMLElement zurück (Migrations-Shim, wie window.* in vite-env.d.ts).
const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;

// NPC-/Smalltalk-Tabellen werden per NPC-Id (Laufzeit-String) nachgeschlagen –
// als String-indizierbare Maps typisiert, statt jeden Zugriff einzeln zu casten.
const NPCS = KQContent.NPCS as Record<string, { name: string; title: string; sprite: number; tex?: string }>;
const SMALLTALK = KQContent.SMALLTALK as Record<string, string[]>;

function esc(s: unknown) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Befehls-Karten im Krabben-Quiz: so viele Tipp-Versuche, bevor die Lösung
// gezeigt und die Karte als "nicht gekonnt" gewertet wird (#234). Jederzeit
// kann man per "Lösung zeigen" früher aussteigen – man hängt also nie fest.
const CMD_MAX_ATTEMPTS = 3;

function shuffled<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Spritesheet-Bilder für Porträts (unabhängig von Phaser, geht auch per file://)
const sheetImgs: Record<string, HTMLImageElement> = {};
const assets = KQAssets as Record<string, string>;
for (const key of ["town", "dungeon"]) {
  const img = new Image();
  img.src = assets[key];
  sheetImgs[key] = img;
}
// PixelLab-NPC-Figuren fürs Dialog-Porträt vorladen (Kopf/Schulter-Ausschnitt)
for (const npc of Object.values(KQContent.NPCS) as any[]) {
  if (npc.tex && assets[npc.tex] && !sheetImgs[npc.tex]) {
    const img = new Image();
    img.src = assets[npc.tex];
    sheetImgs[npc.tex] = img;
  }
}
// PixelLab-Shop-Grafiken (Haustiere) fürs Shop-Icon vorladen
for (const item of KQContent.SHOP as any[]) {
  if (item.tex && assets[item.tex] && !sheetImgs[item.tex]) {
    const img = new Image();
    img.src = assets[item.tex];
    sheetImgs[item.tex] = img;
  }
}


export { $, esc, NPCS, SMALLTALK, CMD_MAX_ATTEMPTS, shuffled, sheetImgs, assets };
