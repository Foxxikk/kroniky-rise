// Hudba v3 – složené skladby pro každé prostředí (žádné soubory, vše syntetizované přes WebAudio).
// Každé téma má tóninu a modus, harmonický postup, 8taktovou melodii, vlastní nástroje a bicí.
// Tři vrstvy intenzity: klid (stavění) · bitva (vlna) · boss (nekromant).
//   menu   – Královská fanfára (D dur, žesťová melodie, tympány)
//   meadow – Údolí u hradu (G dur, flétna + loutna)
//   winter – Zasněžený průsmyk (D lydická, zvonkohra + smyčcový pad)
//   desert – Písečná oáza (D hidžáz, úd + ney + darbuka)
//   autumn – Podzimní hvozd (A dórská, zobcová flétna + harfa)
//   night  – Noční obléhání (D harmonická moll, sbor + zvon + taiko)
//   swamp  – Mlžná bažina (D dórská, zobcová flétna + banjo/úd)   volcano – Ohnivá sopka (E hidžáz, žestě + taiko)
//   coast  – Pirátské pobřeží (G mixolydická, námořnická píseň)  enchanted – Kouzelný les (F lydická, zvonky + harfa)
//   necro  – Nekropole (C harmonická moll, sbor + zvon)

const MODES = {
  major: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10],
  minor: [0, 2, 3, 5, 7, 8, 10], harm: [0, 2, 3, 5, 7, 8, 11], hijaz: [0, 1, 4, 5, 7, 8, 10], mixo: [0, 2, 4, 5, 7, 9, 10],
};
const _ = null; // pauza v melodii

