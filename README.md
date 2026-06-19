# ⚓ KubeQuest – Das Hafen-Abenteuer

[![CI](https://github.com/fluffels/kubequest/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/fluffels/kubequest/actions/workflows/ci.yml)

> **🚧 Work in Progress** – KubeQuest ist in aktiver Entwicklung. Bugs und unfertige Ecken sind möglich.
> Hast du etwas gefunden oder eine Idee? Meld dich gern in den **[GitHub Discussions](https://github.com/fluffels/kubequest/discussions)** – einfach lostippen (GitHub-Login nötig).

Ein **2D-Lernspiel** (gebaut mit **Phaser 3**) für Docker, Kubernetes, Helm, Terraform und Security-Grundlagen – von „Helm? Das setzt man doch auf den Kopf?" bis zum souveränen Umgang mit den Profi-Werkzeugen. Du läufst durch die Hafenstadt **Port Kubernia**, löst Quests und funkst echte Befehle an den Cluster.

**Die Spielwelt IST der Cluster:**

- Die drei Stege am Dock = **Nodes**, jede Kiste darauf = ein **Pod** (live!)
- Pod löschen → Kiste platscht ins Wasser, der Kran stellt sofort Ersatz hin (**Self-Healing zum Zugucken**)
- Helm-Releases hissen **Flaggen**, Services leuchten als **Laternen**, Docker-Container stehen als **Fässer** am Dock
- `terraform apply` baut **sichtbar neues Land** ins Meer

## Spielstart

**Entwickeln:** einmalig `npm install`, dann `npm run dev` – startet einen lokalen Server mit Auto-Reload (Vite). Im Browser unter der angezeigten Adresse öffnen.

**Offline spielen / weitergeben:** `npm run build:offline` erzeugt **eine einzige, in sich geschlossene Datei** `dist-offline/index.html` (Code, Grafiken und Engine sind eingebettet). Die kann man **doppelklicken** – läuft komplett offline, ohne Server.

**Hosten / auf einen Webserver legen:** `npm run build` erzeugt das normale Bündel nach `dist/` (Grafiken als eigene, einzeln cachebare Dateien). Das ist der Standard-Build zum Ausliefern über einen Server; lokal ansehen mit `npm run preview`.

Spielstand speichert automatisch im Browser.

| Taste | Aktion |
|---|---|
| WASD / Pfeile | Laufen |
| E | Reden / Benutzen |
| T | 📻 Funkgerät (Terminal) |
| J | 📜 Logbuch (Questlog) |
| Esc | Fenster schließen |

Im 📜 **Logbuch (J)** blätterst du durch alle Quests: abgeschlossene zum **Nachlesen** (Dialoge & Hinweise), deine aktuelle Quest, und noch **gesperrte** als Vorschau (kein Vorausspringen). Es wird freigeschaltet, sobald du deine erste Quest abgeschlossen hast.

## Lernen in kleinen Schritten

Jeder Befehl wird **einzeln** eingeführt und sofort geübt:

1. **🆕 Vormachen** – ein NPC erklärt EINEN neuen Befehl (kurz!)
2. **⌨️ Nachtippen** – du tippst ihn selbst im Funkgerät
3. **🏋️ Drills** – Zufalls-Varianten („anderes Image, anderer Name, andere Zahl") bis es sitzt
4. **🤔 Verständnisfrage** – ins Gespräch eingebaut, keine Quiz-Wände
5. **🦀 Krabbe Kralle** – tägliche Karteikarten (Spaced Repetition), falsch Beantwortetes kommt öfter; bei Befehls-Karten darfst du nach einem Fehler den Befehl **erneut eintippen** (Lösung gibt's auf Wunsch oder nach ein paar Versuchen)

Dazu kannst du **jederzeit bei jedem NPC üben** (ansprechen → „Üben") – gibt Dublonen!

**38 Quests:** Einstieg (1) → Docker (5) → Kubernetes-Grundlagen (4) → YAML (1) → Helm (3) → Terraform (2) → Security/Secrets (2) → **Sturm-Saison: Troubleshooting (3)** → **Git (3)** → **CI/CD: Pipeline-Passage (1)** → **Werft-Ausbau: eigenes Helm-Chart (1)** → **Hafenmauer: NetworkPolicy (1)** → **Hafentor: Ingress/TLS (1)** → **Service-Endpoints-Debugging (1)** → **Resource-Management: requests/limits & OOMKilled (1)** → **GitOps-Archipel: GitOps-Prinzip → Argo CD Application & Sync → Self-Heal & Drift → App-of-Apps (4)** → **Monitoring-Leuchtturm: Metriken scrapen — Prometheus & kubectl top (1); Grafana-Dashboard — Datasource & Panels lesen (1); Logs lesen — kubectl logs, -f, --previous (1); Alerts & PrometheusRule — feuern, verstehen, auflösen (1)**.

Die **Hafenmauer** (bei Sturmwache Juno) führt **NetworkPolicies** ein: Kubernetes ist von Haus aus offen – jeder Pod erreicht jeden. Eine NetworkPolicy schaltet die per Label gewählten Pods auf **default-deny** und lässt nur erlaubte Quellen durch (`kubectl get/describe/apply/delete networkpolicy`). Genau so sichert man im Job z.B. Datenbanken ab.

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

Gebaut mit **Vite** + **TypeScript** (ES-Module) und **Phaser 3** (als npm-Paket, nicht mehr als Datei im Repo). `index.html` lädt nur `src/main.ts`; Vite bündelt den Rest. Es gibt zwei Build-Wege aus derselben Quelle: den Standard-Build (`npm run build` → `dist/`, gehostet, Assets als eigene Dateien) und den Offline-Export (`npm run build:offline` → self-contained `dist-offline/index.html` für den Doppelklick). Der Code ist in Schichten geordnet (pure Domäne → Anwendung → Präsentation), damit die Spiellogik ohne Phaser testbar bleibt.

Grobe Aufteilung:

```
kubequest/
├── index.html        Dev-Einstieg (lädt src/main.ts; braucht den Vite-Server)
├── style.css         UI (HUD, Dialoge, Funkgerät, Shop, Alarm, Minispiel)
├── src/              Spielcode
│   ├── sim.ts         Cluster-Simulator (docker, kubectl, helm, terraform, secrets, git)
│   ├── content.ts     Fassade über src/content/ (Quests, Drills, Quiz, NPCs, Minispiel …)
│   ├── game.ts        Spielstand, XP, Wirtschaft, Spaced Repetition
│   ├── scenes.ts      Phaser-Welt: Karte, Cluster-Sync, Piraten, Krake
│   └── …              ui, world, decor, clock, runtime, store, sfx, types, assets-data
├── test/             Test-Suite (Vitest) – Simulator, Inhalte, kompletter Story-Durchlauf u.a.
├── assets/           Kenney- & PixelLab-Grafiken (CC0) + Lizenzen
├── docs/             Konzept- & Architektur-Analysen
├── dist/             Host-Build von `npm run build` (Multi-File, nicht eingecheckt)
└── dist-offline/     Offline-Build von `npm run build:offline` (eine self-contained index.html, nicht eingecheckt)
```

> **Datei-für-Datei-Landkarte** (welches Modul macht was, Schicht für Schicht) steht in **[CLAUDE.md › Repo-Landkarte](CLAUDE.md)**, die Agenten-Regeln & Konventionen in **[AGENTS.md](AGENTS.md)**. Diese Listen werden dort gepflegt – hier bewusst nicht doppelt.

Tests ausführen: `npm test` (Vitest). Typen prüfen: `npm run typecheck` (voll strict, ganzes Projekt).

**TS-Strenge:** Der schrittweise Strenge-Ratchet ist **abgeschlossen** – die Basis-`tsconfig.json` steht selbst auf `"strict": true` und deckt das **ganze Projekt** ab: alle `src`-Module (inkl. `scenes`, `ui`, `main`, `sfx`), die Tests und `vite.config`. Echte Parameter-/Feld-Typen statt `any`, durchgängige Null-Prüfung; die Cluster-Interfaces Pod/Deployment/Service … liegen in `src/sim.ts`. So können weder Null-/Typ- noch versteckte `any`-Fehler mehr einschleichen. `npm run typecheck` prüft das; `npm run typecheck:strict` ist nur noch ein Alias darauf (siehe `tsconfig.strict.json`).

## Lizenzen

- **Phaser 3** – MIT-Lizenz (kostenlos, auch kommerziell): https://phaser.io
- **Grafiken (eigener Pixel-Art-Stil)** – mit **[PixelLab AI](https://pixellab.ai)** im Top-down-Pixel-Art-Look erzeugt; sie ersetzen nach und nach die ursprünglichen Platzhalter. Asset-Liste, IDs & Workflow: [`assets/pixellab/README.md`](assets/pixellab/README.md).
- **Grafiken (Platzhalter)** – „Tiny Town" & „Tiny Dungeon" von [Kenney](https://kenney.nl), **CC0** (public domain), noch für einzelne Tiles im Einsatz, bis der PixelLab-Ersatz steht. Danke, Kenney! 💛
- Sounds werden zur Laufzeit synthetisiert (WebAudio) – keine Audio-Dateien nötig.

## Spielstand

Wird **automatisch alle 5 Sekunden** im Browser gespeichert (localStorage). Im 📜 Logbuch (Taste J) gibt es zusätzlich **„Spielstand sichern“** (lädt eine JSON-Datei herunter) und **„Spielstand laden“** – für Backups oder den Umzug auf einen anderen Rechner/Browser.

## Dev-/Test-Modus (nur für Entwickler:innen)

Für die Entwicklung gibt es ein **Dev-/Test-Panel**, mit dem man gezielt zu einem beliebigen Quest-/Story-Stand springen und Erststart vs. Zurücksetzen testen kann – statt sich jedes Mal von vorn durchzuspielen. Es ist **bewusst nicht für Spieler:innen gedacht** und doppelt abgesichert: Der Code fällt aus den ausgelieferten Builds (`build`/`build:offline`) komplett heraus und ist **nur im Dev-Server** vorhanden, und dort ist der Einstieg zusätzlich **passwortgeschützt**. Das Passwort liegt ausschließlich lokal (in einer nicht eingecheckten `.env`, Vorlage: [`.env.example`](.env.example)) und steht **nicht** im Repo – wer das Projekt klont, kann das Panel ohne eigenen Passwort-Eintrag nicht öffnen.

Zusätzlich gibt es einen **verteilbaren Spezial-Build** (`npm run build:devpanel` → eine self-contained `dist-devpanel/index.html`), der das Panel **mit** ausliefert – z.B. um einen Stand auf einem anderen Rechner zu testen, ohne dort den Dev-Server zu starten. Das Passwort wird dabei **zur Build-Zeit** aus der Umgebungsvariable `VITE_KQ_DEVPANEL_PW` injiziert; in der CI kommt sie aus einem GitHub-Actions-**Secret** (serverseitig, überlebt einen lokalen Rechner-Ausfall – der Wert steht weiterhin nirgends im Repo). Der normale `build`/`build:offline` enthält das Panel weiterhin **nicht**.

## Lernpfad: Von 0 zu Senior DevOps (ehrliche Einordnung)

Das Spiel deckt aktuell **Phase 1 – das Fundament** ab. Senior wird man durch Wissen **plus Betriebserfahrung**; das Spiel baut Wissen und Muskelgedächtnis auf, echte Projekte bauen die Erfahrung.

| Phase | Thema | Status |
|---|---|---|
| 1 | Container, Kubernetes-Basics, YAML, Helm, Terraform, Secrets | ✅ im Spiel (17 Quests, inkl. eigenes Docker-Image bauen & eigenes Helm-Chart „Werft-Ausbau“) |
| 2 | Git & Branching-Workflows + CI/CD-Pipelines | ✅ im Spiel (Git: 3 Quests bei Ada; CI/CD: „Pipeline-Passage“) |
| 3 | Ingress, DNS, TLS, NetworkPolicies | 🟡 teilweise im Spiel: Ingress + TLS („verschlüsseltes Hafentor“ bei Ada) + NetworkPolicies („Hafenmauer“ bei Juno); DNS noch offen |
| 4 | GitOps (Argo CD), App-of-Apps, Pull-Prinzip | ✅ im Spiel: Insel „GitOps-Archipel“ (Anleger/Warp per Steg) mit GitOps-Lotsin Argo – 4 Quests: GitOps-Prinzip & Single Source of Truth → Argo-CD-Application anlegen & syncen (Pull) → Self-Heal & Drift → App-of-Apps |
| 5 | Observability: Prometheus, Grafana, Logs, Alerts | ✅ im Spiel: Klippe „Monitoring-Leuchtturm“ (Aufgang/Warp am Turmfuß, Dashboard-Tafel & Alarm-Glocke) mit Leuchtturmwärterin Lumi – 4 Quests: Metriken scrapen (Prometheus & `kubectl top`, ServiceMonitor) → Grafana-Dashboard (Datasource & Panels lesen) → Logs lesen (`kubectl logs`, `-f`, `--previous`) → Alerts & PrometheusRule (feuern, verstehen, auflösen); dazu Observability-Drills & Quiz-Karten |
| 6 | RBAC, ServiceAccounts, Pod-Security | 🔜 geplant: „Wachturm-Quartier“ |
| 7 | StatefulSets, Volumes, Backups, Datenbanken im Cluster | 🟡 Region begehbar: Hafenkai „Lagerhallen-Viertel“ (Holz-Anleger am Westkai, Verladekräne, Frachtcontainer-Stapel) + Sim-Grundlage (StatefulSet/PVC/PV/StorageClass); NPC + stateful-Quests folgen |
| 8 | Troubleshooting-Methodik (CrashLoop, ImagePull, Pending, Service-Endpoints, OOMKilled …) | ✅ im Spiel („Sturm-Saison“ + Service-Debugging + Resource-Management: 5 Quests + Zufalls-Stürme) |
| 9 | Terraform-Module, Remote State, Cloud-Provider | 🔜 geplant: „Expeditions-Flotte“ |
| 10 | Eigenes Backend für das Spiel bauen & selbst in K8s deployen | 🔜 der Meister-Abschluss: Spiel trifft Realität |

## Roadmap (nächste Ausbaustufen)

- Weitere Lernpfad-Inseln (siehe Tabelle oben) – Monitoring-Leuchtturm, Wachturm-Quartier u.a., je Insel eigene NPCs, Quests und Drills
- **DNS** als letzter offener Baustein von Phase 3 (Ingress, TLS & NetworkPolicies sind schon im Spiel)
- **Echter Modus**: dieselben Quests gegen ein lokales kind/minikube-Cluster
- Mehr Grafik: weitere CC0-Packs, z.B. Innenräume für betretbare Gebäude
