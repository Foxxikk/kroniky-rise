// Zvuky: každý efekt se jednou předrenderuje přes OfflineAudioContext do bufferu (na Questu se živá syntéza seká).
// Při hře jen BufferSource → gain → (panner) → master. Limit souběžných hlasů a minimální odstup stejných zvuků.

const DEFS = {
  click: { len: 0.08, fn: (c, o) => tone(c, o, 880, 0.06, 'triangle', 0.3, 1320) },
  select: { len: 0.14, fn: (c, o) => { tone(c, o, 660, 0.07, 'triangle', 0.25); tone(c, o, 990, 0.08, 'triangle', 0.2, null, 0.05); } },
  selectEnemy: { len: 0.14, fn: (c, o) => { tone(c, o, 330, 0.1, 'square', 0.12); } },
  order: { len: 0.16, fn: (c, o) => { tone(c, o, 520, 0.06, 'sine', 0.3); tone(c, o, 780, 0.08, 'sine', 0.25, null, 0.06); } },
  attackOrder: { len: 0.2, fn: (c, o) => { tone(c, o, 300, 0.1, 'sawtooth', 0.15, 180); noise(c, o, 0.08, 0.15, 2000, 0.02); } },
  deny: { len: 0.25, fn: (c, o) => { tone(c, o, 220, 0.1, 'square', 0.15); tone(c, o, 165, 0.12, 'square', 0.15, null, 0.1); } },
  sword: { len: 0.2, fn: (c, o) => { noise(c, o, 0.1, 0.3, 4500); tone(c, o, 1800, 0.08, 'triangle', 0.12, 900); }, vars: 3 },
  bow: { len: 0.2, fn: (c, o) => { tone(c, o, 180, 0.12, 'triangle', 0.25, 90); noise(c, o, 0.06, 0.08, 3000, 0.03); }, vars: 2 },
  hit: { len: 0.15, fn: (c, o) => { noise(c, o, 0.08, 0.25, 900); tone(c, o, 140, 0.08, 'sine', 0.3, 60); }, vars: 3 },
  chop: { len: 0.18, fn: (c, o) => { noise(c, o, 0.05, 0.35, 1400); tone(c, o, 260, 0.08, 'triangle', 0.25, 140); }, vars: 2 },
  hammer: { len: 0.18, fn: (c, o) => { tone(c, o, 1200, 0.1, 'square', 0.1, 700); noise(c, o, 0.04, 0.2, 5000); }, vars: 2 },
  coin: { len: 0.3, fn: (c, o) => { tone(c, o, 1320, 0.1, 'triangle', 0.18); tone(c, o, 1760, 0.2, 'triangle', 0.16, null, 0.07); } },
  death: { len: 0.5, fn: (c, o) => { tone(c, o, 300, 0.4, 'sawtooth', 0.12, 80); noise(c, o, 0.2, 0.15, 700); }, vars: 2 },
  collapse: { len: 1.2, fn: (c, o) => { noise(c, o, 1.1, 0.5, 400); tone(c, o, 70, 0.9, 'sine', 0.4, 35); } },
  built: { len: 0.7, fn: (c, o) => { [523, 659, 784, 1047].forEach((f, k) => tone(c, o, f, 0.25, 'triangle', 0.2, null, k * 0.09)); } },
  trained: { len: 0.45, fn: (c, o) => { tone(c, o, 392, 0.14, 'triangle', 0.22); tone(c, o, 587, 0.22, 'triangle', 0.22, null, 0.12); } },
  heal: { len: 0.9, fn: (c, o) => { [784, 988, 1175, 1568].forEach((f, k) => tone(c, o, f, 0.4, 'sine', 0.14, null, k * 0.08)); } },
  thunder: { len: 1.2, fn: (c, o) => { noise(c, o, 1.0, 0.7, 600); tone(c, o, 55, 0.9, 'sawtooth', 0.25, 30); noise(c, o, 0.1, 0.5, 6000); } },
  levelup: { len: 1.1, fn: (c, o) => { [523, 659, 784, 1047, 1319].forEach((f, k) => tone(c, o, f, 0.35, 'triangle', 0.18, null, k * 0.1)); } },
  alert: { len: 0.9, fn: (c, o) => { for (let k = 0; k < 3; k++) { tone(c, o, 440, 0.12, 'square', 0.14, null, k * 0.25); tone(c, o, 330, 0.12, 'square', 0.14, null, k * 0.25 + 0.12); } } },
  win: { len: 2.2, fn: (c, o) => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, k) => tone(c, o, f, 0.5, 'triangle', 0.2, null, k * 0.2)); } },
  lose: { len: 2.2, fn: (c, o) => { [392, 370, 330, 262].forEach((f, k) => tone(c, o, f, 0.6, 'sawtooth', 0.1, null, k * 0.4)); } },
  pinch: { len: 0.06, fn: (c, o) => tone(c, o, 1400, 0.04, 'sine', 0.12, 1800) },
  unpinch: { len: 0.06, fn: (c, o) => tone(c, o, 1000, 0.04, 'sine', 0.08, 800) },
  grab: { len: 0.15, fn: (c, o) => { tone(c, o, 300, 0.1, 'triangle', 0.2, 500); } },
  ack: { len: 0.3, fn: (c, o) => { tone(c, o, 196, 0.12, 'sawtooth', 0.1, 220); tone(c, o, 262, 0.14, 'sawtooth', 0.1, 247, 0.13); }, vars: 3 },
};