export const THEMES = {
  menu: {
    gain: 1.0, name: 'Královská fanfára', root: 146.83, mode: 'major', bpm: [78, 78], prog: [0, 3, 4, 0, 5, 3, 4, 4],
    lead: 'brass', leadOct: 1, arp: 'harp', bass: 'pluck', pad: true,
    melody: [
      [[0, 2], [2, 1], [4, 1], [7, 4]], [[5, 2], [3, 2], [5, 4]], [[4, 2], [6, 1], [8, 1], [7, 4]], [[7, 2], [4, 2], [2, 4]],
      [[5, 2], [7, 2], [9, 4]], [[8, 2], [7, 2], [5, 4]], [[4, 2], [5, 1], [6, 1], [7, 2], [6, 2]], [[7, 6], [_, 2]],
    ],
    perc: { calm: [['B'], [], [], [], [], [], [], []], battle: null, boss: null },
  },
  meadow: {
    gain: 1.45, name: 'Údolí u hradu', root: 196.0, mode: 'major', bpm: [94, 114], prog: [0, 4, 5, 3, 0, 4, 3, 4],
    lead: 'flute', leadOct: 1, arp: 'lute', bass: 'pluck', pad: false,
    melody: [
      [[4, 2], [2, 2], [4, 1], [5, 1], [4, 2]], [[1, 3], [2, 1], [4, 4]], [[5, 2], [4, 2], [2, 2], [0, 2]], [[3, 4], [_, 2], [0, 1], [2, 1]],
      [[4, 2], [7, 2], [6, 1], [5, 1], [4, 2]], [[6, 2], [4, 2], [1, 2], [4, 2]], [[5, 2], [3, 2], [2, 2], [1, 2]], [[1, 6], [_, 2]],
    ],
    perc: {
      calm: null,
      battle: [['K'], ['h'], ['S'], ['h'], ['K'], ['K', 'h'], ['S'], ['h']],
      boss: [['K'], ['h'], ['S'], ['K'], ['K'], ['K', 'h'], ['S'], ['S']],
    },
  },
  winter: {
    gain: 0.8, name: 'Zasněžený průsmyk', root: 146.83, mode: 'lydian', bpm: [78, 100], prog: [0, 1, 0, 4, 5, 1, 3, 4],
    lead: 'bell', leadOct: 2, arp: 'bellArp', bass: 'sine', pad: true,
    melody: [
      [[4, 3], [3, 1], [4, 2], [7, 2]], [[8, 4], [6, 2], [5, 2]], [[4, 6], [_, 2]], [[1, 2], [2, 2], [4, 4]],
      [[5, 3], [4, 1], [5, 2], [7, 2]], [[8, 2], [9, 2], [8, 2], [6, 2]], [[5, 4], [3, 2], [2, 2]], [[1, 6], [_, 2]],
    ],
    perc: {
      calm: null,
      battle: [['B'], [], ['h'], [], ['b'], [], ['h'], ['h']],
      boss: [['B'], ['h'], ['b'], ['h'], ['B'], ['b'], ['b', 'h'], ['b']],
    },
  },
  desert: {
    gain: 1.4, name: 'Písečná oáza', root: 146.83, mode: 'hijaz', bpm: [96, 118], prog: [0, 0, 6, 0, 1, 1, 6, 0],
    lead: 'oud', leadOct: 1, lead2: 'ney', arp: 'oudArp', bass: 'drone', pad: false,
    melody: [
      [[0, 1], [1, 1], [2, 2], [3, 1], [2, 1], [1, 2]], [[2, 1], [3, 1], [4, 4], [_, 2]], [[6, 2], [5, 1], [4, 1], [5, 2], [4, 2]], [[3, 1], [2, 1], [1, 2], [0, 4]],
      [[4, 1], [5, 1], [6, 2], [7, 2], [6, 2]], [[5, 2], [4, 1], [5, 1], [4, 2], [3, 2]], [[2, 1], [3, 1], [4, 2], [3, 1], [2, 1], [1, 2]], [[0, 6], [_, 2]],
    ],
    perc: {
      calm: [['D'], [], [], ['T'], [], [], ['T'], []],
      battle: [['D'], ['T'], [], ['T'], ['D'], [], ['T'], ['t']],
      boss: [['D'], ['T'], ['t'], ['T'], ['D'], ['D'], ['T'], ['t']],
    },
  },
  autumn: {
    gain: 1.3, name: 'Podzimní hvozd', root: 220.0, mode: 'dorian', bpm: [90, 110], prog: [0, 3, 0, 6, 2, 3, 4, 0],
    lead: 'recorder', leadOct: 1, arp: 'harp', bass: 'pluck', pad: true,
    melody: [
      [[4, 2], [5, 1], [4, 1], [2, 2], [0, 2]], [[3, 3], [4, 1], [5, 2], [3, 2]], [[2, 2], [1, 2], [0, 2], [1, 2]], [[-1, 4], [1, 2], [2, 2]],
      [[2, 2], [4, 2], [7, 2], [6, 2]], [[5, 3], [4, 1], [3, 4]], [[4, 2], [3, 2], [2, 2], [1, 2]], [[0, 6], [_, 2]],
    ],
    perc: {
      calm: null,
      battle: [['K'], ['h'], ['S'], ['h'], ['K'], ['h'], ['S'], ['S', 'h']],
      boss: [['K'], ['K'], ['S'], ['h'], ['K'], ['K'], ['S'], ['S']],
    },
  },
  night: {
    gain: 0.8, name: 'Noční obléhání', root: 146.83, mode: 'harm', bpm: [68, 96], prog: [0, 5, 3, 4, 0, 5, 3, 4],
    lead: 'choir', leadOct: 1, arp: 'bellArp', bass: 'sine', pad: true, toll: true,
    melody: [
      [[4, 4], [3, 2], [2, 2]], [[3, 6], [2, 2]], [[1, 4], [2, 2], [3, 2]], [[6, 4], [4, 4]],
      [[7, 4], [6, 2], [4, 2]], [[5, 6], [4, 2]], [[3, 2], [4, 2], [5, 2], [3, 2]], [[4, 6], [_, 2]],
    ],
    perc: {
      calm: null,
      battle: [['B'], [], [], ['h'], ['K'], [], ['S'], []],
      boss: [['B'], ['h'], ['K'], ['h'], ['B'], ['K'], ['S'], ['S']],
    },
  },
  swamp: {
    gain: 1.3, name: 'Mlžná bažina', root: 146.83, mode: 'dorian', bpm: [84, 104], prog: [0, 6, 2, 4, 0, 3, 6, 0],
    lead: 'recorder', leadOct: 0, lead2: 'oud', arp: 'oudArp', bass: 'sine', pad: true,
    melody: [
      [[0, 2], [2, 1], [3, 1], [4, 4]], [[5, 2], [4, 2], [2, 2], [3, 2]], [[2, 3], [1, 1], [0, 4]], [[-2, 2], [0, 2], [2, 4]],
      [[4, 2], [6, 1], [7, 1], [6, 2], [4, 2]], [[5, 3], [4, 1], [2, 4]], [[3, 2], [2, 2], [1, 2], [-1, 2]], [[0, 6], [_, 2]],
    ],
    perc: {
      calm: [['b'], [], [], ['t'], [], [], ['t'], []],
      battle: [['K'], ['t'], ['S'], ['t'], ['K'], ['K'], ['S'], ['t']],
      boss: [['K'], ['t'], ['S'], ['K'], ['K'], ['K'], ['S'], ['S']],
    },
  },
  volcano: {
    gain: 0.95, name: 'Ohnivá sopka', root: 164.81, mode: 'hijaz', bpm: [88, 122], prog: [0, 0, 1, 0, 5, 1, 6, 0],
    lead: 'brass', leadOct: 0, arp: 'lute', bass: 'drone', pad: true,
    melody: [
      [[0, 2], [1, 2], [2, 4]], [[3, 2], [2, 1], [1, 1], [0, 4]], [[4, 3], [5, 1], [4, 2], [2, 2]], [[1, 6], [_, 2]],
      [[7, 2], [6, 2], [5, 2], [4, 2]], [[5, 2], [4, 1], [3, 1], [2, 4]], [[3, 2], [1, 2], [2, 2], [1, 2]], [[0, 6], [_, 2]],
    ],
    perc: {
      calm: [['B'], [], [], [], ['b'], [], [], ['t']],
      battle: [['B'], ['t'], ['K'], ['t'], ['B'], ['K'], ['S'], ['t']],
      boss: [['B'], ['K'], ['S'], ['K'], ['B'], ['K'], ['S'], ['S']],
    },
  },
  coast: {
    gain: 1.3, name: 'Pirátské pobřeží', root: 196.0, mode: 'mixo', bpm: [104, 124], prog: [0, 0, 3, 4, 0, 6, 3, 0],
    lead: 'flute', leadOct: 1, arp: 'lute', bass: 'pluck', pad: false,
    melody: [
      [[4, 1], [4, 1], [4, 1], [2, 1], [4, 2], [7, 2]], [[6, 2], [4, 2], [2, 2], [4, 2]], [[3, 1], [3, 1], [3, 1], [1, 1], [3, 2], [5, 2]], [[4, 6], [_, 2]],
      [[4, 1], [4, 1], [4, 1], [2, 1], [4, 2], [7, 2]], [[8, 2], [7, 2], [6, 2], [4, 2]], [[3, 2], [2, 2], [1, 2], [-1, 2]], [[0, 6], [_, 2]],
    ],
    perc: {
      calm: [['K'], [], ['h'], [], ['K'], [], ['h'], []],
      battle: [['K'], ['h'], ['S'], ['h'], ['K'], ['h'], ['S'], ['S']],
      boss: [['K'], ['K'], ['S'], ['h'], ['K'], ['K'], ['S'], ['S']],
    },
  },
  enchanted: {
    gain: 0.9, name: 'Kouzelný les', root: 174.61, mode: 'lydian', bpm: [80, 100], prog: [0, 1, 5, 1, 0, 1, 2, 4],
    lead: 'bell', leadOct: 2, lead2: 'flute', arp: 'harp', bass: 'sine', pad: true,
    melody: [
      [[4, 2], [5, 2], [6, 2], [7, 2]], [[8, 4], [7, 2], [4, 2]], [[3, 2], [4, 2], [2, 4]], [[1, 4], [_, 4]],
      [[2, 2], [4, 2], [7, 2], [9, 2]], [[8, 3], [7, 1], [6, 4]], [[4, 2], [3, 2], [2, 2], [1, 2]], [[0, 6], [_, 2]],
    ],
    perc: {
      calm: null,
      battle: [['b'], [], ['h'], ['h'], ['b'], [], ['h'], ['t']],
      boss: [['B'], ['h'], ['b'], ['h'], ['B'], ['b'], ['S'], ['h']],
    },
  },
  necro: {
    gain: 0.85, name: 'Nekropole', root: 130.81, mode: 'harm', bpm: [64, 96], prog: [0, 5, 3, 4, 0, 5, 1, 4],
    lead: 'choir', leadOct: 1, arp: 'bellArp', bass: 'drone', pad: true, toll: true,
    melody: [
      [[0, 4], [2, 2], [3, 2]], [[4, 6], [5, 2]], [[4, 2], [3, 2], [2, 2], [1, 2]], [[-1, 6], [_, 2]],
      [[7, 4], [6, 2], [5, 2]], [[4, 4], [5, 2], [4, 2]], [[3, 2], [2, 2], [1, 2], [-1, 2]], [[0, 6], [_, 2]],
    ],
    perc: {
      calm: [['B'], [], [], [], [], [], [], []],
      battle: [['B'], [], ['K'], ['h'], ['B'], ['K'], ['S'], ['h']],
      boss: [['B'], ['h'], ['K'], ['K'], ['B'], ['K'], ['S'], ['S']],
    },
  },
};

