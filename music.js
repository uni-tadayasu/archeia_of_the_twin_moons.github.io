// 手続き生成BGM（高音質版）：シード値から曲を組み立て、Web Audio で
// スーパーソウ・弦パッド・金管スタブ・サブベース・重層ドラム・リバーブ・ディレイ・コンプで鳴らす
const SCALES = [
  [0, 2, 3, 5, 7, 8, 10], // 自然的短音階
  [0, 2, 3, 5, 7, 9, 10], // ドリア
  [0, 1, 3, 5, 7, 8, 10], // フリギア
  [0, 2, 4, 5, 7, 9, 11], // 長音階
  [0, 2, 3, 5, 7, 8, 11], // 和声的短音階
  [0, 2, 4, 5, 7, 9, 10] // ミクソリディア
];
const PROGS = [[0, 5, 3, 4], [0, 3, 4, 4], [0, 6, 5, 4], [0, 4, 5, 3], [0, 2, 5, 4], [0, 5, 6, 4], [5, 3, 0, 4], [0, 0, 3, 4], [0, 6, 3, 4], [0, 3, 6, 4]];
const GROOVES = [
  // キック, スネア（1=スネア）
  ['x...x...x...x...', '....x.......x...'],
  ['x.....x...x.....', '....x.......x...'],
  ['x..x..x...x..x..', '....x.......x..x'],
  ['x.x...x.x.x.....', '....x.......x...'],
  ['x...x...x...x.x.', '....x..x....x...']
];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function makeImpulse(ctx, secs, decay) {
  const len = Math.floor(ctx.sampleRate * secs);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}
function driveCurve(k) {
  const n = 1024;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * k) / Math.tanh(k);
  }
  return c;
}

