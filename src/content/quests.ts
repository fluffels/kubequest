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
  ARGO_APPLICATION_SELFHEAL_YAML, APP_OF_APPS_YAML,
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
        "LETZTE DOCKER-LEKTION. Profis geben Kisten <b>eigene Namen</b> (<code>--name</code>) und schicken sie mit <code>-d</code> in den <b>Hintergrund</b>.",
        "<code>-d</code> heißt <b>„detached“</b> – abgekoppelt. OHNE <code>-d</code> klemmt sich dein <b>Funkgerät an die Kiste</b>: Du siehst ihre Ausgabe, aber die Leitung ist <b>blockiert</b>, bis die Kiste schließt – kein anderer Befehl geht durch. MIT <code>-d</code> läuft die Kiste <b>abgekoppelt im Hintergrund weiter</b>, und das Funkgerät ist sofort wieder frei für den nächsten Befehl. Bo lässt das Funkgerät NIE blockieren. Bo ist Stein.",
        "Zusammen: <code>docker run -d --name webserver nginx</code>. Sieht lang aus – Bo zerlegt es Stück für Stück: <code>run</code> startet eine Kiste · <code>-d</code> ab in den Hintergrund · <code>--name webserver</code> = so soll <b>DEINE</b> Kiste heißen (<b>Wunschname, frei wählbar</b>) · <code>nginx</code> = das <b>[[Image]]</b>, der Bausatz, aus dem die Kiste entsteht (kommt von außen, NICHT frei erfunden).",
        "Verwechsle die letzten zwei NIE: hinter <code>--name</code> steht dein eigener Name, ganz hinten steht das Image. <code>docker run -d --name <b>meine-kiste</b> nginx</code> ginge genauso – nur <code>nginx</code> muss als Bauplan existieren.",
        "Noch eine Erleichterung: Die <b>Reihenfolge der Optionen ist frei</b> – <code>-d --name webserver</code> oder <code>--name webserver -d</code>, beides gilt. Bo-Regel: <b>erst alle Optionen, dann das Image</b> ganz zuletzt. Was NACH dem Image steht, hält die Kiste für einen eigenen Befehl. Du schaffst das.",
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
        "Jetzt machst du aus dem Bauplan ein echtes Image: <code>docker build</code>. Das <code>-t</code> (wie „tag“) gibt deinem Image einen <b>Namen</b> – sonst findest du es später nicht wieder. Der <b>Punkt</b> am Ende sagt: „Der Bauplan liegt HIER im aktuellen Ordner.“",
      ]},
      { type: "teach", brief: "Eigenes Image bauen", cmd: {
        id: "t-build", intro: "🆕 Neuer Befehl: <code>docker build -t &lt;name&gt;:&lt;tag&gt; .</code> – baut aus dem Dockerfile ein eigenes Image.",
        text: "Bau aus dem Dockerfile ein Image mit dem Namen <code>hafenwache:1.0</code>. (Punkt am Ende nicht vergessen!)",
        accept: [/^docker\s+build\s+-t\s+hafenwache:1\.0\s+\.$/], solution: "docker build -t hafenwache:1.0 .",
        hint: "Muster: docker build -t <name>:<tag> . – der Punkt ist der Baukontext (aktueller Ordner)." } },
      { type: "teach", brief: "Image-Liste", cmd: {
        id: "t-images", intro: "🆕 Neuer Befehl: <code>docker images</code> – zeigt alle Images, die lokal bereitliegen (gebaut oder gezogen).",
        text: "Zeig deine Images an. <code>hafenwache</code> mit Tag <code>1.0</code> müsste jetzt dabei sein!",
        accept: [/^docker\s+images$/], solution: "docker images", hint: "docker + Mehrzahl von „image“." } },
      { type: "dialog", npc: "bo", lines: [
        "Ein Image kann <b>mehrere Namen</b> tragen – wie zwei Etiketten an <b>derselben</b> Kiste, nicht zwei Kisten. <code>docker tag</code> hängt nur einen <b>zweiten Namen</b> an dasselbe Image – es entsteht <b>kein neues</b> Image und kein anderer Stand. <code>hafenwache:1.0</code> und <code>hafenwache:latest</code> sind danach <b>dasselbe</b> Image.",
        "Üblich ist der Zusatz-Name <code>:latest</code> – aber Vorsicht: das ist <b>nicht automatisch „die neueste Version“</b>, sondern nur ein <b>Konventions-Name</b>. Er zeigt auf das, was zuletzt als <code>:latest</code> getaggt wurde, damit andere das Image ohne Versionsnummer ziehen können. Ein Tag ist eben ein <b>Zeiger</b>, keine Kopie.",
        "Und wie <b>liest</b> man so einen Befehl? <code>docker tag hafenwache:1.0 hafenwache:latest</code> hat vier Teile: <code>docker</code> = das <b>Programm</b>, <code>tag</code> = der <b>Unterbefehl</b> (die Aktion), <code>hafenwache:1.0</code> = die <b>Quelle</b> (das vorhandene Image) und <code>hafenwache:latest</code> = das <b>Ziel</b> (der neue Name).",
        "Merk dir die Reihenfolge: <b>erst Quelle, dann Ziel</b> – „von wo → wohin“. Genau wie beim Kopieren <code>cp quelle ziel</code> (kopiere von … nach …). Dieses Muster steckt in vielen Befehlen – einmal kapiert, liest du sie alle leichter.",
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
        "Jetzt bist du <b>echter</b> Kisten-Profi: holen, bauen, etikettieren. <i>*Golem-Applaus*</i> Später baut eine <b>Pipeline</b> deine Images ganz von allein – aber das zeigt dir Ada. Erst will Ole dich sprechen: der GROSSE Umbau wartet! Und Üben bei Bo bringt weiter Dublonen.",
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
          accept: [/^git\s+commit\s+-m\s+("[^"]+"|'[^']+'|\S+)$/], check: (sim: Sim) => !sim.git.conflict,
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
        "Charts können andere Charts <b>mitschleppen</b>: Unter <code>dependencies:</code> bündelt ein <b>Umbrella-Chart</b> ganze Subcharts (backend, keycloak …), jedes mit gepinnter Version. <code>helm dependency update</code> zurrt sie in <code>Chart.lock</code> fest – reproduzierbar, überall gleich.",
        "Und statt EINER <code>values.yaml</code> legst du mehrere übereinander: <code>helm install … -f base.yaml -f prod.yaml</code> – das spätere <code>-f</code> gewinnt. Gleiches Chart, andere Werte je Hafen (Test, Prod, je Region). Kralle drillt dich dazu ab! ⎈",
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
        accept: [/^kubectl\s+set\s+resources\s+deployment\/kartograf\s+(?=.*--limits[=\s][^\s]*memory=256Mi)(?=.*--requests[=\s][^\s]*memory=128Mi).*$/],
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
        accept: [/^kubectl\s+apply\s+-f\s+application\.yaml$/], solution: "kubectl apply -f application.yaml",
        hint: "Der vertraute Befehl aus dem Kartenhaus: kubectl apply -f <datei>." } },
      { type: "dialog", npc: "argo", lines: [
        "Angelegt! Aber Achtung: Diese Seekarte hat <b>keine</b> automatische Sync-Politik. Argo <i>kennt</i> jetzt den Soll-Zustand, hat ihn aber noch <b>nicht</b> in den Cluster gesegelt. Lass uns nachschauen, was Argo über den Auftrag weiß.",
      ]},
      { type: "terminal", brief: "Was sagt Argo?", tasks: [
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
        accept: [/^kubectl\s+apply\s+-f\s+application-selfheal\.yaml$/],
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
        accept: [/^kubectl\s+apply\s+-f\s+app-of-apps\.yaml$/],
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
];