export class Music {
  constructor(sfx) {
    this.s = sfx;
    this.theme = THEMES.menu;
    this.pending = null;
    this.beat = 0;
    this.nextT = 0;
    this.cycle = 0;
  }
  get ctx() { return this.s.ctx; }
  get bus() {
    if (!this.out || this.out.context !== this.s.musicBus.context) {
      this.out = this.ctx.createGain();
      this.out.connect(this.s.musicBus);
    }
    return this.out;
  }

  setTheme(name) {
    const th = THEMES[name] || THEMES.meadow;
    this.want = th;
    if (!this.cache) this.cache = new Map();
    if (!this.cache.has(th) && this.ctx) this.renderTheme(th);
    if (th === this.theme && !this.pending) return;
    this.pending = th; // přepne se na začátku taktu
  }

  // ------------------------------------------------------------ předrenderované smyčky
  /** Každé téma se jednou nahraje do tří smyček (klid / bitva / boss) – při hře pak hraje jen 1 přehrávač. */
  async renderTheme(th) {
    if (typeof OfflineAudioContext === 'undefined') return;
    this.cache.set(th, null); // rozpracováno
    try {
      const layers = {};
      for (const k of ['calm', 'battle', 'boss']) {
        layers[k] = await this.renderLayer(th, k !== 'calm', k === 'boss');
        await new Promise((r) => setTimeout(r, 0));
      }
      this.cache.set(th, layers);
      // držet v paměti jen pár posledních témat
      if (this.cache.size > 3) for (const [k, v] of this.cache) { if (k !== th && k !== this.want && v) { this.cache.delete(k); break; } }
    } catch (e) {
      console.warn('music render', e);
      this.cache.delete(th);
    }
  }
  async renderLayer(th, battle, boss) {
    const live = this.ctx;
    const sr = Math.min(live.sampleRate, 32000);
    const step = 60 / (battle ? th.bpm[1] : th.bpm[0]) / 2;
    const beats = 128, loop = beats * step, tail = 3;
    const off = new OfflineAudioContext(1, Math.ceil(sr * (loop + tail)), sr);
    // náhradní „zvukový engine“ ve stejné podobě, jakou hudba čeká (ctx, musicBus, verbSend, noise, pluck)
    const P = Object.create(Object.getPrototypeOf(this.s));
    Object.assign(P, { ctx: off, noise: this.s.noise, level: 2 });
    P.musicBus = off.createGain();
    P.musicBus.connect(off.destination);
    const verb = off.createConvolver();
    verb.buffer = this.s.impulse.call({ ctx: off }, 2.2, 2.6);
    P.verbSend = off.createGain();
    P.verbSend.gain.value = 1.2; // živě jde dozvuk mimo hlasitost hudby (0,5) → vyrovnat
    P.verbSend.connect(verb).connect(off.destination);
    const m = new Music(P);
    m.theme = th;
    m.beat = 0;
    m.cycle = 0;
    for (let k = 0; k < beats; k++) {
      m.play(0.02 + k * step, step, battle, boss);
      m.beat++;
      if (m.beat % 64 === 0) m.cycle++;
    }
    const buf = await off.startRendering();
    // dozvuk a doznívající tóny z konce smyčky přičíst na začátek → smyčka bez švu
    const d = buf.getChannelData(0);
    const n = Math.floor(sr * loop);
    const out = live.createBuffer(1, n, sr);
    const o = out.getChannelData(0);
    o.set(d.subarray(0, n));
    for (let i = n; i < d.length; i++) o[i - n] += d[i];
    return { buf: out, gain: th.gain || 1 };
  }
  /** Ztiší předrenderovanou smyčku (hudba vypnutá). */
  silence() {
    if (this.cur) this.fadeOut(0.3);
  }
  fadeOut(tc) {
    const c = this.ctx, cur = this.cur;
    if (!cur) return;
    cur.g.gain.cancelScheduledValues(c.currentTime);
    cur.g.gain.setTargetAtTime(0, c.currentTime, tc);
    const src = cur.src, g = cur.g;
    setTimeout(() => { try { src.stop(); } catch (e) { /* už stojí */ } src.disconnect(); g.disconnect(); }, tc * 6000 + 200);
    this.cur = null;
  }
  /** Hlavní hudební krok: předrenderovaná smyčka, když je hotová, jinak živá syntéza. */
  update(intensity) {
    const c = this.ctx;
    const th = this.want || this.pending || this.theme;
    const layers = th && this.cache?.get(th);
    const key = intensity > 1 ? 'boss' : intensity > 0 ? 'battle' : 'calm';
    if (layers) {
      // živou hudbu dohrát a ztlumit
      if (!this.buffered) {
        this.buffered = true;
        this.bus.gain.setTargetAtTime(0, c.currentTime + 0.1, 0.4);
      }
      this.theme = th;
      this.pending = null;
      if (!this.cur || this.cur.th !== th || this.cur.key !== key) {
        const up = this.cur && this.cur.th === th && key !== 'calm'; // začíná bitva → rychle
        this.fadeOut(up ? 0.25 : 0.8);
        const L = layers[key];
        const src = c.createBufferSource();
        src.buffer = L.buf;
        src.loop = true;
        const g = c.createGain();
        const t = c.currentTime + 0.03;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(L.gain, t + (up ? 0.25 : 1.2));
        src.connect(g).connect(this.s.musicBus);
        src.start(t);
        this.cur = { src, g, th, key };
      }
      return;
    }
    // téma ještě není nahrané → živá syntéza (a ztlumit případnou smyčku jiného tématu)
    if (this.cur) this.fadeOut(0.6);
    if (this.buffered) {
      this.buffered = false;
      this.nextT = 0;
      this.bus.gain.setTargetAtTime((this.pending || this.theme)?.gain || 1, c.currentTime, 0.2);
    }
    if (this.cache && !this.cache.has(th) && th) this.renderTheme(th);
    this.tick(intensity);
  }
  reset() { this.nextT = this.ctx.currentTime + 0.3; this.beat = 0; }

