# ⚓ KubeQuest – Das Hafen-Abenteuer

Ein **2D-Lernspiel** (gebaut mit **Phaser 3**) für Docker, Kubernetes, Helm, Terraform und Security-Grundlagen – von „Helm? Das setzt man doch auf den Kopf?" bis zum souveränen Umgang mit den Profi-Werkzeugen. Du läufst durch die Hafenstadt **Port Kubernia**, löst Quests und funkst echte Befehle an den Cluster.

**Die Spielwelt IST der Cluster:**

- Die drei Stege am Dock = **Nodes**, jede Kiste darauf = ein **Pod** (live!)
- Pod löschen → Kiste platscht ins Wasser, der Kran stellt sofort Ersatz hin (**Self-Healing zum Zugucken**)
- Helm-Releases hissen **Flaggen**, Services leuchten als **Laternen**, Docker-Container stehen als **Fässer** am Dock
- `terraform apply` baut **sichtbar neues Land** ins Meer

## Spielstart

**`index.html` doppelklicken** – fertig. Läuft komplett lokal im Browser (die Grafiken sind eingebettet, deshalb braucht auch Phaser keinen Server). Spielstand speichert automatisch im Browser.

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

**15 Quests:** Docker (3) → Kubernetes-Grundlagen (4) → YAML (1) → Helm (3) → Terraform (2) → Security/Secrets (1) + Einstieg.

## Spielsysteme

- **🪙 Hafen-Wirtschaft** – laufende Pods und Services verdienen passiv Dublonen (auch offline, gedeckelt). Gesunder Cluster = volle Kasse!
- **🏴‍☠️ Piraten-Überfälle** – Zufalls-Events: Piraten klauen Pod-Kisten, du stellst den Soll-Zustand unter Zeitdruck wieder her (Incident-Response!). Die Hafen-Kanone aus dem Shop erhöht das Kopfgeld.
- **🐙 Hacker-Krake** – schnüffelt nach Klartext-Daten; nur ein schnell angelegtes Secret vertreibt sie (Security!)
- **🎮 Bos Stapel-Spiel** – Docker-Image-Schichten in der richtigen Reihenfolge stapeln (lehrt Layer & Build-Cache)
- **XP & Ränge** (Landratte → Moses → … → Admiral), Shop mit Haustieren 🐀🦇👻, Schiffsflaggen, Hinweis-Items, 🔥 Tages-Streak

## Projektstruktur

```
kubequest/
├── index.html        Einstieg (doppelklicken!)
├── style.css         UI (HUD, Dialoge, Funkgerät, Shop, Alarm, Minispiel)
├── assets/           Kenney "Tiny Town" & "Tiny Dungeon" (CC0) + Lizenzen
├── js/
│   ├── phaser.min.js Phaser 3 Engine (MIT-Lizenz, kostenlos)
│   ├── assets-data.js Spritesheets als Base64 (ermöglicht Doppelklick-Start)
│   ├── sim.js        Cluster-Simulator (docker, kubectl, helm, terraform, secrets)
│   ├── content.js    Quests, Dialoge, Drills, NPCs, Karteikarten, Minispiel
│   ├── game.js       Spielstand, XP, Wirtschaft, Spaced Repetition
│   ├── scene.js      Phaser-Welt: Karte, Cluster-Sync, Piraten, Krake, Sound
│   ├── ui.js         Dialoge, Quest-Steuerung, Funkgerät, Shop, Quiz, Minispiel
│   └── main.js       Start & Tastatur
└── test/smoke.js     Test: spielt alle Quests & Drills automatisch durch
```

Test ausführen: `node test/smoke.js`

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
| 2 | Git & Branching-Workflows, CI/CD-Pipelines | 🔜 geplant: „Pipeline-Passage“ |
| 3 | Ingress, DNS, TLS, NetworkPolicies | 🔜 geplant: „Ingress-Inseln“ |
| 4 | GitOps (Argo CD), App-of-Apps, Pull-Prinzip | 🔜 geplant: „GitOps-Archipel“ |
| 5 | Observability: Prometheus, Grafana, Logs, Alerts | 🔜 geplant: „Monitoring-Leuchtturm“ |
| 6 | RBAC, ServiceAccounts, Pod-Security | 🔜 geplant: „Wachturm-Quartier“ |
| 7 | StatefulSets, Volumes, Backups, Datenbanken im Cluster | 🔜 geplant: „Lagerhallen-Viertel“ |
| 8 | Troubleshooting-Methodik (CrashLoops, OOM, Pending Pods …) | 🔜 geplant: „Sturm-Saison“ (Incident-Events) |
| 9 | Terraform-Module, Remote State, Cloud-Provider | 🔜 geplant: „Expeditions-Flotte“ |
| 10 | Eigenes Backend für das Spiel bauen & selbst in K8s deployen | 🔜 der Meister-Abschluss: Spiel trifft Realität |

## Roadmap (nächste Ausbaustufen)

- Phase-2-Inseln (siehe Lernpfad) – je Insel eigene NPCs, Quests und Drills
- **Sturm-Saison**: kaputte Pods debuggen (CrashLoopBackOff, ImagePullBackOff, OOMKilled) als Events
- **Werft-Ausbau**: eigene Helm-Charts schreiben
- **Echter Modus**: dieselben Quests gegen ein lokales kind/minikube-Cluster
- Mehr Grafik: weitere Kenney-Packs (CC0), z.B. Innenräume für betretbare Gebäude
