# Mitentwickeln an KubeQuest

Willkommen! Diese Seite bringt dich – Mensch **oder** KI-Agent – in **einem Schritt** auf einen lauffähigen Stand. Was das Spiel selbst _ist_ (Story, Steuerung, Lernpfad), steht in der [README.md](README.md).

## Voraussetzungen

- **Node ≥ 22** – die erwartete Version steht in [`.nvmrc`](.nvmrc) (mit [`nvm`](https://github.com/nvm-sh/nvm): `nvm install && nvm use`).
- **git**; für den Ticket-Workflow zusätzlich die [GitHub-CLI](https://cli.github.com/) (`gh`).

## In einem Befehl startklar

```bash
git clone <repo-url> kubequest
cd kubequest
npm run setup
```

`npm run setup` prüft die Node-Version, installiert die Abhängigkeiten und lässt einmal **Tests, Typecheck und den Architektur-Wächter** laufen. Steht am Ende „Alles grün", bist du startklar. Danach den Dev-Server starten:

```bash
npm run dev   # lokaler Server (Vite) – angezeigte Adresse im Browser öffnen
```

> Lieber von Hand? Statt `npm run setup` reicht zum Loslegen `npm install`; die Checks unten dann bei Bedarf einzeln.

## Die wichtigsten Befehle

| Zweck | Befehl |
|---|---|
| One-Command-Setup (Node-Check + install + alle Checks) | `npm run setup` |
| Dev-Server (Code-Änderung → manuell neu laden) | `npm run dev` |
| Tests (Vitest) | `npm test` |
| Typen prüfen (strict) | `npm run typecheck` |
| Architektur-Wächter (Schichtung) | `npm run check:arch` |
| Offline-Build (eine self-contained Datei zum Doppelklicken) | `npm run build:offline` |

Die **vollständige** Befehlsliste (alle Build-Wege) steht in [CLAUDE.md › Befehle](CLAUDE.md) – hier bewusst nur die Alltags-Befehle, nicht doppelt gepflegt.

## Wo finde ich was?

Damit nichts doppelt gepflegt wird, lebt jedes Thema an **genau einer** Stelle:

- **Datei-für-Datei-Landkarte** (welches Modul macht was): [CLAUDE.md › Repo-Landkarte](CLAUDE.md)
- **Wie hier gearbeitet wird** (harte Regeln, Board-/Ticket-Workflow, Konventionen): [AGENTS.md](AGENTS.md)
- **Was das Spiel ist** (Story, Steuerung, Lernpfad): [README.md](README.md)
- **Architektur-Stand & Ausbau-Plan** (Stardew-Scope): [docs/architektur-analyse-2026-06.md](docs/architektur-analyse-2026-06.md) + [docs/architektur-reihenfolge.md](docs/architektur-reihenfolge.md)

## Bevor du committest

- `npm test`, `npm run typecheck` und `npm run check:arch` müssen **grün** sein – genau das, was `npm run setup` einmal durchspielt.
- Neue/geänderte Logik bekommt **Tests, auch für Negativfälle** (Red-Green absichern, bei Bugfixes test-first).
- Sicht- oder spielbare Änderungen **im Browser** verifizieren, nicht nur „sollte gehen".
- Der komplette Ablauf inkl. Branch-/Worktree-Workflow und Test-Disziplin: [AGENTS.md](AGENTS.md).
