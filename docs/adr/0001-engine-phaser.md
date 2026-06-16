# ADR 0001: Engine-Wahl – Phaser 3 behalten (vs. Godot/Unity/MonoGame)

> Architecture Decision Record. Format: Kontext → Optionen → Entscheidung → Konsequenzen → Re-Evaluierung.
> Status: **akzeptiert** · Datum: 2026-06-16 · Ticket: #84

## Status

**Akzeptiert.** Phaser 3 bleibt die Engine von KubeQuest.

## Kontext

Mit wachsendem Ambitions-Level (Richtung Stardew-Politur, siehe #44 und die
Architektur-Analyse [`docs/architektur-analyse-stardew.md`](../architektur-analyse-stardew.md))
kommt regelmäßig die Frage auf: „Sollten wir nicht eine richtige Game-Engine
nehmen?" Diese Diskussion taucht in fast jedem zweiten Chat neu auf und kostet
jedes Mal Zeit. Dieses ADR hält die Entscheidung **einmal sauber fest**, damit
sie nicht ständig neu verhandelt wird.

Der Kern-Wert von KubeQuest ist:

- **Läuft offline im Browser**, als **eine einzige Datei** (`dist-offline/index.html`)
  per Doppelklick startbar, einfach verschenkbar.
- Ist ein **Lern-Tool** für Docker/K8s/Helm/Terraform – kein AAA-Spiel.
- Bleibt ein **2D-Spiel** mit überschaubarer Asset-Menge.

## Optionen

| Option | Bewertung |
|---|---|
| **Phaser 3 (Status quo)** | 2D-Web-Engine, npm-Paket, läuft nativ im Browser. Bereits voll integriert, getestete Phaser-freie Domänen-Schicht, Single-File-Offline-Build vorhanden. |
| **Godot** | Mächtig, gut für 2D, kostenlos. Aber: kompletter Rewrite; Web-Export ist groß und kein „eine HTML-Datei zum Verschenken"; Sprache/Workflow (GDScript/Scenes) komplett anders als die heutige TS-Domänenlogik. |
| **Unity** | Großes Ökosystem, aber für ein 2D-Lernspiel massiv überdimensioniert; WebGL-Build schwergewichtig; Lizenz-/Tooling-Overhead. Kompletter Rewrite. |
| **MonoGame** | Code-zentriert (C#), aber kein einfacher Web-/Offline-Pfad; kompletter Rewrite ohne nennenswerten Gewinn für 2D-Web. |

## Entscheidung

**Phaser 3 behalten.** Begründung:

- Der Kern-Wert (offline, eine Datei, verschenkbar, Lern-Tool) ist **genau
  Phasers Stärke** – jede Alternative würde ihn schwächen.
- Godot/Unity/MonoGame wären ein **kompletter Rewrite** für nur marginalen
  Gewinn bei einem 2D-Lernspiel.
- Die heutige Architektur trägt das Wachstum bereits: Die Spiellogik ist
  **Phaser-frei und unit-testbar** (Domäne ↔ Anwendung ↔ Präsentation), nur
  `scenes.ts`/`ui.ts` fassen Phaser an. Ein Engine-Wechsel wäre also vor allem
  ein Austausch der Präsentationsschicht – aber dafür gibt es heute keinen
  zwingenden Grund.
- **Native Distribution** („doppelklicken wie Stardew", Steam) ist über einen
  **Wrapper** erreichbar (#83 Tauri-Evaluierung), **ohne** die Engine zu
  wechseln.

## Konsequenzen

**Positiv**

- Schluss mit der wiederkehrenden „Engine wechseln?"-Diskussion – auf dieses ADR
  verweisen.
- Investitionen fließen in Inhalt, Politur und Asset-Pipeline statt in einen
  Rewrite.
- Der Offline-Single-File-Build bleibt als Alleinstellungsmerkmal erhalten.

**Negativ / Grenzen**

- An echte 3D-Anforderungen oder sehr hohe native Performance kommt Phaser nicht
  heran – das ist bewusst außerhalb des Scopes von KubeQuest.
- Wir binden uns an das Phaser-/Web-Ökosystem (Browser-Rendering-Grenzen).

## Re-Evaluierungs-Trigger

Diese Entscheidung wird neu aufgemacht, wenn **einer** dieser Fälle eintritt:

- **3D wird zwingend** für ein Spielziel (nicht nur „nice to have").
- **Native Performance** wird zum harten Blocker, den der Browser nicht mehr
  schafft (große Welten, viele Entities) und der auch durch Optimierung nicht
  lösbar ist.
- Der **Offline-eine-Datei-Wert** entfällt als Anforderung – dann öffnet sich
  der Optionsraum wieder.
- Phaser 3 wird **nicht mehr gepflegt** / verliert den Web-Support.

Tritt ein Trigger ein: neues ADR (`0002-…`) mit aktualisierter Abwägung
schreiben, dieses hier auf „abgelöst durch 0002" setzen.
