/// <reference types="vite/client" />

// Migrations-Shim: Inline-Handler im HTML (onclick="UI.x()") und einige
// Runtime-Singletons greifen weiterhin auf `window`. ES-Module legen nichts
// global ab, darum hängen wir diese paar Objekte bewusst an window – und
// typisieren sie hier, damit TypeScript sie kennt.
// Folge-Schritt (eigenes Ticket): Event-Delegation, dann fällt dieser Shim weg.
declare global {
  interface Window {
    UI: typeof import("./ui").UI;
    Game: typeof import("./game").Game;
    WorldScene: any;
    KQKeys: Record<string, boolean>;
    SFX?: typeof import("./sfx").SFX;
    webkitAudioContext?: typeof AudioContext;
  }
}

export {};
