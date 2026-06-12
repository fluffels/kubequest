/* ===== KubeQuest 2.0 – Die Spielwelt =====
 * Port Kubernia: eine begehbare Hafeninsel. Die Welt spiegelt den Cluster:
 *  - 3 Stege = Nodes, Kisten darauf = Pods (live aus dem Simulator!)
 *  - Laternen = Services, Werft-Flaggen = Helm-Releases
 *  - Fässer am Dock = Docker-Container, Ost-Plateau = Terraform
 */

(function () {
  "use strict";

  const T = 16; // Tile-Größe in Welt-Pixeln

  // Tile-Indizes (town.png)
  const GRASS = [0, 0, 0, 0, 1, 2];
  const DIRT = 25;
  const STONE = [96, 97, 98];
  const TREES = [5, 16, 28, 27];
  const WELL = 104;
  const SIGN = 83;
  const CART = 57;
  // Tile-Indizes (dungeon.png)
  const WOOD = [48, 49, 50, 51, 52, 53];
  const CRATE = 63;
  const BARREL = 82;
  const ANVIL = 74;
  const TABLE = 72;
  const TERMINAL_DEV = 65;

  const WATER_COLOR = "#3f7fc4";
  const WATER_DEEP = "#356dab";
  const FOAM = "#bfe3f5";

  function hashHue(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
    return h;
  }

  const World = {
    W: 52, H: 40,
    ground: null,   // int-Array: Tile-Index town.png, -2 = Wasser
    solid: null,
    deco: [],       // {x, y, sheet, idx, solid}
    labels: [],     // {x, y, text}
    npcs: [],       // {id, name, sprite, x, y(Tile)}
    player: { x: 0, y: 0, dir: 1, moving: false, spawnX: 0, spawnY: 0 },
    petTrail: [],
    particles: [],
    podSlots: {},   // podName -> Slotnummer
    slotUsed: [],
    prevPods: [],
    prevReleases: [],

    /* ============ Aufbau ============ */
    build() {
      const W = this.W, H = this.H;
      this.ground = new Array(W * H).fill(0);
      this.solid = new Uint8Array(W * H);
      this.deco = [];
      this.labels = [];

      // Gras überall, Wasser unten (ab Zeile 27)
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (y >= 27) { this.set(x, y, -2); this.solid[y * W + x] = 1; }
          else this.set(x, y, GRASS[(x * 7 + y * 13) % GRASS.length]);
        }
      }
      // Rand der Insel (oben/links/rechts): Bäume als natürliche Grenze
      for (let x = 0; x < W; x++) { this.tree(x, 0); }
      for (let y = 0; y < 27; y++) { this.tree(0, y); this.tree(W - 1, y); }

      // ---- Dock-Plattform (Stein) am Südufer ----
      this.fillGround(3, 24, 24, 26, () => STONE[(Math.random() * 3) | 0]);

      // ---- 3 Stege = die Nodes ----
      const piers = [
        { x: 5, name: "ahoi-control" },
        { x: 11, name: "ahoi-worker-1" },
        { x: 17, name: "ahoi-worker-2" },
      ];
      this.piers = piers;
      for (const p of piers) {
        for (let y = 27; y <= 33; y++) {
          for (let x = p.x; x < p.x + 3; x++) {
            this.set(x, y, -10); // Holzsteg (gezeichnet aus dungeon-Sheet)
            this.solid[y * W + x] = 0;
          }
        }
        this.labels.push({ x: p.x + 1.5, y: 27.2, text: p.name, color: "#ffd97a" });
      }

      // ---- Bos Docker-Ecke (Fässer-Stellplätze) westlich ----
      this.labels.push({ x: 6.5, y: 23.4, text: "Bos Dock", color: "#fff" });

      // ---- Dein Schiff (Süd-Ost) ----
      this.ship = { x: 30, y: 29, w: 9, h: 6 };
      for (let y = this.ship.y; y < this.ship.y + this.ship.h; y++) {
        for (let x = this.ship.x; x < this.ship.x + this.ship.w; x++) {
          this.set(x, y, -11); // Schiffsdeck
          this.solid[y * W + x] = 0;
        }
      }
      // Steg zum Schiff
      for (let y = 27; y < 31; y++) { this.set(33, y, -10); this.set(34, y, -10); this.solid[y * W + 33] = 0; this.solid[y * W + 34] = 0; }
      this.labels.push({ x: this.ship.x + 4.5, y: this.ship.y - 0.6, text: "Dein Schiff", color: "#fff" });
      this.player.spawnX = (this.ship.x + 4) * T;
      this.player.spawnY = (this.ship.y + 2) * T;

      // ---- Marktplatz (Mitte) ----
      this.fillGround(24, 16, 32, 22, () => DIRT);
      this.put(28, 18, "town", WELL, true);
      this.put(31, 16, "town", CART, true);
      this.labels.push({ x: 31.5, y: 15.4, text: "Markt", color: "#fff" });
      this.put(24, 22, "town", SIGN, true);

      // Wege
      this.path(28, 22, 28, 24); // Markt -> Dock
      this.path(26, 16, 26, 14); // Markt -> Hafenmeisterei
      this.path(24, 19, 13, 19); this.path(13, 19, 13, 15); // -> Werft
      this.path(32, 19, 41, 19); // -> Theo
      this.path(33, 16, 40, 13); // -> Kartenhaus (diagonal grob)

      // ---- Hafenmeisterei (Ole) ----
      this.house(23, 10, 7, "stone");
      this.labels.push({ x: 26.5, y: 9.4, text: "Hafenmeisterei", color: "#fff" });

      // ---- Werft (Runa) ----
      this.fillGround(8, 10, 17, 15, () => DIRT);
      this.house(8, 8, 5, "brown");
      this.put(12, 12, "dungeon", ANVIL, true);
      this.put(14, 12, "dungeon", TABLE, true);
      this.put(14, 11.999, "dungeon", TERMINAL_DEV, false); // Gerät auf dem Tisch
      this.labels.push({ x: 12.5, y: 7.4, text: "Werft", color: "#fff" });
      this.flagPoles = [{ x: 9, y: 10 }, { x: 10.5, y: 10 }, { x: 16, y: 10 }];

      // ---- Kartenhaus (Ada) ----
      this.house(38, 9, 5, "brown");
      this.labels.push({ x: 40.5, y: 8.4, text: "Kartenhaus", color: "#fff" });

      // ---- Theos Vermessungs-Camp ----
      this.fillGround(41, 18, 46, 22, () => DIRT);
      this.put(43, 19, "dungeon", TABLE, true);
      this.put(43, 18.999, "dungeon", 66, false); // Buch/Plan auf dem Tisch
      this.labels.push({ x: 43.5, y: 17.4, text: "Vermessung", color: "#fff" });

      // ---- Terraform-Plateau (Ost, erscheint erst durch apply!) ----
      this.tfPlatform = { x: 44, y: 28, w: 7, h: 5 };

      // ---- Bäume & Deko verstreut ----
      const spots = [[5,5],[7,3],[15,4],[20,6],[33,5],[36,4],[44,5],[47,8],[47,13],[36,15],[20,12],[5,17],[3,21],[8,20],[18,16],[34,9],[30,7],[45,15],[37,22],[6,22],[21,21]];
      spots.forEach(([x, y]) => this.tree(x, y));
      this.put(16, 21, "town", 29, false);  // Pilze
      this.put(35, 12, "town", 17, false);  // Farn
      this.put(10, 17, "town", 30, false);  // Busch
      this.put(42, 11, "town", 31, false);  // Busch

      // ---- NPCs platzieren ----
      this.npcs = [
        { id: "ole", x: 26, y: 14.6 },
        { id: "bo", x: 8, y: 25 },
        { id: "ada", x: 40, y: 13.6 },
        { id: "runa", x: 13, y: 13 },
        { id: "theo", x: 44, y: 20.6 },
        { id: "pelle", x: 31, y: 17.2 },
        { id: "kralle", x: this.ship.x + 7, y: this.ship.y + 1 },
      ].map(n => Object.assign({}, KQContent.NPCS[n.id], n));

      this.slotUsed = new Array(36).fill(false);
    },

    set(x, y, v) { this.ground[y * this.W + x] = v; },
    get(x, y) {
      if (x < 0 || y < 0 || x >= this.W || y >= this.H) return -2;
      return this.ground[y * this.W + x];
    },

    fillGround(x0, y0, x1, y1, fn) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, fn(x, y));
    },

    path(x0, y0, x1, y1) {
      let x = x0, y = y0;
      const sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
      while (x !== x1) { this.set(x, y, DIRT); x += sx; }
      while (y !== y1) { this.set(x, y, DIRT); y += sy; }
      this.set(x1, y1, DIRT);
    },

    put(x, y, sheet, idx, solid) {
      this.deco.push({ x, y, sheet, idx });
      if (solid) this.solid[Math.round(y) * this.W + Math.round(x)] = 1;
    },

    tree(x, y) {
      this.put(x, y, "town", TREES[(x * 11 + y * 17) % TREES.length], true);
    },

    /** Kleines Haus: Dachzeile(n) + Wandzeile mit Tür. */
    house(x, y, w, kind) {
      const roofTop = kind === "stone" ? [48, 49, 50] : [52, 53, 54];
      const roofBot = kind === "stone" ? [60, 61, 62] : [64, 65, 66];
      const wall = kind === "stone" ? { plain: 91, door: 89, win: 88 } : { plain: 87, door: 85, win: 84 };
      for (let i = 0; i < w; i++) {
        const pos = i === 0 ? 0 : (i === w - 1 ? 2 : 1);
        this.put(x + i, y, "town", roofTop[pos], true);
        this.put(x + i, y + 1, "town", roofBot[pos], true);
        let wt = wall.plain;
        if (i === Math.floor(w / 2)) wt = wall.door;
        else if (i % 2 === 1) wt = wall.win;
        this.put(x + i, y + 2, "town", wt, true);
      }
    },

    /* ============ Kollision ============ */
    isSolidAt(px, py) {
      const tx = Math.floor(px / T), ty = Math.floor(py / T);
      if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return true;
      // Terraform-Plateau: nur begehbar, wenn gebaut
      const p = this.tfPlatform;
      if (tx >= p.x && tx < p.x + p.w && ty >= p.y && ty < p.y + p.h) {
        return !(Game.sim && Game.sim.tf.applied);
      }
      return !!this.solid[ty * this.W + tx];
    },

    tryMove(dx, dy) {
      const pl = this.player;
      const probe = (nx, ny) =>
        this.isSolidAt(nx - 5, ny - 2) || this.isSolidAt(nx + 5, ny - 2) ||
        this.isSolidAt(nx - 5, ny + 4) || this.isSolidAt(nx + 5, ny + 4);
      const nx = pl.x + dx, ny = pl.y + dy;
      if (!probe(nx, pl.y)) pl.x = nx;
      if (!probe(pl.x, ny)) pl.y = ny;
    },

    update(dt, blocked) {
      const pl = this.player;
      const k = Engine.keys;
      let dx = 0, dy = 0;
      if (!blocked) {
        if (k["w"] || k["ArrowUp"]) dy -= 1;
        if (k["s"] || k["ArrowDown"]) dy += 1;
        if (k["a"] || k["ArrowLeft"]) dx -= 1;
        if (k["d"] || k["ArrowRight"]) dx += 1;
      }
      pl.moving = dx !== 0 || dy !== 0;
      if (pl.moving) {
        const len = Math.hypot(dx, dy);
        const speed = 75 * dt;
        if (dx < 0) pl.dir = -1; else if (dx > 0) pl.dir = 1;
        this.tryMove(dx / len * speed, dy / len * speed);
        this.petTrail.push({ x: pl.x, y: pl.y });
        if (this.petTrail.length > 24) this.petTrail.shift();
      }
      // Partikel
      this.particles = this.particles.filter(p => (p.life -= dt) > 0);
      for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; }

      this.syncCluster();
    },

    /* ============ Cluster → Welt ============ */
    burst(wx, wy, color, n) {
      for (let i = 0; i < n; i++) {
        this.particles.push({
          x: wx, y: wy, color,
          vx: (Math.random() - 0.5) * 50,
          vy: -Math.random() * 50 - 10,
          life: 0.5 + Math.random() * 0.4,
        });
      }
    },

    podSlotPos(slot) {
      // 12 Slots pro Steg (2 Spalten x 6 Reihen), Mittelspalte bleibt frei
      const pier = this.piers[Math.floor(slot / 12)];
      const i = slot % 12;
      const col = i % 2 === 0 ? 0 : 2;
      const row = Math.floor(i / 2);
      return { x: (pier.x + col) * T, y: (28 + row) * T };
    },

    syncCluster() {
      if (!Game.sim) return;
      const pods = [];
      for (const d of Game.sim.deployments) for (const p of d.pods) pods.push({ name: p.name, dep: d.name });
      const names = pods.map(p => p.name);

      // Neue Pods: Slot suchen, "Kran-Drop"
      for (const p of pods) {
        if (this.podSlots[p.name] === undefined) {
          let slot = this.slotUsed.findIndex(u => !u);
          if (slot === -1) slot = 0;
          this.slotUsed[slot] = true;
          this.podSlots[p.name] = { slot, drop: 40, dep: p.dep };
          const pos = this.podSlotPos(slot);
          this.burst(pos.x + 8, pos.y + 10, "#d9b380", 6);
        }
      }
      // Entfernte Pods: Platsch!
      for (const name of Object.keys(this.podSlots)) {
        if (!names.includes(name)) {
          const info = this.podSlots[name];
          const pos = this.podSlotPos(info.slot);
          this.burst(pos.x + 8, pos.y + 12, FOAM, 12);
          this.slotUsed[info.slot] = false;
          delete this.podSlots[name];
        }
      }
      // Drop-Animation weiterticken
      for (const info of Object.values(this.podSlots)) {
        if (info.drop > 0) info.drop = Math.max(0, info.drop - 140 * (1 / 60));
      }
    },

    /* ============ Rendering ============ */
    render(ctx) {
      const E = Engine, S = E.SCALE;
      const vw = E.canvas.width / S, vh = E.canvas.height / S;
      const pl = this.player;
      E.cam.x = Math.max(0, Math.min(this.W * T - vw, pl.x - vw / 2));
      E.cam.y = Math.max(0, Math.min(this.H * T - vh, pl.y - vh / 2));

      ctx.fillStyle = WATER_DEEP;
      ctx.fillRect(0, 0, E.canvas.width, E.canvas.height);

      const x0 = Math.floor(E.cam.x / T), y0 = Math.floor(E.cam.y / T);
      const x1 = Math.min(this.W - 1, Math.ceil((E.cam.x + vw) / T));
      const y1 = Math.min(this.H - 1, Math.ceil((E.cam.y + vh) / T));

      // --- Boden ---
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const g = this.get(x, y);
          if (g === -2) {
            this.renderWater(x, y);
          } else if (g === -10) {
            E.drawTile("dungeon", WOOD[(x * 5 + y * 3) % 3], x * T, y * T);
          } else if (g === -11) {
            E.drawTile("dungeon", WOOD[3 + (x + y) % 3], x * T, y * T);
          } else {
            E.drawTile("town", g, x * T, y * T);
          }
        }
      }

      // Schiffsrumpf-Kante
      this.renderShipFrame();
      // Terraform-Plateau
      this.renderTfPlatform();

      // --- Entities (y-sortiert) ---
      const ents = [];
      for (const d of this.deco) ents.push({ y: d.y * T + T, draw: () => E.drawTile(d.sheet, d.idx, d.x * T, d.y * T) });

      // Pods als Kisten
      for (const [name, info] of Object.entries(this.podSlots)) {
        const pos = this.podSlotPos(info.slot);
        const hue = hashHue(info.dep);
        ents.push({ y: pos.y + T, draw: () => {
          E.drawTile("dungeon", CRATE, pos.x, pos.y - info.drop);
          E.rect(pos.x + 2, pos.y - info.drop + 1, 12, 3, "hsl(" + hue + ",70%,55%)");
        }});
      }
      // Deployment-Beschriftung über der ersten Kiste
      const seen = {};
      for (const d of (Game.sim ? Game.sim.deployments : [])) {
        const first = d.pods[0] && this.podSlots[d.pods[0].name];
        if (first && !seen[d.name]) {
          seen[d.name] = true;
          const pos = this.podSlotPos(first.slot);
          ents.push({ y: 1e9, draw: () => E.text(d.name + " " + d.replicas + "/" + d.replicas, pos.x + 8, pos.y - 6, { size: 10, color: "hsl(" + hashHue(d.name) + ",80%,75%)" }) });
        }
      }

      // Services als Laternen am Dockrand
      (Game.sim ? Game.sim.services : []).forEach((s, i) => {
        const lx = (6 + i * 4) * T, ly = 23 * T;
        ents.push({ y: ly + T, draw: () => {
          E.rect(lx + 7, ly + 2, 2, 12, "#5a4632");
          const glow = 0.6 + Math.sin(Engine.time * 3 + i) * 0.25;
          E.rect(lx + 5, ly, 6, 5, "rgba(255,220,120," + glow + ")");
          E.text(s.name, lx + 8, ly - 3, { size: 9, color: "#ffd97a" });
        }});
      });

      // Docker-Container als Fässer bei Bo
      (Game.sim ? Game.sim.docker.containers : []).forEach((c, i) => {
        const bx = (4 + (i % 5) * 1.5) * T, by = 26 * T;
        ents.push({ y: by + T, draw: () => {
          E.drawTile("dungeon", BARREL, bx, by, { alpha: c.running ? 1 : 0.45 });
          E.text(c.name, bx + 8, by - 2, { size: 8, color: c.running ? "#9fe6a0" : "#8a98a8" });
        }});
      });

      // Helm-Releases als Flaggen an der Werft
      (Game.sim ? Game.sim.releases : []).forEach((r, i) => {
        const pole = this.flagPoles[i % this.flagPoles.length];
        const fx = pole.x * T, fy = pole.y * T;
        const hue = hashHue(r.name);
        ents.push({ y: fy + 2 * T, draw: () => {
          E.rect(fx + 7, fy - 14, 2, 30, "#6b5436");
          const wave = Math.sin(Engine.time * 4 + i) * 1.5;
          E.rect(fx + 9, fy - 13 + wave, 11, 7, "hsl(" + hue + ",70%,55%)");
          E.text(r.name + " rev" + r.revision, fx + 12, fy - 17, { size: 9, color: "hsl(" + hue + ",80%,75%)" });
        }});
      });

      // NPCs
      for (const n of this.npcs) {
        const bob = Math.sin(Engine.time * 2 + n.x) * 0.8;
        ents.push({ y: n.y * T + T, draw: () => {
          E.drawTile("dungeon", n.sprite, n.x * T, n.y * T + bob);
          // Quest-Ausrufezeichen
          if (UI.questMarkerFor && UI.questMarkerFor(n.id)) {
            E.text("!", n.x * T + 8, n.y * T - 6 + Math.sin(Engine.time * 4) * 2, { size: 16, color: "#ffc857" });
          }
        }});
      }

      // Haustier
      if (Game.state.activePet && this.petTrail.length > 4) {
        const item = KQContent.SHOP.find(s => s.id === Game.state.activePet);
        const pos = this.petTrail[Math.max(0, this.petTrail.length - 14)];
        ents.push({ y: pos.y + T - 2, draw: () =>
          E.drawTile("dungeon", item.sprite, pos.x - 8, pos.y - 8 + Math.sin(Engine.time * 5) * 1.5, { flip: pl.x < pos.x }) });
      }

      // Spieler:in
      const bobP = pl.moving ? Math.abs(Math.sin(Engine.time * 12)) * 1.6 : 0;
      ents.push({ y: pl.y + T, draw: () =>
        E.drawTile("dungeon", Game.state.character, pl.x - 8, pl.y - 10 - bobP, { flip: pl.dir === -1 }) });

      ents.sort((a, b) => a.y - b.y);
      for (const e of ents) e.draw();

      // Partikel
      for (const p of this.particles) E.rect(p.x, p.y, 2, 2, p.color, Math.min(1, p.life * 2));

      // Beschriftungen (immer obenauf)
      for (const l of this.labels) E.text(l.text, l.x * T, l.y * T, { size: 10, color: l.color });
    },

    renderWater(x, y) {
      const E = Engine;
      E.rect(x * T, y * T, T, T, WATER_COLOR);
      // sanfte Wellen-Glitzer
      const ph = (x * 7 + y * 13) % 10;
      const shimmer = Math.sin(Engine.time * 1.5 + ph) > 0.6;
      if (shimmer) E.rect(x * T + (ph % 3) * 4 + 2, y * T + ((ph * 7) % 3) * 5 + 4, 5, 1.5, FOAM, 0.5);
      // Schaumkante, wo oben Land ist
      const above = this.get(x, y - 1);
      if (above !== -2 && y > 0) E.rect(x * T, y * T, T, 2.5, FOAM, 0.8);
    },

    renderShipFrame() {
      const E = Engine, s = this.ship;
      const px = s.x * T, py = s.y * T, pw = s.w * T, ph = s.h * T;
      E.rect(px - 3, py - 3, pw + 6, 3, "#5a4030");          // Reling oben
      E.rect(px - 3, py + ph, pw + 6, 4, "#4a3426");          // Rumpf unten
      E.rect(px - 3, py, 3, ph, "#5a4030");
      E.rect(px + pw, py, 3, ph, "#5a4030");
      // Mast + Flagge
      const mx = px + pw / 2, my = py + 4;
      E.rect(mx - 1, my - 18, 2, 22, "#6b5436");
      const flag = KQContent.SHOP.find(f => f.id === Game.state.activeFlag);
      const color = flag ? flag.color : "#4dd0e1";
      const wave = Math.sin(Engine.time * 4) * 1.5;
      E.rect(mx + 1, my - 17 + wave, 12, 8, color);
      if (Game.state.activeFlag === "flagge-pirat") E.text("☠", mx + 7, my - 10 + wave, { size: 8, color: "#fff" });
    },

    renderTfPlatform() {
      const E = Engine, p = this.tfPlatform;
      const built = Game.sim && Game.sim.tf.applied;
      if (built) {
        for (let y = p.y; y < p.y + p.h; y++)
          for (let x = p.x; x < p.x + p.w; x++)
            E.drawTile("dungeon", WOOD[(x + y) % 3], x * T, y * T);
        E.rect(p.x * T, p.y * T, p.w * T, 2, "#bfe3f5", 0.7);
        E.drawTile("dungeon", CRATE, (p.x + 1) * T, (p.y + 1) * T);
        E.drawTile("dungeon", CRATE, (p.x + 4) * T, (p.y + 2) * T);
        E.text("worker-3", (p.x + 1.5) * T, (p.y + 0.8) * T, { size: 9, color: "#9fe6a0" });
        E.text("worker-4", (p.x + 4.5) * T, (p.y + 1.8) * T, { size: 9, color: "#9fe6a0" });
        E.text("ost-erweiterung 🏗️", (p.x + 3.5) * T, (p.y - 0.3) * T, { size: 10, color: "#ffd97a" });
      } else if (Game.sim && Game.sim.tf.initialized) {
        // Vermessungs-Bojen als Vorschau
        for (const [bx, by] of [[p.x, p.y], [p.x + p.w - 1, p.y], [p.x, p.y + p.h - 1], [p.x + p.w - 1, p.y + p.h - 1]]) {
          const bob = Math.sin(Engine.time * 2 + bx) * 1.5;
          E.rect(bx * T + 6, by * T + 6 + bob, 4, 6, "#ff8c5a");
        }
      }
    },

    /* ============ Interaktion ============ */
    nearestInteractable() {
      const pl = this.player;
      let best = null, bestD = 1.6 * T;
      for (const n of this.npcs) {
        const d = Math.hypot(n.x * T + 8 - pl.x, n.y * T + 8 - pl.y);
        if (d < bestD) { bestD = d; best = { type: "npc", npc: n }; }
      }
      return best;
    },
  };

  window.World = World;
})();