function tone(c, out, f, dur, type, vol, fEnd = null, t0 = 0) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  const r = 1 + (Math.random() - 0.5) * 0.06;
  o.frequency.setValueAtTime(f * r, t0);
  if (fEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, fEnd * r), t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(out);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(c, out, dur, vol, freq, t0 = 0) {
  const n = Math.floor(c.sampleRate * dur);
  const b = c.createBuffer(1, n, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(); s.buffer = b;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(out);
  s.start(t0);
}

export class Sfx {
  constructor() {
    this.ctx = null;
    this.buf = {};
    this.voices = 0;
    this.last = {};
    this.volume = 0.8;
    try { const v = localStorage.getItem('kr-vol'); if (v != null) this.volume = +v; } catch (e) { /* bez úložiště */ }
  }
  /** Musí se volat z uživatelského gesta (klik / vstup do VR). */
  async init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp); comp.connect(this.ctx.destination);
    const rate = this.ctx.sampleRate;
    for (const [name, def] of Object.entries(DEFS)) {
      const vars = def.vars || 1;
      this.buf[name] = [];
      for (let v = 0; v < vars; v++) {
        try {
          const oc = new OfflineAudioContext(1, Math.ceil(rate * def.len), rate);
          const g = oc.createGain(); g.connect(oc.destination);
          def.fn(oc, g);
          this.buf[name].push(await oc.startRendering());
        } catch (e) { /* zvuk vynechán */ }
      }
    }
  }
  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
    try { localStorage.setItem('kr-vol', String(v)); } catch (e) { /* bez úložiště */ }
  }
  /** pos = {x,y,z} ve světě (volitelně) → prostorový zvuk. */
  play(name, { vol = 1, pos = null, minGap = 0.05 } = {}) {
    const c = this.ctx;
    if (!c || !this.buf[name]?.length || this.volume <= 0) return;
    const now = c.currentTime;
    if (now - (this.last[name] || 0) < minGap) return;
    if (this.voices > 28) return;
    this.last[name] = now;
    const arr = this.buf[name];
    const s = c.createBufferSource();
    s.buffer = arr[(Math.random() * arr.length) | 0];
    s.playbackRate.value = 0.95 + Math.random() * 0.1;
    const g = c.createGain(); g.gain.value = vol;
    s.connect(g);
    if (pos) {
      const p = c.createPanner();
      p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 0.6; p.rolloffFactor = 0.6;
      p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z;
      g.connect(p); p.connect(this.master);
    } else g.connect(this.master);
    this.voices++;
    s.onended = () => { this.voices--; };
    s.start();
  }
  listener(cam) {
    const c = this.ctx;
    if (!c || !cam) return;
    const L = c.listener, e = cam.matrixWorld.elements;
    const px = e[12], py = e[13], pz = e[14];
    const fx = -e[8], fy = -e[9], fz = -e[10], ux = e[4], uy = e[5], uz = e[6];
    if (L.positionX) {
      L.positionX.value = px; L.positionY.value = py; L.positionZ.value = pz;
      L.forwardX.value = fx; L.forwardY.value = fy; L.forwardZ.value = fz;
      L.upX.value = ux; L.upY.value = uy; L.upZ.value = uz;
    }
  }
}