  /** Frekvence stupně stupnice (0 = základní tón, 7 = oktáva výš, záporné = níž). */
  f(deg, oct = 0) {
    const th = this.theme, sc = MODES[th.mode];
    const o = Math.floor(deg / 7), d = ((deg % 7) + 7) % 7;
    return th.root * 2 ** ((sc[d] + 12 * (o + oct)) / 12);
  }
  chord(deg) { return [this.f(deg), this.f(deg + 2), this.f(deg + 4)]; }

  tick(intensity) {
    const c = this.ctx;
    if (!this.nextT) this.reset();
    if (this.nextT < c.currentTime - 1) this.reset();
    while (this.nextT < c.currentTime + 0.6) {
      if (this.beat % 8 === 0 && this.pending) {
        this.theme = this.pending;
        this.pending = null;
        this.bus.gain.setTargetAtTime(this.theme.gain || 1, this.nextT, 0.3);
        if (this.beat % 64 !== 0) this.beat = 0; // nové téma začne od prvního taktu
      }
      const th = this.theme;
      const battle = intensity > 0, boss = intensity > 1;
      const bpm = battle ? th.bpm[1] : th.bpm[0];
      const step = 60 / bpm / 2;
      this.play(this.nextT, step, battle, boss);
      this.beat++;
      if (this.beat % 64 === 0) this.cycle++;
      this.nextT += step;
    }
  }

