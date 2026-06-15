# Spielkonzept-Review: Führt der Lernpfad zu Senior-DevOps UND macht es Spaß? (#52)

> Review/Konzept-Ticket, kein Feature-Bau. Wunsch von Katharina (sie ist die
> Zielspielerin/-lernerin). Grundlage für gezielte Folge-Tickets.
> Stand: Juni 2026, Code-Stand `main`. Verifiziert am Quest-Content
> (`src/content/quests.ts`, q0–q21) und an den bestehenden Lernpfad-Tickets
> #20–#26 / #28.

## Kurzfassung (TL;DR)

**Ja – das Konzept ist gut.** Es führt auf dem geplanten Weg Richtung Senior-DevOps
**und** es macht im Stardew-Sinn Spaß, ohne zu überfordern. Zwei Einschränkungen:

1. **Didaktik:** Das *Fundament* (Phase 1+2: Docker, K8s, YAML, Helm, Terraform,
   Security, Troubleshooting, Git, CI/CD) ist erstaunlich vollständig und sauber
   dosiert. Der *Senior-Ausbau* (Phasen 3–10) ist über #20–#26/#28 schon als Plan
   da. Es fehlen aber **fünf konkrete Bausteine**, die heute durch kein Ticket
   abgedeckt sind – v.a. **ein eigenes Docker-Image bauen**, **Health-Checks**,
   **Resource-Limits/Autoscaling**, **Git-Alltag (Merge-Konflikte/pull)** und
   **Config/Secrets im Pod konsumieren**. Dafür neue Tickets (siehe unten).
2. **Game-Feel:** Die Anti-Frust-Mechanik ist vorbildlich (Dosierung, Questlog,
   „Üben"-überall, Hint-Fernrohr + Lösungs-Kompass, freundliche Falsch-Antworten,
   Spaced Repetition). Der **einzige echte Stardew-Konflikt**: Stürme + Piraten
   erzeugen Zeitdruck und „kaputte Dienste verdienen nichts" – das widerspricht
   dem Leitbild „entspannter Vibe, kein Zeitdruck". Empfehlung: einstellbare
   Härte/Frequenz (Cozy-Modus) – neues Ticket.

**Klare Antwort auf die Leitfrage:** Ja, der Lernpfad *kann* zu Senior-DevOps
führen (Wissen + Muskelgedächtnis; die Betriebserfahrung kommt aus echten
Projekten – das sagt die README schon ehrlich), und ja, es macht Spaß wie
Stardew. Mit den fünf Curriculum-Lücken geschlossen und dem Cozy-Regler ist das
Konzept rund.

---

## Achse 1 – Didaktik / Curriculum

### Was heute wirklich im Spiel steckt (verifiziert an den Quests)

| Thema | Befehle/Konzepte, die der Spieler **selbst tippt** | Tiefe |
|---|---|---|
| Docker | `pull`, `run`, `ps`, `ps -a`, `stop`, `run -d --name`; Layer-Stapelspiel | solide Basis, **aber kein `docker build`** |
| K8s-Basics | `get nodes/pods`, `describe`, `-n`, `create deployment`, `scale`, `delete pod`, `expose`, `get svc`, `apply -f`, `get ingress` | guter Kern; Self-Healing live erlebbar |
| YAML/deklarativ | `apply -f`, Idempotenz, 4 Stammfelder, Spaces-not-Tabs | konzeptionell stark, nur 1 Quest |
| Helm | `repo add/update`, `search`, `install`, `list`, `upgrade --set`, `rollback`, `uninstall`, **`create`/`lint`/`package`/`install ./`** | **sehr gut** – inkl. eigenem Chart (q21) |
| Terraform | `init`, `plan`, `apply`, `state list`, `destroy` | runder Zyklus, State-Konzept verstanden |
| Security | `create secret generic`, `get secrets`; ConfigMap-Antipattern; Keycloak/IDP genannt | Basis ok; **Secret-Konsum im Pod fehlt** |
| Troubleshooting | ImagePullBackOff (`set image`), CrashLoopBackOff (`logs` + Secret + `rollout restart`), Pending (mehr Nodes via Terraform) | **exzellente Methodik**: get pods → describe → logs |
| Git | `init`, `status`, `add`, `commit`, `log`, `checkout -b`, `merge`, `push`, `add .` | Basis gut; **Merge-Konflikte & `pull`/`fetch` fehlen** |
| CI/CD | `.gitlab-ci.yml` lesen, Push löst Pipeline aus, build→test→deploy, `glab ci status` | guter Einstieg; Pipeline selbst schreiben fehlt (ok für Phase 1) |

