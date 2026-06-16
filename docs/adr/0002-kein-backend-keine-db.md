# ADR 0002: Kein Backend, keine Datenbank, keine Service-Aufteilung fürs Kern-Spiel

- **Status:** akzeptiert (2026-06-16)
- **Kontext-Ticket:** [#85](https://github.com/fluffels/kubequest/issues/85)
- **Verwandt:** [ADR 0001 – Engine-Wahl Phaser 3](0001-engine-phaser.md) ([#84](https://github.com/fluffels/kubequest/issues/84))

## Kontext

KubeQuest ist ein DevOps-Lernspiel: Die Spielwelt **ist** der Cluster (Docker, Kubernetes, Helm, Terraform). Genau deshalb liegt es reflexhaft nahe, das Spiel selbst „lehrbuchmäßig" als verteiltes System zu bauen – mit Datenbank, eigenem Backend, Frontend-Backend-Split und `docker-compose`. Diese Versuchung taucht in fast jedem zweiten Architektur-Gespräch auf.

Für ein **Single-Player-2D-Lernspiel ist dieser Stack Over-Engineering.** Die Vergleichsgröße (Stardew Valley, unsere Stardew-Messlatte aus #44) hat nichts davon: kein Server, keine DB, keine Container – nur eine lokale Anwendung mit lokalen Speicherständen.

Der Kern-Wert von KubeQuest ist „läuft offline im Browser, eine Datei, einfach verschenkbar, Lern-Tool". Ein Server-Stack würde diesem Wert direkt widersprechen: Er bräuchte Betrieb, Hosting, Online-Zwang und Wartung – für null Spielwert.

## Optionen

1. **Reines Client-Spiel, lokale Saves** (gewählt). Spiellogik + Persistenz laufen vollständig im Client; Speicherstand liegt lokal.
2. **Backend + DB von Anfang an.** „Richtige" Architektur, Cloud-Saves, Accounts – aber Betriebsaufwand, Online-Zwang, Hosting-Kosten und ein kompletter zweiter Tech-Stack, ohne dass das Spiel dadurch besser wird.
3. **Service-Split / `docker-compose` fürs Spiel.** Mikroservices als Selbstzweck (weil das Thema K8s ist) – maximale Komplexität, kein Nutzen für ein Single-Player-Spiel.

## Entscheidung

**Kein Backend, keine Datenbank, kein Service-Split fürs Spiel selbst.**

- **Persistenz = lokale Saves.** Spielstand läuft über die SaveStore-Schicht ([`src/store.ts`](../../src/store.ts)): localStorage + Auto-Save alle 5 s + JSON-Export/Import. Eine Save-Datei via Tauri-Wrapper ist die spätere Desktop-Variante ([#83](https://github.com/fluffels/kubequest/issues/83)) – weiterhin **lokal**, ohne Server.
- **Kein Docker fürs Spiel.** Docker/Cluster ist ausschließlich **Lerninhalt** – im optionalen „echter-Cluster"-Modus ([#28](https://github.com/fluffels/kubequest/issues/28)) bzw. als Meister-Abschluss ([#26](https://github.com/fluffels/kubequest/issues/26)) – **nicht** Betriebsinfrastruktur des Spiels. Die Simulation in [`src/sim.ts`](../../src/sim.ts) bildet den Cluster im Spiel nach, statt einen echten zu betreiben.
- **Keine Service-Aufteilung.** Die Schichtung (pure Domäne ↔ Anwendung ↔ Präsentation, siehe [AGENTS.md › Architektur](../../AGENTS.md#architektur)) ist eine **In-Process-Trennung von Verantwortlichkeiten**, kein verteiltes System.

## Konsequenzen

- **Positiv:** Offline-fähig, eine verschenkbare Datei, null Betriebsaufwand, kein Hosting/keine Kosten, keine Datenschutz-/Account-Last. Die ganze Spiellogik bleibt Phaser-frei und im Node-Test prüfbar (siehe ADR 0001).
- **Negativ / bewusst in Kauf genommen:** keine Cloud-Saves, kein geräteübergreifender Fortschritt, keine serverseitige Lern-Analytik. Speicherstand-Migrationen müssen client-seitig gelöst werden (perspektivisch `version`-Feld + Migration in `store.ts`).
- **Leitplanke:** Wer einen Server-Stack einziehen will, muss diese ADR zuerst kippen – nicht „nebenbei" ein Backend hinzufügen.

## Re-Evaluierungs-Trigger

Diese Entscheidung wird **neu bewertet**, sobald eines davon zwingend wird:

- **Cloud-Saves / Accounts** (geräteübergreifender Fortschritt als echtes Feature-Ziel).
- **Lern-Analytik** über mehrere Spieler hinweg (zentrale Auswertung des Lernfortschritts).
- **Multiplayer** (z. B. kooperatives Cluster-Troubleshooting über mehrere Spieler).

Erst dann ist Backend + DB (und ggf. ein Service-Split) erneut zu prüfen – als bewusste, dokumentierte Neuentscheidung, nicht als schleichende Erweiterung.
