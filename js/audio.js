// 효과음: audio/ 폴더의 녹음(생성) 샘플을 우선 쓰고, 아직 못 불러왔거나 없는 소리는 Web Audio로 즉석 합성한다.
// 샘플은 Stable Audio 3로 만들어 다듬은 것(audio/raw → audio/*.mp3).
const AUDIO_DIR = new URL('../audio/', import.meta.url);
const FILES = ['hit_clang', 'hit_great', 'hit_dull', 'hit_crack', 'shatter', 'coin', 'correct', 'wrong', 'door_slam', 'heat', 'hiss',
  'thunder', 'breakthrough', 'spirit', 'step', 'bell', 'fire_loop', 'music', 'intro_drone'];
// 게임 이벤트 이름 → 샘플, 크기, 재생 속도 범위(같은 소리가 반복돼도 덜 기계적으로)
const MAP = {
  clang: { s: 'hit_clang', gain: 0.85, rate: [0.94, 1.08] },
  great: { s: 'hit_great', gain: 1.0, rate: [0.97, 1.03] },
  dull: { s: 'hit_dull', gain: 0.85, rate: [0.92, 1.06] },
  crack: { s: 'hit_crack', gain: 0.9, rate: [0.95, 1.05] },
  shatter: { s: 'shatter', gain: 1.0 },
  feverHit: { s: 'hit_clang', gain: 0.55, rate: [1.12, 1.35] },
  coin: { s: 'coin', gain: 0.65, rate: [0.95, 1.08] },
  correct: { s: 'correct', gain: 0.55 },
  wrong: { s: 'wrong', gain: 0.6 },
  heat: { s: 'heat', gain: 0.55 },
  hiss: { s: 'hiss', gain: 0.55 },
  bell: { s: 'bell', gain: 0.55 },
  spirit: { s: 'spirit', gain: 0.85 },
  thunder: { s: 'thunder', gain: 1.0 },
  milestone: { s: 'breakthrough', gain: 0.8 },
  step: { s: 'step', gain: 0.3, rate: [0.85, 1.15] },
  doorSlam: { s: 'door_slam', gain: 0.95 },
};
export class Sfx {
  constructor() { this.ctx = null; this.muted = false; this.buf = {}; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(this.ctx.destination);
    this.noiseBuf = this._makeNoise(2);
    // 음악은 따로 묶어 효과음보다 작게
    this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 0.22; this.musicBus.connect(this.master);
    this._startAmbience();
    this._load();
  }

