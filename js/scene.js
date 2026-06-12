/* ===== KubeQuest 3.0 – Phaser-Szenen =====
 * BootScene: lädt die Base64-Spritesheets (funktioniert auch per Doppelklick!).
 * WorldScene: Port Kubernia – Karte, Spieler:in, NPCs, Cluster→Welt-Sync,
 *             Piraten-Überfälle, Hacker-Krake, Hafen-Wirtschaft, Sound.
 */

(function () {
  "use strict";

  const T = 16;
  const COLS = 12;

  /* ---------- Mini-Synthesizer (kein Audio-File nötig) ---------- */
  const SFX = {
    ctx: null,
    ensure() {
      if (!this.ctx) {
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* kein Ton */ }
      }
      return this.ctx;
    },
    tone(freq, dur, type, vol, delay) {
      const ctx = this.ensure();
      if (!ctx) return;
      const t0 = ctx.currentTime + (delay || 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol || 0.035, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + dur);
    },
    coin() { this.tone(880, 0.07); this.tone(1318, 0.1, "square", 0.035, 0.07); },
    success() { this.tone(523, 0.09); this.tone(659, 0.09, "square", 0.035, 0.09); this.tone(784, 0.14, "square", 0.035, 0.18); },
    splash() { this.tone(180, 0.2, "sine", 0.05); this.tone(90, 0.25, "sine", 0.04, 0.05); },
    alarm() { this.tone(440, 0.18, "sawtooth", 0.04); this.tone(330, 0.18, "sawtooth", 0.04, 0.2); this.tone(440, 0.18, "sawtooth", 0.04, 0.4); },
    fanfare() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.16, "square", 0.04, i * 0.12)); },
    wrong() { this.tone(196, 0.18, "sawtooth", 0.03); },
    thunder() { this.tone(58, 0.7, "sawtooth", 0.06); this.tone(46, 0.9, "sawtooth", 0.05, 0.12); },
  };
  window.SFX = SFX;

  /* ---------- Kartendaten (wie v2, bewährt) ---------- */
  const GRASS = [0, 0, 0, 0, 1, 2];
  const DIRT = 25;
  const STONE = [96, 97, 98];
  const TREES = [5, 16, 28, 27];
  const WOOD = [48, 49, 50, 51, 52, 53];
  const CRATE = 63, BARREL = 82, ANVIL = 74, TABLE = 72, DEVICE = 65, BOOK = 66;
  const WELL = 104, SIGN = 83, CART = 57;
  const WATER = 0x3f7fc4, FOAM = 0xbfe3f5;

  function hashHue(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
    return h;
  }
  function hueColor(h) { return Phaser.Display.Color.HSLToColor(h / 360, 0.7, 0.55).color; }
  function hueColorLight(h) { return Phaser.Display.Color.HSLToColor(h / 360, 0.8, 0.75).color; }

  class BootScene extends Phaser.Scene {
    constructor() { super("Boot"); }
    create() {
      let loaded = 0;
      const done = () => {
        loaded++;
        if (loaded < 2) return;
        for (const key of ["town", "dungeon"]) {
          const tex = this.textures.get(key);
          const img = tex.getSourceImage();
          const rows = Math.floor(img.height / T);
          for (let i = 0; i < COLS * rows; i++) {
            tex.add(i, 0, (i % COLS) * T, Math.floor(i / COLS) * T, T, T);
          }
        }
        this.scene.start("World");
      };
      this.textures.once("addtexture-town", done);
      this.textures.once("addtexture-dungeon", done);
      this.textures.addBase64("town", KQAssets.town);
      this.textures.addBase64("dungeon", KQAssets.dungeon);
    }
  }

  class WorldScene extends Phaser.Scene {
    constructor() { super("World"); }

    /* ============ Aufbau ============ */
    create() {
      window.WorldScene = this;
      this.W = 52; this.H = 40;
      this.ground = new Array(this.W * this.H).fill(0);
      this.solidGrid = new Uint8Array(this.W * this.H);
      this.decoList = [];
      this.labels = [];
      this.podSlots = {};
      this.slotUsed = new Array(36).fill(false);
      this.dynamic = { barrelsSig: "", flagsSig: "", svcSig: "", depSig: "" };
      this.events = { nextPirate: 0, pirate: null, nextKraken: 0, kraken: null, nextStorm: 0, storm: null, stormFlash: null };

      // Pixel-Textur für Partikel
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xffffff); g.fillRect(0, 0, 2, 2);
      g.generateTexture("px", 2, 2); g.destroy();

      this.buildMap();
      this.renderGround();
      this.renderStatics();
      this.spawnNpcs();
      this.spawnPlayer();

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

      const cam = this.cameras.main;
      cam.setBounds(0, 0, this.W * T, this.H * T);
      cam.setZoom(3);
      cam.startFollow(this.playerSprite, true, 0.15, 0.15);

      this.scale.on("resize", () => cam.setZoom(window.innerWidth < 900 ? 2.4 : 3));
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

    set(x, y, v) { this.ground[y * this.W + x] = v; }
    get(x, y) {
      if (x < 0 || y < 0 || x >= this.W || y >= this.H) return -2;
      return this.ground[y * this.W + x];
    }
    deco(x, y, sheet, idx, solid) {
      this.decoList.push({ x, y, sheet, idx });
      if (solid) this.solidGrid[Math.round(y) * this.W + Math.round(x)] = 1;
    }
    tree(x, y) { this.deco(x, y, "town", TREES[(x * 11 + y * 17) % TREES.length], true); }
    path(x0, y0, x1, y1) {
      let x = x0, y = y0;
      const sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
      while (x !== x1) { this.set(x, y, DIRT); x += sx; }
      while (y !== y1) { this.set(x, y, DIRT); y += sy; }
      this.set(x1, y1, DIRT);
    }
    house(x, y, w, kind) {
      const roofTop = kind === "stone" ? [48, 49, 50] : [52, 53, 54];
      const roofBot = kind === "stone" ? [60, 61, 62] : [64, 65, 66];
      const wall = kind === "stone" ? { plain: 91, door: 89, win: 88 } : { plain: 87, door: 85, win: 84 };
      for (let i = 0; i < w; i++) {
        const pos = i === 0 ? 0 : (i === w - 1 ? 2 : 1);
        this.deco(x + i, y, "town", roofTop[pos], true);
        this.deco(x + i, y + 1, "town", roofBot[pos], true);
        let wt = wall.plain;
        if (i === Math.floor(w / 2)) wt = wall.door;
        else if (i % 2 === 1) wt = wall.win;
        this.deco(x + i, y + 2, "town", wt, true);
      }
    }

    /** Wo trifft Land auf Wasser? Kai & Schiffsbereich gerade, sonst geschwungener Strand. */
    coastY(x) {
      if (x >= 3 && x <= 24) return 27;   // Hafenkai: gemauerte, gerade Kante
      if (x >= 30 && x <= 38) return 27;  // Wasser rund ums Schiff
      let c = 26 + Math.round(Math.sin(x * 0.9) * 1.2 + Math.sin(x * 0.31) * 0.9);
      if (x >= 43) c = Math.min(c, 26);   // Platz für Leuchtturm-Strand & Ost-Plateau
      return Math.max(25, Math.min(28, c));
    }

    buildMap() {
      const W = this.W, H = this.H;
      const SAND = [24, 25, 26];
      for (let x = 0; x < W; x++) {
        const cY = this.coastY(x);
        const beach = !(x >= 3 && x <= 24) && !(x >= 30 && x <= 38); // Kai/Schiff: kein Sandstrand
        for (let y = 0; y < H; y++) {
          if (y >= cY + (beach ? 2 : 0)) {
            this.set(x, y, -2); this.solidGrid[y * W + x] = 1;       // Wasser
          } else if (beach && y >= cY) {
            this.set(x, y, SAND[(x * 5 + y * 7) % 3]);               // Sandstrand (begehbar)
          } else {
            const r = (((x * 73856093) ^ (y * 19349663)) >>> 0) % 100;
            this.set(x, y, r < 80 ? 0 : r < 93 ? 1 : 2);             // Gras, natürlich gemischt
          }
        }
      }
      for (let x = 0; x < W; x++) this.tree(x, 0);
      for (let y = 0; y < 24; y++) { this.tree(0, y); this.tree(W - 1, y); }

      // Dock-Plattform
      for (let y = 24; y <= 26; y++) for (let x = 3; x <= 24; x++) this.set(x, y, STONE[(x * 3 + y) % 3]);

      // Stege = Nodes
      this.piers = [{ x: 5, name: "ahoi-control" }, { x: 11, name: "ahoi-worker-1" }, { x: 17, name: "ahoi-worker-2" }];
      for (const p of this.piers) {
        for (let y = 27; y <= 33; y++) for (let x = p.x; x < p.x + 3; x++) {
          this.set(x, y, -10); this.solidGrid[y * W + x] = 0;
        }
        this.labels.push({ x: p.x + 1.5, y: 27.4, text: p.name, color: "#ffd97a" });
      }
      this.labels.push({ x: 6.5, y: 23.4, text: "Bos Dock", color: "#ffffff" });

      // Dein Schiff
      this.ship = { x: 30, y: 29, w: 9, h: 6 };
      for (let y = this.ship.y; y < this.ship.y + this.ship.h; y++)
        for (let x = this.ship.x; x < this.ship.x + this.ship.w; x++) {
          this.set(x, y, -11); this.solidGrid[y * W + x] = 0;
        }
      for (let y = 27; y < 31; y++) { for (const x of [33, 34]) { this.set(x, y, -10); this.solidGrid[y * W + x] = 0; } }
      this.labels.push({ x: this.ship.x + 4.5, y: this.ship.y - 0.6, text: "Dein Schiff", color: "#ffffff" });

      // Marktplatz
      for (let y = 16; y <= 22; y++) for (let x = 24; x <= 32; x++) this.set(x, y, DIRT);
      this.deco(28, 18, "town", WELL, true);
      this.deco(31, 16, "town", CART, true);
      this.labels.push({ x: 31.5, y: 15.4, text: "Markt", color: "#ffffff" });
      this.deco(24, 22, "town", SIGN, true);

      this.path(28, 22, 28, 24);
      this.path(26, 16, 26, 14);
      this.path(24, 19, 13, 19); this.path(13, 19, 13, 15);
      this.path(32, 19, 41, 19);
      this.path(33, 16, 40, 13);

      // Gebäude & Zonen
      this.house(23, 10, 7, "stone");
      this.labels.push({ x: 26.5, y: 9.4, text: "Hafenmeisterei", color: "#ffffff" });
      for (let y = 10; y <= 15; y++) for (let x = 8; x <= 17; x++) this.set(x, y, DIRT);
      this.house(8, 8, 5, "brown");
      this.deco(12, 12, "dungeon", ANVIL, true);
      this.deco(14, 12, "dungeon", TABLE, true);
      this.deco(14, 11.6, "dungeon", DEVICE, false);
      this.labels.push({ x: 12.5, y: 7.4, text: "Werft", color: "#ffffff" });
      this.flagPoles = [{ x: 9, y: 10 }, { x: 10.5, y: 10 }, { x: 16, y: 10 }];

      this.house(38, 9, 5, "brown");
      this.labels.push({ x: 40.5, y: 8.4, text: "Kartenhaus", color: "#ffffff" });

      for (let y = 18; y <= 22; y++) for (let x = 41; x <= 46; x++) this.set(x, y, DIRT);
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
      this.deco(16, 21, "town", 29, false);
      this.deco(35, 12, "town", 17, false);
      this.deco(10, 17, "town", 30, false);
      this.deco(42, 11, "town", 31, false);
    }

    renderGround() {
      const rt = this.add.renderTexture(0, 0, this.W * T, this.H * T).setOrigin(0).setDepth(0);
      // Meer in Tiefen-Bändern: zur Küste hell, nach unten dunkler
      rt.fill(WATER, 1, 0, 24 * T, this.W * T, (this.H - 24) * T);
      rt.fill(0x3873b4, 1, 0, 32 * T, this.W * T, (this.H - 32) * T);
      rt.fill(0x315f9c, 1, 0, 36 * T, this.W * T, (this.H - 36) * T);
      for (let y = 0; y < this.H; y++) {
        for (let x = 0; x < this.W; x++) {
          const v = this.get(x, y);
          if (v === -2) {
            // Schaumkanten überall, wo Land ans Wasser grenzt
            if (this.get(x, y - 1) !== -2 && y > 0) rt.fill(FOAM, 0.8, x * T, y * T, T, 2.5);
            if (this.get(x - 1, y) !== -2 && x > 0) rt.fill(FOAM, 0.55, x * T, y * T, 2, T);
            if (this.get(x + 1, y) !== -2 && x < this.W - 1) rt.fill(FOAM, 0.55, x * T + T - 2, y * T, 2, T);
          } else if (v === -10) {
            rt.drawFrame("dungeon", WOOD[(x * 5 + y * 3) % 3], x * T, y * T);
          } else if (v === -11) {
            rt.drawFrame("dungeon", WOOD[3 + (x + y) % 3], x * T, y * T);
          } else {
            rt.drawFrame("town", v, x * T, y * T);
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

    /** Gut lesbares Welt-Label: helle Schrift auf dunkler Pille. */
    makeLabel(x, y, text, color) {
      return this.add.text(x, y, text, {
        fontFamily: "Verdana, 'Segoe UI', sans-serif", fontSize: "5px", color: color || "#ffffff",
        backgroundColor: "rgba(8,14,24,0.7)", padding: { x: 2, y: 1 }, resolution: 10,
      }).setOrigin(0.5, 1).setDepth(9500);
    }

    /** Weicher Schatten unter einer Figur. */
    addShadow(x, y, w) {
      return this.add.ellipse(x, y, w || 10, 4, 0x000000, 0.26).setDepth(1.6);
    }

    renderStatics() {
      // Deko (Bäume, Häuser, Möbel) – Tiefe nach y
      for (const d of this.decoList) {
        this.add.image(d.x * T + 8, d.y * T + 8, d.sheet, d.idx).setDepth(d.y * T + T);
      }
      // === Ein richtiges Schiff: Rumpf mit Bug & Heck, Mast, Rah, Segel, Takelage ===
      const s = this.ship, px = s.x * T, py = s.y * T, pw = s.w * T, ph = s.h * T;
      const midY = py + ph / 2;
      const gfx = this.add.graphics().setDepth(2);
      // Bug (spitz nach Osten) – Rumpf + hellere Deckfläche
      gfx.fillStyle(0x4a3426);
      gfx.fillPoints([{ x: px + pw - 1, y: py - 4 }, { x: px + pw + 30, y: midY }, { x: px + pw - 1, y: py + ph + 4 }], true);
      gfx.fillStyle(0xc89858);
      gfx.fillPoints([{ x: px + pw - 1, y: py + 4 }, { x: px + pw + 19, y: midY }, { x: px + pw - 1, y: py + ph - 4 }], true);
      // Heck (rund, Westen)
      gfx.fillStyle(0x4a3426); gfx.fillRoundedRect(px - 13, py - 4, 16, ph + 8, { tl: 9, bl: 9, tr: 0, br: 0 });
      gfx.fillStyle(0xc89858); gfx.fillRoundedRect(px - 8, py + 3, 10, ph - 6, { tl: 5, bl: 5, tr: 0, br: 0 });
      // Bordwände (Reling) mit Holz-Posten
      gfx.fillStyle(0x4a3426); gfx.fillRect(px - 4, py - 4, pw + 4, 4); gfx.fillRect(px - 4, py + ph, pw + 4, 4);
      gfx.fillStyle(0x6b4f35);
      for (let rx = px; rx < px + pw; rx += 12) { gfx.fillRect(rx, py - 5, 3, 5); gfx.fillRect(rx, py + ph, 3, 5); }
      // Mast mit Rah und gerefftem Segel
      const mx = px + pw * 0.45;
      gfx.fillStyle(0x3a2e22); gfx.fillRect(mx - 1.5, midY - 38, 3, 40);
      gfx.fillRect(mx - 14, midY - 34, 28, 2);                     // Rah (Querbalken)
      gfx.fillStyle(0xf2ecd9); gfx.fillRoundedRect(mx - 13, midY - 31, 26, 6, 3); // gerefftes Segel
      gfx.fillStyle(0xddd5bd); gfx.fillRect(mx - 13, midY - 27, 26, 1.5);
      // Takelage
      gfx.lineStyle(1, 0x3a2e22, 0.7);
      gfx.lineBetween(mx, midY - 38, px + pw + 27, midY);
      gfx.lineBetween(mx, midY - 38, px - 10, midY - 2);
      // Ausguck + Flagge am Masttop
      gfx.fillStyle(0x4a3426); gfx.fillRect(mx - 4, midY - 41, 8, 3);
      this.shipFlag = this.add.image(mx + 7, midY - 44, "px").setScale(6, 4).setDepth(3);
      this.tweens.add({ targets: this.shipFlag, y: midY - 46, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });

      // === Leuchtturm (Sturmwache) ===
      const lh = this.lighthouse, lx = lh.x * T + 8, lyB = (lh.y + 1) * T;
      const lg = this.add.graphics().setDepth(lyB + 4);
      lg.fillStyle(0x5a6470); lg.fillEllipse(lx, lyB - 1, 26, 8);            // Felsen
      lg.fillStyle(0xf2f2ee); lg.fillRect(lx - 6, lyB - 40, 12, 36);          // Turm
      lg.fillStyle(0xd9534f); lg.fillRect(lx - 6, lyB - 34, 12, 6); lg.fillRect(lx - 6, lyB - 20, 12, 6); // rote Bänder
      lg.fillStyle(0x33363d); lg.fillRect(lx - 7, lyB - 46, 14, 6);           // Kanzel
      lg.fillStyle(0x2a2c33); lg.fillPoints([{ x: lx - 7, y: lyB - 46 }, { x: lx, y: lyB - 52 }, { x: lx + 7, y: lyB - 46 }], true); // Dach
      this.lhLight = this.add.image(lx, lyB - 43, "px").setScale(4.5, 2.5).setTint(0xffe28a).setDepth(lyB + 5);
      this.tweens.add({ targets: this.lhLight, alpha: { from: 0.35, to: 1 }, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.inOut" });

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

      // Beschriftungen
      for (const l of this.labels) {
        this.makeLabel(l.x * T, l.y * T, l.text, l.color).setDepth(10000);
      }

      // Terraform-Plateau (Container, an/aus je nach State)
      const p = this.tfPlatform;
      this.tfGroup = this.add.container(0, 0).setDepth(2);
      const tfRt = this.add.renderTexture(p.x * T, p.y * T, p.w * T, p.h * T).setOrigin(0);
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) tfRt.drawFrame("dungeon", WOOD[(x + y) % 3], x * T, y * T);
      tfRt.fill(FOAM, 0.7, 0, 0, p.w * T, 2);
      this.tfGroup.add(tfRt);
      const mkLabel = (tx, ty, txt, color) => this.makeLabel(tx, ty, txt, color);
      this.tfGroup.add(this.add.image((p.x + 1) * T + 8, (p.y + 1) * T + 8, "dungeon", CRATE));
      this.tfGroup.add(this.add.image((p.x + 4) * T + 8, (p.y + 2) * T + 8, "dungeon", CRATE));
      this.tfGroup.add(mkLabel((p.x + 1.5) * T, (p.y + 0.9) * T, "worker-3", "#9fe6a0"));
      this.tfGroup.add(mkLabel((p.x + 4.5) * T, (p.y + 1.9) * T, "worker-4", "#9fe6a0"));
      this.tfGroup.add(mkLabel((p.x + 3.5) * T, (p.y - 0.2) * T, "ost-erweiterung", "#ffd97a"));
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

      this.dynGroup = this.add.group(); // Fässer, Flaggen, Laternen, Labels (werden neu gebaut)
    }

    spawnNpcs() {
      const defs = [
        { id: "ole", x: 26, y: 14.6 }, { id: "bo", x: 8, y: 25 }, { id: "ada", x: 40, y: 13.6 },
        { id: "runa", x: 13, y: 13 }, { id: "theo", x: 44, y: 20.6 }, { id: "pelle", x: 31, y: 17.2 },
        { id: "kralle", x: this.ship.x + 7, y: this.ship.y + 1 },
        { id: "juno", x: 45.8, y: 24.2 },
      ];
      this.npcs = defs.map(d => {
        const meta = KQContent.NPCS[d.id];
        this.addShadow(d.x * T + 8, d.y * T + 15);
        const spr = this.add.image(d.x * T + 8, d.y * T + 8, "dungeon", meta.sprite).setDepth(d.y * T + T);
        this.tweens.add({ targets: spr, y: d.y * T + 7, duration: 900 + Math.random() * 400, yoyo: true, repeat: -1, ease: "Sine.inOut" });
        const marker = this.add.text(d.x * T + 8, d.y * T - 6, "!", { fontFamily: "Consolas", fontSize: "8px", color: "#ffc857", fontStyle: "bold", resolution: 8 })
          .setOrigin(0.5, 1).setDepth(10000).setShadow(0.5, 0.5, "#000", 1);
        this.tweens.add({ targets: marker, y: d.y * T - 9, duration: 500, yoyo: true, repeat: -1, ease: "Sine.inOut" });
        return { id: d.id, x: d.x, y: d.y, sprite: spr, marker };
      });
    }

    spawnPlayer() {
      const sp = Game.state.player;
      this.playerPos = {
        x: sp && sp.x ? sp.x : (this.ship.x + 4) * T,
        y: sp && sp.y ? sp.y : (this.ship.y + 2) * T,
        dir: 1, moving: false,
      };
      this.playerShadow = this.addShadow(this.playerPos.x, this.playerPos.y + 6);
      this.playerSprite = this.add.image(this.playerPos.x, this.playerPos.y, "dungeon", Game.state.character || 85).setDepth(this.playerPos.y + 8);
      this.petShadow = this.addShadow(0, 0, 7).setVisible(false);
      this.petSprite = this.add.image(0, 0, "dungeon", 124).setVisible(false).setDepth(1);
      this.petTrail = [];
      this.bobT = 0;
      this.stepAcc = 0;
    }
    get player() { return this.playerPos; }

    /* ============ Kollision & Bewegung ============ */
    isSolidAt(px, py) {
      const tx = Math.floor(px / T), ty = Math.floor(py / T);
      if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return true;
      const p = this.tfPlatform;
      if (tx >= p.x && tx < p.x + p.w && ty >= p.y && ty < p.y + p.h) {
        return !(Game.sim && Game.sim.tf.applied);
      }
      return !!this.solidGrid[ty * this.W + tx];
    }

    tryMove(dx, dy) {
      const pl = this.playerPos;
      const probe = (nx, ny) =>
        this.isSolidAt(nx - 5, ny - 2) || this.isSolidAt(nx + 5, ny - 2) ||
        this.isSolidAt(nx - 5, ny + 5) || this.isSolidAt(nx + 5, ny + 5);
      if (!probe(pl.x + dx, pl.y)) pl.x += dx;
      if (!probe(pl.x, pl.y + dy)) pl.y += dy;
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

    /* ============ Effekte (von der UI aufrufbar) ============ */
    burstAt(x, y, kind) {
      const e = kind === "splash" ? this.splash : kind === "dust" ? this.dust : this.sparkle;
      e.explode(kind === "splash" ? 14 : 10, x, y);
    }
    burstAtPlayer(kind) { this.burstAt(this.playerPos.x, this.playerPos.y - 8, kind); }

    floatText(x, y, str, color) {
      const t = this.add.text(x, y, str, { fontFamily: "Consolas", fontSize: "6px", color: color || "#ffd97a", resolution: 8 })
        .setOrigin(0.5).setDepth(10001).setShadow(0.5, 0.5, "#000", 1);
      this.tweens.add({ targets: t, y: y - 14, alpha: 0, duration: 1400, ease: "Sine.out", onComplete: () => t.destroy() });
    }

    /* ============ Cluster → Welt ============ */
    podSlotPos(slot) {
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
          let slot = this.slotUsed.findIndex(u => !u);
          if (slot === -1) slot = 0;
          this.slotUsed[slot] = true;
          const pos = this.podSlotPos(slot);
          const hue = hashHue(p.dep);
          const shadow = this.addShadow(pos.x, pos.y + 7, 11);
          const crate = this.add.image(pos.x, pos.y - 44, "dungeon", CRATE).setDepth(pos.y + 8);
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
      const brokenMap = {};
      for (const d of Game.sim.deployments) brokenMap[d.name] = !!d.broken;
      for (const info of Object.values(this.podSlots)) {
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
      this.tfBuoys.forEach(b => b.setVisible(Game.sim.tf.initialized && !applied));
      this.cannon.setVisible(Game.hasUpgrade("kanone"));
    }

    rebuildDynamic() {
      this.dynGroup.clear(true, true);
      const mkText = (x, y, str, color) => this.makeLabel(x, y, str, color);

      // Deployment-Schilder über der ersten Kiste (kaputte rot mit Status!)
      const seen = {};
      for (const d of Game.sim.deployments) {
        const first = d.pods[0] && this.podSlots[d.pods[0].name];
        if (first && !seen[d.name]) {
          seen[d.name] = true;
          const pos = this.podSlotPos(first.slot);
          const text = d.broken
            ? d.name + " ⚠ " + (d.broken.type === "imagepull" ? "ImagePullBackOff" : d.broken.type === "crashloop" ? "CrashLoopBackOff" : "Pending")
            : d.name + " " + d.replicas + "/" + d.replicas;
          const color = d.broken ? "#ff9b9b" : "#" + hueColorLight(hashHue(d.name)).toString(16).padStart(6, "0");
          this.dynGroup.add(mkText(pos.x, pos.y - 12, text, color));
        }
      }
      // Docker-Fässer bei Bo (max. 10 sichtbar, Labels versetzt gegen Überlappung)
      Game.sim.docker.containers.slice(-10).forEach((c, i) => {
        const bx = (4 + (i % 5) * 2) * T + 8, by = (26 + Math.floor(i / 5) * 0.0) * T + 8;
        const barrel = this.add.image(bx, by, "dungeon", BARREL).setDepth(by + 8).setAlpha(c.running ? 1 : 0.45);
        this.dynGroup.add(barrel);
        this.dynGroup.add(mkText(bx, by - 9 - (i % 2) * 7, c.name, c.running ? "#9fe6a0" : "#8a98a8"));
      });
      // Helm-Flaggen an der Werft
      Game.sim.releases.forEach((r, i) => {
        const pole = this.flagPoles[i % this.flagPoles.length];
        const fx = pole.x * T + 8, fy = pole.y * T;
        const mast = this.add.image(fx, fy, "px").setScale(1, 15).setTint(0x6b5436).setDepth(fy + 30);
        const flag = this.add.image(fx + 6, fy - 12, "px").setScale(6, 3.5).setTint(hueColor(hashHue(r.name))).setDepth(fy + 31);
        this.tweens.add({ targets: flag, y: fy - 14, duration: 600, yoyo: true, repeat: -1, ease: "Sine.inOut" });
        this.dynGroup.add(mast); this.dynGroup.add(flag);
        this.dynGroup.add(mkText(fx + 4, fy - 18, r.name + " rev" + r.revision, "#" + hueColorLight(hashHue(r.name)).toString(16).padStart(6, "0")));
      });
      // Service-Laternen am Dockrand
      Game.sim.services.forEach((s, i) => {
        const lx = (6 + i * 4) * T + 8, ly = 23 * T + 8;
        const post = this.add.image(lx, ly + 2, "px").setScale(1, 6).setTint(0x5a4632).setDepth(ly + 8);
        const lamp = this.add.image(lx, ly - 5, "px").setScale(3, 2.5).setTint(0xffdc78).setDepth(ly + 9);
        this.tweens.add({ targets: lamp, alpha: { from: 0.55, to: 1 }, duration: 800, yoyo: true, repeat: -1 });
        this.dynGroup.add(post); this.dynGroup.add(lamp);
        this.dynGroup.add(mkText(lx, ly - 10, s.name, "#ffd97a"));
      });
    }

    /* ============ Events: Piraten & Krake ============ */
    scheduleEvents(delaySec) {
      const now = this.time.now / 1000;
      this.events.nextPirate = now + (delaySec || Phaser.Math.Between(200, 360));
      this.events.nextKraken = now + (delaySec ? delaySec + 90 : Phaser.Math.Between(300, 500));
      this.events.nextStorm = now + (delaySec ? delaySec + 150 : Phaser.Math.Between(260, 430));
    }

    anyEventActive() {
      return !!(this.events.pirate || this.events.kraken || this.events.storm);
    }

    /* ---------- Sturm: ein Deployment geht kaputt, du reparierst es ---------- */
    tryStartStorm() {
      if (this.anyEventActive() || !Game.state.completedQuests.includes("q17")) return;
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

      const deadline = 240;
      this.events.storm = { dep: dep.name, until: this.time.now / 1000 + deadline };
      UI.showAlarm("⛈️ <b>STURMSCHADEN!</b> Das Deployment <b>" + dep.name + "</b> ist ausgefallen – und verdient nichts mehr! " + hintCmd, deadline);
    }

    resolveStorm(success) {
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
      if (this.anyEventActive() || !Game.state.completedQuests.includes("q7")) return;
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
      const deadline = 180;
      this.events.pirate = { dep: dep.name, want, boat, until: this.time.now / 1000 + deadline };
      UI.showAlarm("🏴‍☠️ <b>PIRATEN-ÜBERFALL!</b> Sie haben Kisten von <b>" + dep.name + "</b> geklaut (nur noch " + dep.replicas + "/" + want + ")! " +
        "Skaliere zurück auf <b>" + want + "</b>: <code>kubectl scale deployment " + dep.name + " --replicas=" + want + "</code>", deadline);
    }

    resolvePirate(success) {
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
      if (this.anyEventActive() || !Game.state.completedQuests.includes("q14")) return;
      if (UI.blocking()) { this.events.nextKraken += 20; return; }
      const baseline = Game.sim.secrets.length;

      const kx = 26 * T, ky = 30 * T;
      const kraken = this.add.container(kx, ky + 30).setDepth(8000);
      const body = this.add.graphics();
      body.fillStyle(0x7b3fa0); body.fillCircle(0, 0, 9);
      body.fillStyle(0xffffff); body.fillCircle(-3, -2, 2.2); body.fillCircle(3, -2, 2.2);
      body.fillStyle(0x111111); body.fillCircle(-3, -2, 1); body.fillCircle(3, -2, 1);
      for (let i = -3; i <= 3; i++) { body.fillStyle(0x7b3fa0); body.fillRect(i * 3.4 - 1, 7, 2, 7 + Math.abs(i)); }
      kraken.add(body);
      this.tweens.add({ targets: kraken, y: ky, duration: 900, ease: "Back.out" });
      this.tweens.add({ targets: kraken, angle: { from: -4, to: 4 }, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });

      SFX.alarm();
      this.cameras.main.shake(250, 0.004);
      const deadline = 120;
      this.events.kraken = { kraken, baseline, until: this.time.now / 1000 + deadline };
      UI.showAlarm("🐙 <b>DIE HACKER-KRAKE!</b> Sie schnüffelt nach Klartext-Daten! Vertreibe sie, indem du irgendein neues <b>Secret</b> anlegst: " +
        "<code>kubectl create secret generic &lt;name&gt; --from-literal=passwort=&lt;wert&gt;</code>", deadline);
    }

    resolveKraken(success) {
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
    update(time, delta) {
      const dt = Math.min(0.05, delta / 1000);
      const pl = this.playerPos;
      const keys = window.KQKeys || {};
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
        this.tryMove(dx / len * 75 * dt, dy / len * 75 * dt);
        this.petTrail.push({ x: pl.x, y: pl.y });
        if (this.petTrail.length > 26) this.petTrail.shift();
        this.bobT += dt * 12;
        // Staubwölkchen beim Laufen
        this.stepAcc += dt;
        if (this.stepAcc > 0.3) { this.stepAcc = 0; this.dust.explode(2, pl.x, pl.y + 6); }
      }
      const bob = pl.moving ? Math.abs(Math.sin(this.bobT)) * 1.6 : 0;
      this.playerSprite.setPosition(pl.x, pl.y - 2 - bob).setFlipX(pl.dir === -1).setDepth(pl.y + 8);
      this.playerShadow.setPosition(pl.x, pl.y + 6);

      // Haustier
      if (Game.state.activePet) {
        const item = KQContent.SHOP.find(s => s.id === Game.state.activePet);
        const pos = this.petTrail[Math.max(0, this.petTrail.length - 16)] || pl;
        this.petSprite.setVisible(true).setTexture("dungeon", item.sprite)
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

  window.KQScenes = { BootScene, WorldScene };
})();