  play(t, step, battle, boss) {
    const th = this.theme, b = this.beat;
    const bar = Math.floor(b / 8) % 8, pos = b % 8;
    const deg = th.prog[bar];
    const ch = this.chord(deg);
    // --- basa
    if (pos === 0) {
      if (th.bass === 'drone') { this.drone(this.f(0, -1), t, step * 8.2, 0.05); this.pluck(this.f(deg, -1), t, step * 6, 0.16, 900); }
      else if (th.bass === 'sine') this.sub(this.f(deg, -1), t, step * 7.5, 0.13);
      else this.pluck(this.f(deg, -1), t, step * 7, 0.2, 700);
    }
    if (battle && (pos === 4 || (boss && pos % 2 === 0))) this.pluck(this.f(deg, -1), t, step * 2.5, 0.14, 800);
    // --- pad (akord)
    if (th.pad && pos === 0) this.pad(ch, t, step * 8.4, battle ? 0.018 : 0.024);
    if (th.toll && pos === 0 && bar % 2 === 0) this.bell(this.f(0, -1), t, 4, 0.06);
    // --- arpeggio
    const arpNotes = [0, 1, 2, 1, 0, 2, 1, 2];
    const n = ch[arpNotes[pos]] * (th.arp === 'bellArp' ? 2 : 1);
    const arpOn = battle || pos % 2 === 0 || (this.cycle % 2 === 1 && Math.random() < 0.5);
    if (arpOn) {
      const v = battle ? 0.075 : 0.06;
      if (th.arp === 'lute') this.pluck(n * 2, t, step * 2.5, v, battle ? 2600 : 2000);
      else if (th.arp === 'harp') this.harp(n * 2, t, step * 4, v * 0.9);
      else if (th.arp === 'oudArp') this.oud(n * 2, t, step * 2, v * 0.8, pos % 4 === 3);
      else if (th.arp === 'bellArp') this.bell(n * 2, t, step * 3, v * 0.5);
    }
    // --- melodie: v klidu střídá celou melodii a řidší variaci, v bitvě hraje vždy
    const full = battle || this.cycle % 2 === 0;
    const note = this.noteAt(bar, pos);
    if (note && note[0] !== null && (full || note[2] === 0 || Math.random() < 0.35)) {
      const dur = note[1] * step;
      const f = this.f(note[0], th.leadOct);
      const lead = th.lead2 && this.cycle % 2 === 1 ? th.lead2 : th.lead;
      this.leadNote(lead, f, t, dur, battle ? 1.1 : 1);
      if (boss && th.lead !== 'brass') this.brass(f / 2, t, dur, 0.03);
    }
    // --- boss: žesťové údery na základní tón
    if (boss && (pos === 0 || pos === 3)) this.brass(this.f(deg, -1), t, step * 1.6, 0.05);
    // --- bicí
    const pat = boss ? th.perc.boss : battle ? th.perc.battle : th.perc.calm;
    if (pat) for (const k of pat[pos]) this.hit(k, t, boss);
    if (boss && pos === 7 && bar % 4 === 3) for (let r = 0; r < 4; r++) this.tom(t + r * step / 4, 150 - r * 20);
    if (!battle && th === THEMES.menu && pos === 0 && bar % 2 === 0) this.timp(this.f(0, -2), t);
  }
  /** Tón melodie začínající v daném taktu a osmině: [stupeň, délka, index v taktu] nebo null. */
  noteAt(bar, pos) {
    const ph = this.theme.melody[bar];
    let p = 0;
    for (let i = 0; i < ph.length; i++) {
      if (p === pos) return [ph[i][0], ph[i][1], i];
      p += ph[i][1];
      if (p > pos) return null;
    }
    return null;
  }
  leadNote(kind, f, t, dur, vol) {
    if (kind === 'flute') this.flute(f, t, dur, 0.05 * vol, 0.008);
    else if (kind === 'recorder') this.flute(f, t, dur, 0.045 * vol, 0.004, 'triangle');
    else if (kind === 'ney') this.flute(f, t, dur, 0.04 * vol, 0.012, 'sine', 0.5);
    else if (kind === 'bell') this.bell(f, t, Math.max(1.2, dur * 1.5), 0.07 * vol);
    else if (kind === 'brass') this.brass(f, t, dur, 0.055 * vol);
    else if (kind === 'choir') this.choir(f, t, dur, 0.05 * vol);
    else if (kind === 'oud') this.oud(f, t, Math.max(dur, 0.4), 0.09 * vol, true);
  }

