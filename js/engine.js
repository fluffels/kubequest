/* ===== KubeQuest 2.0 – Engine =====
 * Canvas-Rendering, Spielschleife, Tastatur, Kamera, Sprite-Helfer.
 * Spritesheets: 12 Spalten, 16px-Tiles (Kenney Tiny Town / Tiny Dungeon, CC0).
 */

(function () {
  "use strict";

  const TILE = 16;
  const SHEET_COLS = 12;

  const Engine = {
    TILE,
    SCALE: 3,
    canvas: null,
    ctx: null,
    images: {},        // { town, dungeon }
    keys: {},          // gedrückte Tasten
    pressed: {},       // frisch gedrückt (ein Frame)
    cam: { x: 0, y: 0 },
    time: 0,
    paused: false,     // true, wenn ein Overlay offen ist (Welt friert ein)
    onUpdate: null,
    onRender: null,
    onKey: null,       // (key) => bool: true = Taste wurde verarbeitet

    init() {
      this.canvas = document.getElementById("game");
      this.ctx = this.canvas.getContext("2d");
      this.resize();
      window.addEventListener("resize", () => this.resize());

      window.addEventListener("keydown", e => {
        // Tasten nicht schlucken, wenn gerade in ein Eingabefeld getippt wird
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
          if (e.key === "Escape" && this.onKey) this.onKey("Escape");
          return;
        }
        const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (!this.keys[k]) this.pressed[k] = true;
        this.keys[k] = true;
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
        if (this.onKey && this.onKey(k)) e.preventDefault();
      });
      window.addEventListener("keyup", e => {
        const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        this.keys[k] = false;
      });
    },

    resize() {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      this.ctx.imageSmoothingEnabled = false;
    },

    loadImages(sources) {
      const jobs = Object.entries(sources).map(([name, src]) => new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => { this.images[name] = img; res(); };
        img.onerror = () => rej(new Error("Bild fehlt: " + src));
        img.src = src;
      }));
      return Promise.all(jobs);
    },

    start() {
      let last = performance.now();
      const loop = now => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        this.time += dt;
        if (this.onUpdate) this.onUpdate(dt);
        if (this.onRender) this.onRender(this.ctx);
        this.pressed = {};
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },

    /* ---------- Zeichnen ---------- */
    /** Tile aus einem Sheet an Welt-Position (Pixel) zeichnen. */
    drawTile(sheet, index, wx, wy, opts) {
      if (index < 0) return;
      opts = opts || {};
      const img = this.images[sheet];
      const sx = (index % SHEET_COLS) * TILE;
      const sy = Math.floor(index / SHEET_COLS) * TILE;
      const s = this.SCALE * (opts.scale || 1);
      const dx = Math.round((wx - this.cam.x) * this.SCALE);
      const dy = Math.round((wy - this.cam.y) * this.SCALE);
      const ctx = this.ctx;
      ctx.save();
      if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
      if (opts.flip) {
        ctx.translate(dx + TILE * s, dy);
        ctx.scale(-1, 1);
        ctx.drawImage(img, sx, sy, TILE, TILE, 0, 0, TILE * s, TILE * s);
      } else {
        ctx.drawImage(img, sx, sy, TILE, TILE, dx, dy, TILE * s, TILE * s);
      }
      ctx.restore();
    },

    /** Gefülltes Rechteck in Welt-Koordinaten. */
    rect(wx, wy, w, h, color, alpha) {
      const ctx = this.ctx;
      ctx.save();
      if (alpha !== undefined) ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(
        Math.round((wx - this.cam.x) * this.SCALE),
        Math.round((wy - this.cam.y) * this.SCALE),
        Math.round(w * this.SCALE), Math.round(h * this.SCALE)
      );
      ctx.restore();
    },

    /** Text in Welt-Koordinaten (klein, mit Schatten). */
    text(str, wx, wy, opts) {
      opts = opts || {};
      const ctx = this.ctx;
      const px = Math.round((wx - this.cam.x) * this.SCALE);
      const py = Math.round((wy - this.cam.y) * this.SCALE);
      ctx.save();
      ctx.font = "bold " + (opts.size || 11) + "px Consolas, monospace";
      ctx.textAlign = opts.align || "center";
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillText(str, px + 1, py + 1);
      ctx.fillStyle = opts.color || "#fff";
      ctx.fillText(str, px, py);
      ctx.restore();
    },

    /** Sprite (z.B. NPC-Porträt) auf ein kleines Canvas zeichnen – für Dialog & Auswahl. */
    drawPortrait(canvas, sheet, index) {
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const img = this.images[sheet];
      const sx = (index % SHEET_COLS) * TILE;
      const sy = Math.floor(index / SHEET_COLS) * TILE;
      ctx.drawImage(img, sx, sy, TILE, TILE, 0, 0, canvas.width, canvas.height);
    },
  };

  window.Engine = Engine;
})();
