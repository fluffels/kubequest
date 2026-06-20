# Architektur-Reihenfolge

> **Stand: 2026-06-20.** Kuratierte Umsetzungs-Reihenfolge für alle offenen Tickets mit Label `area:architektur`.
> Diese Liste **überschreibt** für Architektur-Tickets die generische Board-Auswahl (Prio→Nummer aus AGENTS.md):
> Die Reihenfolge hier ist **abhängigkeitsbewusst** sortiert, nicht nur nach Prio-Label.

## Vor JEDEM Ticket — bewusst zweifeln (über allem)

Bevor irgendein Ticket dieser Liste angefasst wird, **zuerst zweifeln** — das steht über der Reihenfolge:

1. **Stardew-Scope-Frage:** „Ist das, was ich hier mache, noch sinnvoll, wenn KubeQuest **so groß wie Stardew Valley** wird?" Nur umsetzen, wenn die Antwort Ja ist. Eine Lösung, die heute reicht, bei 10× Inhalt aber dasselbe Problem reproduziert, ist keine Lösung (oberste Regel, [AGENTS.md](AGENTS.md)).
2. **Bisherige Entscheidungen aktiv anzweifeln** — nicht nur die eigene neue Arbeit. Auch **abgeschlossene Tickets, ADRs und „gesetzte" Annahmen** dürfen falsch sein. Wenn beim Bearbeiten auffällt, dass eine frühere Weiche bei Stardew-Scope nicht trägt: hinterfragen, nicht stillschweigend fortschreiben.
3. **Auffälliges → sofort Ticket anlegen** (Bug, Lücke, Tech-Debt, falsche Annahme) — nicht inline mitfixen, nicht „im Kopf" behalten. Lieber ein Ticket zu viel.
4. **Diese Liste danach neu sortieren** — neues/aufgefallenes Ticket an die dependency-passende Stelle einsortieren und festhalten, *wann* es dran ist. Die Reihenfolge ist ein lebendes Dokument, kein einmaliger Plan.

## Grundsatz-Reviews (bewusst offen halten, nicht festlegen)

Diese Tickets sind **keine „bau-X"-Tickets**, sondern Entscheidungen, die man *reviewt und offen hält* — sie färben alle anderen:

- **#355** ⚠️ — **Auslieferungsform: Web-App vs. Desktop-Download (wie Stardew).** Bewusst **nicht** auf eine Option festlegen. Die alten Spikes #83/#197 (Tauri, geschlossen) nehmen die Web-Basis als gesetzt an — genau das hier anzweifeln. Recherchieren, ob ein Spiel dieser Größe als reine Web-Anwendung überhaupt trägt; Ergebnis als **ergebnisoffener ADR** (`docs/adr/0005-auslieferungsform.md`) mit Trigger, *wann* neu zu entscheiden ist. Kein Code, kein Lock-in. → bei jeder save-/asset-/build-nahen Änderung mitdenken.

## Was „nächstes Architektur" heißt

Sagt die Maintainerin **„nächstes Architektur"**, dann:

0. **Pre-Flight zuerst (Pflicht, immer): Stimmt diese Liste noch mit dem Live-Stand?** Bevor irgendein Ticket gegriffen wird, **einmal** den echten GitHub-Stand holen und gegen diese Liste abgleichen:
   ```bash
   gh issue list --label "area:architektur" --state open --limit 300 \
     --json number,title,labels,assignees \
     --jq '.[] | "#\(.number)\t\(([.labels[].name]|map(select(startswith("status:")))|join(","))//"-")\tassignee:\([.assignees[].login]|join(","))\t\(.title)"' | sort -n
   ```
   Drift einarbeiten, **bevor** gewählt wird:
   - **In der Liste, aber geschlossen** → Zeile entfernen.
   - **Jetzt `status:zurückgestellt`** → raus aus der Reihenfolge, runter in den Zurückgestellt-Block (überspringen).
   - **Jetzt Assignee / offener Branch/Worktree** (`git worktree list` + `git branch -a`) → als „in Arbeit" überspringen, nächstes nehmen.
   - **Neues offenes `area:architektur`-Issue, nicht in der Liste** → an dependency-passender Stelle einsortieren (nicht unten anhängen).
   - **Reaktiviert** (zurückgestellt-Label weg) → einsortieren.
   - **Driftet die Liste → erst die Doku fixen + committen** (eigener Worktree, Doku-only → kein Test-Lauf), Stand-Datum oben aktualisieren, **dann** wählen. Stimmt alles, ohne Commit weiter.