  // ------------------------------------------------------------ nástroje
  env(g, t, a, peak, dur, rel = 0.08) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + Math.max(a, dur - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
  }
  send(node, amt) {
    const s = this.ctx.createGain();
    s.gain.value = amt;
    node.connect(s).connect(this.s.verbSend);
  }
  pluck(f, t, dur, vol, bright) { this.s.pluck(f, t, dur, vol, this.bus, bright); }
  flute(f, t, dur, vol, vib, type = 'sine', breath = 0.25) {
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    o.type = type;
    o.frequency.value = f;
    lfo.frequency.value = 5.2;
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(f * vib, t + Math.min(0.4, dur * 0.6));
    lfo.connect(lg).connect(o.frequency);
    this.env(g, t, 0.05, vol, dur, 0.1);
    o.connect(g).connect(this.bus);
    this.send(g, 0.35);
    o.start(t); lfo.start(t);
    o.stop(t + dur + 0.2); lfo.stop(t + dur + 0.2);
    // dech na začátku tónu
    if (breath) {
      const n = c.createBufferSource(), bf = c.createBiquadFilter(), ng = c.createGain();
      n.buffer = this.s.noise;
      bf.type = 'bandpass'; bf.frequency.value = f * 2; bf.Q.value = 2;
      ng.gain.setValueAtTime(vol * breath, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      n.connect(bf).connect(ng).connect(this.bus);
      n.start(t, Math.random()); n.stop(t + 0.1);
    }
  }
  bell(f, t, dur, vol) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.value = 1;
    g.connect(this.bus);
    this.send(g, 0.5);
    [[1, 1], [2.76, 0.45], [5.4, 0.22], [8.93, 0.1]].forEach(([m, a]) => {
      const o = c.createOscillator(), og = c.createGain();
      o.type = 'sine';
      o.frequency.value = f * m;
      const d = dur / (1 + m * 0.35);
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(vol * a, t + 0.004);
      og.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(og).connect(g);
      o.start(t); o.stop(t + d + 0.05);
    });
  }
  harp(f, t, dur, vol) {
    const c = this.ctx;
    const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = 'triangle'; o2.type = 'sine';
    o.frequency.value = f; o2.frequency.value = f * 2;
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(4000, t);
    lp.frequency.exponentialRampToValueAtTime(900, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const g2 = c.createGain();
    g2.gain.value = 0.3;
    o.connect(lp); o2.connect(g2).connect(lp);
    lp.connect(g).connect(this.bus);
    this.send(g, 0.4);
    o.start(t); o2.start(t);
    o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  oud(f, t, dur, vol, bend) {
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(bend ? f * 0.97 : f, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    lp.type = 'lowpass'; lp.Q.value = 5;
    lp.frequency.setValueAtTime(3200, t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.5), t + dur * 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(this.bus);
    this.send(g, 0.25);
    o.start(t); o.stop(t + dur + 0.05);
  }
  brass(f, t, dur, vol) {
    const c = this.ctx;
    const g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 1.5;
    lp.frequency.setValueAtTime(f * 1.2, t);
    lp.frequency.exponentialRampToValueAtTime(f * 5, t + 0.07);
    lp.frequency.exponentialRampToValueAtTime(f * 3, t + Math.max(0.1, dur));
    this.env(g, t, 0.04, vol, dur, 0.12);
    lp.connect(g).connect(this.bus);
    this.send(g, 0.3);
    for (const dt of [-4, 4]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = dt;
      o.connect(lp);
      o.start(t); o.stop(t + dur + 0.2);
    }
  }
  choir(f, t, dur, vol) {
    const c = this.ctx;
    const g = c.createGain();
    this.env(g, t, Math.min(0.35, dur * 0.4), vol, dur, 0.4);
    g.connect(this.bus);
    this.send(g, 0.8);
    const mix = c.createGain();
    mix.gain.value = 0.5;
    for (const [fr, q, a] of [[700, 6, 1], [1150, 8, 0.6], [2600, 10, 0.25]]) {
      const bp = c.createBiquadFilter(), bg = c.createGain();
      bp.type = 'bandpass'; bp.frequency.value = fr; bp.Q.value = q;
      bg.gain.value = a;
      mix.connect(bp).connect(bg).connect(g);
    }
    for (const dt of [-9, 0, 8]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = dt;
      o.connect(mix);
      o.start(t); o.stop(t + dur + 0.5);
    }
  }
  pad(chord, t, dur, vol) {
    const c = this.ctx;
    const g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1100;
    this.env(g, t, Math.min(0.7, dur * 0.3), vol, dur, 0.5);
    lp.connect(g).connect(this.bus);
    this.send(g, 0.7);
    for (const f of chord) for (const dt of [-7, 7]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = dt;
      o.connect(lp);
      o.start(t); o.stop(t + dur + 0.6);
    }
  }
  sub(f, t, dur, vol) {
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    this.env(g, t, 0.02, vol, dur * 0.8, 0.3);
    o.connect(g).connect(this.bus);
    o.start(t); o.stop(t + dur + 0.4);
  }
  drone(f, t, dur, vol) {
    const c = this.ctx;
    const g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 600;
    this.env(g, t, 0.3, vol, dur, 0.3);
    lp.connect(g).connect(this.bus);
    for (const m of [1, 1.5]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f * m;
      o.connect(lp);
      o.start(t); o.stop(t + dur + 0.4);
    }
  }

  // ------------------------------------------------------------ bicí
  noise(t, dur, vol, type, freq, q = 1) {
    const c = this.ctx;
    const n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    n.buffer = this.s.noise;
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f).connect(g).connect(this.bus);
    n.start(t, Math.random()); n.stop(t + dur + 0.02);
  }
  thump(t, f0, f1, dur, vol) {
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.7);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.bus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  hit(k, t, boss) {
    const v = boss ? 1.2 : 1;
    if (k === 'K') this.s.drum(t, 0.28 * v, this.bus);
    else if (k === 'S') { this.noise(t, 0.12, 0.08 * v, 'highpass', 1500); this.thump(t, 220, 160, 0.08, 0.06 * v); }
    else if (k === 'h') this.noise(t, 0.04, 0.03, 'highpass', 7000);
    else if (k === 'B') { this.thump(t, 80, 42, 0.7, 0.34 * v); this.noise(t, 0.2, 0.05 * v, 'lowpass', 500); }
    else if (k === 'b') this.thump(t, 95, 55, 0.4, 0.2 * v);
    else if (k === 'D') this.thump(t, 140, 85, 0.22, 0.22 * v);
    else if (k === 'T') { this.noise(t, 0.05, 0.07 * v, 'bandpass', 3200, 3); this.thump(t, 700, 600, 0.04, 0.03); }
    else if (k === 't') this.noise(t, 0.035, 0.04 * v, 'bandpass', 4200, 4);
  }
  tom(t, f) { this.thump(t, f, f * 0.6, 0.18, 0.14); }
  timp(f, t) { this.thump(t, f * 1.02, f, 1.2, 0.2); this.noise(t, 0.15, 0.03, 'lowpass', 400); }
}