  async _load() {
    await Promise.all(FILES.map(async (n) => {
      try {
        const r = await fetch(new URL(n + '.mp3', AUDIO_DIR));
        if (!r.ok) return;
        this.buf[n] = await this.ctx.decodeAudioData(await r.arrayBuffer());
      } catch (e) { /* 불러오지 못하면 합성음으로 */ }
    }));
    if (this.buf.fire_loop) this._fireLoop();
    if (this.wantMusic) this.music(this.wantMusic);
  }
  // MP3 앞뒤에 붙는 짧은 무음을 피해 루프 구간을 잡는다
  _loopRange(b) {
    const d = b.getChannelData(0), lim = Math.min(d.length, Math.floor(b.sampleRate * 0.2));
    let a = 0; while (a < lim && Math.abs(d[a]) < 1e-4) a++;
    let z = d.length - 1; while (z > d.length - lim && Math.abs(d[z]) < 1e-4) z--;
    return [a / b.sampleRate, (z + 1) / b.sampleRate];
  }
  _sample(name, t, { gain = 1, rate = 1, out } = {}) {
    const b = this.buf[name]; if (!b) return null;
    const src = this.ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = gain;
    src.connect(g); g.connect(out || this.master); src.start(t);
    return { src, g };
  }
  // 화로 불소리 루프: 합성 바람 소리를 천천히 줄이고 녹음 루프로 바꾼다
  _fireLoop() {
    const c = this.ctx, b = this.buf.fire_loop, [a, z] = this._loopRange(b);
    const src = c.createBufferSource(); src.buffer = b; src.loop = true; src.loopStart = a; src.loopEnd = z;
    const g = c.createGain(); g.gain.value = 0;
    src.connect(g); g.connect(this.master); src.start(c.currentTime, a);
    g.gain.setTargetAtTime(0.32, c.currentTime, 1.2);
    if (this.ambGain) this.ambGain.gain.setTargetAtTime(0, c.currentTime, 0.8);
    this.fireReal = true;
  }
  // 배경 음악: 'music'(반복) 또는 'intro_drone'(프롤로그 한 번). null이면 멈춤.
  music(name) {
    this.wantMusic = name;
    if (!this.ctx) return;
    const c = this.ctx, now = c.currentTime;
    if (this.musicNode) { const old = this.musicNode; old.g.gain.setTargetAtTime(0, now, 0.6); old.src.stop(now + 3); this.musicNode = null; }
    if (!name || !this.buf[name]) return;
    const b = this.buf[name], src = c.createBufferSource(); src.buffer = b;
    if (name === 'music') { const [a, z] = this._loopRange(b); src.loop = true; src.loopStart = a; src.loopEnd = z; }
    const g = c.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(name === 'intro_drone' ? 1.6 : 1, now, 1.0);
    src.connect(g); g.connect(this.musicBus); src.start(now);
    this.musicNode = { src, g };
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05);
  }

  _makeNoise(sec) {
    const c = this.ctx, b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  _env(g, t, gain, attack, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  _noise(t, dur, { type = 'bandpass', freq = 1000, q = 1, gain = 0.3, attack = 0.002, freqEnd, out } = {}) {
    const c = this.ctx, src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = c.createGain();
    this._env(g, t, gain, attack, dur);
    src.connect(f); f.connect(g); g.connect(out || this.master);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }

  _tone(t, freq, dur, { type = 'sine', gain = 0.2, attack = 0.003, freqEnd } = {}) {
    const c = this.ctx, o = c.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = c.createGain();
    this._env(g, t, gain, attack, dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  play(name, opt = {}) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + 0.004, m = MAP[name];
    if (m && this.buf[m.s]) {
      const r = m.rate ? m.rate[0] + Math.random() * (m.rate[1] - m.rate[0]) : 1;
      this._sample(m.s, t, { gain: m.gain, rate: opt.fast && name === 'feverHit' ? r * 1.05 : r });
      return;
    }
    if (this[name]) this[name](t, opt);
  }
  doorSlam(t) { this.dull(t); this.crack(t + 0.05); }

  // 불 피우는 소리: 낮게 깔리는 바람 + 장작 튀는 소리
  _startAmbience() {
    const c = this.ctx, src = c.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
    const g = c.createGain(); g.gain.value = 0.05; this.ambGain = g;
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
    setInterval(() => {
      if (this.muted || c.state !== 'running' || this.fireReal) return;
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        this._noise(c.currentTime + Math.random() * 0.4, 0.03 + Math.random() * 0.04,
          { type: 'bandpass', freq: 1500 + Math.random() * 3000, q: 2, gain: 0.03 + Math.random() * 0.05 });
      }
    }, 420);
  }

  // 5단계 돌파: 올라가는 화음 + 낮은 쿵
  milestone(t) {
    [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this._tone(t + i * 0.045, 392 * Math.pow(2, s / 12), 0.9, { type: 'triangle', gain: 0.06 }));
    this._tone(t, 70, 0.9, { gain: 0.35, freqEnd: 40 });
    this._noise(t, 0.7, { type: 'bandpass', freq: 3000, freqEnd: 9000, gain: 0.08, attack: 0.06 });
  }
  // 번개: 날카로운 쩍 + 길게 우르릉
  thunder(t) {
    this._noise(t, 0.12, { type: 'highpass', freq: 2500, gain: 0.55, attack: 0.001 });
    this._noise(t + 0.02, 2.4, { type: 'lowpass', freq: 900, freqEnd: 60, q: 0.7, gain: 0.7, attack: 0.01 });
    this._tone(t, 48, 1.8, { type: 'sawtooth', gain: 0.16, freqEnd: 28 });
    this._noise(t + 0.3, 1.8, { type: 'lowpass', freq: 320, freqEnd: 70, gain: 0.45, attack: 0.2 });
  }
  step(t) { this._noise(t, 0.07, { type: 'lowpass', freq: 380 + Math.random() * 120, gain: 0.07, attack: 0.004 }); this._tone(t, 70 + Math.random() * 15, 0.06, { gain: 0.05, freqEnd: 45 }); }
  ui(t) { this._tone(t, 880, 0.06, { type: 'triangle', gain: 0.05 }); }
  whoosh(t, { fast } = {}) { this._noise(t, fast ? 0.1 : 0.17, { type: 'bandpass', freq: 400, freqEnd: 2400, q: 1.4, gain: 0.12, attack: 0.04 }); }

  _metal(t, power, base) {
    [1, 2.76, 5.4, 8.93, 13.3].forEach((m, i) =>
      this._tone(t, base * m, (0.55 + power * 0.5) / (1 + i * 0.6), { gain: (0.16 * power) / (1 + i * 0.7) }));
    this._noise(t, 0.07, { type: 'highpass', freq: 2600, gain: 0.3 * power });
    this._tone(t, 110, 0.2, { type: 'triangle', gain: 0.35 * power, freqEnd: 45 });
  }
  clang(t) { this._metal(t, 1, 560 + Math.random() * 50); }
  dull(t) { this._metal(t, 0.55, 380 + Math.random() * 30); this._noise(t, 0.12, { type: 'lowpass', freq: 900, gain: 0.25 }); }
  great(t) {
    this._metal(t, 1.3, 620);
    [0, 4, 7, 12, 16].forEach((s, i) => this._tone(t + 0.06 + i * 0.055, 660 * Math.pow(2, s / 12), 0.5, { type: 'triangle', gain: 0.07 }));
  }
  crack(t) {
    this._metal(t, 0.7, 300);
    for (let i = 0; i < 4; i++) this._noise(t + i * 0.025, 0.05, { type: 'bandpass', freq: 1800 + i * 500, q: 3, gain: 0.25 });
  }
  shatter(t) {
    this._tone(t, 70, 0.6, { type: 'sine', gain: 0.6, freqEnd: 30 });
    this._noise(t, 0.5, { type: 'highpass', freq: 1800, gain: 0.45, freqEnd: 6000 });
    for (let i = 0; i < 14; i++)
      this._tone(t + 0.02 + Math.random() * 0.45, 2200 + Math.random() * 3800, 0.18, { type: 'sine', gain: 0.05 });
  }
  fever(t) { [0, 5, 9, 12, 17, 21, 24].forEach((s, i) => this._tone(t + i * 0.05, 520 * Math.pow(2, s / 12), 0.7, { type: 'sine', gain: 0.07 })); }
  feverHit(t) { this._metal(t, 0.6, 700 + Math.random() * 200); }
  correct(t) { this._tone(t, 880, 0.18, { type: 'sine', gain: 0.12 }); this._tone(t + 0.08, 1320, 0.3, { type: 'sine', gain: 0.1 }); }
  wrong(t) { this._tone(t, 220, 0.3, { type: 'sawtooth', gain: 0.06, freqEnd: 150 }); }
  heat(t) { this._noise(t, 1.2, { type: 'lowpass', freq: 300, freqEnd: 1600, gain: 0.25, attack: 0.3 }); }
  hiss(t) { this._noise(t, 0.5, { type: 'highpass', freq: 3000, gain: 0.12, attack: 0.02 }); }
  place(t) { this._tone(t, 240, 0.12, { type: 'triangle', gain: 0.15, freqEnd: 120 }); this._noise(t, 0.05, { type: 'bandpass', freq: 1200, gain: 0.1 }); }
  bell(t) { [1, 2.0, 2.76, 4.1, 5.4].forEach((m, i) => this._tone(t, 392 * m, 2.6 / (1 + i * 0.4), { gain: 0.12 / (1 + i * 0.5) })); }
  coin(t) { [0, 0.07, 0.14].forEach((d, i) => this._tone(t + d, 1400 + i * 300, 0.15, { type: 'square', gain: 0.03 })); }
  blowout(t) { this._noise(t, 0.9, { type: 'bandpass', freq: 600, freqEnd: 200, q: 0.8, gain: 0.3, attack: 0.08 }); this._tone(t + 0.2, 90, 1.2, { gain: 0.3, freqEnd: 40 }); }
  spirit(t) { [196, 233, 294].forEach((f, i) => this._tone(t + i * 0.12, f, 1.8, { type: 'sine', gain: 0.08, attack: 0.4 })); }
  doom(t) { this._tone(t, 55, 2.5, { type: 'sawtooth', gain: 0.15, freqEnd: 30, attack: 0.3 }); this._noise(t, 2.5, { type: 'lowpass', freq: 500, freqEnd: 80, gain: 0.3, attack: 0.5 }); }
}