1. Aus der (jetzt aktuellen) Liste das **oberste noch offene** Ticket nehmen, das
   - **nicht** `status:zurückgestellt` ist (die werden ignoriert, siehe unten), und
   - **kein** Assignee hat (Kollisionsschutz — siehe AGENTS.md, „Board-Workflow"), und
   - keinen offenen Branch/Worktree hat.
2. Dieses Ticket mit dem normalen kubequest-Workflow abarbeiten (self-assignen → eigener Worktree → umsetzen → nach `main` → Issue schließen).
3. **⚠️-Flags beachten** (siehe Liste): manche Tickets werden NICHT direkt umgesetzt (Epic zerlegen, Optik erst abstimmen) oder haben eine harte Voraussetzung.

> Erledigte Tickets werden hier **nicht durchgestrichen, sondern entfernt** (GitHub-Issue-Status ist die SSOT für „erledigt"). Diese Datei führt nur die noch offenen Architektur-Tickets in Reihenfolge.

## Reihenfolge

Sortier-Logik: erst das **Skalierungs-/Save-Fundament** (schützt direkt den Stardew-Scope und ist voll abschließbar), dann die **großen Refactors** (vom Architektur-Wächter abgesichert) und **Welt/Tiles**, dann **UX-Komfort**, zuletzt die **Sonderfälle** (Epic, Optik, anlegendes Review). (Stand 2026-06-20: Fundament, Refactors und das Welt/Tiles-Hitbox-Ticket #386 sind erledigt; die Liste beginnt darum beim UX-Komfort.)

| # | Ticket | Worum's geht | Warum hier / Abhängigkeit |
|---|--------|--------------|---------------------------|
| 1 | **#310** | In Dialogen zurückblättern (Lese-Rückblick) | Eigenständige UX, `src/ui/dialog.ts`/`overlaykbd.ts` (seit #356). |
| 2 | **#332** | Abgeschlossene Quests wiederspielen (Sandbox) | Baut auf erledigtem #325/#326 auf; arbeitet mit `questIdx`/`questStep`-Lesezeichen. Die ID-basierte Save (#353) ist jetzt vorhanden. |
| 3 | **#306** | Mehrere Spielstände / Save-Slots (lokal) | SaveStore-Arbeit → Save-Format (#353) sitzt jetzt. |
| 4 | **#334** | Dev-Panel per Docker, Passwort zur Laufzeit | Explorations-/Lern-Ticket, niedrige Dringlichkeit. Baut auf erledigtem #325 + #331. |
| 5 | **#357** | Entity-Registry auf Objekte/Interaktables erweitern (Folge zu #349) | Baut auf der Entity-Registry (#349, erledigt) auf. Kein Blocker (reine Skalierungs-Verbesserung) — erst sinnvoll, wenn ein Bereich viele platzierte Objekte/Trigger bekommt. Normaler Ablauf über `main`. |
| 6 | **#314** ⚠️ | Zentrales Feier-Popup-System (Konfetti + Spruch) | **Optik-Ticket: erst Vorstellung + Referenzbilder mit der Maintainerin abstimmen**, nicht selbst das Design festlegen. Übergreift #223. |
| 7 | **#317** ⚠️ | EPIC: Komfort-Funktionen im Shop kaufen | **Epic — NICHT umsetzen.** Beim Bearbeiten in session-große Kinder-Tickets zerlegen (Shop-Redesign, Kauf-/Freischalt-Mechanik, einzelne Funktionen, Quest-Hinweise), Übersichts-Kommentar posten, Epic auf done schließen. Die „freigeschaltet durch Nutzung"-Mechanik gibt es schon als Präzedenzfall: #316 (Befehlshistorie, erledigt) nutzt genau dieses Muster (`Game.cmdHistoryUnlocked`). |
| 8 | **#293** ⚠️ | Spiellogik-Review (anlegend) | **ZULETZT** — laut Ticket-Anweisung erst angehen, wenn der restliche Backlog weitgehend erledigt ist (sonst veraltet das Review sofort). Anlegendes Review: erzeugt Folge-Tickets, kein direkter Fix. |

## Zurückgestellt — werden ignoriert

Alle offenen Architektur-Tickets mit Label **`status:zurückgestellt`** sind hier bewusst **nicht** eingeplant und werden bei „nächstes Architektur" übersprungen (Stand 2026-06-20, **23 Stück**, vollständig): „Echter Modus"-Bogen #173/#174/#175/#176/#177/#178, Phase-10-Save-Sync #158/#159/#160, neue Inseln/Bereiche + Progression #130 (Wachturm), #144 (Lagerhallen), #146/#147/#148/#156 (Expeditions-Flotte), Storage-Lernpfad #240/#241, Self-Hosting #221, Tasten-Umbelegung #232, Lazy-Asset-Loading #198, Sprite-Atlas #339, Schiff-Szene #257, Enter/Leertaste-Dialoge #312.

Maßgeblich ist immer das **Label**, nicht diese Aufzählung: bei „nächstes Architektur" gilt jedes Issue mit `status:zurückgestellt` als übersprungen, auch falls die Liste hier mal nicht nachgezogen wurde.

Wird eins davon reaktiviert (Label `status:zurückgestellt` entfernt), gehört es hier einsortiert.

## Pflege dieser Liste

Diese Liste ist **lebendig** — sie wird beim Entwickeln laufend fortgeschrieben, nicht nur einmal erstellt:

- **Erledigtes Ticket** → Zeile entfernen (Issue-Status ist die SSOT).
- **Beim Bearbeiten etwas aufgefallen** (Bug, Tech-Debt, fragwürdige Altentscheidung) → **neues Ticket anlegen** (ohne Assignee, passende Labels) und hier an der dependency-passenden Stelle einsortieren — festhalten, *wann* es dran ist.
- **Neues `area:architektur`-Ticket** → an der dependency-passenden Stelle einsortieren, nicht einfach unten anhängen.
- **Reaktiviertes Ticket** (zurückgestellt-Label weg) → einsortieren.
- **Altentscheidung wackelt** (auch ein abgeschlossenes Ticket/ADR) → als Grundsatz-Review oben aufnehmen (wie #355), nicht stillschweigend fortschreiben.
- Bei Unklarheit über die Position: „Ist das okay, wenn KubeQuest Stardew-groß wird?" (oberste Regel, AGENTS.md) entscheidet vor Prio-Label.
