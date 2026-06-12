/* ===== KubeQuest – Spielinhalte =====
 * Ränge, Kapitel (Lektion → Quiz → Terminal-Mission), Wiederholungskarten, Shop.
 */

(function () {
  "use strict";

  /* ---------- Ränge ---------- */
  const RANKS = [
    { xp: 0,    name: "Landratte",         icon: "🦔", ship: "🛶" },
    { xp: 80,   name: "Deckschrubberin",   icon: "🧹", ship: "🛶" },
    { xp: 200,  name: "Leichtmatrosin",    icon: "🪢", ship: "⛵" },
    { xp: 380,  name: "Matrosin",          icon: "⚓", ship: "⛵" },
    { xp: 600,  name: "Bootsfrau",         icon: "🛟", ship: "🚤" },
    { xp: 900,  name: "Steuerfrau",        icon: "☸️", ship: "🚢" },
    { xp: 1300, name: "Erste Offizierin",  icon: "🧭", ship: "🚢" },
    { xp: 1800, name: "Kapitänin",         icon: "👩‍✈️", ship: "🛳️" },
    { xp: 2500, name: "Flottenadmiralin",  icon: "🏅", ship: "🛳️" },
  ];

  /* ---------- Shop ---------- */
  const SHOP = [
    { id: "fernrohr", icon: "🔭", name: "Hinweis-Fernrohr", price: 25, type: "consumable",
      desc: "Zeigt dir in einer Terminal-Mission einen Hinweis zur aktuellen Aufgabe. Einmal benutzbar." },
    { id: "papagei", icon: "🦜", name: "Papagei-Joker", price: 35, type: "consumable",
      desc: "Dein Papagei pickt im Quiz zwei falsche Antworten weg (50:50). Einmal benutzbar." },
    { id: "kompass", icon: "🧭", name: "Lösungs-Kompass", price: 50, type: "consumable",
      desc: "Zeigt dir in einer Terminal-Mission die komplette Lösung der aktuellen Aufgabe. Einmal benutzbar." },
    { id: "theme-pirat", icon: "🏴‍☠️", name: "Theme: Piratennacht", price: 150, type: "theme", theme: "theme-pirat",
      desc: "Dunkles Piraten-Design für die ganze Oberfläche. Arrr!" },
    { id: "theme-morgen", icon: "🌅", name: "Theme: Morgenröte", price: 150, type: "theme", theme: "theme-morgen",
      desc: "Helles, freundliches Design für sonnige Lerntage." },
    { id: "ship-pirat", icon: "🏴‍☠️", name: "Piratenschiff", price: 200, type: "ship", ship: "🏴‍☠️",
      desc: "Ersetzt dein Schiff oben in der Leiste durch ein furchteinflößendes Piratenschiff." },
    { id: "ship-drache", icon: "🐉", name: "Drachenboot", price: 300, type: "ship", ship: "🐉",
      desc: "Das legendäre Drachenboot. Reine Angeberei – aber verdiente Angeberei." },
  ];

  /* ---------- Hilfen für Inhalte ---------- */
  const DEPLOYMENT_YAML = [
    "apiVersion: apps/v1",
    "kind: Deployment",
    "metadata:",
    "  name: lager",
    "spec:",
    "  replicas: 2",
    "  selector:",
    "    matchLabels:",
    "      app: lager",
    "  template:",
    "    metadata:",
    "      labels:",
    "        app: lager",
    "    spec:",
    "      containers:",
    "        - name: lager",
    "          image: redis:7",
    "          ports:",
    "            - containerPort: 6379",
  ].join("\n");

  const SERVICE_YAML = [
    "apiVersion: v1",
    "kind: Service",
    "metadata:",
    "  name: lager",
    "spec:",
    "  selector:",
    "    app: lager",
    "  ports:",
    "    - port: 6379",
  ].join("\n");

  const MAIN_TF = [
    "terraform {",
    "  required_providers {",
    "    hafen = {",
    "      source = \"kubequest/hafen\"",
    "    }",
    "  }",
    "}",
    "",
    "# Ein virtuelles Netzwerk für unseren Hafen",
    "resource \"hafen_netzwerk\" \"haupthafen\" {",
    "  name       = \"haupthafen-netz\"",
    "  cidr_block = \"10.0.0.0/16\"",
    "}",
    "",
    "# Zwei Server (Nodes) für den zukünftigen Cluster",
    "resource \"hafen_server\" \"worker\" {",
    "  count  = 2",
    "  name   = \"worker-${count.index + 1}\"",
    "  groesse = \"mittel\"",
    "}",
  ].join("\n");

  /* ---------- Kapitel ---------- */
  const CHAPTERS = [

    /* ============ Kapitel 1: Container & Docker ============ */
    {
      id: "ch1",
      icon: "📦",
      title: "Leinen los! – Container & Docker",
      sub: "Was ist überhaupt ein Container? Und was hat Docker damit zu tun?",
      steps: [
        {
          type: "lesson",
          title: "Was ist ein Container?",
          cards: [
            {
              icon: "🚢",
              html: `<p>Stell dir einen Hafen <b>vor</b> der Erfindung des Schiffscontainers vor: Säcke, Fässer, Kisten in allen Größen. Jedes Schiff wurde anders beladen, alles dauerte ewig.</p>
<p>Dann kam der <b>genormte Container</b>: eine Stahlbox mit Standardmaßen. Egal ob Bananen oder Klaviere drin sind – jeder Kran, jedes Schiff, jeder LKW kann damit umgehen.</p>
<p><b>Software-Container sind genau diese Idee für Programme:</b> Eine App wird zusammen mit allem, was sie zum Laufen braucht (Bibliotheken, Laufzeitumgebung, Konfiguration), in eine genormte Box gepackt. Diese Box läuft dann <b>überall gleich</b> – auf deinem Laptop, auf dem Server, in der Cloud.</p>`,
            },
            {
              icon: "🍕",
              html: `<p>Zwei Begriffe musst du auseinanderhalten:</p>
<p><b>Image</b> = der Bauplan bzw. die Tiefkühlpizza. Eine fertige, unveränderliche Vorlage.<br>
<b>Container</b> = die Pizza im Ofen. Eine <b>laufende Instanz</b> eines Images. Aus einem Image kannst du beliebig viele Container starten.</p>
<p>Und woher bekommt man Images? Aus einer <b>Registry</b> – dem Supermarkt für Images. Die bekannteste heißt <b>Docker Hub</b>.</p>`,
            },
            {
              icon: "🐳",
              html: `<p><b>Docker</b> ist das bekannteste Werkzeug, um Container zu bauen und zu starten. Die wichtigsten Befehle:</p>
<p><code>docker pull nginx</code> – lädt das Image <i>nginx</i> aus der Registry herunter<br>
<code>docker run -d --name webserver nginx</code> – startet daraus einen Container (<code>-d</code> = im Hintergrund, <code>--name</code> = Wunschname)<br>
<code>docker ps</code> – zeigt alle <b>laufenden</b> Container<br>
<code>docker stop webserver</code> – stoppt den Container<br>
<code>docker ps -a</code> – zeigt auch gestoppte Container</p>
<div class="merke">⚓ <b>Merksatz:</b> Image = Bauplan, Container = laufende Instanz. Docker baut und startet sie.</div>`,
            },
          ],
        },
        {
          type: "quiz",
          items: [
            {
              id: "q-ch1-1",
              q: "Welches Problem lösen Software-Container hauptsächlich?",
              options: [
                "Eine App läuft mit allem Drumherum überall gleich – egal ob Laptop, Server oder Cloud.",
                "Sie machen Programme automatisch schneller.",
                "Sie verschlüsseln Programme gegen Hacker.",
                "Sie sparen Speicherplatz auf der Festplatte.",
              ],
              correct: 0,
              explain: "Container packen die App mit allen Abhängigkeiten in eine genormte Box. Das berüchtigte „Bei mir läuft's aber!“ gehört damit der Vergangenheit an.",
            },
            {
              id: "q-ch1-2",
              q: "Was ist der Unterschied zwischen einem Image und einem Container?",
              options: [
                "Image = Bauplan/Vorlage, Container = laufende Instanz davon.",
                "Kein Unterschied, das sind zwei Wörter für dasselbe.",
                "Container = Vorlage, Image = das laufende Programm.",
                "Images sind für Linux, Container für Windows.",
              ],
              correct: 0,
              explain: "Wie Tiefkühlpizza (Image) und Pizza im Ofen (Container): Aus einem Image kannst du viele Container starten.",
            },
            {
              id: "q-ch1-3",
              q: "Was ist Docker Hub?",
              options: [
                "Eine Registry – ein öffentlicher „Supermarkt“, aus dem man fertige Images herunterladen kann.",
                "Das Hauptquartier der Firma Docker.",
                "Ein USB-Hub speziell für Container.",
                "Ein Überwachungstool für laufende Container.",
              ],
              correct: 0,
              explain: "Eine Registry speichert Images. Docker Hub ist die bekannteste – `docker pull nginx` lädt z.B. das nginx-Image von dort.",
            },
            {
              id: "q-ch1-4",
              q: "Was zeigt dir der Befehl <code>docker ps</code>?",
              options: [
                "Alle gerade laufenden Container.",
                "Alle heruntergeladenen Images.",
                "Die Prozessorlast des Rechners.",
                "Alle verfügbaren Images auf Docker Hub.",
              ],
              correct: 0,
              explain: "docker ps = laufende Container. Mit -a (für „all“) siehst du zusätzlich die gestoppten.",
            },
            {
              id: "q-ch1-5",
              q: "Kannst du aus einem einzigen Image mehrere Container gleichzeitig starten?",
              options: [
                "Ja – das Image ist nur die Vorlage, Container kann ich davon beliebig viele starten.",
                "Nein, ein Image kann immer nur einen Container erzeugen.",
                "Nur wenn das Image dafür speziell gebaut wurde.",
                "Nur auf Linux, nicht auf Windows.",
              ],
              correct: 0,
              explain: "Genau das ist später die Grundlage fürs Skalieren in Kubernetes: ein Image, viele laufende Kopien.",
            },
          ],
        },
        {
          type: "terminal",
          intro: "Zeit fürs echte Tippen, Deckschrubberin! Unten siehst du ein Terminal. Es ist simuliert – du kannst also nichts kaputt machen. Tippe die Befehle selbst ein (nicht kopieren, das Tippen ist das Training!).",
          scenario: {},
          tasks: [
            {
              id: "t-ch1-1",
              text: "Lade zuerst das Image <code>nginx</code> (ein kleiner Webserver) aus der Registry herunter.",
              accept: [/^docker\s+pull\s+nginx(:\S+)?$/],
              hint: "Herunterladen heißt bei Docker „pull“ (ziehen). Muster: docker pull <image>",
              solution: "docker pull nginx",
            },
            {
              id: "t-ch1-2",
              text: "Starte jetzt aus dem Image einen Container im Hintergrund (<code>-d</code>) mit dem Namen <code>webserver</code>.",
              accept: [/^docker\s+run\s+(?=.*-d)(?=.*--name\s+webserver).*nginx(:\S+)?$/],
              hint: "Muster: docker run -d --name <wunschname> <image>",
              solution: "docker run -d --name webserver nginx",
            },
            {
              id: "t-ch1-3",
              text: "Prüfe, ob dein Container wirklich läuft.",
              accept: [/^docker\s+ps$/],
              check: sim => sim.docker.containers.some(c => c.name === "webserver" && c.running),
              hint: "Der Befehl, der laufende Container auflistet … wir hatten ihn in der Lektion.",
              solution: "docker ps",
            },
            {
              id: "t-ch1-4",
              text: "Feierabend für den Webserver: Stoppe den Container <code>webserver</code>.",
              accept: [/^docker\s+stop\s+webserver$/],
              hint: "Muster: docker stop <name>",
              solution: "docker stop webserver",
            },
            {
              id: "t-ch1-5",
              text: "Der Container ist gestoppt – aber noch da! Lass dir <b>alle</b> Container anzeigen, auch die gestoppten.",
              accept: [/^docker\s+ps\s+(-a|--all)$/],
              hint: "docker ps zeigt nur laufende. Es gibt eine kleine Flag für „alle“ …",
              solution: "docker ps -a",
            },
          ],
        },
      ],
    },

    /* ============ Kapitel 2: Kubernetes-Grundlagen ============ */
    {
      id: "ch2",
      icon: "☸️",
      title: "Das Orchester – Kubernetes-Grundlagen",
      sub: "Viele Container, viele Server – wer behält den Überblick?",
      steps: [
        {
          type: "lesson",
          title: "Warum Kubernetes?",
          cards: [
            {
              icon: "😵",
              html: `<p>Mit Docker kannst du Container starten. Super! Aber stell dir jetzt eine echte Firma vor: <b>Hunderte Container auf Dutzenden Servern.</b></p>
<p>Wer startet einen Container neu, wenn er abstürzt – nachts um 3? Wer verteilt die Container sinnvoll auf die Server? Wer sorgt bei viel Andrang für mehr Kopien?</p>
<p>Das von Hand zu machen wäre, als würdest du in einem Hafen jeden Container einzeln mit dem Fahrrad umherfahren. Es braucht eine <b>Hafenmeisterei</b>.</p>`,
            },
            {
              icon: "☸️",
              html: `<p>Diese Hafenmeisterei ist <b>Kubernetes</b> – ein System, das deine Container automatisch verwaltet (man sagt: <b>orchestriert</b>).</p>
<p>Der Name ist griechisch und bedeutet <b>„Steuermann“</b>. Die Abkürzung <b>K8s</b> liest du überall: K + 8 Buchstaben (ubernete) + s.</p>
<p>Du sagst Kubernetes <b>was</b> laufen soll („3 Kopien meines Webservers!“) – und Kubernetes kümmert sich darum, dass es so ist und <b>bleibt</b>. Stürzt ein Container ab, startet Kubernetes automatisch Ersatz.</p>`,
            },
            {
              icon: "🗺️",
              html: `<p>Die vier wichtigsten Begriffe, im Hafenbild:</p>
<p><b>Cluster</b> = der ganze Hafen. Alle Server zusammen, die Kubernetes verwaltet.<br>
<b>Node</b> = ein einzelner Kai (ein Server/Rechner) im Cluster.<br>
<b>Pod</b> = der kleinste Liegeplatz: die kleinste Einheit in Kubernetes. Ein Pod enthält meist genau <b>einen</b> Container (selten mehrere, die eng zusammengehören).<br>
<b>Control Plane</b> = die Hafenmeisterei selbst: der Teil von Kubernetes, der alles plant und überwacht.</p>`,
            },
            {
              icon: "📡",
              html: `<p>Und wie redest du mit dem Cluster? Mit <b><code>kubectl</code></b> (sprich: „kjub-konntroll“ oder buchstabiert „k-u-b-e-c-t-l“ – über die richtige Aussprache streitet die ganze Branche 😄) – deinem Funkgerät zur Hafenmeisterei.</p>
<p><code>kubectl get nodes</code> – zeigt alle Server (Nodes) im Cluster<br>
<code>kubectl get pods</code> – zeigt alle Pods (im aktuellen Namespace)<br>
<code>kubectl describe pod &lt;name&gt;</code> – alle Details zu einem Pod<br>
<code>kubectl get pods -n kube-system</code> – Pods im Namespace <i>kube-system</i>, wo Kubernetes seine eigenen Systemteile laufen lässt</p>
<div class="merke">⚓ <b>Merksatz:</b> Cluster = Hafen, Node = Kai, Pod = kleinste Einheit (meist 1 Container). kubectl ist dein Funkgerät.</div>`,
            },
          ],
        },
        {
          type: "quiz",
          items: [
            {
              id: "q-ch2-1",
              q: "Wofür braucht man Kubernetes überhaupt, wenn es doch Docker gibt?",
              options: [
                "Kubernetes verwaltet viele Container auf vielen Servern automatisch: neu starten, verteilen, skalieren.",
                "Kubernetes ersetzt Docker, weil Docker veraltet ist.",
                "Kubernetes macht Container kleiner und schneller.",
                "Kubernetes ist nur eine grafische Oberfläche für Docker.",
              ],
              correct: 0,
              explain: "Docker startet Container, Kubernetes orchestriert sie in großem Stil – wie eine Hafenmeisterei für hunderte Container.",
            },
            {
              id: "q-ch2-2",
              q: "Was ist ein Pod?",
              options: [
                "Die kleinste Einheit in Kubernetes – enthält meist genau einen Container.",
                "Ein anderes Wort für einen Server im Cluster.",
                "Eine Gruppe von mindestens zehn Containern.",
                "Das Konfigurationsformat von Kubernetes.",
              ],
              correct: 0,
              explain: "Pod = kleinster Liegeplatz. Kubernetes verwaltet nie Container direkt, sondern immer Pods.",
            },
            {
              id: "q-ch2-3",
              q: "Was ist ein Node?",
              options: [
                "Ein einzelner Server (Rechner), der zum Cluster gehört und Pods ausführt.",
                "Ein Backup des Clusters.",
                "Ein spezieller Pod für Datenbanken.",
                "Das Netzwerkkabel zwischen zwei Clustern.",
              ],
              correct: 0,
              explain: "Im Hafenbild: ein Kai. Mehrere Nodes zusammen bilden den Cluster (den Hafen).",
            },
            {
              id: "q-ch2-4",
              q: "Ein Container in einem Pod stürzt nachts um 3 Uhr ab. Was passiert?",
              options: [
                "Kubernetes merkt es und startet automatisch Ersatz – ohne dass jemand aufstehen muss.",
                "Der Admin bekommt einen Anruf und muss ihn von Hand neu starten.",
                "Der Pod bleibt kaputt, bis morgens jemand ins Büro kommt.",
                "Der ganze Cluster fährt sicherheitshalber herunter.",
              ],
              correct: 0,
              explain: "Genau dafür gibt es Kubernetes: Es überwacht den Soll-Zustand und stellt ihn automatisch wieder her. Das nennt man Self-Healing.",
            },
            {
              id: "q-ch2-5",
              q: "Wofür steht die Abkürzung „K8s“?",
              options: [
                "Kubernetes – K, dann 8 Buchstaben, dann s.",
                "Kubernetes Version 8.",
                "Kubernetes mit 8 Nodes.",
                "Ein anderes Produkt, das mit Kubernetes konkurriert.",
              ],
              correct: 0,
              explain: "Solche Abkürzungen heißen Numeronyme. Es gibt auch i18n (internationalization) und o11y (observability).",
            },
          ],
        },
        {
          type: "terminal",
          intro: "Du bekommst Zugang zu deinem ersten Cluster! Drei Nodes, und es laufen schon ein paar Pods einer Bord-Kantine-App. Schau dich um, Leichtmatrosin.",
          scenario: {
            deployments: [{ name: "kantine", image: "nginx:1.27", replicas: 2 }],
          },
          tasks: [
            {
              id: "t-ch2-1",
              text: "Verschaff dir erstmal einen Überblick: Welche Server (Nodes) gehören zu deinem Cluster?",
              accept: [/^kubectl\s+get\s+(nodes|node|no)$/],
              hint: "kubectl get <ressourcentyp> – und Server heißen hier Nodes.",
              solution: "kubectl get nodes",
            },
            {
              id: "t-ch2-2",
              text: "Jetzt zur Fracht: Lass dir alle Pods anzeigen.",
              accept: [/^kubectl\s+get\s+(pods|pod|po)$/],
              hint: "Gleiches Muster wie eben, nur ein anderer Ressourcentyp.",
              solution: "kubectl get pods",
            },
            {
              id: "t-ch2-3",
              text: "Schau dir einen der <code>kantine</code>-Pods genauer an – mit allen Details. (Den Pod-Namen kannst du oben aus der Ausgabe abtippen.)",
              accept: [/^kubectl\s+describe\s+pods?\s+kantine-\S+$/],
              hint: "„Beschreiben“ heißt auf Englisch describe. Muster: kubectl describe pod <pod-name>",
              solution: "kubectl describe pod <name aus der Liste>",
            },
            {
              id: "t-ch2-4",
              text: "Kubernetes selbst besteht auch aus Pods! Die verstecken sich im Namespace <code>kube-system</code>. Lass sie dir anzeigen.",
              accept: [/^kubectl\s+get\s+(pods|pod|po)\s+(-n|--namespace)[=\s]?kube-system$/],
              hint: "Mit -n <namespace> schaust du in einen anderen Namespace. Muster: kubectl get pods -n kube-system",
              solution: "kubectl get pods -n kube-system",
            },
          ],
        },
      ],
    },

    /* ============ Kapitel 3: Deployments & Services ============ */
    {
      id: "ch3",
      icon: "⚙️",
      title: "Volle Fahrt – Deployments & Services",
      sub: "Self-Healing, Skalieren und feste Adressen für deine Pods.",
      steps: [
        {
          type: "lesson",
          title: "Deployments & Services",
          cards: [
            {
              icon: "💀",
              html: `<p>Eine unbequeme Wahrheit: <b>Pods sind sterblich.</b> Sie stürzen ab, werden bei Updates ersetzt, verschwinden, wenn ein Node ausfällt. Einzelne Pods von Hand zu pflegen wäre Sisyphusarbeit.</p>
<p>Deshalb erstellt man Pods fast nie direkt. Stattdessen gibt man einen Dauerauftrag: ein <b>Deployment</b>.</p>
<p>Ein Deployment sagt: <i>„Halte <b>immer</b> 3 Kopien dieses Pods am Laufen.“</i> Stirbt einer, wird sofort Ersatz gestartet (<b>Self-Healing</b>). Willst du 5 statt 3, änderst du nur die Zahl (<b>Skalieren</b>).</p>`,
            },
            {
              icon: "🛠️",
              html: `<p>Die Befehle dazu:</p>
<p><code>kubectl create deployment kasse --image=nginx</code> – erstellt ein Deployment namens <i>kasse</i><br>
<code>kubectl get deployments</code> – zeigt alle Deployments<br>
<code>kubectl scale deployment kasse --replicas=3</code> – skaliert auf 3 Kopien<br>
<code>kubectl delete pod &lt;name&gt;</code> – tötet einen Pod … aber das Deployment ersetzt ihn sofort! 😈</p>`,
            },
            {
              icon: "📬",
              html: `<p>Ein Problem bleibt: Pods bekommen bei jeder Neugeburt einen <b>neuen Namen und eine neue IP</b>. Wie sollen andere Apps sie da erreichen?</p>
<p>Die Lösung: ein <b>Service</b> – eine feste Adresse, die immer auf die gerade lebenden Pods zeigt. Wie ein Empfangstresen: Die Person dahinter wechselt, aber der Tresen bleibt am selben Ort.</p>
<p><code>kubectl expose deployment kasse --port=80</code> – stellt einen Service vor das Deployment<br>
<code>kubectl get services</code> – zeigt alle Services</p>
<div class="merke">⚓ <b>Merksatz:</b> Deployment = „halte N Kopien am Laufen“ (Self-Healing + Skalieren). Service = feste Adresse vor wechselnden Pods.</div>`,
            },
          ],
        },
        {
          type: "quiz",
          items: [
            {
              id: "q-ch3-1",
              q: "Warum erstellt man Pods praktisch nie direkt, sondern über ein Deployment?",
              options: [
                "Weil Pods sterblich sind – das Deployment ersetzt tote Pods automatisch und hält die gewünschte Anzahl.",
                "Weil einzelne Pods mehr Speicher verbrauchen.",
                "Weil man Pods nur mit Admin-Rechten erstellen darf.",
                "Direkte Pods sind seit Kubernetes 1.20 verboten.",
              ],
              correct: 0,
              explain: "Das Deployment ist der Dauerauftrag: „Halte immer N Kopien am Laufen.“ Stirbt ein Pod, kommt sofort Ersatz – Self-Healing.",
            },
            {
              id: "q-ch3-2",
              q: "Du löschst einen Pod, der zu einem Deployment mit <code>replicas: 3</code> gehört. Was passiert?",
              options: [
                "Kubernetes startet sofort einen neuen Pod – es sollen ja 3 sein.",
                "Es laufen ab jetzt dauerhaft nur noch 2 Pods.",
                "Das Deployment wird ungültig und muss neu erstellt werden.",
                "Kubernetes fragt erst nach, ob das Absicht war.",
              ],
              correct: 0,
              explain: "Kubernetes vergleicht ständig Soll (3) und Ist (2) – und behebt die Differenz automatisch. Du wirst das gleich im Terminal live sehen!",
            },
            {
              id: "q-ch3-3",
              q: "Wozu braucht man einen Service?",
              options: [
                "Als feste, stabile Adresse vor den Pods – deren Namen und IPs ändern sich ja ständig.",
                "Um Pods schneller zu machen.",
                "Um Deployments zu sichern (Backup).",
                "Services starten abgestürzte Nodes neu.",
              ],
              correct: 0,
              explain: "Der Empfangstresen: Wer die kasse-App erreichen will, redet mit dem Service – der leitet an die gerade lebenden Pods weiter.",
            },
            {
              id: "q-ch3-4",
              q: "Mit welchem Befehl machst du aus 1 Kopie deines Deployments <code>kasse</code> 5 Kopien?",
              options: [
                "kubectl scale deployment kasse --replicas=5",
                "kubectl resize kasse 5",
                "kubectl copy deployment kasse 5",
                "kubectl create deployment kasse --image=nginx (5x ausführen)",
              ],
              correct: 0,
              explain: "scale + --replicas=N. Kubernetes startet die fehlenden 4 Pods automatisch.",
            },
          ],
        },
        {
          type: "terminal",
          intro: "Heute baust du selbst! Auftrag der Kapitänin: Eine Kassen-App soll an Bord – ausfallsicher und mit fester Adresse. Der Cluster ist noch leer.",
          scenario: {},
          tasks: [
            {
              id: "t-ch3-1",
              text: "Erstelle ein Deployment namens <code>kasse</code> mit dem Image <code>nginx</code>.",
              accept: [/^kubectl\s+create\s+deployment\s+kasse\s+--image[=\s]nginx(:\S+)?$/],
              hint: "Muster: kubectl create deployment <name> --image=<image>",
              solution: "kubectl create deployment kasse --image=nginx",
            },
            {
              id: "t-ch3-2",
              text: "Eine Kasse ist zu wenig, wenn die Crew Hunger hat. Skaliere auf <b>3</b> Kopien.",
              accept: [/^kubectl\s+scale\s+deployment\s+kasse\s+--replicas[=\s]3$/],
              hint: "Muster: kubectl scale deployment <name> --replicas=<zahl>",
              solution: "kubectl scale deployment kasse --replicas=3",
            },
            {
              id: "t-ch3-3",
              text: "Prüfe nach: Laufen jetzt wirklich 3 <code>kasse</code>-Pods?",
              accept: [/^kubectl\s+get\s+(pods|pod|po)$/],
              check: sim => {
                const d = sim.deployments.find(d => d.name === "kasse");
                return d && d.replicas === 3;
              },
              hint: "Der Übersichts-Befehl für Pods – kennst du schon aus Kapitel 2.",
              solution: "kubectl get pods",
            },
            {
              id: "t-ch3-4",
              text: "Jetzt der Härtetest! 💥 Lösche einen der drei <code>kasse</code>-Pods (Name aus der Liste oben).",
              accept: [/^kubectl\s+delete\s+pods?\s+kasse-\S+$/],
              hint: "Muster: kubectl delete pod <pod-name>",
              solution: "kubectl delete pod <ein kasse-pod-name>",
            },
            {
              id: "t-ch3-5",
              text: "Und nun das Self-Healing-Wunder: Schau dir die Pods nochmal an. Es sollten wieder 3 sein – einer davon ganz frisch (kleines AGE)!",
              accept: [/^kubectl\s+get\s+(pods|pod|po)$/],
              check: sim => sim.lastDeletedPod !== null,
              hint: "Einfach nochmal die Pod-Liste anzeigen.",
              solution: "kubectl get pods",
            },
            {
              id: "t-ch3-6",
              text: "Zum Schluss die feste Adresse: Stelle einen Service vor das Deployment <code>kasse</code>, Port <b>80</b>.",
              accept: [/^kubectl\s+expose\s+deployment\s+kasse\s+--port[=\s]80(\s.*)?$/],
              hint: "„Nach außen stellen“ heißt expose. Muster: kubectl expose deployment <name> --port=80",
              solution: "kubectl expose deployment kasse --port=80",
            },
            {
              id: "t-ch3-7",
              text: "Kontrollblick: Zeig die Services an. Dein <code>kasse</code>-Service sollte da sein – mit einer festen CLUSTER-IP.",
              accept: [/^kubectl\s+get\s+(services|service|svc)$/],
              check: sim => sim.services.some(s => s.name === "kasse"),
              hint: "kubectl get … wie hieß der Ressourcentyp? (Kurzform svc geht auch.)",
              solution: "kubectl get services",
            },
          ],
        },
      ],
    },

    /* ============ Kapitel 4: YAML & deklarativ ============ */
    {
      id: "ch4",
      icon: "🗺️",
      title: "Seekarten – YAML & Manifeste",
      sub: "Nicht mehr Befehle rufen, sondern den Wunschzustand aufschreiben.",
      steps: [
        {
          type: "lesson",
          title: "Deklarativ arbeiten mit YAML",
          cards: [
            {
              icon: "🍝",
              html: `<p>Bisher hast du dem Cluster <b>Befehle zugerufen</b>: „Erstelle dies! Skaliere das!“ Das nennt man <b>imperativ</b> – wie einem Koch jeden Handgriff einzeln zu diktieren.</p>
<p>Profis arbeiten <b>deklarativ</b>: Sie schreiben den <b>Wunschzustand</b> in eine Datei – wie eine Bestellung im Restaurant. „Ich hätte gern: Deployment <i>lager</i>, 2 Kopien, Image redis.“ Den Rest macht die Küche.</p>
<p>Der Riesenvorteil: Die Datei kann in <b>Git</b> liegen! Jede Änderung nachvollziehbar, jederzeit wiederherstellbar, im Team teilbar.</p>`,
            },
            {
              icon: "📜",
              html: `<p>Diese Dateien heißen <b>Manifeste</b> und sind in <b>YAML</b> geschrieben – einem Format, das von <b>Einrückung</b> lebt (wie Python). Die Grundregeln:</p>
<p><code>schluessel: wert</code> – Paare aus Schlüssel und Wert<br>
Einrückung mit <b>Leerzeichen</b> (niemals Tabs!) zeigt, was wozu gehört<br>
<code>- eintrag</code> – Listen beginnen mit einem Bindestrich</p>
<p>Jedes Kubernetes-Manifest hat 4 Stamm-Elemente:<br>
<code>apiVersion</code> – Version der API<br>
<code>kind</code> – <b>was</b> es ist (Deployment, Service, …)<br>
<code>metadata</code> – Name & Labels<br>
<code>spec</code> – der Wunschzustand im Detail</p>`,
            },
            {
              icon: "✨",
              html: `<p>Und der Zauberbefehl, der die Datei zum Cluster bringt:</p>
<p><code>kubectl apply -f deployment.yaml</code></p>
<p>„apply“ heißt: <i>„Lieber Cluster, stelle her, was in dieser Datei steht.“</i> Existiert es schon? Wird angepasst. Existiert es nicht? Wird erstellt. Du kannst apply gefahrlos mehrfach ausführen – es passiert immer nur, was nötig ist.</p>
<div class="merke">⚓ <b>Merksatz:</b> Imperativ = Befehle rufen. Deklarativ = Wunschzustand in YAML-Datei + <code>kubectl apply -f</code>. Deklarativ gewinnt, weil die Datei in Git leben kann.</div>`,
            },
          ],
        },
        {
          type: "quiz",
          items: [
            {
              id: "q-ch4-1",
              q: "Was ist der Unterschied zwischen imperativ und deklarativ?",
              options: [
                "Imperativ = einzelne Befehle rufen. Deklarativ = Wunschzustand in eine Datei schreiben, das System stellt ihn her.",
                "Imperativ ist für Linux, deklarativ für Windows.",
                "Deklarativ ist die kommandozeilen-freie Variante mit Maus und Klicks.",
                "Es gibt keinen Unterschied, nur zwei Fachwörter.",
              ],
              correct: 0,
              explain: "Koch-Diktat vs. Restaurant-Bestellung. Deklarativ ist der Standard in der Profi-Welt, weil die Dateien in Git versioniert werden können.",
            },
            {
              id: "q-ch4-2",
              q: "Was gibt das Feld <code>kind</code> in einem Manifest an?",
              options: [
                "Welche Art von Ressource beschrieben wird – z.B. Deployment oder Service.",
                "Wie freundlich (kind) der Cluster antworten soll.",
                "Die Kubernetes-Version.",
                "Den Namen des Erstellers.",
              ],
              correct: 0,
              explain: "kind: Deployment, kind: Service, kind: Pod … es bestimmt, was die Datei überhaupt beschreibt.",
            },
            {
              id: "q-ch4-3",
              q: "Worauf musst du bei YAML besonders achten?",
              options: [
                "Auf die Einrückung mit Leerzeichen – sie bestimmt, was wozu gehört. Tabs sind verboten.",
                "Auf Großschreibung aller Schlüssel.",
                "Dass jede Zeile mit einem Semikolon endet.",
                "Dass die Datei maximal 100 Zeilen hat.",
              ],
              correct: 0,
              explain: "YAML lebt von Einrückung wie Python. Ein Leerzeichen zu viel oder zu wenig = Fehler. Und: niemals Tabs!",
            },
            {
              id: "q-ch4-4",
              q: "Du führst <code>kubectl apply -f app.yaml</code> zweimal hintereinander aus. Was passiert beim zweiten Mal?",
              options: [
                "Nichts Schlimmes – Kubernetes sieht, dass alles schon stimmt, und meldet „unchanged“.",
                "Es entsteht eine zweite Kopie aller Ressourcen.",
                "Fehler: apply darf nur einmal ausgeführt werden.",
                "Die Ressourcen werden gelöscht und neu erstellt.",
              ],
              correct: 0,
              explain: "apply gleicht immer Soll (Datei) mit Ist (Cluster) ab und tut nur das Nötige. Mehrfaches Ausführen ist völlig harmlos – das nennt man idempotent.",
            },
          ],
        },
        {
          type: "terminal",
          intro: "Eine Kollegin hat dir zwei fertige Manifeste in den Ordner gelegt: eine Lager-App (Redis) samt Service. Dein Job: anschauen, verstehen, anwenden.",
          scenario: {
            files: { "deployment.yaml": DEPLOYMENT_YAML, "service.yaml": SERVICE_YAML },
            applyEffects: {
              "deployment.yaml": { deployment: { name: "lager", image: "redis:7", replicas: 2 } },
              "service.yaml": { service: { name: "lager", port: "6379" } },
            },
          },
          tasks: [
            {
              id: "t-ch4-1",
              text: "Schau zuerst nach, welche Dateien im Ordner liegen.",
              accept: [/^ls$/],
              hint: "Der klassische Linux-Befehl zum Auflisten von Dateien, zwei Buchstaben.",
              solution: "ls",
            },
            {
              id: "t-ch4-2",
              text: "Wirf einen Blick in die Datei <code>deployment.yaml</code>. Findest du <code>kind</code>, <code>replicas</code> und das Image?",
              accept: [/^cat\s+deployment\.yaml$/],
              hint: "Dateien anzeigen geht mit cat <datei>.",
              solution: "cat deployment.yaml",
            },
            {
              id: "t-ch4-3",
              text: "Jetzt deklarativ! Wende <code>deployment.yaml</code> auf den Cluster an.",
              accept: [/^kubectl\s+apply\s+-f\s+deployment\.yaml$/],
              hint: "Der Zauberbefehl aus der Lektion: kubectl apply -f <datei>",
              solution: "kubectl apply -f deployment.yaml",
            },
            {
              id: "t-ch4-4",
              text: "Wende auch <code>service.yaml</code> an.",
              accept: [/^kubectl\s+apply\s+-f\s+service\.yaml$/],
              hint: "Gleicher Befehl, andere Datei.",
              solution: "kubectl apply -f service.yaml",
            },
            {
              id: "t-ch4-5",
              text: "Prüfe das Ergebnis: Wie viele <code>lager</code>-Pods laufen? (In der Datei standen <code>replicas: 2</code> …)",
              accept: [/^kubectl\s+get\s+(pods|pod|po)$/],
              check: sim => {
                const d = sim.deployments.find(d => d.name === "lager");
                return d && d.replicas === 2;
              },
              hint: "Pods anzeigen – das kannst du längst!",
              solution: "kubectl get pods",
            },
            {
              id: "t-ch4-6",
              text: "Führe <code>kubectl apply -f deployment.yaml</code> gleich nochmal aus – und beobachte, dass NICHTS Doppeltes entsteht („unchanged“).",
              accept: [/^kubectl\s+apply\s+-f\s+deployment\.yaml$/],
              hint: "Wirklich einfach nochmal denselben apply-Befehl.",
              solution: "kubectl apply -f deployment.yaml",
            },
          ],
        },
      ],
    },

    /* ============ Kapitel 5: Helm ============ */
    {
      id: "ch5",
      icon: "☸️",
      title: "Das Steuerrad – Helm",
      sub: "Nein, nicht das Ding auf dem Kopf. Der Paketmanager für Kubernetes!",
      steps: [
        {
          type: "lesson",
          title: "Was ist Helm wirklich?",
          cards: [
            {
              icon: "⛑️",
              html: `<p>Räumen wir erstmal auf: <b>Helm hat nichts mit Kopfschutz zu tun.</b> 😄</p>
<p>„Helm“ ist Englisch für das <b>Steuerrad eines Schiffes</b> – passend zum Steuermann Kubernetes. Schau dir mal das Helm-Logo an: ein Steuerrad!</p>
<p>Und was <b>ist</b> es nun? <b>Helm ist der Paketmanager für Kubernetes.</b> So wie du auf dem Handy einen App-Store hast, statt Apps aus 30 Einzeldateien zusammenzubauen, gibt dir Helm fertige Pakete für Kubernetes.</p>`,
            },
            {
              icon: "🤯",
              html: `<p>Warum braucht man das? In Kapitel 4 hattest du <b>zwei</b> YAML-Dateien für eine Mini-App. Eine <b>echte</b> Anwendung braucht schnell 10, 20, 30 Manifeste – Deployments, Services, ConfigMaps, Secrets, …</p>
<p>Und jetzt stell dir vor, du brauchst die App dreimal: für Entwicklung, Test und Produktion – jeweils leicht anders (mal 1 Kopie, mal 10). Dreißig Dateien dreimal kopieren und anpassen? Bloß nicht!</p>`,
            },
            {
              icon: "📦",
              html: `<p>Helms Lösung – drei Begriffe musst du kennen:</p>
<p><b>Chart</b> = das Paket: alle Manifeste einer App gebündelt, als Vorlage mit Platzhaltern.<br>
<b>Values</b> = die Drehknöpfe: eine Datei (<code>values.yaml</code>) mit allen einstellbaren Werten (z.B. <code>replicaCount</code>). Gleiche Vorlage, andere Werte → andere Umgebung.<br>
<b>Release</b> = eine <b>installierte Instanz</b> eines Charts in deinem Cluster, mit eigenem Namen. Ein Chart, beliebig viele Releases.</p>
<p>Und woher kommen Charts? Aus <b>Repos</b> – Chart-Sammlungen, wie Docker Hub für Images.</p>`,
            },
            {
              icon: "⎈",
              html: `<p>Die wichtigsten Befehle:</p>
<p><code>helm repo add bitnami https://charts.bitnami.com/bitnami</code> – Repo hinzufügen<br>
<code>helm repo update</code> – Repo-Infos aktualisieren<br>
<code>helm search repo nginx</code> – Charts suchen<br>
<code>helm install mein-web bitnami/nginx</code> – Chart als Release „mein-web“ installieren<br>
<code>helm list</code> – installierte Releases anzeigen<br>
<code>helm upgrade mein-web bitnami/nginx --set replicaCount=3</code> – Release ändern<br>
<code>helm rollback mein-web 1</code> – zurück zu Revision 1, wenn was schiefging!<br>
<code>helm uninstall mein-web</code> – Release samt allem wieder entfernen</p>
<div class="merke">⚓ <b>Merksatz:</b> Helm = Paketmanager für K8s. Chart = Paket/Vorlage, Values = Drehknöpfe, Release = installierte Instanz mit Revisions-Historie.</div>`,
            },
          ],
        },
        {
          type: "quiz",
          items: [
            {
              id: "q-ch5-1",
              q: "Was ist Helm?",
              options: [
                "Der Paketmanager für Kubernetes – installiert komplette Anwendungen als fertige Pakete (Charts).",
                "Eine Schutzausrüstung für Rechenzentrums-Mitarbeitende.",
                "Ein Konkurrenzprodukt zu Kubernetes.",
                "Das Monitoring-Dashboard von Kubernetes.",
              ],
              correct: 0,
              explain: "Helm = Steuerrad (passend zum Steuermann Kubernetes) und der „App-Store“ für K8s-Anwendungen.",
            },
            {
              id: "q-ch5-2",
              q: "Was ist der Unterschied zwischen Chart und Release?",
              options: [
                "Chart = das Paket (die Vorlage), Release = eine konkrete installierte Instanz davon im Cluster.",
                "Release = die Vorlage, Chart = die Installation.",
                "Charts sind kostenlos, Releases kosten Geld.",
                "Kein Unterschied – zwei Namen für dasselbe.",
              ],
              correct: 0,
              explain: "Wie Image und Container bei Docker! Chart = Vorlage, Release = laufende Instanz. Aus einem Chart kannst du mehrere Releases installieren.",
            },
            {
              id: "q-ch5-3",
              q: "Wozu dient die Datei <code>values.yaml</code> in einem Chart?",
              options: [
                "Sie enthält die einstellbaren Werte (Drehknöpfe) – z.B. Anzahl Kopien – ohne die Vorlage selbst zu ändern.",
                "Sie listet auf, wie wertvoll (teuer) das Chart ist.",
                "Sie speichert die Passwörter des Clusters.",
                "Sie ist das Änderungsprotokoll des Charts.",
              ],
              correct: 0,
              explain: "Gleiche Vorlage, verschiedene Values = Entwicklung, Test und Produktion aus einem einzigen Chart. Mit --set überschreibst du Werte direkt beim Installieren.",
            },
            {
              id: "q-ch5-4",
              q: "Dein <code>helm upgrade</code> hat alles kaputt gemacht. Panik?",
              options: [
                "Nein – helm rollback bringt das Release auf eine frühere Revision zurück.",
                "Ja – jetzt hilft nur noch Cluster löschen und neu aufsetzen.",
                "Man muss alle YAML-Dateien von Hand zurückändern.",
                "helm uninstall und alles neu installieren ist der einzige Weg.",
              ],
              correct: 0,
              explain: "Helm führt für jedes Release eine Revisions-Historie. rollback ist eines der stärksten Argumente für Helm!",
            },
            {
              id: "q-ch5-5",
              q: "Warum nutzt man Helm statt 30 einzelne YAML-Dateien mit kubectl apply?",
              options: [
                "Helm bündelt alles zu einem Paket mit Drehknöpfen (values) – installierbar, upgradebar und zurückrollbar mit je einem Befehl.",
                "Weil kubectl apply maximal 5 Dateien verarbeiten kann.",
                "YAML-Dateien sind in neuen Kubernetes-Versionen verboten.",
                "Helm ist die einzige Möglichkeit, Images herunterzuladen.",
              ],
              correct: 0,
              explain: "Statt 30 Dateien × 3 Umgebungen zu pflegen: ein Chart, drei values-Varianten. Und Upgrade/Rollback gibt's geschenkt dazu.",
            },
          ],
        },
        {
          type: "terminal",
          intro: "Die Kapitänin wünscht sich einen Webserver an Bord – und zwar heute noch. Zum Glück gibt es dafür ein fertiges Chart. Zeig, dass du das Steuerrad beherrschst, Steuerfrau!",
          scenario: {},
          tasks: [
            {
              id: "t-ch5-1",
              text: "Füge zuerst das bekannte Chart-Repo <code>bitnami</code> hinzu (URL: <code>https://charts.bitnami.com/bitnami</code>).",
              accept: [/^helm\s+repo\s+add\s+bitnami\s+https:\/\/charts\.bitnami\.com\/bitnami$/],
              hint: "Muster: helm repo add <name> <url>",
              solution: "helm repo add bitnami https://charts.bitnami.com/bitnami",
            },
            {
              id: "t-ch5-2",
              text: "Aktualisiere die Repo-Informationen.",
              accept: [/^helm\s+repo\s+update$/],
              hint: "Auch das geht über helm repo …",
              solution: "helm repo update",
            },
            {
              id: "t-ch5-3",
              text: "Suche in den Repos nach einem <code>nginx</code>-Chart.",
              accept: [/^helm\s+search\s+repo\s+nginx$/],
              hint: "Muster: helm search repo <suchwort>",
              solution: "helm search repo nginx",
            },
            {
              id: "t-ch5-4",
              text: "Installiere das Chart <code>bitnami/nginx</code> als Release mit dem Namen <code>mein-web</code>.",
              accept: [/^helm\s+install\s+mein-web\s+bitnami\/nginx$/],
              hint: "Muster: helm install <release-name> <repo>/<chart>",
              solution: "helm install mein-web bitnami/nginx",
            },
            {
              id: "t-ch5-5",
              text: "Lass dir alle installierten Releases anzeigen.",
              accept: [/^helm\s+(list|ls)$/],
              hint: "Der Befehl heißt wie das englische Wort für „auflisten“.",
              solution: "helm list",
            },
            {
              id: "t-ch5-6",
              text: "Spannend: Was hat Helm da eigentlich in den Cluster gebaut? Schau mit <b>kubectl</b> nach den Pods!",
              accept: [/^kubectl\s+get\s+(pods|pod|po)$/],
              check: sim => sim.releases.length > 0,
              hint: "Helm erzeugt ganz normale Kubernetes-Ressourcen. Du kennst den Befehl.",
              solution: "kubectl get pods",
            },
            {
              id: "t-ch5-7",
              text: "Upgrade! Stelle das Release per <code>--set replicaCount=3</code> auf 3 Kopien um.",
              accept: [/^helm\s+upgrade\s+mein-web\s+bitnami\/nginx\s+--set\s+replicaCount=3$/],
              hint: "Muster: helm upgrade <release> <chart> --set replicaCount=3",
              solution: "helm upgrade mein-web bitnami/nginx --set replicaCount=3",
            },
            {
              id: "t-ch5-8",
              text: "Ups – Befehl von oben: doch wieder zurück! Rolle das Release auf Revision <b>1</b> zurück.",
              accept: [/^helm\s+rollback\s+mein-web(\s+1)?$/],
              hint: "Muster: helm rollback <release> <revision>",
              solution: "helm rollback mein-web 1",
            },
            {
              id: "t-ch5-9",
              text: "Übung beendet: Deinstalliere das Release <code>mein-web</code> komplett.",
              accept: [/^helm\s+uninstall\s+mein-web$/],
              hint: "Das Gegenteil von install …",
              solution: "helm uninstall mein-web",
            },
          ],
        },
      ],
    },

    /* ============ Kapitel 6: Terraform ============ */
    {
      id: "ch6",
      icon: "🏗️",
      title: "Land in Sicht – Terraform",
      sub: "Wer baut eigentlich den Hafen selbst? Infrastructure as Code!",
      steps: [
        {
          type: "lesson",
          title: "Infrastructure as Code mit Terraform",
          cards: [
            {
              icon: "🏝️",
              html: `<p>Bisher hast du Dinge <b>im</b> Cluster verwaltet. Aber mal ehrlich: Wo kommt der Cluster eigentlich her? Die Server, die Netzwerke, die Datenbanken, der Speicher in der Cloud?</p>
<p>Früher hat man das <b>zusammengeklickt</b> – in irgendeiner Cloud-Weboberfläche. Das Problem: Nach einem Jahr weiß niemand mehr, wer was warum geklickt hat. Und ein zweites, identisches Setup für die Testumgebung? Viel Spaß beim Nachklicken …</p>`,
            },
            {
              icon: "📐",
              html: `<p>Die Lösung kennst du schon im Kleinen aus Kapitel 4: <b>Den Wunschzustand in eine Datei schreiben!</b></p>
<p>Genau das ist <b>Infrastructure as Code (IaC)</b>: die gesamte Infrastruktur – Server, Netze, Datenbanken – als Text beschreiben. Und <b>Terraform</b> ist das bekannteste Werkzeug dafür.</p>
<p>Terraform-Dateien (Endung <code>.tf</code>) sind in der Sprache <b>HCL</b> geschrieben. Das Herzstück sind <code>resource</code>-Blöcke: <i>„Es soll ein Netzwerk geben, es sollen 2 Server geben, …“</i></p>
<p>Die Parallele zu Kubernetes ist kein Zufall – auch Terraform ist <b>deklarativ</b>. Nur das Einsatzgebiet ist anders: Kubernetes verwaltet Container <b>im</b> Cluster, Terraform baut die Welt <b>drumherum</b>.</p>`,
            },
            {
              icon: "🔄",
              html: `<p>Der Terraform-Arbeitszyklus – drei Schritte, immer gleich:</p>
<p><b>1. <code>terraform init</code></b> – einmalig pro Projekt: lädt die nötigen Plugins (Provider)<br>
<b>2. <code>terraform plan</code></b> – die Generalprobe: zeigt, <b>was</b> Terraform tun <i>würde</i>, ohne es zu tun. Immer erst lesen!<br>
<b>3. <code>terraform apply</code></b> – führt den Plan wirklich aus und baut die Infrastruktur</p>
<p>Und zum Abreißen: <code>terraform destroy</code> – entfernt alles wieder, was Terraform gebaut hat.</p>`,
            },
            {
              icon: "🧠",
              html: `<p>Ein letztes wichtiges Konzept: der <b>State</b>.</p>
<p>Terraform führt Buch darüber, was es schon gebaut hat – in einer State-Datei, seinem <b>Gedächtnis</b>. Beim nächsten <code>plan</code> vergleicht es: Was steht in den .tf-Dateien (Soll)? Was steht im State (Ist)? Nur die <b>Differenz</b> wird umgesetzt.</p>
<p>Deshalb meldet ein zweites <code>plan</code> nach erfolgreichem <code>apply</code>: <i>„No changes.“</i> – alles schon da. Mit <code>terraform state list</code> siehst du, was im Gedächtnis steht.</p>
<div class="merke">⚓ <b>Merksatz:</b> Terraform = Infrastruktur als Code. Zyklus: init → plan → apply. Der State ist Terraforms Gedächtnis – plan zeigt immer nur die Differenz zwischen Soll und Ist.</div>`,
            },
          ],
        },
        {
          type: "quiz",
          items: [
            {
              id: "q-ch6-1",
              q: "Was bedeutet „Infrastructure as Code“ (IaC)?",
              options: [
                "Server, Netze & Co. werden als Textdateien beschrieben statt in Weboberflächen zusammengeklickt.",
                "Programme laufen direkt auf der Hardware ohne Betriebssystem.",
                "Die Infrastruktur schreibt ihren eigenen Code.",
                "Rechenzentren werden durch Software komplett ersetzt.",
              ],
              correct: 0,
              explain: "Der Riesenvorteil: Die Dateien liegen in Git – nachvollziehbar, wiederholbar, im Team teilbar. Identische Testumgebung? Ein apply entfernt.",
            },
            {
              id: "q-ch6-2",
              q: "Was ist der Unterschied zwischen <code>terraform plan</code> und <code>terraform apply</code>?",
              options: [
                "plan zeigt nur an, was passieren würde (Generalprobe) – apply führt es wirklich aus.",
                "plan ist für kleine, apply für große Infrastruktur.",
                "apply zeigt den Plan, plan wendet ihn an.",
                "Kein Unterschied, apply ist nur die Kurzform.",
              ],
              correct: 0,
              explain: "Immer erst plan lesen, dann apply! Die Generalprobe zeigt dir, ob Terraform das vorhat, was du wolltest – bevor irgendetwas passiert.",
            },
            {
              id: "q-ch6-3",
              q: "Was ist der Terraform-State?",
              options: [
                "Terraforms Gedächtnis: eine Datei, die festhält, was Terraform bereits gebaut hat.",
                "Der aktuelle Bundesstaat des Rechenzentrums.",
                "Eine Statusanzeige, ob Terraform installiert ist.",
                "Das Fehlerprotokoll von Terraform.",
              ],
              correct: 0,
              explain: "Dank State kann Terraform Soll (deine .tf-Dateien) mit Ist (was existiert) vergleichen und nur die Differenz umsetzen.",
            },
            {
              id: "q-ch6-4",
              q: "Du führst direkt nach einem erfolgreichen <code>apply</code> nochmal <code>terraform plan</code> aus. Was passiert?",
              options: [
                "„No changes.“ – alles aus den Dateien existiert ja schon genau so.",
                "Terraform baut alles ein zweites Mal.",
                "Fehler: plan darf nach apply nicht mehr ausgeführt werden.",
                "Terraform löscht die Infrastruktur und plant neu.",
              ],
              correct: 0,
              explain: "Deklarativ eben: Soll = Ist → nichts zu tun. Genau wie kubectl apply zum zweiten Mal („unchanged“).",
            },
            {
              id: "q-ch6-5",
              q: "Kubernetes und Terraform sind beide deklarativ. Was unterscheidet ihre Einsatzgebiete?",
              options: [
                "Kubernetes verwaltet Container im Cluster – Terraform baut die Infrastruktur drumherum (Server, Netze, auch den Cluster selbst).",
                "Terraform ist nur für Windows-Server, Kubernetes für Linux.",
                "Kubernetes ist das neue Terraform und ersetzt es.",
                "Terraform verwaltet nur Datenbanken.",
              ],
              correct: 0,
              explain: "Sie ergänzen sich: Terraform baut den Hafen (Cluster, Netze, Server), Kubernetes betreibt den Verkehr darin. In vielen Teams baut Terraform sogar den K8s-Cluster.",
            },
          ],
        },
        {
          type: "terminal",
          intro: "Großprojekt: Ein neuer Hafen (= die Infrastruktur für einen zukünftigen Cluster) soll entstehen! Die Beschreibung liegt schon als main.tf im Ordner. Du musst sie nur noch Wirklichkeit werden lassen, Erste Offizierin.",
          scenario: {
            files: { "main.tf": MAIN_TF },
            tfResources: [
              { addr: "hafen_netzwerk.haupthafen", desc: 'name = "haupthafen-netz"' },
              { addr: "hafen_server.worker[0]", desc: 'name = "worker-1"' },
              { addr: "hafen_server.worker[1]", desc: 'name = "worker-2"' },
            ],
          },
          tasks: [
            {
              id: "t-ch6-1",
              text: "Schau dir zuerst die Datei <code>main.tf</code> an. Wie viele <code>resource</code>-Blöcke findest du?",
              accept: [/^cat\s+main\.tf$/],
              hint: "Dateien anzeigen – wie in Kapitel 4.",
              solution: "cat main.tf",
            },
            {
              id: "t-ch6-2",
              text: "Initialisiere das Terraform-Projekt (lädt die Provider-Plugins).",
              accept: [/^terraform\s+init$/],
              hint: "Der allererste Befehl in jedem Terraform-Projekt.",
              solution: "terraform init",
            },
            {
              id: "t-ch6-3",
              text: "Generalprobe! Lass dir anzeigen, was Terraform bauen <b>würde</b> – ohne es zu tun.",
              accept: [/^terraform\s+plan$/],
              hint: "Die Generalprobe hieß in der Lektion …?",
              solution: "terraform plan",
            },
            {
              id: "t-ch6-4",
              text: "Der Plan sieht gut aus (1 Netzwerk, 2 Server). Jetzt im Ernst: Baue die Infrastruktur!",
              accept: [/^terraform\s+apply(\s+-auto-approve)?$/],
              hint: "Nach der Generalprobe kommt die Aufführung: terraform apply",
              solution: "terraform apply",
            },
            {
              id: "t-ch6-5",
              text: "Wirf einen Blick in Terraforms Gedächtnis: Was steht jetzt im State?",
              accept: [/^terraform\s+state\s+list$/],
              hint: "Muster: terraform state list",
              solution: "terraform state list",
            },
            {
              id: "t-ch6-6",
              text: "Führe nochmal <code>terraform plan</code> aus. Es sollte „No changes“ melden – Soll und Ist sind identisch!",
              accept: [/^terraform\s+plan$/],
              check: sim => sim.tf.applied,
              hint: "Einfach nochmal plan.",
              solution: "terraform plan",
            },
            {
              id: "t-ch6-7",
              text: "Die Übung ist vorbei und Übungs-Infrastruktur kostet Geld. Reiß alles wieder ab!",
              accept: [/^terraform\s+destroy(\s+-auto-approve)?$/],
              hint: "Das zerstörerische Gegenteil von apply …",
              solution: "terraform destroy",
            },
          ],
        },
      ],
    },
  ];

  /* ---------- Befehls-Wiederholungskarten (für den Tagesrapport) ---------- */
  const CMD_CARDS = [
    { id: "c-ch1-1", chapter: "ch1", q: "Lade das Image <code>nginx</code> aus der Registry herunter.", accept: [/^docker\s+pull\s+nginx(:\S+)?$/], solution: "docker pull nginx" },
    { id: "c-ch1-2", chapter: "ch1", q: "Zeige alle laufenden Docker-Container an.", accept: [/^docker\s+ps$/], solution: "docker ps" },
    { id: "c-ch1-3", chapter: "ch1", q: "Zeige ALLE Docker-Container an – auch gestoppte.", accept: [/^docker\s+ps\s+(-a|--all)$/], solution: "docker ps -a" },
    { id: "c-ch2-1", chapter: "ch2", q: "Zeige alle Nodes deines Clusters an.", accept: [/^kubectl\s+get\s+(nodes|node|no)$/], solution: "kubectl get nodes" },
    { id: "c-ch2-2", chapter: "ch2", q: "Zeige alle Pods an (im aktuellen Namespace).", accept: [/^kubectl\s+get\s+(pods|pod|po)$/], solution: "kubectl get pods" },
    { id: "c-ch2-3", chapter: "ch2", q: "Zeige die Pods im Namespace <code>kube-system</code> an.", accept: [/^kubectl\s+get\s+(pods|pod|po)\s+(-n|--namespace)[=\s]?kube-system$/], solution: "kubectl get pods -n kube-system" },
    { id: "c-ch3-1", chapter: "ch3", q: "Erstelle ein Deployment <code>shop</code> mit dem Image <code>nginx</code>.", accept: [/^kubectl\s+create\s+deployment\s+shop\s+--image[=\s]nginx(:\S+)?$/], solution: "kubectl create deployment shop --image=nginx" },
    { id: "c-ch3-2", chapter: "ch3", q: "Skaliere das Deployment <code>shop</code> auf 4 Kopien.", accept: [/^kubectl\s+scale\s+deployment\s+shop\s+--replicas[=\s]4$/], solution: "kubectl scale deployment shop --replicas=4" },
    { id: "c-ch3-3", chapter: "ch3", q: "Stelle einen Service vor das Deployment <code>shop</code> auf Port 80.", accept: [/^kubectl\s+expose\s+deployment\s+shop\s+--port[=\s]80(\s.*)?$/], solution: "kubectl expose deployment shop --port=80" },
    { id: "c-ch4-1", chapter: "ch4", q: "Wende die Datei <code>app.yaml</code> deklarativ auf den Cluster an.", accept: [/^kubectl\s+apply\s+-f\s+app\.yaml$/], solution: "kubectl apply -f app.yaml" },
    { id: "c-ch5-1", chapter: "ch5", q: "Installiere das Chart <code>bitnami/redis</code> als Release <code>cache</code>.", accept: [/^helm\s+install\s+cache\s+bitnami\/redis$/], solution: "helm install cache bitnami/redis" },
    { id: "c-ch5-2", chapter: "ch5", q: "Zeige alle installierten Helm-Releases an.", accept: [/^helm\s+(list|ls)$/], solution: "helm list" },
    { id: "c-ch5-3", chapter: "ch5", q: "Rolle das Release <code>cache</code> auf Revision 1 zurück.", accept: [/^helm\s+rollback\s+cache\s+1$/], solution: "helm rollback cache 1" },
    { id: "c-ch6-1", chapter: "ch6", q: "Initialisiere ein frisches Terraform-Projekt.", accept: [/^terraform\s+init$/], solution: "terraform init" },
    { id: "c-ch6-2", chapter: "ch6", q: "Zeige an, was Terraform tun WÜRDE – ohne es zu tun.", accept: [/^terraform\s+plan$/], solution: "terraform plan" },
    { id: "c-ch6-3", chapter: "ch6", q: "Setze die Terraform-Konfiguration wirklich um.", accept: [/^terraform\s+apply(\s+-auto-approve)?$/], solution: "terraform apply" },
  ];

  window.KQData = { RANKS, SHOP, CHAPTERS, CMD_CARDS };
})();
