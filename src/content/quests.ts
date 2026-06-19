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
  RESOURCES_YAML, MAIN_TF, GITLAB_CI_YML, DOCKERFILE, ARGO_APPLICATION_MANUAL_YAML,
  ARGO_APPLICATION_SELFHEAL_YAML, APP_OF_APPS_YAML, SERVICEMONITOR_YAML,
  GRAFANA_DATASOURCE_YAML, GRAFANA_DASHBOARD_YAML, PROMETHEUSRULE_YAML,
  HEADLESS_SERVICE_YAML, STATEFULSET_YAML, STORAGECLASS_YAML, PVC_YAML,
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
        "ZWEITE LEKTION. Kisten starten kannst du. Aber: Welche laufen gerade? Dafür gibt es <code>docker ps</code> – die Liste aller <b>laufenden</b> [[Container]].",
      ]},
      { type: "teach", brief: "Kisten-Liste", cmd: {
        id: "t-ps", intro: "🆕 Neuer Befehl: <code>docker ps</code> – zeigt laufende Container.",
        text: "Zeig alle laufenden Container an. Die NAMES-Spalte rechts wird gleich wichtig!",
        accept: [/^docker\s+ps$/], solution: "docker ps", hint: "Nur zwei Buchstaben nach docker." } },
      { type: "dialog", npc: "bo", lines: [
        "Siehst du die Namen in der NAMES-Spalte? Docker erfindet welche, wenn du keinen vergibst. Mit dem Namen kannst du eine Kiste gezielt <b>stoppen</b>: <code>docker stop &lt;name&gt;</code>.",
        "Das kryptische Kürzel in der <b>CONTAINER ID</b>-Spalte ganz links? Das vergibt Docker selbst – ein <b>eindeutiger Stempel</b> pro Kiste, damit keine zwei verwechselt werden. Bo merkt sich sowas nie. Bo nimmt den Namen. Bo ist Stein.",
      ]},
      { type: "teach", brief: "Kiste stoppen", cmd: {
        id: "t-stop", intro: "🆕 Neuer Befehl: <code>docker stop</code> – hält einen Container an.",
        text: "Stoppe einen deiner laufenden Container. (Name aus <code>docker ps</code> abtippen!)",
        accept: [/^docker\s+stop\s+\S+$/], check: (sim: Sim) => sim.docker.containers.some(c => !c.running),
        solution: "docker stop <name aus docker ps>", hint: "Erst docker ps für den Namen, dann docker stop <name>." } },
      { type: "dialog", npc: "bo", lines: [
        "WICHTIG: Gestoppt heißt nicht weg! Die Kiste steht noch im Lager. <code>docker ps -a</code> zeigt ALLE – auch gestoppte. Das <code>-a</code> heißt „all“.",
      ]},
      { type: "teach", unlockAbbrev: "docker-ps-all", brief: "Alle Kisten sehen", cmd: {
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
        "Bo hat noch eine Überraschung für dich, Landratte – ein <b>Minispiel</b>. Bo zeigt dir gleich, wie's geht. Bo verliert nie. Bo ist Stein.",
      ]},
    ]},

  { id: "q2b", title: "Bos Stapel-Spiel", giver: "bo", rewardXp: 15, rewardCoins: 10,
    steps: [
      { type: "dialog", npc: "bo", lines: [
        "Jetzt das <b>Minispiel</b>! Damit lernst du, wie ein Image aus <b>Schichten</b> gebaut ist – die Basis ganz unten, dein eigener Code oben drauf. Und es macht Spaß.",
        "So rufst du es auf: <b>Sprich Bo an</b> (Taste <b>E</b>), dann wähle im Menü <b>🎮 Stapel-Spiel</b> und spiel es einmal ganz durch. Danach geht's weiter – los, Landratte!",
      ]},
      { type: "minigame", npc: "bo", game: "stack", brief: "Stapel-Spiel spielen" },
    ]},

  { id: "q3", title: "Namen und Hintergrund", giver: "bo", rewardXp: 35, rewardCoins: 25,
    steps: [
      { type: "dialog", npc: "bo", lines: [
        "LETZTE DOCKER-LEKTION. Profis geben Kisten <b>eigene Namen</b> (<code>--name</code>) und schicken sie mit <code>-d</code> in den <b>Hintergrund</b>.",
        "<code>-d</code> heißt <b>„detached“</b> – abgekoppelt. OHNE <code>-d</code> klemmt sich dein <b>Funkgerät an die Kiste</b>: Du siehst ihre Ausgabe, aber die Leitung ist <b>blockiert</b>, bis die Kiste schließt – kein anderer Befehl geht durch. MIT <code>-d</code> läuft die Kiste <b>abgekoppelt im Hintergrund weiter</b>, und das Funkgerät ist sofort wieder frei für den nächsten Befehl. Bo lässt das Funkgerät NIE blockieren. Bo ist Stein.",
        "Zusammen: <code>docker run -d --name webserver nginx</code>. Sieht lang aus – Bo zerlegt es Stück für Stück: <code>run</code> startet eine Kiste · <code>-d</code> ab in den Hintergrund · <code>--name webserver</code> = so soll <b>DEINE</b> Kiste heißen (<b>Wunschname, frei wählbar</b>) · <code>nginx</code> = das <b>[[Image]]</b>, der Bausatz, aus dem die Kiste entsteht (kommt von außen, NICHT frei erfunden).",
        "Verwechsle die letzten zwei NIE: hinter <code>--name</code> steht dein eigener Name, ganz hinten steht das Image. <code>docker run -d --name <b>meine-kiste</b> nginx</code> ginge genauso – nur <code>nginx</code> muss als Bauplan existieren.",
        "Noch eine Erleichterung: Die <b>Reihenfolge der Optionen ist frei</b> – <code>-d --name webserver</code> oder <code>--name webserver -d</code>, beides gilt. Bo-Regel: <b>erst alle Optionen, dann das Image</b> ganz zuletzt. Was NACH dem Image steht, hält die Kiste für einen eigenen Befehl. Du schaffst das.",
      ]},
      { type: "teach", unlockAbbrev: "docker-run-detach", brief: "Profi-Start", cmd: {
        id: "t-run-named", intro: "🆕 Neue Flags: <code>-d</code> (Hintergrund) und <code>--name</code> (eigener Name).",
        text: "Starte aus <code>nginx</code> einen Container im Hintergrund mit dem Namen <code>webserver</code>.",
        accept: [/^docker\s+run\s+(?:(?:-d|--detach)\s+--name\s+webserver|--name\s+webserver\s+(?:-d|--detach))\s+nginx(:\S+)?$/], solution: "docker run -d --name webserver nginx",
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
        "Bo erklärt dich zum <b>Kisten-Profi</b>. <i>*Golem-Applaus*</i> Aber eins fehlt noch: Bisher hast du nur <b>fertige</b> Baupläne aus der [[Registry]] geholt. Ein echter Profi baut auch seinen <b>eigenen</b>. Bleib noch einen Moment bei Bo!",
      ]},
    ]},

  { id: "q3b", title: "Dein eigener Bauplan", giver: "bo", rewardXp: 40, rewardCoins: 30,
    steps: [
      { type: "dialog", npc: "bo",
        scenario: { files: { "Dockerfile": DOCKERFILE } },
        lines: [
          "Erinnerst du dich ans <b>Stapel-Spiel</b>? Ein Image ist ein Stapel aus <b>Schichten</b>. Diesen Stapel beschreibst du in einer Datei: dem <b>Dockerfile</b>. Das ist DEIN Bauplan.",
          "Kurz die <b>Terminal-Basics</b>, bevor wir loslegen – zwei winzige Linux-Befehle: <code>ls</code> zeigt, <b>was im aktuellen Ordner liegt</b> (ein Blick ins Frachtregal), und <code>cat &lt;datei&gt;</code> <b>schreibt den Inhalt einer Datei ins Terminal</b>. (In einer echten Shell wechselst du mit <code>cd</code> den Ordner und <code>pwd</code> zeigt, wo du gerade stehst – an deinem Funkgerät bleibst du immer im selben Ordner, die zwei brauchst du hier also nicht.)",
          "Bo hat dir einen Bauplan hingelegt. Erst <code>ls</code> – dann lies ihn mit <code>cat Dockerfile</code>. Jede Zeile = eine Schicht. <code>FROM</code> ist die Grundschicht (ein fertiges Image), darauf legst du deine eigene App.",
        ] },
      { type: "terminal", brief: "Bauplan lesen", tasks: [
        { id: "t-ls-dockerfile", text: "Erst der Blick ins Regal: <code>ls</code> – was liegt hier?",
          accept: [/^ls$/], solution: "ls", hint: "Zwei Buchstaben." },
        { id: "t-cat-dockerfile", text: "Lies den Bauplan: <code>cat Dockerfile</code>. Siehst du das <code>FROM</code> ganz oben?",
          accept: [/^cat\s+Dockerfile$/], solution: "cat Dockerfile", hint: "cat <datei>" },
      ]},
      { type: "dialog", npc: "bo", lines: [
        "Jetzt machst du aus dem Bauplan ein echtes Image: <code>docker build</code>. Das <code>-t</code> (Langform <code>--tag</code>, beides geht) gibt deinem Image den ganzen <b>Namen</b> <code>name:tag</code> – sonst findest du es später nicht wieder. Der Teil hinter dem <code>:</code> ist der <b>Versions-Tag</b>. (Verwechsle das nicht mit dem eigenen Befehl <code>docker tag</code> – der kommt gleich und gibt einem fertigen Image nur einen Zweitnamen.) Der <b>Punkt</b> am Ende sagt: „Der Bauplan liegt HIER im aktuellen Ordner.“",
      ]},
      { type: "teach", unlockAbbrev: "docker-build-tag", brief: "Eigenes Image bauen", cmd: {
        id: "t-build", intro: "🆕 Neuer Befehl: <code>docker build -t &lt;name&gt;:&lt;tag&gt; .</code> – baut aus dem Dockerfile ein eigenes Image. Gebaut wird in der <b>Docker-Engine</b> (eigenes Programm, das deine Ordner nicht sieht); der <b>Punkt</b> ist der Build-Kontext – der Ordner, den du ihr als Kiste mit Baumaterial rüberreichst (<code>.</code> = der aktuelle). Daraus liest Docker das Dockerfile und alles, was <code>COPY</code> holt. <code>-t</code> ist die Kurzform von <code>--tag</code> (beides geht) und vergibt den ganzen Namen <code>name:tag</code>.",
        text: "Bau aus dem Dockerfile ein Image mit dem Namen <code>hafenwache:1.0</code>. (Punkt am Ende nicht vergessen!)",
        accept: [/^docker\s+build\s+(?:-t|--tag)\s+hafenwache:1\.0\s+\.$/], solution: "docker build -t hafenwache:1.0 .",
        hint: "Muster: docker build -t <name>:<tag> . (statt -t gilt auch die Langform --tag) – der Punkt ist der Build-Kontext: die Kiste (= aktueller Ordner), die du der Engine zum Bauen rüberreichst." } },
      { type: "teach", brief: "Image-Liste", cmd: {
        id: "t-images", intro: "🆕 Neuer Befehl: <code>docker images</code> – zeigt alle Images, die lokal bereitliegen (gebaut oder gezogen).",
        text: "Zeig deine Images an. <code>hafenwache</code> mit Tag <code>1.0</code> müsste jetzt dabei sein!",
        accept: [/^docker\s+images$/], solution: "docker images", hint: "docker + Mehrzahl von „image“." } },
      { type: "dialog", npc: "bo", lines: [
        "Ein Image kann <b>mehrere Namen</b> tragen – wie zwei Etiketten an <b>derselben</b> Kiste, nicht zwei Kisten. <code>docker tag</code> hängt nur einen <b>zweiten Namen</b> an dasselbe Image – es entsteht <b>kein neues</b> Image und kein anderer Stand. <code>hafenwache:1.0</code> und <code>hafenwache:latest</code> sind danach <b>dasselbe</b> Image.",
        "Üblich ist der Zusatz-Name <code>:latest</code> – aber Vorsicht: das ist <b>nicht automatisch „die neueste Version“</b>, sondern nur ein <b>Konventions-Name</b>. Er zeigt auf das, was zuletzt als <code>:latest</code> getaggt wurde, damit andere das Image ohne Versionsnummer ziehen können. Ein Tag ist eben ein <b>Zeiger</b>, keine Kopie.",
        "Und wie <b>liest</b> man so einen Befehl? <code>docker tag hafenwache:1.0 hafenwache:latest</code> hat vier Teile: <code>docker</code> = das <b>Programm</b>, <code>tag</code> = der <b>Unterbefehl</b> (die Aktion), <code>hafenwache:1.0</code> = die <b>Quelle</b> (das vorhandene Image) und <code>hafenwache:latest</code> = das <b>Ziel</b> (der neue Name).",
        "Merk dir die Reihenfolge: <b>erst Quelle, dann Ziel</b> – „von wo → wohin“. Wie beim Umetikettieren: erst die vorhandene Kiste, dann das neue Schild. Dieses Muster steckt in vielen Befehlen – einmal kapiert, liest du sie alle leichter.",
      ]},
      { type: "teach", brief: "Zweites Etikett", cmd: {
        id: "t-tag", intro: "🆕 Neuer Befehl: <code>docker tag &lt;quelle&gt; &lt;ziel&gt;</code> – hängt einem vorhandenen Image einen weiteren Namen an (kein neues Image, nur ein zweites Etikett an derselben Kiste). Lesart: <b>Programm</b> <code>docker</code> · <b>Unterbefehl</b> <code>tag</code> · dann <b>Quelle</b> → <b>Ziel</b>.",
        text: "Gib deinem <code>hafenwache:1.0</code> zusätzlich das Etikett <code>hafenwache:latest</code>.",
        accept: [/^docker\s+tag\s+hafenwache:1\.0\s+hafenwache:latest$/], solution: "docker tag hafenwache:1.0 hafenwache:latest",
        hint: "Muster: docker tag <quelle> <ziel> – erst das vorhandene Image, dann der neue Name." } },
      { type: "drill", brief: "Bos Bau-Übung", pool: ["docker-build", "docker-tag"], count: 3,
        intro: "Bauen und Etikettieren mit anderen Namen – drei Runden:" },
      { type: "choice", npc: "bo", reviewId: "q-ch1-6",
        q: "Was ist der Unterschied zwischen <code>docker pull</code> und <code>docker build</code>?",
        options: [
          { t: "pull lädt ein FERTIGES [[Image]] aus der [[Registry]], build baut aus einem Dockerfile ein EIGENES.", ok: true,
            reply: "GENAU. Konsumieren vs. selbst herstellen. Mit [[build]] bist du nicht mehr auf fremde Baupläne angewiesen. <i>*anerkennendes Knirschen*</i>" },
          { t: "Kein Unterschied – beide laden ein Image herunter.", ok: false,
            reply: "NEIN. pull HOLT ein fertiges Image. build STELLT eines HER – aus deinem Dockerfile. Das ist der ganze Punkt!" },
        ]},
      { type: "dialog", npc: "bo", lines: [
        "Jetzt bist du <b>echter</b> Kisten-Profi: holen, bauen, etikettieren. <i>*Golem-Applaus*</i> Später baut eine <b>Pipeline</b> deine Images ganz von allein – aber das zeigt dir Ada. Erst will Ole dich sprechen: der GROSSE Umbau wartet! Und wenn du üben willst: <b>Kralle</b> gibt dir Wiederholungen – damit setzt sich das Gelernte fest.",
      ]},
    ]},

  { id: "q4", title: "Der Hafen wird ein Cluster", giver: "ole", rewardXp: 30, rewardCoins: 22,
    steps: [
      { type: "dialog", npc: "ole", lines: [
        "Bo lobt dich – das passiert alle hundert Jahre! Jetzt die Königsfrage: Eine Kiste kann jeder. Aber <b>hunderte Kisten auf vielen Stegen</b>? Wer startet nachts Ersatz, wenn eine über Bord geht?",
        "Dafür gibt es <b>Kubernetes</b> – griechisch für „Steuermann“, kurz <b>K8s</b>. Schau zum Wasser: Unsere <b>drei Stege</b> sind die <b>Nodes</b> (Arbeits-Server). Alles zusammen: der <b>Cluster</b>.",
        "Dein Funkgerät spricht mit dem Cluster über <code>kubectl</code>. Erster Befehl, ganz harmlos: <code>kubectl get nodes</code> – zeig mir die Stege!",
      ]},
      { type: "teach", unlockAbbrev: "kubectl-nodes", brief: "Die Stege zählen", cmd: {
        id: "t-nodes", intro: "🆕 Neuer Befehl: <code>kubectl get nodes</code> – zeigt die Server des Clusters.",
        text: "Zeig die Nodes deines Clusters an. Vergleich mit den Stegen draußen!",
        accept: [/^kubectl\s+get\s+(nodes|node|no)$/], solution: "kubectl get nodes", hint: "Muster: kubectl get <ressourcentyp>" } },
      { type: "dialog", npc: "ole", lines: [
        "Drei Stege, drei Nodes – passt! Und die Fracht? Jede Kiste steht auf einem Liegeplatz namens <b>Pod</b> – der kleinsten Einheit von Kubernetes. Die Bord-Kantine läuft schon. Finde ihre Pods!",
      ]},
      { type: "teach", unlockAbbrev: "kubectl-pods", brief: "Die Fracht finden",
        scenario: { deployments: [{ name: "kantine", image: "nginx:1.27", replicas: 2 }] },
        cmd: {
        id: "t-pods", intro: "🆕 Neuer Befehl: <code>kubectl get pods</code> – zeigt alle Pods.",
        text: "Zeig alle Pods an – und schau dann zum Dock: Die Kisten dort sind GENAU diese Pods!",
        accept: [/^kubectl\s+get\s+(pods|pod|po)$/], solution: "kubectl get pods", hint: "Gleiches Muster wie bei nodes." } },
      { type: "dialog", npc: "ole", lines: [
        "Fällt dir was an den Pod-Namen auf? <code>kantine-9f4c2-x7k1</code> – die kryptischen Anhängsel hat niemand getippt. Die hängt <b>Kubernetes automatisch dran</b>, damit jeder Pod garantiert einen <b>eindeutigen</b> Namen hat. Steckt ein <b>Deployment</b> dahinter, kommt der mittlere Block vom ReplicaSet, der hintere wird pro Pod gewürfelt – darum darfst du beim <code>describe</code> nicht raten, sondern den vollen Namen aus der Liste abtippen.",
      ]},
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
        "Unten in den <b>Events</b> steht die Lebensgeschichte des Pods – Gold wert bei der Fehlersuche! <code>describe</code> ist die <b>Sicht von Kubernetes</b> auf den Pod: Zustand, Image, Ressourcen und vor allem das <b>Warum</b> – die Events. Was die <b>App</b> selbst ausgibt, zeigt es NICHT; dafür gibt es später bei Juno einen eigenen Befehl (<code>kubectl logs</code>).",
        "Eins noch: Kubernetes selbst läuft AUCH als Pods, versteckt im Namespace <code>kube-system</code>.",
      ]},
      { type: "teach", unlockAbbrev: "kubectl-namespace", brief: "Hinter die Kulissen", cmd: {
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
      { type: "dialog", npc: "ole", lines: [
        "Damit du die zwei <b>nie</b> verwechselst, merk dir die Wörter selbst: Ein <b>Pod</b> ist wörtlich eine <b>Schote/Hülse</b> – wie die Erbsenschote, die ihre Erbsen umschließt (und wie der „Pod“ einer Walschule – passt bestens zum Docker-Wal und zum Containerschiff). Drin steckt die Fracht: der Container.",
        "Ein <b>Node</b> ist ein <b>Knoten</b> im Netz – ein fester Punkt, der etwas trägt; im Hafenbild der <b>Steg</b>. Kurz: Der <b>Node</b> (Maschine/Steg) bleibt stehen, die <b>Pods</b> (Schoten/Liegeplätze) darauf sind vergänglich und kommen & gehen – fällt einer aus, schiebt Kubernetes Ersatz einfach auf einen freien Steg.",
      ]},
      { type: "choice", npc: "ole", reviewId: "q-ch2-podnode",
        q: "Auf den Punkt: Wie hängen Pod und Node zusammen?",
        options: [
          { t: "Der Node ist die Maschine (Steg), der Pod die kleinste laufende Einheit darauf – ein Node trägt viele Pods.", ok: true,
            reply: "Genau! Maschine trägt laufende Einheit. Pods sind vergänglich, Nodes bleiben – fällt etwas aus, verteilt der Scheduler neu." },
          { t: "Der Pod ist die Maschine, der Node läuft als Einheit darauf.", ok: false,
            reply: "Andersrum: Der Node (Steg) ist die Maschine, die Pods (Liegeplätze) liegen darauf." },
        ]},
    ]},

  { id: "q6", title: "Der Dauerauftrag", giver: "ole", rewardXp: 35, rewardCoins: 25,
    steps: [
      { type: "dialog", npc: "ole", lines: [
        "Jetzt wird's mächtig. Unbequeme Wahrheit: <b>Pods sind sterblich.</b> Deshalb erstellt man sie nie einzeln, sondern gibt einen Dauerauftrag: ein <b>Deployment</b>.",
        "Ein Deployment sagt: „Halte IMMER N Kopien am Laufen.“ Stirbt eine → sofort Ersatz. Erstellt wird es so: <code>kubectl create deployment kasse --image=nginx</code>.",
        "Zwei Teile, nicht verwechseln: <code>kasse</code> ist nur der <b>Name</b> – ein frei wählbares Etikett, damit du das Deployment wiederfindest (könnte auch <code>fischtheke</code> heißen, der Name bestimmt NICHT, was läuft). Was tatsächlich läuft, sagt <code>--image</code>: hier <b>nginx</b>, ein simpler Webserver, den wir als <b>Platzhalter</b> für „irgendeine App“ nehmen – ein echtes „Kassen-Image“ gibt's nicht. Im echten Job stünde da das Image eurer eigenen App.",
      ]},
      { type: "teach", brief: "Dauerauftrag erteilen", cmd: {
        id: "t-create", intro: "🆕 Neuer Befehl: <code>kubectl create deployment &lt;name&gt; --image=&lt;image&gt;</code> – <b>Name</b> = frei wählbares Etikett, <b>--image</b> = was läuft (Pflicht).",
        text: "Erstelle ein Deployment <code>kasse</code> mit dem Image <code>nginx</code>. (Name <code>kasse</code> ist Story-Deko fürs Wiederfinden; <code>nginx</code> ist der Platzhalter-Webserver, der real läuft.)",
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
      { type: "terminal", brief: "Pods finden", tasks: [
        { id: "t-storm-1", text: "Hol dir mit <code>kubectl get pods</code> die Namen der <code>kasse</code>-Pods.",
          accept: [/^kubectl\s+get\s+(pods|pod|po)$/], solution: "kubectl get pods", hint: "Kennst du längst!" },
      ]},
      { type: "teach", brief: "Eine Kiste versenken", cmd: {
        id: "t-delete", intro: "🆕 Neuer Befehl: <code>kubectl delete pod &lt;name&gt;</code> – löscht einen Pod sofort. Achtung, das ist <b>zustandsändernd</b>: Bisher hast du nur <i>geguckt</i> (<code>get</code>, <code>describe</code>) – <code>delete</code> greift wirklich ein und „versenkt“ den Pod. Genau das brauchen wir für den Self-Healing-Test.",
        text: "💥 Versenke jetzt einen <code>kasse</code>-Pod – und behalte dabei das Dock im Blick!",
        accept: [/^kubectl\s+delete\s+pods?\s+kasse-\S+$/], solution: "kubectl delete pod <kasse-pod-name>",
        hint: "Muster: kubectl delete pod <name> – Namen aus der Liste oben abtippen." } },
      { type: "terminal", brief: "Self-Healing prüfen", tasks: [
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
        accept: [/^kubectl\s+expose\s+deployment\s+kasse\s+--port[=\s]80$/], solution: "kubectl expose deployment kasse --port=80",
        hint: "Muster: kubectl expose deployment <name> --port=80" } },
      { type: "teach", unlockAbbrev: "kubectl-services", brief: "Service-Liste", cmd: {
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
      { type: "teach", unlockAbbrev: "kubectl-filename", brief: "Karte anwenden", cmd: {
        id: "t-apply", intro: "🆕 Neuer Befehl: <code>kubectl apply -f</code> – „Stelle her, was in der Datei steht.“",
        text: "Wende <code>deployment.yaml</code> auf den Cluster an – und schau zum Dock!",
        accept: [/^kubectl\s+apply\s+(?:-f|--filename)\s+deployment\.yaml$/], solution: "kubectl apply -f deployment.yaml", hint: "kubectl apply -f <datei>" } },
      { type: "terminal", unlockAbbrev: "kubectl-ingress", brief: "Adas Doppeltrick", tasks: [
        { id: "t-ada-3", text: "Wende auch <code>service.yaml</code> an.", accept: [/^kubectl\s+apply\s+(?:-f|--filename)\s+service\.yaml$/], solution: "kubectl apply -f service.yaml", hint: "Gleicher Befehl, andere Datei." },
        { id: "t-ada-4", text: "Adas Lieblingstrick: Denselben apply <b>nochmal</b> – nichts passiert doppelt („unchanged“)!",
          accept: [/^kubectl\s+apply\s+(?:-f|--filename)\s+deployment\.yaml$/], solution: "kubectl apply -f deployment.yaml", hint: "Wirklich nochmal exakt derselbe Befehl." },
        { id: "t-ada-5", text: "Eine dritte Karte liegt bereit: <code>ingress.yaml</code> – das <b>Hafentor</b>, von dem Ole sprach. Wende es an und öffne den Weg vom offenen Meer zu <code>hafen.de/lager</code>.",
          accept: [/^kubectl\s+apply\s+(?:-f|--filename)\s+ingress\.yaml$/], solution: "kubectl apply -f ingress.yaml", hint: "Gleicher apply, Datei ingress.yaml." },
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
        "Und woher der Name <b>Chart</b>? Englisch für <b>Seekarte</b> – genau wie Adas Karten! Das fügt sich ins ganze Bild: <b>Kubernetes</b> = der Steuermann, <b>Helm</b> = sein Steuerrad, <b>Chart</b> = die Seekarte, nach der er navigiert. <i>(Nicht verwechseln mit „Chart“ als Diagramm/Balkengrafik – gleiches Wort, andere Bedeutung; bei Helm ist IMMER die Seekarte = das Paket gemeint.)</i>",
        "Charts liegen in <b>Repos</b> (wie Docker Hub für Images). Schritt eins: ein Repo hinzufügen.",
        "Was da alles drinliegt? Fast die ganze Werft: <b>nginx</b> (Webserver), <b>postgresql</b> (Datenbank), <b>redis</b> (schneller Zwischenspeicher), <b>keycloak</b> (Login & Rechte) und <b>prometheus</b> + <b>grafana</b> fürs Überwachen. Echte Tools – die siehst du im Job alle wieder.",
      ]},
      { type: "teach", brief: "Chart-Quelle anzapfen", cmd: {
        id: "t-repoadd", intro: "🆕 Neuer Befehl: <code>helm repo add</code> – eine Chart-Quelle hinzufügen.",
        text: "Füge das Repo <code>bitnami</code> hinzu (URL: <code>https://charts.bitnami.com/bitnami</code>).",
        accept: [/^helm\s+repo\s+add\s+bitnami\s+https:\/\/charts\.bitnami\.com\/bitnami$/], solution: "helm repo add bitnami https://charts.bitnami.com/bitnami",
        hint: "Muster: helm repo add <name> <url>" } },
      { type: "teach", brief: "Repo aktualisieren", cmd: {
        id: "t-repoupdate", intro: "🆕 Neuer Befehl: <code>helm repo update</code> – holt die aktuelle Chart-Liste aller hinzugefügten Repos (wie ein „Katalog aktualisieren“). Direkt nach <code>helm repo add</code> sinnvoll.",
        text: "Aktualisiere die Repo-Infos mit <code>helm repo update</code>.",
        accept: [/^helm\s+repo\s+update$/], solution: "helm repo update", hint: "helm repo …" } },
      { type: "teach", brief: "Charts suchen", cmd: {
        id: "t-reposearch", intro: "🆕 Neuer Befehl: <code>helm search repo &lt;begriff&gt;</code> – durchsucht die hinzugefügten Repos nach passenden Charts (statt blind den Namen zu raten).",
        text: "Suche mit <code>helm search repo nginx</code> nach einem Webserver-Chart.",
        accept: [/^helm\s+search\s+repo\s+nginx$/], solution: "helm search repo nginx", hint: "helm search repo <begriff>" } },
      { type: "choice", npc: "runa", reviewId: "q-ch5-1",
        q: "Einmal festnageln: Was IST Helm?",
        options: [
          { t: "Der Paketmanager für Kubernetes – installiert komplette Apps als Charts.", ok: true,
            reply: "Genau! Wie ein App-Store für den Cluster. Morgen hissen wir die erste Flagge!" },
          { t: "Ein Kopfschutz für die Werft.", ok: false,
            reply: "HA! Reingefallen. Steuerrad! Paketmanager! Schau aufs Logo!" },
        ]},
      { type: "choice", npc: "runa", reviewId: "q-helm-chart-name",
        q: "Und warum heißt das Paket ausgerechnet „Chart“?",
        options: [
          { t: "„chart“ = Seekarte – passt zu Steuermann (K8s) und Steuerrad (Helm).", ok: true,
            reply: "Genau! Steuermann, Steuerrad, Seekarte – alles aus einem Guss. Nicht mit „Chart = Diagramm“ verwechseln." },
          { t: "„chart“ = Balkendiagramm – es zeigt die App-Auslastung.", ok: false,
            reply: "Nein – das ist dasselbe Wort in anderer Bedeutung. Bei Helm meint Chart die Seekarte = das Paket." },
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
      { type: "teach", unlockAbbrev: "helm-list", brief: "Releases auflisten", cmd: {
        id: "t-helmlist", intro: "🆕 Neuer Befehl: <code>helm list</code> (kurz <code>helm ls</code>) – zeigt alle <b>Releases</b>, also die installierten Charts mit Name, Revision und Status.",
        text: "Zeig die Releases mit <code>helm list</code>.",
        accept: [/^helm\s+(list|ls)$/], solution: "helm list", hint: "Englisch für „auflisten“." } },
      { type: "terminal", brief: "Was ist da passiert?", tasks: [
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
      { type: "teach", unlockAbbrev: "kubectl-secrets", brief: "Truhen zählen", cmd: {
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
        "Eine Schatztruhe anlegen kannst du jetzt – aber eine verschlossene Truhe nützt der App noch gar nichts. Wie kommt das Geheimnis eigentlich IN den Dienst hinein? Und: nicht alles, was eine App braucht, ist überhaupt geheim!",
        "Komm, das zeig ich dir noch – dann ist deine Grundausbildung wirklich rund. Funk mich gleich an. 📻",
      ]},
    ]},

  { id: "q26", title: "Truhe trifft Kombüse", giver: "ole", rewardXp: 55, rewardCoins: 45,
    steps: [
      { type: "dialog", npc: "ole", lines: [
        "Schau, die <b>passagierliste</b> ist frisch ausgerollt – aber sie braucht zwei Dinge: die Adresse unserer Datenbank (<code>hafen-db</code>) und das <b>DB-Passwort</b>.",
        "Merk dir die Trennlinie: Der DB-Host ist <b>kein Geheimnis</b> – sowas (Hostnamen, Ports, Log-Level) kommt in eine <b>ConfigMap</b>. Eine ConfigMap ist absichtlich Klartext, aber eben nur für <b>Harmloses</b>.",
        "Das Passwort dagegen ist Krakenfutter, wenn's offen rumliegt – das gehört ins <b>Secret</b>. Zwei Behälter, ein Prinzip: erst anlegen, dann der App geben.",
      ]},
      { type: "teach", brief: "Die Klartext-Kiste", scenario: { deployments: [{ name: "passagierliste", image: "nginx", replicas: 1 }] }, cmd: {
        id: "t-configmap", intro: "🆕 Neuer Befehl: <code>kubectl create configmap</code> – harmlose Einstellungen sammeln.",
        text: "Lege eine ConfigMap <code>passagier-config</code> an, mit <code>--from-literal=db_host=hafen-db</code>.",
        accept: [/^kubectl\s+create\s+configmap\s+passagier-config\s+--from-literal[=\s][\w.-]+=\S+$/],
        solution: "kubectl create configmap passagier-config --from-literal=db_host=hafen-db",
        hint: "Muster: kubectl create configmap <name> --from-literal=schluessel=wert" } },
      { type: "terminal", brief: "Das Geheimnis", tasks: [
        { id: "t-q26-secret", text: "Jetzt das Vertrauliche: Lege ein Secret <code>passagier-geheim</code> an (z.B. <code>--from-literal=db_passwort=tiefsee42</code>).",
          accept: [/^kubectl\s+create\s+secret\s+generic\s+passagier-geheim\s+--from-literal[=\s][\w.-]+=\S+$/],
          solution: "kubectl create secret generic passagier-geheim --from-literal=db_passwort=tiefsee42",
          hint: "Wie bei der Krake: kubectl create secret generic <name> --from-literal=k=v" },
      ]},
      { type: "teach", brief: "Config einbinden", cmd: {
        id: "t-setenv-config", intro: "🆕 Neuer Befehl: <code>kubectl set env … --from=configmap/<name></code> – bindet die Einstellungen als Umgebungsvariablen in die App.",
        text: "Gib der <code>passagierliste</code> ihre Config: <code>kubectl set env deployment/passagierliste --from=configmap/passagier-config</code>.",
        accept: [/^kubectl\s+set\s+env\s+deployment\/passagierliste\s+--from[=\s]configmap\/passagier-config$/],
        solution: "kubectl set env deployment/passagierliste --from=configmap/passagier-config",
        hint: "Muster: kubectl set env deployment/<name> --from=configmap/<configmap-name>" } },
      { type: "terminal", brief: "Geheimnis einbinden", tasks: [
        { id: "t-q26-bind-secret", text: "Und jetzt dasselbe fürs Secret – genau gleich, nur <code>--from=secret/passagier-geheim</code>. Erst dann kennt die App ihr Passwort.",
          accept: [/^kubectl\s+set\s+env\s+deployment\/passagierliste\s+--from[=\s]secret\/passagier-geheim$/],
          solution: "kubectl set env deployment/passagierliste --from=secret/passagier-geheim",
          check: (sim: Sim) => { const d = sim.deployments.find(d => d.name === "passagierliste"); return d && d.envFrom.configMaps.includes("passagier-config") && d.envFrom.secrets.includes("passagier-geheim"); },
          hint: "kubectl set env deployment/passagierliste --from=secret/<secret-name>" },
      ]},
      { type: "choice", npc: "ole", reviewId: "q-sec-3",
        q: "Die App braucht DB-Host <code>hafen-db</code> und das DB-Passwort. Was gehört wohin?",
        options: [
          { t: "DB-Host in die ConfigMap (harmlos), Passwort ins Secret (vertraulich).", ok: true,
            reply: "Genau das! Harmloses → ConfigMap, Geheimes → Secret. Beide bindet man gleich ein – aber nur eins davon darf die Krake sehen." },
          { t: "Beides in die ConfigMap – dann ist alles an einem Ort.", ok: false,
            reply: "Nein! Das Passwort in der ConfigMap ist Klartext – Krakenfutter. Vertrauliches gehört IMMER ins Secret." },
          { t: "Beides ins Secret – sicher ist sicher.", ok: false,
            reply: "Übervorsichtig: Der DB-Host ist kein Geheimnis. Solche Einstellungen gehören in die ConfigMap – Secrets bleiben fürs wirklich Vertrauliche." },
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
        "Sauber repariert! Merk dir das Mantra für IMMER: <b>get pods → describe → logs.</b> Erst gucken, dann verstehen, dann fixen, dann verifizieren.",
        "„<code>describe</code> UND <code>logs</code> – wo ist der Unterschied?“ Gute Frage, die verwechseln viele. <b><code>describe</code> = die Sicht von Kubernetes</b> auf den Pod: Zustand, Image, Limits und vor allem die <b>Events</b> – also <i>warum</i> er (nicht) läuft: ImagePullBackOff, Pending, OOMKilled, fehlgeschlagene Probe. <b><code>logs</code> = was die App selbst ausgibt</b> (stdout/stderr): ihre eigenen Meldungen, Stacktraces, Fehler.",
        "<b>Faustregel:</b> erst <code>describe</code> (läuft er überhaupt? was sagen die Events?), dann <code>logs</code> (was meldet die App?). Startet der Container nie – ImagePullBackOff, Pending, OOMKilled –, helfen Logs nicht, da steht nichts; das verrät nur <code>describe</code>. Crasht die App beim Start (CrashLoop), sagt <code>describe</code> nur <i>dass</i> sie stirbt – den echten Grund zeigen die <code>logs</code>. Morgen zeige ich dir den fiesesten Fehler von allen …",
      ]},
      { type: "choice", npc: "juno", reviewId: "q-ts-8",
        q: "Ein Pod hängt in <code>ImagePullBackOff</code> – der Container ist nie gestartet. Womit kommst du ans Warum: <code>describe</code> oder <code>logs</code>?",
        options: [
          { t: "<code>describe</code> – die Events zeigen, warum das Image nicht geladen wird.", ok: true,
            reply: "Genau! Kein gestarteter Container = keine App-Ausgabe, also auch keine Logs. Das Warum steht in den Events – die liefert describe." },
          { t: "<code>logs</code> – da steht doch immer der Fehler drin.", ok: false,
            reply: "Diesmal nicht: Der Container ist nie gelaufen, die App hat nie etwas ausgegeben – die Logs sind leer. Bei Pull-/Scheduling-/OOM-Problemen ist describe dran (die Events)." },
        ]},
    ]},

  { id: "q16", title: "Das Flackern", giver: "juno", rewardXp: 55, rewardCoins: 40,
    steps: [
      { type: "dialog", npc: "juno", lines: [
        "Siehst du die <b>funkboje</b> da draußen flackern? Der Pod startet, stürzt ab, startet, stürzt ab … Das nennt sich <b>CrashLoopBackOff</b> – der Klassiker unter den Cluster-Fehlern.",
        "Das Tückische: Das Image ist OK, der Node ist OK – die <b>App selbst</b> stirbt beim Start. Und warum sie stirbt, verrät nur eines: <b>die Logs.</b> Dritte Stufe des Mantras!",
      ]},
      { type: "terminal", brief: "Überblick verschaffen",
        scenario: { deployments: [{ name: "funkboje", image: "nginx", replicas: 1, broken: { type: "crashloop", needsSecret: "funk-schluessel" } }] },
        tasks: [
        { id: "t-j16-1", text: "Verschaff dir den Überblick: get pods. Beachte auch die RESTARTS-Spalte!",
          accept: [/^kubectl\s+get\s+(pods|pod|po)$/], solution: "kubectl get pods", hint: "Wie immer zuerst." },
      ]},
      { type: "teach", brief: "Logs lesen", cmd: {
        id: "t-logs", intro: "🆕 Neuer Befehl: <code>kubectl logs &lt;pod&gt;</code> – zeigt, was die <b>App selbst</b> ausgegeben hat (stdout/stderr): ihre Meldungen, Fehler, Stacktraces. Das ist die <b>dritte Stufe</b> des Mantras <code>get pods → describe → logs</code>. Merke den Unterschied: <code>describe</code> zeigt die <b>Kubernetes-Sicht</b> (Zustand + Events, das <i>Warum</i>), <code>logs</code> die <b>App-Ausgabe</b> selbst.",
        text: "Jetzt die Wahrheit: Lies die <b>Logs</b> des <code>funkboje</code>-Pods!",
        accept: [/^kubectl\s+logs\s+funkboje-\S+$/], solution: "kubectl logs <funkboje-pod>",
        hint: "Muster: kubectl logs <pod-name> – Namen aus der Liste oben abtippen." } },
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
      { type: "teach", unlockAbbrev: "git-commit-message", brief: "Festhalten", cmd: {
        id: "t-git-commit", intro: "🆕 <code>git commit -m \"…\"</code> – hält die vorgemerkten Änderungen als Schnappschuss in der Historie fest, mit kurzer Nachricht.",
        text: "Halte die Karte fest – Commit-Nachricht z.B. <code>Erste Seekarte</code>.",
        accept: [/^git\s+commit\s+(?:-m|--message)\s+("[^"]+"|'[^']+'|\S+)$/], solution: 'git commit -m "Erste Seekarte"', hint: 'Muster: git commit -m "deine Nachricht"' } },
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
        accept: [/^git\s+commit\s+(?:-m|--message)\s+("[^"]+"|'[^']+'|\S+)$/], solution: 'git commit -m "Neue Route skizziert"', hint: 'Muster: git commit -m "Nachricht"' } },
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
        accept: [/^git\s+commit\s+(?:-m|--message)\s+("[^"]+"|'[^']+'|\S+)$/], solution: 'git commit -m "CI-Pipeline eingerichtet"', hint: 'Muster: git commit -m "Nachricht"' } },
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

  /* Git-Alltag im Team: holen (fetch/pull) und Merge-Konflikte lösen (#69).
   * Folge auf Adas Git-Track (q18 commit → q19 branch/merge → q20 pipeline).
   * Die ID ist fortlaufend angehängt (q25), die Quest steht aber bewusst HIER,
   * direkt nach den Git-Grundlagen – die Spielreihenfolge ergibt sich aus der
   * Array-Position, nicht aus der Nummer. (Bestehende IDs behalten so ihre
   * Bedeutung in drills/quiz/Spielständen; nur die Position verschiebt sich.) */
  { id: "q25", title: "Zwei Karten, eine Linie", giver: "ada", rewardXp: 55, rewardCoins: 40,
    steps: [
      { type: "dialog", npc: "ada", lines: [
        "Zurück, Kartograph:in! Bisher hast du allein an der Seekarte gearbeitet. Im echten Hafen sind aber <b>mehrere</b> dran – heute lernst du das, was Tag eins von Junioren am meisten frustriert: <b>zusammenarbeiten, ohne sich gegenseitig die Arbeit zu überschreiben.</b>",
        "Mein Kollege <b>Lennart</b> hat über Nacht auch an der <code>seekarte.md</code> gearbeitet und seine Commits auf den Server (origin) geschoben. Goldene Regel: <b>erst holen, dann arbeiten.</b> Sieh zuerst nur nach, OB es Neues gibt – ohne dir gleich etwas reinzuziehen: <code>git fetch</code>.",
      ] },
      { type: "teach", brief: "Erst nachsehen",
        scenario: { gitRemoteAhead: 2, gitConflict: { branch: "lennart-route", file: "seekarte.md",
          ours: "Nordpassage: dicht am Riff entlang – kurz, aber eng.",
          theirs: "Nordpassage: weiter Bogen ums Riff – sicher, etwas laenger." } },
        cmd: {
        id: "t-git-fetch", intro: "🆕 Neuer Befehl: <code>git fetch</code> – holt die Infos vom Server (origin), <b>ohne</b> sie in deine Arbeit einzufügen. Du siehst, was da wäre, riskierst aber nichts.",
        text: "Sieh nach, ob origin etwas Neues hat.",
        accept: [/^git\s+fetch$/], check: (sim: Sim) => sim.git.fetched, solution: "git fetch", hint: "git + ein Wort fürs „abholen, aber nicht einfügen“." } },
      { type: "dialog", npc: "ada", lines: [
        "Zwei Commits warten auf origin. <code>git fetch</code> hat sie nur <b>heruntergeladen</b> – deine Karte ist noch unberührt. Jetzt zieh sie wirklich in deine Arbeit: <code>git pull</code> (das ist fetch + zusammenführen in einem).",
      ] },
      { type: "teach", brief: "Holen + einfügen", cmd: {
        id: "t-git-pull", intro: "🆕 Neuer Befehl: <code>git pull</code> – holt die Commits vom Server UND führt sie in deinen aktuellen Branch zusammen (fetch + merge).",
        text: "Hol Lennarts Commits in deinen <code>main</code>.",
        accept: [/^git\s+pull$/], check: (sim: Sim) => sim.git.remoteAhead === 0, solution: "git pull", hint: "git + ein Wort fürs „herziehen“." } },
      { type: "dialog", npc: "ada", lines: [
        "Sauber, jetzt bist du auf dem Stand des Teams. <b>Merk dir:</b> erst <code>pull</code> (holen), dann erst deine <code>push</code> – sonst weist der Server deinen Push ab, weil du veraltet bist.",
        "Aber Lennart hat noch einen <b>Experiment-Branch</b> dagelassen: <code>lennart-route</code>. Dummerweise hat er dort <b>dieselbe Zeile</b> der Seekarte geändert wie du. Führ ihn zusammen – und sieh, was passiert: <code>git merge lennart-route</code>.",
      ] },
      { type: "teach", brief: "Zusammenführen – Knall", cmd: {
        id: "t-git-merge-conflict", intro: "↩︎ <code>git merge &lt;branch&gt;</code> kennst du. Diesmal haben BEIDE Seiten dieselbe Stelle geändert – Git kann nicht entscheiden und meldet einen <b>Merge-Konflikt</b>. Das ist <b>normal</b>, kein Fehler von dir!",
        text: "Führe <code>lennart-route</code> in <code>main</code> zusammen.",
        accept: [/^git\s+merge\s+lennart-route$/], check: (sim: Sim) => !!sim.git.conflict, solution: "git merge lennart-route", hint: "Muster: git merge <branch>" } },
      { type: "dialog", npc: "ada", lines: [
        "Da ist er, der berüchtigte <b>CONFLICT</b>. Kein Grund zur Panik – Git hat einfach beide Versionen in die Datei geschrieben und fragt DICH, welche gilt. Schau rein: <code>cat seekarte.md</code>. Zwischen <code>&lt;&lt;&lt;&lt;&lt;&lt;&lt;</code> und <code>=======</code> steht DEINE Zeile, darunter bis <code>&gt;&gt;&gt;&gt;&gt;&gt;&gt;</code> Lennarts.",
      ] },
      { type: "terminal", brief: "Konflikt lösen", tasks: [
        { id: "t-conf-cat", text: "Schau dir den Konflikt in <code>seekarte.md</code> an (die Marker <code>&lt;&lt;&lt;&lt;&lt;&lt;&lt;</code> / <code>=======</code> / <code>&gt;&gt;&gt;&gt;&gt;&gt;&gt;</code>).",
          accept: [/^cat\s+seekarte\.md$/], solution: "cat seekarte.md", hint: "cat <datei> – wie bei jeder Seekarte." },
        { id: "t-conf-status", text: "Frag Git nach dem Stand – es nennt dir die „nicht zusammengeführten Pfade“.",
          accept: [/^git\s+status$/], solution: "git status", hint: "Der vertraute Stand-Befehl." },
        { id: "t-conf-theirs", text: "Entscheide dich: Lennarts <b>sichere</b> Route ist besser. Übernimm die <b>hereinkommende</b> Version mit <code>git checkout --theirs seekarte.md</code>.",
          accept: [/^git\s+checkout\s+--theirs\s+seekarte\.md$/], check: (sim: Sim) => sim.files["seekarte.md"] === "Nordpassage: weiter Bogen ums Riff – sicher, etwas laenger." && !!sim.git.conflict,
          solution: "git checkout --theirs seekarte.md", hint: "git checkout --theirs <datei> wählt die hereinkommende Seite (--ours wäre deine)." },
        { id: "t-conf-add", text: "Markiere den Konflikt als gelöst: merk die Datei vor mit <code>git add seekarte.md</code>.",
          accept: [/^git\s+add\s+seekarte\.md$/], check: (sim: Sim) => !sim.git.conflict && sim.git.staged.includes("seekarte.md"),
          solution: "git add seekarte.md", hint: "Wie immer: git add <datei> – das sagt Git „erledigt“." },
        { id: "t-conf-commit", text: "Schließ den Merge ab mit einem Commit, z.B. <code>git commit -m \"Konflikt geloest: Lennarts Route\"</code>.",
          accept: [/^git\s+commit\s+(?:-m|--message)\s+("[^"]+"|'[^']+'|\S+)$/], check: (sim: Sim) => !sim.git.conflict,
          solution: 'git commit -m "Konflikt geloest: Lennarts Route"', hint: 'Muster: git commit -m "Nachricht"' },
      ]},
      { type: "dialog", npc: "ada", lines: [
        "<b>Gelöst!</b> Genau so läuft's im Alltag: Git markiert die Kollision, du wählst (oder mischst von Hand), <code>add</code>, <code>commit</code> – fertig. Jetzt darfst du teilen: <code>git push</code>.",
      ] },
      { type: "teach", brief: "Jetzt teilen", cmd: {
        id: "t-git-push-resolved", intro: "↩︎ <code>git push</code> – jetzt gefahrlos, weil du vorher gepullt und den Konflikt gelöst hast.",
        text: "Schieb deinen gelösten Stand zum Server.",
        accept: [/^git\s+push$/], check: (sim: Sim) => sim.git.pushed, solution: "git push", hint: "Wirklich nur: git push" } },
      { type: "choice", npc: "ada", reviewId: "q-git-4",
        q: "Du beginnst den Tag und willst deine gestrige Arbeit teilen. Womit fängst du an?",
        options: [
          { t: "Erst git pull (holen), dann erst git push – sonst bin ich veraltet und der Server weist den Push ab.", ok: true,
            reply: "Genau. „Erst holen, dann pushen.“ Das erspart dir die meisten unnötigen Konflikte." },
          { t: "Sofort git push – meine Arbeit ist ja fertig.", ok: false,
            reply: "Riskant: hat das Team inzwischen gepusht, lehnt der Server ab (oder du überschreibst fremde Arbeit). Erst pull!" },
        ] },
      { type: "choice", npc: "ada", reviewId: "q-git-5",
        q: "Was bedeutet ein Merge-Konflikt eigentlich?",
        options: [
          { t: "Zwei Seiten haben dieselbe Stelle unterschiedlich geändert – Git kann nicht entscheiden und lässt MICH wählen.", ok: true,
            reply: "Richtig. Ein Konflikt ist keine Katastrophe, sondern eine Rückfrage: „Welche Version gilt?“" },
          { t: "Git ist kaputt und das Repository ist verloren.", ok: false,
            reply: "Keineswegs! Nichts ist verloren – Git hat nur beide Versionen nebeneinandergelegt und wartet auf deine Entscheidung." },
        ] },
      { type: "drill", brief: "Adas Übungsrunde", pool: ["git-pull", "git-resolve"], count: 2,
        intro: "Holen und Lösen sitzen erst mit Übung: pull holt, --theirs/--ours wählt die Seite." },
      { type: "dialog", npc: "ada", lines: [
        "Du hast den Team-Alltag drauf: <b>fetch</b> (nachsehen) → <b>pull</b> (holen) → arbeiten → Konflikt? <b>lösen</b> (Seite wählen, add, commit) → <b>push</b> (teilen). Damit überlebst du jeden ersten Arbeitstag. 🧭",
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
      { type: "dialog", npc: "runa", lines: [
        "Drei Werft-Kniffe noch fürs echte Leben, Lotse: Im <code>Chart.yaml</code> stehen ZWEI Versionen – <code>version</code> ist die der <b>Verpackung</b> (SemVer: Major bricht was, Minor = neue Property, Patch = Kleinkram), <code>appVersion</code> die der <b>Fracht</b> (deiner App). Bei jeder Änderung die Chart-version hochziehen, sonst sind Rollback und Diffs blind.",
        "Charts können andere Charts <b>mitschleppen</b>: Unter <code>dependencies:</code> bündelt ein <b>Eltern-Chart</b> ganze Subcharts (backend, keycloak …), jedes mit gepinnter Version – eine <b>Sammelkiste, die mehrere Pakete enthält</b>. Im Job sagt man <b>Umbrella-Chart</b> (auch „Wrapper“ oder „Bundle“) dazu – aber Achtung: das ist <b>kein offizieller Helm-Begriff</b>, das Spec kennt nur <i>parent chart / subcharts / dependencies</i>. Gängiger Sprech ≠ Doku!",
        "Die Subcharts liegen entweder <b>mit im Ordner</b> (unter <code>charts/</code> – „vendored“) oder werden per <code>repository:</code>-URL <b>aus einer Registry gezogen</b>: <code>helm dependency update</code> holt sie und zurrt sie in <code>Chart.lock</code> fest (reproduzierbar, überall gleich). Der Clou für viele Setups: einzelne Subcharts per <code>condition:</code> an-/abschalten (z.B. <code>condition: permit.enabled</code>) – Kunde mit Permit → an, ohne → aus, alles aus EINEM Chart.",
        "Und statt EINER <code>values.yaml</code> legst du mehrere übereinander: <code>helm install … -f base.yaml -f prod.yaml</code> – das spätere <code>-f</code> gewinnt. Gleiches Chart, andere Werte je Hafen (Test, Prod, je Region). Kralle drillt dich dazu ab! ⎈",
      ]},
      { type: "teach", unlockAbbrev: "helm-values", brief: "Werte überschreiben", cmd: {
        id: "t-upgrade-values", intro: "🆕 Flag <code>--values</code> (kurz <code>-f</code>): beim Upgrade eine eigene Werte-Datei mitgeben – überschreibt die Defaults aus <code>values.yaml</code>.",
        text: "Upgrade <code>mein-funk</code> mit der Chart-eigenen Werte-Datei: <code>helm upgrade mein-funk ./funkdienst --values funkdienst/values.yaml</code>.",
        accept: [/^helm\s+upgrade\s+mein-funk\s+\.\/funkdienst\s+(--values|-f)\s+funkdienst\/values\.yaml$/],
        solution: "helm upgrade mein-funk ./funkdienst --values funkdienst/values.yaml",
        hint: "Muster: helm upgrade <release> <chart> --values <datei>" } },
      { type: "teach", unlockAbbrev: "helm-dependency", brief: "Subcharts holen", cmd: {
        id: "t-helm-dep-update", intro: "🆕 Neuer Befehl: <code>helm dependency update</code> (kurz <code>dep</code>) – zieht alle in <code>Chart.yaml</code> deklarierten Subcharts und schreibt <code>Chart.lock</code>.",
        text: "Hole die Abhängigkeiten von <code>funkdienst</code>: <code>helm dependency update funkdienst</code>.",
        accept: [/^helm\s+(dependency|dep)\s+(update|up)\s+(\.\/)?funkdienst$/],
        solution: "helm dependency update funkdienst",
        hint: "Muster: helm dependency update <chart>" } },
    ]},

  { id: "q22", title: "Die Hafenmauer", giver: "juno", rewardXp: 60, rewardCoins: 45,
    steps: [
      { type: "dialog", npc: "juno", lines: [
        "Sturmwache Juno. Schön, dass du da bist – wir haben ein Sicherheitsproblem. Dein <b>Hafentor</b> (der Ingress) hat den Hafen zum <b>offenen Meer</b> geöffnet. Gut für Besucher … aber jetzt kann <b>jeder Pod mit jedem reden</b>, quer durch den ganzen Cluster.",
        "Das ist die unbequeme Wahrheit über Kubernetes: <b>standardmäßig ist alles offen</b>. Kein Zaun, keine Mauer. Schleicht sich ein böser Pod ein, klopft er ungestört an jeder Tür – auch beim <code>lager</code> mit den wertvollen Daten.",
        "Dagegen bauen wir eine <b>Hafenmauer</b>: eine <b>NetworkPolicy</b>. Sie wählt per Label Pods aus und sagt: <i>Zu DENEN darf nur, wen ich ausdrücklich erlaube</i> – alles andere prallt ab. Im Job nennt man das <b>default-deny</b>. Lass uns erst schauen, was schon steht.",
      ]},
      { type: "teach", unlockAbbrev: "kubectl-netpol", brief: "Mauern zählen", cmd: {
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
          accept: [/^kubectl\s+apply\s+(?:-f|--filename)\s+netpol\.yaml$/], solution: "kubectl apply -f netpol.yaml", hint: "Gleicher apply wie bei Adas Karten, Datei netpol.yaml." },
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
          accept: [/^kubectl\s+apply\s+(?:-f|--filename)\s+ingress-tls\.yaml$/], solution: "kubectl apply -f ingress-tls.yaml", hint: "Gleicher apply wie immer, Datei ingress-tls.yaml." },
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

  { id: "q24", title: "Läuft – bedient aber niemanden", giver: "juno", rewardXp: 60, rewardCoins: 45,
    steps: [
      { type: "dialog", npc: "juno", lines: [
        "Sturmwache Juno – kniffliger Fall heute. Die <b>Kombüse</b> (Deployment <code>kombuese</code>) soll die Crew verköstigen, aber die Gäste am Service bekommen … <b>nichts</b>. Dabei ist KEIN Pod abgestürzt!",
        "Genau das ist die fiese Sorte Fehler: Der Pod <b>läuft</b> – und liefert trotzdem nicht aus. Heute lernst du die zwei Wächter jedes Pods kennen: <b>liveness</b> (lebt er noch?) und <b>readiness</b> (kann er schon bedienen?). Schau erst mal nach den Pods.",
      ]},
      { type: "terminal", brief: "Das seltsame Bild",
        scenario: { deployments: [{ name: "kombuese", image: "nginx", replicas: 1, broken: { type: "notready", needsSecret: "kombuese-menue" } }] },
        tasks: [
        { id: "t-j24-1", text: "Mantra-Schritt 1: <code>get pods</code>. Lies STATUS <b>und</b> READY genau – fällt dir was auf?",
          accept: [/^kubectl\s+get\s+(pods|pod|po)$/], solution: "kubectl get pods", hint: "Der Übersichts-Befehl. STATUS = Running, aber die READY-Spalte …?" },
        { id: "t-j24-2", text: "<code>Running</code>, aber <code>0/1</code> READY – er läuft, ist aber nicht <b>bereit</b>. Schritt 2: <code>describe</code> den kombuese-Pod und lies die Events unten.",
          accept: [/^kubectl\s+describe\s+pods?\s+kombuese-\S+$/], solution: "kubectl describe pod <kombuese-pod>", hint: "kubectl describe pod <name> – Name aus get pods." },
      ]},
      { type: "choice", npc: "juno", reviewId: "q-ts-6",
        q: "Die Events sagen: <code>Readiness probe failed</code>, aber der Container ist gestartet. Was bedeutet READY 0/1 bei Status Running?",
        options: [
          { t: "Die Readiness-Probe ist rot – der Pod läuft, wird aber aus dem Service genommen, bis er bereit ist.", ok: true,
            reply: "Genau! Liveness = „lebt er?“ (sonst Neustart), Readiness = „kann er schon bedienen?“. Readiness rot heißt: kein Traffic, aber KEIN Neustart. Der Pod fehlt dann im Service – das sehen wir uns gleich an." },
          { t: "Der Pod ist abgestürzt und startet ständig neu (CrashLoopBackOff).", ok: false,
            reply: "Nein – dann stünden Restarts in der Liste und der Status wäre CrashLoopBackOff. Hier ist es Running, 0 Restarts: Er LÄUFT, meldet sich nur nicht bereit. Das ist die Readiness-Probe." },
          { t: "Das Image ließ sich nicht laden (ImagePullBackOff).", ok: false,
            reply: "Nein, das wäre ein ganz anderes Bild. Der Container ist gestartet (steht in den Events) – er sagt nur „noch nicht bereit“. Reine Readiness-Sache." },
        ]},
      { type: "terminal", brief: "Service davorstellen", tasks: [
        { id: "t-j24-3", text: "Stell der Kombüse einen <b>Service</b> voran (Port 80) – der verteilt den Verkehr auf die bereiten Pods.",
          accept: [/^kubectl\s+expose\s+deployment\s+kombuese\s+--port[=\s]80$/], check: (sim: Sim) => sim.services.some(s => s.name === "kombuese"),
          solution: "kubectl expose deployment kombuese --port=80", hint: "Muster: kubectl expose deployment <name> --port=<zahl>" },
      ]},
      { type: "teach", brief: "Wer bedient wirklich?", cmd: {
        id: "t-endpoints", intro: "🆕 Neuer Befehl: <code>kubectl get endpoints</code> (kurz <code>ep</code>) – zeigt, welche Pods ein Service <b>tatsächlich</b> bedient. Nur <b>bereite</b> Pods stehen hier.",
        text: "Schau, welche Endpoints der Service <code>kombuese</code> hat. (Spoiler: <code>&lt;none&gt;</code> – der nicht-bereite Pod fehlt!)",
        accept: [/^kubectl\s+get\s+(endpoints|endpoint|ep)\s+kombuese$/],
        solution: "kubectl get endpoints kombuese",
        hint: "Muster: kubectl get endpoints <service>" } },
      { type: "dialog", npc: "juno", lines: [
        "Da hast du den Beweis: Service vorhanden, Pod läuft – aber <code>ENDPOINTS &lt;none&gt;</code>. Die rote Readiness-Probe hält den Pod aus dem Service raus, damit kein Gast vor einer halb gestarteten Küche steht. Genau dafür ist Readiness da.",
        "Und der Grund? Der Probe-Pfad <code>/ready</code> antwortet erst grün, wenn die Kombüse ihre <b>Speisekarte</b> hat – ein Secret namens <code>kombuese-menue</code>. Leg es an. Achte danach drauf: Du wirst <b>nicht</b> neu starten müssen!",
      ]},
      { type: "terminal", brief: "Ursache beheben & beobachten", tasks: [
        { id: "t-j24-4", text: "Leg das fehlende Secret <code>kombuese-menue</code> an (Wert frei wählbar).",
          accept: [/^kubectl\s+create\s+secret\s+generic\s+kombuese-menue\s+--from-literal[=\s][\w.-]+=\S+$/],
          solution: "kubectl create secret generic kombuese-menue --from-literal=menue=fischeintopf",
          hint: "kubectl create secret generic <name> --from-literal=k=v" },
        { id: "t-j24-5", text: "Kein <code>rollout restart</code>! Frag einfach nochmal die Endpoints ab – die Probe prüft von selbst weiter.",
          accept: [/^kubectl\s+get\s+(endpoints|endpoint|ep)\s+kombuese$/],
          check: (sim: Sim) => { const d = sim.deployments.find(d => d.name === "kombuese"); return !!d && !d.broken && sim.services.some(s => s.name === "kombuese"); },
          solution: "kubectl get endpoints kombuese", hint: "Gleicher Befehl wie eben – jetzt steht eine Pod-IP drin statt <none>." },
        { id: "t-j24-6", text: "Gegenprobe mit <code>get pods</code>: READY müsste jetzt <code>1/1</code> sein.",
          accept: [/^kubectl\s+get\s+(pods|pod|po)$/],
          check: (sim: Sim) => { const d = sim.deployments.find(d => d.name === "kombuese"); return !!d && !d.broken; },
          solution: "kubectl get pods", hint: "READY 1/1, Status Running – ganz ohne Neustart." },
      ]},
      { type: "dialog", npc: "juno", lines: [
        "Merk dir den Unterschied fürs Leben: <b>Liveness</b> schlägt fehl → Pod wird neu gestartet. <b>Readiness</b> schlägt fehl → Pod läuft weiter, fliegt aber aus dem Service, bis er bereit ist. Beim Rollout schützt das deine Nutzer: Traffic geht erst auf neue Pods, wenn sie wirklich bereit sind.",
        "Und du hast's gesehen: Ursache behoben → Readiness wird von selbst grün, kein Neustart nötig. Das ist der feine Unterschied zum Crash. Sturmwache-würdig, Lotse! ⚓",
      ]},
    ]},

  { id: "q27", title: "Der hungrige Kartograf", giver: "juno", rewardXp: 65, rewardCoins: 50,
    steps: [
      { type: "dialog", npc: "juno", lines: [
        "Neuer Sturm, neue Sorte Ärger. Der <b>kartograf</b> – unser Dienst, der die Seekarten neu berechnet – will einfach nicht stehenbleiben. Kein Image-Fehler, kein fehlendes Secret. Er startet, läuft kurz, ist weg. Wieder und wieder.",
        "Das riecht nach <b>Speicher</b>. Jeder Container bekommt zwei Zahlen mit auf den Weg: <b>requests</b> (so viel reserviert ihm der Cluster fest) und <b>limits</b> (die Obergrenze). Sprengt er beim Speicher das Limit, macht der Kernel kurzen Prozess: <b>OOMKilled</b>. Mantra wie immer – erst gucken!",
      ]},
      { type: "terminal", brief: "Diagnose",
        scenario: { deployments: [{ name: "kartograf", image: "nginx", replicas: 1, broken: { type: "oomkilled", memNeeded: 256 } }] },
        tasks: [
        { id: "t-j26-1", text: "Mantra-Schritt 1: <code>get pods</code>. Lies STATUS und RESTARTS – der kartograf-Pod sieht übel aus.",
          accept: [/^kubectl\s+get\s+(pods|pod|po)$/], solution: "kubectl get pods", hint: "Der Übersichts-Befehl. STATUS zeigt OOMKilled, RESTARTS klettern." },
        { id: "t-j26-2", text: "Schritt 2: <code>describe</code> den kartograf-Pod. Achte auf <b>Last State</b>, <b>Reason</b> und das <b>memory-Limit</b> unten!",
          accept: [/^kubectl\s+describe\s+pods?\s+kartograf-\S+$/], solution: "kubectl describe pod <kartograf-pod>", hint: "kubectl describe pod <name> – Name aus get pods." },
      ]},
      { type: "choice", npc: "juno", reviewId: "q-ts-7",
        q: "<code>Last State: Terminated, Reason: OOMKilled</code> bei einem Limit von 64Mi. Und in den Logs? Nichts Auffälliges. Diagnose?",
        options: [
          { t: "Der Container sprengt sein memory-Limit – der Kernel killt ihn (Out Of Memory). Das Limit ist zu knapp.", ok: true,
            reply: "Genau! OOMKilled = Out Of Memory Killed. Der Beweis steht NIE in den App-Logs, sondern in describe unter Last State / Reason. Fix: das Limit realistisch anheben." },
          { t: "Die App hat einen Bug und stürzt ab (CrashLoopBackOff).", ok: false,
            reply: "Naheliegend, aber nein: Bei einem App-Crash stünde die Ursache in den Logs. Hier sagen die Logs nichts – und describe nennt klar OOMKilled. Das ist der Speicher, nicht der Code." },
          { t: "Das Image ließ sich nicht laden (ImagePullBackOff).", ok: false,
            reply: "Nein – das Image ist da, der Container startet ja (steht in den Events). Er wird nur wegen Speicher-Überschreitung gekillt: OOMKilled." },
        ]},
      { type: "terminal", brief: "Die saubere Lösung lesen",
        scenario: { files: { "resources.yaml": RESOURCES_YAML } },
        tasks: [
        { id: "t-j26-3", text: "So sieht es richtig aus: <code>cat resources.yaml</code>. Findest du den <code>resources</code>-Block mit <code>requests</code> und <code>limits</code>?",
          accept: [/^cat\s+resources\.yaml$/], solution: "cat resources.yaml", hint: "cat <datei>" },
      ]},
      { type: "dialog", npc: "juno", lines: [
        "Siehst du's? <b>requests.memory</b> ist der reservierte Platz (danach sucht der Scheduler einen passenden Node), <b>limits.memory</b> die harte Obergrenze. Unser kartograf braucht real ~256Mi, hatte aber nur 64Mi Limit. Kein Wunder, dass er zerplatzt.",
        "Wir heben das Limit an. Der Befehl dafür: <code>kubectl set resources</code> – setzt requests/limits an einem laufenden Deployment, ohne dass du das ganze Manifest neu schreibst.",
      ]},
      { type: "teach", brief: "Mehr Speicher geben", cmd: {
        id: "t-setresources", intro: "🆕 Neuer Befehl: <code>kubectl set resources deployment/&lt;name&gt; --limits=memory=&lt;X&gt; --requests=memory=&lt;Y&gt;</code> – setzt die Ressourcen-Grenzen.",
        text: "Gib dem <code>kartograf</code> ein <code>--limits=memory=256Mi</code> und ein <code>--requests=memory=128Mi</code>. Schau danach zum Dock!",
        accept: [/^kubectl\s+set\s+resources\s+deployment\/kartograf\s+(?:--limits[=\s][^\s]*memory=256Mi\s+--requests[=\s][^\s]*memory=128Mi|--requests[=\s][^\s]*memory=128Mi\s+--limits[=\s][^\s]*memory=256Mi)$/],
        solution: "kubectl set resources deployment/kartograf --limits=memory=256Mi --requests=memory=128Mi",
        hint: "Muster: kubectl set resources deployment/<name> --limits=memory=256Mi --requests=memory=128Mi" } },
      { type: "terminal", brief: "Verifizieren", tasks: [
        { id: "t-j26-4", text: "Dritte Regel: verifizieren! Steht der kartograf jetzt stabil?",
          accept: [/^kubectl\s+get\s+(pods|pod|po)$/], check: (sim: Sim) => { const d = sim.deployments.find(d => d.name === "kartograf"); return d && !d.broken; },
          solution: "kubectl get pods", hint: "STATUS muss Running sein, keine neuen Restarts." },
      ]},
      { type: "choice", npc: "juno", reviewId: "q-res-cost",
        q: "Geschafft! Warum nicht einfach allen Diensten <code>--limits=memory=4Gi</code> „sicherheitshalber\" geben?",
        options: [
          { t: "Weil requests echten Node-Platz reservieren – zu üppig = teurer, verschwendeter Platz. Man dimensioniert nach echtem Bedarf.", ok: true,
            reply: "Genau das ist Right-Sizing! Zu knapp → OOMKilled, zu üppig → du zahlst Dublonen für reservierte Luft. Die Kunst ist die Mitte: am echten Verbrauch messen, dann passend setzen." },
          { t: "Weil große Limits den Pod automatisch langsamer machen.", ok: false,
            reply: "Nein, langsamer macht das nichts. Das Problem ist die Reservierung: große requests blockieren Node-Kapazität, die keiner nutzt – und Kapazität kostet." },
        ]},
      { type: "dialog", npc: "juno", lines: [
        "Letzter Profi-Tipp, bevor du weiterziehst: Last schwankt – tagsüber Hochbetrieb, nachts Ebbe. Statt von Hand zu skalieren, setzt man einen <b>HorizontalPodAutoscaler (HPA)</b> davor. Der zählt die Auslastung (gemessen an den requests!) und dreht die Replica-Zahl automatisch hoch und runter.",
      ]},
      { type: "choice", npc: "juno", reviewId: "q-res-hpa",
        q: "Was macht ein HorizontalPodAutoscaler?",
        options: [
          { t: "Er passt die Anzahl der Pods automatisch an die Last an (mehr Pods bei hoher Auslastung).", ok: true,
            reply: "Richtig – die Automatik hinter dem manuellen 'kubectl scale'. Genau deshalb sind saubere requests so wichtig: Ohne sie weiß der HPA gar nicht, was „ausgelastet\" heißt. Du hast die Speicher-Stürme im Griff, Lotse! ⚓" },
          { t: "Er vergrößert automatisch das memory-Limit eines einzelnen Pods.", ok: false,
            reply: "Fast – das wäre VERTIKAL (das macht der VPA). Der HPA skaliert HORIZONTAL: er ändert die Pod-ANZAHL, nicht die Größe eines einzelnen Pods." },
        ]},
    ]},

  // ===== Phase 4: GitOps-Archipel (#103) – Einstiegs-Quest beim neuen NPC Argo =====
  // Reine Konzept-Quest (#94): vermittelt das GitOps-Prinzip (Git als einzige
  // Quelle der Wahrheit, deklarativer Soll-Zustand, Pull statt Push) noch OHNE
  // tiefe Argo-CD-Mechanik – die kommt ab #95. Bewusst nur dialog/choice,
  // entspannt & belohnend (#52). Knüpft an Adas Manifeste (q8) und die
  // Pipeline-Passage (q20, „die Pipeline schiebt den Stand rein") an.
  { id: "q28", title: "Das Logbuch der Insel", giver: "argo", rewardXp: 40, rewardCoins: 30,
    steps: [
      { type: "dialog", npc: "argo", lines: [
        "Willkommen auf dem <b>GitOps-Archipel</b>! Ich bin <b>Argo</b>, die Lotsin hier draußen. Schön ruhig, was? Das hat einen Grund.",
        "Drüben im Hafen rennst du ans Funkgerät und rufst dem Cluster jeden Befehl einzeln zu – <code>apply</code> hier, <code>scale</code> da. Sogar deine Pipeline <b>schiebt</b> den neuen Stand von außen hinein. Funktioniert. Aber: Wer weiß morgen noch, was wirklich laufen SOLL?",
        "Auf meiner Insel machen wir es andersherum. Hier gibt es <b>ein</b> Logbuch – und das Logbuch hat immer recht.",
      ]},
      { type: "dialog", npc: "argo", lines: [
        "Das Logbuch ist dein <b>Git-Repo</b>. Dort hinein schreibst du den <b>Soll-Zustand</b> – deklarativ als Manifeste, genau wie Ada es dir beigebracht hat: welche Dienste, welche Version, wie viele Kopien.",
        "Git ist damit die <b>einzige Quelle der Wahrheit</b> (engl. <i>single source of truth</i>). Nicht der Cluster, nicht dein Gedächtnis, nicht ein mühsam zusammengeklicktes Etwas – sondern <b>das Repo</b>. Willst du wissen, was laufen soll? Lies das Logbuch.",
      ]},
      { type: "choice", npc: "argo", reviewId: "q-gitops-truth",
        q: "Was ist bei GitOps die <b>einzige Quelle der Wahrheit</b> für den Soll-Zustand?",
        options: [
          { t: "Das Git-Repo – dort steht deklarativ, was laufen soll.", ok: true,
            reply: "Genau! Ein Blick ins Logbuch und du weißt, was sein soll – kein „ich glaube, da lief noch irgendwas…“." },
          { t: "Der aktuelle Zustand im Cluster – was läuft, ist die Wahrheit.", ok: false,
            reply: "Vorsicht: Das ist der <b>Ist</b>-Zustand, und der driftet. Jemand ändert von Hand etwas, ein Pod stirbt … Die Wahrheit über das SOLL steht im Repo, nicht im Cluster." },
        ]},
      { type: "dialog", npc: "argo", lines: [
        "Und jetzt der Clou – das <b>Pull-Prinzip</b>. Drüben <b>pusht</b> jemand von außen in den Cluster: du am Funkgerät, oder die Pipeline. Der Cluster ist passiv, er lässt mit sich machen.",
        "Hier wohnt ein Crewmitglied <b>im</b> Cluster: <b>Argo CD</b>, mein Namensvetter. Es schaut unermüdlich ins Logbuch und <b>zieht</b> sich den Soll-Zustand selbst heran (<i>pull</i>). Niemand drückt von außen etwas rein – der Cluster holt sich seine Wahrheit ab.",
        "Push heißt also: von außen reingeschoben. Pull heißt: der Cluster zieht es sich selbst. Klingt nach einer Kleinigkeit – ist aber der ganze Unterschied.",
      ]},
      { type: "choice", npc: "argo", reviewId: "q-gitops-pull",
        q: "<b>Push</b>- gegen <b>Pull</b>-Deployment – was trifft zu?",
        options: [
          { t: "Pull: ein Agent IM Cluster zieht den Soll-Zustand aus Git. Push: jemand von außen drückt ihn hinein (kubectl/Pipeline).", ok: true,
            reply: "Sitzt! Beim Pull lebt der Abgleich im Cluster und läuft von allein weiter – auch wenn niemand am Funkgerät sitzt." },
          { t: "Push und Pull sind nur zwei Wörter für dasselbe – am Ende läuft derselbe Befehl.", ok: false,
            reply: "Nein – die Richtung ist der Punkt: von außen hineindrücken (push) oder vom Cluster selbst abholen lassen (pull). Das verändert, wer die Kontrolle hat." },
        ]},
      { type: "dialog", npc: "argo", lines: [
        "Drei Sätze zum Mitnehmen: <b>1.</b> Das Repo ist die einzige Quelle der Wahrheit. <b>2.</b> Der Soll-Zustand steht deklarativ darin. <b>3.</b> Der Cluster <b>zieht</b> ihn sich selbst – statt dass jemand pusht.",
        "Das ist <b>GitOps</b>. Mehr Theorie brauchst du nicht – ab jetzt wird es praktisch. Komm wieder her, dann richten wir gemeinsam <b>Argo CD</b> ein und lassen es seine erste Application aus dem Logbuch ziehen. 🧭",
      ]},
    ]},

  { id: "q29", title: "Die selbstsegelnde Seekarte", giver: "argo", rewardXp: 55, rewardCoins: 40,
    steps: [
      { type: "dialog", npc: "argo",
        scenario: {
          files: { "application.yaml": ARGO_APPLICATION_MANUAL_YAML },
          applyEffects: {
            "application.yaml": { application: {
              name: "hafen-lager", repo: "https://github.com/port-kubernia/seekarten.git", path: "lager",
              autoSync: false, selfHeal: false,
              deployment: { name: "hafen-lager", image: "nginx:1.27", replicas: 2 },
            } },
          },
        },
        lines: [
          "Willkommen auf dem <b>GitOps-Archipel</b>, Lotse. Hier oben gilt eine eiserne Regel: <b>Git ist die Quelle der Wahrheit.</b> Was im Repo steht, IST der Soll-Zustand – kein Mensch tippt mehr <code>kubectl</code>-Befehle von Hand in den Cluster.",
          "Mein Werkzeug heißt <b>Argo CD</b>. Du gibst ihm eine <b>Application</b> – einen Auftrag, der sagt: „Diese Seekarte (dieser Git-Pfad) gehört in jenen Hafen (Namespace).“ Argo vergleicht dann laufend <b>Soll</b> (Git) mit <b>Ist</b> (Cluster).",
          "Ich habe dir den Auftrag schon hingelegt: <code>application.yaml</code>. Schau ihn dir an, bevor wir ihn ausrollen!",
        ] },
      { type: "terminal", brief: "Die Seekarte lesen", tasks: [
        { id: "t-argo-ls", text: "Was liegt hier? <code>ls</code>.", accept: [/^ls$/], solution: "ls", hint: "Zwei Buchstaben." },
        { id: "t-argo-cat", text: "Lies den Auftrag: <code>cat application.yaml</code>. Findest du <code>kind: Application</code> und den <code>source</code>-Block (das Git-Repo + der Pfad)?",
          accept: [/^cat\s+application\.yaml$/], solution: "cat application.yaml", hint: "cat <datei>" },
      ]},
      { type: "teach", brief: "Auftrag ausrollen", cmd: {
        id: "t-argo-apply", intro: "🆕 Die <b>Application</b> selbst ist ein ganz normales Manifest – du wendest sie mit dem längst bekannten <code>kubectl apply -f</code> an. Damit kennt Argo ab jetzt deinen Auftrag.",
        text: "Lege die Application im Cluster an: wende <code>application.yaml</code> an.",
        accept: [/^kubectl\s+apply\s+(?:-f|--filename)\s+application\.yaml$/], solution: "kubectl apply -f application.yaml",
        hint: "Der vertraute Befehl aus dem Kartenhaus: kubectl apply -f <datei>." } },
      { type: "dialog", npc: "argo", lines: [
        "Angelegt! Aber Achtung: Diese Seekarte hat <b>keine</b> automatische Sync-Politik. Argo <i>kennt</i> jetzt den Soll-Zustand, hat ihn aber noch <b>nicht</b> in den Cluster gesegelt. Lass uns nachschauen, was Argo über den Auftrag weiß.",
      ]},
      { type: "terminal", unlockAbbrev: "argocd-app-list", brief: "Was sagt Argo?", tasks: [
        { id: "t-argo-list", text: "Verschaff dir den Überblick: <code>argocd app list</code>. In der Spalte SYNC STATUS steht <code>OutOfSync</code> – Ist und Soll klaffen noch auseinander.",
          accept: [/^argocd\s+app\s+(list|ls)$/], solution: "argocd app list", hint: "argocd app list (oder ls)." },
      ]},
      { type: "teach", brief: "In die Akte schauen", cmd: {
        id: "t-argo-get", intro: "🆕 Neuer Befehl: <code>argocd app get &lt;name&gt;</code> – die volle Akte einer Application: <b>Sync Status</b> (Synced/OutOfSync) und <b>Health</b> (läuft die Workload gesund?).",
        text: "Öffne die Akte von <code>hafen-lager</code>. Lies Sync Status (noch <b>OutOfSync</b>) und Health.",
        accept: [/^argocd\s+app\s+get\s+hafen-lager$/], check: (sim: Sim) => sim.argoApps.some(a => a.name === "hafen-lager"),
        solution: "argocd app get hafen-lager", hint: "argocd app get <name> – den Namen zeigt 'argocd app list'." },
      },
      { type: "dialog", npc: "argo", lines: [
        "<b>OutOfSync</b> heißt: Im Git steht etwas, das der Cluster noch nicht hat (hier: das Deployment <code>hafen-lager</code> fehlt). Weil diese Application keinen Auto-Sync hat, segelst <b>du</b> den Soll-Zustand jetzt von Hand in den Cluster.",
        "Das ist das <b>Pull-Prinzip</b>: Argo <i>zieht</i> sich den im Git deklarierten Stand – niemand <i>pusht</i> von außen in den Cluster.",
      ]},
      { type: "teach", brief: "Soll in den Cluster ziehen", cmd: {
        id: "t-argo-sync", intro: "🆕 Neuer Befehl: <code>argocd app sync &lt;name&gt;</code> – Argo zieht den im Git deklarierten Soll-Zustand in den Cluster (Pull) und legt die fehlenden Ressourcen an.",
        text: "Synchronisiere <code>hafen-lager</code> – und schau danach, wie das Deployment entsteht!",
        accept: [/^argocd\s+app\s+sync\s+hafen-lager$/],
        check: (sim: Sim) => sim.deployments.some(d => d.name === "hafen-lager"),
        solution: "argocd app sync hafen-lager", hint: "argocd app sync <name>." } },
      { type: "terminal", brief: "Verifizieren", tasks: [
        { id: "t-argo-verify", text: "Beweis: <code>kubectl get deployments</code> – <code>hafen-lager</code> läuft jetzt, genau wie die Seekarte es deklariert.",
          accept: [/^kubectl\s+get\s+(deployments|deployment|deploy)$/],
          check: (sim: Sim) => sim.deployments.some(d => d.name === "hafen-lager"),
          solution: "kubectl get deployments", hint: "kubectl get deployments (oder deploy)." },
      ]},
      { type: "choice", npc: "argo", reviewId: "q-gitops-sync",
        q: "Frische <code>argocd app get hafen-lager</code> nochmal ab: Was bedeutet jetzt <b>Synced</b> statt OutOfSync?",
        options: [
          { t: "Cluster-Ist und Git-Soll stimmen überein – Argo hat den deklarierten Zustand hergestellt.", ok: true,
            reply: "Genau! Synced = Ist deckt sich mit dem Git-Soll. OutOfSync hieß: es gab eine Differenz. Argo gleicht beides per Pull ab – das Repo bleibt die Quelle der Wahrheit. ⚓" },
          { t: "Die Application-Datei wurde erfolgreich auf die Festplatte gespeichert.", ok: false,
            reply: "Nein – Synced sagt nichts über Dateien, sondern über den Abgleich: Cluster-Ist == Git-Soll. Vorher (OutOfSync) fehlte das Deployment im Cluster." },
        ]},
      { type: "dialog", npc: "argo", lines: [
        "Du hast deine erste Application von Hand synchronisiert. Beim nächsten Mal zeige ich dir, wie Argo das <b>ganz allein</b> macht – und sogar heimliche Änderungen am Cluster zurückdreht. <i>Self-Heal</i> nennt sich das.",
      ]},
    ]},

  // ===== Phase 4: GitOps-Archipel – Quest 3: Self-Heal & Drift (#96) =====
  // Die „Aha"-Quest: zeigt, dass Argo CD den deklarierten Soll-Zustand aktiv durchsetzt.
  // Spieler:in skaliert hafen-lager manuell auf 0 → Argo dreht den Drift sofort zurück.
  // Lerneffekt: Hand-Änderungen am Cluster sind vergänglich – Git gewinnt immer.
  { id: "q30", title: "Der stille Wächter", giver: "argo", rewardXp: 60, rewardCoins: 45,
    steps: [
      { type: "dialog", npc: "argo", lines: [
        "Du hast hafen-lager erfolgreich von Hand synchronisiert – super. Aber jetzt kommt die eigentliche Frage: Was passiert, wenn jemand am Cluster <b>herumschraubt</b>? Im echten Betrieb gibt es immer jemanden, der 'eben schnell' etwas skaliert oder einen Pod löscht. Manchmal auch du selbst, im Stress.",
        "GitOps hat eine Antwort darauf: <b>Self-Heal</b>. Argo beobachtet den Cluster laufend. Sobald der Ist-Zustand vom Git-Soll abweicht – also <b>Drift</b> entsteht –, dreht Argo die Änderung automatisch zurück. Der Cluster kann gar nicht dauerhaft von der Seekarte abweichen.",
        "Ich habe dir eine aktualisierte Seekarte vorbereitet. Die schaltet Auto-Sync und Self-Heal für hafen-lager ein. Schau sie dir an.",
      ] },
      { type: "terminal", brief: "Seekarte lesen",
        scenario: {
          files: { "application-selfheal.yaml": ARGO_APPLICATION_SELFHEAL_YAML },
          applyEffects: {
            "application-selfheal.yaml": { application: {
              name: "hafen-lager",
              repo: "https://github.com/port-kubernia/seekarten.git", path: "lager",
              autoSync: true, selfHeal: true,
              deployment: { name: "hafen-lager", image: "nginx:1.27", replicas: 2 },
            } },
          },
        },
        tasks: [
          { id: "t-sh-ls", text: "Was liegt hier? <code>ls</code>.",
            accept: [/^ls$/], solution: "ls", hint: "Zwei Buchstaben." },
          { id: "t-sh-cat", text: "Lies die neue Seekarte: <code>cat application-selfheal.yaml</code>. Findest du <code>syncPolicy.automated</code> und <code>selfHeal: true</code>?",
            accept: [/^cat\s+application-selfheal\.yaml$/], solution: "cat application-selfheal.yaml", hint: "cat application-selfheal.yaml" },
        ]},
      { type: "teach", brief: "Self-Heal aktivieren", cmd: {
        id: "t-sh-apply",
        intro: "🆕 <code>kubectl apply -f</code> ist idempotent: ändert sich die Konfiguration, gibt Kubernetes <b>configured</b> zurück (statt <i>unchanged</i>). So schaltest du Self-Heal für eine bestehende Application ein, ohne sie neu anlegen zu müssen.",
        text: "Aktiviere Self-Heal: wende <code>application-selfheal.yaml</code> an.",
        accept: [/^kubectl\s+apply\s+(?:-f|--filename)\s+application-selfheal\.yaml$/],
        check: (sim: Sim) => sim.argoApps.some(a => a.name === "hafen-lager" && a.selfHeal),
        solution: "kubectl apply -f application-selfheal.yaml",
        hint: "kubectl apply -f <datei> – der vertraute Befehl." } },
      { type: "dialog", npc: "argo", lines: [
        "Self-Heal ist jetzt aktiv. Prüf die Sync-Policy – und dann stell den stillen Wächter auf die Probe.",
      ]},
      { type: "terminal", brief: "Drift erzeugen & beobachten", tasks: [
        { id: "t-sh-get-before", text: "Prüf den Status: <code>argocd app get hafen-lager</code>. In der Sync-Policy steht jetzt <b>Automated (self-heal)</b>.",
          accept: [/^argocd\s+app\s+get\s+hafen-lager$/],
          check: (sim: Sim) => sim.argoApps.some(a => a.name === "hafen-lager" && a.selfHeal),
          solution: "argocd app get hafen-lager", hint: "argocd app get hafen-lager" },
        { id: "t-sh-scale", text: "Erzeuge Drift: <code>kubectl scale deployment hafen-lager --replicas=0</code>. Das ist eine absichtlich <i>falsche</i> Hand-Änderung.",
          accept: [/^kubectl\s+scale\s+(deployment\/hafen-lager|deployment\s+hafen-lager)\s+--replicas[=\s]+0$/],
          check: (sim: Sim) => { const d = sim.deployments.find(x => x.name === "hafen-lager"); return !!d && d.replicas === 0; },
          solution: "kubectl scale deployment hafen-lager --replicas=0",
          hint: "kubectl scale deployment hafen-lager --replicas=0" },
        { id: "t-sh-get-after", text: "Und jetzt schau, was wirklich läuft: <code>kubectl get deployments</code>. Erwartest du 0 – aber was zeigt der Cluster?",
          accept: [/^kubectl\s+get\s+(deployments|deployment|deploy)$/],
          check: (sim: Sim) => { const d = sim.deployments.find(x => x.name === "hafen-lager"); return !!d && d.replicas === 2; },
          solution: "kubectl get deployments", hint: "kubectl get deployments" },
      ]},
      { type: "dialog", npc: "argo", lines: [
        "<b>2 Replikas</b> – genau wie die Seekarte deklariert. Du hast auf null skaliert, aber Argo hat den Drift in demselben Atemzug erkannt und rückgängig gemacht. Bevor du nachschauen konntest, war der Git-Soll bereits wiederhergestellt.",
        "Das ist das Pull-Prinzip in seiner schärfsten Form: <b>manuelle Änderungen am Cluster sind vergänglich</b>. Egal was du tippst – solange die Seekarte etwas anderes sagt, ist die Hand-Änderung nur ein kurzes Zucken. <i>Git gewinnt immer.</i> 🧭",
      ]},
      { type: "choice", npc: "argo", reviewId: "q-gitops-heal",
        q: "Was tut Argo CD, wenn <b>Self-Heal</b> aktiv ist und jemand ein Deployment manuell skaliert?",
        options: [
          { t: "Es erkennt den Drift und stellt den im Git deklarierten Soll-Zustand automatisch wieder her.", ok: true,
            reply: "Genau! Self-Heal = Drift automatisch zurückdrehen. Git ist die Quelle der Wahrheit, kein manueller Eingriff kann das dauerhaft ändern. ⚓" },
          { t: "Es sendet eine Warnung, damit ein Admin manuell eingreifen kann.", ok: false,
            reply: "Nein – das wäre nur passives Monitoring. Self-Heal ist <i>aktiv</i>: Argo dreht den Drift von selbst zurück, ohne auf einen Menschen zu warten." },
          { t: "Es aktualisiert das Git-Repo, damit es dem neuen Cluster-Stand entspricht.", ok: false,
            reply: "Genau umgekehrt! Argo schreibt nie in Git. Git ist die Quelle der Wahrheit – Argo liest nur daraus und gleicht den Cluster daran an, nicht andersherum." },
        ]},
    ]},

  // ===== Phase 4: GitOps-Archipel – Quest 4 (Abschluss): App-of-Apps-Muster (#97) =====
  // Aufbau-Quest: eine Wurzel-`Application`, die selbst nichts ausrollt, sondern nur auf einen
  // Ordner voller weiterer `Application`s zeigt. Ein Sync → die ganze Flotte entsteht. Lerneffekt:
  // App-of-Apps skaliert GitOps über viele Apps – eine Wurzel statt n einzelner Hand-Anlagen.
  // Letzte Lern-Quest der Insel; setzt q29 (Application anlegen/syncen) und q30 (Self-Heal) voraus.
  { id: "q31", title: "Die Flotte aus einer Hand", giver: "argo", rewardXp: 65, rewardCoins: 50,
    steps: [
      { type: "dialog", npc: "argo", lines: [
        "Du beherrschst jetzt eine einzelne Application: anlegen, syncen, sogar Self-Heal. Aber schau mal raus auf den Archipel – das sind nicht eine, sondern <b>ein Dutzend Dienste</b>: Lager, Funk, Kran, Lotsen … und es werden mehr.",
        "Jeden davon von Hand als eigene <code>Application</code> anzulegen und einzeln zu syncen? Das ist genau die Fummelei, vor der GitOps uns eigentlich bewahren soll. Du vergisst einen, ein anderer driftet weg – und keiner hat den Überblick.",
        "Dafür gibt es das <b>App-of-Apps-Muster</b>: <b>eine einzige Wurzel-Application</b>, die selbst <i>nichts</i> ausrollt. Sie zeigt nur auf einen <b>Ordner voller weiterer Applications</b> – die <code>flotte/</code>. Synchronisierst du die Wurzel, legt Argo jede Application aus dem Ordner an, und die rollen wiederum ihre Dienste aus. Eine Hand am Steuer, die ganze Flotte fährt mit. Ich hab dir die Seekarte dafür hingelegt – schau sie dir an.",
      ] },
      { type: "terminal", brief: "Seekarte der Flotte lesen",
        scenario: {
          files: { "app-of-apps.yaml": APP_OF_APPS_YAML },
          applyEffects: {
            "app-of-apps.yaml": { application: {
              name: "hafen-flotte",
              repo: "https://github.com/port-kubernia/seekarten.git", path: "flotte",
              autoSync: true, selfHeal: true,
              childApps: [
                { name: "flotte-lager", path: "flotte/lager", deployment: { name: "flotte-lager", image: "nginx:1.27", replicas: 2 } },
                { name: "flotte-funk",  path: "flotte/funk",  deployment: { name: "flotte-funk",  image: "nginx:1.27", replicas: 2 } },
                { name: "flotte-kran",  path: "flotte/kran",  deployment: { name: "flotte-kran",  image: "nginx:1.27", replicas: 1 } },
              ],
            } },
          },
        },
        tasks: [
          { id: "t-aoa-ls", text: "Was liegt hier? <code>ls</code>.",
            accept: [/^ls$/], solution: "ls", hint: "Zwei Buchstaben." },
          { id: "t-aoa-cat", text: "Lies die Wurzel-Seekarte: <code>cat app-of-apps.yaml</code>. Sie ist selbst <code>kind: Application</code> – aber ihr <code>source.path</code> zeigt auf den Sammel-Ordner <code>flotte</code>, nicht auf einen einzelnen Dienst.",
            accept: [/^cat\s+app-of-apps\.yaml$/], solution: "cat app-of-apps.yaml", hint: "cat app-of-apps.yaml" },
        ]},
      { type: "teach", brief: "Die Flotte auslaufen lassen", cmd: {
        id: "t-aoa-apply",
        intro: "🆕 Das App-of-Apps-Muster: du wendest <b>eine</b> Wurzel-Application an – und weil sie auf einen Ordner voller weiterer Applications zeigt (und <code>automated</code> aktiv ist), legt Argo die <b>ganze Flotte</b> in einem Rutsch an. Ein <code>apply</code> statt n einzelner.",
        text: "Lass die Flotte auslaufen: wende <code>app-of-apps.yaml</code> an.",
        accept: [/^kubectl\s+apply\s+(?:-f|--filename)\s+app-of-apps\.yaml$/],
        check: (sim: Sim) => sim.argoApps.some(a => a.name === "hafen-flotte" && !!a.childApps)
          && ["flotte-lager", "flotte-funk", "flotte-kran"].every(n => sim.argoApps.some(a => a.name === n)),
        solution: "kubectl apply -f app-of-apps.yaml",
        hint: "kubectl apply -f app-of-apps.yaml – der vertraute Befehl, diesmal für die Wurzel." } },
      { type: "dialog", npc: "argo", lines: [
        "Spürst du das? <b>Ein</b> Befehl – und die Wurzel hat den ganzen <code>flotte/</code>-Ordner ausgerollt. Schau dir an, was jetzt alles fährt.",
      ]},
      { type: "terminal", brief: "Die ganze Flotte erscheint", tasks: [
        { id: "t-aoa-list", text: "Verschaff dir den Überblick: <code>argocd app list</code>. Aus einer Wurzel-Application ist die ganze Flotte geworden – <code>hafen-flotte</code> plus <code>flotte-lager</code>, <code>flotte-funk</code> und <code>flotte-kran</code>.",
          accept: [/^argocd\s+app\s+(list|ls)$/],
          check: (sim: Sim) => ["flotte-lager", "flotte-funk", "flotte-kran"].every(n => sim.argoApps.some(a => a.name === n)),
          solution: "argocd app list", hint: "argocd app list (oder ls)." },
        { id: "t-aoa-get", text: "Sieh dir die Wurzel genauer an: <code>argocd app get hafen-flotte</code>. Unter <b>Managed Apps</b> stehen die Kinder, die sie verwaltet – die Wurzel selbst rollt keinen eigenen Dienst aus.",
          accept: [/^argocd\s+app\s+get\s+hafen-flotte$/],
          check: (sim: Sim) => { const a = sim.argoApps.find(x => x.name === "hafen-flotte"); return !!a && !!a.childApps && a.childApps.length === 3; },
          solution: "argocd app get hafen-flotte", hint: "argocd app get hafen-flotte" },
        { id: "t-aoa-deploys", text: "Und der Beweis im Cluster: <code>kubectl get deployments</code>. Jede Kind-Application hat ihren Dienst ausgerollt – ohne dass du sie einzeln anlegen musstest.",
          accept: [/^kubectl\s+get\s+(deployments|deployment|deploy)$/],
          check: (sim: Sim) => ["flotte-lager", "flotte-funk", "flotte-kran"].every(n => sim.deployments.some(d => d.name === n)),
          solution: "kubectl get deployments", hint: "kubectl get deployments" },
      ]},
      { type: "dialog", npc: "argo", lines: [
        "Das ist die Skalier-Idee in Reinform: <b>eine Wurzel statt n Einzel-Anlagen</b>. Kommt ein neuer Dienst dazu, legst du eine weitere <code>Application</code>-Datei in den <code>flotte/</code>-Ordner – und beim nächsten Abgleich zieht die Wurzel sie automatisch mit rein. Du fasst nie wieder jede App einzeln an.",
        "Und weil alles in Git steht, gilt der Überblick für die ganze Flotte auf einen Blick: <code>argocd app list</code> zeigt dir den Sync- und Health-Status <i>jeder</i> App – verwaltet von einer einzigen Wurzel. So segelt der ganze Archipel im Gleichschritt. 🧭⚓",
      ]},
      { type: "choice", npc: "argo", reviewId: "q-gitops-appofapps",
        q: "Warum skaliert das <b>App-of-Apps-Muster</b> besser als jede Application einzeln von Hand anzulegen?",
        options: [
          { t: "Eine einzige Wurzel-Application zeigt auf einen Ordner voller weiterer Applications – ein Sync legt die ganze Flotte an, neue Dienste kommen als Datei im Ordner automatisch dazu.", ok: true,
            reply: "Genau! Eine Wurzel statt n Hand-Anlagen. Neue App = eine Datei mehr im Ordner, die Wurzel zieht sie beim nächsten Abgleich von selbst mit. ⚓" },
          { t: "Es macht jede Application schneller, weil Argo die Manifeste komprimiert.", ok: false,
            reply: "Nein, mit Geschwindigkeit oder Kompression hat es nichts zu tun. Der Gewinn ist <i>organisatorisch</i>: eine Wurzel verwaltet viele Apps, statt jede einzeln anzulegen." },
          { t: "Die Wurzel-Application rollt selbst alle Dienste aus und macht die Kind-Applications überflüssig.", ok: false,
            reply: "Andersherum: Die Wurzel rollt <i>keinen</i> eigenen Dienst aus. Sie zeigt nur auf die Kind-Applications – die rollen ihre Dienste selbst aus. Genau diese Trennung ist der Kern des Musters." },
        ]},
    ]},

  // ===== Phase 5: Monitoring-Leuchtturm – Quest 1 (Einstieg): Metriken & Prometheus (#113) =====
  // Erste Quest bei Leuchtturmwärterin Lumi: warum Observability, wie Prometheus per PULL
  // über /metrics scrapt (Targets up/down), `kubectl top pods/nodes` lesen und mit einem
  // ServiceMonitor festlegen, WELCHEN Service Prometheus abgrast. Hands-on gegen den Sim
  // (#109/#110), Theorie über Dialog/Choice. Entspannt & belohnend (#52).
  { id: "q32", title: "Licht ins Dunkel: die ersten Metriken", giver: "lumi", rewardXp: 50, rewardCoins: 40,
    steps: [
      { type: "dialog", npc: "lumi", lines: [
        "Ahoi und herauf auf die Klippe! Ich bin <b>Lumi</b>, ich halte hier oben den <b>Monitoring-Leuchtturm</b> am Brennen. Schön, dass du den Aufstieg gewagt hast.",
        "Mein Wahlspruch: <b>Erst messen, dann meckern.</b> Drüben im Hafen läuft alles – aber <i>woher</i> weißt du das eigentlich? Was du nicht <b>siehst</b>, kannst du nicht reparieren. Genau dafür gibt es <b>Observability</b>: den Hafen sichtbar machen.",
        "Mein wichtigstes Werkzeug heißt <b>Prometheus</b>. Stell es dir wie meinen Leuchtturm-Blick vor: In festem Takt – etwa alle 15 Sekunden – schaut Prometheus bei jedem Dienst vorbei und liest dessen Zahlen ab.",
      ]},
      { type: "dialog", npc: "lumi", lines: [
        "Und merk dir die Richtung, das ist der Knackpunkt: Prometheus <b>holt</b> sich die Zahlen selbst – es <b>scrapt</b> (engl. <i>to scrape</i> = abkratzen/abgrasen) jeden Dienst über dessen <code>/metrics</code>-Seite. Das ist <b>Pull</b>: der Wächter geht zu den Diensten, nicht die Dienste zum Wächter.",
        "Jeden Dienst, den Prometheus abgrast, nennen wir ein <b>Target</b> (Scrape-Ziel). Antwortet es, steht das Target auf <b>up</b>; schweigt es, auf <b>down</b> – und ein stummes Target ist oft das erste Zeichen, dass etwas im Argen liegt.",
      ]},
      { type: "choice", npc: "lumi", reviewId: "q-obs-scrape",
        q: "Wie kommt <b>Prometheus</b> an die Zahlen eines Dienstes?",
        options: [
          { t: "Es <b>scrapt</b> sie im Takt selbst ab – es ruft die <code>/metrics</code>-Seite des Dienstes auf (Pull). Antwortet das Target, ist es <b>up</b>.", ok: true,
            reply: "Genau! Pull-Prinzip: Prometheus geht von sich aus bei jedem Target vorbei und liest <code>/metrics</code>. Schweigt eins, steht es auf <b>down</b> – das erste Warnsignal." },
          { t: "Jeder Dienst schickt seine Zahlen von sich aus an Prometheus (Push), sobald sich etwas ändert.", ok: false,
            reply: "Nicht beim klassischen Prometheus: Es <i>holt</i> (pull) die Metriken selbst über <code>/metrics</code> ab, statt sie zugeschickt zu bekommen. Die Richtung ist genau andersherum." },
        ]},
      { type: "dialog", npc: "lumi", lines: [
        "Genug Theorie – schau selbst hin. Die schnellste Sofort-Ansicht der Last bekommst du mit <code>kubectl top</code>: Es zeigt dir live, wie viel <b>CPU</b> und <b>Speicher</b> gerade verbraucht wird. Fang bei den Pods an.",
      ]},
      { type: "teach", brief: "Last der Pods lesen", cmd: {
        id: "t-top-pods",
        intro: "🆕 Neuer Befehl: <code>kubectl top pods</code> – zeigt die <b>aktuelle</b> CPU- (in Millicores, <code>m</code>) und Speicher-Last (in <code>Mi</code>) je laufendem Pod. Die Zahlen liefert der metrics-server, dieselbe Quelle, aus der auch Prometheus schöpft.",
        text: "Lies die Pod-Last: <code>kubectl top pods</code>. Welcher Pod zieht am meisten?",
        accept: [/^kubectl\s+top\s+(pods|pod|po)$/], solution: "kubectl top pods",
        hint: "kubectl top pods (Kurzform: po)." } },
      { type: "terminal", brief: "Auch die Stege messen", tasks: [
        { id: "t-top-nodes", text: "Zoom eine Ebene raus: <code>kubectl top nodes</code> zeigt die Last pro <b>Node</b> (Steg) – CPU/Speicher absolut und in Prozent. So siehst du, ob ein ganzer Server an seine Grenze kommt.",
          accept: [/^kubectl\s+top\s+(nodes|node|no)$/], solution: "kubectl top nodes",
          hint: "kubectl top nodes (Kurzform: no)." },
      ]},
      { type: "choice", npc: "lumi", reviewId: "q-obs-top",
        q: "Was zeigt dir <code>kubectl top pods</code>?",
        options: [
          { t: "Die <b>aktuelle</b> CPU- und Speicher-Last je laufendem Pod (CPU in <code>m</code>, Speicher in <code>Mi</code>).", ok: true,
            reply: "Richtig! Ein Live-Blick auf den Verbrauch – ideal, um schnell den heißen Pod zu finden. <code>kubectl top nodes</code> macht dasselbe für die ganzen Stege." },
          { t: "Die <b>Logs</b> jedes Pods, also die Textausgaben des Programms.", ok: false,
            reply: "Das wären <code>kubectl logs</code>. <code>top</code> zeigt keine Texte, sondern Zahlen: wie viel CPU und Speicher gerade verbraucht wird." },
          { t: "Ob ein Pod <b>läuft</b> oder abgestürzt ist (Status Running/CrashLoop).", ok: false,
            reply: "Den Status zeigt <code>kubectl get pods</code>. <code>top</code> geht eine Stufe tiefer: nicht <i>ob</i>, sondern <i>wie viel</i> er gerade verbraucht." },
        ]},
      { type: "dialog", npc: "lumi",
        scenario: {
          files: { "servicemonitor.yaml": SERVICEMONITOR_YAML },
          applyEffects: {
            "servicemonitor.yaml": { serviceMonitor: { name: "lager-monitor", selector: "lager", port: "metrics", interval: "30s" } },
          },
        },
        lines: [
          "<code>top</code> ist der schnelle Blick. Damit Prometheus einen Dienst aber <b>dauerhaft</b> im Takt abgrast, muss ich ihm sagen: „Diesen Service bitte scrapen.“ Dafür gibt es ein eigenes Manifest – den <b>ServiceMonitor</b>.",
          "Ein ServiceMonitor ist ein deklaratives Stück YAML (eine CRD des Prometheus-Operators): sein <code>selector</code> wählt per Label den Service aus, seine <code>endpoints</code> sagen, an welchem Port und in welchem Takt <code>/metrics</code> abgegrast wird.",
          "Ich hab dir einen vorbereitet: <code>servicemonitor.yaml</code> für unseren <b>lager</b>-Service. Schau ihn dir erst an, dann grasen wir ihn an Prometheus an.",
        ] },
      { type: "terminal", brief: "Den Scrape-Auftrag lesen", tasks: [
        { id: "t-sm-ls", text: "Was liegt hier? <code>ls</code>.",
          accept: [/^ls$/], solution: "ls", hint: "Zwei Buchstaben." },
        { id: "t-sm-cat", text: "Lies den Auftrag: <code>cat servicemonitor.yaml</code>. Findest du <code>kind: ServiceMonitor</code>, den <code>selector</code> (welcher Service) und das <code>interval</code> (wie oft gescrapt wird)?",
          accept: [/^cat\s+servicemonitor\.yaml$/], solution: "cat servicemonitor.yaml", hint: "cat servicemonitor.yaml" },
      ]},
      { type: "teach", brief: "Service ins Monitoring nehmen", cmd: {
        id: "t-sm-apply",
        intro: "🆕 Der ServiceMonitor ist ein ganz normales Manifest – du wendest ihn mit dem vertrauten <code>kubectl apply -f</code> an. Ab jetzt weiß Prometheus, dass es den <b>lager</b>-Service scrapen soll.",
        text: "Nimm den Service ins Monitoring: wende <code>servicemonitor.yaml</code> an.",
        accept: [/^kubectl\s+apply\s+(?:-f|--filename)\s+servicemonitor\.yaml$/],
        check: (sim: Sim) => sim.serviceMonitors.some(s => s.name === "lager-monitor"),
        solution: "kubectl apply -f servicemonitor.yaml",
        hint: "kubectl apply -f <datei> – der vertraute Befehl aus dem Kartenhaus." } },
      { type: "terminal", brief: "Nachschauen, was gescrapt wird", tasks: [
        { id: "t-sm-get", text: "Prüf, dass der Auftrag steht: <code>kubectl get servicemonitors</code>. Dein <code>lager-monitor</code> taucht jetzt auf – Prometheus grast den Service ab.",
          accept: [/^kubectl\s+get\s+(servicemonitors|servicemonitor|smon)$/],
          check: (sim: Sim) => sim.serviceMonitors.some(s => s.name === "lager-monitor"),
          solution: "kubectl get servicemonitors", hint: "kubectl get servicemonitors (Kurzform: smon)." },
      ]},
      { type: "choice", npc: "lumi", reviewId: "q-obs-servicemonitor",
        q: "Wozu dient ein <b>ServiceMonitor</b>?",
        options: [
          { t: "Er sagt Prometheus deklarativ, <b>welchen</b> Service es scrapen soll – per <code>selector</code> (Label) plus Port & Intervall in <code>endpoints</code>.", ok: true,
            reply: "Genau! Der ServiceMonitor ist der deklarative Scrape-Auftrag: Selector wählt den Service, endpoints legen Port und Takt fest. Kein Prometheus-Config-Gefummel von Hand. 🔦" },
          { t: "Er startet einen neuen Pod, der den Service überwacht und bei Fehlern neu startet.", ok: false,
            reply: "Nein – er startet nichts. Ein ServiceMonitor ist nur eine Beschreibung für Prometheus: <i>welchen</i> Service grase ich ab und wie. Das Scrapen macht Prometheus selbst." },
          { t: "Er verschickt die Metriken per Push an einen externen Server.", ok: false,
            reply: "Andersherum: Prometheus <i>holt</i> sich die Metriken (Pull). Der ServiceMonitor legt nur fest, <b>welches</b> Target dafür in Frage kommt – verschickt selbst nichts." },
        ]},
      { type: "dialog", npc: "lumi", lines: [
        "Sieh an – du misst, statt zu raten. <code>top</code> für den schnellen Blick, ein <b>ServiceMonitor</b>, damit Prometheus dauerhaft dranbleibt. Das Fundament steht.",
        "Beim nächsten Mal machen wir die Zahlen <b>hübsch</b>: ein <b>Grafana</b>-Dashboard, das den Hafen auf einen Blick zeigt – schöner als jeder Sonnenuntergang. Komm wieder hoch auf die Klippe! 🔦",
      ]},
    ]},

  // ===== Phase 5: Monitoring-Leuchtturm – Quest 2: Grafana-Dashboard bauen & lesen (#114) =====
  // Zweite Quest bei Lumi: Grafana als Datasource an Prometheus anbinden (GrafanaDatasource-CRD),
  // dann ein deklaratives Dashboard anlegen (GrafanaDashboard-CRD), drei Panels lesen und aus
  // den Zahlen die richtige Schlussfolgerung ziehen. Entspannt & belohnend (#52).
  { id: "q33", title: "Zahlen in Bilder: das Grafana-Dashboard", giver: "lumi", rewardXp: 55, rewardCoins: 40,
    steps: [
      { type: "dialog", npc: "lumi", lines: [
        "Willkommen zurück auf der Klippe! Prometheus sammelt fleißig Zahlen – aber ein endloser Strom aus Messwerten ist wie ein Logbuch ohne Schaubilder: informativ, aber schwer zu lesen.",
        "Genau hier kommt <b>Grafana</b> ins Spiel. Grafana ist unser Kartentisch: Es nimmt die Rohdaten aus Prometheus und verwandelt sie in <b>Dashboards</b> – Bildschirmseiten mit Graphen, Tabellen und Ampeln, die du auf einen Blick ablesen kannst.",
        "Bevor Grafana aber überhaupt eine Zahl anzeigen kann, muss es wissen, <i>woher</i> es die Daten holt. Diese Verbindung nennt sich <b>Datasource</b> – die Datenquelle. Ohne Datasource: leere Graphen.",
      ]},
      { type: "dialog", npc: "lumi",
        scenario: {
          files: { "grafanadatasource.yaml": GRAFANA_DATASOURCE_YAML },
          applyEffects: {
            "grafanadatasource.yaml": { grafanaDatasource: { name: "prometheus-quelle", dsType: "prometheus", url: "http://prometheus-server.monitoring.svc:9090" } },
          },
        },
        lines: [
          "Ich habe dir eine <code>grafanadatasource.yaml</code> vorbereitet. Sie beschreibt eine <b>GrafanaDatasource</b> – eine CRD des Grafana-Operators. Darin steht: <i>Typ Prometheus, Adresse im Cluster, Zugriff über Proxy</i>.",
          "Sobald du das Manifest anwendest, weiß Grafana: „Meine Datenquelle heißt <b>Prometheus</b>, und ich finde sie unter <code>prometheus-server.monitoring.svc:9090</code>.“ Dann kann jedes Dashboard darauf zugreifen.",
        ] },
      { type: "terminal", brief: "Datasource-Manifest lesen", tasks: [
        { id: "t-ds-ls", text: "Was liegt hier? <code>ls</code>.",
          accept: [/^ls$/], solution: "ls", hint: "Zwei Buchstaben." },
        { id: "t-ds-cat", text: "Lies die Datenquelle: <code>cat grafanadatasource.yaml</code>. Findest du <code>kind: GrafanaDatasource</code>, den <code>type: prometheus</code> und die Cluster-URL?",
          accept: [/^cat\s+grafanadatasource\.yaml$/], solution: "cat grafanadatasource.yaml", hint: "cat grafanadatasource.yaml" },
      ]},
      { type: "teach", brief: "Datasource anbinden", cmd: {
        id: "t-ds-apply",
        intro: "🆕 Neuer Befehl: <code>kubectl apply -f grafanadatasource.yaml</code> – wie alle Manifeste, nur dass hier eine CRD des Grafana-Operators entsteht. Ab jetzt hat Grafana eine Datenquelle.",
        text: "Bind die Datenquelle an: wende <code>grafanadatasource.yaml</code> an.",
        accept: [/^kubectl\s+apply\s+(?:-f|--filename)\s+grafanadatasource\.yaml$/],
        check: (sim: Sim) => sim.grafanaDatasources.some(d => d.name === "prometheus-quelle"),
        solution: "kubectl apply -f grafanadatasource.yaml",
        hint: "kubectl apply -f <datei> – der vertraute Befehl." } },
      { type: "terminal", brief: "Datasource prüfen", tasks: [
        { id: "t-ds-get", text: "Prüf, dass Grafana die Quelle kennt: <code>kubectl get grafanadatasources</code>. Deine <code>prometheus-quelle</code> taucht jetzt auf.",
          accept: [/^kubectl\s+get\s+(grafanadatasources|grafanadatasource|grafanadatasrc)$/],
          check: (sim: Sim) => sim.grafanaDatasources.some(d => d.name === "prometheus-quelle"),
          solution: "kubectl get grafanadatasources", hint: "kubectl get grafanadatasources (Kurzform: grafanadatasrc)." },
      ]},
      { type: "choice", npc: "lumi", reviewId: "q-obs-datasource",
        q: "Wozu braucht Grafana eine <b>GrafanaDatasource</b>?",
        options: [
          { t: "Sie sagt Grafana, <b>woher</b> es die Metriken holt – Typ (Prometheus), Adresse im Cluster und Zugriffsweg.", ok: true,
            reply: "Genau! Die Datasource ist die Brücke: Grafana weiß jetzt, unter welcher Adresse es Prometheus findet und wie es anfragen soll. Ohne sie: leere Graphen. 🔦" },
          { t: "Sie startet Prometheus und sorgt dafür, dass es Metriken scrapt.", ok: false,
            reply: "Nein – Prometheus läuft bereits. Die GrafanaDatasource konfiguriert nur Grafana: <i>wo</i> es seine Daten abholt. Das Scrapen macht weiterhin Prometheus selbst." },
          { t: "Sie legt fest, welche Dashboards angezeigt werden und wie viele Panels sie haben.", ok: false,
            reply: "Das ist die Aufgabe der GrafanaDashboard-CRD. Die GrafanaDatasource kümmert sich nur um die <i>Datenquelle</i> – die Frage, woher die Zahlen kommen." },
        ]},
      { type: "dialog", npc: "lumi", lines: [
        "Datasource steht – Grafana hat jetzt einen Draht zu Prometheus. Jetzt bauen wir das <b>Dashboard</b> selbst.",
        "Ein <b>GrafanaDashboard</b> ist wieder eine CRD: Das eigentliche Dashboard-JSON (das Grafana sonst per Hand über die Oberfläche speichern würde) steckt direkt im Manifest. Deklarativ, versionierbar, reproduzierbar – genau wie alles andere im Cluster.",
        "Unser <b>Hafen-Übersicht</b>-Dashboard hat drei Panels: <b>CPU pro Pod</b> (Zeitreihe), <b>Aktive Alerts</b> (Zahl) und <b>Scrape-Targets up/down</b> (Tabelle). Kurz, aber alles, was du auf der Klippe brauchst.",
      ]},
      { type: "dialog", npc: "lumi",
        scenario: {
          files: { "grafanadashboard.yaml": GRAFANA_DASHBOARD_YAML },
          applyEffects: {
            "grafanadashboard.yaml": { grafanaDashboard: { name: "hafen-uebersicht", title: "Hafen-Übersicht", panels: 3 } },
          },
        },
        lines: [
          "Hier liegt <code>grafanadashboard.yaml</code>. Schau sie dir an – du findest darin den <code>title</code> und die <code>panels</code>-Liste. Dann wenden wir das Dashboard an.",
        ] },
      { type: "terminal", brief: "Dashboard-Manifest lesen", tasks: [
        { id: "t-gd-cat", text: "Lies das Dashboard: <code>cat grafanadashboard.yaml</code>. Findest du <code>kind: GrafanaDashboard</code>, den <code>title</code> und die drei Panel-Titel?",
          accept: [/^cat\s+grafanadashboard\.yaml$/], solution: "cat grafanadashboard.yaml", hint: "cat grafanadashboard.yaml" },
      ]},
      { type: "teach", brief: "Dashboard anlegen", cmd: {
        id: "t-gd-apply",
        intro: "🆕 Neuer Befehl: <code>kubectl apply -f grafanadashboard.yaml</code> – legt das Dashboard deklarativ an. Grafana liest das JSON aus dem Manifest und zeigt es sofort in seiner Oberfläche.",
        text: "Leg das Dashboard an: wende <code>grafanadashboard.yaml</code> an.",
        accept: [/^kubectl\s+apply\s+(?:-f|--filename)\s+grafanadashboard\.yaml$/],
        check: (sim: Sim) => sim.grafanaDashboards.some(d => d.name === "hafen-uebersicht"),
        solution: "kubectl apply -f grafanadashboard.yaml",
        hint: "kubectl apply -f <datei> – wie immer." } },
      { type: "terminal", brief: "Dashboard prüfen", tasks: [
        { id: "t-gd-get", text: "Prüf, dass das Dashboard registriert ist: <code>kubectl get grafanadashboards</code>. Du siehst <code>hafen-uebersicht</code> mit Titel und Panel-Anzahl.",
          accept: [/^kubectl\s+get\s+(grafanadashboards|grafanadashboard|grafanadash)$/],
          check: (sim: Sim) => sim.grafanaDashboards.some(d => d.name === "hafen-uebersicht"),
          solution: "kubectl get grafanadashboards", hint: "kubectl get grafanadashboards (Kurzform: grafanadash)." },
      ]},
      { type: "choice", npc: "lumi", reviewId: "q-obs-dashboard-panel",
        q: "Im Panel <b>Scrape-Targets up/down</b> siehst du plötzlich ein Target auf <code>down</code>. Was bedeutet das – und was ist dein nächster Schritt?",
        options: [
          { t: "Der betroffene Dienst antwortet nicht auf <code>/metrics</code> – Prometheus kann ihn nicht scrapen. Nächster Schritt: <code>kubectl get pods</code>, um den Pod-Status zu prüfen.", ok: true,
            reply: "Genau! Ein <code>down</code>-Target heißt: Prometheus hat beim Scrapen keine Antwort bekommen. Der Pod läuft vielleicht nicht, horcht am falschen Port oder hat einen Fehler. <code>kubectl get pods</code> + <code>kubectl describe pod</code> sind dein Einstieg. 🔦" },
          { t: "Grafana hat die Verbindung zur Datasource verloren. Nächster Schritt: <code>kubectl apply -f grafanadatasource.yaml</code> erneut ausführen.", ok: false,
            reply: "Nicht ganz. Wenn die Datasource fehlen würde, wären <i>alle</i> Panels leer oder fehlerhaft – nicht nur ein Target in der Tabelle. Ein einzelnes <code>down</code>-Target zeigt ein Problem beim <i>Dienst</i> selbst, nicht bei Grafana." },
          { t: "Das Target wurde bewusst deaktiviert. Es muss kein Handlungsbedarf bestehen.", ok: false,
            reply: "Im Zweifel lieber nachschauen als ignorieren! Ein <code>down</code>-Target ist immer ein Warnsignal: Prometheus bekommt keine Metriken mehr. Der Dienst könnte abgestürzt sein oder am falschen Port horchen." },
        ]},
      { type: "dialog", npc: "lumi", lines: [
        "Sieh an – du liest Dashboards wie Seekarten. Datasource verknüpft, Dashboard angelegt, Panels verstanden.",
        "Das ist Observability: nicht raten, sondern <b>sehen</b>. Prometheus sammelt, Grafana zeigt – und du weißt sofort, wo der Hafen brennt. Meld dich wieder, wenn du die <b>Alerts</b> aufschalten willst – dann nicht nur sehen, sondern <i>benachrichtigt</i> werden. 🔦",
      ]},
    ]},

  // ===== Phase 5: Monitoring-Leuchtturm – Quest 3: Logs lesen & Fehler finden (#115) =====
  // Dritte Quest bei Lumi: kubectl logs als zweite Observability-Säule. Basis-Logs lesen,
  // -f (follow) für live streams, --previous für den Absturz-Log. Fehlerursache aus einer
  // FATAL-Zeile ablesen. Entspannt & belohnend (#52).
  { id: "q34", title: "Was die App zu sagen hat: kubectl logs", giver: "lumi", rewardXp: 50, rewardCoins: 35,
    steps: [
      { type: "dialog", npc: "lumi", lines: [
        "Schön, dass du wieder rauf auf die Klippe gestiegen bist! Metriken zeigen uns <i>Zahlen</i> – wie viel CPU, wie viele Fehler, wie oft. Aber manchmal reichen die Zahlen nicht: Du weißt, ein Pod ist abgestürzt. <i>Warum?</i> Die Metriken sagen nur: Er ist weg.",
        "Hier kommen <b>Logs</b> ins Spiel – der zweite Pfeiler der Observability. Jede App schreibt ihren eigenen Text: Meldungen, Fehlermeldungen, Statuszeilen. Das ist ihr <b>Logbuch</b>, und <code>kubectl logs</code> ist der direkte Draht hinein.",
      ]},
      { type: "dialog", npc: "lumi",
        scenario: { deployments: [{ name: "signalgeber", image: "nginx", replicas: 1 }] },
        lines: [
          "Wichtig: <code>kubectl logs</code> zeigt, was <b>die App selbst</b> ausgibt – ihr <code>stdout</code> und <code>stderr</code>. Das sind reine Text-Zeilen, die das Programm schreibt.",
          "Das ist etwas anderes als <code>kubectl describe pod</code>: Describe zeigt die <b>Kubernetes-Sicht</b> (Zustand, Events, Scheduling). Logs zeigen die <b>App-Sicht</b>. Beides zusammen ergibt das vollständige Bild.",
          "Unser <b>signalgeber</b>-Dienst läuft gerade. Lies seine Logs – sieh selbst, was er zu berichten hat.",
        ] },
      { type: "teach", brief: "Pod-Logs lesen", cmd: {
        id: "t-logs-basic",
        intro: "🆕 Neuer Befehl: <code>kubectl logs &lt;pod&gt;</code> – zeigt die Textausgaben (stdout/stderr) des Containers. Den Pod-Namen bekommst du mit <code>kubectl get pods</code>.",
        text: "Lies die Logs des signalgeber-Pods: <code>kubectl logs &lt;pod-name&gt;</code>.",
        accept: [/^kubectl\s+logs\s+(signalgeber|signalgeber-\S+)$/],
        solution: "kubectl logs <signalgeber-pod>",
        hint: "kubectl logs <pod-name> – den Namen siehst du mit kubectl get pods." } },
      { type: "teach", brief: "Logs live verfolgen", cmd: {
        id: "t-logs-follow",
        intro: "🆕 Flag <code>-f</code> (<code>--follow</code>): Hält den Log-Stream offen – neue Zeilen erscheinen live. Ideal, um zu sehen, was gerade passiert. Mit <code>^C</code> beenden.",
        text: "Folge den Logs live: <code>kubectl logs -f &lt;pod-name&gt;</code>.",
        accept: [
          /^kubectl\s+logs\s+(-f|--follow)\s+(signalgeber|signalgeber-\S+)$/,
          /^kubectl\s+logs\s+(signalgeber|signalgeber-\S+)\s+(-f|--follow)$/,
        ],
        solution: "kubectl logs -f <signalgeber-pod>",
        hint: "kubectl logs -f <pod-name> – das -f steht für follow." } },
      { type: "choice", npc: "lumi", reviewId: "q-obs-logs-basic",
        q: "Was zeigt dir <code>kubectl logs &lt;pod&gt;</code>?",
        options: [
          { t: "Die Textausgaben der App – stdout/stderr des laufenden Containers.", ok: true,
            reply: "Genau! Logs zeigen, was die App selbst schreibt – Meldungen, Fehler, Statuszeilen. Die Kubernetes-Sicht (Scheduling, Events) zeigt dagegen kubectl describe. Beides zusammen ergibt das vollständige Bild. 🔦" },
          { t: "Die Kubernetes-Events des Pods (Scheduling, ImagePull, Neustart).", ok: false,
            reply: "Das zeigt kubectl describe pod. kubectl logs zeigt die App-Ausgabe – was das Programm selbst schreibt (stdout/stderr), nicht was Kubernetes darüber notiert." },
          { t: "Die aktuelle CPU- und Speicher-Last des Pods.", ok: false,
            reply: "Die Last zeigt kubectl top pods. kubectl logs zeigt Text: was die App als Ausgabe produziert – ihr Logbuch, Zeile für Zeile." },
        ]},
      { type: "dialog", npc: "lumi",
        scenario: { deployments: [{ name: "bakenbote", image: "nginx", replicas: 1, broken: { type: "crashloop", needsSecret: "baken-config" } }] },
        lines: [
          "Jetzt der Ernst. Siehst du das rote Aufflackern am Hafen? Die <b>bakenbote</b> – unser Signaldienst – stürzt immer wieder ab. <b>CrashLoopBackOff</b>.",
          "Bei einem CrashLoop sagt <code>kubectl describe pod</code> nur: <i>er stirbt, immer wieder</i>. Den echten Grund – was die App kurz vor dem Absturz geschrieben hat – zeigen nur die <b>Logs</b>.",
        ] },
      { type: "terminal", brief: "Status und Absturz-Logs lesen", tasks: [
        { id: "t-logs-get-pods", text: "Schau dir den Status an: <code>kubectl get pods</code>. Wie viele Restarts hat die bakenbote bereits?",
          accept: [/^kubectl\s+get\s+(pods|pod|po)$/], solution: "kubectl get pods",
          hint: "kubectl get pods – oder kurz: po." },
        { id: "t-logs-crash", text: "Lies die Logs der bakenbote: <code>kubectl logs &lt;pod-name&gt;</code>. Schau dir die letzte Zeile an – was steht da?",
          accept: [/^kubectl\s+logs\s+(bakenbote|bakenbote-\S+)$/],
          solution: "kubectl logs <bakenbote-pod>",
          hint: "kubectl logs <pod-name> – den Namen aus kubectl get pods kopieren." },
      ]},
      { type: "teach", brief: "Absturz-Log des Vorgängers lesen", cmd: {
        id: "t-logs-previous",
        intro: "🆕 Flag <code>--previous</code> (auch: <code>-p</code>): Zeigt die Logs des <b>letzten abgestürzten</b> Containers – genau das, was er kurz vor dem Exit ausgegeben hat. Nur sinnvoll, wenn der Pod schon neugestartet ist (also bei CrashLoop).",
        text: "Lies den Absturz-Log: <code>kubectl logs --previous &lt;bakenbote-pod&gt;</code>.",
        accept: [
          /^kubectl\s+logs\s+(--previous|-p)\s+(bakenbote|bakenbote-\S+)$/,
          /^kubectl\s+logs\s+(bakenbote|bakenbote-\S+)\s+(--previous|-p)$/,
        ],
        solution: "kubectl logs --previous <bakenbote-pod>",
        hint: "kubectl logs --previous <pod-name> – oder: -p als Kurzform." } },
      { type: "choice", npc: "lumi", reviewId: "q-obs-logs-previous",
        q: "Die Logs der bakenbote zeigen: <code>FATAL: Secret 'baken-config' nicht gefunden – Dienst kann nicht starten!</code>. Was ist die Ursache des Absturzes?",
        options: [
          { t: "Das Secret <b>baken-config</b> fehlt im Cluster – die App bricht beim Lesen der Konfiguration ab.", ok: true,
            reply: "Genau! Die FATAL-Zeile lügt nicht: Die App braucht das Secret baken-config, findet es nicht und beendet sich sauber mit Code 1. Jetzt weißt du, wo du ansetzen musst – Secret anlegen oder den Namen im Deployment korrigieren. 🔦" },
          { t: "Das Container-Image existiert nicht – Kubernetes kann es nicht laden (ImagePullBackOff).", ok: false,
            reply: "ImagePullBackOff bedeutet: das Image fehlt schon im Registry. Dann startet der Container gar nicht erst – keine Logs. Hier gibt es aber Logs mit einer klaren FATAL-Meldung: die App startet, liest die Konfiguration – und bricht dann ab." },
          { t: "Der Pod hat zu wenig Speicher und wird vom Kernel abgewürgt (OOMKilled).", ok: false,
            reply: "Bei OOMKilled endet das Log abrupt – kein Fehler, kein Stacktrace (der Kernel killt den Prozess von außen). Hier steht aber eine klare FATAL-Zeile: Die App findet ihr Secret nicht und beendet sich selbst." },
        ]},
      { type: "dialog", npc: "lumi", lines: [
        "Sieh an – Logs gelesen wie ein echter Wächter. Basis-Ausgabe, live folgen, Absturz-Log des Vorgängers: das Dreigespann trägt dich durch die meisten Nächte auf der Klippe.",
        "Metriken zeigen <i>was</i>, Logs zeigen <i>warum</i>. Ein letztes Werkzeug fehlt noch: <b>Alerts</b> – damit der Cluster dich weckt, bevor du überhaupt auf das Dashboard schauen musst. Komm wieder hoch! 🔦",
      ]},
    ]},

  // ===== Phase 5: Monitoring-Leuchtturm – Quest 4: Alerts & PrometheusRule (#116) =====
  // Vierte Quest bei Lumi: PrometheusRule anwenden, HighPodCPU-Alert feuern sehen,
  // Ursache beheben (scale auf 0) und Alert auf resolved beobachten. Feedback-Schleife.
  { id: "q35", title: "Der Cluster ruft: Alerts & PrometheusRule", giver: "lumi", rewardXp: 60, rewardCoins: 45,
    steps: [
      { type: "dialog", npc: "lumi", lines: [
        "Willkommen zurück! Metriken zeigen <i>was</i>, Logs zeigen <i>warum</i> – aber wer weckt dich nachts, wenn etwas brennt? Das ist die dritte Säule der Observability: <b>Alerts</b>.",
        "Prometheus wertet deine <b>Alert-Regeln</b> laufend gegen seine Metriken aus. Trifft eine Bedingung zu – und bleibt wahr – feuert ein Alert. Der <b>Alertmanager</b> entscheidet dann, wen er benachrichtigt.",
        "Du schreibst die Regeln nicht in Textdateien: Du deklarierst sie als <b>PrometheusRule</b> – eine CRD des Prometheus-Operators – und der Cluster lernt selbst zu rufen.",
      ]},
      { type: "dialog", npc: "lumi",
        scenario: {
          deployments: [{ name: "rechenknecht", image: "python", replicas: 1, cpuHeavy: true }],
          files: { "prometheusrule.yaml": PROMETHEUSRULE_YAML },
          applyEffects: {
            "prometheusrule.yaml": { prometheusRule: { name: "hafen-alarme", alert: "HighPodCPU", severity: "warning", expr: "rate(container_cpu_usage_seconds_total[5m]) > 0.5", forDuration: "5m" } },
          },
        },
        lines: [
          "Sieh an – da ist ein <b>rechenknecht</b>-Pod, der ungewöhnlich viel CPU zieht. Ich habe dir eine <code>prometheusrule.yaml</code> vorbereitet: Sie definiert die Regel, die Prometheus auf genau diesen Fall aufmerksam macht.",
          "Schau rein, was da steht – und bringe sie dann in den Cluster.",
        ] },
      { type: "terminal", brief: "Alert-Regel lesen", tasks: [
        { id: "t-pr-ls", text: "Was liegt hier? <code>ls</code>.",
          accept: [/^ls$/], solution: "ls", hint: "Zwei Buchstaben." },
        { id: "t-pr-cat", text: "Lies die Regel: <code>cat prometheusrule.yaml</code>. Findest du <code>alert: HighPodCPU</code>, den <code>expr</code> (die Bedingung in PromQL) und <code>for: 5m</code> (Wartezeit)?",
          accept: [/^cat\s+prometheusrule\.yaml$/], solution: "cat prometheusrule.yaml", hint: "cat prometheusrule.yaml" },
      ]},
      { type: "teach", brief: "Alert-Regel aktivieren", cmd: {
        id: "t-pr-apply",
        intro: "🆕 Eine <code>PrometheusRule</code> ist ein normales Manifest – du wendest sie mit <code>kubectl apply -f</code> an wie jede andere Ressource. Ab jetzt kennt Prometheus die Regel und prüft sie gegen seine Metriken.",
        text: "Aktiviere die Regel: wende <code>prometheusrule.yaml</code> an.",
        accept: [/^kubectl\s+apply\s+(?:-f|--filename)\s+prometheusrule\.yaml$/],
        check: (sim: Sim) => sim.prometheusRules.some(r => r.name === "hafen-alarme"),
        solution: "kubectl apply -f prometheusrule.yaml",
        hint: "kubectl apply -f <datei> – der vertraute Befehl." } },
      { type: "terminal", brief: "Regel prüfen", tasks: [
        { id: "t-pr-get", text: "Prüf, dass die Regel steht: <code>kubectl get prometheusrules</code>. Deine <code>hafen-alarme</code> taucht jetzt auf.",
          accept: [/^kubectl\s+get\s+(prometheusrules|prometheusrule|promrule|promrules)$/],
          check: (sim: Sim) => sim.prometheusRules.some(r => r.name === "hafen-alarme"),
          solution: "kubectl get prometheusrules", hint: "kubectl get prometheusrules (Kurzform: promrules)." },
      ]},
      { type: "teach", brief: "Aktive Alerts sehen", cmd: {
        id: "t-alerts-get",
        intro: "🆕 Neuer Befehl: <code>kubectl get alerts</code> – zeigt dir alle aktiven Alerts des Alertmanagers: Name, Schwere und ob sie gerade feuern (<code>firing</code>) oder bereits gelöst sind (<code>resolved</code>).",
        text: "Sieh dir die Alerts an: <code>kubectl get alerts</code>. Feuert <code>HighPodCPU</code>?",
        accept: [/^kubectl\s+get\s+alerts$/],
        check: (sim: Sim) => sim.alerts().some(a => a.name === "HighPodCPU" && a.state === "firing"),
        solution: "kubectl get alerts",
        hint: "kubectl get alerts" } },
      { type: "choice", npc: "lumi", reviewId: "q-obs-alert-firing",
        q: "Ein Alert steht auf <code>firing</code>. Was bedeutet das?",
        options: [
          { t: "Die Bedingung (<code>expr</code>) ist wahr und hält lang genug an – der Alarm feuert aktiv.", ok: true,
            reply: "Genau! Prometheus prüft laufend: Sobald der PromQL-Ausdruck wahr bleibt, feuert der Alert. Der Alertmanager entscheidet dann, wen er weckt – Slack, PagerDuty, E-Mail. Du hast die Semantik! 🔦" },
          { t: "Ein Mensch hat den Alert manuell ausgelöst, weil ihm etwas im Dashboard auffiel.", ok: false,
            reply: "Alerts feuern nicht manuell – das wäre Monitoring zum Selbst-Anrufen. Prometheus beobachtet die Metriken kontinuierlich und feuert von selbst, wenn eine Bedingung wahr bleibt. Kein Mensch muss dabei sein." },
          { t: "Prometheus ist abgestürzt und kann keine Metriken mehr scrapen.", ok: false,
            reply: "Wenn Prometheus selbst abgestürzt wäre, gäbe es gar keine Alerts. Ein firing-Alert zeigt das Gegenteil: Prometheus läuft, scrapt fleißig – und sieht dabei eine Bedingung, die zutrifft." },
        ]},
      { type: "dialog", npc: "lumi", lines: [
        "Der <b>rechenknecht</b>-Pod dreht auf Hochtouren. Sieh selbst – <code>kubectl top pods</code> zeigt, wie viel er zieht.",
        "Dann skalierst du ihn auf null Replicas: keine Pods, keine Last, Bedingung erfüllt sich nicht mehr. Prometheus sieht es – und der Alert wechselt auf <b>resolved</b>.",
      ] },
      { type: "terminal", brief: "Heißen Pod identifizieren", tasks: [
        { id: "t-top-hot", text: "Sieh, wer die CPU dominiert: <code>kubectl top pods</code>. Der <b>rechenknecht</b> liegt weit über der 500m-Schwelle.",
          accept: [/^kubectl\s+top\s+(pods|pod|po)$/], solution: "kubectl top pods",
          hint: "kubectl top pods – zeigt CPU und Memory je laufendem Pod." },
      ]},
      { type: "teach", brief: "Ursache beheben – Alert auflösen", cmd: {
        id: "t-scale-zero",
        intro: "Keine Pods mehr – keine CPU-Last. Prometheus sieht die Bedingung nicht mehr und markiert den Alert als <code>resolved</code>. In der Praxis ist das eine Sofort-Maßnahme, während man die eigentliche Ursache behebt.",
        text: "Stoppe den heißen Dienst: <code>kubectl scale deployment rechenknecht --replicas=0</code>.",
        accept: [/^kubectl\s+scale\s+deployment\s+rechenknecht\s+--replicas[=\s]0$/],
        check: (sim: Sim) => sim.alerts().some(a => a.name === "HighPodCPU" && a.state === "resolved"),
        solution: "kubectl scale deployment rechenknecht --replicas=0",
        hint: "kubectl scale deployment rechenknecht --replicas=0" } },
      { type: "terminal", brief: "Auflösung prüfen", tasks: [
        { id: "t-alerts-resolved", text: "Prüfe den neuen Status: <code>kubectl get alerts</code>. Der <code>HighPodCPU</code>-Alert steht jetzt auf <b>resolved</b>.",
          accept: [/^kubectl\s+get\s+alerts$/], solution: "kubectl get alerts",
          hint: "kubectl get alerts" },
      ]},
      { type: "choice", npc: "lumi", reviewId: "q-obs-alert-resolved",
        q: "Ein Alert wechselt von <b>firing</b> auf <b>resolved</b>. Was ist passiert?",
        options: [
          { t: "Die Bedingung ist nicht mehr wahr – die Ursache wurde behoben, Prometheus stellt keine Verletzung mehr fest.", ok: true,
            reply: "Genau! Resolved heißt: Prometheus hat geprüft – die Bedingung trifft nicht mehr zu. Der Alert bleibt kurz sichtbar, damit du weißt, dass er da war und wieder weg ist. Kein stilles Verschwinden, sondern ein klares Signal. 🔦" },
          { t: "Jemand hat den Alert manuell auf resolved gesetzt, um ihn zum Schweigen zu bringen.", ok: false,
            reply: "Alerts resolved setzt niemand von Hand – das wäre Symptom-Verstecken statt Ursachen-Beheben. Resolved kommt automatisch, wenn Prometheus sieht, dass die Bedingung nicht mehr wahr ist." },
          { t: "Der Alert wurde gelöscht und taucht erst wieder auf, wenn man ihn erneut anwendet.", ok: false,
            reply: "Gelöscht ist nicht resolved: Gelöscht bedeutet, der Alert verschwindet vollständig aus dem System. Resolved ist ein Zustandsübergang – die Regel bleibt, der Alert wechselt den Status, und beim nächsten Feuern kommt er wieder." },
        ]},
      { type: "dialog", npc: "lumi", lines: [
        "Metriken, Dashboards, Logs, Alerts – du hast alle vier Werkzeuge in der Hand. Jetzt wacht der Cluster selbst und ruft dich, wenn etwas brennt. Das ist echte Observability.",
        "Du bist bereit für alles, was der Hafen dir schickt. Viel Wind in den Segeln – und gute Wacht! 🔦",
      ]},
    ]},

  // Phase 7 – Lagerhallen-Viertel (#24): stateful Workloads & Datendauerhaftigkeit.
  // Speicher-Verwalter Knut (#125). Diese Quest: StatefulSet & stabile Identität (#127).
  { id: "q36", title: "Stabile Lager: das StatefulSet", giver: "knut", rewardXp: 60, rewardCoins: 45,
    steps: [
      { type: "dialog", npc: "knut", lines: [
        "Willkommen am Kai, Kapitän. Ich bin Knut – ich verwalte hier, was <b>bleiben</b> muss. Kisten, die man stapelt und wegträgt, das ist Bos Geschäft. Bei mir geht es um <b>Daten</b>, die einen Sturm überstehen.",
        "Ein <b>Deployment</b> behandelt seine Pods wie austauschbare Träger: stirbt einer, kommt ein <b>neuer mit neuem Namen</b> – ihm ist egal, was vorher drinstand. Für eine <b>Datenbank</b> wäre das eine Katastrophe.",
        "Dafür gibt es das <b>StatefulSet</b>: jeder Pod bekommt eine <b>feste Nummer</b> (…-0, …-1, …) und über <code>volumeClaimTemplates</code> sein <b>eigenes, dauerhaftes Volume</b>. Stabile Identität, eigene Daten. Schau dir die Karten an, die ich hingelegt habe.",
      ]},
      { type: "terminal", brief: "Karten lesen",
        scenario: {
          files: { "headless-service.yaml": HEADLESS_SERVICE_YAML, "statefulset.yaml": STATEFULSET_YAML },
          applyEffects: {
            "headless-service.yaml": { service: { name: "speicher-datenbank", port: "5432" } },
            "statefulset.yaml": { statefulSet: { name: "speicher-datenbank", image: "postgres:16", replicas: 3, serviceName: "speicher-datenbank", volumeClaimName: "daten", storage: "1Gi" } },
          },
        },
        tasks: [
        { id: "t-sts-ls", text: "Schau mit <code>ls</code>, was am Kai bereitliegt.", accept: [/^ls$/], solution: "ls", hint: "Zwei Buchstaben." },
        { id: "t-sts-cat", text: "Lies <code>cat statefulset.yaml</code>. Findest du <code>serviceName</code> und ganz unten <code>volumeClaimTemplates</code> – das eigene Volume je Pod?",
          accept: [/^cat\s+statefulset\.yaml$/], solution: "cat statefulset.yaml", hint: "cat <datei>" },
      ]},
      { type: "teach", brief: "Headless-Service zuerst", cmd: {
        id: "t-sts-headless", intro: "🆕 Ein StatefulSet braucht einen <b>headless Service</b> (<code>clusterIP: None</code>): keine gemeinsame virtuelle IP, sondern ein <b>stabiler DNS-Name pro Pod</b>. So bleibt jede Kiste einzeln adressierbar.",
        text: "Wende zuerst den headless Service an: <code>kubectl apply -f headless-service.yaml</code>.",
        accept: [/^kubectl\s+apply\s+(?:-f|--filename)\s+headless-service\.yaml$/],
        solution: "kubectl apply -f headless-service.yaml", hint: "kubectl apply -f <datei>" } },
      { type: "teach", brief: "StatefulSet ausrollen", cmd: {
        id: "t-sts-apply", intro: "🆕 Neuer Workload-Typ: das <b>StatefulSet</b>. Wie ein Deployment wendest du es mit dem vertrauten <code>kubectl apply -f</code> an – aber jeder Pod bekommt feste Identität und ein eigenes Volume.",
        text: "Rolle das StatefulSet aus: <code>kubectl apply -f statefulset.yaml</code> – und schau zum Kai!",
        accept: [/^kubectl\s+apply\s+(?:-f|--filename)\s+statefulset\.yaml$/],
        check: (sim: Sim) => sim.statefulSets.some(s => s.name === "speicher-datenbank"),
        solution: "kubectl apply -f statefulset.yaml", hint: "kubectl apply -f <datei>" } },
      { type: "terminal", brief: "Stabile Namen erkennen", tasks: [
        { id: "t-sts-get", text: "Sieh das StatefulSet: <code>kubectl get statefulset</code> – Spalte READY zeigt <code>3/3</code>. (Kurzform <code>sts</code> geht auch.)",
          accept: [/^kubectl\s+get\s+(statefulset|statefulsets|sts)$/],
          check: (sim: Sim) => sim.statefulSets.some(s => s.name === "speicher-datenbank"),
          solution: "kubectl get statefulset", hint: "kubectl get statefulset (oder sts)." },
        { id: "t-sts-pods", text: "Jetzt die Pods: <code>kubectl get pods</code>. Achte auf die Namen – sie enden auf <code>-0</code>, <code>-1</code>, <code>-2</code>: <b>durchnummeriert und stabil</b>, nicht zufällig wie beim Deployment.",
          accept: [/^kubectl\s+get\s+(pods|pod|po)$/],
          check: (sim: Sim) => { const s = sim.statefulSets.find(x => x.name === "speicher-datenbank"); return !!s && s.pods.some(p => p.name === "speicher-datenbank-0"); },
          solution: "kubectl get pods", hint: "kubectl get pods" },
      ]},
      { type: "teach", brief: "Identität überlebt", cmd: {
        id: "t-sts-delete", intro: "🆕 Der Beweis: lösch einen StatefulSet-Pod. Anders als beim Deployment kommt er mit <b>exakt demselben Namen</b> und <b>demselben Volume</b> zurück – die Daten überleben.",
        text: "Lösch den ersten Pod: <code>kubectl delete pod speicher-datenbank-0</code>. Mit <code>kubectl get pods</code> siehst du danach: <code>speicher-datenbank-0</code> ist wieder da – gleiche Identität, gleiche Daten.",
        accept: [/^kubectl\s+delete\s+pod\s+speicher-datenbank-0$/],
        check: (sim: Sim) => { const s = sim.statefulSets.find(x => x.name === "speicher-datenbank"); return !!s && s.pods.some(p => p.name === "speicher-datenbank-0"); },
        solution: "kubectl delete pod speicher-datenbank-0", hint: "kubectl delete pod <name> – nimm speicher-datenbank-0." } },
      { type: "choice", npc: "knut",
        q: "Warum ein <b>StatefulSet</b> statt eines Deployments für eine Datenbank?",
        options: [
          { t: "Stabile Identität (fester Name -0, -1 …) plus je Pod ein eigenes, dauerhaftes Volume – die Daten überleben Neustarts.", ok: true,
            reply: "Genau das. Feste Identität und eigener Speicher pro Pod: stirbt einer, kommt er als derselbe zurück und findet seine Daten wieder. Das ist der Kern stateful Workloads. 🗄️" },
          { t: "StatefulSets sind einfach schneller und sparen Speicher.", ok: false,
            reply: "Nein – Tempo oder Sparsamkeit ist nicht der Punkt. Ein StatefulSet ist eher aufwändiger; sein Wert ist die stabile Identität samt eigenem Volume." },
          { t: "Kein echter Unterschied – nur ein anderes Wort fürs Deployment.", ok: false,
            reply: "Doch, ein großer: das Deployment ersetzt Pods durch fremde mit neuem Namen ohne eigene Daten. Das StatefulSet bewahrt Name und Volume – darum geht es." },
        ]},
      { type: "dialog", npc: "knut", lines: [
        "Sauber verstaut, Kapitän. Stabile Namen, eigene Volumes – so lagert man, was bleiben muss.",
        "Als Nächstes zeige ich dir, <b>woher</b> der Speicher kommt: PersistentVolume, PVC und StorageClass. Aber das hebe ich mir für die nächste Schicht auf. 🪵",
      ]},
    ]},

  // Phase 7 – Lagerhallen-Viertel (#24): Speicher anfordern (#129). Folgt auf q36 (StatefulSet);
  // zoomt in die Speicher-Maschinerie unter den volumeClaimTemplates: PV, PVC, StorageClass.
  { id: "q37", title: "Speicher anfordern: PVC, PV & StorageClass", giver: "knut", rewardXp: 55, rewardCoins: 40,
    steps: [
      { type: "dialog", npc: "knut", lines: [
        "Zurück am Kai, Kapitän? Gut. Beim StatefulSet hast du gesehen, dass jeder Pod ein eigenes Volume bekommt. Heute zeige ich dir, <b>woher</b> dieser Speicher kommt.",
        "Drei Begriffe, ein Bild aus meinem Lager: Die <b>StorageClass</b> ist das <b>Regal-System</b> (welche Sorte Platz, wie schnell, welche Cloud). Das <b>PersistentVolume (PV)</b> ist das <b>echte Regalfach</b>. Und das <b>PersistentVolumeClaim (PVC)</b> ist deine <b>Anforderung</b>: „Ich brauche 5 GB von dieser Sorte.“",
        "Das Schöne: Du musst kein Fach von Hand bauen. Du reichst nur die Anforderung ein – die StorageClass <b>provisioniert</b> das Volume und bindet es. Schau dir die Karten an.",
      ]},
      { type: "terminal", brief: "Karten lesen",
        scenario: {
          files: { "storageclass.yaml": STORAGECLASS_YAML, "pvc.yaml": PVC_YAML },
          applyEffects: {
            "storageclass.yaml": { storageClass: { name: "kai-ssd", provisioner: "kubernetes.io/aws-ebs", reclaimPolicy: "Retain", isDefault: false } },
            "pvc.yaml": { pvc: { name: "lager-daten", storage: "5Gi", storageClass: "kai-ssd", accessModes: "RWO" } },
          },
        },
        tasks: [
        { id: "t-pvc-ls", text: "Schau mit <code>ls</code>, was am Kai bereitliegt.", accept: [/^ls$/], solution: "ls", hint: "Zwei Buchstaben." },
        { id: "t-pvc-cat", text: "Lies <code>cat pvc.yaml</code>. Findest du <code>storageClassName</code> und unter <code>requests</code> die angeforderte <code>storage</code>-Größe?",
          accept: [/^cat\s+pvc\.yaml$/], solution: "cat pvc.yaml", hint: "cat <datei>" },
      ]},
      { type: "teach", brief: "Regal-System bereitstellen", cmd: {
        id: "t-sc-apply", intro: "🆕 Die <b>StorageClass</b> beschreibt, welche Sorte Speicher der Cluster auf Anforderung beschafft (Provisioner, Geschwindigkeit, reclaimPolicy). Sie ist die Vorlage – noch kein Speicher.",
        text: "Stell das Regal-System bereit: <code>kubectl apply -f storageclass.yaml</code>.",
        accept: [/^kubectl\s+apply\s+(?:-f|--filename)\s+storageclass\.yaml$/],
        check: (sim: Sim) => sim.storageClasses.some(s => s.name === "kai-ssd"),
        solution: "kubectl apply -f storageclass.yaml", hint: "kubectl apply -f <datei>" } },
      { type: "teach", brief: "Speicher anfordern → Bound", cmd: {
        id: "t-pvc-apply", intro: "🆕 Das <b>PVC</b> ist die Anforderung. Wendest du es an, sucht (bzw. provisioniert) die StorageClass ein passendes <b>PV</b> und <b>bindet</b> beide: Status <code>Pending</code> → <code>Bound</code>. Gebunden heißt: dein Anspruch hat echten Speicher bekommen.",
        text: "Fordere den Speicher an: <code>kubectl apply -f pvc.yaml</code> – das PVC <code>lager-daten</code> wird <b>Bound</b>.",
        accept: [/^kubectl\s+apply\s+(?:-f|--filename)\s+pvc\.yaml$/],
        check: (sim: Sim) => sim.pvcs.some(p => p.name === "lager-daten" && p.status === "Bound"),
        solution: "kubectl apply -f pvc.yaml", hint: "kubectl apply -f <datei>" } },
      { type: "terminal", brief: "Lager lesen", tasks: [
        { id: "t-pvc-get", text: "Sieh die Anforderung: <code>kubectl get pvc</code> – Spalte STATUS zeigt <b>Bound</b>, dazu CAPACITY (5Gi), ACCESS MODES und STORAGECLASS.",
          accept: [/^kubectl\s+get\s+(pvc|persistentvolumeclaim|persistentvolumeclaims)$/],
          check: (sim: Sim) => sim.pvcs.some(p => p.name === "lager-daten" && p.status === "Bound"),
          solution: "kubectl get pvc", hint: "kubectl get pvc" },
        { id: "t-pv-get", text: "Und das echte Regalfach: <code>kubectl get pv</code> – die StorageClass hat dynamisch ein PV provisioniert und an dein PVC gebunden (CLAIM zeigt <code>default/lager-daten</code>).",
          accept: [/^kubectl\s+get\s+(pv|persistentvolume|persistentvolumes)$/],
          check: (sim: Sim) => sim.pvs.some(p => p.status === "Bound" && p.claim === "default/lager-daten"),
          solution: "kubectl get pv", hint: "kubectl get pv" },
      ]},
      { type: "terminal", brief: "Speicher überlebt den Workload", tasks: [
        { id: "t-pvc-dep", text: "Stell einen Workload an den Speicher: <code>kubectl create deployment datenbank --image=postgres</code>.",
          accept: [/^kubectl\s+create\s+deployment\s+datenbank\s+--image[=\s]postgres(:\S+)?$/],
          check: (sim: Sim) => sim.deployments.some(d => d.name === "datenbank"),
          solution: "kubectl create deployment datenbank --image=postgres", hint: "kubectl create deployment <name> --image=<image>" },
        { id: "t-pvc-del", text: "Jetzt der Beweis: reiß den Workload wieder ab – <code>kubectl delete deployment datenbank</code>.",
          accept: [/^kubectl\s+delete\s+deployment\s+datenbank$/],
          check: (sim: Sim) => !sim.deployments.some(d => d.name === "datenbank"),
          solution: "kubectl delete deployment datenbank", hint: "kubectl delete deployment <name>" },
        { id: "t-pvc-still", text: "Und nun <code>kubectl get pvc</code>: <code>lager-daten</code> ist <b>immer noch Bound</b>. Der Speicher ist ein eigenes, dauerhaftes Objekt – er hängt nicht am Pod. Pods kommen und gehen, die Daten bleiben.",
          accept: [/^kubectl\s+get\s+(pvc|persistentvolumeclaim|persistentvolumeclaims)$/],
          check: (sim: Sim) => sim.pvcs.some(p => p.name === "lager-daten" && p.status === "Bound") && !sim.deployments.some(d => d.name === "datenbank"),
          solution: "kubectl get pvc", hint: "kubectl get pvc" },
      ]},
      { type: "choice", npc: "knut",
        q: "PV, PVC, StorageClass – und was heißt <b>Bound</b>?",
        options: [
          { t: "StorageClass = Regal-System (Vorlage), PV = echtes Regalfach, PVC = deine Anforderung; Bound = Anforderung und Fach sind verbunden, der Speicher steht bereit.", ok: true,
            reply: "Genau so. Du forderst über das PVC an, die StorageClass provisioniert das PV, und Bound heißt: beide sind verheiratet – dein Anspruch hat echten, dauerhaften Platz. 🗄️" },
          { t: "PV und PVC sind dasselbe; die StorageClass ist nur ein Label, und Bound heißt „gelöscht“.", ok: false,
            reply: "Nein – PV (das Fach) und PVC (die Anforderung) sind zwei Seiten. Die StorageClass beschafft das Fach. Bound ist das Gegenteil von gelöscht: verbunden und nutzbar." },
          { t: "Das PVC ist der Speicher selbst; ohne PVC gibt es keine StorageClass, und Bound heißt „wird gerade gesucht“.", ok: false,
            reply: "Fast nichts davon stimmt: Das PVC ist nur die Anforderung, nicht der Speicher. „Wird gesucht“ wäre Pending – Bound heißt, es ist schon gefunden und verbunden." },
        ]},
      { type: "dialog", npc: "knut", lines: [
        "Jetzt kennst du den ganzen Weg: StorageClass beschafft, PV ist das Fach, PVC ist dein Anspruch – und Bound heißt, der Platz gehört dir.",
        "Damit lagert im Hafen nichts mehr ins Leere. Gute Wacht am Kai, Kapitän! 🪵",
      ]},
    ]},
];
