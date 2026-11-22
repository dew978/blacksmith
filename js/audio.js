// 모든 효과음은 Web Audio로 즉석 합성한다 (외부 파일 없음).
export class Sfx {
  constructor() { this.ctx = null; this.muted = false; }

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
    this._startAmbience();
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
    if (!this.ctx || this.muted || !this[name]) return;
    this[name](this.ctx.currentTime + 0.004, opt);
  }

  // 불 피우는 소리: 낮게 깔리는 바람 + 장작 튀는 소리
  _startAmbience() {
    const c = this.ctx, src = c.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
    const g = c.createGain(); g.gain.value = 0.05;
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
    setInterval(() => {
      if (this.muted || c.state !== 'running') return;
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        this._noise(c.currentTime + Math.random() * 0.4, 0.03 + Math.random() * 0.04,
          { type: 'bandpass', freq: 1500 + Math.random() * 3000, q: 2, gain: 0.03 + Math.random() * 0.05 });
      }
    }, 420);
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
