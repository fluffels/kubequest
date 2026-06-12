# ⚓ KubeQuest – Vom Landratten-Dasein zur Flottenadmiralin

Ein Lernspiel für **Kubernetes, Helm und Terraform** – von „Helm? Das setzt man doch auf den Kopf?" bis Profi-Niveau. Komplett offline im Browser, kein Cluster und keine Installation nötig.

## Spielstart

Einfach die Datei **`index.html` doppelklicken** – fertig. Das Spiel läuft komplett lokal im Browser, der Spielstand wird automatisch im Browser gespeichert (localStorage).

> Wichtig: Immer denselben Browser benutzen, sonst fängt der Spielstand woanders bei null an.

## So funktioniert das Spiel

**🏠 Heimathafen** – die Kapitelübersicht. Kapitel schalten sich nacheinander frei:

1. 📦 **Leinen los!** – Container & Docker
2. ☸️ **Das Orchester** – Kubernetes-Grundlagen (Cluster, Nodes, Pods, kubectl)
3. ⚙️ **Volle Fahrt** – Deployments & Services (Self-Healing live erleben!)
4. 🗺️ **Seekarten** – YAML & deklaratives Arbeiten
5. ☸️ **Das Steuerrad** – Helm (Charts, Releases, Rollbacks)
6. 🏗️ **Land in Sicht** – Terraform (Infrastructure as Code)

Jedes Kapitel besteht aus drei Teilen:

- **📖 Lektion** – kurze, anfängerfreundliche Erklärungen mit Hafen-Analogien
- **🎯 Quiz** – Verständnisfragen mit Erklärung zu jeder Antwort
- **💻 Terminal-Mission** – echte Befehle selbst eintippen, gegen einen simulierten Cluster, der wirklich reagiert (skalieren, löschen, Self-Healing beobachten …). Kaputtmachen unmöglich.

**📋 Tagesrapport** – das Geheimnis, warum das Wissen wirklich hängen bleibt: Alle Fragen und Befehle landen in einem Karteikartenstapel (Spaced Repetition / Leitner-System). Was du gut kannst, kommt seltener – was du verwechselst, öfter. Am besten täglich eine kurze Runde!

**🛒 Hafenladen** – für verdiente 🪙 Dublonen gibt es Hinweis-Fernrohre, Papagei-Joker, Lösungs-Kompasse, Themes und Schiffe.

**🧪 Sandbox** – freies Terminal ohne Aufgaben, zum Ausprobieren aller gelernten Befehle (`help` zeigt, was geht).

**XP & Ränge** – von 🦔 Landratte über ☸️ Steuerfrau bis 🏅 Flottenadmiralin. Tägliches Spielen baut einen 🔥 Streak auf, der bis zu +50 % Dublonen-Bonus bringt.

## Projektstruktur

```
kubequest/
├── index.html      Einstieg (doppelklicken!)
├── style.css       Design & Themes
├── js/
│   ├── sim.js      Terminal-Simulator (docker, kubectl, helm, terraform)
│   ├── data.js     Lerninhalte: Kapitel, Quizfragen, Missionen, Karteikarten
│   ├── game.js     Spiellogik: XP, Ränge, Dublonen, Streak, Spaced Repetition, Shop
│   └── ui.js       Oberfläche: alle Bildschirme
└── test/
    └── smoke.js    Test: spielt jede Terminal-Aufgabe mit der Musterlösung durch
```

Test ausführen: `node test/smoke.js`

## Ideen für spätere Ausbaustufen

- Weitere Kapitel: Namespaces & ConfigMaps/Secrets, Ingress, eigene Helm-Charts schreiben, Terraform-Module, GitOps (Argo CD), Monitoring
- „Prüfungs-Modus": Bosskampf am Ende jedes Rangs ohne Hinweise
- „Echter Modus": dieselben Missionen gegen ein lokales kind/minikube-Cluster
- Story-Ereignisse: nächtlicher Pod-Absturz, Lastspitze, kaputtes Upgrade → Rollback unter Zeitdruck
