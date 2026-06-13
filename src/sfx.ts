/* ===== KubeQuest – Mini-Synthesizer (SFX) =====
 * Erzeugt alle Sounds zur Laufzeit per WebAudio – keine Audio-Dateien nötig.
 * Bewusst OHNE Abhängigkeiten (auch kein Phaser), damit zwischen scenes.ts und
 * ui.ts kein zyklischer Import entsteht: beide beziehen SFX nur von hier.
 */
export const SFX = {
  ctx: null as any,
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext!)(); } catch (e) { /* kein Ton */ }
    }
    return this.ctx;
  },
  tone(freq, dur, type?, vol?, delay?) {
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
