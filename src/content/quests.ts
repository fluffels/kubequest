/* ===== Inhalte: Quests =====
 * Die ganze Story in vielen kleinen Schritten. Schritt-Typen:
 *  dialog / choice  – Gespräch
 *  teach            – EIN neuer Befehl: erklärt + selbst tippen
 *  drill            – Zufalls-Übungen aus dem Gelernten
 *  terminal         – feste Aufgabenkette (für Showdowns)
 */
import type { Quest } from "../types";
import type { Sim } from "../sim";
import {
  DEPLOYMENT_YAML, SERVICE_YAML, INGRESS_YAML, INGRESS_TLS_YAML, NETPOL_YAML, BOESE_CONFIG_YAML,
  MAIN_TF, GITLAB_CI_YML, DOCKERFILE,
} from "./manifests";

export const QUESTS: Quest[] = [

  { id: "q0", title: "Anheuern in Port Kubernia", giver: "ole", rewardXp: 15, rewardCoins: 10,
    steps: [
      { type: "dialog", npc: "ole", lines: [
        "Ahoi! Du musst die neue Crew sein. Willkommen in <b>Port Kubernia</b> – dem modernsten Hafen der sieben Meere!",
        "Ich bin Ole, Hafenmeister. Keine Sorge: Hier lernt jede:r in <b>kleinen Schritten</b> – einen Handgriff nach dem anderen, mit viel Übung.",
        "Dein wichtigstes Werkzeug: dein <b>📻 Funkgerät</b>. Drück <b>T</b> und tippe <code>help</code> – mehr nicht!",
      ]},
      { type: "teach", brief: "Funkgerät-Test", cmd: {
        id: "t-help", intro: "🆕 Dein erster Funkspruch!",
        text: "Tippe <code>help</code> und drück Enter.",
        accept: [/^help$/], solution: "help", hint: "Wirklich nur das Wort help." } },
      { type: "dialog", npc: "ole", lines: [
        "Du funkst ja schon wie ein alter Seebär! Geh als Nächstes runter zum <b>Dock im Südwesten</b> zu <b>Bo</b>, unserem Dock-Golem.",
        "Und merk dir: Bei jedem von uns kannst du später jederzeit <b>üben</b> – einfach ansprechen und „Üben“ wählen. Übung füllt den Geldbeutel!",
      ]},
    ]},

  { id: "q1", title: "Die erste Kiste", giver: "bo", rewardXp: 25, rewardCoins: 20,
    steps: [
      { type: "dialog", npc: "bo", lines: [
        "BO. GRÜSST. NEUE CREW. <i>*knirsch*</i> Bo stapelt Fracht. Früher: Chaos – Säcke, Fässer, hundert Formen. Dann kam: <b>DER CONTAINER</b>. Genormte Box. Jeder Kran kann sie heben.",
        "Software genauso: App + alles Drumherum in eine Box → läuft <b>überall gleich</b>. Werkzeug: <b>Docker</b>.",
        "Erster Handgriff: Bauplan holen. Baupläne heißen <b>Images</b> und liegen im Kisten-Supermarkt, der <b>Registry</b>. Bo zeigt: <code>docker pull nginx</code>. Jetzt DU! (T drücken)",
      ]},
      { type: "teach", brief: "Bauplan holen", cmd: {
        id: "t-pull", intro: "🆕 Neuer Befehl: <code>docker pull</code> – lädt ein Image aus der Registry.",
        text: "Lade das Image <code>nginx</code> (ein kleiner Webserver) herunter.",
        accept: [/^docker\s+pull\s+nginx(:\S+)?$/], solution: "docker pull nginx", hint: "Muster: docker pull <image>" } },
      { type: "dialog", npc: "bo", lines: [
        "GUT. Image ist da – das ist nur der <b>Bauplan</b>. Jetzt zum Leben erwecken: <code>docker run</code> baut daraus eine laufende Kiste – einen <b>Container</b>. Schau danach zum Dock!",
      ]},
      { type: "teach", brief: "Kiste starten", cmd: {
        id: "t-run", intro: "🆕 Neuer Befehl: <code>docker run</code> – startet einen Container aus einem Image.",
        text: "Starte einen Container aus dem Image <code>nginx</code>. (Einfachste Form, keine Extras!)",
        accept: [/^docker\s+run\s+nginx(:\S+)?$/], solution: "docker run nginx", hint: "Muster: docker run <image>" } },
      { type: "drill", brief: "Bos Übungsrunde", pool: ["docker-pull", "docker-run"], count: 2,
        intro: "Übung macht den Golem! Zwei schnelle Wiederholungen mit anderen Images:" },
      { type: "choice", npc: "bo", reviewId: "q-ch1-2",
        q: "Bo testet: Image und Container – was ist was?",
        options: [
          { t: "Image = Bauplan/Vorlage, Container = laufende Instanz davon.", ok: true,
            reply: "PERFEKT. Wie Tiefkühlpizza (Image) und Pizza im Ofen (Container). Bo hat jetzt Hunger." },
          { t: "Container = Vorlage, Image = das laufende Programm.", ok: false,
            reply: "ANDERSRUM. Image = Bauplan (pull). Container = läuft (run). Nochmal merken!" },
        ]},
      { type: "dialog", npc: "bo", lines: [
        "Genug für heute. Bo-Regel: <b>Lieber zwei Befehle sicher als zehn halb.</b> Komm wieder, wenn du durchgeatmet hast – oder sprich Bo an und wähle „Üben“.",
      ]},
    ]},

  { id: "q2", title: "Den Überblick behalten", giver: "bo", rewardXp: 30, rewardCoins: 22,
    steps: [
      { type: "dialog", npc: "bo", lines: [
        "ZWEITE LEKTION. Kisten starten kannst du. Aber: Welche laufen gerade? Dafür gibt es <code>docker ps</code> – die Liste aller <b>laufenden</b> Container.",
      ]},
      { type: "teach", brief: "Kisten-Liste", cmd: {
        id: "t-ps", intro: "🆕 Neuer Befehl: <code>docker ps</code> – zeigt laufende Container.",
        text: "Zeig alle laufenden Container an. Die NAMES-Spalte rechts wird gleich wichtig!",
        accept: [/^docker\s+ps$/], solution: "docker ps", hint: "Nur zwei Buchstaben nach docker." } },
      { type: "dialog", npc: "bo", lines: [
        "Siehst du die Namen in der NAMES-Spalte? Docker erfindet welche, wenn du keinen vergibst. Mit dem Namen kannst du eine Kiste gezielt <b>stoppen</b>: <code>docker stop &lt;name&gt;</code>.",
      ]},
      { type: "teach", brief: "Kiste stoppen", cmd: {
        id: "t-stop", intro: "🆕 Neuer Befehl: <code>docker stop</code> – hält einen Container an.",
        text: "Stoppe einen deiner laufenden Container. (Name aus <code>docker ps</code> abtippen!)",
        accept: [/^docker\s+stop\s+\S+$/], check: (sim: Sim) => sim.docker.containers.some(c => !c.running),
        solution: "docker stop <name aus docker ps>", hint: "Erst docker ps für den Namen, dann docker stop <name>." } },
      { type: "dialog", npc: "bo", lines: [
        "WICHTIG: Gestoppt heißt nicht weg! Die Kiste steht noch im Lager. <code>docker ps -a</code> zeigt ALLE – auch gestoppte. Das <code>-a</code> heißt „all“.",
      ]},
      { type: "teach", brief: "Alle Kisten sehen", cmd: {
        id: "t-ps-a", intro: "🆕 Neue Variante: <code>docker ps -a</code> – zeigt auch gestoppte Container.",
        text: "Zeig ALLE Container an. Dein gestoppter müsste mit „Exited“ auftauchen.",
        accept: [/^docker\s+ps\s+(-a|--all)$/], solution: "docker ps -a", hint: "docker ps + Flag für „alle“." } },
      { type: "drill", brief: "Bos Übungsrunde", pool: ["docker-ps", "docker-stop", "docker-ps-a", "docker-run"], count: 3,
        intro: "Drei Wiederholungen, dann sitzt es:" },
      { type: "choice", npc: "bo", reviewId: "q-ch1-4",
        q: "Was zeigt <code>docker ps</code> – ohne Extras?",
        options: [
          { t: "Nur die gerade laufenden Container.", ok: true, reply: "RICHTIG. Für alle (auch gestoppte): docker ps -a. Bo nickt steinern." },
          { t: "Alle Container, die es je gab.", ok: false, reply: "FAST. Das macht docker ps -a. Ohne -a: nur die laufenden." },
        ]},
      { type: "dialog", npc: "bo", lines: [
        "Bo hat eine Überraschung: Sprich Bo nochmal an und wähle <b>🎮 Stapel-Spiel</b>! Da lernst du, wie Images aus <b>Schichten</b> gebaut sind. Macht Spaß. Bo verliert nie. Bo ist Stein.",
      ]},
    ]},

  { id: "q3", title: "Namen und Hintergrund", giver: "bo", rewardXp: 35, rewardCoins: 25,
    steps: [
      { type: "dialog", npc: "bo", lines: [
        "LETZTE DOCKER-LEKTION. Profis geben Kisten <b>eigene Namen</b> (<code>--name</code>) und schicken sie in den <b>Hintergrund</b> (<code>-d</code> wie „detached“), damit das Funkgerät frei bleibt.",
        "Zusammen: <code>docker run -d --name webserver nginx</code>. Sieht lang aus – ist nur run + zwei Extras. Du schaffst das.",
      ]},
      { type: "teach", brief: "Profi-Start", cmd: {
        id: "t-run-named", intro: "🆕 Neue Flags: <code>-d</code> (Hintergrund) und <code>--name</code> (eigener Name).",
        text: "Starte aus <code>nginx</code> einen Container im Hintergrund mit dem Namen <code>webserver</code>.",
        accept: [/^docker\s+run\s+(?=.*-d)(?=.*--name\s+webserver).*nginx(:\S+)?$/], solution: "docker run -d --name webserver nginx",
        hint: "Muster: docker run -d --name <wunschname> <image>" } },
      { type: "drill", brief: "Bos Übungsrunde", pool: ["docker-run-named", "docker-run-named", "docker-stop"], count: 3,
        intro: "Das lange Muster üben wir extra gründlich:" },
      { type: "choice", npc: "bo", reviewId: "q-ch1-1",
        q: "Bos Abschlussfrage: WARUM das alles? Was ist der Kern-Vorteil von Containern?",
        options: [
          { t: "Eine App läuft mit allem Drumherum überall gleich – Laptop, Server, Cloud.", ok: true,
            reply: "RICHTIG. „Bei mir läuft's aber!“ ist Geschichte. <i>*stolzes Steinknirschen*</i>" },
          { t: "Sie machen Apps automatisch schneller.", ok: false,
            reply: "NEIN. Nicht schneller – ÜBERALL GLEICH. Das ist der Schatz." },
        ]},
      { type: "dialog", npc: "bo", lines: [
        "Bo erklärt dich zum <b>Kisten-Profi</b>. <i>*Golem-Applaus*</i> Ole will dich sprechen – es geht um den GROSSEN Umbau. Und vergiss nicht: Üben bei Bo bringt Dublonen!",
      ]},
    ]},

  { id: "q4", title: "Der Hafen wird ein Cluster", giver: "ole", rewardXp: 30, rewardCoins: 22,
    steps: [
      { type: "dialog", npc: "ole", lines: [
        "Bo lobt dich – das passiert alle hundert Jahre! Jetzt die Königsfrage: Eine Kiste kann jeder. Aber <b>hunderte Kisten auf vielen Stegen</b>? Wer startet nachts Ersatz, wenn eine über Bord geht?",
        "Dafür gibt es <b>Kubernetes</b> – griechisch für „Steuermann“, kurz <b>K8s</b>. Schau zum Wasser: Unsere <b>drei Stege</b> sind die <b>Nodes</b> (Arbeits-Server). Alles zusammen: der <b>Cluster</b>.",
        "Dein Funkgerät spricht mit dem Cluster über <code>kubectl</code>. Erster Befehl, ganz harmlos: <code>kubectl get nodes</code> – zeig mir die Stege!",
      ]},
      { type: "teach", brief: "Die Stege zählen", cmd: {
        id: "t-nodes", intro: "🆕 Neuer Befehl: <code>kubectl get nodes</code> – zeigt die Server des Clusters.",
        text: "Zeig die Nodes deines Clusters an. Vergleich mit den Stegen draußen!",
        accept: [/^kubectl\s+get\s+(nodes|node|no)$/], solution: "kubectl get nodes", hint: "Muster: kubectl get <ressourcentyp>" } },
      { type: "dialog", npc: "ole", lines: [
        "Drei Stege, drei Nodes – passt! Und die Fracht? Jede Kiste steht auf einem Liegeplatz namens <b>Pod</b> – der kleinsten Einheit von Kubernetes. Die Bord-Kantine läuft schon. Finde ihre Pods!",
      ]},
      { type: "teach", brief: "Die Fracht finden",
        scenario: { deployments: [{ name: "kantine", image: "nginx:1.27", replicas: 2 }] },
        cmd: {
        id: "t-pods", intro: "🆕 Neuer Befehl: <code>kubectl get pods</code> – zeigt alle Pods.",
        text: "Zeig alle Pods an – und schau dann zum Dock: Die Kisten dort sind GENAU diese Pods!",
        accept: [/^kubectl\s+get\s+(pods|pod|po)$/], solution: "kubectl get pods", hint: "Gleiches Muster wie bei nodes." } },
      { type: "drill", brief: "Oles Übungsrunde", pool: ["k-get-nodes", "k-get-pods"], count: 2,
        intro: "Einmal tief durchatmen und wiederholen:" },
      { type: "choice", npc: "ole", reviewId: "q-ch2-2",
        q: "Kurzer Check: Was ist ein Pod?",
        options: [
          { t: "Die kleinste Einheit in Kubernetes – meist genau ein Container drin.", ok: true,
            reply: "Exakt! Kubernetes verwaltet nie Container direkt, immer Pods – die Liegeplätze mit den Kisten." },
          { t: "Ein anderes Wort für einen Server.", ok: false,
            reply: "Fast-Falle! Der Server ist der <b>Node</b> (Steg). Der Pod ist der kleine Liegeplatz darauf." },
        ]},
      { type: "dialog", npc: "ole", lines: [
        "Ab jetzt siehst du am Dock <b>live</b>, was du im Cluster anrichtest. Übrigens: Deine laufenden Dienste werfen ab sofort <b>🪙 Einnahmen</b> ab – ein gesunder Hafen verdient Geld! Mehr dazu bald.",
      ]},
    ]},

  { id: "q5", title: "Genauer hinsehen", giver: "ole", rewardXp: 30, rewardCoins: 22,
    steps: [
      { type: "dialog", npc: "ole", lines: [
        "Listen sind gut – Details sind besser. Wenn ein Pod zickt, willst du ALLES über ihn wissen: <code>kubectl describe pod &lt;name&gt;</code>. Das ist DER Debugging-Befehl, den du später täglich brauchst.",
      ]},
      { type: "teach", brief: "Pod-Akte öffnen", cmd: {
        id: "t-describe", intro: "🆕 Neuer Befehl: <code>kubectl describe pod &lt;name&gt;</code> – alle Details + Ereignisse.",
        text: "Beschreibe einen <code>kantine</code>-Pod. (Name per <code>kubectl get pods</code> holen und abtippen – das Abtippen trainiert!)",
        accept: [/^kubectl\s+describe\s+pods?\s+kantine-\S+$/], solution: "kubectl describe pod <name aus get pods>",
        hint: "Erst kubectl get pods, dann kubectl describe pod <name>." } },
      { type: "dialog", npc: "ole", lines: [
        "Unten in den <b>Events</b> steht die Lebensgeschichte des Pods – Gold wert bei der Fehlersuche! Eins noch: Kubernetes selbst läuft AUCH als Pods, versteckt im Namespace <code>kube-system</code>.",
      ]},
      { type: "teach", brief: "Hinter die Kulissen", cmd: {
        id: "t-ns", intro: "🆕 Neue Flag: <code>-n &lt;namespace&gt;</code> – in einen anderen Namespace schauen.",
        text: "Zeig die Pods im Namespace <code>kube-system</code> – das Maschinenherz von Kubernetes.",
        accept: [/^kubectl\s+get\s+(pods|pod|po)\s+(-n|--namespace)[=\s]?kube-system$/], solution: "kubectl get pods -n kube-system",
        hint: "kubectl get pods -n kube-system" } },
      { type: "drill", brief: "Oles Übungsrunde", pool: ["k-describe", "k-get-pods", "k-get-nodes"], count: 3,
        intro: "Wiederholen, bis die Finger es allein können:" },
      { type: "choice", npc: "ole", reviewId: "q-ch2-3",
        q: "Und was war nochmal ein Node?",
        options: [
          { t: "Ein einzelner Server (Steg), der Pods ausführt – mehrere Nodes bilden den Cluster.", ok: true,
            reply: "Sitzt! Cluster = Hafen, Node = Steg, Pod = Liegeplatz. Diese drei Begriffe trägst du jetzt für immer bei dir." },
          { t: "Ein besonders großer Pod.", ok: false,
            reply: "Nein – andersrum wird's richtig: Auf einem Node (Steg) stehen viele Pods (Liegeplätze)." },
        ]},
    ]},

  { id: "q6", title: "Der Dauerauftrag", giver: "ole", rewardXp: 35, rewardCoins: 25,
    steps: [
      { type: "dialog", npc: "ole", lines: [
        "Jetzt wird's mächtig. Unbequeme Wahrheit: <b>Pods sind sterblich.</b> Deshalb erstellt man sie nie einzeln, sondern gibt einen Dauerauftrag: ein <b>Deployment</b>.",
        "Ein Deployment sagt: „Halte IMMER N Kopien am Laufen.“ Stirbt eine → sofort Ersatz. Erstellt wird es so: <code>kubectl create deployment kasse --image=nginx</code>.",
      ]},
      { type: "teach", brief: "Dauerauftrag erteilen", cmd: {
        id: "t-create", intro: "🆕 Neuer Befehl: <code>kubectl create deployment &lt;name&gt; --image=&lt;image&gt;</code> – der Dauerauftrag (<code>--image</code> ist Pflicht).",
        text: "Erstelle ein Deployment <code>kasse</code> mit dem Image <code>nginx</code>. (Der Fischmarkt braucht eine Kasse!)",
        accept: [/^kubectl\s+create\s+deployment\s+kasse\s+--image[=\s]nginx(:\S+)?$/], solution: "kubectl create deployment kasse --image=nginx",
        hint: "Muster: kubectl create deployment <name> --image=<image>" } },
      { type: "dialog", npc: "ole", lines: [
        "Eine Kasse läuft! Aber bei Hochbetrieb brauchen wir mehr. Das Beste am Deployment: <b>Skalieren ist ein Einzeiler</b> – du änderst nur die Wunsch-Zahl.",
      ]},
      { type: "teach", brief: "Hochskalieren", cmd: {
        id: "t-scale", intro: "🆕 Neuer Befehl: <code>kubectl scale deployment &lt;name&gt; --replicas=&lt;zahl&gt;</code> – Anzahl der Kopien ändern.",
        text: "Skaliere <code>kasse</code> auf <b>3</b> Kopien – und beobachte das Dock!",
        accept: [/^kubectl\s+scale\s+deployment\s+kasse\s+--replicas[=\s]3$/], solution: "kubectl scale deployment kasse --replicas=3",
        hint: "Muster: kubectl scale deployment <name> --replicas=<zahl>" } },
      { type: "drill", brief: "Oles Übungsrunde", pool: ["k-create", "k-scale", "k-scale"], count: 3,
        intro: "Skalieren muss in Fleisch und Blut übergehen:" },
      { type: "choice", npc: "ole", reviewId: "q-ch3-1",
        q: "Warum Pods über ein Deployment erstellen statt direkt?",
        options: [
          { t: "Pods sind sterblich – das Deployment ersetzt sie automatisch und hält die Anzahl.", ok: true,
            reply: "Genau. Der Dauerauftrag arbeitet, während du schläfst. Morgen zeige ich dir den Beweis … 😏" },
          { t: "Einzelne Pods sind teurer.", ok: false,
            reply: "Nicht ganz – es geht um Automatik: Das Deployment hält den Soll-Zustand, auch nachts um 3." },
        ]},
    ]},

  { id: "q7", title: "Der Sturm-Test", giver: "ole", rewardXp: 45, rewardCoins: 35,
    steps: [
      { type: "dialog", npc: "ole", lines: [
        "Heute beweise ich dir das <b>Self-Healing</b>. Dein Auftrag klingt verrückt: <b>Versenke eine deiner eigenen Kassen-Kisten.</b> Im Ernst! Und schau dabei zum Dock.",
      ]},
      { type: "terminal", brief: "Der Sturm-Test", tasks: [
        { id: "t-storm-1", text: "Hol dir mit <code>kubectl get pods</code> die Namen der <code>kasse</code>-Pods.",
          accept: [/^kubectl\s+get\s+(pods|pod|po)$/], solution: "kubectl get pods", hint: "Kennst du längst!" },
        { id: "t-storm-2", text: "💥 Lösche einen <code>kasse</code>-Pod – Dock im Blick behalten!",
          accept: [/^kubectl\s+delete\s+pods?\s+kasse-\S+$/], solution: "kubectl delete pod <kasse-pod-name>", hint: "kubectl delete pod <name>" },
        { id: "t-storm-3", text: "Platsch – und der Kran war schneller! Prüfe: Es müssten wieder 3 sein, einer ganz frisch (kleines AGE).",
          accept: [/^kubectl\s+get\s+(pods|pod|po)$/], check: (sim: Sim) => sim.lastDeletedPod !== null, solution: "kubectl get pods", hint: "Nochmal die Pod-Liste." },
      ]},
      { type: "dialog", npc: "ole", lines: [
        "DAS ist Kubernetes! Soll: 3. Ist: 2. → Differenz sofort behoben. Ein letztes Puzzlestück fehlt: Neue Pods bekommen neue Namen und Adressen. Wie sollen Kund:innen die Kasse finden?",
        "Mit einem <b>Service</b> – einer festen Adresse vor den wechselnden Pods. Wie ein Empfangstresen: Die Person dahinter wechselt, der Tresen bleibt.",
        "Der Tresen steht aber <b>im</b> Hafen. Und wenn jemand vom <b>offenen Meer</b> – dem Internet – zur Kasse will? Dafür kommt später das <b>Hafentor</b>: ein <b>Ingress</b>. Er lauscht auf eine Adresse wie <code>hafen.de/kasse</code> und lotst Besucher an den richtigen Service. Im Job ist das ein <b>Ingress-Controller</b> (oft auf nginx- oder Gateway-Basis) – merk dir den Namen schon mal.",
      ]},
      { type: "teach", brief: "Feste Adresse", cmd: {
        id: "t-expose", intro: "🆕 Neuer Befehl: <code>kubectl expose</code> – stellt einen Service vor ein Deployment.",
        text: "Stelle einen Service vor <code>kasse</code>, Port <b>80</b>. Draußen geht eine Laterne an!",
        accept: [/^kubectl\s+expose\s+deployment\s+kasse\s+--port[=\s]80(\s.*)?$/], solution: "kubectl expose deployment kasse --port=80",
        hint: "Muster: kubectl expose deployment <name> --port=80" } },
      { type: "teach", brief: "Service-Liste", cmd: {
        id: "t-getsvc", intro: "🆕 Neuer Befehl: <code>kubectl get services</code> – alle festen Adressen.",
        text: "Zeig die Services an – deine <code>kasse</code> hat jetzt eine feste CLUSTER-IP.",
        accept: [/^kubectl\s+get\s+(services|service|svc)$/], check: (sim: Sim) => sim.services.some(s => s.name === "kasse"),
        solution: "kubectl get services", hint: "Kurzform svc geht auch." } },
      { type: "drill", brief: "Oles Übungsrunde", pool: ["k-delete-pod", "k-expose", "k-get-svc"], count: 3,
        intro: "Der ganze Werkzeugkasten einmal durch:" },
      { type: "choice", npc: "ole", reviewId: "q-ch3-3",
        q: "Wozu der Service nochmal?",
        options: [
          { t: "Feste, stabile Adresse vor den Pods – deren Namen und IPs wechseln ständig.", ok: true,
            reply: "Sauber! Und WICHTIG: Ab jetzt verdienen deine Services draußen richtig Dublonen. Gesunder Cluster = volle Kasse. Aber Vorsicht … es gibt Gerüchte über <b>Piraten</b> in der Gegend. 🏴‍☠️" },
          { t: "Der Service startet abgestürzte Pods neu.", ok: false,
            reply: "Das macht das Deployment! Der Service ist nur der Empfangstresen davor – die feste Adresse." },
        ]},
    ]},

  { id: "q8", title: "Adas Seekarten", giver: "ada", rewardXp: 45, rewardCoins: 32,
    steps: [
      { type: "dialog", npc: "ada", lines: [
        "Pssst! Hier wird nicht gebrüllt. Du rufst dem Cluster alles einzeln zu, hm? <code>create</code> hier, <code>scale</code> da … Das ist <b>imperativ</b>. Tssss.",
        "Profis <b>zeichnen Karten</b>: den Wunschzustand in eine Datei. Das ist <b>deklarativ</b> – und die Datei kann in <b>Git</b> liegen! Diese Karten heißen <b>Manifeste</b>, geschrieben in <b>YAML</b>.",
        "Vier Stammdaten hat jedes Manifest: <code>apiVersion</code>, <code>kind</code>, <code>metadata</code>, <code>spec</code>. Und: Einrückung mit <b>Leerzeichen, NIEMALS Tabs</b>. Ich habe dir drei Karten hingelegt – schau sie dir an!",
      ]},
      { type: "terminal", brief: "Karten lesen",
        scenario: {
          files: { "deployment.yaml": DEPLOYMENT_YAML, "service.yaml": SERVICE_YAML, "ingress.yaml": INGRESS_YAML },
          applyEffects: {
            "deployment.yaml": { deployment: { name: "lager", image: "redis:7", replicas: 2 } },
            "service.yaml": { service: { name: "lager", port: "6379" } },
            "ingress.yaml": { ingress: { name: "hafentor", host: "hafen.de", path: "/lager", service: "lager", port: "6379", className: "nginx" } },
          },
        },
        tasks: [
        { id: "t-ada-1", text: "Schau mit <code>ls</code> nach, was Ada dir hingelegt hat.", accept: [/^ls$/], solution: "ls", hint: "Zwei Buchstaben." },
        { id: "t-ada-2", text: "Lies <code>deployment.yaml</code> mit <code>cat</code>. Findest du <code>kind</code> und <code>replicas</code>?", accept: [/^cat\s+deployment\.yaml$/], solution: "cat deployment.yaml", hint: "cat <datei>" },
      ]},
      { type: "teach", brief: "Karte anwenden", cmd: {
        id: "t-apply", intro: "🆕 Neuer Befehl: <code>kubectl apply -f</code> – „Stelle her, was in der Datei steht.“",
        text: "Wende <code>deployment.yaml</code> auf den Cluster an – und schau zum Dock!",
        accept: [/^kubectl\s+apply\s+-f\s+deployment\.yaml$/], solution: "kubectl apply -f deployment.yaml", hint: "kubectl apply -f <datei>" } },
      { type: "terminal", brief: "Adas Doppeltrick", tasks: [
        { id: "t-ada-3", text: "Wende auch <code>service.yaml</code> an.", accept: [/^kubectl\s+apply\s+-f\s+service\.yaml$/], solution: "kubectl apply -f service.yaml", hint: "Gleicher Befehl, andere Datei." },
        { id: "t-ada-4", text: "Adas Lieblingstrick: Denselben apply <b>nochmal</b> – nichts passiert doppelt („unchanged“)!",
          accept: [/^kubectl\s+apply\s+-f\s+deployment\.yaml$/], solution: "kubectl apply -f deployment.yaml", hint: "Wirklich nochmal exakt derselbe Befehl." },
        { id: "t-ada-5", text: "Eine dritte Karte liegt bereit: <code>ingress.yaml</code> – das <b>Hafentor</b>, von dem Ole sprach. Wende es an und öffne den Weg vom offenen Meer zu <code>hafen.de/lager</code>.",
          accept: [/^kubectl\s+apply\s+-f\s+ingress\.yaml$/], solution: "kubectl apply -f ingress.yaml", hint: "Gleicher apply, Datei ingress.yaml." },
        { id: "t-ada-6", text: "Schau dir das frische Tor an: <code>kubectl get ingress</code> – Spalte HOSTS zeigt <code>hafen.de</code>.",
          accept: [/^kubectl\s+get\s+(ingress|ingresses|ing)$/], check: (sim: Sim) => sim.ingresses.some(i => i.name === "hafentor"),
          solution: "kubectl get ingress", hint: "Kurzform 'ing' geht auch." },
      ]},
      { type: "choice", npc: "ada", reviewId: "q-ch4-4",
        q: "Du wendest dieselbe Karte zweimal an. Was passiert beim zweiten Mal?",
        options: [
          { t: "Nichts Schlimmes – „unchanged“, alles stimmt ja schon.", ok: true,
            reply: "Wunderbar! apply vergleicht Soll mit Ist und tut nur das Nötige. Das nennt man <b>idempotent</b>. Mein Lieblingswort." },
          { t: "Alles wird doppelt erstellt.", ok: false,
            reply: "Nein! apply gleicht Soll und Ist ab. Schon da? Dann: „unchanged“. Deshalb ist es so sicher." },
        ]},
      { type: "dialog", npc: "ada", lines: [
        "Merke: <b>Wunschzustand aufschreiben, System stellt ihn her.</b> Das Prinzip kommt wieder – frag mal <b>Runa in der Werft</b>. Sie hat ein … Steuerrad-Problem. <i>*kichert*</i>",
      ]},
    ]},

  { id: "q9", title: "Das Steuerrad", giver: "runa", rewardXp: 35, rewardCoins: 25,
    steps: [
      { type: "dialog", npc: "runa", lines: [
        "Ahoi! Runa, Werftchefin. Lass mich raten – bei <b>Helm</b> dachtest du an das Ding für den Kopf? HA! Helm ist Englisch für <b>Steuerrad</b> – und der <b>Paketmanager für Kubernetes</b>.",
        "Bei Ada: 2 Karten für eine Mini-App. Eine ECHTE App: 30 Manifeste, mal drei Umgebungen. 90 Dateien?! NIEMALS. Helm bündelt alles in ein <b>Chart</b> – ein Paket mit Drehknöpfen.",
        "Charts liegen in <b>Repos</b> (wie Docker Hub für Images). Schritt eins: ein Repo hinzufügen.",
        "Was da alles drinliegt? Fast die ganze Werft: <b>nginx</b> (Webserver), <b>postgresql</b> (Datenbank), <b>redis</b> (schneller Zwischenspeicher), <b>keycloak</b> (Login & Rechte) und <b>prometheus</b> + <b>grafana</b> fürs Überwachen. Echte Tools – die siehst du im Job alle wieder.",
      ]},
      { type: "teach", brief: "Chart-Quelle anzapfen", cmd: {
        id: "t-repoadd", intro: "🆕 Neuer Befehl: <code>helm repo add</code> – eine Chart-Quelle hinzufügen.",
        text: "Füge das Repo <code>bitnami</code> hinzu (URL: <code>https://charts.bitnami.com/bitnami</code>).",
        accept: [/^helm\s+repo\s+add\s+bitnami\s+https:\/\/charts\.bitnami\.com\/bitnami$/], solution: "helm repo add bitnami https://charts.bitnami.com/bitnami",
        hint: "Muster: helm repo add <name> <url>" } },
      { type: "terminal", brief: "Stöbern", tasks: [
        { id: "t-runa-1", text: "Aktualisiere die Repo-Infos mit <code>helm repo update</code>.", accept: [/^helm\s+repo\s+update$/], solution: "helm repo update", hint: "helm repo …" },
        { id: "t-runa-2", text: "Suche mit <code>helm search repo nginx</code> nach einem Webserver-Chart.", accept: [/^helm\s+search\s+repo\s+nginx$/], solution: "helm search repo nginx", hint: "helm search repo <begriff>" },
      ]},
      { type: "choice", npc: "runa", reviewId: "q-ch5-1",
        q: "Einmal festnageln: Was IST Helm?",
        options: [
          { t: "Der Paketmanager für Kubernetes – installiert komplette Apps als Charts.", ok: true,
            reply: "Genau! Wie ein App-Store für den Cluster. Morgen hissen wir die erste Flagge!" },
          { t: "Ein Kopfschutz für die Werft.", ok: false,
            reply: "HA! Reingefallen. Steuerrad! Paketmanager! Schau aufs Logo!" },
        ]},
    ]},

  { id: "q10", title: "Flagge hissen", giver: "runa", rewardXp: 40, rewardCoins: 30,
    steps: [
      { type: "dialog", npc: "runa", lines: [
        "Jetzt wird installiert! Eine Installation eines Charts heißt <b>Release</b> und bekommt einen eigenen Namen. Für jedes Release weht hier an der Werft eine <b>Flagge</b> – gleich siehst du's!",
      ]},
      { type: "teach", brief: "Erste Installation", cmd: {
        id: "t-install", intro: "🆕 Neuer Befehl: <code>helm install</code> – ein Chart als Release installieren.",
        text: "Installiere <code>bitnami/nginx</code> als Release <code>mein-web</code>. Flaggen-Blick zur Werft!",
        accept: [/^helm\s+install\s+mein-web\s+bitnami\/nginx$/], solution: "helm install mein-web bitnami/nginx",
        hint: "Muster: helm install <release-name> <repo>/<chart>" } },
      { type: "terminal", brief: "Was ist da passiert?", tasks: [
        { id: "t-runa-3", text: "Zeig die Releases mit <code>helm list</code>.", accept: [/^helm\s+(list|ls)$/], solution: "helm list", hint: "Englisch für „auflisten“." },
        { id: "t-runa-4", text: "Und jetzt der Aha-Moment: Schau mit <b>kubectl</b> nach den Pods – Helm hat ganz normale Kubernetes-Ressourcen gebaut!",
          accept: [/^kubectl\s+get\s+(pods|pod|po)$/], check: (sim: Sim) => sim.releases.length > 0, solution: "kubectl get pods", hint: "Kennst du im Schlaf." },
      ]},
      { type: "drill", brief: "Runas Übungsrunde", pool: ["helm-install", "helm-list"], count: 2,
        intro: "Noch ein Release zum Festigen – mehr Flaggen!" },
      { type: "choice", npc: "runa", reviewId: "q-ch5-2",
        q: "Chart und Release – was ist der Unterschied?",
        options: [
          { t: "Chart = das Paket (Vorlage), Release = eine installierte Instanz davon.", ok: true,
            reply: "Sauber! Wie Image und Container bei Docker. Ein Chart, viele Releases, viele Flaggen!" },
          { t: "Release = die Vorlage, Chart = die Installation.", ok: false,
            reply: "Andersrum: Das Chart liegt im Regal, das Release weht am Mast." },
        ]},
    ]},

  { id: "q11", title: "Auf und ab", giver: "runa", rewardXp: 45, rewardCoins: 35,
    steps: [
      { type: "dialog", npc: "runa", lines: [
        "Heute das Beste an Helm. Apps ändern sich: mehr Kopien, neue Version … Dafür gibt's <code>helm upgrade</code> mit <code>--set</code> – die Drehknöpfe aus <code>values.yaml</code> direkt verstellen.",
      ]},
      { type: "teach", brief: "Drehknopf verstellen", cmd: {
        id: "t-upgrade", intro: "🆕 Neuer Befehl: <code>helm upgrade --set</code> – ein Release ändern.",
        text: "Stelle <code>mein-web</code> per <code>--set replicaCount=3</code> auf 3 Kopien.",
        accept: [/^helm\s+upgrade\s+mein-web\s+bitnami\/nginx\s+--set\s+replicaCount=3$/], solution: "helm upgrade mein-web bitnami/nginx --set replicaCount=3",
        hint: "Muster: helm upgrade <release> <chart> --set replicaCount=3" } },
      { type: "dialog", npc: "runa", lines: [
        "Und wenn ein Upgrade alles kaputt macht? <b>Keine Panik!</b> Helm merkt sich jede Revision. <code>helm rollback</code> bringt dich zurück. Dieser Befehl hat mir mal ein Wochenende gerettet.",
      ]},
      { type: "teach", brief: "Der Lebensretter", cmd: {
        id: "t-rollback", intro: "🆕 Neuer Befehl: <code>helm rollback</code> – zurück zu einer früheren Revision.",
        text: "Befehl von oben: doch wieder zurück! Rolle <code>mein-web</code> auf Revision <b>1</b>.",
        accept: [/^helm\s+rollback\s+mein-web(\s+1)?$/], solution: "helm rollback mein-web 1", hint: "Muster: helm rollback <release> <revision>" } },
      { type: "teach", brief: "Aufräumen", cmd: {
        id: "t-uninstall", intro: "🆕 Neuer Befehl: <code>helm uninstall</code> – Release komplett entfernen.",
        text: "Übung vorbei: Deinstalliere <code>mein-web</code>. (Die Flagge wird eingeholt …)",
        accept: [/^helm\s+uninstall\s+mein-web$/], solution: "helm uninstall mein-web", hint: "Das Gegenteil von install." } },
      { type: "drill", brief: "Runas Übungsrunde", pool: ["helm-upgrade", "helm-rollback"], count: 2,
        intro: "Upgrade & Rollback – das Power-Duo, nochmal:" },
      { type: "choice", npc: "runa", reviewId: "q-ch5-4",
        q: "Dein Upgrade hat alles zerschossen. Panik?",
        options: [
          { t: "Nein – helm rollback bringt das Release auf eine frühere Revision zurück.", ok: true,
            reply: "Eingebrannt! Revisions-Historie = dein Sicherheitsnetz. Jetzt ab zu <b>Theo</b> östlich vom Markt – der Rat plant GROSSES." },
          { t: "Ja – Cluster löschen und neu aufsetzen.", ok: false,
            reply: "Bloß nicht! helm rollback <release> <revision> – zwei Sekunden, gerettet." },
        ]},
    ]},

  { id: "q12", title: "Neues Land", giver: "theo", rewardXp: 45, rewardCoins: 35,
    steps: [
      { type: "dialog", npc: "theo", lines: [
        "Die Funk-Legende persönlich! Theo, Landvermessung. Eine Frage: Wer hat eigentlich den Hafen <b>gebaut</b>, auf dem deine Kisten stehen?",
        "Früher: zusammengeklickt und vergessen. Heute: <b>Infrastructure as Code</b> – die ganze Infrastruktur als Textdatei! Werkzeug: <b>Terraform</b>. Deklarativ, wie Adas Karten – nur baut es <b>den Hafen selbst</b>.",
        "Der Bauplan für die Ost-Erweiterung liegt schon da. Drei Schritte trennen uns von neuem Land: <code>init</code> → <code>plan</code> → <code>apply</code>. Eins nach dem anderen!",
      ]},
      { type: "terminal", brief: "Bauplan lesen",
        scenario: {
          files: { "main.tf": MAIN_TF },
          tfResources: [
            { addr: "hafen_plateau.ost", desc: 'name = "ost-erweiterung"' },
            { addr: "hafen_server.worker[0]", desc: 'name = "worker-3"' },
            { addr: "hafen_server.worker[1]", desc: 'name = "worker-4"' },
          ],
        },
        tasks: [
        { id: "t-theo-1", text: "Lies den Bauplan: <code>cat main.tf</code>. Wie viele <code>resource</code>-Blöcke siehst du?", accept: [/^cat\s+main\.tf$/], solution: "cat main.tf", hint: "Wie bei Ada." },
      ]},
      { type: "teach", brief: "Werkzeug laden", cmd: {
        id: "t-init", intro: "🆕 Neuer Befehl: <code>terraform init</code> – lädt die Provider-Plugins. Immer Schritt 1!",
        text: "Initialisiere das Projekt.",
        accept: [/^terraform\s+init$/], solution: "terraform init", hint: "Der allererste Befehl jedes Terraform-Projekts." } },
      { type: "teach", brief: "Generalprobe", cmd: {
        id: "t-plan", intro: "🆕 Neuer Befehl: <code>terraform plan</code> – zeigt, was passieren WÜRDE. Profis lesen IMMER erst den Plan!",
        text: "Lass dir den Plan zeigen – ohne dass etwas passiert.",
        accept: [/^terraform\s+plan$/], solution: "terraform plan", hint: "Die Generalprobe." } },
      { type: "choice", npc: "theo", reviewId: "q-ch6-2",
        q: "Bevor du baust – plan vs. apply?",
        options: [
          { t: "plan zeigt nur, was passieren würde – apply führt es wirklich aus.", ok: true,
            reply: "Korrekt! Und jetzt … BAU DAS LAND! Ich kann nicht hinsehen. Doch. Ich sehe hin!" },
          { t: "plan ist für kleine, apply für große Projekte.", ok: false,
            reply: "Nein: plan = Generalprobe (passiert nichts), apply = Aufführung. IMMER in der Reihenfolge." },
        ]},
      { type: "teach", brief: "LAND IN SICHT!", cmd: {
        id: "t-apply-tf", intro: "🆕 Neuer Befehl: <code>terraform apply</code> – der Plan wird Wirklichkeit.",
        text: "Baue die Ost-Erweiterung – und schau nach Osten aufs Wasser!! 🏗️",
        accept: [/^terraform\s+apply(\s+-auto-approve)?$/], solution: "terraform apply", hint: "Nach der Generalprobe die Aufführung." } },
      { type: "dialog", npc: "theo", lines: [
        "DA! NEUES LAND! Du hast mit einer TEXTDATEI eine Insel gebaut! <i>*wischt sich eine Träne weg*</i> Geh ruhig mal drauf spazieren. Morgen zeige ich dir Terraforms Gedächtnis.",
      ]},
    ]},

  { id: "q13", title: "Gedächtnis und Abriss", giver: "theo", rewardXp: 45, rewardCoins: 35,
    steps: [
      { type: "dialog", npc: "theo", lines: [
        "Terraform führt Buch über alles, was es gebaut hat: den <b>State</b> – sein Gedächtnis. Beim nächsten plan vergleicht es: Was steht in den Dateien (Soll)? Was existiert (Ist)? Nur die <b>Differenz</b> wird umgesetzt.",
      ]},
      { type: "teach", brief: "Ins Gedächtnis schauen", cmd: {
        id: "t-state", intro: "🆕 Neuer Befehl: <code>terraform state list</code> – was steht im Gedächtnis?",
        text: "Zeig den State an – alle drei gebauten Ressourcen sollten drinstehen.",
        accept: [/^terraform\s+state\s+list$/], solution: "terraform state list", hint: "terraform state …" } },
      { type: "terminal", brief: "Der Beweis", tasks: [
        { id: "t-theo-2", text: "Führe nochmal <code>terraform plan</code> aus. Es muss „No changes“ melden – Soll = Ist!",
          accept: [/^terraform\s+plan$/], check: (sim: Sim) => sim.tf.applied, solution: "terraform plan", hint: "Einfach nochmal plan." },
      ]},
      { type: "teach", brief: "Kontrollierter Abriss", cmd: {
        id: "t-destroy", intro: "🆕 Neuer Befehl: <code>terraform destroy</code> – reißt ALLES wieder ab, was Terraform gebaut hat.",
        text: "Der Rat baut erst nächstes Jahr, und Übungs-Land kostet Miete: Reiß die Erweiterung ab!",
        accept: [/^terraform\s+destroy(\s+-auto-approve)?$/], solution: "terraform destroy", hint: "Das Gegenteil von apply." } },
      { type: "choice", npc: "theo", reviewId: "q-ch6-3",
        q: "Was ist der Terraform-State?",
        options: [
          { t: "Terraforms Gedächtnis: eine Datei mit allem, was es bereits gebaut hat.", ok: true,
            reply: "Perfekt! Soll (Dateien) vs. Ist (State) → nur die Differenz wird gebaut. Du hast den ganzen Zyklus drauf: init → plan → apply → destroy!" },
          { t: "Das Fehlerprotokoll von Terraform.", ok: false,
            reply: "Nein – das Gedächtnis! Es weiß, was schon existiert. Deshalb meldete plan eben „No changes“." },
        ]},
      { type: "dialog", npc: "theo", lines: [
        "Docker, Kubernetes, YAML, Helm, Terraform – fast geschafft! Eine Sache fehlt noch, und sie ist <b>brandgefährlich</b>. Ole wartet schon. Es geht um … die <b>Krake</b>. 🐙",
      ]},
    ]},

  { id: "q14", title: "Die Hacker-Krake", giver: "ole", rewardXp: 60, rewardCoins: 50,
    steps: [
      { type: "dialog", npc: "ole", lines: [
        "Schlechte Nachrichten. In den Gewässern lauert die <b>Hacker-Krake</b> 🐙 – sie liest ALLES mit, was unverschlüsselt im Cluster liegt. Und jetzt rate, was ich in unserer Konfiguration gefunden habe …",
        "Ein <b>Passwort im Klartext</b>! In einer ConfigMap! Schau es dir an – mit <code>cat boese-config.yaml</code> – und schäm dich stellvertretend für uns alle.",
      ]},
      { type: "terminal", brief: "Das Leck finden",
        scenario: { files: { "boese-config.yaml": BOESE_CONFIG_YAML } },
        tasks: [
        { id: "t-ole-sec1", text: "Lies <code>boese-config.yaml</code>. Siehst du das Problem?",
          accept: [/^cat\s+boese-config\.yaml$/], solution: "cat boese-config.yaml", hint: "cat <datei>" },
      ]},
      { type: "dialog", npc: "ole", lines: [
        "<code>datenbank_passwort: fisch123</code> – Krakenfutter! Die Regel lautet: <b>Vertrauliches gehört NIE in YAML-Dateien oder ConfigMaps.</b> Dafür gibt es <b>Secrets</b> – Kubernetes' Schatztruhen.",
        "Und Logins für deine App? Die baut man heute nicht mehr selbst. Man stellt einen fertigen <b>Auth-Server</b> davor: <b>Keycloak</b>. Der macht Anmeldung, Single Sign-On und wer-darf-was – ein <b>Identity Provider</b> (kurz IDP). Deine App fragt nur noch: „Keycloak, ist die Person echt?“",
      ]},
      { type: "teach", brief: "Die Schatztruhe", cmd: {
        id: "t-secret", intro: "🆕 Neuer Befehl: <code>kubectl create secret generic</code> – Vertrauliches sicher ablegen.",
        text: "Lege ein Secret <code>db-zugang</code> an, mit <code>--from-literal=passwort=tintenfisch88</code>.",
        accept: [/^kubectl\s+create\s+secret\s+generic\s+db-zugang\s+--from-literal[=\s][\w.-]+=\S+$/],
        solution: "kubectl create secret generic db-zugang --from-literal=passwort=tintenfisch88",
        hint: "Muster: kubectl create secret generic <name> --from-literal=schluessel=wert" } },
      { type: "teach", brief: "Truhen zählen", cmd: {
        id: "t-getsecrets", intro: "🆕 Neuer Befehl: <code>kubectl get secrets</code> – alle Schatztruhen anzeigen.",
        text: "Zeig die Secrets an. Beachte: Den INHALT zeigt die Liste nicht – genau das ist der Punkt!",
        accept: [/^kubectl\s+get\s+(secrets|secret)$/], solution: "kubectl get secrets", hint: "kubectl get …" } },
      { type: "drill", brief: "Sicherheits-Drill", pool: ["k-secret", "k-get-secrets"], count: 2,
        intro: "Sicherheit muss sitzen – zwei Wiederholungen:" },
      { type: "choice", npc: "ole", reviewId: "q-sec-1",
        q: "Wohin gehören Passwörter und API-Schlüssel im Cluster?",
        options: [
          { t: "In Secrets – niemals im Klartext in YAML-Dateien oder ConfigMaps.", ok: true,
            reply: "DAS rettet Häfen! Die Krake wird trotzdem immer wieder angreifen – aber jetzt weißt du, wie man sie vertreibt." },
          { t: "In die ConfigMap, da sind sie übersichtlich.", ok: false,
            reply: "NEIN! ConfigMaps sind Klartext – Krakenfutter! Vertrauliches gehört in Secrets." },
        ]},
      { type: "dialog", npc: "ole", lines: [
        "Damit erkläre ich deine <b>Grundausbildung für abgeschlossen</b>! 🎉 Docker, Kubernetes, YAML, Helm, Terraform, Security – du hast den ganzen Werkzeugkasten.",
        "Aber Port Kubernia schläft nie: <b>Piraten</b> überfallen die Stege, die <b>Krake</b> schnüffelt nach Klartext, und deine Dienste verdienen rund um die Uhr. Halte den Hafen am Laufen!",
        "Und … hörst du das Donnergrollen? Die <b>Sturm-Saison</b> beginnt. <b>Juno</b>, unsere Sturmwache am Leuchtturm im Osten, braucht dringend jemanden, der kaputte Dienste reparieren kann. Geh zu ihr – jetzt wird es ernst! ⛈️",
      ]},
    ]},

  /* ========== STURM-SAISON: Troubleshooting wie im echten Betrieb ========== */

  { id: "q15", title: "Sturmwarnung am Leuchtturm", giver: "juno", rewardXp: 50, rewardCoins: 40,
    steps: [
      { type: "dialog", npc: "juno", lines: [
        "Da bist du ja endlich! Juno, Sturmwache. Während die anderen dir beigebracht haben, Dinge zu <b>bauen</b>, lernst du bei mir, sie zu <b>reparieren</b> – das ist die halbe Miete in diesem Job.",
        "Der Sturm letzte Nacht hat das <b>leuchtfeuer</b>-Deployment erwischt. Erste Debugging-Regel: <b>STATUS lesen, nicht raten.</b> Schau dir die Pods an!",
      ]},
      { type: "terminal", brief: "Diagnose",
        scenario: { deployments: [{ name: "leuchtfeuer", image: "ngnix:latest", replicas: 1, broken: { type: "imagepull", badImage: "ngnix:latest" } }] },
        tasks: [
        { id: "t-j15-1", text: "Zeig die Pods – und lies die STATUS-Spalte genau!",
          accept: [/^kubectl\s+get\s+(pods|pod|po)$/], solution: "kubectl get pods", hint: "Der Übersichts-Befehl." },
        { id: "t-j15-2", text: "<code>ImagePullBackOff</code>! Zweite Regel: <b>describe lesen.</b> Beschreibe den <code>leuchtfeuer</code>-Pod und lies die Events ganz unten.",
          accept: [/^kubectl\s+describe\s+pods?\s+leuchtfeuer-\S+$/], solution: "kubectl describe pod <leuchtfeuer-pod>", hint: "kubectl describe pod <name> – Name aus get pods." },
      ]},
      { type: "choice", npc: "juno", reviewId: "q-ts-2",
        q: "In den Events steht: Failed to pull image „ngnix:latest“ – repository does not exist. Was ist die Ursache?",
        options: [
          { t: "Ein Tippfehler im Image-Namen: „ngnix“ statt „nginx“!", ok: true,
            reply: "Scharfes Auge! ImagePullBackOff heißt fast immer: Tippfehler im Namen, falscher Tag oder fehlende Zugriffsrechte auf die Registry." },
          { t: "Der Node ist kaputt.", ok: false,
            reply: "Nein – lies die Events nochmal: Das IMAGE kann nicht geladen werden. „ngnix“ … fällt dir was auf? Tippfehler!" },
          { t: "Zu wenig Speicher im Cluster.", ok: false,
            reply: "Das wäre ein anderes Fehlerbild (Pending/OOM). Hier steht klar: repository does not exist – das Image „ngnix“ gibt es nicht. Tippfehler!" },
        ]},
      { type: "teach", brief: "Die Reparatur", cmd: {
        id: "t-setimage", intro: "🆕 Neuer Befehl: <code>kubectl set image</code> – tauscht das Image eines Deployments aus.",
        text: "Setze das richtige Image: <code>kubectl set image deployment/leuchtfeuer leuchtfeuer=nginx</code>",
        accept: [/^kubectl\s+set\s+image\s+deployment\/leuchtfeuer\s+\S+=nginx(:\S+)?$/],
        solution: "kubectl set image deployment/leuchtfeuer leuchtfeuer=nginx",
        hint: "Muster: kubectl set image deployment/<name> <container>=<richtiges-image>" } },
      { type: "terminal", brief: "Verifizieren", tasks: [
        { id: "t-j15-3", text: "Dritte Regel: <b>Fix immer verifizieren!</b> Laufen die Pods wieder?",
          accept: [/^kubectl\s+get\s+(pods|pod|po)$/], check: (sim: Sim) => { const d = sim.deployments.find(d => d.name === "leuchtfeuer"); return d && !d.broken; },
          solution: "kubectl get pods", hint: "get pods – STATUS muss Running sein." },
      ]},
      { type: "dialog", npc: "juno", lines: [
        "Sauber repariert! Merk dir das Mantra für IMMER: <b>get pods → describe → logs.</b> Erst gucken, dann verstehen, dann fixen, dann verifizieren. Morgen zeige ich dir den fiesesten Fehler von allen …",
      ]},
    ]},

  { id: "q16", title: "Das Flackern", giver: "juno", rewardXp: 55, rewardCoins: 40,
    steps: [
      { type: "dialog", npc: "juno", lines: [
        "Siehst du die <b>funkboje</b> da draußen flackern? Der Pod startet, stürzt ab, startet, stürzt ab … Das nennt sich <b>CrashLoopBackOff</b> – der Klassiker unter den Cluster-Fehlern.",
        "Das Tückische: Das Image ist OK, der Node ist OK – die <b>App selbst</b> stirbt beim Start. Und warum sie stirbt, verrät nur eines: <b>die Logs.</b> Dritte Stufe des Mantras!",
      ]},
      { type: "terminal", brief: "Logs lesen",
        scenario: { deployments: [{ name: "funkboje", image: "nginx", replicas: 1, broken: { type: "crashloop", needsSecret: "funk-schluessel" } }] },
        tasks: [
        { id: "t-j16-1", text: "Verschaff dir den Überblick: get pods. Beachte auch die RESTARTS-Spalte!",
          accept: [/^kubectl\s+get\s+(pods|pod|po)$/], solution: "kubectl get pods", hint: "Wie immer zuerst." },
        { id: "t-j16-2", text: "Jetzt die Wahrheit: Lies die <b>Logs</b> des funkboje-Pods!",
          accept: [/^kubectl\s+logs\s+funkboje-\S+$/], solution: "kubectl logs <funkboje-pod>", hint: "kubectl logs <pod-name>" },
      ]},
      { type: "choice", npc: "juno", reviewId: "q-ts-1",
        q: "Das Log sagt: FATAL: Secret 'funk-schluessel' nicht gefunden. Was ist der Plan?",
        options: [
          { t: "Das fehlende Secret anlegen, dann die Pods neu starten.", ok: true,
            reply: "Exakt! Die App braucht das Secret zum Start. Erst die Ursache beheben, DANN neu starten – andersrum bringt nichts." },
          { t: "Ein anderes Image installieren.", ok: false,
            reply: "Nein – das Image ist in Ordnung! Lies das Log: Der App fehlt das Secret 'funk-schluessel'. Das legen wir an und starten neu." },
        ]},
      { type: "terminal", brief: "Ursache beheben", tasks: [
        { id: "t-j16-3", text: "Lege das fehlende Secret <code>funk-schluessel</code> an (Wert frei wählbar).",
          accept: [/^kubectl\s+create\s+secret\s+generic\s+funk-schluessel\s+--from-literal[=\s][\w.-]+=\S+$/],
          solution: "kubectl create secret generic funk-schluessel --from-literal=code=blinkblink1", hint: "kubectl create secret generic <name> --from-literal=k=v" },
      ]},
      { type: "teach", brief: "Sauberer Neustart", cmd: {
        id: "t-rollout", intro: "🆕 Neuer Befehl: <code>kubectl rollout restart</code> – startet alle Pods eines Deployments sauber neu.",
        text: "Starte das Deployment <code>funkboje</code> neu – jetzt findet es sein Secret!",
        accept: [/^kubectl\s+rollout\s+restart\s+deployment[\/\s]funkboje$/],
        solution: "kubectl rollout restart deployment funkboje",
        hint: "Muster: kubectl rollout restart deployment <name>" } },
      { type: "terminal", brief: "Verifizieren", tasks: [
        { id: "t-j16-4", text: "Verifizieren! Leuchtet die funkboje wieder stabil?",
          accept: [/^kubectl\s+get\s+(pods|pod|po)$/], check: (sim: Sim) => { const d = sim.deployments.find(d => d.name === "funkboje"); return d && !d.broken; },
          solution: "kubectl get pods", hint: "STATUS muss Running sein." },
      ]},
      { type: "dialog", npc: "juno", lines: [
        "Ursache → Fix → Neustart → Verifikation. Du debuggst wie eine alte Sturmwache! Eine Prüfung fehlt noch – und für die brauchen wir … mehr Hafen. Wortwörtlich.",
      ]},
    ]},

  { id: "q17", title: "Kein Platz im Hafen", giver: "juno", rewardXp: 70, rewardCoins: 55,
    steps: [
      { type: "dialog", npc: "juno", lines: [
        "Großauftrag! Die Reederei will ihren <b>frachtplaner</b> bei uns laufen lassen. Aber irgendetwas stimmt nicht – die Pods kommen einfach nicht hoch. Kein Absturz, kein Image-Fehler … sie <b>warten</b> nur.",
      ]},
      { type: "terminal", brief: "Diagnose",
        scenario: {
          deployments: [{ name: "frachtplaner", image: "nginx", replicas: 2, broken: { type: "pending" } }],
          files: { "main.tf": MAIN_TF },
          tfResources: [
            { addr: "hafen_plateau.ost", desc: 'name = "ost-erweiterung"' },
            { addr: "hafen_server.worker[0]", desc: 'name = "ahoi-worker-3"' },
            { addr: "hafen_server.worker[1]", desc: 'name = "ahoi-worker-4"' },
          ],
        },
        tasks: [
        { id: "t-j17-1", text: "Du kennst das Mantra: get pods. Was sagt der STATUS?",
          accept: [/^kubectl\s+get\s+(pods|pod|po)$/], solution: "kubectl get pods", hint: "Schritt 1, immer." },
        { id: "t-j17-2", text: "<code>Pending</code> – die Pods warten auf einen Platz. Warum? describe verrät es in den Events!",
          accept: [/^kubectl\s+describe\s+pods?\s+frachtplaner-\S+$/], solution: "kubectl describe pod <frachtplaner-pod>", hint: "describe + Events lesen." },
      ]},
      { type: "choice", npc: "juno", reviewId: "q-ts-3",
        q: "Events: „0/3 nodes are available: insufficient capacity“. Diagnose?",
        options: [
          { t: "Der Cluster ist voll – wir brauchen mehr Nodes!", ok: true,
            reply: "Genau! Kein Bug, kein Tippfehler – schlicht kein Platz. Und wer baut Infrastruktur? Na? … TERRAFORM! Theos Bauplan für die Ost-Erweiterung liegt noch bereit." },
          { t: "Das Image ist kaputt.", ok: false,
            reply: "Nein – dann stünde da ImagePullBackOff. „insufficient capacity“ = kein Platz auf den Nodes. Wir brauchen MEHR HAFEN!" },
        ]},
      { type: "terminal", brief: "Mehr Hafen bauen!", tasks: [
        { id: "t-j17-3", text: "Der Bauplan liegt bereit (<code>main.tf</code>). Initialisiere Terraform!",
          accept: [/^terraform\s+init$/], solution: "terraform init", hint: "Schritt 1 jedes Terraform-Projekts." },
        { id: "t-j17-4", text: "Generalprobe – was wird gebaut?",
          accept: [/^terraform\s+plan$/], solution: "terraform plan", hint: "Immer erst lesen." },
        { id: "t-j17-5", text: "BAUEN! Und dann beobachte: Ost-Plateau + zwei neue Nodes … 🏗️",
          accept: [/^terraform\s+apply(\s+-auto-approve)?$/], solution: "terraform apply", hint: "Die Aufführung." },
        { id: "t-j17-6", text: "Zähl nach: Wie viele Nodes hat dein Cluster jetzt?",
          accept: [/^kubectl\s+get\s+(nodes|node|no)$/], check: (sim: Sim) => sim.nodes.length > 3, solution: "kubectl get nodes", hint: "kubectl, nicht terraform!" },
        { id: "t-j17-7", text: "Und der Moment der Wahrheit: Haben die frachtplaner-Pods jetzt Platz gefunden?",
          accept: [/^kubectl\s+get\s+(pods|pod|po)$/], check: (sim: Sim) => { const d = sim.deployments.find(d => d.name === "frachtplaner"); return d && !d.broken; },
          solution: "kubectl get pods", hint: "get pods – STATUS lesen." },
      ]},
      { type: "choice", npc: "juno", reviewId: "q-ts-4",
        q: "Letzte Prüfungsfrage: Wie lautet das Debugging-Mantra?",
        options: [
          { t: "get pods → describe → logs. Erst gucken, dann verstehen, dann fixen, dann verifizieren.", ok: true,
            reply: "PERFEKT. Damit löst du draußen 80% aller Cluster-Probleme. Das ist keine Übertreibung." },
          { t: "Erstmal alles neu starten und hoffen.", ok: false,
            reply: "HA! Der Klassiker – und manchmal klappt's sogar. Aber Profis diagnostizieren erst: get pods → describe → logs. Dann fixen. Dann verifizieren." },
        ]},
      { type: "dialog", npc: "juno", lines: [
        "Hiermit ernenne ich dich zur <b>Sturmwache ehrenhalber</b>! 🌩️ Die Ost-Erweiterung bleibt stehen – Port Kubernia ist gewachsen, dank dir.",
        "Ab jetzt gilt: Wenn ein Sturm aufzieht und etwas kaputtgeht, bist DU dran. Du hast das Mantra, du hast die Befehle. Und zwischen den Stürmen? Übe bei mir, halte den Streak, füttere die Krabbe. Der Hafen zählt auf dich, Admiral-Anwärter:in! ⚓",
      ]},
    ]},

  { id: "q18", title: "Seekarten versionieren", giver: "ada", rewardXp: 45, rewardCoins: 32,
    steps: [
      { type: "dialog", npc: "ada",
        scenario: { files: { "seekarte.md": "# Seekarte Port Kubernia\nHafenbecken, drei Stege, Leuchtturm im Osten." } },
        lines: [
          "Pssst. Komm näher. Sieh dir meine <b>Seekarten</b> an – ich ändere sie ständig. Neulich? Falsche Route eingezeichnet, gespeichert, alte Version <b>weg</b>. Eine Woche Arbeit. Futsch.",
          "Nie wieder. Seitdem nutze ich <b>Git</b> – das Logbuch für Dateien. Es merkt sich <b>jede</b> Version, und du kommst immer zur alten zurück. Profis versionieren so ihren Code, ihre YAMLs, einfach alles.",
          "Ich hab dir eine Karte hingelegt: <code>seekarte.md</code> (mit <code>ls</code> und <code>cat</code> ansehbar). Stellen wir sie unter Gits Schutz. Zuerst: aus diesem Ordner ein Repository machen.",
        ] },
      { type: "teach", brief: "Repo anlegen", cmd: {
        id: "t-git-init", intro: "🆕 Neuer Befehl: <code>git init</code> – macht aus dem Ordner ein Git-Repository (legt einen versteckten <code>.git</code>-Ordner an).",
        text: "Initialisiere hier ein Git-Repository.",
        accept: [/^git\s+init$/], solution: "git init", hint: "Wirklich nur: git init" } },
      { type: "dialog", npc: "ada", lines: [
        "Git beobachtet jetzt den Ordner – hält aber nichts von allein fest. Du sagst ihm <b>wann</b>. Frag es zuerst, was es sieht: <code>git status</code> zeigt, welche Dateien noch <b>unversioniert</b> sind.",
      ] },
      { type: "teach", brief: "Stand prüfen", cmd: {
        id: "t-git-status", intro: "🆕 <code>git status</code> – zeigt den aktuellen Stand: welcher Branch, was ist neu / geändert / vorgemerkt.",
        text: "Lass dir den Status anzeigen. <code>seekarte.md</code> müsste als „unversioniert“ auftauchen.",
        accept: [/^git\s+status$/], solution: "git status", hint: "git + ein Wort für „Stand“." } },
      { type: "dialog", npc: "ada", lines: [
        "Da ist sie, unter „Unversionierte Dateien“. Zwei Schritte bis zur sicheren Version: erst <b>vormerken</b> (<code>git add</code>), dann <b>festhalten</b> (<code>git commit</code>). Das Vormerken heißt <i>Staging</i> – du wählst aus, was in den nächsten Schnappschuss soll.",
      ] },
      { type: "teach", brief: "Vormerken", cmd: {
        id: "t-git-add", intro: "🆕 <code>git add &lt;datei&gt;</code> – merkt eine Datei für den nächsten Commit vor (Staging).",
        text: "Merke <code>seekarte.md</code> zum Commit vor.",
        accept: [/^git\s+add\s+seekarte\.md$/], solution: "git add seekarte.md", hint: "Muster: git add <datei>" } },
      { type: "teach", brief: "Festhalten", cmd: {
        id: "t-git-commit", intro: "🆕 <code>git commit -m \"…\"</code> – hält die vorgemerkten Änderungen als Schnappschuss in der Historie fest, mit kurzer Nachricht.",
        text: "Halte die Karte fest – Commit-Nachricht z.B. <code>Erste Seekarte</code>.",
        accept: [/^git\s+commit\s+-m\s+("[^"]+"|'[^']+'|\S+)$/], solution: 'git commit -m "Erste Seekarte"', hint: 'Muster: git commit -m "deine Nachricht"' } },
      { type: "dialog", npc: "ada", lines: [
        "<b>Festgehalten!</b> Diese Version ist für immer sicher. Jede:r kann später nachlesen, was wann geändert wurde. Schau in die Historie: <code>git log</code>.",
      ] },
      { type: "teach", brief: "Historie lesen", cmd: {
        id: "t-git-log", intro: "🆕 <code>git log</code> – zeigt die Liste aller Commits (die Versions-Historie).",
        text: "Zeig die Commit-Historie an.",
        accept: [/^git\s+log$/], solution: "git log", hint: "git + ein Wort für „Logbuch“." } },
      { type: "drill", brief: "Adas Übungsrunde", pool: ["git-status", "git-add", "git-commit"], count: 3,
        intro: "Der Dreiklang sitzt erst mit Übung: status → add → commit." },
      { type: "choice", npc: "ada", reviewId: "q-git-1",
        q: "Ada prüft: Was macht <code>git commit</code>?",
        options: [
          { t: "Es hält die vorgemerkten Änderungen als Schnappschuss mit Nachricht in der Historie fest.", ok: true,
            reply: "GENAU. Ein Commit ist ein Speicherpunkt, zu dem du immer zurückkannst." },
          { t: "Es lädt die Dateien sofort auf den Server hoch.", ok: false,
            reply: "Nein – das wäre git push. Ein Commit bleibt erstmal LOKAL." },
        ] },
      { type: "choice", npc: "ada", reviewId: "q-git-3",
        q: "Und der Unterschied zwischen <code>git add</code> und <code>git commit</code>?",
        options: [
          { t: "add merkt Änderungen vor (Staging), commit hält die vorgemerkten dann dauerhaft fest.", ok: true,
            reply: "Richtig. Erst auswählen (add), dann einrahmen (commit) – zwei bewusste Schritte." },
          { t: "Kein Unterschied, beides speichert dasselbe.", ok: false,
            reply: "Doch! add = vormerken, commit = festhalten. Du kannst gezielt nur EINEN Teil committen." },
        ] },
      { type: "dialog", npc: "ada", lines: [
        "Du hast den wichtigsten Rhythmus der Softwarewelt gelernt: <b>ändern → add → commit</b>. Komm wieder, dann zeig ich dir <b>Zweige</b> – wie man gefahrlos experimentiert. Üben kannst du bei mir jederzeit!",
      ] },
    ]},

  { id: "q19", title: "Ein eigener Zweig", giver: "ada", rewardXp: 50, rewardCoins: 38,
    steps: [
      { type: "dialog", npc: "ada",
        scenario: { files: { "route-neu.md": "# Experimentelle Route\n(Entwurf – noch nicht sicher!)" } },
        lines: [
          "Zurück! Heute das Mächtigste an Git: <b>Branches</b> (Zweige). Stell dir vor, du willst eine <b>riskante neue Route</b> ausprobieren – aber die geprüfte Hauptkarte (<code>main</code>) soll heil bleiben.",
          "Lösung: ein eigener Zweig. Dort arbeitest du frei, und erst wenn es gut ist, führst du ihn mit <code>main</code> zusammen. Genau so arbeiten Teams – jede:r auf eigenem Branch, am Ende wird zusammengeführt (oft nach einem Review).",
          "Ich hab dir <code>route-neu.md</code> hingelegt. Leg einen Zweig an und wechsle hinein – in einem Rutsch mit <code>git checkout -b</code>.",
        ] },
      { type: "teach", brief: "Zweig + wechseln", cmd: {
        id: "t-git-checkout-b", intro: "🆕 <code>git checkout -b &lt;name&gt;</code> – legt einen neuen Branch an UND wechselt direkt hinein.",
        text: "Leg den Branch <code>experiment-route</code> an und wechsle hinein.",
        accept: [/^git\s+checkout\s+-b\s+experiment-route$/], solution: "git checkout -b experiment-route", hint: "Muster: git checkout -b <name>" } },
      { type: "dialog", npc: "ada", lines: [
        "Du bist jetzt auf <code>experiment-route</code> – <code>main</code> bleibt unberührt. Mach hier deine Arbeit fest: <code>route-neu.md</code> vormerken und committen (wie gestern gelernt).",
      ] },
      { type: "teach", brief: "Vormerken", cmd: {
        id: "t-git-add2", intro: "↩︎ Wiederholung: <code>git add</code> merkt die Datei vor.",
        text: "Merke <code>route-neu.md</code> vor.",
        accept: [/^git\s+add\s+route-neu\.md$/], solution: "git add route-neu.md", hint: "Muster: git add <datei>" } },
      { type: "teach", brief: "Festhalten", cmd: {
        id: "t-git-commit2", intro: "↩︎ Wiederholung: <code>git commit -m \"…\"</code> hält es fest.",
        text: "Committe die neue Route, z.B. mit <code>Neue Route skizziert</code>.",
        accept: [/^git\s+commit\s+-m\s+("[^"]+"|'[^']+'|\S+)$/], solution: 'git commit -m "Neue Route skizziert"', hint: 'Muster: git commit -m "Nachricht"' } },
      { type: "dialog", npc: "ada", lines: [
        "Die Route sitzt sicher im Zweig. Jetzt zurück zur Hauptkarte: wechsle nach <code>main</code>.",
      ] },
      { type: "teach", brief: "Zurück zu main", cmd: {
        id: "t-git-checkout-main", intro: "🆕 <code>git checkout &lt;name&gt;</code> (ohne -b) – wechselt auf einen bestehenden Branch.",
        text: "Wechsle zurück auf <code>main</code>.",
        accept: [/^git\s+checkout\s+main$/], solution: "git checkout main", hint: "git checkout <branchname>" } },
      { type: "dialog", npc: "ada", lines: [
        "Auf <code>main</code> ist die neue Route noch nicht zu sehen – sie lebt im Zweig. Jetzt das Finale: <b>zusammenführen</b> mit <code>git merge</code>.",
      ] },
      { type: "teach", brief: "Zusammenführen", cmd: {
        id: "t-git-merge", intro: "🆕 <code>git merge &lt;branch&gt;</code> – holt die Arbeit aus einem anderen Branch in deinen aktuellen.",
        text: "Führe <code>experiment-route</code> in <code>main</code> zusammen.",
        accept: [/^git\s+merge\s+experiment-route$/], solution: "git merge experiment-route", hint: "Muster: git merge <branch>" } },
      { type: "dialog", npc: "ada", lines: [
        "Vereint! Zum Schluss teilst du deine Arbeit mit dem Team: <code>git push</code> schiebt deine Commits auf den Server (z.B. GitLab). Erst dann sehen es die anderen.",
      ] },
      { type: "teach", brief: "Hochladen", cmd: {
        id: "t-git-push", intro: "🆕 <code>git push</code> – lädt deine lokalen Commits auf den entfernten Server (origin).",
        text: "Schiebe deine Arbeit zum Server hoch.",
        accept: [/^git\s+push$/], solution: "git push", hint: "Wirklich nur: git push" } },
      { type: "drill", brief: "Adas Übungsrunde", pool: ["git-branch", "git-checkout", "git-status"], count: 3,
        intro: "Branchen will geübt sein – ein paar Wiederholungen:" },
      { type: "choice", npc: "ada", reviewId: "q-git-2",
        q: "Wozu legt man einen eigenen Branch an?",
        options: [
          { t: "Um Änderungen abseits von main auszuprobieren und erst später (oft nach Review) zusammenzuführen.", ok: true,
            reply: "Genau. main bleibt stabil, dein Experiment stört niemanden – bis du bereit bist." },
          { t: "Damit Git schneller läuft.", ok: false,
            reply: "Nein, mit Tempo hat das nichts zu tun. Es geht um sicheres, paralleles Arbeiten." },
        ] },
      { type: "dialog", npc: "ada", lines: [
        "Du beherrschst jetzt den vollen Git-Kreis: <b>branch → commit → merge → push</b>. Genau dieser Ablauf treibt später auch die <b>Pipelines</b> an (ein push löst automatische Builds & Deployments aus – aber das ist eine andere Insel). Sauber gemacht, Kartograph:in! 🗺️",
      ] },
    ]},

  { id: "q20", title: "Die Pipeline-Passage", giver: "ada", rewardXp: 60, rewardCoins: 45,
    steps: [
      { type: "dialog", npc: "ada",
        scenario: { files: { ".gitlab-ci.yml": GITLAB_CI_YML, "Dockerfile": DOCKERFILE }, ciDeploy: { name: "funkdienst", image: "nginx", replicas: 2 } },
        lines: [
          "Du erinnerst dich: Ich sagte, ein <code>git push</code> treibt später <b>Pipelines</b> an. Willkommen in der <b>Pipeline-Passage</b> – hier wird aus „von Hand deployen“ endlich Automatik.",
          "Auf dem Server (z.B. GitLab) sitzt ein <b>Runner</b> und wartet. Liegt im Repo eine Datei <code>.gitlab-ci.yml</code>, arbeitet er bei <b>jedem Push</b> automatisch eine <b>Pipeline</b> ab – eine Kette von Schritten, klassisch <b>build → test → deploy</b>.",
          "Das ist <b>CI/CD</b>: <b>CI</b> (Continuous Integration) baut & testet jede Änderung sofort, <b>CD</b> (Continuous Delivery/Deployment) liefert sie automatisch aus. Ich hab dir eine <code>.gitlab-ci.yml</code> und ein <code>Dockerfile</code> hingelegt. Sieh dir die Pipeline-Definition an: <code>cat .gitlab-ci.yml</code>.",
        ] },
      { type: "teach", brief: "Pipeline lesen", cmd: {
        id: "t-ci-cat", intro: "🆕 Die <code>.gitlab-ci.yml</code> beschreibt die Pipeline: welche <b>stages</b> es gibt und welche <b>Jobs</b> mit welchen <code>script</code>-Befehlen darin laufen.",
        text: "Lies die Pipeline-Definition <code>.gitlab-ci.yml</code>.",
        accept: [/^cat\s+\.gitlab-ci\.yml$/], solution: "cat .gitlab-ci.yml", hint: "cat <datei> – wie bei meiner Seekarte." } },
      { type: "dialog", npc: "ada", lines: [
        "Siehst du die drei <b>stages</b>? <b>build</b> baut aus dem <code>Dockerfile</code> ein Docker-Image. <b>test</b> prüft den Code – <i>bevor</i> irgendwas live geht. <b>deploy</b> macht ein <code>kubectl apply</code> in den Cluster – also genau das, was du bei mir und Theo von Hand getippt hast, nur <b>automatisch</b>.",
        "Und schau aufs <code>only: main</code> beim deploy: wirklich ausgerollt wird nur, was auf dem <b>main</b>-Branch landet. Feature-Branches werden gebaut & getestet, aber nicht deployt – ein Sicherheitsnetz.",
        "Jetzt der Beweis. Nimm die neuen Dateien ins Repo auf – diesmal alle auf einmal mit <code>git add .</code> (der Punkt = „alles“).",
      ] },
      { type: "teach", brief: "Alles vormerken", cmd: {
        id: "t-ci-addall", intro: "🆕 <code>git add .</code> – der Punkt merkt <b>alle</b> neuen/geänderten Dateien auf einmal vor, statt jede einzeln.",
        text: "Merke alle Änderungen auf einmal vor.",
        accept: [/^git\s+add\s+\.$/], solution: "git add .", hint: "git add + ein einzelner Punkt." } },
      { type: "teach", brief: "Festhalten", cmd: {
        id: "t-ci-commit", intro: "↩︎ Wiederholung: <code>git commit -m \"…\"</code> hält die vorgemerkten Änderungen fest.",
        text: "Committe die Pipeline-Einrichtung, z.B. mit <code>CI-Pipeline eingerichtet</code>.",
        accept: [/^git\s+commit\s+-m\s+("[^"]+"|'[^']+'|\S+)$/], solution: 'git commit -m "CI-Pipeline eingerichtet"', hint: 'Muster: git commit -m "Nachricht"' } },
      { type: "teach", brief: "Push löst Pipeline aus", cmd: {
        id: "t-ci-push", intro: "🆕 Der entscheidende Moment: <code>git push</code> lädt nicht nur hoch – weil jetzt eine <code>.gitlab-ci.yml</code> im Repo liegt, <b>startet der Runner automatisch die Pipeline</b>.",
        text: "Schiebe deine Arbeit zum Server – und lass die erste Pipeline laufen.",
        accept: [/^git\s+push$/], solution: "git push", hint: "Wirklich nur: git push" } },
      { type: "dialog", npc: "ada", lines: [
        "Spürst du das? Du hast nichts deployt – du hast nur <b>gepusht</b>. Den Rest macht die Pipeline. Schau ihr beim Arbeiten zu: <code>glab</code> ist das Kommandozeilen-Werkzeug für GitLab.",
      ] },
      { type: "teach", brief: "Pipeline-Status", cmd: {
        id: "t-ci-status", intro: "🆕 Neuer Befehl: <code>glab ci status</code> – zeigt die Pipeline des aktuellen Branches und ob ihre Stages durchgelaufen sind.",
        text: "Sieh nach, wie weit die Pipeline ist.",
        accept: [/^glab\s+ci\s+status$/], solution: "glab ci status", hint: "glab ci <unterbefehl> fürs Nachschauen." } },
      { type: "dialog", npc: "ada", lines: [
        "Alles grün ✅ – build, test, <b>deploy</b>. Und jetzt das Beste: der deploy-Stage hat den Dienst <b>funkdienst</b> ganz von allein in den Cluster gerollt. Kein <code>kubectl apply</code> von Hand. Überzeug dich: <code>kubectl get pods</code>.",
      ] },
      { type: "teach", brief: "Beweis im Cluster", cmd: {
        id: "t-ci-getpods", intro: "↩︎ Beweis: die Pipeline hat <code>funkdienst</code> für dich deployt – ohne dass du den Cluster angefasst hast.",
        text: "Zeig die Pods – <code>funkdienst</code> müsste jetzt laufen.",
        accept: [/^kubectl\s+get\s+(pods|pod|po)$/], solution: "kubectl get pods", hint: "kubectl get pods" } },
      { type: "choice", npc: "ada", reviewId: "q-ci-1",
        q: "Ada prüft: Was löst die Pipeline aus?",
        options: [
          { t: "Ein git push in ein Repo, das eine .gitlab-ci.yml enthält.", ok: true,
            reply: "Genau. Push → der Runner sieht die .gitlab-ci.yml → Pipeline läuft. Vollautomatisch." },
          { t: "Man muss sie jeden Morgen von Hand starten.", ok: false,
            reply: "Nein – das wäre ja keine Automatik. Der Push ist der Auslöser." },
        ] },
      { type: "choice", npc: "ada", reviewId: "q-ci-2",
        q: "Und in welcher Reihenfolge laufen die Stages?",
        options: [
          { t: "build → test → deploy", ok: true,
            reply: "Richtig. Erst bauen, dann testen (bevor etwas live geht!), dann ausrollen. Fällt test durch, wird gar nicht erst deployt." },
          { t: "deploy → test → build", ok: false,
            reply: "Andersherum – du würdest Ungetestetes ausrollen und erst danach bauen. Genau das verhindert die Reihenfolge." },
        ] },
      { type: "drill", brief: "Adas Pipeline-Übung", pool: ["git-add-all", "ci-status"], count: 2,
        intro: "Der CI/CD-Reflex: alles vormerken, pushen, Status checken." },
      { type: "dialog", npc: "ada", lines: [
        "Du hast die Pipeline-Passage gemeistert: <b>push → build → test → deploy</b>, vollautomatisch. So liefert ein Team hundertmal am Tag aus, ohne Angst – die Pipeline ist Bauanleitung, Prüfer und Auslieferer in einem.",
        "Und es schließt den Kreis: deine Befehle von Bo (Docker-Build), von mir (Git) und von Ole (kubectl apply) – die Pipeline tippt sie jetzt für dich. Das ist das Herz von modernem DevOps. 🚢",
      ] },
    ]},

  { id: "q21", title: "Werft-Ausbau: dein eigenes Chart", giver: "runa", rewardXp: 60, rewardCoins: 45,
    steps: [
      { type: "dialog", npc: "runa", lines: [
        "Zurück an der Werft? Gut! Bisher hast du <b>fremde</b> Charts installiert (bitnami/nginx & Co.). Heute baust du dein <b>EIGENES</b> – echter Werft-Ausbau!",
        "Ein Chart ist nur ein Ordner mit fester Struktur: <code>Chart.yaml</code> (der Steckbrief – Name, Version), <code>values.yaml</code> (die Drehknöpfe) und <code>templates/</code> (die Vorlagen, die zu echten Manifesten rendern). <code>helm create</code> legt dir das Gerüst fertig hin.",
      ]},
      { type: "teach", brief: "Chart-Gerüst anlegen", cmd: {
        id: "t-create-chart", intro: "🆕 Neuer Befehl: <code>helm create</code> – ein komplettes Chart-Gerüst anlegen.",
        text: "Bau dir ein eigenes Chart namens <code>funkdienst</code>. (Tipp danach: <code>ls</code> und <code>cat funkdienst/Chart.yaml</code> – schau dir an, was entstanden ist!)",
        accept: [/^helm\s+create\s+funkdienst$/], solution: "helm create funkdienst",
        hint: "Muster: helm create <chart-name>" } },
      { type: "dialog", npc: "runa", lines: [
        "Sieh dir <code>cat funkdienst/values.yaml</code> an – das sind die Drehknöpfe (Anzahl Kopien, Image …). Bevor du ein Chart teilst oder ausrollst, prüfst du es auf Fehler. Dafür gibt's <code>helm lint</code>.",
      ]},
      { type: "teach", brief: "Chart prüfen", cmd: {
        id: "t-lint", intro: "🆕 Neuer Befehl: <code>helm lint</code> – ein Chart auf Fehler & Stil prüfen.",
        text: "Prüfe dein Chart <code>funkdienst</code>.",
        accept: [/^helm\s+lint\s+(\.\/)?funkdienst$/], solution: "helm lint funkdienst",
        hint: "Muster: helm lint <chart>" } },
      { type: "teach", brief: "Chart einpacken", cmd: {
        id: "t-package", intro: "🆕 Neuer Befehl: <code>helm package</code> – ein Chart in ein <code>.tgz</code>-Archiv packen (zum Teilen / in ein Repo legen).",
        text: "Pack <code>funkdienst</code> in ein verteilbares Archiv.",
        accept: [/^helm\s+package\s+(\.\/)?funkdienst$/], solution: "helm package funkdienst",
        hint: "Muster: helm package <chart>" } },
      { type: "teach", brief: "Eigenes Chart hissen", cmd: {
        id: "t-install-local", intro: "🆕 Jetzt aus dem EIGENEN Chart installieren – ein lokaler <b>Pfad</b> statt <code>repo/chart</code>.",
        text: "Installiere aus <code>./funkdienst</code> ein Release namens <code>mein-funk</code>. (Flaggen-Blick zur Werft!)",
        accept: [/^helm\s+install\s+mein-funk\s+\.\/funkdienst$/], solution: "helm install mein-funk ./funkdienst",
        hint: "Muster: helm install <release> ./<chart>" } },
      { type: "drill", brief: "Runas Werft-Übung", pool: ["helm-create", "helm-lint", "helm-package", "helm-install-local"], count: 4,
        intro: "Einmal die ganze Kette selbst: create → lint → package → install." },
      { type: "choice", npc: "runa", reviewId: "q-helm-create",
        q: "Woraus besteht ein Helm-Chart?",
        options: [
          { t: "Aus Chart.yaml (Steckbrief), values.yaml (Drehknöpfe) und templates/ (Vorlagen).", ok: true,
            reply: "Sitzt! Gerüst mit <code>helm create</code>, prüfen mit <code>lint</code>, packen mit <code>package</code> – jetzt baust du selbst, statt nur fertige Charts zu hissen. ⎈" },
          { t: "Aus einer einzigen großen YAML-Datei mit allem drin.", ok: false,
            reply: "Nein – gerade NICHT. Die Stärke ist die Trennung: Vorlage (templates) und Werte (values.yaml) getrennt, Steckbrief in Chart.yaml." },
        ]},
    ]},

  { id: "q22", title: "Die Hafenmauer", giver: "juno", rewardXp: 60, rewardCoins: 45,
    steps: [
      { type: "dialog", npc: "juno", lines: [
        "Sturmwache Juno. Schön, dass du da bist – wir haben ein Sicherheitsproblem. Dein <b>Hafentor</b> (der Ingress) hat den Hafen zum <b>offenen Meer</b> geöffnet. Gut für Besucher … aber jetzt kann <b>jeder Pod mit jedem reden</b>, quer durch den ganzen Cluster.",
        "Das ist die unbequeme Wahrheit über Kubernetes: <b>standardmäßig ist alles offen</b>. Kein Zaun, keine Mauer. Schleicht sich ein böser Pod ein, klopft er ungestört an jeder Tür – auch beim <code>lager</code> mit den wertvollen Daten.",
        "Dagegen bauen wir eine <b>Hafenmauer</b>: eine <b>NetworkPolicy</b>. Sie wählt per Label Pods aus und sagt: <i>Zu DENEN darf nur, wen ich ausdrücklich erlaube</i> – alles andere prallt ab. Im Job nennt man das <b>default-deny</b>. Lass uns erst schauen, was schon steht.",
      ]},
      { type: "teach", brief: "Mauern zählen", cmd: {
        id: "t-get-netpol", intro: "🆕 Neue Ressource: <code>kubectl get networkpolicies</code> (kurz <code>netpol</code>) – zeigt alle Hafenmauern.",
        text: "Schau nach, welche NetworkPolicies schon stehen – noch ist der Hafen schutzlos!",
        accept: [/^kubectl\s+get\s+(networkpolicies|networkpolicy|netpol|netpols)$/], solution: "kubectl get networkpolicies",
        hint: "Kurzform: kubectl get netpol" } },
      { type: "terminal", brief: "Mauer hochziehen",
        scenario: {
          files: { "netpol.yaml": NETPOL_YAML },
          applyEffects: {
            "netpol.yaml": { networkPolicy: { name: "hafenmauer", podSelector: "lager", allowFrom: "hafentor" } },
          },
        },
        tasks: [
        { id: "t-juno-np-1", text: "Ich habe dir die Karte <code>netpol.yaml</code> hingelegt. Lies sie mit <code>cat</code> – achte auf <code>podSelector</code> (WEN schützt die Mauer?) und <code>ingress.from</code> (WER darf rein?).",
          accept: [/^cat\s+netpol\.yaml$/], solution: "cat netpol.yaml", hint: "cat <datei>" },
        { id: "t-juno-np-2", text: "Zieh die Mauer hoch: wende <code>netpol.yaml</code> an. Ab jetzt darf nur noch das <code>hafentor</code> ans <code>lager</code>.",
          accept: [/^kubectl\s+apply\s+-f\s+netpol\.yaml$/], solution: "kubectl apply -f netpol.yaml", hint: "Gleicher apply wie bei Adas Karten, Datei netpol.yaml." },
        { id: "t-juno-np-3", text: "Prüf die frische Mauer: <code>kubectl get networkpolicies</code> – jetzt steht <code>hafenmauer</code> in der Liste.",
          accept: [/^kubectl\s+get\s+(networkpolicies|networkpolicy|netpol|netpols)$/], check: (sim: Sim) => sim.networkPolicies.some(n => n.name === "hafenmauer"),
          solution: "kubectl get networkpolicies", hint: "Kurzform 'netpol' geht auch." },
        { id: "t-juno-np-4", text: "Schau genau hin: <code>kubectl describe networkpolicy hafenmauer</code> – die Zeile <b>Allowing ingress traffic</b> verrät, wer durchdarf.",
          accept: [/^kubectl\s+describe\s+(networkpolicy|networkpolicies|netpol|netpols)\s+hafenmauer$/], solution: "kubectl describe networkpolicy hafenmauer", hint: "kubectl describe networkpolicy <name>" },
      ]},
      { type: "drill", brief: "Junos Mauer-Übung", pool: ["k-apply-netpol", "k-get-netpol", "k-describe-netpol", "k-delete-netpol"], count: 4,
        intro: "Einmal die ganze Kette: anwenden → auflisten → beschreiben → wieder einreißen." },
      { type: "choice", npc: "juno", reviewId: "q-netpol",
        q: "Ohne jede NetworkPolicy – wer darf im Cluster mit wem reden?",
        options: [
          { t: "Jeder mit jedem. Das Netzwerk ist offen, bis eine NetworkPolicy es einschränkt.", ok: true,
            reply: "Genau – und genau das ist die Gefahr. Eine NetworkPolicy schaltet für die gewählten Pods auf <b>default-deny</b> und lässt nur durch, was du erlaubst. So sichert man im Job Datenbanken & Co. ab. ⚓" },
          { t: "Niemand. Jede Verbindung muss erst freigegeben werden.", ok: false,
            reply: "Andersrum! Kubernetes ist von Haus aus <b>offen</b>. Erst eine NetworkPolicy macht für die ausgewählten Pods dicht – vorher kann jeder mit jedem reden." },
        ]},
      { type: "dialog", npc: "juno", lines: [
        "Merk dir die Faustregel: <b>Selektor sagt WEN man schützt, die from-Regel sagt WER rein darf.</b> Fehlt die Policy, ist alles offen. Hafen gesichert – gut gemacht, Lotse!",
      ]},
    ]},

  { id: "q23", title: "Das verschlüsselte Hafentor", giver: "ada", rewardXp: 65, rewardCoins: 50,
    steps: [
      { type: "dialog", npc: "ada", lines: [
        "Da bist du ja, Lotse! Unser <b>Hafentor</b> (der Ingress) lotst Besucher schon brav zu <code>hafen.de/lager</code> – aber alles reist noch <b>unverschlüsselt</b> über das offene Meer. Jeder Pirat mit Fernglas liest mit.",
        "Höchste Zeit für ein <b>verschlüsseltes Tor</b>: <b>HTTPS</b> mit <b>TLS</b>. Der Trick heißt <b>TLS-Terminierung</b> – die Verschlüsselung <i>endet</i> am Hafentor: außen sicheres HTTPS, drinnen im Cluster ganz normales HTTP. Der Ingress-Controller macht das Auspacken.",
        "Dafür braucht das Tor ein <b>Zertifikat</b>. Das legen wir als <b>TLS-Secret</b> ab (eine Karte mit <code>tls.crt</code> + <code>tls.key</code>) und verweisen im Ingress unter <code>spec.tls</code> darauf. Eins noch vorweg: <b>Wie</b> findet <code>hafen.de</code> überhaupt unser Tor? Über <b>DNS</b> – das Adressbuch löst den Namen zur Adresse des Controllers (<code>203.0.113.10</code>) auf. Los, bau das Zertifikat ein!",
      ]},
      { type: "teach", brief: "Zertifikat hinterlegen", cmd: {
        id: "t-secret-tls", intro: "🆕 Neuer Befehl: <code>kubectl create secret tls &lt;name&gt; --cert=&lt;datei&gt; --key=&lt;datei&gt;</code> – legt ein TLS-Zertifikat als Secret ab.",
        text: "Lege das Zertifikat <code>hafen-tls</code> aus <code>tls.crt</code> und <code>tls.key</code> an.",
        accept: [/^kubectl\s+create\s+secret\s+tls\s+hafen-tls\s+--cert[=\s]\S+\s+--key[=\s]\S+$/],
        solution: "kubectl create secret tls hafen-tls --cert=tls.crt --key=tls.key",
        hint: "Muster: kubectl create secret tls hafen-tls --cert=tls.crt --key=tls.key" } },
      { type: "terminal", brief: "HTTPS aufschalten",
        scenario: {
          files: { "ingress-tls.yaml": INGRESS_TLS_YAML },
          applyEffects: {
            "ingress-tls.yaml": { ingress: { name: "hafentor", host: "hafen.de", path: "/lager", service: "lager", port: "6379", className: "nginx", tls: { secretName: "hafen-tls" } } },
          },
        },
        tasks: [
        { id: "t-ada-tls-1", text: "Schau dir die neue Karte an: <code>cat ingress-tls.yaml</code> – achte auf den frischen Block <code>spec.tls</code> mit <code>secretName: hafen-tls</code>.",
          accept: [/^cat\s+ingress-tls\.yaml$/], solution: "cat ingress-tls.yaml", hint: "cat <datei>" },
        { id: "t-ada-tls-2", text: "Schalt HTTPS auf: wende <code>ingress-tls.yaml</code> an. Das Tor wird umkonfiguriert (<code>configured</code>) – ab jetzt verschlüsselt.",
          accept: [/^kubectl\s+apply\s+-f\s+ingress-tls\.yaml$/], solution: "kubectl apply -f ingress-tls.yaml", hint: "Gleicher apply wie immer, Datei ingress-tls.yaml." },
        { id: "t-ada-tls-3", text: "Prüf das Tor: <code>kubectl get ingress</code> – in der Spalte <b>PORTS</b> steht jetzt <code>80, 443</code> (443 = HTTPS).",
          accept: [/^kubectl\s+get\s+(ingress|ingresses|ing)$/], check: (sim: Sim) => sim.ingresses.some(i => i.name === "hafentor" && !!i.tls),
          solution: "kubectl get ingress", hint: "Kurzform 'ing' geht auch." },
        { id: "t-ada-tls-4", text: "Schau genau hin: <code>kubectl describe ingress hafentor</code> – die Zeile <b>TLS:</b> verrät, welches Secret welchen Host verschlüsselt.",
          accept: [/^kubectl\s+describe\s+(ingress|ingresses|ing)\s+hafentor$/], solution: "kubectl describe ingress hafentor", hint: "kubectl describe ingress <name>" },
      ]},
      { type: "drill", brief: "Adas TLS-Übung", pool: ["k-secret-tls", "k-get-ingress", "k-get-secrets"], count: 3,
        intro: "Einmal die Kette üben: Zertifikat anlegen → Tor anschauen → Secrets zählen." },
      { type: "choice", npc: "ada", reviewId: "q-tls",
        q: "Was bedeutet <b>TLS-Terminierung</b> am Hafentor?",
        options: [
          { t: "Die Verschlüsselung endet am Tor: außen HTTPS, drinnen reicht der Controller normales HTTP weiter.", ok: true,
            reply: "Genau! Das Zertifikat liegt einmal zentral am Tor (als TLS-Secret), die Services dahinter müssen sich um nichts kümmern. Sauber gelöst. 🔒" },
          { t: "Der Service wird abgeschaltet, sobald HTTPS aktiv ist.", ok: false,
            reply: "Nein – „terminieren“ meint hier <b>die TLS-Verbindung beenden/abwickeln</b>, nicht den Service stoppen. Außen HTTPS, drinnen HTTP." },
        ]},
      { type: "choice", npc: "ada", reviewId: "q-dns",
        q: "Wie findet ein Besucher mit <code>hafen.de</code> überhaupt unser Hafentor?",
        options: [
          { t: "DNS löst hafen.de zur Adresse des Ingress-Controllers auf; der wählt per host-Regel den richtigen Service.", ok: true,
            reply: "Richtig! DNS ist das Adressbuch: Name → IP des Controllers (bei uns 203.0.113.10). Am selben Tor können viele Hosts ankommen – die host-Regel sortiert sie. ⚓" },
          { t: "Der Ingress ruft den Browser des Besuchers von sich aus an.", ok: false,
            reply: "Andersrum: Der Besucher kommt zum Tor. Erst fragt sein Rechner per <b>DNS</b> nach der Adresse, dann klopft er dort an." },
        ]},
      { type: "dialog", npc: "ada", lines: [
        "Merke: <b>Zertifikat als TLS-Secret ablegen, im Ingress unter spec.tls referenzieren – fertig ist HTTPS am Tor.</b> Die Verschlüsselung endet am Hafentor, dahinter bleibt's einfach. Und DNS sorgt dafür, dass der Name überhaupt bei uns ankommt. Hervorragende Arbeit, Lotse! 🔒⚓",
      ]},
    ]},
];
