/* ===== KubeQuest 2.0 – Inhalte =====
 * Ränge, Shop, NPCs, Quests (Dialoge + Terminal-Aufträge), Wiederholungskarten.
 * Sprache bewusst neutral – das Spiel ist für alle.
 */

(function () {
  "use strict";

  /* ---------- Ränge (alle geschlechtsneutral) ---------- */
  const RANKS = [
    { xp: 0,    name: "Landratte",  icon: "🦔" },
    { xp: 80,   name: "Moses",      icon: "🧽" },   // traditionell: jüngstes Crew-Mitglied
    { xp: 200,  name: "Deckshand",  icon: "🧹" },
    { xp: 380,  name: "Matrose",    icon: "⚓" },
    { xp: 600,  name: "Maat",       icon: "🪢" },
    { xp: 900,  name: "Steuermaat", icon: "☸️" },
    { xp: 1300, name: "Navigator",  icon: "🧭" },
    { xp: 1800, name: "Käpt'n",     icon: "🫡" },
    { xp: 2500, name: "Admiral",    icon: "🏅" },
  ];

  /* ---------- Shop ---------- */
  const SHOP = [
    { id: "fernrohr", icon: "🔭", name: "Hinweis-Fernrohr", price: 25, type: "consumable",
      desc: "Zeigt dir beim Funken einen Hinweis zur aktuellen Aufgabe. Einmal benutzbar." },
    { id: "kompass", icon: "🧭", name: "Lösungs-Kompass", price: 50, type: "consumable",
      desc: "Verrät dir beim Funken die komplette Lösung der aktuellen Aufgabe. Einmal benutzbar." },
    { id: "pet-ratte", icon: "🐀", sprite: 124, name: "Hafenratte Taki", price: 150, type: "pet",
      desc: "Folgt dir überallhin. Hat schon mehr Häfen gesehen als jeder Admiral." },
    { id: "pet-fledermaus", icon: "🦇", sprite: 120, name: "Fledermaus Echo", price: 250, type: "pet",
      desc: "Flattert hinter dir her. Findet jeden Weg – auch im Dunkeln." },
    { id: "pet-geist", icon: "👻", sprite: 121, name: "Archiv-Geist Plotter", price: 400, type: "pet",
      desc: "Spukt seit Jahren im Kartenhaus. Kennt YAML auswendig. Gruselig." },
    { id: "flagge-lila", icon: "🟪", color: "#9b6bdf", name: "Lila Schiffsflagge", price: 80, type: "flag",
      desc: "Dein Schiff am Pier zeigt Flagge – in Edel-Lila." },
    { id: "flagge-gruen", icon: "🟩", color: "#6fdc8c", name: "Grüne Schiffsflagge", price: 80, type: "flag",
      desc: "Grün wie ein frisch deploytes Release." },
    { id: "flagge-pirat", icon: "🏴‍☠️", color: "#202028", name: "Piratenflagge", price: 150, type: "flag",
      desc: "Arrr! Streng genommen nicht erlaubt. Ole drückt ein Auge zu." },
  ];

  /* ---------- NPCs (Sprite-Index aus dem Dungeon-Sheet) ---------- */
  const NPCS = {
    ole:    { name: "Ole",           title: "Hafenmeister",    sprite: 100 },
    bo:     { name: "Bo",            title: "Dock-Golem",      sprite: 109 },
    ada:    { name: "Ada",           title: "Kartenhaus",      sprite: 84 },
    runa:   { name: "Runa",          title: "Werftchefin",     sprite: 87 },
    theo:   { name: "Theo",          title: "Landvermessung",  sprite: 111 },
    pelle:  { name: "Pelle",         title: "Handelsposten",   sprite: 86 },
    kralle: { name: "Krabbe Kralle", title: "Quiz-Krabbe",     sprite: 110 },
  };

  /* ---------- Spielbare Charaktere ---------- */
  const PLAYER_SPRITES = [85, 88, 98, 99, 112, 96];

  /* ---------- Virtuelle Dateien für Quests ---------- */
  const DEPLOYMENT_YAML = [
    "apiVersion: apps/v1", "kind: Deployment", "metadata:", "  name: lager", "spec:",
    "  replicas: 2", "  selector:", "    matchLabels:", "      app: lager", "  template:",
    "    metadata:", "      labels:", "        app: lager", "    spec:", "      containers:",
    "        - name: lager", "          image: redis:7", "          ports:", "            - containerPort: 6379",
  ].join("\n");

  const SERVICE_YAML = [
    "apiVersion: v1", "kind: Service", "metadata:", "  name: lager", "spec:",
    "  selector:", "    app: lager", "  ports:", "    - port: 6379",
  ].join("\n");

  const MAIN_TF = [
    "terraform {", "  required_providers {", "    hafen = {", "      source = \"kubequest/hafen\"", "    }", "  }", "}",
    "", "# Ein neues Ost-Plateau für Port Kubernia",
    "resource \"hafen_plateau\" \"ost\" {", "  name   = \"ost-erweiterung\"", "  breite = 12", "}",
    "", "# Zwei Server für den wachsenden Cluster",
    "resource \"hafen_server\" \"worker\" {", "  count   = 2", "  name    = \"worker-${count.index + 3}\"", "  groesse = \"mittel\"", "}",
  ].join("\n");

  /* =================================================================
   * QUESTS – die Hauptgeschichte. Schritt-Typen:
   *  dialog   – NPC redet (kurze Sprechblasen)
   *  choice   – NPC stellt eine Frage mit Antwortmöglichkeiten
   *  terminal – Funkgerät-Aufgaben (echte Befehle, Welt reagiert!)
   * ================================================================= */
  const QUESTS = [

    /* ---------- Quest 0: Ankommen ---------- */
    {
      id: "q0", title: "Anheuern in Port Kubernia", giver: "ole",
      rewardXp: 20, rewardCoins: 15,
      steps: [
        { type: "dialog", npc: "ole", lines: [
          "Ahoi! Du musst die neue Crew sein. Willkommen in <b>Port Kubernia</b> – dem modernsten Hafen der sieben Meere!",
          "Ich bin Ole, Hafenmeister. Bei uns läuft die ganze Fracht in <b>Containern</b> – und verwaltet wird alles mit Software. Keine Sorge, du lernst das von der Pike auf.",
          "Dein wichtigstes Werkzeug bekommst du sofort: dein <b>📻 Funkgerät</b>. Damit gibst du dem Hafen Befehle. Drück <b>T</b> und tippe als Erstes <code>help</code>!",
        ]},
        { type: "terminal", brief: "Funkgerät-Test", tasks: [
          { id: "t-q0-1", text: "Tippe <code>help</code>, um zu sehen, was dein Funkgerät alles kann.",
            accept: [/^help$/], hint: "Einfach das Wort help eintippen und Enter drücken.", solution: "help" },
        ]},
        { type: "dialog", npc: "ole", lines: [
          "Sieh an – du funkst ja schon wie ein alter Seebär! Das war's auch schon mit der Theorie, versprochen.",
          "Geh als Erstes runter zum <b>Dock im Südwesten</b>. Dort wartet <b>Bo</b> auf dich – unser Dock-Golem. Stapelt seit 200 Jahren Kisten und weiß ALLES über Container.",
        ]},
      ],
    },

    /* ---------- Quest 1: Docker ---------- */
    {
      id: "q1", title: "Bo und die genormten Kisten", giver: "bo",
      rewardXp: 40, rewardCoins: 30,
      steps: [
        { type: "dialog", npc: "bo", lines: [
          "BO. GRÜSST. NEUE CREW. <i>*knirsch*</i>",
          "Bo stapelt Fracht. Früher: Chaos. Säcke, Fässer, Kisten in hundert Formen. Jedes Schiff anders. Bo hatte Rückenschmerzen. Golem-Rückenschmerzen.",
          "Dann kam: <b>DER CONTAINER</b>. Genormte Box. Egal, was drin ist – jeder Kran, jedes Schiff kann damit umgehen.",
          "Software genauso: App + alles, was sie braucht, in eine Box → läuft <b>überall gleich</b>. Das Werkzeug dafür heißt <b>Docker</b>.",
        ]},
        { type: "choice", npc: "bo", reviewId: "q-ch1-1",
          q: "Bo testet dich: WARUM sind Container gut?",
          options: [
            { t: "Eine App läuft mit allem Drumherum überall gleich – Laptop, Server, Cloud.", ok: true,
              reply: "RICHTIG. <i>*stolzes Steinknirschen*</i> Das berüchtigte „Bei mir läuft's aber!“ ist damit Geschichte." },
            { t: "Sie machen Apps automatisch schneller.", ok: false,
              reply: "NEIN. Schneller nicht. Aber ÜBERALL GLEICH. Das ist der Punkt. Merken!" },
            { t: "Sie sind aus Stahl und halten ewig.", ok: false,
              reply: "BO MAG STAHL. Aber nein – Software-Container sind aus … Software. Der Punkt ist: läuft überall gleich." },
          ]},
        { type: "dialog", npc: "bo", lines: [
          "Zwei Wörter musst du auseinanderhalten: <b>Image</b> = der Bauplan. <b>Container</b> = die laufende Kiste, gebaut nach dem Bauplan. Aus einem Image: beliebig viele Container.",
          "Baupläne holt man aus einer <b>Registry</b> – einem Kisten-Supermarkt. Der bekannteste: <b>Docker Hub</b>. Jetzt DU. Funkgerät raus (<b>T</b>)! Bo schaut zu.",
        ]},
        { type: "terminal", brief: "Bos Container-Training", tasks: [
          { id: "t-ch1-1", text: "Hol dir den Bauplan: Lade das Image <code>nginx</code> (ein kleiner Webserver) aus der Registry.",
            accept: [/^docker\s+pull\s+nginx(:\S+)?$/], hint: "Herunterladen heißt bei Docker „pull“. Muster: docker pull <image>", solution: "docker pull nginx" },
          { id: "t-ch1-2", text: "Starte daraus einen Container im Hintergrund (<code>-d</code>) mit dem Namen <code>webserver</code>. Schau danach zum Dock – Bo stellt die Kiste hin!",
            accept: [/^docker\s+run\s+(?=.*-d)(?=.*--name\s+webserver).*nginx(:\S+)?$/], hint: "Muster: docker run -d --name <wunschname> <image>", solution: "docker run -d --name webserver nginx" },
          { id: "t-ch1-3", text: "Prüfe, ob dein Container wirklich läuft.",
            accept: [/^docker\s+ps$/], check: sim => sim.docker.containers.some(c => c.name === "webserver" && c.running),
            hint: "Der Befehl, der laufende Container auflistet … zwei Buchstaben nach docker.", solution: "docker ps" },
          { id: "t-ch1-4", text: "Feierabend für die Kiste: Stoppe den Container <code>webserver</code>.",
            accept: [/^docker\s+stop\s+webserver$/], hint: "Muster: docker stop <name>", solution: "docker stop webserver" },
          { id: "t-ch1-5", text: "Gestoppt heißt nicht weg! Zeig <b>alle</b> Container an – auch die gestoppten.",
            accept: [/^docker\s+ps\s+(-a|--all)$/], hint: "docker ps zeigt nur laufende. Es gibt eine kleine Flag für „alle“ …", solution: "docker ps -a" },
        ]},
        { type: "choice", npc: "bo", reviewId: "q-ch1-2",
          q: "Letzte Prüfung von Bo: Image und Container – was ist was?",
          options: [
            { t: "Image = Bauplan/Vorlage, Container = laufende Instanz davon.", ok: true,
              reply: "PERFEKT. Wie Tiefkühlpizza (Image) und Pizza im Ofen (Container). Bo hat Hunger." },
            { t: "Container = Vorlage, Image = das laufende Programm.", ok: false,
              reply: "ANDERSRUM! Image = Bauplan, Container = läuft. Bo verwechselt das nie. Bo ist aus Stein." },
          ]},
        { type: "dialog", npc: "bo", lines: [
          "Bo sieht: Du hast Talent. <i>*steinernes Nicken*</i> Ole will dich sprechen – es geht um den GROSSEN Umbau. Bo bleibt hier. Bo stapelt.",
        ]},
      ],
    },

    /* ---------- Quest 2: Kubernetes-Grundlagen ---------- */
    {
      id: "q2", title: "Der Hafen wird ein Cluster", giver: "ole",
      rewardXp: 50, rewardCoins: 35,
      steps: [
        { type: "dialog", npc: "ole", lines: [
          "Da bist du ja! Bo lobt dich – das passiert alle hundert Jahre. Jetzt die Königsfrage: Eine Kiste starten kann jeder. Aber <b>hunderte Kisten auf vielen Stegen</b>?",
          "Wer startet eine neue Kiste, wenn nachts eine über Bord geht? Wer verteilt sie sinnvoll? Dafür gibt es <b>Kubernetes</b> – griechisch für „Steuermann“. Kurz: <b>K8s</b> (K, 8 Buchstaben, s).",
          "Schau zum Wasser! Unsere <b>drei Stege</b> sind die <b>Nodes</b> – die Arbeits-Server. Alles zusammen ist der <b>Cluster</b>. Und jede Kiste steht auf einem Liegeplatz namens <b>Pod</b> – der kleinsten Einheit von Kubernetes.",
          "Dein Funkgerät spricht mit dem Cluster über <code>kubectl</code>. Die Bord-Kantine läuft schon im Cluster – finde sie! Drück <b>T</b>.",
        ]},
        { type: "terminal", brief: "Erkunde den Cluster",
          scenario: { deployments: [{ name: "kantine", image: "nginx:1.27", replicas: 2 }] },
          tasks: [
          { id: "t-ch2-1", text: "Verschaff dir einen Überblick: Welche <b>Nodes</b> (Stege) gehören zum Cluster?",
            accept: [/^kubectl\s+get\s+(nodes|node|no)$/], hint: "kubectl get <ressourcentyp> – Server heißen hier Nodes.", solution: "kubectl get nodes" },
          { id: "t-ch2-2", text: "Jetzt die Fracht: Zeig alle <b>Pods</b> an. Vergleich mit dem Dock – die Kisten draußen sind genau diese Pods!",
            accept: [/^kubectl\s+get\s+(pods|pod|po)$/], hint: "Gleiches Muster, anderer Ressourcentyp.", solution: "kubectl get pods" },
          { id: "t-ch2-3", text: "Schau dir einen <code>kantine</code>-Pod im Detail an. (Den Namen kannst du oben abtippen.)",
            accept: [/^kubectl\s+describe\s+pods?\s+kantine-\S+$/], hint: "„Beschreiben“ heißt describe. Muster: kubectl describe pod <pod-name>", solution: "kubectl describe pod <name aus der Liste>" },
          { id: "t-ch2-4", text: "Kubernetes selbst besteht auch aus Pods – versteckt im Namespace <code>kube-system</code>. Lass sie dir zeigen!",
            accept: [/^kubectl\s+get\s+(pods|pod|po)\s+(-n|--namespace)[=\s]?kube-system$/], hint: "Mit -n <namespace> schaust du woanders rein. Muster: kubectl get pods -n kube-system", solution: "kubectl get pods -n kube-system" },
        ]},
        { type: "choice", npc: "ole", reviewId: "q-ch2-2",
          q: "Kurzer Check: Was ist ein Pod?",
          options: [
            { t: "Die kleinste Einheit in Kubernetes – meist genau ein Container drin.", ok: true,
              reply: "Exakt! Kubernetes verwaltet nie Container direkt, immer Pods. Deshalb stehen draußen Kisten auf Liegeplätzen." },
            { t: "Ein anderes Wort für einen Server.", ok: false,
              reply: "Fast-Falle! Der Server ist der <b>Node</b> (Steg). Der Pod ist der kleine Liegeplatz mit der Kiste drauf." },
            { t: "Das Konfigurationsformat von Kubernetes.", ok: false,
              reply: "Nein, das wird später YAML sein. Pod = kleinste Einheit, meist ein Container." },
          ]},
        { type: "dialog", npc: "ole", lines: [
          "Siehst du die Kisten an den Stegen? Ab jetzt siehst du da draußen <b>alles, was du per Funk anrichtest</b>. Praktisch, oder?",
          "Du machst dich gut. Wenn du zwischendurch üben willst: <b>Krabbe Kralle</b> auf deinem Schiff stellt dir täglich Fragen – dafür gibt's Dublonen. Und bei <b>Pelle</b> am Markt kannst du sie ausgeben.",
        ]},
      ],
    },

    /* ---------- Quest 3: Deployments & Services ---------- */
    {
      id: "q3", title: "Sturmfeste Kisten", giver: "ole",
      rewardXp: 60, rewardCoins: 40,
      steps: [
        { type: "dialog", npc: "ole", lines: [
          "Schlechte Nachricht: Letzte Nacht ist ein Pod über Bord gegangen. Gute Nachricht: <b>Niemand musste aufstehen.</b> Der Kran hat sofort Ersatz hingestellt.",
          "Das Geheimnis heißt <b>Deployment</b> – ein Dauerauftrag an den Cluster: „Halte IMMER 3 Kopien am Laufen!“ Fällt eine ins Wasser → sofort Ersatz. Das nennt sich <b>Self-Healing</b>.",
          "Und weil neue Kisten immer neue Namen bekommen, braucht es eine feste Adresse davor: einen <b>Service</b>. Wie ein Empfangstresen – die Person dahinter wechselt, der Tresen bleibt.",
          "Dein Auftrag: Bau eine <b>Kasse</b> für den Fischmarkt. Ausfallsicher, 3 Kopien, feste Adresse. Und dann … versenk eine Kiste. Im Ernst! Du wirst staunen. Drück <b>T</b>!",
        ]},
        { type: "terminal", brief: "Kasse für den Fischmarkt", tasks: [
          { id: "t-ch3-1", text: "Erstelle ein Deployment namens <code>kasse</code> mit dem Image <code>nginx</code>.",
            accept: [/^kubectl\s+create\s+deployment\s+kasse\s+--image[=\s]nginx(:\S+)?$/], hint: "Muster: kubectl create deployment <name> --image=<image>", solution: "kubectl create deployment kasse --image=nginx" },
          { id: "t-ch3-2", text: "Eine Kasse reicht nicht, wenn die Crew Hunger hat: Skaliere auf <b>3</b> Kopien. (Blick zum Dock!)",
            accept: [/^kubectl\s+scale\s+deployment\s+kasse\s+--replicas[=\s]3$/], hint: "Muster: kubectl scale deployment <name> --replicas=<zahl>", solution: "kubectl scale deployment kasse --replicas=3" },
          { id: "t-ch3-3", text: "Prüfe nach: Laufen wirklich 3 <code>kasse</code>-Pods?",
            accept: [/^kubectl\s+get\s+(pods|pod|po)$/], check: sim => { const d = sim.deployments.find(d => d.name === "kasse"); return d && d.replicas === 3; },
            hint: "Der Übersichts-Befehl für Pods.", solution: "kubectl get pods" },
          { id: "t-ch3-4", text: "Jetzt der Härtetest! 💥 Lösche einen der drei <code>kasse</code>-Pods – und beobachte das Dock!",
            accept: [/^kubectl\s+delete\s+pods?\s+kasse-\S+$/], hint: "Muster: kubectl delete pod <pod-name>", solution: "kubectl delete pod <ein kasse-pod-name>" },
          { id: "t-ch3-5", text: "Hast du es gesehen? Platsch – und der Kran war schneller! Prüfe: Es sollten wieder 3 sein (einer ganz frisch, kleines AGE).",
            accept: [/^kubectl\s+get\s+(pods|pod|po)$/], check: sim => sim.lastDeletedPod !== null,
            hint: "Einfach nochmal die Pod-Liste.", solution: "kubectl get pods" },
          { id: "t-ch3-6", text: "Jetzt die feste Adresse: Stelle einen <b>Service</b> vor das Deployment <code>kasse</code>, Port <b>80</b>.",
            accept: [/^kubectl\s+expose\s+deployment\s+kasse\s+--port[=\s]80(\s.*)?$/], hint: "„Nach außen stellen“ heißt expose. Muster: kubectl expose deployment <name> --port=80", solution: "kubectl expose deployment kasse --port=80" },
          { id: "t-ch3-7", text: "Kontrollblick: Zeig die Services an. Draußen am Dock leuchtet jetzt eine Laterne für deine Kasse!",
            accept: [/^kubectl\s+get\s+(services|service|svc)$/], check: sim => sim.services.some(s => s.name === "kasse"),
            hint: "kubectl get … (Kurzform svc geht auch).", solution: "kubectl get services" },
        ]},
        { type: "choice", npc: "ole", reviewId: "q-ch3-2",
          q: "Du löschst einen Pod eines Deployments mit replicas: 3. Was passiert?",
          options: [
            { t: "Kubernetes startet sofort einen neuen – es sollen ja 3 sein.", ok: true,
              reply: "Genau das hast du gerade live gesehen! Soll-Zustand 3, Ist-Zustand 2 → Differenz wird sofort behoben." },
            { t: "Es laufen ab jetzt dauerhaft nur noch 2.", ok: false,
              reply: "Nein – schau zum Dock! Die Kiste ist längst ersetzt. Das Deployment hält den Soll-Zustand: immer 3." },
          ]},
        { type: "dialog", npc: "ole", lines: [
          "Die Laterne am Steg ist dein <b>Service</b> – die feste Adresse deiner Kasse. Egal welche Kisten dahinter gerade leben.",
          "Weißt du, wer sich für deine Fortschritte interessiert? <b>Ada im Kartenhaus</b> oben im Nordosten. Sie hat eine … sagen wir … <i>elegantere</i> Art, mit dem Cluster zu reden.",
        ]},
      ],
    },

    /* ---------- Quest 4: YAML ---------- */
    {
      id: "q4", title: "Adas Seekarten", giver: "ada",
      rewardXp: 60, rewardCoins: 40,
      steps: [
        { type: "dialog", npc: "ada", lines: [
          "Pssst! Hier im Kartenhaus wird nicht gebrüllt. Du rufst dem Cluster deine Wünsche bisher einzeln zu, hm? <code>create</code> hier, <code>scale</code> da … Das nennt man <b>imperativ</b>. Tssss.",
          "Profis <b>zeichnen Karten</b>: Sie schreiben den Wunschzustand in eine Datei. „Ich hätte gern: 2 Lager-Kisten mit Redis.“ Das ist <b>deklarativ</b> – und die Datei kann in <b>Git</b> liegen! Nachvollziehbar. Teilbar. Schön.",
          "Diese Karten heißen <b>Manifeste</b> und sind in <b>YAML</b> geschrieben. Vier Stammdaten hat jedes: <code>apiVersion</code>, <code>kind</code> (was es ist), <code>metadata</code> (Name), <code>spec</code> (der Wunsch).",
          "Und das Wichtigste: Einrückung mit <b>Leerzeichen</b> – NIEMALS Tabs, sonst spukt es hier noch mehr. Ich habe dir zwei Karten hingelegt. Erweck sie mit <code>kubectl apply</code> zum Leben!",
        ]},
        { type: "terminal", brief: "Adas Karten anwenden",
          scenario: {
            files: { "deployment.yaml": DEPLOYMENT_YAML, "service.yaml": SERVICE_YAML },
            applyEffects: {
              "deployment.yaml": { deployment: { name: "lager", image: "redis:7", replicas: 2 } },
              "service.yaml": { service: { name: "lager", port: "6379" } },
            },
          },
          tasks: [
          { id: "t-ch4-1", text: "Schau nach, welche Dateien Ada dir hingelegt hat.",
            accept: [/^ls$/], hint: "Der Klassiker zum Dateien-Auflisten, zwei Buchstaben.", solution: "ls" },
          { id: "t-ch4-2", text: "Wirf einen Blick in <code>deployment.yaml</code>. Findest du <code>kind</code>, <code>replicas</code> und das Image?",
            accept: [/^cat\s+deployment\.yaml$/], hint: "Dateien anzeigen geht mit cat <datei>.", solution: "cat deployment.yaml" },
          { id: "t-ch4-3", text: "Jetzt deklarativ: Wende <code>deployment.yaml</code> auf den Cluster an!",
            accept: [/^kubectl\s+apply\s+-f\s+deployment\.yaml$/], hint: "Der Zauberbefehl: kubectl apply -f <datei>", solution: "kubectl apply -f deployment.yaml" },
          { id: "t-ch4-4", text: "Wende auch <code>service.yaml</code> an.",
            accept: [/^kubectl\s+apply\s+-f\s+service\.yaml$/], hint: "Gleicher Befehl, andere Datei.", solution: "kubectl apply -f service.yaml" },
          { id: "t-ch4-5", text: "Prüfe das Ergebnis: Wie viele <code>lager</code>-Pods sind am Dock dazugekommen? (In der Karte standen <code>replicas: 2</code> …)",
            accept: [/^kubectl\s+get\s+(pods|pod|po)$/], check: sim => { const d = sim.deployments.find(d => d.name === "lager"); return d && d.replicas === 2; },
            hint: "Pods anzeigen – kannst du längst!", solution: "kubectl get pods" },
          { id: "t-ch4-6", text: "Adas Lieblingstrick: Führe denselben apply <b>nochmal</b> aus – und sieh, dass NICHTS doppelt entsteht („unchanged“).",
            accept: [/^kubectl\s+apply\s+-f\s+deployment\.yaml$/], hint: "Wirklich einfach nochmal derselbe Befehl.", solution: "kubectl apply -f deployment.yaml" },
        ]},
        { type: "choice", npc: "ada", reviewId: "q-ch4-4",
          q: "Du wendest dieselbe Karte zweimal an. Was passiert beim zweiten Mal?",
          options: [
            { t: "Nichts Schlimmes – Kubernetes meldet „unchanged“, alles stimmt ja schon.", ok: true,
              reply: "Wunderbar! apply vergleicht immer Soll (Karte) mit Ist (Hafen) und tut nur das Nötige. Das nennt man <b>idempotent</b>. Mein Lieblingswort." },
            { t: "Alles wird doppelt erstellt – 4 Lager-Kisten!", ok: false,
              reply: "Nein! Das ist ja das Schöne: apply gleicht Soll und Ist ab. Es existiert schon? Dann passiert: nichts. „unchanged“." },
          ]},
        { type: "dialog", npc: "ada", lines: [
          "Du hast das Zeug zur Kartografie! Behalte das Prinzip: <b>Wunschzustand aufschreiben, System stellt ihn her.</b> Es wird gleich nochmal wichtig …",
          "<b>Runa in der Werft</b> im Norden wartet schon auf dich. Sie hat ein … Steuerrad-Problem. Du wirst schon sehen. <i>*kichert*</i>",
        ]},
      ],
    },

    /* ---------- Quest 5: Helm ---------- */
    {
      id: "q5", title: "Runas Steuerrad", giver: "runa",
      rewardXp: 70, rewardCoins: 50,
      steps: [
        { type: "dialog", npc: "runa", lines: [
          "Ahoi! Runa, Werftchefin. Lass mich raten: Du dachtest bei <b>Helm</b> erst an das Ding für den Kopf? HA! Passiert allen. Helm ist Englisch für <b>Steuerrad</b> – schau dir das Logo an!",
          "Und WAS es ist: der <b>Paketmanager für Kubernetes</b>. Bei Ada waren es 2 Karten für eine Mini-App. Eine ECHTE App braucht 20, 30 Manifeste. Und das dreimal: Test, Staging, Produktion. 90 Dateien pflegen? NIEMALS.",
          "Helm bündelt alles in ein <b>Chart</b> – ein Paket mit Drehknöpfen. Die Drehknöpfe stehen in <code>values.yaml</code>. Eine Installation eines Charts heißt <b>Release</b>.",
          "Und das Beste: Geht ein Update schief, rettet dich <code>helm rollback</code>. Genug geredet – hol dir das nginx-Chart und hiss die Flagge! Für jedes Release weht hier an der Werft eine. Drück <b>T</b>!",
        ]},
        { type: "terminal", brief: "Runas Werft-Auftrag", tasks: [
          { id: "t-ch5-1", text: "Füge das bekannte Chart-Repo <code>bitnami</code> hinzu (URL: <code>https://charts.bitnami.com/bitnami</code>).",
            accept: [/^helm\s+repo\s+add\s+bitnami\s+https:\/\/charts\.bitnami\.com\/bitnami$/], hint: "Muster: helm repo add <name> <url>", solution: "helm repo add bitnami https://charts.bitnami.com/bitnami" },
          { id: "t-ch5-2", text: "Aktualisiere die Repo-Informationen.",
            accept: [/^helm\s+repo\s+update$/], hint: "Auch das geht über helm repo …", solution: "helm repo update" },
          { id: "t-ch5-3", text: "Suche in den Repos nach einem <code>nginx</code>-Chart.",
            accept: [/^helm\s+search\s+repo\s+nginx$/], hint: "Muster: helm search repo <suchwort>", solution: "helm search repo nginx" },
          { id: "t-ch5-4", text: "Installiere <code>bitnami/nginx</code> als Release mit dem Namen <code>mein-web</code>. (Flaggen-Blick zur Werft!)",
            accept: [/^helm\s+install\s+mein-web\s+bitnami\/nginx$/], hint: "Muster: helm install <release-name> <repo>/<chart>", solution: "helm install mein-web bitnami/nginx" },
          { id: "t-ch5-5", text: "Lass dir alle installierten Releases anzeigen.",
            accept: [/^helm\s+(list|ls)$/], hint: "Der Befehl heißt wie das englische Wort für „auflisten“.", solution: "helm list" },
          { id: "t-ch5-6", text: "Spannend: Was hat Helm in den Cluster gebaut? Schau mit <b>kubectl</b> nach den Pods – und aufs Dock!",
            accept: [/^kubectl\s+get\s+(pods|pod|po)$/], check: sim => sim.releases.length > 0,
            hint: "Helm erzeugt ganz normale Kubernetes-Ressourcen.", solution: "kubectl get pods" },
          { id: "t-ch5-7", text: "Upgrade! Stelle das Release per <code>--set replicaCount=3</code> auf 3 Kopien um.",
            accept: [/^helm\s+upgrade\s+mein-web\s+bitnami\/nginx\s+--set\s+replicaCount=3$/], hint: "Muster: helm upgrade <release> <chart> --set replicaCount=3", solution: "helm upgrade mein-web bitnami/nginx --set replicaCount=3" },
          { id: "t-ch5-8", text: "Ups – Befehl von oben: doch wieder zurück! Rolle das Release auf Revision <b>1</b> zurück.",
            accept: [/^helm\s+rollback\s+mein-web(\s+1)?$/], hint: "Muster: helm rollback <release> <revision>", solution: "helm rollback mein-web 1" },
          { id: "t-ch5-9", text: "Übung beendet: Deinstalliere das Release <code>mein-web</code> komplett. (Die Flagge wird eingeholt …)",
            accept: [/^helm\s+uninstall\s+mein-web$/], hint: "Das Gegenteil von install …", solution: "helm uninstall mein-web" },
        ]},
        { type: "choice", npc: "runa", reviewId: "q-ch5-2",
          q: "Runa fragt: Chart und Release – was ist der Unterschied?",
          options: [
            { t: "Chart = das Paket (Vorlage), Release = eine installierte Instanz davon.", ok: true,
              reply: "Sauber! Wie Image und Container bei Docker. Aus einem Chart kannst du zehn Releases installieren – jedes mit eigenem Namen und eigener Flagge!" },
            { t: "Release = die Vorlage, Chart = die Installation.", ok: false,
              reply: "Andersrum! Das Chart liegt im Regal (Vorlage), das Release weht am Mast (installiert). Eselsbrücke: Software-RELEASES sind veröffentlichte, laufende Dinger." },
          ]},
        { type: "dialog", npc: "runa", lines: [
          "Du steuerst das Rad wie ein alter Hase! Eine Sache noch, dann bist du durch mit der Grundausbildung …",
          "<b>Theo</b> vom Vermessungstrupp campiert östlich vom Markt. Der Rat plant eine <b>Hafenerweiterung</b> – und Theo braucht jemanden, der keine Angst vor großen Plänen hat.",
        ]},
      ],
    },

    /* ---------- Quest 6: Terraform ---------- */
    {
      id: "q6", title: "Neues Land für Port Kubernia", giver: "theo",
      rewardXp: 100, rewardCoins: 80,
      steps: [
        { type: "dialog", npc: "theo", lines: [
          "Du bist also die Funk-Legende, von der alle reden! Theo, Landvermessung. Eine Frage: Wer hat eigentlich den Hafen <b>gebaut</b>, auf dem deine ganzen Kisten stehen?",
          "Früher hat man Infrastruktur zusammengeklickt – und nach einem Jahr wusste niemand mehr, wer was warum. Heute beschreiben wir sie als <b>Textdatei</b>: <b>Infrastructure as Code</b>! Das Werkzeug: <b>Terraform</b>.",
          "Kommt dir bekannt vor? Genau – <b>deklarativ</b>, wie Adas Karten! Nur baut Terraform nicht Kisten IM Hafen, sondern <b>den Hafen selbst</b>: Land, Server, Netze.",
          "Der heilige Dreischritt: <code>init</code> (Werkzeug laden) → <code>plan</code> (Generalprobe – IMMER erst lesen!) → <code>apply</code> (bauen!). Der Bauplan liegt in <code>main.tf</code>. Lass Land entstehen! Drück <b>T</b>!",
        ]},
        { type: "terminal", brief: "Die Ost-Erweiterung",
          scenario: {
            files: { "main.tf": MAIN_TF },
            tfResources: [
              { addr: "hafen_plateau.ost", desc: 'name = "ost-erweiterung"' },
              { addr: "hafen_server.worker[0]", desc: 'name = "worker-3"' },
              { addr: "hafen_server.worker[1]", desc: 'name = "worker-4"' },
            ],
          },
          tasks: [
          { id: "t-ch6-1", text: "Lies zuerst den Bauplan <code>main.tf</code>. Wie viele <code>resource</code>-Blöcke findest du?",
            accept: [/^cat\s+main\.tf$/], hint: "Dateien anzeigen – wie bei Ada.", solution: "cat main.tf" },
          { id: "t-ch6-2", text: "Initialisiere das Terraform-Projekt (lädt die Provider-Plugins).",
            accept: [/^terraform\s+init$/], hint: "Der allererste Befehl in jedem Terraform-Projekt.", solution: "terraform init" },
          { id: "t-ch6-3", text: "Generalprobe! Lass dir zeigen, was Terraform bauen <b>würde</b> – ohne es zu tun.",
            accept: [/^terraform\s+plan$/], hint: "Die Generalprobe hieß …?", solution: "terraform plan" },
          { id: "t-ch6-4", text: "Der Plan sieht gut aus (1 Plateau, 2 Server). Jetzt im Ernst: <b>Baue!</b> Und schau nach Osten!! 🏗️",
            accept: [/^terraform\s+apply(\s+-auto-approve)?$/], hint: "Nach der Generalprobe kommt die Aufführung.", solution: "terraform apply" },
          { id: "t-ch6-5", text: "Wirf einen Blick in Terraforms Gedächtnis: Was steht im <b>State</b>?",
            accept: [/^terraform\s+state\s+list$/], hint: "Muster: terraform state list", solution: "terraform state list" },
          { id: "t-ch6-6", text: "Führe nochmal <code>terraform plan</code> aus – es sollte „No changes“ melden. Soll = Ist!",
            accept: [/^terraform\s+plan$/], check: sim => sim.tf.applied, hint: "Einfach nochmal plan.", solution: "terraform plan" },
          { id: "t-ch6-7", text: "Der Rat will erst nächstes Jahr bauen … und Übungs-Land kostet Miete. Reiß es wieder ab!",
            accept: [/^terraform\s+destroy(\s+-auto-approve)?$/], hint: "Das zerstörerische Gegenteil von apply …", solution: "terraform destroy" },
        ]},
        { type: "choice", npc: "theo", reviewId: "q-ch6-2",
          q: "Theo will's genau wissen: plan vs. apply?",
          options: [
            { t: "plan zeigt nur, was passieren würde – apply führt es wirklich aus.", ok: true,
              reply: "Korrekt! Und die eiserne Regel der Profis: NIEMALS apply ohne vorher den plan zu lesen. Das hat schon ganze Häfen gerettet." },
            { t: "plan ist für kleine, apply für große Bauprojekte.", ok: false,
              reply: "Nein – Größe ist egal! plan = Generalprobe (passiert nichts), apply = Aufführung (wird gebaut). Immer in dieser Reihenfolge." },
          ]},
        { type: "dialog", npc: "theo", lines: [
          "Du hast … mit einer TEXTDATEI … Land erschaffen und wieder abgerissen. Weißt du, wie lange ich dafür gebraucht habe?! <i>*wischt sich eine Träne weg*</i>",
          "Docker, Kubernetes, YAML, Helm, Terraform – du beherrschst den ganzen Werkzeugkasten. Der Rat hat entschieden: Glückwunsch, <b>Admiral-Anwärter:in</b>!",
          "Halte dein Wissen frisch – Krabbe Kralle wartet täglich auf dich. Und es gehen Gerüchte um … über die <b>Ingress-Inseln</b>, das <b>GitOps-Archipel</b> und den <b>Monitoring-Leuchtturm</b>. Fortsetzung folgt! ⚓",
        ]},
      ],
    },
  ];

  /* ---------- Standard-Dialoge (wenn keine Quest ansteht) ---------- */
  const SMALLTALK = {
    ole: ["Der Hafen läuft wie geschmiert – dank dir! Schau mal bei Krabbe Kralle vorbei, Wissen rostet schneller als Anker.", "Wusstest du? „Kubernetes“ ist griechisch für Steuermann. Und K8s spricht man „Kates“. Klingt wie ein Vorname, ich weiß."],
    bo: ["BO. STAPELT. <i>*zufriedenes Knirschen*</i>", "Bo-Weisheit: Image ist Bauplan. Container läuft. Bo verwechselt nie. Bo ist Stein."],
    ada: ["Pssst. Ich katalogisiere gerade … alles.", "Falls du es vergisst: Leerzeichen, keine Tabs. LEERZEICHEN. KEINE TABS."],
    runa: ["Das Steuerrad-Logo von Helm hängt jetzt über meinem Bett. Was? Es ist hübsch!", "helm rollback hat mir mal ein ganzes Wochenende gerettet. Bestes Kommando der Welt."],
    theo: ["Ich vermesse gerade die Möglichkeiten. Sie sind … beachtlich.", "terraform plan lesen. IMMER. Frag nicht, woher ich das weiß."],
    pelle: ["Frische Ware, faire Preise! Na ja – Preise.", "Die Fernrohre sind diese Woche besonders scharf eingestellt!"],
  };

  /* ---------- Karteikarten für Krabbe Kralle (Spaced Repetition) ---------- */
  const CRAB_QUIZ = [
    { id: "q-ch1-1", q: "Welches Problem lösen Software-Container hauptsächlich?", options: ["Eine App läuft mit allem Drumherum überall gleich – Laptop, Server, Cloud.", "Sie machen Programme automatisch schneller.", "Sie verschlüsseln Programme gegen Angriffe.", "Sie sparen Speicherplatz."], correct: 0, explain: "Container packen die App mit allen Abhängigkeiten in eine genormte Box. „Bei mir läuft's aber!“ ist damit Geschichte." },
    { id: "q-ch1-2", q: "Image vs. Container – was ist was?", options: ["Image = Bauplan/Vorlage, Container = laufende Instanz davon.", "Kein Unterschied, zwei Wörter für dasselbe.", "Container = Vorlage, Image = das laufende Programm.", "Images sind für Linux, Container für Windows."], correct: 0, explain: "Tiefkühlpizza (Image) und Pizza im Ofen (Container): Aus einem Image kannst du viele Container starten." },
    { id: "q-ch1-3", q: "Was ist Docker Hub?", options: ["Eine Registry – ein öffentlicher „Supermarkt“ für fertige Images.", "Das Hauptquartier der Firma Docker.", "Ein USB-Hub für Container.", "Ein Überwachungstool."], correct: 0, explain: "Eine Registry speichert Images. docker pull nginx lädt z.B. das nginx-Image von Docker Hub." },
    { id: "q-ch1-4", q: "Was zeigt der Befehl docker ps?", options: ["Alle gerade laufenden Container.", "Alle heruntergeladenen Images.", "Die Prozessorlast.", "Alle Images auf Docker Hub."], correct: 0, explain: "docker ps = laufende Container. Mit -a („all“) siehst du auch die gestoppten." },
    { id: "q-ch2-1", q: "Wofür braucht man Kubernetes, wenn es Docker gibt?", options: ["Es verwaltet viele Container auf vielen Servern automatisch: neu starten, verteilen, skalieren.", "Es ersetzt Docker, weil Docker veraltet ist.", "Es macht Container kleiner.", "Es ist nur eine grafische Oberfläche für Docker."], correct: 0, explain: "Docker startet Container, Kubernetes orchestriert sie in großem Stil – die Hafenmeisterei für hunderte Kisten." },
    { id: "q-ch2-2", q: "Was ist ein Pod?", options: ["Die kleinste Einheit in Kubernetes – meist genau ein Container drin.", "Ein anderes Wort für einen Server.", "Eine Gruppe von mindestens zehn Containern.", "Das Konfigurationsformat von Kubernetes."], correct: 0, explain: "Kubernetes verwaltet nie Container direkt, sondern immer Pods – die Liegeplätze mit den Kisten drauf." },
    { id: "q-ch2-3", q: "Was ist ein Node?", options: ["Ein einzelner Server, der zum Cluster gehört und Pods ausführt.", "Ein Backup des Clusters.", "Ein spezieller Pod für Datenbanken.", "Das Kabel zwischen zwei Clustern."], correct: 0, explain: "Im Hafenbild: ein Steg. Mehrere Nodes zusammen bilden den Cluster." },
    { id: "q-ch2-4", q: "Ein Container stürzt nachts um 3 Uhr ab. Was passiert?", options: ["Kubernetes merkt es und startet automatisch Ersatz.", "Der Admin bekommt einen Anruf.", "Der Pod bleibt kaputt bis zum Morgen.", "Der Cluster fährt sicherheitshalber herunter."], correct: 0, explain: "Self-Healing: Kubernetes überwacht den Soll-Zustand und stellt ihn automatisch wieder her." },
    { id: "q-ch3-1", q: "Warum erstellt man Pods über ein Deployment statt direkt?", options: ["Pods sind sterblich – das Deployment ersetzt tote Pods automatisch und hält die Anzahl.", "Einzelne Pods verbrauchen mehr Speicher.", "Pods brauchen sonst Admin-Rechte.", "Direkte Pods sind verboten."], correct: 0, explain: "Das Deployment ist der Dauerauftrag: „Halte immer N Kopien am Laufen.“" },
    { id: "q-ch3-2", q: "Du löschst einen Pod eines Deployments (replicas: 3). Was passiert?", options: ["Kubernetes startet sofort einen neuen – es sollen ja 3 sein.", "Es laufen dauerhaft nur noch 2.", "Das Deployment wird ungültig.", "Kubernetes fragt erst nach."], correct: 0, explain: "Soll (3) vs. Ist (2) → Differenz wird sofort behoben. Self-Healing live!" },
    { id: "q-ch3-3", q: "Wozu braucht man einen Service?", options: ["Als feste, stabile Adresse vor den Pods – deren Namen und IPs wechseln ständig.", "Um Pods schneller zu machen.", "Als Backup für Deployments.", "Services starten Nodes neu."], correct: 0, explain: "Der Empfangstresen: Wer die App erreichen will, redet mit dem Service – der leitet an die lebenden Pods weiter." },
    { id: "q-ch4-1", q: "Imperativ vs. deklarativ?", options: ["Imperativ = einzelne Befehle rufen. Deklarativ = Wunschzustand in eine Datei schreiben.", "Imperativ ist für Linux, deklarativ für Windows.", "Deklarativ heißt: mit der Maus klicken.", "Kein Unterschied."], correct: 0, explain: "Deklarativ ist der Profi-Standard, weil die Dateien in Git versioniert werden können." },
    { id: "q-ch4-2", q: "Was gibt das Feld kind in einem Manifest an?", options: ["Welche Art von Ressource beschrieben wird – z.B. Deployment oder Service.", "Wie freundlich der Cluster antworten soll.", "Die Kubernetes-Version.", "Den Namen des Erstellers."], correct: 0, explain: "kind: Deployment, kind: Service … es bestimmt, was die Datei beschreibt." },
    { id: "q-ch4-3", q: "Worauf musst du bei YAML besonders achten?", options: ["Einrückung mit Leerzeichen – niemals Tabs.", "Großschreibung aller Schlüssel.", "Semikolon am Zeilenende.", "Maximal 100 Zeilen."], correct: 0, explain: "YAML lebt von Einrückung. Ein Leerzeichen daneben = Fehler. Ada würde weinen." },
    { id: "q-ch4-4", q: "kubectl apply -f app.yaml – zweimal ausgeführt. Was passiert beim zweiten Mal?", options: ["Nichts Schlimmes – „unchanged“, alles stimmt schon.", "Alles wird doppelt erstellt.", "Fehler: apply geht nur einmal.", "Alles wird gelöscht und neu erstellt."], correct: 0, explain: "apply gleicht Soll mit Ist ab und tut nur das Nötige – idempotent." },
    { id: "q-ch5-1", q: "Was ist Helm?", options: ["Der Paketmanager für Kubernetes – installiert komplette Apps als Charts.", "Eine Schutzausrüstung fürs Rechenzentrum.", "Ein Konkurrent von Kubernetes.", "Das Monitoring-Dashboard."], correct: 0, explain: "Helm = Steuerrad – und der App-Store für Kubernetes-Anwendungen." },
    { id: "q-ch5-2", q: "Chart vs. Release?", options: ["Chart = das Paket (Vorlage), Release = eine installierte Instanz davon.", "Release = die Vorlage, Chart = die Installation.", "Charts sind kostenlos, Releases kosten.", "Kein Unterschied."], correct: 0, explain: "Wie Image und Container! Aus einem Chart können mehrere Releases installiert werden." },
    { id: "q-ch5-3", q: "Wozu dient values.yaml in einem Chart?", options: ["Die einstellbaren Werte (Drehknöpfe) – z.B. Anzahl Kopien – ohne die Vorlage zu ändern.", "Der Preis des Charts.", "Die Passwörter des Clusters.", "Das Änderungsprotokoll."], correct: 0, explain: "Gleiche Vorlage + andere Values = Test, Staging, Produktion aus einem Chart." },
    { id: "q-ch5-4", q: "Dein helm upgrade hat alles kaputt gemacht. Panik?", options: ["Nein – helm rollback bringt das Release auf eine frühere Revision zurück.", "Ja – Cluster löschen, neu aufsetzen.", "Alle YAML-Dateien von Hand zurückändern.", "Nur uninstall + neu installieren hilft."], correct: 0, explain: "Helm führt eine Revisions-Historie pro Release. rollback = Lebensretter." },
    { id: "q-ch6-1", q: "Was bedeutet „Infrastructure as Code“?", options: ["Server, Netze & Co. werden als Textdateien beschrieben statt zusammengeklickt.", "Programme laufen ohne Betriebssystem.", "Die Infrastruktur schreibt eigenen Code.", "Rechenzentren werden durch Software ersetzt."], correct: 0, explain: "Die Dateien liegen in Git – nachvollziehbar, wiederholbar, teilbar." },
    { id: "q-ch6-2", q: "terraform plan vs. apply?", options: ["plan zeigt nur, was passieren würde – apply führt es aus.", "plan für kleine, apply für große Infrastruktur.", "apply zeigt den Plan, plan wendet an.", "Kein Unterschied."], correct: 0, explain: "Immer erst plan lesen, dann apply. Die Generalprobe vor der Aufführung." },
    { id: "q-ch6-3", q: "Was ist der Terraform-State?", options: ["Terraforms Gedächtnis: was es bereits gebaut hat.", "Der Bundesstaat des Rechenzentrums.", "Eine Statusanzeige der Installation.", "Das Fehlerprotokoll."], correct: 0, explain: "Dank State vergleicht Terraform Soll (.tf-Dateien) mit Ist und setzt nur die Differenz um." },
    { id: "q-ch6-4", q: "Kubernetes und Terraform sind beide deklarativ. Unterschied?", options: ["Kubernetes verwaltet Container im Cluster – Terraform baut die Infrastruktur drumherum.", "Terraform ist nur für Windows-Server.", "Kubernetes ersetzt Terraform.", "Terraform verwaltet nur Datenbanken."], correct: 0, explain: "Terraform baut den Hafen, Kubernetes betreibt den Verkehr darin. Oft baut Terraform sogar den K8s-Cluster." },
  ];

  const CMD_CARDS = [
    { id: "c-ch1-1", chapter: "q1", q: "Lade das Image <code>nginx</code> aus der Registry herunter.", accept: [/^docker\s+pull\s+nginx(:\S+)?$/], solution: "docker pull nginx" },
    { id: "c-ch1-2", chapter: "q1", q: "Zeige alle laufenden Docker-Container an.", accept: [/^docker\s+ps$/], solution: "docker ps" },
    { id: "c-ch1-3", chapter: "q1", q: "Zeige ALLE Docker-Container – auch gestoppte.", accept: [/^docker\s+ps\s+(-a|--all)$/], solution: "docker ps -a" },
    { id: "c-ch2-1", chapter: "q2", q: "Zeige alle Nodes deines Clusters an.", accept: [/^kubectl\s+get\s+(nodes|node|no)$/], solution: "kubectl get nodes" },
    { id: "c-ch2-2", chapter: "q2", q: "Zeige alle Pods an.", accept: [/^kubectl\s+get\s+(pods|pod|po)$/], solution: "kubectl get pods" },
    { id: "c-ch2-3", chapter: "q2", q: "Zeige die Pods im Namespace <code>kube-system</code>.", accept: [/^kubectl\s+get\s+(pods|pod|po)\s+(-n|--namespace)[=\s]?kube-system$/], solution: "kubectl get pods -n kube-system" },
    { id: "c-ch3-1", chapter: "q3", q: "Erstelle ein Deployment <code>shop</code> mit dem Image <code>nginx</code>.", accept: [/^kubectl\s+create\s+deployment\s+shop\s+--image[=\s]nginx(:\S+)?$/], solution: "kubectl create deployment shop --image=nginx" },
    { id: "c-ch3-2", chapter: "q3", q: "Skaliere das Deployment <code>shop</code> auf 4 Kopien.", accept: [/^kubectl\s+scale\s+deployment\s+shop\s+--replicas[=\s]4$/], solution: "kubectl scale deployment shop --replicas=4" },
    { id: "c-ch3-3", chapter: "q3", q: "Stelle einen Service vor das Deployment <code>shop</code>, Port 80.", accept: [/^kubectl\s+expose\s+deployment\s+shop\s+--port[=\s]80(\s.*)?$/], solution: "kubectl expose deployment shop --port=80" },
    { id: "c-ch4-1", chapter: "q4", q: "Wende die Datei <code>app.yaml</code> deklarativ auf den Cluster an.", accept: [/^kubectl\s+apply\s+-f\s+app\.yaml$/], solution: "kubectl apply -f app.yaml" },
    { id: "c-ch5-1", chapter: "q5", q: "Installiere das Chart <code>bitnami/redis</code> als Release <code>cache</code>.", accept: [/^helm\s+install\s+cache\s+bitnami\/redis$/], solution: "helm install cache bitnami/redis" },
    { id: "c-ch5-2", chapter: "q5", q: "Zeige alle installierten Helm-Releases an.", accept: [/^helm\s+(list|ls)$/], solution: "helm list" },
    { id: "c-ch5-3", chapter: "q5", q: "Rolle das Release <code>cache</code> auf Revision 1 zurück.", accept: [/^helm\s+rollback\s+cache\s+1$/], solution: "helm rollback cache 1" },
    { id: "c-ch6-1", chapter: "q6", q: "Initialisiere ein frisches Terraform-Projekt.", accept: [/^terraform\s+init$/], solution: "terraform init" },
    { id: "c-ch6-2", chapter: "q6", q: "Zeige an, was Terraform tun WÜRDE – ohne es zu tun.", accept: [/^terraform\s+plan$/], solution: "terraform plan" },
    { id: "c-ch6-3", chapter: "q6", q: "Setze die Terraform-Konfiguration wirklich um.", accept: [/^terraform\s+apply(\s+-auto-approve)?$/], solution: "terraform apply" },
  ];

  window.KQContent = { RANKS, SHOP, NPCS, PLAYER_SPRITES, QUESTS, SMALLTALK, CRAB_QUIZ, CMD_CARDS };
})();
