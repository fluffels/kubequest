/// <reference types="vite/client" />

// Kein window-Shim mehr (Ticket #10): Die früheren Globals (UI, Game,
// WorldScene, KQKeys, SFX) sind jetzt echte Modul-Exporte. Event-Delegation
// (UI.bindEvents in ui.ts) hat die onclick="UI.x()"-Inline-Handler abgelöst,
// die Laufzeit-Singletons (Tasten, aktive Szene) liegen in src/runtime.ts.