**Befund:** Für „von 0 auf solides Junior-/Mid-Level" ist das Fundament
überraschend **vollständig und gut dosiert**. Helm und Troubleshooting sind sogar
tiefer als bei vielen Kursen. Die README ordnet den Senior-Anspruch ehrlich ein
(Wissen ≠ Betriebserfahrung) – das ist genau richtig und sollte so bleiben.

### Deckt der Plan den Weg zum Senior ab?

Die geplanten Phasen 3–10 sind **als Tickets schon da** und decken die großen
Senior-Themen ab:

- Ingress/DNS/TLS/NetworkPolicies → #20 (Branch `feature/kq-20-networkpolicies`
  existiert bereits; Ingress-Grundlagen stecken sogar schon in q8!)
- GitOps/Argo CD → #21 · Observability/Prometheus/Grafana → #22
- RBAC/Pod-Security → #23 · StatefulSets/Volumes/DBs → #24
- Terraform-Module/Remote State/Cloud → #25 · eigenes Backend deployen → #26
- Echter Modus gegen lokales Cluster → #28

Diese **Reihenfolge ist sinnvoll** (Grundlagen → Aufbau → Meisterschaft). Der Plan
ist kohärent; ich würde nichts davon streichen.

### Konkret abgeklopft (wie im Ticket gefragt)

- **Helm:** ausreichend tief – sogar eigenes Chart (`create`/`lint`/`package`). ✅
- **Kubernetes:** Kern sitzt; es fehlen aber **Health-Checks (liveness/readiness)**
  und **Resource requests/limits + Autoscaling (HPA)** – beides Senior-Pflicht.
- **Ingress:** Grundlagen schon in q8 (`ingress.yaml`, `get ingress`); Vertiefung
  (TLS, Controller, NetworkPolicies) in #20 verortet. ✅
- **Docker:** Lücke – der Spieler **baut nie selbst ein Image** (`docker build`);
  das Dockerfile taucht nur in der CI-Quest auf. Eigenes Image bauen+taggen ist
  fundamental. → neues Ticket.
- **CI/CD & Pipelines:** guter Einstieg (Pipeline lesen, Push-Trigger, Stages);
  eine Pipeline selbst schreiben ist Senior-Stoff und passt später (nicht dringend).

### Brauche ich Postgres/Datenbanken? (explizite Frage)

**Ja – aber aus dem richtigen Grund.** Als DevOps-Engineer schreibst du selten SQL.
Du musst aber **stateful Workloads betreiben können**: StatefulSets,
PersistentVolumes/PVC, StorageClasses, Backup/Restore und das Urteilsvermögen
„Prod-DB im Cluster – mache ich das, und wie sichere ich sie?". Genau **das** ist
ein Senior-Unterscheidungsmerkmal (Junioren bleiben meist bei stateless stehen).
→ Empfehlung: #24 vom Fokus „Datenbanken/SQL" auf **„stateful Workloads &
Datendauerhaftigkeit"** schärfen (Postgres ist nur das Beispiel-Workload, nicht
das Lernziel). Kommentar an #24 statt Doppel-Ticket.

### Lücken, die heute durch KEIN Ticket abgedeckt sind → neue Tickets

| # | Lücke | Warum Senior-relevant |
|---|---|---|
| A | **Eigenes Docker-Image bauen** (`docker build`/`tag`/`push`) | Container-Fundament; heute nur konsumiert, nie gebaut |
| B | **Health-Checks** (liveness/readiness/startup) | Prävention zu CrashLoop; entscheidet über Rollout-Sicherheit |
| C | **Resource-Management** (requests/limits, HPA, OOMKilled) | Skalierung + Kostenbewusstsein (Ticket fragt explizit danach) |
| D | **Git-Alltag** (Merge-Konflikte lösen, `pull`/`fetch`) | Größter Tag-1-Frust für Junioren; heute nicht geübt |
| E | **Config/Secrets im Pod konsumieren** (env/volumeMounts, ConfigMap *richtig*) | Secrets werden angelegt, aber nie in eine App eingebunden |

