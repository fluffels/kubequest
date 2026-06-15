# ⚓ KubeQuest – Das Hafen-Abenteuer

Ein **2D-Lernspiel** (gebaut mit **Phaser 3**) für Docker, Kubernetes, Helm, Terraform und Security-Grundlagen – von „Helm? Das setzt man doch auf den Kopf?" bis zum souveränen Umgang mit den Profi-Werkzeugen. Du läufst durch die Hafenstadt **Port Kubernia**, löst Quests und funkst echte Befehle an den Cluster.

**Die Spielwelt IST der Cluster:**

- Die drei Stege am Dock = **Nodes**, jede Kiste darauf = ein **Pod** (live!)
- Pod löschen → Kiste platscht ins Wasser, der Kran stellt sofort Ersatz hin (**Self-Healing zum Zugucken**)
- Helm-Releases hissen **Flaggen**, Services leuchten als **Laternen**, Docker-Container stehen als **Fässer** am Dock
- `terraform apply` baut **sichtbar neues Land** ins Meer

## Spielstart

**Entwickeln:** einmalig `npm install`, dann `npm run dev` – startet einen lokalen Server mit Auto-Reload (Vite). Im Browser unter der angezeigten Adresse öffnen.

**Offline spielen / weitergeben:** `npm run build` erzeugt **eine einzige, in sich geschlossene Datei** `dist/index.html` (Code, Grafiken und Engine sind eingebettet). Die kann man **doppelklicken** – läuft komplett offline, ohne Server.

Spielstand speichert automatisch im Browser.

| Taste | Aktion |
|---|---|
| WASD / Pfeile | Laufen |
| E | Reden / Benutzen |
| T | 📻 Funkgerät (Terminal) |
| J | 📜 Logbuch (Questlog) |
| Esc | Fenster schließen |

## Lernen in kleinen Schritten

Jeder Befehl wird **einzeln** eingeführt und sofort geübt:

1. **🆕 Vormachen** – ein NPC erklärt EINEN neuen Befehl (kurz!)
2. **⌨️ Nachtippen** – du tippst ihn selbst im Funkgerät
3. **🏋️ Drills** – Zufalls-Varianten („anderes Image, anderer Name, andere Zahl") bis es sitzt
4. **🤔 Verständnisfrage** – ins Gespräch eingebaut, keine Quiz-Wände
5. **🦀 Krabbe Kralle** – tägliche Karteikarten (Spaced Repetition), falsch Beantwortetes kommt öfter

Dazu kannst du **jederzeit bei jedem NPC üben** (ansprechen → „Üben") – gibt Dublonen!

**21 Quests:** Docker (3) → Kubernetes-Grundlagen (4) → YAML (1) → Helm (3) → Terraform (2) → Security/Secrets (1) → **Sturm-Saison: Troubleshooting (3)** → **Git (2)** → **CI/CD: Pipeline-Passage (1)** + Einstieg.

Die **Pipeline-Passage** (bei Ada, direkt nach den Git-Quests) führt **CI/CD** ein: Eine `.gitlab-ci.yml` im Repo macht aus `git push` Automatik – ein Runner arbeitet die Stages **build → test → deploy** ab, und die deploy-Stage rollt den Dienst **ohne Handarbeit** in den Cluster (`glab ci status` zeigt das Ergebnis). Job-Bezug: genau die GitLab-CI-Deploy-Pipelines aus `roads-deployment`.

Die **Git-Quests** (bei Ada im Kartenhaus, „versioniere deine Seekarten") führen den Versionierungs-Alltag ein: `git init`/`status`/`add`/`commit`/`log` (ändern → vormerken → festhalten) und dann Zweige: `checkout -b`, `merge`, `push`. Echter Job-Bezug (Feature-Branch + Review-/Forward-Merge-Workflow) und Grundlage der späteren CI/CD-„Pipeline-Passage".

Die **Sturm-Saison** (bei Sturmwache Juno am Leuchtturm) lehrt das Debugging-Handwerk wie im echten Betrieb: `ImagePullBackOff` diagnostizieren und mit `kubectl set image` heilen, `CrashLoopBackOff` über die **Logs** verstehen und mit Secret + `rollout restart` beheben, `Pending`-Pods durch neue Nodes (Terraform!) einplanen. Das Mantra: **get pods → describe → logs.** Danach ziehen zufällige **Stürme mit Regen und Donner** auf, die live Deployments kaputtmachen – kaputte Dienste verdienen nichts, bis du sie reparierst!

## Spielsysteme

- **🪙 Hafen-Wirtschaft** – laufende Pods und Services verdienen passiv Dublonen (auch offline, gedeckelt). Gesunder Cluster = volle Kasse!
- **🏴‍☠️ Piraten-Überfälle** – Zufalls-Events: Piraten klauen Pod-Kisten, du stellst den Soll-Zustand unter Zeitdruck wieder her (Incident-Response!). Die Hafen-Kanone aus dem Shop erhöht das Kopfgeld.
- **🐙 Hacker-Krake** – schnüffelt nach Klartext-Daten; nur ein schnell angelegtes Secret vertreibt sie (Security!)
- **🎮 Bos Stapel-Spiel** – Docker-Image-Schichten in der richtigen Reihenfolge stapeln (lehrt Layer & Build-Cache)
- **XP & Ränge** (Landratte → Moses → … → Admiral), Shop mit Haustieren 🐀🦇👻, Schiffsflaggen, Hinweis-Items, 🔥 Tages-Streak

## Projektstruktur

Gebaut mit **Vite** + **TypeScript** (ES-Module). `index.html` lädt nur `src/main.ts`; Vite bündelt den Rest. Phaser kommt als npm-Paket (nicht mehr als Datei im Repo).

```
kubequest/
├── index.html        Einstieg (lädt src/main.ts)
├── style.css         UI (HUD, Dialoge, Funkgerät, Shop, Alarm, Minispiel)
├── package.json      Abhängigkeiten & Skripte (dev/build/test/typecheck)
├── vite.config.ts    Build-Konfiguration (Single-File-Plugin für den Offline-Build)
├── tsconfig.json     TypeScript-Einstellungen
├── assets/           Kenney "Tiny Town" & "Tiny Dungeon" (CC0) + Lizenzen
├── src/
│   ├── main.ts        Start & Tastatur (Einstiegspunkt)
│   ├── sim.ts         Cluster-Simulator (docker, kubectl, helm, terraform, secrets, git)
│   ├── content.ts     Quests, Dialoge, Drills, NPCs, Karteikarten, Minispiel
│   ├── types.ts       Zentrale TypeScript-Typen (GameState, Quest, …)
│   ├── store.ts       Persistenz-Schicht (SaveStore): kapselt localStorage, Andockpunkt fürs spätere Backend
│   ├── game.ts        Spielstand, XP, Wirtschaft, Spaced Repetition
│   ├── scenes.ts      Phaser-Welt: Karte, Cluster-Sync, Piraten, Krake
│   ├── sfx.ts         Mini-Synthesizer (WebAudio-Sounds, keine Audio-Dateien)
│   ├── ui.ts          Dialoge, Quest-Steuerung, Funkgerät, Shop, Quiz, Minispiel
│   ├── assets-data.ts Spritesheets als Base64 (hält den Offline-Build self-contained)
│   └── vite-env.d.ts  Typ-Deklarationen (u.a. window-Shim für Inline-Handler)
├── test/             Test-Suite (Vitest)
│   ├── sim.test.ts      Unit-Tests des Simulators (inkl. Troubleshooting-Pfade)
│   ├── content.test.ts  Konsistenz aller Spielinhalte
│   └── quests.test.ts   spielt die komplette Story + alle Drills durch
└── dist/             Build-Ausgabe von `npm run build` (nicht eingecheckt)
```

Tests ausführen: `npm test` (Vitest). Typen prüfen: `npm run typecheck` (locker, alle Dateien).

**TS-Strenge (Ratchet):** `npm run typecheck:strict` hält die gehärteten Module auf voller Typ-Strenge – `types`, `store`, `content`, `sim` und `game` laufen jetzt komplett `strict` **inklusive `noImplicitAny`** (echte Parameter-/Feld-Typen statt `any`; die Cluster-Interfaces Pod/Deployment/Service … liegen in `src/sim.ts`). So können dort weder Null-/Typ- noch versteckte `any`-Fehler mehr einschleichen. Der Kreis wird Schritt für Schritt erweitert (siehe `tsconfig.strict.json`): als Nächstes `scenes`/`ui` nachziehen, bis am Ende die ganze `tsconfig.json` auf `strict` steht.

## Lizenzen

- **Phaser 3** – MIT-Lizenz (kostenlos, auch kommerziell): https://phaser.io
- **Grafiken** – „Tiny Town" & „Tiny Dungeon" von [Kenney](https://kenney.nl), **CC0** (public domain). Danke, Kenney! 💛
- Sounds werden zur Laufzeit synthetisiert (WebAudio) – keine Audio-Dateien nötig.

## Spielstand

Wird **automatisch alle 5 Sekunden** im Browser gespeichert (localStorage). Im 📜 Logbuch (Taste J) gibt es zusätzlich **„Spielstand sichern“** (lädt eine JSON-Datei herunter) und **„Spielstand laden“** – für Backups oder den Umzug auf einen anderen Rechner/Browser.

## Lernpfad: Von 0 zu Senior DevOps (ehrliche Einordnung)

Das Spiel deckt aktuell **Phase 1 – das Fundament** ab. Senior wird man durch Wissen **plus Betriebserfahrung**; das Spiel baut Wissen und Muskelgedächtnis auf, echte Projekte bauen die Erfahrung.

| Phase | Thema | Status |
|---|---|---|
| 1 | Container, Kubernetes-Basics, YAML, Helm, Terraform, Secrets | ✅ im Spiel (15 Quests) |
| 2 | Git & Branching-Workflows + CI/CD-Pipelines | ✅ im Spiel (Git: 2 Quests bei Ada; CI/CD: „Pipeline-Passage“) |
| 3 | Ingress, DNS, TLS, NetworkPolicies | 🔜 geplant: „Ingress-Inseln“ |
| 4 | GitOps (Argo CD), App-of-Apps, Pull-Prinzip | 🔜 geplant: „GitOps-Archipel“ |
| 5 | Observability: Prometheus, Grafana, Logs, Alerts | 🔜 geplant: „Monitoring-Leuchtturm“ |
| 6 | RBAC, ServiceAccounts, Pod-Security | 🔜 geplant: „Wachturm-Quartier“ |
| 7 | StatefulSets, Volumes, Backups, Datenbanken im Cluster | 🔜 geplant: „Lagerhallen-Viertel“ |
| 8 | Troubleshooting-Methodik (CrashLoop, ImagePull, Pending …) | ✅ im Spiel („Sturm-Saison“: 3 Quests + Zufalls-Stürme) |
| 9 | Terraform-Module, Remote State, Cloud-Provider | 🔜 geplant: „Expeditions-Flotte“ |
| 10 | Eigenes Backend für das Spiel bauen & selbst in K8s deployen | 🔜 der Meister-Abschluss: Spiel trifft Realität |

## Roadmap (nächste Ausbaustufen)

- Phase-2-Inseln (siehe Lernpfad) – je Insel eigene NPCs, Quests und Drills
- **Sturm-Saison**: kaputte Pods debuggen (CrashLoopBackOff, ImagePullBackOff, OOMKilled) als Events
- **Werft-Ausbau**: eigene Helm-Charts schreiben
- **Echter Modus**: dieselben Quests gegen ein lokales kind/minikube-Cluster
- Mehr Grafik: weitere Kenney-Packs (CC0), z.B. Innenräume für betretbare Gebäude