export class ProcMusic {
  constructor(ctx) {
    this.ctx = ctx;
    this.level = 0.5;
    // マスター：バス → コンプ → 出力
    this.out = ctx.createGain();
    this.out.gain.value = this.level;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 8;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.55;
    this.bus.connect(comp).connect(this.out).connect(ctx.destination);
    // キックでうねる「ポンプ」バス（パッド・リード用）
    this.pump = ctx.createGain();
    this.pump.connect(this.bus);
    // リバーブ
    this.verb = ctx.createConvolver();
    this.verb.buffer = makeImpulse(ctx, 2.4, 2.6);
    const vg = ctx.createGain();
    vg.gain.value = 0.32;
    this.verbIn = ctx.createGain();
    this.verbIn.connect(this.verb).connect(vg).connect(this.bus);
    // ピンポンディレイ
    this.dly = ctx.createGain();
    const dl = ctx.createDelay(1.5), dr = ctx.createDelay(1.5);
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const dlf = ctx.createBiquadFilter();
    dlf.type = 'lowpass';
    dlf.frequency.value = 3200;
    const pl = ctx.createStereoPanner(), pr = ctx.createStereoPanner();
    pl.pan.value = -0.7;
    pr.pan.value = 0.7;
    this.dly.connect(dl);
    dl.connect(pl).connect(this.bus);
    dl.connect(dr);
    dr.connect(pr).connect(this.bus);
    dr.connect(dlf).connect(fb).connect(dl);
    this.dl = dl;
    this.dr = dr;
    // ベース用ドライブ
    this.drive = ctx.createWaveShaper();
    this.drive.curve = driveCurve(2.5);
    this.drive.oversample = '2x';
    const bf = ctx.createBiquadFilter();
    bf.type = 'lowpass';
    bf.frequency.value = 900;
    this.drive.connect(bf).connect(this.bus);
    this.timer = null;
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  compose(seed) {
    const r = rng(seed * 7919 + 13);
    const pick = (a) => a[Math.floor(r() * a.length)];
    const groove = pick(GROOVES);
    const song = {
      bpm: 128 + Math.floor(r() * 44),
      scale: pick(SCALES),
      root: 40 + Math.floor(r() * 9),
      prog: pick(PROGS),
      prog2: pick(PROGS),
      kick: [...groove[0]].map((c) => c === 'x'),
      snare: [...groove[1]].map((c) => c === 'x'),
      bassPat: Array.from({ length: 16 }, (_, i) => (i % 2 === 0 ? 1 : r() < 0.55 ? 2 : 0)),
      arp: Array.from({ length: 16 }, () => Math.floor(r() * 5)),
      arpOct: r() < 0.5 ? 1 : 2,
      leadDetune: 8 + r() * 14,
      brass: r() < 0.6,
      stabs: Array.from({ length: 16 }, (_, i) => i === 0 || (r() < 0.2 && i % 2 === 0) || i === 14 && r() < 0.5),
      swing: r() < 0.25 ? 0.12 : 0,
      melody: [],
      hook: []
    };
    // モチーフ（2小節）を作り、くり返しと変奏でメロディを組む
    const motif = [];
    let deg = Math.floor(r() * 3) * 2;
    for (let i = 0; i < 32; i++) {
      if (r() < (i % 4 === 0 ? 0.85 : i % 2 ? 0.3 : 0.6)) {
        deg = Math.max(-1, Math.min(9, deg + pick([-2, -1, -1, 1, 1, 2, 3, -3, 0])));
        motif.push({ d: deg, len: r() < 0.3 ? 3 : r() < 0.5 ? 2 : 1 });
      } else motif.push(null);
    }
    const shift = pick([2, 3, 4, -1]);
    song.melody = [...motif, ...motif.map((n, i) => (n && i >= 24 ? { d: n.d + shift, len: n.len } : n))];
    song.hook = song.melody.map((n) => (n ? { d: n.d + 2, len: n.len } : null));
    return song;
  }

  noteOf(song, degree, octave) {
    const s = song.scale;
    const n = s.length;
    const o = Math.floor(degree / n);
    return song.root + 12 * (octave + o) + s[((degree % n) + n) % n];
  }

  play(track) {
    this.stop();
    this.song = this.compose(track.seed);
    this.step = 0;
    this.spb = 60 / this.song.bpm / 4;
    const dt = this.spb * 3;
    this.dl.delayTime.value = dt;
    this.dr.delayTime.value = dt;
    const now = this.ctx.currentTime;
    this.next = now + 0.1;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(0.0001, now);
    this.out.gain.exponentialRampToValueAtTime(this.level, now + 1.2);
    this.timer = setInterval(() => this.tick(), 25);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  get playing() {
    return !!this.timer;
  }

  tick() {
    while (this.next < this.ctx.currentTime + 0.15) {
      const sw = this.step % 2 ? this.song.swing * this.spb : 0;
      this.playStep(this.step, this.next + sw);
      this.next += this.spb;
      this.step++;
    }
  }

  // 16小節×4 の構成：導入 → 展開 → サビ → 間奏
  playStep(step, t) {
    const s = this.song;
    const i = step % 16;
    const barAll = Math.floor(step / 16);
    const section = Math.floor(barAll / 8) % 4; // 0導入 1展開 2サビ 3間奏
    const bar = barAll % 4;
    const prog = section === 2 ? s.prog2 : s.prog;
    const chord = prog[bar];
    const full = section === 1 || section === 2;
    const fill = barAll % 8 === 7 && i >= 12;

    // ドラム
    if (section !== 0 || i % 4 === 0) {
      if (s.kick[i] && !fill) this.kick(t);
    }
    if (section !== 0 && s.snare[i] && !fill) this.snare(t, 1);
    if (fill) {
      this.tom(t, 220 - (i - 12) * 30);
      if (i % 2) this.snare(t, 0.6);
    }
    if (full || section === 3) this.hat(t, i % 4 === 2 ? 0.16 : 0.07, i % 8 === 6 && section === 2);
    if (i === 0 && bar === 0 && section !== 3) this.crash(t);
    if (barAll % 8 === 7 && i === 8) this.riser(t, this.spb * 8);

    // ベース
    const bp = s.bassPat[i];
    if (bp && section !== 3) {
      const n = this.noteOf(s, chord, -2) + (bp === 2 && i % 4 === 3 ? 12 : 0);
      this.bass(mtof(n), t, this.spb * (bp === 1 ? 1.7 : 0.9));
    }
    // 弦パッド
    if (i === 0) {
      const v = section === 0 ? 0.05 : 0.07;
      for (const k of [0, 2, 4, 7]) this.strings(mtof(this.noteOf(s, chord + k, 0)), t, this.spb * 16, v);
    }
    // 金管スタブ
    if (s.brass && full && s.stabs[i]) {
      for (const k of [0, 2, 4]) this.brass(mtof(this.noteOf(s, chord + k, 0)), t, this.spb * 1.5);
    }
    // アルペジオ
    if (section !== 2 || i % 2 === 0) {
      const a = [0, 2, 4, 7, 9][s.arp[i]];
      this.pluck(mtof(this.noteOf(s, chord + a, s.arpOct)), t, this.spb * 0.9, section === 0 ? 0.05 : 0.04);
    }
    // メロディ（展開＝通常、サビ＝高音＋オクターブ重ね）
    if (full) {
      const m = (section === 2 ? s.hook : s.melody)[(step % 64) % s.melody.length];
      if (m) {
        const f = mtof(this.noteOf(s, chord + m.d, 1));
        this.lead(f, t, this.spb * (m.len + 0.6), section === 2);
      }
    }
    // キックに合わせてパッドを沈ませる（サイドチェイン風）
    if (s.kick[i] && section !== 0) {
      const g = this.pump.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(0.35, t);
      g.linearRampToValueAtTime(1, t + this.spb * 2.5);
    }
  }

  env(g, t, a, peak, dur, rel = 0.08) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(0.0001, t + Math.max(a, dur - rel), rel / 2 + 0.02);
  }

  // デチューンしたノコギリ波を重ねたスーパーソウ
  lead(freq, t, dur, big) {
    const c = this.ctx;
    const g = c.createGain();
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(1800, t);
    f.frequency.exponentialRampToValueAtTime(big ? 6500 : 4200, t + 0.05);
    f.frequency.exponentialRampToValueAtTime(2200, t + dur);
    this.env(g, t, 0.012, big ? 0.075 : 0.06, dur, 0.12);
    const n = big ? 5 : 3;
    const pan = c.createStereoPanner();
    for (let v = 0; v < n; v++) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq * (big && v === n - 1 ? 2 : 1);
      o.detune.value = (v - (n - 1) / 2) * this.song.leadDetune;
      const vib = c.createOscillator();
      const vg = c.createGain();
      vib.frequency.value = 5.5;
      vg.gain.setValueAtTime(0, t);
      vg.gain.linearRampToValueAtTime(freq * 0.006, t + dur);
      vib.connect(vg).connect(o.frequency);
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.3);
      vib.start(t);
      vib.stop(t + dur + 0.3);
    }
    f.connect(g).connect(pan).connect(this.pump);
    g.connect(this.verbIn);
    g.connect(this.dly);
  }

  strings(freq, t, dur, vol) {
    const c = this.ctx;
    const g = c.createGain();
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2400;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.35);
    g.gain.setValueAtTime(vol, t + dur - 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
    for (const [det, p] of [[-9, -0.6], [9, 0.6]]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = det;
      const pan = c.createStereoPanner();
      pan.pan.value = p;
      o.connect(pan).connect(f);
      o.start(t);
      o.stop(t + dur + 0.3);
    }
    f.connect(g).connect(this.pump);
    g.connect(this.verbIn);
  }

  brass(freq, t, dur) {
    const c = this.ctx;
    const o = c.createOscillator();
    const o2 = c.createOscillator();
    o.type = o2.type = 'sawtooth';
    o.frequency.value = freq;
    o2.frequency.value = freq * 1.003;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 3;
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(3200, t + 0.06);
    f.frequency.exponentialRampToValueAtTime(900, t + dur);
    const g = c.createGain();
    this.env(g, t, 0.02, 0.05, dur, 0.1);
    o.connect(f);
    o2.connect(f);
    f.connect(g).connect(this.bus);
    g.connect(this.verbIn);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.25);
    o2.stop(t + dur + 0.25);
  }

  pluck(freq, t, dur, vol) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(5000, t);
    f.frequency.exponentialRampToValueAtTime(600, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.pump);
    g.connect(this.dly);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  bass(freq, t, dur) {
    const c = this.ctx;
    const sub = c.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = freq;
    const sg = c.createGain();
    this.env(sg, t, 0.005, 0.5, dur, 0.05);
    sub.connect(sg).connect(this.bus);
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq * 2;
    const g = c.createGain();
    this.env(g, t, 0.005, 0.22, dur, 0.05);
    o.connect(g).connect(this.drive);
    sub.start(t);
    o.start(t);
    sub.stop(t + dur + 0.15);
    o.stop(t + dur + 0.15);
  }

  kick(t) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.09);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.3);
    g.gain.setValueAtTime(1.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.38);
    this.noiseHit(t, 0.35, 0.012, 4000, 'highpass', this.bus); // アタックのクリック
  }

  noiseHit(t, vol, dur, freq, type, dest, q = 0.8) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(dest || this.bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
    return g;
  }

  snare(t, v) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(240, t);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
    g.gain.setValueAtTime(0.45 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.14);
    const n = this.noiseHit(t, 0.5 * v, 0.2, 3200, 'bandpass', this.bus, 0.6);
    n.connect(this.verbIn);
  }

  tom(t, freq) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.25);
    g.gain.setValueAtTime(0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(this.bus);
    g.connect(this.verbIn);
    o.start(t);
    o.stop(t + 0.32);
  }

  hat(t, v, open) {
    this.noiseHit(t, v, open ? 0.22 : 0.035, 9000, 'highpass');
  }

  crash(t) {
    const g = this.noiseHit(t, 0.22, 1.6, 6000, 'highpass');
    g.connect(this.verbIn);
  }

  riser(t, dur) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 4;
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(8000, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + dur);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.05);
    src.connect(f).connect(g).connect(this.bus);
    g.connect(this.verbIn);
    src.start(t);
    src.stop(t + dur + 0.08);
  }
}
