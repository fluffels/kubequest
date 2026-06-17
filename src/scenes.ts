/* ===== KubeQuest 3.0 – Phaser-Szenen =====
 * BootScene: lädt alle Grafiken per Phaser-Loader (ASSET_MANIFEST aus assets-data.ts;
 *            Single-File-Build inlinet sie als Data-URI → funktioniert auch per Doppelklick!).
 * WorldScene: Port Kubernia – Karte, Spieler:in, NPCs, Cluster→Welt-Sync,
 *             Piraten-Überfälle, Hacker-Krake, Hafen-Wirtschaft, Sound.
 */
import Phaser from "phaser";
import { Game } from "./game";
import { UI } from "./ui";
import { KQContent } from "./content";
import { ASSET_MANIFEST } from "./assets-data";
import { SFX } from "./sfx";
import { NPC_SPAWNS, npcSolidIndices, resolveMove, DOORS, doorAt, SHIP, SHIP_DOOR, type Door } from "./world";
import {
  WATER as A_WATER, SAND as A_SAND, PATH as A_PATH, DOCK as A_DOCK,
  buildArchipel, warpAt,
  WORLD_JETTY, WORLD_TO_ARCHIPEL, WORLD_RETURN,
  ARCHIPEL_TO_WORLD, ARCHIPEL_ARRIVAL, ARCHIPEL_NPC, ARCHIPEL_QUEST_TRIGGER,
} from "./archipel";
import { keys, setWorldScene, setInteriorOpen, type WorldSceneRef } from "./runtime";
import { pickPlacements, strSeed, hash01, grassTuftStyle } from "./decor";
import { gameClock } from "./clock";
import { expandRect, cull, FrameSampler, type Cullable } from "./cull";
import { parseTiledMap, collisionGrid, resolveTilesets } from "./tilemap";
import { harborGeometry, PIER_XS } from "./harbormap";
// #193: Karten kommen über die Map-Registry (Map-ID → rohes .tmj + Metadaten)
// statt über fest importierte Pfade. Die ?raw-.tmj-Strings (inline in beide
// Build-Wege gebündelt, also auch offline self-contained, kein Fetch) liegen jetzt
// in der Registry; die Loader holen ihre Karte hier per getMapEntry().
import { getMapEntry } from "./mapregistry";

  const T = 16;

  /* SFX (Mini-Synthesizer) liegt jetzt in sfx.ts und wird oben importiert. */

  /* ---------- Kartendaten (wie v2, bewährt) ---------- */
  // Gras-Tiles tragen im Boden-Raster die Frame-Indizes 0/1/2 (siehe accept() in
  // spawnFlowers/spawnGrassDetail). Die alte GRASS-Verteilung [0,0,0,0,1,2] aus der
  // Vor-Wang-Ära wird seit dem PixelLab-Terrain nicht mehr gebraucht und ist entfernt.
  const DIRT = 25;
  const STONE = [96, 97, 98];
  const WOOD = [48, 49, 50, 51, 52, 53];
  const CRATE = 63, BARREL = 82, ANVIL = 74, TABLE = 72, DEVICE = 65, BOOK = 66;
  const WELL = 104, SIGN = 83, CART = 57;
  const WATER = 0x3f7fc4, FOAM = 0xbfe3f5;
  // PixelLab Wang-Tileset (Wasser->Sand): Eck-Code (NW,NE,SW,SE; Bit=1 => Land/oben) -> Frame im 4x4-Sheet "coast"
  const WANG = [6, 7, 10, 9, 2, 11, 4, 15, 5, 14, 1, 8, 3, 0, 13, 12];

  function hashHue(str: string) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
    return h;
  }
  function hueColor(h: number) { return Phaser.Display.Color.HSLToColor(h / 360, 0.7, 0.55).color; }
  function hueColorLight(h: number) { return Phaser.Display.Color.HSLToColor(h / 360, 0.8, 0.75).color; }

  class BootScene extends Phaser.Scene {
    [key: string]: any;
    constructor() { super("Boot"); }
    preload() {
      // a.src ist im Dev-Server eine URL, im Single-File-Build eine Base64-Data-URI.
      // Der Phaser-Loader kommt mit beidem klar (Data-URIs laden ohne XHR – Doppelklick-tauglich).
      // Laden ist für plain wie sheet identisch; das Frame-Slicing folgt erst in create().
      for (const a of ASSET_MANIFEST) this.load.image(a.key, a.src);
    }
    create() {
      // Nur Sheets in Frames schneiden; plains bleiben ganze Bilder. Spaltenzahl und
      // Frame-Größe kommen aus dem Manifest (Default 16), nicht mehr aus Listen hier.
      for (const a of ASSET_MANIFEST) {
        if (a.kind !== "sheet") continue;
        const frame = a.frame ?? T;
        const tex = this.textures.get(a.key);
        const img = tex.getSourceImage();
        const rows = Math.floor(img.height / frame);
        for (let i = 0; i < a.cols * rows; i++) {
          tex.add(i, 0, (i % a.cols) * frame, Math.floor(i / a.cols) * frame, frame, frame);
        }
      }
      // #191: Mit ?maptest in der URL startet statt der Welt die Tiled-Loader-Testszene
      // (parallel zur prozeduralen buildMap()). Sonst ganz normal die WorldScene.
      const params = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
      this.scene.start(params.has("maptest") ? "MapTest" : "World");
    }
  }

  class WorldScene extends Phaser.Scene {
    [key: string]: any;
    // Das Spiel nutzt this.events als eigenen Event-/Timer-Beutel und überschreibt
    // damit Phasers geerbten EventEmitter-Typ (reines Typ-Override, kein Verhalten).
    events: any;
    constructor() { super("World"); }

    /* ============ Aufbau ============ */
    create() {
      setWorldScene(this);
      this.W = 52; this.H = 40;
      this.ground = new Array(this.W * this.H).fill(0);
      this.solidGrid = new Uint8Array(this.W * this.H);
      this.decoList = [];
      this.labels = [];
      this.dynLabels = [];   // dynamische Cluster-Tags (Nähe-Aufdeckung): { obj, x, y }
      this.podSlots = {};
      this.slotUsed = new Array(36).fill(false);
      this.dynamic = { barrelsSig: "", flagsSig: "", svcSig: "", depSig: "" };
      this.events = { nextPirate: 0, pirate: null, nextKraken: 0, kraken: null, nextStorm: 0, storm: null, stormFlash: null };
      this.archipelArmed = false;   // #92: Archipel-Warp erst nach Tasten-Loslassen scharf (kein Pingpong)

      // Performance-Budget (#82): Off-screen-Culling + Messung.
      // cullables = statische Deko (Blumen, Gras, Büsche, Steine, Bäume …), die
      // außerhalb des Sichtfelds ausgeblendet wird. Nur Optik – Kollision (solidGrid)
      // bleibt unberührt. Debug-Schalter über die URL:
      //   ?perf        → FPS/Sprite-HUD einblenden (Messbeleg vor/nach)
      //   ?stress=N    → Deko-Dichte ×N (künstlich „vergrößerte" Karte zum Messen)
      this.cullables = [];               // { obj, x, y }
      this.visibleCullables = 0;
      this.lastCullX = NaN; this.lastCullY = NaN;
      this.fpsSampler = new FrameSampler();
      const params = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
      this.debugPerf = params.has("perf");
      this.stress = Math.max(1, Math.min(20, Math.floor(Number(params.get("stress")) || 1)));

      // Pixel-Textur für Partikel
      const g = this.make.graphics({ add: false } as any);
      g.fillStyle(0xffffff); g.fillRect(0, 0, 2, 2);
      g.generateTexture("px", 2, 2); g.destroy();
      this.makeFxTextures();   // weiche Schatten- & Glüh-Textur (#4)
      this.lampGlows = [];     // Laternen-Glühen, das nachts aufleuchtet (#4)

      // #192: Mit ?tiledmap kommt die Hafenkarte aus assets/maps/harbor.tmj statt
      // aus der prozeduralen buildMap() – pixelgleich (gleicher Renderer), nur die
      // Geometrie-Quelle wechselt. buildMap() bleibt der Default.
      this.tiledMap = params.has("tiledmap");
      if (this.tiledMap) this.loadHarborMap(); else this.buildMap();
      this.renderGround();
      this.renderStatics();
      this.spawnFlowers();
      this.spawnGrassDetail();   // #40: dichtes, variiertes Gras (Stardew-Look)
      this.spawnNpcs();
      this.spawnPlayer();
      this.scatter("bush", 16, 0.5, [0, 1, 2], true);      // Büsche: solide, nicht an Wegen
      this.scatter("rock", 14, 0.45, [0, 1, 2, -3], true); // Steine: solide, auch am Strand
      this.scatter("lamppost", 4, 0.55, [0, 1, 2], true);  // ein paar Hafenlaternen
      this.scatter("mushroom", 10, 0.28, [0, 1, 2]);       // Pilze: kleine Wald-/Wiesendeko, begehbar (#7)
      this.scatter("seashell", 8, 0.22, [-3]);             // Muscheln: nur am Sandstrand (#7)
      this.scatter("driftwood", 5, 0.3, [-3]);             // Treibholz: nur am Sandstrand (#7)

      this.splash = this.add.particles(0, 0, "px", {
        speed: { min: 25, max: 80 }, angle: { min: 200, max: 340 }, gravityY: 140,
        lifespan: 550, scale: { start: 1.6, end: 0.4 }, tint: FOAM, emitting: false,
      }).setDepth(9000);
      this.dust = this.add.particles(0, 0, "px", {
        speed: { min: 10, max: 40 }, angle: { min: 220, max: 320 }, gravityY: 60,
        lifespan: 450, scale: { start: 1.4, end: 0.3 }, tint: 0xd9b380, emitting: false,
      }).setDepth(9000);
      this.sparkle = this.add.particles(0, 0, "px", {
        speed: { min: 30, max: 90 }, gravityY: -20, lifespan: 700,
        scale: { start: 1.6, end: 0 }, tint: 0xffc857, emitting: false,
      }).setDepth(9000);

      // Sturm: Regen + dunkler Schleier (anfangs aus)
      this.rain = this.add.particles(0, 0, "px", {
        x: { min: 0, max: this.W * T }, y: -8,
        speedY: { min: 190, max: 250 }, speedX: { min: -35, max: -20 },
        scaleX: 0.5, scaleY: 2.4, alpha: 0.38, tint: 0xa8c8f0,
        lifespan: 3800, frequency: 7, quantity: 2,
      }).setDepth(10400);
      this.rain.stop();
      this.stormOverlay = this.add.rectangle(0, 0, this.W * T, this.H * T, 0x0e1830, 0.32).setOrigin(0).setDepth(10300).setVisible(false);

      // Tag-Nacht-Lichtschleier (sanft animiert) – über der Welt, aber unter Sturm/Regen (#4)
      this.dayNight = this.add.rectangle(0, 0, this.W * T, this.H * T, 0x0a1230, 0).setOrigin(0).setDepth(10200);

      const cam = this.cameras.main;
      cam.setBounds(0, 0, this.W * T, this.H * T);
      cam.setZoom(3);
      cam.startFollow(this.playerSprite, true, 0.15, 0.15);

      this.scale.on("resize", () => cam.setZoom(window.innerWidth < 900 ? 2.4 : 3));

      // Performance-HUD (#82, nur mit ?perf in der URL): FPS + Sprite-Zahl als
      // Messbeleg, dass das Culling wirkt (sichtbar/gesamt fällt beim Scrollen).
      if (this.debugPerf) {
        this.perfHud = this.add.text(4, 4, "", {
          fontFamily: "Consolas, monospace", fontSize: "9px", color: "#9effa0",
          backgroundColor: "rgba(0,0,0,0.6)", padding: { left: 5, right: 5, top: 3, bottom: 3 }, resolution: 3,
        }).setScrollFactor(0).setDepth(30000);
      }

      this.scheduleEvents(60); // erste Events frühestens nach 1 Minute

      // Möwen für die Hafen-Atmosphäre
      this.time.addEvent({ delay: 6500, loop: true, callback: () => { if (Math.random() < 0.65) this.spawnGull(); } });
      this.spawnGull();
    }

    spawnGull() {
      const y = Phaser.Math.Between(2, 22) * T;
      const fromLeft = Math.random() < 0.5;
      const gull = this.add.container(fromLeft ? -20 : this.W * T + 20, y).setDepth(11000);
      const w1 = this.add.rectangle(-0.5, 0, 4, 1.3, 0xf5f7fa).setOrigin(1, 0.5).setAngle(-18);
      const w2 = this.add.rectangle(0.5, 0, 4, 1.3, 0xf5f7fa).setOrigin(0, 0.5).setAngle(18);
      gull.add([w1, w2]);
      this.tweens.add({ targets: w1, angle: -42, duration: 240, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      this.tweens.add({ targets: w2, angle: 42, duration: 240, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      this.tweens.add({ targets: gull, y: y + Phaser.Math.Between(-30, 30), duration: 4000, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      this.tweens.add({
        targets: gull, x: fromLeft ? this.W * T + 30 : -30,
        duration: Phaser.Math.Between(10000, 16000),
        onComplete: () => gull.destroy(),
      });
    }

    set(x: number, y: number, v: number) { this.ground[y * this.W + x] = v; }
    get(x: number, y: number) {
      if (x < 0 || y < 0 || x >= this.W || y >= this.H) return -2;
      return this.ground[y * this.W + x];
    }
    deco(x: number, y: number, sheet: string, idx: number, solid?: boolean) {
      this.decoList.push({ x, y, sheet, idx });
      if (solid) this.solidGrid[Math.round(y) * this.W + Math.round(x)] = 1;
    }
    tree(x: number, y: number) {
      const kind = ((x * 7 + y * 13) % 3 === 0) ? "pine" : "tree";   // gemischter Wald: meist Laubbaum, dazwischen Tanne
      this.decoList.push({ x, y, sheet: kind, obj: true, scale: kind === "pine" ? 0.95 : 1.1 }); // ~3 Kacheln (Mensch = 1)
      this.solidGrid[Math.round(y) * this.W + Math.round(x)] = 1;
    }
    objDeco(x: number, y: number, tex: string, scale: number, solid?: boolean) {
      // ein PixelLab-Objekt als Deko (unten verankert, Tiefe nach y), optional solide
      this.decoList.push({ x, y, sheet: tex, obj: true, scale });
      if (solid) this.solidGrid[Math.round(y) * this.W + Math.round(x)] = 1;
    }

    /** Statisches Render-Objekt fürs Off-screen-Culling registrieren (#82).
     *  (px,py) = Welt-Pixel-Anker (für die Sichtfeld-Prüfung). Gibt das Objekt
     *  durch, damit Aufrufer es weiter verketten können. */
    registerCullable<T extends Phaser.GameObjects.Components.Visible>(obj: T, px: number, py: number): T {
      this.cullables.push({ obj, x: px, y: py } as Cullable);
      return obj;
    }
    /** PixelLab-Gebäude: ein ganzes Haus als Bild über der w×3-Kachel-Grundfläche.
     *  Kollision = die Grundfläche solide (wie früher); das hohe Dach ragt sichtbar
     *  nach oben (begehbar dahinter, Tiefe nach Fußlinie → korrektes Vorne/Hinten). */
    building(x: number, y: number, w: number, tex: string, scale: number) {
      for (let i = 0; i < w; i++) for (let r = 0; r < 3; r++) this.solidGrid[(y + r) * this.W + (x + i)] = 1;
      const cx = (x + w / 2) * T, baseY = (y + 3) * T;
      this.add.image(cx, baseY, tex).setOrigin(0.5, 1).setScale(scale).setDepth(baseY);
    }

    /** Hafenkarte prozedural aufbauen (Default-Pfad). Die reine Boden-/Kollisions-
     *  Geometrie liegt seit #192 Phaser-frei in harbormap.ts (harborGeometry) –
     *  damit sie als assets/maps/harbor.tmj serialisiert und im Datenpfad
     *  (loadHarborMap) wieder geladen werden kann. Die sichtbaren Objekte und die
     *  davon abhängigen Felder setzt placeHarborObjects() – in BEIDEN Pfaden gleich. */
    buildMap() {
      const geo = harborGeometry(this.W, this.H);
      this.ground = geo.ground;
      this.solidGrid = Uint8Array.from(geo.solid);
      this.placeHarborObjects();
    }

    /** Datenpfad (#192, Epic #57): Boden + Kollision aus assets/maps/harbor.tmj
     *  laden statt sie prozedural zu erzeugen, dann dieselben Objekte platzieren.
     *  Ergebnis ist pixelgleich zu buildMap() (gleicher Renderer, gleiche
     *  Geometrie), kommt aber aus der Datei – der Beweis, dass der Tiled-Loader die
     *  echte Welt trägt. Erreichbar über ?tiledmap; buildMap() bleibt Default. */
    loadHarborMap() {
      const entry = getMapEntry("harbor");
      const map = entry.parse(JSON.parse(entry.raw));
      this.ground = entry.decodeGround!(map);
      this.solidGrid = new Uint8Array(this.W * this.H);
      collisionGrid(map, entry.collisionLayer).forEach((solid, i) => { if (solid) this.solidGrid[i] = 1; });
      this.placeHarborObjects();
    }

    /** Sichtbare Hafen-Objekte (Bäume, Stege-Schilder, Schiff, Markt, Gebäude,
     *  Deko, Leuchtturm, Türen) + die davon abhängigen Szenen-Felder (piers, ship,
     *  flagPoles, lighthouse, tfPlatform, labels). Solids von Gebäuden/Bäumen/Deko
     *  und das Freiräumen der Türen passieren hier – idempotent über dem geladenen
     *  Kollisionsraster, also identisch in beidem Pfaden. Die harbor.tmj trägt nur
     *  die Terrain-Kollision; Gebäude/NPCs/Türen wandern erst in #194/#195 in
     *  Tiled-Objektlayer (Boden/Wege/Wasser-Kollision sind hier schon datengetrieben). */
    placeHarborObjects() {
      const W = this.W;
      // Waldsaum: oben durchgehend, an den Seitenrändern bis zur Küste
      for (let x = 0; x < W; x++) this.tree(x, 0);
      for (let y = 0; y < 24; y++) { this.tree(0, y); this.tree(W - 1, y); }

      // Stege = Cluster-Knoten (Steg-Geometrie liegt in harborGeometry; hier nur
      // die Knoten-Daten + Schilder, an denselben Spalten PIER_XS).
      this.piers = PIER_XS.map((x, i) => ({ x, name: ["ahoi-control", "ahoi-worker-1", "ahoi-worker-2"][i] }));
      for (const p of this.piers) this.labels.push({ x: p.x + 1.5, y: 27.4, text: p.name, color: "#ffd97a" });
      this.labels.push({ x: 6.5, y: 23.4, text: "Bos Dock", color: "#ffffff" });

      // Dein Schiff (Grundfläche aus world.ts SHIP – Single Source of Truth, #42).
      // Die Schiffs-Terrain-Geometrie (#108: Schiff SCHWIMMT – Wasser unterm Rumpf +
      // schmaler Holz-Steg SHIP_PIER, kein rechteckiges Deck) liegt in harborGeometry;
      // hier nur das Daten-Feld + Schild.
      this.ship = { x: SHIP.x, y: SHIP.y, w: SHIP.w, h: SHIP.h };
      this.labels.push({ x: this.ship.x + 4.5, y: this.ship.y - 0.6, text: "Dein Schiff", color: "#ffffff" });

      // Anleger zum GitOps-Archipel (#92): Schild am Steg ins offene Wasser.
      this.labels.push({ x: WORLD_JETTY.x + WORLD_JETTY.w / 2, y: WORLD_JETTY.y0 - 0.7, text: "Zum Archipel", color: "#ffe9b0" });

      // Marktplatz
      this.objDeco(28, 18, "well", 0.55, true);
      this.objDeco(31, 16, "stall", 0.6, true);
      this.labels.push({ x: 31.5, y: 15.4, text: "Markt", color: "#ffffff" });
      this.objDeco(24, 22, "signpost", 0.6, false);

      // Gebäude & Zonen
      this.building(23, 10, 7, "house_office", 1.05);
      this.labels.push({ x: 26.5, y: 9.4, text: "Hafenmeisterei", color: "#ffffff" });
      this.building(8, 8, 5, "house_forge", 0.82);
      this.deco(12, 12, "dungeon", ANVIL, true);
      this.deco(14, 12, "dungeon", TABLE, true);
      this.deco(14, 11.6, "dungeon", DEVICE, false);
      this.labels.push({ x: 12.5, y: 7.4, text: "Werft", color: "#ffffff" });
      this.flagPoles = [{ x: 9, y: 10 }, { x: 10.5, y: 10 }, { x: 16, y: 10 }];

      this.building(38, 9, 5, "house_chart", 0.9);
      this.labels.push({ x: 40.5, y: 8.4, text: "Kartenhaus", color: "#ffffff" });

      this.deco(43, 19, "dungeon", TABLE, true);
      this.deco(43, 18.6, "dungeon", BOOK, false);
      this.labels.push({ x: 43.5, y: 17.4, text: "Vermessung", color: "#ffffff" });

      this.tfPlatform = { x: 44, y: 28, w: 7, h: 5 };

      // Leuchtturm (Sturmwache Juno)
      this.lighthouse = { x: 48, y: 24 };
      for (const [lx, ly] of [[47, 23], [48, 23], [47, 24], [48, 24]]) this.solidGrid[ly * W + lx] = 1;
      this.labels.push({ x: 48, y: 21.2, text: "Leuchtturm", color: "#ffffff" });

      const spots = [[5, 5], [7, 3], [15, 4], [20, 6], [33, 5], [36, 4], [44, 5], [47, 8], [47, 13], [36, 15], [20, 12], [5, 17], [3, 21], [8, 20], [18, 16], [34, 9], [30, 7], [45, 15], [37, 22], [6, 22], [21, 21]];
      spots.forEach(([x, y]) => this.tree(x, y));
      this.deco(16, 21, "town", 29, false);   // Pilze (Kenney) – noch kein PixelLab-Ersatz, bleibt vorerst

      this.carveDoors();   // #6: Häuser betretbar machen
    }

    /** #6: In jede Gebäude-Front eine begehbare Tür schneiden (Solid-Kachel der
     *  unteren Mittel-Kachel wieder freigeben) und sichtbar markieren. Das
     *  Betreten erkennt update() über doorAt() der reinen world-Geometrie. */
    carveDoors() {
      for (const d of DOORS) {
        this.solidGrid[d.ty * this.W + d.tx] = 0;
        this.makeDoor(d.tx, d.ty);
      }
    }

    /** Eine sichtbare Holztür auf der vorderen Gebäudekante (Fußlinie der Kachel),
     *  Tiefe knapp vor der Hauswand, damit sie auf der Front sitzt. */
    makeDoor(tx: number, ty: number) {
      const cx = tx * T + 8, baseY = (ty + 1) * T;
      const frame = this.add.rectangle(0, 0, 12, 15, 0x33210f).setOrigin(0.5, 1);   // dunkler Rahmen
      const leaf = this.add.rectangle(0, -1, 9, 12, 0x6b4a2a).setOrigin(0.5, 1);     // Türblatt
      const seam = this.add.rectangle(0, -1, 1, 12, 0x4a3219).setOrigin(0.5, 1);     // Mittelfuge
      const knob = this.add.circle(2.5, -6, 1, 0xffd97a);                            // Türknauf
      this.add.container(cx, baseY, [frame, leaf, seam, knob]).setDepth(baseY + 0.5);
    }

    renderGround() {
      const rt = this.add.renderTexture(0, 0, this.W * T, this.H * T).setOrigin(0).setDepth(0);
      // Meer als Hintergrund-Fallback (wird von den Wang-Wasserkacheln überdeckt)
      rt.fill(WATER, 1, 0, 24 * T, this.W * T, (this.H - 24) * T);

      // PixelLab-Terrain: Wasser(0) < Sand(1) < Gras/Land(2) < Weg(3). Wasser-Ränder nach Material.
      const lv = (cx: number, cy: number) => {
        const ix = cx < 0 ? 0 : cx >= this.W ? this.W - 1 : cx;
        const iy = cy < 0 ? 0 : cy >= this.H ? this.H - 1 : cy;
        const c = this.ground[iy * this.W + ix];
        return c === -2 ? 0 : c === -3 ? 1 : c === 25 ? 3 : 2;
      };
      const rawAt = (cx: number, cy: number) => {
        const ix = cx < 0 ? 0 : cx >= this.W ? this.W - 1 : cx;
        const iy = cy < 0 ? 0 : cy >= this.H ? this.H - 1 : cy;
        return this.ground[iy * this.W + ix];
      };
      // Eck-Code (NW,NE,SW,SE) gegen Schwelle hi: Ecke >= hi => "oben" (Bit gesetzt)
      const corners = (x: number, y: number, hi: number) =>
        (((lv(x - 1, y - 1) >= hi ? 1 : 0) << 3) | ((lv(x, y - 1) >= hi ? 1 : 0) << 2) |
         ((lv(x - 1, y) >= hi ? 1 : 0) << 1) | (lv(x, y) >= hi ? 1 : 0));
      const has = (x: number, y: number, t: number) =>
        lv(x - 1, y - 1) === t || lv(x, y - 1) === t || lv(x - 1, y) === t || lv(x, y) === t;
      // Wasser-Rand-Set nach Nachbar-Material: Holz (Steg/Schiff) > Stein (Kai) > Sand (Küste)
      const edgeSet = (x: number, y: number) => {
        const cs = [rawAt(x - 1, y - 1), rawAt(x, y - 1), rawAt(x - 1, y), rawAt(x, y)];
        if (cs.some((c) => c === -10)) return "dock";   // Holz-Steg/Anleger (#108: kein Schiffsdeck-Holz mehr)
        if (cs.some((c) => c === 96 || c === 97 || c === 98)) return "kai";
        return "coast";
      };

      for (let y = 0; y < this.H; y++) {
        for (let x = 0; x < this.W; x++) {
          const v = this.get(x, y);
          if (has(x, y, 0)) {                                              // berührt Wasser -> Rand-Set nach Material
            rt.drawFrame(edgeSet(x, y), WANG[corners(x, y, 1)], x * T, y * T);
          } else if (v === -10) {                                         // Steg/Anleger innen -> volle Planke
            rt.drawFrame("dock", WANG[15], x * T, y * T);
          } else if (v === 96 || v === 97 || v === 98) {                  // Stein-Kai innen -> voller Stein
            rt.drawFrame("kai", WANG[15], x * T, y * T);
          } else if (has(x, y, 3)) {                                      // Gras/Weg-Ebene
            rt.drawFrame("path", WANG[corners(x, y, 3)], x * T, y * T);
          } else {                                                        // Sand/Gras-Ebene
            rt.drawFrame("meadow", WANG[corners(x, y, 2)], x * T, y * T);
          }
        }
      }
      // Wellen-Glitzer
      for (let i = 0; i < 60; i++) {
        const x = Phaser.Math.Between(1, this.W - 2), y = Phaser.Math.Between(28, this.H - 1);
        if (this.get(x, y) !== -2) continue;
        const s = this.add.image(x * T + Phaser.Math.Between(2, 12), y * T + Phaser.Math.Between(3, 12), "px")
          .setScale(2.5, 0.8).setTint(FOAM).setAlpha(0).setDepth(1);
        this.tweens.add({ targets: s, alpha: { from: 0, to: 0.55 }, duration: Phaser.Math.Between(900, 1800), yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 2000) });
      }
      // Wellen, die Richtung Küste rollen
      for (let i = 0; i < 14; i++) {
        const wv = this.add.image(0, 0, "px").setScale(Phaser.Math.Between(6, 11), 0.8).setTint(0xdfeefb).setAlpha(0).setDepth(1);
        const reset = () => {
          wv.x = Phaser.Math.Between(2, this.W - 2) * T;
          wv.y = Phaser.Math.Between(30, this.H - 2) * T;
        };
        reset();
        this.tweens.add({
          targets: wv, y: "-=10", alpha: { from: 0, to: 0.45 },
          duration: Phaser.Math.Between(1700, 2700), yoyo: true, repeat: -1,
          delay: Phaser.Math.Between(0, 2600), onRepeat: reset,
        });
      }
    }

    /** Festes Orts-Schild: eingravierte Schrift auf einem PixelLab-Holzbrett,
     *  per 9-Slice auf jede Textlänge gedehnt (Rahmen bleibt fix, Mitte streckt).
     *  Am 16px-Maßstab orientiert (knappes Padding + leicht runterskaliert) und per
     *  y-Tiefe in die Welt einsortiert, damit es Fässer/Pod-Kisten/Tech-Tags nicht verdeckt. */
    makeSign(x: number, y: number, text: string) {
      const txt = this.add.text(0, 0, text, {
        fontFamily: "Verdana, 'Segoe UI', sans-serif", fontSize: "5px",
        color: "#3a2410", resolution: 10,
      }).setOrigin(0.5).setShadow(0, 0.5, "rgba(255,243,214,0.45)", 0);
      const w = Math.max(18, Math.ceil(txt.width) + 10);
      const h = Math.max(13, Math.ceil(txt.height) + 7);
      const board = this.add.nineslice(0, 0, "sign", undefined, w, h, 8, 8, 8, 6).setOrigin(0.5);
      board.y = -h / 2; txt.y = -h / 2;   // unten am Bezugspunkt verankert (wie altes origin 0.5,1)
      // Tiefe = Welt-y (wie Bäume/Fässer/Krabben): Objekte derselben/näheren Reihe liegen davor
      // statt darunter; Tech-Tags (Tiefe 9600) bleiben ohnehin oben → nichts wird mehr verdeckt.
      return this.add.container(x, y, [board, txt]).setScale(0.8).setDepth(y);
    }

    /** „Digitales" Cluster-Tag: Monospace + farbiger Status-Punkt (grün ok / rot kaputt
     *  / gelb Warnung). Startet unsichtbar – wird per Nähe-Aufdeckung eingeblendet. */
    makeTechTag(x: number, y: number, text: string, statusColor: number) {
      const txt = this.add.text(0, 0, text, {
        fontFamily: "Consolas, 'Courier New', monospace", fontSize: "5px", color: "#e3edf8",
        backgroundColor: "rgba(10,16,28,0.82)", padding: { left: 8, right: 4, top: 1, bottom: 1 }, resolution: 10,
      }).setOrigin(0.5);
      const dot = this.add.circle(-txt.width / 2 + 4.5, 0, 1.5, statusColor);
      txt.y = -txt.height / 2; dot.y = -txt.height / 2;   // unten verankert (über dem Objekt)
      return this.add.container(x, y, [txt, dot]).setDepth(9600).setAlpha(0);
    }

    /** Weicher Schatten unter einer Figur – radial ausgefranste Textur statt harter Ellipse (#4). */
    addShadow(x: number, y: number, w?: number) {
      const width = w || 10;
      return this.add.image(x, y, "shadowSoft").setDisplaySize(width * 1.5, width * 0.6).setAlpha(0.32).setDepth(1.6);
    }

    /** Einmalig erzeugte FX-Texturen: weicher Schatten (Ellipse mit Verlauf) und
     *  weiches Glühen (Kreis mit Verlauf, wird beim Einsatz eingefärbt). (#4) */
    makeFxTextures() {
      const steps = 10;
      // Schatten: konzentrische Ellipsen, außen fast transparent → innen dunkel
      const sw = 48, sh = 24, sg = this.make.graphics({ add: false } as any);
      for (let i = steps; i >= 1; i--) {
        const t = i / steps;
        sg.fillStyle(0x000000, 0.1);
        sg.fillEllipse(sw / 2, sh / 2, sw * t, sh * t);
      }
      sg.generateTexture("shadowSoft", sw, sh); sg.destroy();
      // Glühen: konzentrische weiße Kreise mit weichem Rand
      const gs = 40, gg = this.make.graphics({ add: false } as any);
      for (let i = steps; i >= 1; i--) {
        const t = i / steps;
        gg.fillStyle(0xffffff, 0.09);
        gg.fillCircle(gs / 2, gs / 2, (gs / 2) * t);
      }
      gg.generateTexture("glowSoft", gs, gs); gg.destroy();
    }

    spawnFlowers() {
      // Wildblumen (PixelLab) fest auf freie Gras-Zellen gestreut – bricht das
      // wiederholte Gras-Tile gleichmäßig auf. Jetzt deterministisch statt bei
      // jedem Neuladen neu gewürfelt (#3): gleiche Welt → gleiche Blumen.
      const accept = (x: number, y: number) => {
        const v = this.ground[y * this.W + x];
        return (v === 0 || v === 1 || v === 2) && !this.solidGrid[y * this.W + x];
      };
      for (const p of pickPlacements({
        W: this.W, H: this.H, count: 30 * this.stress, seed: strSeed("flowers"), accept,
        jitter: { x: [2, 14], y: [8, 15] },
      })) {
        // Origin am Boden; leichte feste Neigung (-3..+3°) bricht den Gleichtakt – ohne Bewegung (#30)
        const angle = Math.round(hash01(strSeed("flower-angle"), p.x, p.y) * 6) - 3;
        const img = this.add.image(p.x * T + p.jx, p.y * T + p.jy, "flowers")
          .setOrigin(0.5, 1).setScale(0.35).setDepth(p.y * T + 6).setAngle(angle);
        this.registerCullable(img, p.x * T + p.jx, p.y * T + p.jy);
      }
    }

    /** Dichte Gras-Büschel über die Wiese streuen (#107, Stardew-Look). Macht aus
     *  dem wiederholten Wang-Gras-Tile eine abwechslungsreiche Wiese: viele kleine
     *  Büschel aus echten PixelLab-Pixelart-Sprites (grasstuft0..2), jedes per
     *  grassTuftStyle deterministisch in Form-Variante, Helligkeit, Neigung, Größe
     *  und Spiegelung variiert. Ersetzt die früheren prozedural gezeichneten
     *  Dreieck-Halme aus #40. Platzierung wie bei den Blumen rein deterministisch
     *  (#3) – gleiche Welt → gleiche Wiese, kein Flackern beim Laden. */
    spawnGrassDetail() {
      const VARIANTS = 3;
      // Die Sprites sind 64×64; auf ~Kachelhöhe herunterskaliert (zusätzlich × s.scale).
      const BASE = 0.26;
      const accept = (x: number, y: number) => {
        const v = this.ground[y * this.W + x];
        return (v === 0 || v === 1 || v === 2) && !this.solidGrid[y * this.W + x];
      };
      // Deutlich mehr Büschel als Blumen → die Wiese wirkt flächig bewachsen statt kahl.
      for (const p of pickPlacements({
        W: this.W, H: this.H, count: 140 * this.stress, seed: strSeed("grass-detail"), accept,
        jitter: { x: [1, 15], y: [6, 15] },
      })) {
        const s = grassTuftStyle(strSeed("grass-style"), p.x, p.y, VARIANTS);
        // Die Farbe trägt jetzt das Pixelart-Sprite selbst (#107). Pro Büschel nur noch
        // eine dezente Helligkeitsvariation (multiplikativer Grau-Tint ~0.82..1.0),
        // damit nicht jedes Büschel exakt gleich wirkt – ohne den Pixelart-Farbton zu
        // überfärben (das wäre der alte Stilbruch aus #40).
        const b = Math.round((0.82 + (s.shade * 0.5 + 0.5) * 0.18) * 255);
        const img = this.add.image(p.x * T + p.jx, p.y * T + p.jy, "grasstuft" + s.variant)
          .setOrigin(0.5, 1)
          .setScale((s.flip ? -1 : 1) * s.scale * BASE, s.scale * BASE)
          .setAngle(s.angle)
          .setTint(Phaser.Display.Color.GetColor(b, b, b))
          .setDepth(p.y * T + 4);             // y-sortiert, knapp unter Blumen/Objekten
        this.registerCullable(img, p.x * T + p.jx, p.y * T + p.jy);
      }
    }

    scatter(tex: string, count: number, scale: number, kinds: number[], solid = false) {
      // PixelLab-Objekte streuen: nur passende Felder, nie auf/neben Wege, nicht auf Solids, Spieler-Start frei.
      // Platzierung ist deterministisch (#3) – Büsche/Steine/Laternen sitzen bei jedem Laden an festen Stellen.
      const isDirt = (x: number, y: number) => this.ground[y * this.W + x] === 25;
      const pcx = Math.round(this.playerPos.x / T), pcy = Math.round(this.playerPos.y / T);
      const accept = (x: number, y: number) => {
        const v = this.ground[y * this.W + x];
        if (kinds.indexOf(v) < 0 || this.solidGrid[y * this.W + x]) return false;
        if (isDirt(x, y - 1) || isDirt(x, y + 1) || isDirt(x - 1, y) || isDirt(x + 1, y)) return false; // nicht an Wege grenzen
        if (Math.abs(x - pcx) <= 1 && Math.abs(y - pcy) <= 1) return false;                             // Spieler-Start freihalten
        return true;
      };
      // Seed je Sorte (aus dem Textur-Namen) → jede Deko-Art bekommt ihr eigenes festes Muster.
      for (const p of pickPlacements({
        W: this.W, H: this.H, count, seed: strSeed(tex), accept,
        jitter: { x: [2, 14], y: [6, 13] },
      })) {
        const ox = p.x * T + p.jx, oy = p.y * T + p.jy;
        const img = this.add.image(ox, oy, tex).setOrigin(0.5, 0.7).setScale(scale).setDepth(p.y * T + 7);
        this.registerCullable(img, ox, oy);   // #82: gestreute Deko cullen
        if (tex === "lamppost") {
          // Warmes Glühen am Laternenkopf – leuchtet bei Dämmerung/Nacht auf (#4)
          const glow = this.add.image(ox, img.getTopCenter().y + 7, "glowSoft").setDisplaySize(26, 26)
            .setTint(0xffd591).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(p.y * T + 6);
          this.lampGlows.push(glow);
          this.registerCullable(glow, ox, oy);   // Glühen mit der Laterne mit-cullen (kein Floating-Glow)
        }
        if (solid) this.solidGrid[p.y * this.W + p.x] = 1;
      }
    }

    /** Tag-Nacht-Zyklus: sanft animierter Lichtschleier über der Welt + Laternen-Glühen,
     *  das bei Dämmerung/Nacht aufleuchtet. Ein voller Tag dauert CYCLE ms. (#4) */
    updateDayNight(time: number) {
      const CYCLE = 1440000;                         // 24 Minuten realer Zeit = ein voller Tag (Stardew-Tempo) – Tempo hier justieren
      const phase = (time % CYCLE) / CYCLE;          // 0 = Mittag … 0.5 = Mitternacht … 1 = Mittag
      // Keyframes [phase, r, g, b, alpha] – dazwischen wird linear interpoliert
      const keys: number[][] = [
        [0.0,  10,  18, 48, 0.0],
        [0.2,  10,  18, 48, 0.0],
        [0.3,  255, 138, 60, 0.2],   // Abendrot
        [0.42, 40,  36, 80, 0.42],
        [0.5,  12,  20, 60, 0.55],   // tiefe Nacht
        [0.62, 12,  20, 60, 0.55],
        [0.72, 255, 150, 96, 0.26],  // Morgenrot
        [0.84, 10,  18, 48, 0.0],
        [1.0,  10,  18, 48, 0.0],
      ];
      let a = keys[0], b = keys[keys.length - 1];
      for (let i = 0; i < keys.length - 1; i++) {
        if (phase >= keys[i][0] && phase <= keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; break; }
      }
      const t = (phase - a[0]) / ((b[0] - a[0]) || 1);
      const lerp = (i: number) => a[i] + (b[i] - a[i]) * t;
      const color = Phaser.Display.Color.GetColor(Math.round(lerp(1)), Math.round(lerp(2)), Math.round(lerp(3)));
      const alpha = lerp(4);
      this.dayNight.setFillStyle(color).setAlpha(alpha);
      // Laternen an die Schleier-Dichte koppeln: glühen, sobald es dämmert
      const lampLvl = Phaser.Math.Clamp(alpha / 0.42, 0, 1) * 0.7;
      for (const lg of this.lampGlows) lg.setAlpha(lampLvl);
      // Uhrzeit + Datum aus derselben time/CYCLE-Quelle → garantiert synchron zum Schleier (#39)
      const clock = gameClock(time, CYCLE);
      UI.setClock(clock.dateLabel, clock.timeLabel, clock.title);
    }

    renderStatics() {
      // Deko (Bäume, Häuser, Möbel) – Tiefe nach y. Jedes Bild fürs Culling
      // registrieren (#82): außerhalb des Sichtfelds wird es ausgeblendet.
      for (const d of this.decoList) {
        const img = d.obj
          ? this.add.image(d.x * T + 8, d.y * T + 10, d.sheet).setOrigin(0.5, 0.7).setScale(d.scale || 1).setDepth(d.y * T + T)
          : this.add.image(d.x * T + 8, d.y * T + 8, d.sheet, d.idx).setDepth(d.y * T + T);
        this.registerCullable(img, d.x * T + 8, d.y * T + 8);
      }
      // === Dein Schiff: hübsches PixelLab-Holzschiff (#41) statt prozeduraler Primitive ===
      // Bug zeigt nach Osten, Heck rund nach Westen – passt zur alten Ausrichtung.
      // Das begehbare Deck bleibt unverändert (Kollisionsraster wird in buildMap gesetzt);
      // hier wird nur die Optik gerendert, Tiefe 2 wie zuvor, damit die Figur aufs Deck läuft.
      const s = this.ship, px = s.x * T, py = s.y * T, pw = s.w * T, ph = s.h * T;
      const midY = py + ph / 2;
      const shipImg = this.add.image(px + pw / 2, midY - 6, "ship").setDepth(2);
      const shipScale = (pw + 46) / shipImg.width;   // Rumpf etwas breiter als das Deck – Bug/Heck ragen über
      shipImg.setScale(shipScale);
      // Dynamische Fortschritts-Flagge am Masttop (Tint wird beim Sync gesetzt, s. shipFlag.setTint).
      // Mast sitzt im Asset knapp links der Bildmitte; Offsets relativ zur Bildmitte, mitskaliert.
      const mastTopX = shipImg.x + (-14) * shipScale + 7;
      const mastTopY = shipImg.y + (-76) * shipScale;
      this.shipFlag = this.add.image(mastTopX, mastTopY, "px").setScale(6, 4).setDepth(3);
      this.tweens.add({ targets: this.shipFlag, y: mastTopY - 2, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });

      // Companionway-Luke (#42): begehbarer Eingang zur Kajüte. Liegt auf SHIP_DOOR,
      // damit der Trigger (doorAt) optisch sichtbar ist. Tiefe knapp unter der Figur,
      // damit man sichtbar darüber steht, bevor der Szenenwechsel auslöst.
      const hx = SHIP_DOOR.tx * T + 8, hy = SHIP_DOOR.ty * T + 8, hatch = this.add.graphics().setDepth(SHIP_DOOR.ty * T);
      hatch.fillStyle(0x3a2e22); hatch.fillRoundedRect(hx - 8, hy - 7, 16, 14, 3);   // Holzrahmen
      hatch.fillStyle(0x140d08); hatch.fillRoundedRect(hx - 6, hy - 5, 12, 10, 2);   // dunkle Öffnung
      hatch.fillStyle(0x6b4f35); for (let i = 0; i < 3; i++) hatch.fillRect(hx - 5, hy - 3 + i * 3, 10, 1.4); // Leitersprossen
      this.labels.push({ x: SHIP_DOOR.tx + 0.5, y: SHIP_DOOR.ty - 0.7, text: "↓ Kajüte", color: "#ffe9b0" });

      // === Leuchtturm (Sturmwache) – PixelLab-Turm + rotierender Lichtkegel ===
      const lh = this.lighthouse, lx = lh.x * T + 8, lyB = (lh.y + 1) * T;
      const lhSc = 0.5;                                   // 45x100-Bild ~ auf alte Turmhöhe (~50px)
      this.add.ellipse(lx, lyB - 1, 28, 9, 0x5a6470).setDepth(lyB - 2);   // Felsen-Sockel
      this.add.image(lx, lyB, "lighthouse").setOrigin(0.5, 1).setScale(lhSc).setDepth(lyB + 4);
      const lampY = lyB - Math.round(100 * lhSc) + 9;    // Laternenraum nahe der Bildoberkante
      // Lichtkegel: weiches Dreieck (Spitze = Lampe), per ADD-Blend, dreht sich 360° übers Wasser
      if (!this.textures.exists("lhbeam")) {
        const bw = 84, bh = 34, bg = this.make.graphics({ add: false } as any);
        bg.fillStyle(0xffe9a0, 1); bg.fillTriangle(0, bh / 2, bw, 0, bw, bh);
        bg.generateTexture("lhbeam", bw, bh); bg.destroy();
      }
      this.lhBeam = this.add.image(lx, lampY, "lhbeam").setOrigin(0, 0.5)
        .setAlpha(0.13).setBlendMode(Phaser.BlendModes.ADD).setDepth(lyB + 3);
      this.tweens.add({ targets: this.lhBeam, angle: 360, duration: 4600, repeat: -1, ease: "Linear" });
      // pulsierendes Lämpchen im Laternenraum
      this.lhLight = this.add.image(lx, lampY, "px").setScale(4.5, 2.5).setTint(0xffe28a).setDepth(lyB + 5);
      this.tweens.add({ targets: this.lhLight, alpha: { from: 0.5, to: 1 }, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.inOut" });

      // === Schornstein-Rauch (Hafenmeisterei & Kartenhaus) ===
      for (const [sx, sy] of [[24.6, 10], [38.6, 9]]) {
        this.add.particles(sx * T, sy * T, "px", {
          speedY: { min: -14, max: -8 }, speedX: { min: -4, max: 4 },
          scale: { start: 1.1, end: 2.6 }, alpha: { start: 0.32, end: 0 },
          tint: 0xcdd4dd, lifespan: 2600, frequency: 650,
        }).setDepth(9400);
      }

      // === Schmetterlinge über den Wiesen ===
      this.butterflies = [[10, 8, 0xffd1e8], [30, 7, 0xfff3a8], [40, 16, 0xc9e8ff], [17, 18, 0xd8ffc4]].map(([bx, by, tint], i) => ({
        spr: this.add.image(bx * T, by * T, "px").setScale(1.3, 1).setTint(tint).setDepth(9300),
        ax: bx * T, ay: by * T, ph: i * 1.7, sp: 0.5 + i * 0.13,
      }));

      // Beschriftungen: feste Orts-Schilder (Holzbrett, 9-Slice)
      for (const l of this.labels) {
        this.makeSign(l.x * T, l.y * T, l.text);
      }

      // Terraform-Plateau (Container, an/aus je nach State)
      const p = this.tfPlatform;
      this.tfGroup = this.add.container(0, 0).setDepth(2);
      const tfRt = this.add.renderTexture(p.x * T, p.y * T, p.w * T, p.h * T).setOrigin(0);
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) tfRt.drawFrame("dungeon", WOOD[(x + y) % 3], x * T, y * T);
      tfRt.fill(FOAM, 0.7, 0, 0, p.w * T, 2);
      this.tfGroup.add(tfRt);
      const mkSign = (tx: number, ty: number, txt: string) => this.makeSign(tx, ty, txt);
      this.tfGroup.add(this.add.image((p.x + 1) * T + 8, (p.y + 1) * T + 8, "crate").setScale(0.6));
      this.tfGroup.add(this.add.image((p.x + 4) * T + 8, (p.y + 2) * T + 8, "crate").setScale(0.6));
      this.tfGroup.add(mkSign((p.x + 1.5) * T, (p.y + 0.9) * T, "worker-3"));
      this.tfGroup.add(mkSign((p.x + 4.5) * T, (p.y + 1.9) * T, "worker-4"));
      this.tfGroup.add(mkSign((p.x + 3.5) * T, (p.y - 0.2) * T, "ost-erweiterung"));
      this.tfGroup.setVisible(false);
      // Vermessungs-Bojen
      this.tfBuoys = [];
      for (const [bx, by] of [[p.x, p.y], [p.x + p.w - 1, p.y], [p.x, p.y + p.h - 1], [p.x + p.w - 1, p.y + p.h - 1]]) {
        const b = this.add.image(bx * T + 8, by * T + 8, "px").setScale(2.5, 3.5).setTint(0xff8c5a).setDepth(2).setVisible(false);
        this.tweens.add({ targets: b, y: by * T + 5, duration: 800, yoyo: true, repeat: -1, ease: "Sine.inOut" });
        this.tfBuoys.push(b);
      }

      // Hafen-Kanone (Shop-Upgrade)
      this.cannon = this.add.text(21 * T, 24 * T + 8, "💣", { fontSize: "10px", resolution: 6 }).setOrigin(0.5).setDepth(24 * T + 16).setVisible(false);

      // Anker-Marker am Archipel-Steg (#92): pulsierend, damit der Warp sichtbar ist.
      const ax = WORLD_TO_ARCHIPEL.tx * T + 8, ay = WORLD_TO_ARCHIPEL.ty * T + 8;
      const anchor = this.add.text(ax, ay - 4, "⚓", { fontSize: "11px", resolution: 6 }).setOrigin(0.5).setDepth(ay + 20);
      this.tweens.add({ targets: anchor, y: ay - 8, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });

      this.dynGroup = this.add.group(); // Fässer, Flaggen, Laternen, Labels (werden neu gebaut)
    }

    spawnNpcs() {
      // Feste Standplätze aus dem puren world-Modul; Kralle wird relativ zum
      // Schiff eingefügt (an Originalposition: vor Juno).
      const defs = [...NPC_SPAWNS];
      defs.splice(6, 0, { id: "kralle", x: this.ship.x + 7, y: this.ship.y + 1 });
      // #31: NPCs solide machen – man läuft nicht mehr durch sie hindurch.
      // Reden (E) bleibt möglich, weil nearestNpc von der Nachbarkachel aus greift.
      for (const idx of npcSolidIndices(defs, this.W, this.H)) this.solidGrid[idx] = 1;
      this.npcs = defs.map(d => {
        const meta = KQContent.NPCS[d.id as keyof typeof KQContent.NPCS];
        this.addShadow(d.x * T + 8, d.y * T + 15);
        const baseY = meta.tex ? d.y * T + 15 : d.y * T + 8;   // tex-Figur an den Schatten (d.y*T+15) verankern, Füße = Schatten
        const spr = meta.tex
          ? this.add.image(d.x * T + 8, baseY, meta.tex).setOrigin(0.5, 0.81).setScale(0.6).setDepth(d.y * T + T)
          : this.add.image(d.x * T + 8, baseY, "dungeon", meta.sprite).setDepth(d.y * T + T);
        this.tweens.add({ targets: spr, y: baseY - 1, duration: 900 + Math.random() * 400, yoyo: true, repeat: -1, ease: "Sine.inOut" });
        const marker = this.add.text(d.x * T + 8, d.y * T - 6, "!", { fontFamily: "Consolas", fontSize: "8px", color: "#ffc857", fontStyle: "bold", resolution: 8 })
          .setOrigin(0.5, 1).setDepth(10000).setShadow(0.5, 0.5, "#000", 1);
        this.tweens.add({ targets: marker, y: d.y * T - 9, duration: 500, yoyo: true, repeat: -1, ease: "Sine.inOut" });
        return { id: d.id, x: d.x, y: d.y, sprite: spr, marker };
      });
    }

    spawnPlayer() {
      const sp = Game.state.player;
      const spawn = getMapEntry("harbor").spawn;   // #193: Default-Spawn aus der Registry
      this.playerPos = {
        x: sp && sp.x ? sp.x : spawn.x * T,
        y: sp && sp.y ? sp.y : spawn.y * T,
        dir: 1, moving: false, face: "south",   // face: Blickrichtung für die 4-Richtungs-Sprites
      };
      this.playerShadow = this.addShadow(this.playerPos.x, this.playerPos.y + 6);
      this.playerSprite = this.add.image(this.playerPos.x, this.playerPos.y + 6, "char_player").setOrigin(0.5, 0.81).setScale(0.6).setDepth(this.playerPos.y + 8);
      this.petShadow = this.addShadow(0, 0, 7).setVisible(false);
      this.petSprite = this.add.image(0, 0, "dungeon", 124).setVisible(false).setDepth(1);
      this.petTrail = [];
      this.bobT = 0;
      this.stepAcc = 0;
    }
    get player() { return this.playerPos; }

    /* ============ Kollision & Bewegung ============ */
    isSolidAt(px: number, py: number) {
      const tx = Math.floor(px / T), ty = Math.floor(py / T);
      if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return true;
      const p = this.tfPlatform;
      if (tx >= p.x && tx < p.x + p.w && ty >= p.y && ty < p.y + p.h) {
        return !(Game.sim && Game.sim.tf.applied);
      }
      return !!this.solidGrid[ty * this.W + tx];
    }

    tryMove(dx: number, dy: number) {
      const pl = this.playerPos;
      // Kollision + Anti-Wedge liegen pur in world.ts (resolveMove) und sind dort
      // getestet; #36: steckt die Figur in einer soliden Kachel, kommt sie raus.
      const next = resolveMove((px, py) => this.isSolidAt(px, py), pl.x, pl.y, dx, dy);
      pl.x = next.x;
      pl.y = next.y;
    }

    nearestNpc() {
      const pl = this.playerPos;
      let best = null, bestD = 1.7 * T;
      for (const n of this.npcs) {
        const d = Math.hypot(n.x * T + 8 - pl.x, n.y * T + 8 - pl.y);
        if (d < bestD) { bestD = d; best = n; }
      }
      return best;
    }

    /** #6: Haus betreten – WorldScene schlafen legen (friert + blendet sie aus)
     *  und die InteriorScene als eigene Szene starten. Der Spieler wird vorher
     *  vor die Tür gesetzt, damit ein Speichern/Neuladen draußen landet (sonst
     *  würde man beim Laden direkt wieder in der Tür stehen). */
    enterInterior(door: Door) {
      const pl = this.playerPos;
      pl.x = door.tx * T + 8;
      pl.y = (door.ty + 1) * T + 4;   // eine Kachel unter der Tür, draußen
      pl.face = "south"; pl.moving = false;
      SFX.door();
      setInteriorOpen(true);
      this.scene.launch("Interior", { door });
      this.scene.sleep();
    }

    /** #92: Zum GitOps-Archipel übersetzen – analog zu enterInterior. Der Spieler
     *  wird vorher auf den Steg vor dem Anker zurückgesetzt (WORLD_RETURN), damit
     *  man symmetrisch dort ankommt, wo man abgelegt hat, ein Speichern/Neuladen
     *  draußen landet – und der Warp NICHT sofort erneut triggert: das Gate wird
     *  disarmt, bis die Lauftaste nach der Rückkehr einmal losgelassen wurde. */
    enterArchipel() {
      const pl = this.playerPos;
      pl.x = WORLD_RETURN.tx * T + 8;
      pl.y = WORLD_RETURN.ty * T + 8;
      pl.face = "north"; pl.moving = false;
      this.archipelArmed = false;
      SFX.door();
      setInteriorOpen(true);
      this.scene.launch("Archipel");
      this.scene.sleep();
    }

    /* ============ Effekte (von der UI aufrufbar) ============ */
    burstAt(x: number, y: number, kind: string) {
      const e = kind === "splash" ? this.splash : kind === "dust" ? this.dust : this.sparkle;
      e.explode(kind === "splash" ? 14 : 10, x, y);
    }
    burstAtPlayer(kind: string) { this.burstAt(this.playerPos.x, this.playerPos.y - 8, kind); }

    floatText(x: number, y: number, str: string, color?: string) {
      const t = this.add.text(x, y, str, { fontFamily: "Consolas", fontSize: "6px", color: color || "#ffd97a", resolution: 8 })
        .setOrigin(0.5).setDepth(10001).setShadow(0.5, 0.5, "#000", 1);
      this.tweens.add({ targets: t, y: y - 14, alpha: 0, duration: 1400, ease: "Sine.out", onComplete: () => t.destroy() });
    }

    /* ============ Cluster → Welt ============ */
    podSlotPos(slot: number) {
      const pier = this.piers[Math.floor(slot / 12)];
      const i = slot % 12;
      const col = i % 2 === 0 ? 0 : 2;
      const row = Math.floor(i / 2);
      return { x: (pier.x + col) * T + 8, y: (28 + row) * T + 8 };
    }

    syncCluster() {
      if (!Game.sim) return;
      const pods = [];
      for (const d of Game.sim.deployments) for (const p of d.pods) pods.push({ name: p.name, dep: d.name });
      const names = new Set(pods.map(p => p.name));

      for (const p of pods) {
        if (!this.podSlots[p.name]) {
          let slot = this.slotUsed.findIndex((u: boolean) => !u);
          if (slot === -1) slot = 0;
          this.slotUsed[slot] = true;
          const pos = this.podSlotPos(slot);
          const hue = hashHue(p.dep);
          const shadow = this.addShadow(pos.x, pos.y + 7, 11);
          const crate = this.add.image(pos.x, pos.y - 44, "crate").setScale(0.6).setDepth(pos.y + 8);
          const band = this.add.image(pos.x, pos.y - 44 - 5, "px").setScale(6, 1.5).setTint(hueColor(hue)).setDepth(pos.y + 9);
          this.tweens.add({ targets: [crate, band], y: "+=44", duration: 550, ease: "Bounce.easeOut",
            onComplete: () => this.burstAt(pos.x, pos.y + 4, "dust") });
          this.podSlots[p.name] = { slot, crate, band, shadow, dep: p.dep };
        }
      }
      for (const name of Object.keys(this.podSlots)) {
        if (!names.has(name)) {
          const info = this.podSlots[name];
          const pos = this.podSlotPos(info.slot);
          this.burstAt(pos.x, pos.y + 4, "splash");
          SFX.splash();
          info.crate.destroy(); info.band.destroy(); info.shadow.destroy();
          this.slotUsed[info.slot] = false;
          delete this.podSlots[name];
        }
      }

      // Kaputte Deployments: Kisten rot einfärben
      const brokenMap: Record<string, boolean> = {};
      for (const d of Game.sim.deployments) brokenMap[d.name] = !!d.broken;
      for (const info of Object.values(this.podSlots) as any[]) {
        info.crate.setTint(brokenMap[info.dep] ? 0xff8d8d : 0xffffff);
      }

      // Signaturen: Fässer / Flaggen / Laternen / Deployment-Labels nur bei Änderung neu bauen
      const dSig = Game.sim.deployments.map(d => d.name + d.replicas + (d.broken ? d.broken.type : "")).join("|");
      const bSig = Game.sim.docker.containers.map(c => c.name + c.running).join("|");
      const fSig = Game.sim.releases.map(r => r.name + r.revision).join("|");
      const sSig = Game.sim.services.map(s => s.name).join("|");
      if (dSig !== this.dynamic.depSig || bSig !== this.dynamic.barrelsSig || fSig !== this.dynamic.flagsSig || sSig !== this.dynamic.svcSig) {
        this.dynamic = { depSig: dSig, barrelsSig: bSig, flagsSig: fSig, svcSig: sSig };
        this.rebuildDynamic();
      }

      // Terraform-Plateau & Bojen
      const applied = Game.sim.tf.applied;
      this.tfGroup.setVisible(applied);
      this.tfBuoys.forEach((b: Phaser.GameObjects.Image) => b.setVisible(Game.sim.tf.initialized && !applied));
      this.cannon.setVisible(Game.hasUpgrade("kanone"));
    }

    rebuildDynamic() {
      this.dynGroup.clear(true, true);
      this.dynLabels = [];
      // Digitales Cluster-Tag bauen + für die Nähe-Aufdeckung registrieren.
      // (lx,ly) = Tag-Position, (ax,ay) = Bezugspunkt des Objekts (Distanz zur Figur).
      const mkTag = (lx: number, ly: number, str: string, status: number, ax: number, ay: number) => {
        const tag = this.makeTechTag(lx, ly, str, status);
        this.dynGroup.add(tag);
        this.dynLabels.push({ obj: tag, x: ax, y: ay });
      };

      // Deployment-Tags über der ersten Kiste (kaputte rot mit Status!)
      const seen: Record<string, boolean> = {};
      for (const d of Game.sim.deployments) {
        const first = d.pods[0] && this.podSlots[d.pods[0].name];
        if (first && !seen[d.name]) {
          seen[d.name] = true;
          const pos = this.podSlotPos(first.slot);
          const text = d.broken
            ? d.name + " ⚠ " + (d.broken.type === "imagepull" ? "ImagePullBackOff" : d.broken.type === "crashloop" ? "CrashLoopBackOff" : "Pending")
            : d.name + " " + d.replicas + "/" + d.replicas;
          mkTag(pos.x, pos.y - 12, text, d.broken ? 0xff7b7b : 0x6fe09a, pos.x, pos.y);
        }
      }
      // Docker-Fässer bei Bo (max. 10 sichtbar, Tags versetzt gegen Überlappung)
      Game.sim.docker.containers.slice(-10).forEach((c, i) => {
        const bx = (4 + (i % 5) * 2) * T + 8, by = (26 + Math.floor(i / 5) * 0.0) * T + 8;
        const barrel = this.add.image(bx, by, "barrel").setScale(0.5).setDepth(by + 8).setAlpha(c.running ? 1 : 0.45);
        this.dynGroup.add(barrel);
        mkTag(bx, by - 9 - (i % 2) * 7, c.name, c.running ? 0x6fe09a : 0x8a98a8, bx, by);
      });
      // Helm-Flaggen an der Werft
      Game.sim.releases.forEach((r, i) => {
        const pole = this.flagPoles[i % this.flagPoles.length];
        const fx = pole.x * T + 8, fy = pole.y * T;
        const mast = this.add.image(fx, fy, "px").setScale(1, 15).setTint(0x6b5436).setDepth(fy + 30);
        const flag = this.add.image(fx + 6, fy - 12, "px").setScale(6, 3.5).setTint(hueColor(hashHue(r.name))).setDepth(fy + 31);
        this.tweens.add({ targets: flag, y: fy - 14, duration: 600, yoyo: true, repeat: -1, ease: "Sine.inOut" });
        this.dynGroup.add(mast); this.dynGroup.add(flag);
        mkTag(fx + 4, fy - 18, r.name + " rev" + r.revision, 0x6fd0e6, fx, fy - 8);
      });
      // Service-Laternen am Dockrand
      Game.sim.services.forEach((s, i) => {
        const lx = (6 + i * 4) * T + 8, ly = 23 * T + 8;
        const post = this.add.image(lx, ly + 2, "px").setScale(1, 6).setTint(0x5a4632).setDepth(ly + 8);
        const lamp = this.add.image(lx, ly - 5, "px").setScale(3, 2.5).setTint(0xffdc78).setDepth(ly + 9);
        this.tweens.add({ targets: lamp, alpha: { from: 0.55, to: 1 }, duration: 800, yoyo: true, repeat: -1 });
        this.dynGroup.add(post); this.dynGroup.add(lamp);
        mkTag(lx, ly - 10, s.name, 0x6fd0e6, lx, ly);
      });
    }

    /** Nähe-Aufdeckung: dynamische Cluster-Tags nur nahe der Figur einblenden
     *  (sanfter Fade), damit nie alle gleichzeitig sichtbar sind und überlappen. */
    revealNearbyLabels() {
      const pl = this.playerPos;
      const FULL = 42, FADE = 84;   // px: voll sichtbar <=FULL, ausgeblendet >=FADE
      for (const dl of this.dynLabels) {
        const d = Math.hypot(dl.x - pl.x, dl.y - pl.y);
        const a = d <= FULL ? 1 : d >= FADE ? 0 : 1 - (d - FULL) / (FADE - FULL);
        dl.obj.setAlpha(a).setVisible(a > 0.02);
      }
    }

    /** Off-screen-Culling der statischen Deko (#82). Gedrosselt: die (potentiell
     *  tausende) Sprites werden nur neu geprüft, wenn die Kamera nennenswert
     *  gescrollt ist – in ruhigen Frames kostet das Culling so gut wie nichts.
     *  Der großzügige Rand (MARGIN) verhindert Pop-in: hohe Objekte (Bäume) ragen
     *  weit über ihren Fuß-Anker, müssen also schon „aktiv" werden, bevor der
     *  Anker ins Bild scrollt. Reine Optik – das solidGrid bleibt unangetastet. */
    cullDecor(delta: number) {
      this.fpsSampler.push(delta);
      const cam = this.cameras.main, wv = cam.worldView;
      // worldView ist erst nach dem ersten Render gefüllt; vorher (Breite 0) warten.
      if (wv.width > 0 &&
          (isNaN(this.lastCullX) || Math.abs(cam.scrollX - this.lastCullX) > 8 || Math.abs(cam.scrollY - this.lastCullY) > 8)) {
        this.lastCullX = cam.scrollX; this.lastCullY = cam.scrollY;
        const MARGIN = 4 * T;
        const bounds = expandRect({ x: wv.x, y: wv.y, width: wv.width, height: wv.height }, MARGIN);
        this.visibleCullables = cull(this.cullables, bounds);
      }
      if (this.debugPerf && this.perfHud) {
        const total = this.cullables.length, vis = this.visibleCullables;
        this.perfHud.setText(
          "FPS " + this.fpsSampler.fps + "\n" +
          "Sprites sichtbar " + vis + "/" + total + "\n" +
          "gecullt " + (total - vis) + "  ·  stress ×" + this.stress,
        );
      }
    }

    /* ============ Events: Piraten & Krake ============ */
    scheduleEvents(delaySec?: number) {
      const now = this.time.now / 1000;
      // Spiel-Feel (#71): Cozy streckt die Wartezeit, "Aus" schiebt sie auf
      // Infinity (next* wird nie erreicht → keine Zufalls-Events).
      const scale = Game.eventProfile().spawnScale;
      this.events.nextPirate = now + (delaySec || Phaser.Math.Between(200, 360)) * scale;
      this.events.nextKraken = now + (delaySec ? delaySec + 90 : Phaser.Math.Between(300, 500)) * scale;
      this.events.nextStorm = now + (delaySec ? delaySec + 150 : Phaser.Math.Between(260, 430)) * scale;
    }

    anyEventActive() {
      return !!(this.events.pirate || this.events.kraken || this.events.storm);
    }

    /* ---------- Sturm: ein Deployment geht kaputt, du reparierst es ---------- */
    tryStartStorm() {
      if (!Game.eventProfile().enabled || this.anyEventActive() || !Game.state.completedQuests.includes("q17")) return;
      const victims = Game.sim.deployments.filter(d => !d.broken);
      if (victims.length === 0 || UI.blocking()) { this.events.nextStorm += 25; return; }
      const dep = Phaser.Utils.Array.GetRandom(victims);
      const kind = Math.random() < 0.5 ? "imagepull" : "crashloop";
      let hintCmd;
      if (kind === "imagepull") {
        // Der Sturm "verdreht" den Image-Namen (Buchstabendreher)
        const bad = KQContent.corruptImage(dep.image.split(":")[0]);
        dep.broken = { type: "imagepull", badImage: bad };
        dep.image = bad;
        hintCmd = "Diagnose: <code>kubectl get pods</code> → <code>describe</code>. Fix: <code>kubectl set image deployment/" + dep.name + " …</code>";
      } else {
        dep.broken = { type: "crashloop", needsSecret: "sturm-schluessel-" + Phaser.Math.Between(10, 99) };
        hintCmd = "Diagnose: <code>kubectl get pods</code> → <code>kubectl logs &lt;pod&gt;</code>. Dann Ursache beheben + <code>rollout restart</code>!";
      }
      Game.save();

      this.rain.start();
      this.stormOverlay.setVisible(true);
      SFX.thunder();
      this.cameras.main.flash(180, 200, 210, 255);
      this.cameras.main.shake(280, 0.004);
      this.events.stormFlash = this.time.addEvent({ delay: 5200, loop: true, callback: () => {
        this.cameras.main.flash(140, 200, 210, 255);
        SFX.thunder();
      }});

      const deadline = Math.round(240 * Game.eventProfile().deadlineScale);
      this.events.storm = { dep: dep.name, until: this.time.now / 1000 + deadline };
      UI.showAlarm("⛈️ <b>STURMSCHADEN!</b> Das Deployment <b>" + dep.name + "</b> ist ausgefallen – und verdient nichts mehr! " + hintCmd, deadline);
    }

    resolveStorm(success: boolean) {
      const ev = this.events.storm;
      if (!ev) return;
      this.events.storm = null;
      if (this.events.stormFlash) { this.events.stormFlash.remove(); this.events.stormFlash = null; }
      this.rain.stop();
      this.stormOverlay.setVisible(false);
      UI.hideAlarm();
      if (success) {
        Game.state.stats.stormsFixed = (Game.state.stats.stormsFixed || 0) + 1;
        UI.reward(35, 50, "⛈️ Sturmschaden behoben!");
        SFX.fanfare();
      } else {
        UI.toast("⛈️ Der Sturm zieht ab – aber <b>" + ev.dep + "</b> bleibt kaputt (und verdient nichts), bis du es reparierst!");
      }
      this.scheduleEvents();
    }

    tryStartPirate() {
      if (!Game.eventProfile().enabled || this.anyEventActive() || !Game.state.completedQuests.includes("q7")) return;
      const victims = Game.sim.deployments.filter(d => d.replicas >= 2);
      if (victims.length === 0 || UI.blocking()) { this.events.nextPirate += 20; return; }
      const dep = Phaser.Utils.Array.GetRandom(victims);
      const want = dep.replicas;
      const steal = Math.max(1, Math.floor(dep.replicas / 2));
      dep.replicas -= steal;
      dep.pods.splice(0, steal);
      Game.save();

      // Piratenboot segelt heran
      const boat = this.add.container(this.W * T + 30, 31 * T).setDepth(8000);
      const hull = this.add.graphics();
      hull.fillStyle(0x2a2030); hull.fillRect(-14, 0, 28, 8);
      hull.fillStyle(0x1a141e); hull.fillRect(-14, 8, 28, 3);
      hull.fillStyle(0x4a3a52); hull.fillRect(-1, -14, 2, 14);
      boat.add(hull);
      const flag = this.add.image(5, -11, "px").setScale(5, 3).setTint(0x111111);
      boat.add(flag);
      boat.add(this.add.text(5, -11, "☠", { fontSize: "5px", resolution: 8 }).setOrigin(0.5));
      this.tweens.add({ targets: boat, x: 24 * T, duration: 2600, ease: "Sine.out" });
      this.tweens.add({ targets: boat, y: 31 * T - 2, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });

      SFX.alarm();
      this.cameras.main.shake(250, 0.004);
      const deadline = Math.round(180 * Game.eventProfile().deadlineScale);
      this.events.pirate = { dep: dep.name, want, boat, until: this.time.now / 1000 + deadline };
      UI.showAlarm("🏴‍☠️ <b>PIRATEN-ÜBERFALL!</b> Sie haben Kisten von <b>" + dep.name + "</b> geklaut (nur noch " + dep.replicas + "/" + want + ")! " +
        "Skaliere zurück auf <b>" + want + "</b>: <code>kubectl scale deployment " + dep.name + " --replicas=" + want + "</code>", deadline);
    }

    resolvePirate(success: boolean) {
      const ev = this.events.pirate;
      if (!ev) return;
      this.tweens.add({ targets: ev.boat, x: this.W * T + 40, duration: 1800, ease: "Sine.in", onComplete: () => ev.boat.destroy() });
      this.events.pirate = null;
      UI.hideAlarm();
      if (success) {
        const bounty = Math.round(40 * (Game.hasUpgrade("kanone") ? 1.5 : 1));
        Game.state.stats.piratesBeaten++;
        if (Game.hasUpgrade("kanone")) { this.cameras.main.shake(150, 0.003); SFX.tone(80, 0.3, "sawtooth", 0.06); }
        UI.reward(25, bounty, "🏴‍☠️ Piraten vertrieben!");
        SFX.fanfare();
      } else {
        UI.toast("🏴‍☠️ Die Piraten sind entkommen … Stell die Kopien trotzdem wieder her – deine Einnahmen leiden!");
      }
      this.scheduleEvents();
    }

    tryStartKraken() {
      if (!Game.eventProfile().enabled || this.anyEventActive() || !Game.state.completedQuests.includes("q14")) return;
      if (UI.blocking()) { this.events.nextKraken += 20; return; }
      const baseline = Game.sim.secrets.length;

      const kx = 26 * T, ky = 30 * T;
      const kraken = this.add.container(kx, ky + 30).setDepth(8000);
      // Pixelart-Sprite (#184) statt der früheren code-gezeichneten fillCircle/fillRect-Krake.
      // 64×64-Asset, auf Gegner-Größe herunterskaliert; Wackel-/Auftauch-Tweens unten unverändert.
      const body = this.add.image(0, 0, "kraken").setOrigin(0.5, 0.5).setScale(0.46);
      kraken.add(body);
      this.tweens.add({ targets: kraken, y: ky, duration: 900, ease: "Back.out" });
      this.tweens.add({ targets: kraken, angle: { from: -4, to: 4 }, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });

      SFX.alarm();
      this.cameras.main.shake(250, 0.004);
      const deadline = Math.round(120 * Game.eventProfile().deadlineScale);
      this.events.kraken = { kraken, baseline, until: this.time.now / 1000 + deadline };
      UI.showAlarm("🐙 <b>DIE HACKER-KRAKE!</b> Sie schnüffelt nach Klartext-Daten! Vertreibe sie, indem du irgendein neues <b>Secret</b> anlegst: " +
        "<code>kubectl create secret generic &lt;name&gt; --from-literal=passwort=&lt;wert&gt;</code>", deadline);
    }

    resolveKraken(success: boolean) {
      const ev = this.events.kraken;
      if (!ev) return;
      this.tweens.add({ targets: ev.kraken, y: "+=40", alpha: 0, duration: 700, ease: "Sine.in", onComplete: () => ev.kraken.destroy() });
      this.events.kraken = null;
      UI.hideAlarm();
      if (success) {
        Game.state.stats.krakenBeaten++;
        UI.reward(30, 50, "🐙 Krake vertrieben!");
        SFX.fanfare();
      } else {
        const stolen = Math.min(20, Game.state.coins);
        Game.state.coins -= stolen;
        Game.save();
        UI.toast("🐙 Die Krake hat " + stolen + " 🪙 erbeutet! Leg beim nächsten Mal schnell ein Secret an.");
      }
      this.scheduleEvents();
    }

    /* ============ Update-Schleife ============ */
    update(time: number, delta: number) {
      const dt = Math.min(0.05, delta / 1000);
      const pl = this.playerPos;
      const blocked = UI.blocking();

      let dx = 0, dy = 0;
      if (!blocked) {
        if (keys["w"] || keys["ArrowUp"]) dy -= 1;
        if (keys["s"] || keys["ArrowDown"]) dy += 1;
        if (keys["a"] || keys["ArrowLeft"]) dx -= 1;
        if (keys["d"] || keys["ArrowRight"]) dx += 1;
      }
      pl.moving = dx !== 0 || dy !== 0;
      if (pl.moving) {
        const len = Math.hypot(dx, dy);
        if (dx) pl.dir = Math.sign(dx);
        // Blickrichtung für die 4 PixelLab-Richtungen (horizontal hat Vorrang bei Diagonale)
        if (dx < 0) pl.face = "west";
        else if (dx > 0) pl.face = "east";
        else if (dy < 0) pl.face = "north";
        else if (dy > 0) pl.face = "south";
        this.tryMove(dx / len * 75 * dt, dy / len * 75 * dt);
        this.petTrail.push({ x: pl.x, y: pl.y });
        if (this.petTrail.length > 26) this.petTrail.shift();
        this.bobT += dt * 12;
        // Staubwölkchen beim Laufen
        this.stepAcc += dt;
        if (this.stepAcc > 0.3) { this.stepAcc = 0; this.dust.explode(2, pl.x, pl.y + 6); }
      }

      // #92: Archipel-Anleger „scharf machen". Der Warp darf erst auslösen, wenn
      // der Spieler die Lauftaste seit der Ankunft losgelassen hat UND nicht schon
      // auf der Anker-Kachel steht – sonst pingpongt man mit gehaltener Taste sofort
      // wieder zurück (Review-Feedback). Bei der Rückkehr landet man eine Kachel vor
      // dem Anker, also disarmt enterArchipel() das Gate bewusst.
      const onArchWarp = warpAt(pl.x, pl.y, WORLD_TO_ARCHIPEL);
      const moveKeyDown = !!(keys["w"] || keys["s"] || keys["a"] || keys["d"] ||
        keys["ArrowUp"] || keys["ArrowDown"] || keys["ArrowLeft"] || keys["ArrowRight"]);
      if (!moveKeyDown && !onArchWarp) this.archipelArmed = true;

      // #6: Auf einer Tür-Kachel? -> Haus betreten (Rest dieses Frames überspringen).
      if (!blocked) {
        const door = doorAt(pl.x, pl.y);
        if (door) { this.enterInterior(door); return; }
        if (this.archipelArmed && onArchWarp) { this.enterArchipel(); return; }
      }

      const bob = pl.moving ? Math.abs(Math.sin(this.bobT)) * 1.6 : 0;
      // Echte 4-Richtungs-Sprites aus PixelLab (south = Basis-Textur char_player)
      const faceTex = pl.face === "south" ? "char_player" : "char_player_" + pl.face;
      this.playerSprite.setTexture(faceTex).setPosition(pl.x, pl.y + 6 - bob).setFlipX(false).setDepth(pl.y + 8);
      this.playerShadow.setPosition(pl.x, pl.y + 6);

      // Haustier
      const item = Game.state.activePet ? KQContent.SHOP.find(s => s.id === Game.state.activePet) : undefined;
      if (item) {
        const pos = this.petTrail[Math.max(0, this.petTrail.length - 16)] || pl;
        this.petSprite.setVisible(true).setTexture(item.tex).setScale(0.4)
          .setPosition(pos.x, pos.y - 2 + Math.sin(time / 180) * 1.5)
          .setFlipX(pl.x < pos.x).setDepth(pos.y + 7);
        this.petShadow.setVisible(true).setPosition(pos.x, pos.y + 6);
      } else {
        this.petSprite.setVisible(false);
        this.petShadow.setVisible(false);
      }

      // Schiffsflagge einfärben
      const flagItem = KQContent.SHOP.find(f => f.id === Game.state.activeFlag);
      this.shipFlag.setTint(flagItem ? flagItem.color : 0x4dd0e1);

      // Quest-Marker
      for (const n of this.npcs) {
        let show = UI.questMarkerFor(n.id);
        if (n.id === "kralle" && Game.dueReviewItems(1).length > 0) show = true;
        n.marker.setVisible(!blocked && show);
      }

      this.syncCluster();
      this.revealNearbyLabels();
      this.updateDayNight(time);
      this.cullDecor(delta);

      // Wirtschaft
      const payout = Game.economyTick(dt);
      if (payout > 0) {
        this.floatText((11 + Math.random() * 8) * T, 25 * T, "+" + payout + " 🪙", "#ffd97a");
        UI.refreshHud();
      }

      // Schmetterlinge flattern über die Wiesen
      const t = time / 1000;
      for (const b of this.butterflies) {
        b.spr.setPosition(
          b.ax + Math.sin(t * b.sp + b.ph) * 22,
          b.ay + Math.sin(t * b.sp * 1.7 + b.ph) * 10 + Math.cos(t * 0.9 + b.ph) * 4
        ).setScale(1.3, 0.6 + Math.abs(Math.sin(t * 14 + b.ph)) * 0.7);
      }

      // Events
      const now = time / 1000;
      if (now > this.events.nextPirate) this.tryStartPirate();
      if (now > this.events.nextKraken) this.tryStartKraken();
      if (now > this.events.nextStorm) this.tryStartStorm();
      if (this.events.storm) {
        const dep = Game.sim.deployments.find(d => d.name === this.events.storm.dep);
        if (!dep || !dep.broken) this.resolveStorm(true);
        else if (now > this.events.storm.until) this.resolveStorm(false);
        else UI.updateAlarmTimer(Math.ceil(this.events.storm.until - now));
      }
      if (this.events.pirate) {
        const dep = Game.sim.deployments.find(d => d.name === this.events.pirate.dep);
        if (dep && dep.replicas >= this.events.pirate.want) this.resolvePirate(true);
        else if (now > this.events.pirate.until) this.resolvePirate(false);
        else UI.updateAlarmTimer(Math.ceil(this.events.pirate.until - now));
      }
      if (this.events.kraken) {
        if (Game.sim.secrets.length > this.events.kraken.baseline) this.resolveKraken(true);
        else if (now > this.events.kraken.until) this.resolveKraken(false);
        else UI.updateAlarmTimer(Math.ceil(this.events.kraken.until - now));
      }

      UI.updatePrompt();
    }
  }

  /* ===== InteriorScene (#6) – betretbarer Hausinnenraum =====
   * Wird von WorldScene.enterInterior() als eigene Szene gestartet, während die
   * WorldScene schläft (eingefroren + ausgeblendet). Ein kleiner gekachelter
   * Raum aus vorhandenen dungeon-Tiles, themengerechte Möbel, die NPC-Figur des
   * Hauses und eine Tür-Schwelle unten zum Hinausgehen (E oder runterlaufen). */
  const INTERIORS: Record<string, { frame: number; tx: number; ty: number }[]> = {
    office: [{ frame: TABLE, tx: 3, ty: 2 }, { frame: DEVICE, tx: 7, ty: 2 }, { frame: BOOK, tx: 8, ty: 2 }, { frame: CRATE, tx: 2, ty: 5 }, { frame: BARREL, tx: 8, ty: 5 }],
    forge:  [{ frame: ANVIL, tx: 3, ty: 2 }, { frame: TABLE, tx: 7, ty: 2 }, { frame: DEVICE, tx: 8, ty: 2 }, { frame: BARREL, tx: 2, ty: 5 }, { frame: CRATE, tx: 8, ty: 5 }],
    chart:  [{ frame: TABLE, tx: 3, ty: 2 }, { frame: BOOK, tx: 7, ty: 2 }, { frame: BOOK, tx: 8, ty: 2 }, { frame: CRATE, tx: 2, ty: 5 }, { frame: BARREL, tx: 8, ty: 5 }],
    // Kajüte (#42): Kartentisch + Logbuch, Navigationsgerät, Proviant
    ship:   [{ frame: TABLE, tx: 2, ty: 2 }, { frame: BOOK, tx: 3, ty: 2 }, { frame: DEVICE, tx: 8, ty: 2 }, { frame: BARREL, tx: 2, ty: 5 }, { frame: CRATE, tx: 8, ty: 5 }],
  };

  class InteriorScene extends Phaser.Scene {
    [key: string]: any;
    constructor() { super("Interior"); }

    create(data: { door: Door }) {
      const door = data.door;
      this.door = door;
      const isShip = door.theme === "ship";   // #42: Kajüte statt Hausinnenraum
      const RW = 11, RH = 8;
      this.RW = RW; this.RH = RH;
      this.solid = new Uint8Array(RW * RH);
      this.exitTx = Math.floor(RW / 2);   // 5
      this.exitTy = RH - 1;               // 7 (Tür-Schwelle unten Mitte)

      // Boden (Holz) + Wände (Haus: Stein / Schiff: Holzrumpf); Schwelle unten Mitte frei.
      const wallTiles = isShip ? WOOD : STONE;
      const rt = this.add.renderTexture(0, 0, RW * T, RH * T).setOrigin(0).setDepth(0);
      for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
        const wall = y === 0 || x === 0 || x === RW - 1 || (y === RH - 1 && x !== this.exitTx);
        if (wall) { rt.drawFrame("dungeon", wallTiles[(x + y) % wallTiles.length], x * T, y * T); this.solid[y * RW + x] = 1; }
        else rt.drawFrame("dungeon", WOOD[(x * 3 + y) % WOOD.length], x * T, y * T);
      }
      // Schiff: Wände abdunkeln (Rumpf) + Bullaugen mit Blick aufs Meer
      if (isShip) {
        for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
          const wall = y === 0 || x === 0 || x === RW - 1 || (y === RH - 1 && x !== this.exitTx);
          if (wall) this.add.rectangle(x * T, y * T, T, T, 0x0a1219, 0.42).setOrigin(0).setDepth(0.4);
        }
        for (const px of [3, 7]) {
          this.add.ellipse(px * T + 8, 8, 11, 11, 0x2f6f8f).setDepth(0.5);          // Meer durchs Bullauge
          this.add.ellipse(px * T + 8, 8, 11, 11).setStrokeStyle(2.5, 0x8a6b3f).setDepth(0.51); // Messingring
          this.add.rectangle(px * T + 8, 8, 11, 2, 0xbfe0ec, 0.7).setDepth(0.52);   // Wellenglanz
        }
      }
      // Schwelle (Haus: Tür-Matte / Schiff: Decksluke) optisch markieren
      this.add.rectangle(this.exitTx * T + 8, this.exitTy * T + T, 12, 14, isShip ? 0x2a1c0d : 0x6b4a2a).setOrigin(0.5, 1).setDepth(1);
      this.add.rectangle(this.exitTx * T + 8, this.exitTy * T + T, 9, 3, isShip ? 0x6b4f35 : 0x2a1c0d).setOrigin(0.5, 1).setDepth(1.1);

      // Themengerechte Möbel (solide, damit man sie nicht durchläuft)
      for (const f of (INTERIORS[door.theme] || [])) {
        this.add.image(f.tx * T + 8, f.ty * T + 12, "dungeon", f.frame).setOrigin(0.5, 0.7).setDepth(f.ty * T + T);
        this.solid[f.ty * RW + f.tx] = 1;
      }

      // NPC-Figur des Hauses/Schiffs (Deko – reden weiterhin draußen) + Namensschild
      const meta = door.npc ? (KQContent.NPCS as any)[door.npc] : undefined;
      const ntx = this.exitTx, nty = 2;
      this.solid[nty * RW + ntx] = 1;
      const nbaseY = nty * T + 15;
      this.add.ellipse(ntx * T + 8, nty * T + 15, 10, 4, 0x000000, 0.26).setDepth(1.6);
      const npc = meta && meta.tex
        ? this.add.image(ntx * T + 8, nbaseY, meta.tex).setOrigin(0.5, 0.81).setScale(0.6).setDepth(nty * T + T)
        : this.add.image(ntx * T + 8, nty * T + 8, "dungeon", meta ? meta.sprite : 0).setDepth(nty * T + T);
      this.tweens.add({ targets: npc, y: npc.y - 1, duration: 1000, yoyo: true, repeat: -1, ease: "Sine.inOut" });

      // Spieler vor der Schwelle
      this.pl = { x: this.exitTx * T + 8, y: (this.exitTy - 1) * T + 8, face: "north", moving: false };
      this.bobT = 0;
      this.pShadow = this.add.ellipse(this.pl.x, this.pl.y + 6, 10, 4, 0x000000, 0.26).setDepth(1.6);
      this.pSprite = this.add.image(this.pl.x, this.pl.y + 6, "char_player").setOrigin(0.5, 0.81).setScale(0.6).setDepth(this.pl.y + 8);

      // Kamera: Raum füllend, mit dunklem Innenraum-Hintergrund
      const cam = this.cameras.main;
      cam.setBounds(0, 0, RW * T, RH * T);
      cam.setBackgroundColor(isShip ? 0x0a1822 : 0x140f0a);
      cam.centerOn(RW * T / 2, RH * T / 2);
      const fit = Math.min(window.innerWidth / (RW * T), window.innerHeight / (RH * T)) * 0.85;
      cam.setZoom(Phaser.Math.Clamp(fit, 2.4, 6));

      // Fixierte Beschriftung (oben Titel, unten Hinweis)
      const cw = cam.width, ch = cam.height;
      const npcName = meta ? meta.name + " · " + meta.title : "";
      this.add.text(cw / 2, 12, (isShip ? "⚓ " : "🚪 ") + door.title, { fontFamily: "Verdana, 'Segoe UI', sans-serif", fontSize: "16px", color: "#ffe9b0", fontStyle: "bold", resolution: 2 })
        .setOrigin(0.5, 0).setScrollFactor(0).setDepth(20000).setShadow(0, 1, "#000", 3);
      if (npcName) this.add.text(cw / 2, 32, npcName, { fontFamily: "Verdana, 'Segoe UI', sans-serif", fontSize: "11px", color: "#cdd9e8", resolution: 2 })
        .setOrigin(0.5, 0).setScrollFactor(0).setDepth(20000).setShadow(0, 1, "#000", 3);
      this.add.text(cw / 2, ch - 22, isShip ? "E – an Deck   ·   ↓ durch die Luke" : "E – Hinausgehen   ·   ↓ durch die Tür", { fontFamily: "Verdana, 'Segoe UI', sans-serif", fontSize: "12px", color: "#ffd97a", resolution: 2 })
        .setOrigin(0.5, 1).setScrollFactor(0).setDepth(20000).setShadow(0, 1, "#000", 3);

      // E war beim Betreten evtl. noch gedrückt – erst nach Loslassen reagieren.
      this.ePrev = true;
    }

    isSolid(px: number, py: number) {
      const tx = Math.floor(px / T), ty = Math.floor(py / T);
      if (tx < 0 || ty < 0 || tx >= this.RW || ty >= this.RH) return true;
      return !!this.solid[ty * this.RW + tx];
    }

    tryMove(dx: number, dy: number) {
      const pl = this.pl;
      const probe = (nx: number, ny: number) =>
        this.isSolid(nx - 4, ny - 2) || this.isSolid(nx + 4, ny - 2) ||
        this.isSolid(nx - 4, ny + 5) || this.isSolid(nx + 4, ny + 5);
      if (!probe(pl.x + dx, pl.y)) pl.x += dx;
      if (!probe(pl.x, pl.y + dy)) pl.y += dy;
    }

    exitInterior() {
      SFX.door();
      setInteriorOpen(false);
      this.scene.wake("World");
      this.scene.stop();
    }

    update(_time: number, delta: number) {
      const dt = Math.min(0.05, delta / 1000);
      const pl = this.pl;
      const blocked = UI.blocking();

      let dx = 0, dy = 0;
      if (!blocked) {
        if (keys["w"] || keys["ArrowUp"]) dy -= 1;
        if (keys["s"] || keys["ArrowDown"]) dy += 1;
        if (keys["a"] || keys["ArrowLeft"]) dx -= 1;
        if (keys["d"] || keys["ArrowRight"]) dx += 1;
      }
      pl.moving = dx !== 0 || dy !== 0;
      if (pl.moving) {
        const len = Math.hypot(dx, dy);
        if (dx < 0) pl.face = "west";
        else if (dx > 0) pl.face = "east";
        else if (dy < 0) pl.face = "north";
        else if (dy > 0) pl.face = "south";
        this.tryMove(dx / len * 70 * dt, dy / len * 70 * dt);
        this.bobT += dt * 12;
      }
      const bob = pl.moving ? Math.abs(Math.sin(this.bobT)) * 1.6 : 0;
      const faceTex = pl.face === "south" ? "char_player" : "char_player_" + pl.face;
      this.pSprite.setTexture(faceTex).setPosition(pl.x, pl.y + 6 - bob).setDepth(pl.y + 8);
      this.pShadow.setPosition(pl.x, pl.y + 6);

      // Hinausgehen: E (Flanke) oder auf der Tür-Schwelle stehen.
      const e = !blocked && (!!keys["e"] || !!keys["Enter"] || !!keys[" "]);
      const onExit = Math.floor(pl.x / T) === this.exitTx && Math.floor(pl.y / T) === this.exitTy;
      if (!blocked && ((e && !this.ePrev) || onExit)) { this.exitInterior(); return; }
      this.ePrev = e;
    }
  }

  /* ===== ArchipelScene (#92) – die erste eigene Nachbar-Insel (GitOps-Archipel) =====
   * Wird von WorldScene.enterArchipel() als eigene Szene gestartet, während die
   * WorldScene schläft. Eine kompakte, voll begehbare Insel: Boden über dieselben
   * Wang-Tiles wie die Hauptkarte, ein Anleger-Steg im Süden zum Zurückwarpen,
   * ein Wegweiser am Quest-Trigger und ein reservierter Standplatz für den neuen
   * NPC (#93) + die GitOps-Quests (#94–97), die hier andocken. Geometrie/Kollision
   * kommen pur aus archipel.ts; Bewegung teilt sich resolveMove mit der Hauptkarte. */
  class ArchipelScene extends Phaser.Scene {
    [key: string]: any;
    constructor() { super("Archipel"); }

    create() {
      const m = buildArchipel();
      this.W = m.W; this.H = m.H; this.ground = m.ground; this.solid = m.solid;

      this.renderGround();

      // Bäume (grüner Saum) – gemischter Wald wie auf der Hauptkarte.
      for (const t of m.trees) {
        const kind = ((t.x * 7 + t.y * 13) % 3 === 0) ? "pine" : "tree";
        this.add.image(t.x * T + 8, (t.y + 1) * T, kind).setOrigin(0.5, 1)
          .setScale(kind === "pine" ? 0.95 : 1.1).setDepth((t.y + 1) * T);
      }
      // Etwas Bodendeko auf dem Gras (begehbar) – deterministisch gestreut.
      this.scatterDecor();

      // Rück-Anleger sichtbar markieren (Anker + Wegweiser-Schild).
      const rx = ARCHIPEL_TO_WORLD.tx * T + 8, ry = ARCHIPEL_TO_WORLD.ty * T + 8;
      const anchor = this.add.text(rx, ry - 4, "⚓", { fontSize: "11px", resolution: 6 }).setOrigin(0.5).setDepth(ry + 20);
      this.tweens.add({ targets: anchor, y: ry - 8, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      this.makeSign((ARCHIPEL_TO_WORLD.tx) * T + 8, (ARCHIPEL_TO_WORLD.ty - 1) * T, "Heimhafen");

      // Quest-Trigger: Wegweiser als sichtbarer Platzhalter, bis #94–97 hier Quests einhängen.
      this.objStatue(ARCHIPEL_QUEST_TRIGGER.x, ARCHIPEL_QUEST_TRIGGER.y);
      this.makeSign(ARCHIPEL_QUEST_TRIGGER.x * T + 8, (ARCHIPEL_QUEST_TRIGGER.y - 1) * T, "GitOps");

      // GitOps-NPC „Argo" (#93): die GitOps-Lotsin des Archipels, die ab #94 die
      // Phase-4-Quests vergibt. Gleiches Render-Schema wie die NPCs der WorldScene
      // (tex-Figur an den Schatten verankert, Origin 0.81 = Fußlinie, „!"-Marker).
      // Reden läuft über E → UI.interact() → nearestNpc(); bis #94 zeigt sie Smalltalk.
      const argoMeta = KQContent.NPCS.argo;
      const npx = ARCHIPEL_NPC.x * T + 8, npBaseY = ARCHIPEL_NPC.y * T + 15;
      this.solid[ARCHIPEL_NPC.y * this.W + ARCHIPEL_NPC.x] = 1;   // #31: nicht durch die Figur laufen (Reden geht von der Nachbarkachel)
      this.add.ellipse(npx, npBaseY, 12, 5, 0x000000, 0.26).setDepth(npBaseY - 1);
      const argoSpr = this.add.image(npx, npBaseY, argoMeta.tex).setOrigin(0.5, 0.81).setScale(0.6).setDepth(ARCHIPEL_NPC.y * T + T);
      this.tweens.add({ targets: argoSpr, y: npBaseY - 1, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      const argoMarker = this.add.text(npx, ARCHIPEL_NPC.y * T - 6, "!", { fontFamily: "Consolas", fontSize: "8px", color: "#ffc857", fontStyle: "bold", resolution: 8 })
        .setOrigin(0.5, 1).setDepth(10000).setShadow(0.5, 0.5, "#000", 1).setVisible(false);
      this.tweens.add({ targets: argoMarker, y: ARCHIPEL_NPC.y * T - 9, duration: 500, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      this.npcs = [{ id: ARCHIPEL_NPC.id, x: ARCHIPEL_NPC.x, y: ARCHIPEL_NPC.y, sprite: argoSpr, marker: argoMarker }];

      // Spieler am Ankunfts-Steg (eine Kachel landwärts vom Rück-Warp).
      this.pl = { x: ARCHIPEL_ARRIVAL.tx * T + 8, y: ARCHIPEL_ARRIVAL.ty * T + 8, face: "north", moving: false };
      this.bobT = 0;
      this.pShadow = this.add.ellipse(this.pl.x, this.pl.y + 6, 10, 4, 0x000000, 0.26).setDepth(1.6);
      this.pSprite = this.add.image(this.pl.x, this.pl.y + 6, "char_player").setOrigin(0.5, 0.81).setScale(0.6).setDepth(this.pl.y + 8);

      // Kamera folgt dem Spieler über die Insel.
      const cam = this.cameras.main;
      cam.setBounds(0, 0, this.W * T, this.H * T);
      cam.setBackgroundColor(0x356dab);   // offenes Meer als Rand
      cam.setZoom(window.innerWidth < 900 ? 2.4 : 3);
      cam.startFollow(this.pSprite, true, 0.15, 0.15);
      this.scale.on("resize", () => cam.setZoom(window.innerWidth < 900 ? 2.4 : 3));

      // Fixierte Beschriftung: Titel oben, Hinweis unten.
      const cw = cam.width, ch = cam.height;
      this.add.text(cw / 2, 12, "⚓ GitOps-Archipel", { fontFamily: "Verdana, 'Segoe UI', sans-serif", fontSize: "16px", color: "#ffe9b0", fontStyle: "bold", resolution: 2 })
        .setOrigin(0.5, 0).setScrollFactor(0).setDepth(20000).setShadow(0, 1, "#000", 3);
      this.add.text(cw / 2, ch - 22, "Zum Steg laufen ⚓ – zurück nach Port Kubernia", { fontFamily: "Verdana, 'Segoe UI', sans-serif", fontSize: "12px", color: "#ffd97a", resolution: 2 })
        .setOrigin(0.5, 1).setScrollFactor(0).setDepth(20000).setShadow(0, 1, "#000", 3);

      // Ein paar Möwen für die Hafen-Atmosphäre (wie auf der Hauptkarte).
      this.time.addEvent({ delay: 6500, loop: true, callback: () => { if (Math.random() < 0.6) this.spawnGull(); } });
      this.spawnGull();

      // Ab jetzt ist die Insel die aktive „WorldScene": E/Prompt der ui.ts (reden,
      // später Quests) greifen über nearestNpc() auf Argo. enterArchipel() hatte
      // interiorOpen(true) gesetzt, um den Übergang abzuschirmen – hier wieder frei,
      // damit man auf der Insel tatsächlich reden kann. exitToWorld() stellt beides
      // auf die Hauptkarte zurück.
      setWorldScene(this);
      setInteriorOpen(false);

      this.ePrev = true;
      // #92: Rück-Warp erst scharf, wenn die (vom Hinweg evtl. noch gehaltene)
      // Lauftaste einmal losgelassen wurde – sonst sofortiges Pingpong.
      this.returnArmed = false;
    }

    /** Wang-Boden wie WorldScene.renderGround, hier ohne Stein-Kai: Wasser → Sand
     *  → Gras → Weg; Steg-Planken als volle Holzkacheln, Wasser-Ränder als „dock"
     *  oder „coast" je nach Nachbar. */
    renderGround() {
      const rt = this.add.renderTexture(0, 0, this.W * T, this.H * T).setOrigin(0).setDepth(0);
      const lv = (cx: number, cy: number) => {
        const ix = cx < 0 ? 0 : cx >= this.W ? this.W - 1 : cx;
        const iy = cy < 0 ? 0 : cy >= this.H ? this.H - 1 : cy;
        const c = this.ground[iy * this.W + ix];
        return c === A_WATER ? 0 : c === A_SAND ? 1 : c === A_PATH ? 3 : 2;
      };
      const rawAt = (cx: number, cy: number) => {
        const ix = cx < 0 ? 0 : cx >= this.W ? this.W - 1 : cx;
        const iy = cy < 0 ? 0 : cy >= this.H ? this.H - 1 : cy;
        return this.ground[iy * this.W + ix];
      };
      const corners = (x: number, y: number, hi: number) =>
        (((lv(x - 1, y - 1) >= hi ? 1 : 0) << 3) | ((lv(x, y - 1) >= hi ? 1 : 0) << 2) |
         ((lv(x - 1, y) >= hi ? 1 : 0) << 1) | (lv(x, y) >= hi ? 1 : 0));
      const has = (x: number, y: number, t: number) =>
        lv(x - 1, y - 1) === t || lv(x, y - 1) === t || lv(x - 1, y) === t || lv(x, y) === t;
      const edgeSet = (x: number, y: number) => {
        const cs = [rawAt(x - 1, y - 1), rawAt(x, y - 1), rawAt(x - 1, y), rawAt(x, y)];
        return cs.some((c) => c === A_DOCK) ? "dock" : "coast";
      };
      for (let y = 0; y < this.H; y++) {
        for (let x = 0; x < this.W; x++) {
          const v = this.ground[y * this.W + x];
          if (has(x, y, 0)) rt.drawFrame(edgeSet(x, y), WANG[corners(x, y, 1)], x * T, y * T);
          else if (v === A_DOCK) rt.drawFrame("dock", WANG[15], x * T, y * T);
          else if (has(x, y, 3)) rt.drawFrame("path", WANG[corners(x, y, 3)], x * T, y * T);
          else rt.drawFrame("meadow", WANG[corners(x, y, 2)], x * T, y * T);
        }
      }
      // Wellen-Glitzer auf dem Wasser
      for (let i = 0; i < 40; i++) {
        const x = Phaser.Math.Between(0, this.W - 1), y = Phaser.Math.Between(0, this.H - 1);
        if (this.ground[y * this.W + x] !== A_WATER) continue;
        const s = this.add.image(x * T + Phaser.Math.Between(2, 12), y * T + Phaser.Math.Between(3, 12), "px")
          .setScale(2.5, 0.8).setTint(FOAM).setAlpha(0).setDepth(1);
        this.tweens.add({ targets: s, alpha: { from: 0, to: 0.55 }, duration: Phaser.Math.Between(900, 1800), yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 2000) });
      }
    }

    /** Deterministische Bodendeko (Büsche/Steine/Blumen) auf dem Gras – begehbar
     *  bzw. Büsche/Steine solide, nie auf Weg/Steg/Lichtung. */
    scatterDecor() {
      const reserved = new Set([
        ARCHIPEL_NPC.y * this.W + ARCHIPEL_NPC.x,
        ARCHIPEL_QUEST_TRIGGER.y * this.W + ARCHIPEL_QUEST_TRIGGER.x,
      ]);
      for (let y = 1; y < this.H - 1; y++) {
        for (let x = 1; x < this.W - 1; x++) {
          const i = y * this.W + x;
          const v = this.ground[i];
          if (v !== 0 && v !== 1 && v !== 2) continue;   // nur Gras
          if (this.solid[i]) continue;                   // kein Baum/Solid drunter
          if (reserved.has(i)) continue;
          const h = (((x * 374761393) ^ (y * 668265263)) >>> 0) % 100;
          if (h < 5) {                                   // Busch (solide)
            this.add.image(x * T + 8, (y + 1) * T, "bush").setOrigin(0.5, 1).setScale(0.5).setDepth((y + 1) * T);
            this.solid[i] = 1;
          } else if (h < 9) {                            // Stein (solide)
            this.add.image(x * T + 8, (y + 1) * T, "rock").setOrigin(0.5, 1).setScale(0.5).setDepth((y + 1) * T);
            this.solid[i] = 1;
          } else if (h < 16) {                           // Blume (begehbar)
            this.add.image(x * T + 8, y * T + 10, "flowers").setScale(0.5).setDepth(y * T + 6);
          }
        }
      }
    }

    /** Schlichter Stein-Wegweiser (Quest-Trigger-Platzhalter) – ein „dungeon"-Tile
     *  als kleines Mahnmal, bis #94–97 echte Quests einhängen. */
    objStatue(tx: number, ty: number) {
      const cx = tx * T + 8, baseY = (ty + 1) * T;
      this.add.ellipse(cx, baseY - 1, 14, 5, 0x000000, 0.22).setDepth(baseY - 1);
      this.add.image(cx, baseY, "dungeon", DEVICE).setOrigin(0.5, 1).setScale(1.1).setDepth(baseY);
    }

    /** Holz-Wegweiser (9-Slice) wie auf der Hauptkarte. */
    makeSign(x: number, y: number, text: string) {
      const txt = this.add.text(0, 0, text, { fontFamily: "Verdana, 'Segoe UI', sans-serif", fontSize: "5px", color: "#3a2410", resolution: 10 })
        .setOrigin(0.5).setShadow(0, 0.5, "rgba(255,243,214,0.45)", 0);
      const w = Math.max(18, Math.ceil(txt.width) + 10), h = Math.max(13, Math.ceil(txt.height) + 7);
      const board = this.add.nineslice(0, 0, "sign", undefined, w, h, 8, 8, 8, 6).setOrigin(0.5);
      board.y = -h / 2; txt.y = -h / 2;
      this.add.container(x, y, [board, txt]).setScale(0.8).setDepth(y);
    }

    spawnGull() {
      const y = Phaser.Math.Between(1, this.H - 4) * T;
      const fromLeft = Math.random() < 0.5;
      const gull = this.add.container(fromLeft ? -20 : this.W * T + 20, y).setDepth(11000);
      const w1 = this.add.rectangle(-0.5, 0, 4, 1.3, 0xf5f7fa).setOrigin(1, 0.5).setAngle(-18);
      const w2 = this.add.rectangle(0.5, 0, 4, 1.3, 0xf5f7fa).setOrigin(0, 0.5).setAngle(18);
      gull.add([w1, w2]);
      this.tweens.add({ targets: w1, angle: -42, duration: 240, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      this.tweens.add({ targets: w2, angle: 42, duration: 240, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      this.tweens.add({ targets: gull, x: fromLeft ? this.W * T + 30 : -30, duration: Phaser.Math.Between(9000, 15000), onComplete: () => gull.destroy() });
    }

    isSolidAt(px: number, py: number) {
      const tx = Math.floor(px / T), ty = Math.floor(py / T);
      if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return true;
      return !!this.solid[ty * this.W + tx];
    }

    /** Nächster ansprechbarer NPC (E-Reichweite), gleiche Logik wie WorldScene –
     *  ui.ts ruft das über worldScene() auf, um Reden/Quests anzubieten. */
    nearestNpc() {
      const pl = this.pl;
      let best = null, bestD = 1.7 * T;
      for (const n of this.npcs) {
        const d = Math.hypot(n.x * T + 8 - pl.x, n.y * T + 8 - pl.y);
        if (d < bestD) { bestD = d; best = n; }
      }
      return best;
    }

    /** Partikel-Effekt am Spieler – die Insel hat (noch) keine eigenen Emitter,
     *  daher ein kurzer Funken-Text. ui.ts ruft das bei Quest-Belohnungen auf. */
    burstAtPlayer(_kind: string) {
      this.floatText(this.pl.x, this.pl.y - 8, "✨", "#ffe9b0");
    }

    floatText(x: number, y: number, str: string, color?: string) {
      const t = this.add.text(x, y, str, { fontFamily: "Consolas", fontSize: "6px", color: color || "#ffd97a", resolution: 8 })
        .setOrigin(0.5).setDepth(10001).setShadow(0.5, 0.5, "#000", 1);
      this.tweens.add({ targets: t, y: y - 14, alpha: 0, duration: 1400, ease: "Sine.out", onComplete: () => t.destroy() });
    }

    exitToWorld() {
      SFX.door();
      // Aktive WorldScene zurück auf die Hauptkarte zeigen lassen (sie wurde nur
      // schlafen gelegt, ihr create() läuft beim Aufwachen nicht erneut).
      setWorldScene(this.scene.get("World") as unknown as WorldSceneRef);
      setInteriorOpen(false);
      this.scene.wake("World");
      this.scene.stop();
    }

    update(_time: number, delta: number) {
      const dt = Math.min(0.05, delta / 1000);
      const pl = this.pl;
      const blocked = UI.blocking();

      let dx = 0, dy = 0;
      if (!blocked) {
        if (keys["w"] || keys["ArrowUp"]) dy -= 1;
        if (keys["s"] || keys["ArrowDown"]) dy += 1;
        if (keys["a"] || keys["ArrowLeft"]) dx -= 1;
        if (keys["d"] || keys["ArrowRight"]) dx += 1;
      }
      pl.moving = dx !== 0 || dy !== 0;
      if (pl.moving) {
        const len = Math.hypot(dx, dy);
        if (dx < 0) pl.face = "west";
        else if (dx > 0) pl.face = "east";
        else if (dy < 0) pl.face = "north";
        else if (dy > 0) pl.face = "south";
        const next = resolveMove((px, py) => this.isSolidAt(px, py), pl.x, pl.y, dx / len * 75 * dt, dy / len * 75 * dt);
        pl.x = next.x; pl.y = next.y;
        this.bobT += dt * 12;
      }
      const bob = pl.moving ? Math.abs(Math.sin(this.bobT)) * 1.6 : 0;
      const faceTex = pl.face === "south" ? "char_player" : "char_player_" + pl.face;
      this.pSprite.setTexture(faceTex).setPosition(pl.x, pl.y + 6 - bob).setDepth(pl.y + 8);
      this.pShadow.setPosition(pl.x, pl.y + 6);

      // Quest-Marker über Argo (zeigt „!", sobald ab #94 ein Quest-Dialogschritt ansteht).
      for (const n of this.npcs) n.marker.setVisible(!blocked && UI.questMarkerFor(n.id));

      // „E – reden"-Hinweis selbst pflegen: die WorldScene (die das sonst tut)
      // schläft, solange die Insel läuft – ohne diesen Aufruf bliebe Argo ohne
      // sichtbaren Reden-Hinweis.
      UI.updatePrompt();

      // Rück-Anleger betreten? -> zurück nach Port Kubernia. Wie beim Hinweg gilt:
      // erst „scharf", wenn die Lauftaste seit der Ankunft losgelassen wurde und man
      // nicht schon auf dem Anker steht – sonst pingpongt man mit gehaltener Taste
      // sofort zurück, weil die Ankunft direkt über dem Rück-Anleger liegt.
      const onRet = warpAt(pl.x, pl.y, ARCHIPEL_TO_WORLD);
      const moveKeyDown = !!(keys["w"] || keys["s"] || keys["a"] || keys["d"] ||
        keys["ArrowUp"] || keys["ArrowDown"] || keys["ArrowLeft"] || keys["ArrowRight"]);
      if (!moveKeyDown && !onRet) this.returnArmed = true;
      if (!blocked && this.returnArmed && onRet) { this.exitToWorld(); return; }
      // Notausgang per E/Enter, falls man am Steg feststeht.
      const e = !blocked && (!!keys["e"] || !!keys["Enter"]);
      const onDock = this.ground[Math.floor(pl.y / T) * this.W + Math.floor(pl.x / T)] === A_DOCK;
      if (e && !this.ePrev && onDock) { this.exitToWorld(); return; }
      this.ePrev = e;
    }
  }

  /** #191 (Teil 1 von Epic #57): Grundgerüst für die spätere Tiled-Map-Migration.
   *  Lädt EINE minimale .tmj über Phasers Tilemap-API – bewusst PARALLEL zur
   *  prozeduralen buildMap() der WorldScene, die unangetastet bleibt. Erreichbar
   *  über ?maptest in der URL. Beweist den ganzen Pfad an einem Stück: .tmj
   *  parsen/validieren (tilemap.ts) → Tileset-Name auf ein ASSET_MANIFEST-Bild
   *  mappen → Tile-Layer rendern → Kollisionslayer als solide markieren (das
   *  Debug-Overlay macht den Kollisions-Ring sichtbar). Noch KEINE echte
   *  Hafenkarte – die kommt in #192. */
  class TilemapTestScene extends Phaser.Scene {
    [key: string]: any;
    constructor() { super("MapTest"); }

    create() {
      // 1) .tmj parsen + validieren (reine Logik aus tilemap.ts). Das geparste,
      //    geprüfte Objekt geht 1:1 in Phasers Tilemap-Cache – kein zweites Parsen.
      const data = parseTiledMap(JSON.parse(getMapEntry("test-map").raw));
      this.cache.tilemap.add("test-map", { format: Phaser.Tilemaps.Formats.TILED_JSON, data });
      const map = this.make.tilemap({ key: "test-map" });

      // 2) Tileset-Bild ↔ Tiled-Tileset auflösen: der Tileset-Name im .tmj ist der
      //    ASSET_MANIFEST-Schlüssel der bereits in der BootScene geladenen Textur.
      const manifestKeys = ASSET_MANIFEST.map((a) => a.key);
      const tilesets = resolveTilesets(data, manifestKeys)
        .map((r) => map.addTilesetImage(r.tiledName, r.assetKey))
        .filter((t): t is Phaser.Tilemaps.Tileset => t !== null);

      // 3) Boden-Layer rendern.
      map.createLayer("Boden", tilesets, 0, 0);

      // 4) Kollisionslayer: alle gesetzten Kacheln (gid != 0) kollidieren. Die reine
      //    collisionGrid()-Funktion liefert dasselbe Raster (row-major wie world.ts)
      //    für die spätere Spiel-Logik; hier zusätzlich Phasers Layer-Kollision +
      //    Debug-Overlay als Sicht-Beweis im Browser.
      const collision = map.createLayer("Kollision", tilesets, 0, 0);
      collision?.setCollisionByExclusion([-1]);
      this.solidGrid = collisionGrid(data, "Kollision");

      const debug = this.add.graphics().setDepth(100);
      collision?.renderDebug(debug, {
        tileColor: null,
        collidingTileColor: new Phaser.Display.Color(255, 90, 60, 120),
        faceColor: new Phaser.Display.Color(255, 230, 130, 200),
      });

      // Kamera mittig auf die kleine Map, kräftiger Zoom (16px-Tiles).
      const cam = this.cameras.main;
      cam.setBackgroundColor(0x1b2433);
      cam.centerOn(map.widthInPixels / 2, map.heightInPixels / 2);
      cam.setZoom(6);

      // Fixierte Beschriftung, damit klar ist: das ist die Tiled-Testszene (#191).
      const cw = cam.width, ch = cam.height;
      this.add.text(cw / 2, 12, "🧭 Tiled-Loader-Test (#191)", { fontFamily: "Verdana, 'Segoe UI', sans-serif", fontSize: "16px", color: "#ffe9b0", fontStyle: "bold", resolution: 2 })
        .setOrigin(0.5, 0).setScrollFactor(0).setDepth(20000).setShadow(0, 1, "#000", 3);
      this.add.text(cw / 2, ch - 16, "Boden-Layer + Kollisions-Ring (rot) aus assets/maps/test-map.tmj – parallel zu buildMap()", { fontFamily: "Verdana, 'Segoe UI', sans-serif", fontSize: "11px", color: "#cfe3ff", resolution: 2 })
        .setOrigin(0.5, 1).setScrollFactor(0).setDepth(20000).setShadow(0, 1, "#000", 3);
    }
  }

  export const KQScenes = { BootScene, WorldScene, InteriorScene, ArchipelScene, TilemapTestScene };