Networking-Tiefe (Service-Typen ClusterIP/NodePort/LoadBalancer, Cluster-DNS) und
Observability/SLOs sind über #20/#22 abgedeckt; On-Call/Incident-Response wird
über die **Piraten-Überfälle und Sturm-Saison spielmechanisch schon trainiert** –
das ist ein cleverer, unterschätzter Stärkepunkt des Konzepts.

---

## Achse 2 – Game-Feel / Spaß & Anti-Frustration

### Was schon vorbildlich gelöst ist (verifiziert)

- **Dosierung:** strikt **ein neuer Befehl pro `teach`-Schritt**, danach Drills mit
  Varianten. Bos Regel „lieber zwei Befehle sicher als zehn halb" ist im Content
  gelebt. Genau das Stardew-Prinzip „nicht zu viel auf einmal". ✅
- **Keine Sackgassen:** Questlog (Taste J), bei **jedem NPC jederzeit „Üben"**,
  jeder Befehl hat ein `hint`-Feld, dazu **Hint-Fernrohr** und **Lösungs-Kompass**
  im Shop (zeigt die komplette Lösung). Man kann nicht hängen bleiben. ✅
- **Fehler verzeihen:** Falsche Multiple-Choice-Antworten geben **freundliche,
  korrigierende** Replies statt Strafe; Tippfehler werden über `accept`-Regex
  abgefangen. Bekannte Probleme sind als #19 (Troubleshooting-Hilfen) und #36
  (Soft-Lock-Bug) schon getrackt. ✅
- **Belohnung & Sog:** XP/Ränge (Landratte→Admiral), passive Dublonen-Wirtschaft,
  Haustiere/Flaggen, Tages-Streak, Spaced-Repetition-Krabbe. Cozy-Loop mit Sog. ✅

### Der eine echte Stardew-Konflikt

**Stürme + Piraten-Überfälle erzeugen Zeitdruck** („kaputte Dienste verdienen
nichts, bis du sie reparierst"; Piraten klauen Pods „unter Zeitdruck"). Als
Incident-Response-Training ist das didaktisch goldwert – aber es **widerspricht
dem Leitbild** „entspannter Vibe, kein Zeitdruck". Stardew lässt dich nie unter
Echtzeit-Stress etwas reparieren *müssen*.

→ Empfehlung: **einstellbare Frequenz/Härte (Cozy-Modus)** – Events optional
sanfter oder seltener, ohne den Lerneffekt für die zu nehmen, die ihn wollen.
Neues Ticket (F).

### Kleinere Beobachtungen (kein eigenes Ticket nötig)

- Einige Dialoge sind recht lang (q7/q8: 3 dichte Absätze). Stardew hält
  NPC-Text kürzer. Beim nächsten Content-Pass im Blick behalten.
- Drill-Mengen (2–4 pro Quest) sind okay, solange der Variantenpool divers bleibt
  (`drills.ts`) – sonst droht Grind-Gefühl. Bei neuen Themen mitdenken.

---

## Ergebnis & abgeleitete Folge-Tickets

**Curriculum-Bewertung:** Fundament vollständig und gut dosiert; Senior-Plan
kohärent und schon als #20–#26/#28 vorhanden. Fünf konkrete Lücken (A–E) neu
ticketen, #24 schärfen.

**Game-Feel-Bewertung:** Anti-Frust-Design vorbildlich; eine konkrete
Anti-Frust-Maßnahme offen (Cozy-Regler, F).

**Neu angelegte Tickets aus diesem Review:**

- #66 (A) Docker: eigenes Image bauen (`build`/`tag`), nicht nur konsumieren
- #67 (B) Health-Checks: liveness/readiness/startup Probes
- #68 (C) Resource-Management: requests/limits, HPA, OOMKilled (Skalierung & Kosten)
- #69 (D) Git-Alltag: Merge-Konflikte lösen + `pull`/`fetch`
- #70 (E) Config/Secrets im Pod konsumieren (env/volumeMounts)
- #71 (F) Cozy-Modus: Frequenz/Härte von Stürmen & Piraten einstellbar
- Kommentar an #24: Fokus von „Datenbanken/SQL" auf „stateful Workloads &
  Datendauerhaftigkeit" schärfen

**Fazit:** Das Konzept ist gut. Es führt – mit dem geplanten Phasen-Ausbau und
den fünf ergänzten Bausteinen – Richtung Senior-DevOps, und es macht dabei Spaß
wie Stardew, sobald der Zeitdruck der Events optional wird.
