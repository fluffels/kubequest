/// <reference types="vite/client" />

// Kein window-Shim mehr (Ticket #10): Die früheren Globals (UI, Game,
// WorldScene, KQKeys, SFX) sind jetzt echte Modul-Exporte. Event-Delegation
// (UI.bindEvents in ui.ts) hat die onclick="UI.x()"-Inline-Handler abgelöst,
// die Laufzeit-Singletons (Tasten, aktive Szene) liegen in src/runtime.ts.

// Eigene Vite-Env-Variablen typisieren (#325). Das Dev-Panel-Passwort kommt aus
// einer gitignored `.env` (Wert nie im Repo) und ist nur im Dev-Build gesetzt –
// im Prod-/Offline-Build fehlt es, deshalb optional (string | undefined).
interface ImportMetaEnv {
  readonly VITE_KQ_DEVPANEL_PW?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Build-Flag (#331): per Vite-`define` gesetztes, statisch foldbares Literal –
// true nur im `--mode devpanel`-Build (liefert das Dev-Panel mit aus), sonst
// false (Panel wird aus build/build:offline rausgestrippt). Siehe vite.config.ts.
declare const __KQ_DEVPANEL__: boolean;
