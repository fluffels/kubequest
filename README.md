# ⚓ KubeQuest – Das Hafen-Abenteuer

Ein **2D-Lernspiel** für Kubernetes, Helm und Terraform – von „Helm? Das setzt man doch auf den Kopf?" bis zum souveränen Umgang mit den Profi-Werkzeugen. Du läufst durch die Hafenstadt **Port Kubernia**, löst Quests für die Bewohner:innen und funkst echte Befehle an den Cluster.

**Das Besondere: Die Spielwelt IST der Cluster.**

- Die drei Stege am Dock sind deine **Nodes** – jede Kiste darauf ist ein **Pod**, live aus dem Cluster
- `kubectl scale --replicas=3` → es erscheinen sichtbar Kisten
- `kubectl delete pod …` → die Kiste platscht ins Wasser und der Kran stellt sofort Ersatz hin (**Self-Healing zum Zugucken!**)
- Helm-Releases hissen **Flaggen** an der Werft, Services leuchten als **Laternen**
- `terraform apply` baut **sichtbar neues Land** ins Meer – und `destroy` reißt es wieder ab

## Spielstart

**`index.html` doppelklicken** – fertig. Läuft komplett lokal im Browser, ohne Installation, ohne echtes Cluster. Der Spielstand speichert sich automatisch (localStorage, also immer denselben Browser benutzen).

| Taste | Aktion |
|---|---|
| WASD / Pfeile | Laufen |
| E | Reden / Benutzen |
| T | 📻 Funkgerät (Terminal) |
| J | 📜 Logbuch (Questlog) |
| Esc | Fenster schließen |

## Die Reise (von 0 auf Profi)

1. **Anheuern** – Funkgerät kennenlernen
2. **Bo und die genormten Kisten** – Container & Docker (Images, Container, Registry)
3. **Der Hafen wird ein Cluster** – Kubernetes-Grundlagen (Cluster, Nodes, Pods, kubectl)
4. **Sturmfeste Kisten** – Deployments & Services (Skalieren, Self-Healing live!)
5. **Adas Seekarten** – YAML & deklaratives Arbeiten (Manifeste, apply)
6. **Runas Steuerrad** – Helm (Charts, Releases, values, Upgrade & Rollback)
7. **Neues Land** – Terraform (Infrastructure as Code: init → plan → apply, State)

Dazu: **XP & Ränge** (Landratte → Moses → Deckshand → … → Admiral), **🪙 Dublonen**, ein **Shop** (Hinweis-Fernrohr, Lösungs-Kompass, Haustiere, die dir folgen, Schiffsflaggen) und ein **🔥 Tages-Streak** mit Dublonen-Bonus.

**Damit das Wissen bleibt:** Krabbe Kralle 🦀 auf deinem Schiff stellt dir täglich fällige Karteikarten (Spaced Repetition / Leitner-System). Was du verwechselst, kommt öfter – bis es sitzt. Nach den Quests kannst du im Funkgerät jederzeit **frei üben** – die Welt reagiert weiter auf alles.

## Projektstruktur

```
kubequest/
├── index.html       Einstieg (doppelklicken!)
├── style.css        UI-Design (HUD, Dialoge, Funkgerät, Shop)
├── assets/          Grafiken: Kenney "Tiny Town" & "Tiny Dungeon" (CC0)
├── js/
│   ├── sim.js       Cluster-Simulator (docker, kubectl, helm, terraform)
│   ├── content.js   Quests, Dialoge, NPCs, Ränge, Shop, Karteikarten
│   ├── game.js      Spielstand, XP, Dublonen, Streak, Spaced Repetition
│   ├── engine.js    Canvas-Engine (Rendering, Eingabe, Kamera)
│   ├── world.js     Port Kubernia: Karte, Kollision, Cluster→Welt-Sync
│   ├── ui.js        Dialoge, Quest-Steuerung, Funkgerät, Shop, Quiz
│   └── main.js      Start & Verdrahtung
└── test/smoke.js    Test: spielt alle Quest-Aufgaben automatisch durch
```

Test ausführen: `node test/smoke.js`

## Grafiken

Die Pixel-Art stammt aus den Packs **Tiny Town** und **Tiny Dungeon** von [Kenney](https://kenney.nl) – Lizenz **CC0** (public domain), Lizenztexte liegen in `assets/`. Danke, Kenney! 💛

## Roadmap (Fortsetzung folgt)

- **Ingress-Inseln**: Routing & Ingress-Controller
- **GitOps-Archipel**: Argo CD, Pull-Prinzip, App-of-Apps
- **Monitoring-Leuchtturm**: Prometheus, Grafana, Alerts
- **Werft-Ausbau**: eigene Helm-Charts schreiben
- **Sturm-Ereignisse**: Live-Incidents (Lastspitze, kaputtes Upgrade) unter Zeitdruck lösen
- **Echter Modus**: dieselben Quests gegen ein lokales kind/minikube-Cluster
