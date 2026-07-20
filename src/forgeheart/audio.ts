/**
 * Continual generative parlor / ragtime-tinged score (Web Audio oscillators only).
 * Fresh phrases, motifs, keys, and progressions evolve while you play — no fixed loop.
 */

/** Scale intervals (semitones from root). */
const SCALE_MAJOR = [0, 2, 4, 5, 7, 9, 11];
const SCALE_MINOR = [0, 2, 3, 5, 7, 8, 10];
const SCALE_MIXO = [0, 2, 4, 5, 7, 9, 10];

/** Chord degree progressions (0=I … 6=VII) — rag / parlor cadences. */
const PROGRESSIONS: number[][] = [
  [0, 4, 5, 4], // I V vi V
  [0, 5, 3, 4], // I vi IV V
  [0, 3, 4, 0], // I IV V I
  [0, 4, 0, 4], // I V I V
  [5, 3, 0, 4], // vi IV I V
  [0, 5, 1, 4], // I vi ii V
  [3, 4, 0, 0], // IV V I I
  [0, 2, 5, 4], // I iii vi V
];

type MusicMode = 'major' | 'minor' | 'mixo';

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Tiny seeded PRNG (mulberry32) — stable phrases within a session, different each resume. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class ForgeAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windSource: AudioBufferSourceNode | null = null;
  private boardHumGain: GainNode | null = null;
  private boardHumOsc: OscillatorNode | null = null;
  private boardHumOsc2: OscillatorNode | null = null;
  private boardRushGain: GainNode | null = null;
  private boardRushFilter: BiquadFilterNode | null = null;
  private boardRushSource: AudioBufferSourceNode | null = null;
  private boardJetGain: GainNode | null = null;
  private boardJetOsc: OscillatorNode | null = null;
  private musicTimer: number | null = null;
  private musicNextNoteTime = 0;
  private readonly musicBeatSec = 0.25; // 120 BPM eighths
  private readonly musicLookaheadSec = 0.35;
  private hatBuffer: AudioBuffer | null = null;
  private step = 0;
  private tension = 0; // 0 calm lab · 1 siege
  /** 0 indoor · 1 full outdoor wind */
  private windAmount = 0;
  private whooshCd = 0;
  enabled = false;

  // ——— Generative music state ———
  private rng: () => number = Math.random;
  private phraseIndex = 0;
  private keyRoot = 48; // C3
  private mode: MusicMode = 'major';
  private progression: number[] = PROGRESSIONS[0]!;
  private motif: number[] = []; // scale degrees (−1 = rest), length 8
  private phraseBass: number[] = new Array(16).fill(0);
  private phraseMel: number[] = new Array(16).fill(0);
  private phraseFill: number[] = new Array(16).fill(0);
  private phraseHat: boolean[] = new Array(16).fill(false);
  private sectionEnergy = 0.55;

  async resume() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      // Start silent then fade in — avoids start-up speaker blip
      this.master.gain.value = 0.0001;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.22;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.55;
      this.sfxGain.connect(this.master);
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.0001;
      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 420;
      this.windFilter.Q.value = 0.7;
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.master);
      this.startWindLoop();
      this.initBoardAudio();
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.enabled = true;
    // Gentle master fade-in (prevents double-start crack)
    if (this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), t);
      this.master.gain.linearRampToValueAtTime(0.48, t + 0.35);
    }
    this.ensureMusic();
  }

  /**
   * Hard-stop all music, loops, and SFX — call on title return / game dispose.
   * Prevents stacked music when starting a new session.
   */
  stop() {
    this.enabled = false;
    this.tension = 0;
    this.windAmount = 0;
    this.whooshCd = 0;
    this.step = 0;
    this.phraseIndex = 0;
    this.motif = [];
    this.resetPhraseBuffers();

    if (this.musicTimer != null) {
      window.clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
    this.musicNextNoteTime = 0;
    this.hatBuffer = null;

    // Mute immediately before tearing nodes down
    if (this.ctx && this.master) {
      try {
        const t = this.ctx.currentTime;
        this.master.gain.cancelScheduledValues(t);
        this.master.gain.setValueAtTime(0, t);
      } catch {
        /* ignore */
      }
    }
    for (const g of [
      this.musicGain,
      this.sfxGain,
      this.windGain,
      this.boardHumGain,
      this.boardRushGain,
      this.boardJetGain,
    ]) {
      if (!g || !this.ctx) continue;
      try {
        g.gain.cancelScheduledValues(this.ctx.currentTime);
        g.gain.value = 0;
      } catch {
        /* ignore */
      }
    }

    this.safeStopNode(this.windSource);
    this.safeStopNode(this.boardRushSource);
    this.safeStopNode(this.boardHumOsc);
    this.safeStopNode(this.boardHumOsc2);
    this.safeStopNode(this.boardJetOsc);
    this.windSource = null;
    this.boardRushSource = null;
    this.boardHumOsc = null;
    this.boardHumOsc2 = null;
    this.boardJetOsc = null;
    this.boardHumGain = null;
    this.boardRushGain = null;
    this.boardRushFilter = null;
    this.boardJetGain = null;
    this.windGain = null;
    this.windFilter = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.master = null;

    const ctx = this.ctx;
    this.ctx = null;
    if (ctx) {
      try {
        void ctx.close();
      } catch {
        /* ignore */
      }
    }
  }

  private safeStopNode(node: AudioScheduledSourceNode | null) {
    if (!node) return;
    try {
      node.stop();
    } catch {
      /* already stopped */
    }
    try {
      node.disconnect();
    } catch {
      /* ignore */
    }
  }

  private initBoardAudio() {
    if (!this.ctx || !this.master) return;
    // Gentle idle hum-hum-hum
    this.boardHumGain = this.ctx.createGain();
    this.boardHumGain.gain.value = 0;
    this.boardHumGain.connect(this.master);
    this.boardHumOsc = this.ctx.createOscillator();
    this.boardHumOsc.type = 'sine';
    this.boardHumOsc.frequency.value = 92;
    this.boardHumOsc2 = this.ctx.createOscillator();
    this.boardHumOsc2.type = 'triangle';
    this.boardHumOsc2.frequency.value = 138;
    const humFilter = this.ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 400;
    this.boardHumOsc.connect(humFilter);
    this.boardHumOsc2.connect(humFilter);
    humFilter.connect(this.boardHumGain);
    this.boardHumOsc.start();
    this.boardHumOsc2.start();

    // Rushing wind with speed
    this.boardRushGain = this.ctx.createGain();
    this.boardRushGain.gain.value = 0;
    this.boardRushFilter = this.ctx.createBiquadFilter();
    this.boardRushFilter.type = 'bandpass';
    this.boardRushFilter.frequency.value = 800;
    this.boardRushFilter.Q.value = 0.5;
    this.boardRushFilter.connect(this.boardRushGain);
    this.boardRushGain.connect(this.master);
    const sec = 3;
    const n = Math.floor(this.ctx.sampleRate * sec);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0;
    for (let i = 0; i < n; i++) {
      const white = Math.random() * 2 - 1;
      b0 = (b0 + 0.02 * white) / 1.02;
      data[i] = b0 * 3.5;
    }
    this.boardRushSource = this.ctx.createBufferSource();
    this.boardRushSource.buffer = buf;
    this.boardRushSource.loop = true;
    this.boardRushSource.connect(this.boardRushFilter);
    this.boardRushSource.start();

    // Top-speed sweet jet
    this.boardJetGain = this.ctx.createGain();
    this.boardJetGain.gain.value = 0;
    this.boardJetGain.connect(this.master);
    this.boardJetOsc = this.ctx.createOscillator();
    this.boardJetOsc.type = 'sawtooth';
    this.boardJetOsc.frequency.value = 55;
    const jetF = this.ctx.createBiquadFilter();
    jetF.type = 'lowpass';
    jetF.frequency.value = 900;
    const jetF2 = this.ctx.createBiquadFilter();
    jetF2.type = 'bandpass';
    jetF2.frequency.value = 1200;
    jetF2.Q.value = 2;
    this.boardJetOsc.connect(jetF);
    jetF.connect(jetF2);
    jetF2.connect(this.boardJetGain);
    this.boardJetOsc.start();
  }

  /**
   * Board audio bed.
   * @param idle 1 when board nearby / idle bobbing
   * @param speedNorm 0..1 when riding
   */
  setBoardAudio(idle: number, speedNorm: number) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const sn = Math.max(0, Math.min(1, speedNorm));
    const hum = Math.max(idle * 0.04, sn > 0.02 ? 0.018 : 0);
    if (this.boardHumGain) {
      this.boardHumGain.gain.setTargetAtTime(hum, t, 0.15);
    }
    if (this.boardHumOsc) {
      // Gentle "hum hum hum" vibrato
      const vib = 92 + Math.sin(t * 3.2) * 4 + sn * 20;
      this.boardHumOsc.frequency.setTargetAtTime(vib, t, 0.08);
    }
    if (this.boardHumOsc2) {
      this.boardHumOsc2.frequency.setTargetAtTime(138 + Math.sin(t * 2.1) * 6, t, 0.08);
    }
    // Rush scales with speed (capped — was easy to overload with stacking)
    const rush = sn * sn * 0.11;
    if (this.boardRushGain) this.boardRushGain.gain.setTargetAtTime(rush, t, 0.14);
    if (this.boardRushFilter) {
      this.boardRushFilter.frequency.setTargetAtTime(500 + sn * 2200, t, 0.14);
    }
    // Jet only near top speed
    const jet = Math.max(0, sn - 0.72) / 0.28;
    if (this.boardJetGain) this.boardJetGain.gain.setTargetAtTime(jet * 0.045, t, 0.18);
    if (this.boardJetOsc) {
      this.boardJetOsc.frequency.setTargetAtTime(48 + sn * 40, t, 0.1);
    }
  }

  /** Doppler-ish whoosh when passing a prop at speed */
  playPassWhoosh(intensity = 1) {
    if (!this.ctx || !this.sfxGain || !this.enabled) return;
    if (this.whooshCd > 0) return;
    this.whooshCd = 0.22;
    const t = this.ctx.currentTime;
    const inten = Math.min(1.2, Math.max(0, intensity));
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(420 + inten * 200, t);
    o.frequency.linearRampToValueAtTime(120, t + 0.22);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.08 * inten, t + 0.025);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.25);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    o.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    o.start(t);
    o.stop(t + 0.28);
    this.noise(t, 0.15, 0.04 * inten, this.sfxGain);
  }

  tickWhooshCd(dt: number) {
    this.whooshCd = Math.max(0, this.whooshCd - dt);
  }

  setTension(t: number) {
    this.tension = Math.max(0, Math.min(1, t));
  }

  /**
   * Outdoor wind bed. amount 0 = lab silence, 1 = open sky dock.
   * Call each frame with a smoothed target.
   */
  setWind(amount: number) {
    this.windAmount = Math.max(0, Math.min(1, amount));
    if (!this.enabled || !this.ctx || !this.windGain || !this.windFilter) return;
    const t = this.ctx.currentTime;
    // Soft target only — cancelScheduledValues + hard set caused audible blips
    const g = 0.0001 + this.windAmount * 0.1;
    this.windGain.gain.setTargetAtTime(g, t, 0.45);
    const freq = 280 + this.windAmount * 220 + this.tension * 80;
    this.windFilter.frequency.setTargetAtTime(freq, t, 0.5);
  }

  private startWindLoop() {
    if (!this.ctx || !this.windFilter || this.windSource) return;
    // Long looping noise buffer
    const sec = 4;
    const n = Math.floor(this.ctx.sampleRate * sec);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0;
    // Brown-ish noise (softer wind than pure white)
    for (let i = 0; i < n; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      data[i] = (b0 + b1 + b2 + white * 0.05) * 0.35;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(this.windFilter);
    src.start();
    this.windSource = src;
  }

  private ensureMusic() {
    if (!this.ctx || !this.musicGain || !this.enabled) return;
    // Never stack schedulers (title→play without stop used to double music)
    if (this.musicTimer != null) {
      window.clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
    this.ensureHatBuffer();
    // Fresh seed each session so the score never restarts the same way
    this.rng = mulberry32((Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0);
    this.step = 0;
    this.phraseIndex = 0;
    this.keyRoot = 48 + Math.floor(this.rng() * 5) * 2; // nearby bright keys
    this.mode = this.tension > 0.35 ? 'minor' : this.rng() < 0.35 ? 'mixo' : 'major';
    this.progression = PROGRESSIONS[Math.floor(this.rng() * PROGRESSIONS.length)]!;
    this.sectionEnergy = 0.45 + this.rng() * 0.35;
    this.motif = this.composeMotif();
    this.composePhrase();
    // Schedule from AudioContext clock so FPS stalls don't drag the tempo
    this.musicNextNoteTime = this.ctx.currentTime + 0.05;
    this.schedulerTick();
  }

  private ensureHatBuffer() {
    if (!this.ctx || this.hatBuffer) return;
    const dur = 0.04;
    const n = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    this.hatBuffer = buf;
  }

  /** Top up the lookahead window from AudioContext.currentTime (FPS-independent). */
  private schedulerTick = () => {
    this.musicTimer = null;
    if (!this.enabled || !this.ctx || !this.musicGain) return;
    const ctx = this.ctx;
    const horizon = ctx.currentTime + this.musicLookaheadSec;
    while (this.musicNextNoteTime < horizon) {
      this.scheduleMusicStep(this.musicNextNoteTime);
      this.musicNextNoteTime += this.musicBeatSec;
    }
    // Wake again before the buffer runs dry (~ half lookahead)
    const delayMs = Math.max(25, (this.musicLookaheadSec * 0.45) * 1000);
    this.musicTimer = window.setTimeout(this.schedulerTick, delayMs);
  };

  private scheduleMusicStep(when: number) {
    if (!this.ctx || !this.musicGain) return;
    const s = this.step % 16;
    if (s === 0 && this.step > 0) {
      this.phraseIndex++;
      this.composePhrase();
    }
    this.step++;

    const b = this.phraseBass[s] ?? 0;
    const m = this.phraseMel[s] ?? 0;
    const f = this.phraseFill[s] ?? 0;
    const swing = s % 2 === 1 ? 0.035 + this.sectionEnergy * 0.015 : 0;
    const ten = this.tension;

    if (b > 0) {
      this.tone(b, when, 0.17 + ten * 0.04, 0.05 + ten * 0.018, 'triangle', this.musicGain);
    }
    if (m > 0) {
      this.tone(
        m,
        when + swing,
        0.11 + (s % 4 === 0 ? 0.04 : 0),
        0.026 + this.sectionEnergy * 0.008,
        'square',
        this.musicGain,
      );
    }
    if (f > 0) {
      this.tone(f, when + swing * 0.5, 0.09, 0.012 + ten * 0.006, 'triangle', this.musicGain);
    }
    if (this.phraseHat[s]) {
      const hatGain = 0.0055 + this.sectionEnergy * 0.003 + ten * 0.002;
      this.noise(when, 0.028, hatGain, this.musicGain);
    }
  }

  private resetPhraseBuffers() {
    this.phraseBass = new Array(16).fill(0);
    this.phraseMel = new Array(16).fill(0);
    this.phraseFill = new Array(16).fill(0);
    this.phraseHat = new Array(16).fill(false);
  }

  private scaleOf(mode: MusicMode): number[] {
    if (mode === 'minor') return SCALE_MINOR;
    if (mode === 'mixo') return SCALE_MIXO;
    return SCALE_MAJOR;
  }

  private degreeToMidi(root: number, degree: number, octaveOffset = 0): number {
    const scale = this.scaleOf(this.mode);
    const n = scale.length;
    let d = degree;
    let oct = octaveOffset;
    while (d < 0) {
      d += n;
      oct -= 1;
    }
    while (d >= n) {
      d -= n;
      oct += 1;
    }
    return root + scale[d]! + oct * 12;
  }

  private pick<T>(arr: T[]): T {
    return arr[Math.floor(this.rng() * arr.length)]!;
  }

  private composeMotif(): number[] {
    // 8-step motif in scale degrees (−1 rest). Contour prefers steps / small leaps.
    const dens = 0.55 + this.sectionEnergy * 0.25 + this.tension * 0.1;
    const out: number[] = [];
    let cur = this.pick([0, 2, 4, 4, 5]);
    for (let i = 0; i < 8; i++) {
      const strong = i % 2 === 0;
      if (this.rng() > dens && !strong) {
        out.push(-1);
        continue;
      }
      const leap = this.rng();
      let delta = 0;
      if (leap < 0.55) delta = this.rng() < 0.5 ? 1 : -1;
      else if (leap < 0.82) delta = this.rng() < 0.5 ? 2 : -2;
      else if (leap < 0.94) delta = this.rng() < 0.5 ? 3 : -3;
      else delta = 0;
      // Bias toward chord-ish degrees on strong beats
      if (strong && this.rng() < 0.45) {
        cur = this.pick([0, 2, 4, 4, 5]);
      } else {
        cur = Math.max(-2, Math.min(9, cur + delta));
      }
      out.push(cur);
    }
    // Ensure at least 3 sounding notes
    if (out.filter((d) => d >= 0).length < 3) {
      out[0] = 0;
      out[2] = 2;
      out[4] = 4;
    }
    return out;
  }

  private mutateMotif(src: number[]): number[] {
    const out = src.slice();
    const edits = 1 + Math.floor(this.rng() * 3);
    for (let e = 0; e < edits; e++) {
      const i = Math.floor(this.rng() * out.length);
      const roll = this.rng();
      if (roll < 0.3) out[i] = -1;
      else if (roll < 0.55) out[i] = (out[i]! < 0 ? 0 : out[i]!) + (this.rng() < 0.5 ? 1 : -1);
      else if (roll < 0.75) {
        // rhythmic displacement
        const j = (i + 1) % out.length;
        const tmp = out[i]!;
        out[i] = out[j]!;
        out[j] = tmp;
      } else {
        out[i] = this.pick([0, 2, 4, 5, -1]);
      }
    }
    return out;
  }

  private evolveSection() {
    // Key / mode / progression / energy shift so the score keeps moving
    if (this.phraseIndex > 0 && this.phraseIndex % 8 === 0) {
      // Modulate to nearby key
      const shifts = [0, 5, 7, -5, -7, 2, -2]; // fourths/fifths + neighbors
      this.keyRoot = 48 + ((this.keyRoot - 48 + this.pick(shifts) + 12) % 12);
      if (this.keyRoot < 46) this.keyRoot += 12;
      if (this.keyRoot > 58) this.keyRoot -= 12;
    }
    if (this.phraseIndex % 4 === 0) {
      this.progression = this.pick(PROGRESSIONS);
      this.sectionEnergy = Math.max(
        0.3,
        Math.min(0.95, this.sectionEnergy + (this.rng() - 0.5) * 0.35),
      );
    }
    // Tension pulls toward minor; calm wanders major/mixo
    if (this.tension > 0.55) this.mode = 'minor';
    else if (this.tension > 0.3) this.mode = this.rng() < 0.5 ? 'minor' : 'mixo';
    else if (this.phraseIndex % 6 === 0) {
      this.mode = this.pick(['major', 'major', 'mixo', 'minor'] as MusicMode[]);
    }

    if (this.motif.length === 0 || this.phraseIndex % 2 === 0) {
      if (this.motif.length === 0 || this.rng() < 0.4) this.motif = this.composeMotif();
      else this.motif = this.mutateMotif(this.motif);
    } else if (this.rng() < 0.35) {
      this.motif = this.mutateMotif(this.motif);
    }
  }

  private composePhrase() {
    this.evolveSection();
    const prog = this.progression;
    const bass: number[] = [];
    const mel: number[] = [];
    const fill: number[] = [];
    const hat: boolean[] = [];

    // Phrase form: A A' B A'' over 16 steps using motif halves
    const form = this.phraseIndex % 4;
    let line = this.motif.slice();
    if (form === 1) line = this.mutateMotif(line);
    else if (form === 2) {
      // Answer phrase — invert contour-ish
      line = line.map((d) => (d < 0 ? -1 : Math.max(0, 4 - (d % 7))));
      if (this.rng() < 0.5) line = this.mutateMotif(line);
    } else if (form === 3) {
      line = this.mutateMotif(this.motif);
    }

    const dens = this.sectionEnergy * (0.75 + this.tension * 0.35);
    for (let s = 0; s < 16; s++) {
      const chordDeg = prog[Math.floor(s / 4) % prog.length]!;
      const chordRoot = this.degreeToMidi(this.keyRoot, chordDeg, 0);
      const third = this.degreeToMidi(this.keyRoot, chordDeg + 2, 0);
      const fifth = this.degreeToMidi(this.keyRoot, chordDeg + 4, 0);

      // Stride bass: roots / fifths on strong beats, occasional walk
      let bHz = 0;
      if (s % 4 === 0) {
        bHz = midiToHz(chordRoot);
      } else if (s % 4 === 2) {
        bHz = midiToHz(this.rng() < 0.65 ? fifth : chordRoot + (this.rng() < 0.5 ? 7 : -5));
      } else if (this.rng() < 0.18 + dens * 0.12) {
        bHz = midiToHz(this.degreeToMidi(this.keyRoot, chordDeg + this.pick([0, 2, 4]), 0));
      }

      // Melody from motif (tiled) with octave lift; chord-tone snap on downbeats
      let mHz = 0;
      const md = line[s % 8]!;
      if (md >= 0 && (s % 2 === 0 || this.rng() < dens)) {
        let deg = md;
        if (s % 4 === 0 && this.rng() < 0.5) {
          deg = chordDeg + this.pick([0, 2, 4]);
        }
        const midi = this.degreeToMidi(this.keyRoot, deg, 1);
        mHz = midiToHz(midi + (this.rng() < 0.12 ? 12 : 0));
      } else if (md < 0 && s % 4 === 2 && this.rng() < dens * 0.45) {
        // Syncopated fill on offbeat rests
        mHz = midiToHz(this.degreeToMidi(this.keyRoot, chordDeg + this.pick([2, 4, 5]), 1));
      }

      // Soft chord stab / fill voice
      let fHz = 0;
      if (s % 4 === 1 && this.rng() < 0.4 + dens * 0.15) {
        fHz = midiToHz(third + 12);
      } else if (s % 4 === 3 && this.rng() < 0.28 + this.tension * 0.2) {
        fHz = midiToHz(fifth + 12);
      }

      bass.push(bHz);
      mel.push(mHz);
      fill.push(fHz);
      hat.push(s % 2 === 0 || (this.rng() < dens * 0.22 && s % 2 === 1));
    }

    // Cadence: last phrase beat prefers tonic melody
    if (this.rng() < 0.7) {
      mel[14] = midiToHz(this.degreeToMidi(this.keyRoot, 0, 1));
      mel[15] = 0;
      bass[14] = midiToHz(this.degreeToMidi(this.keyRoot, prog[prog.length - 1]!, 0));
    }

    this.phraseBass = bass;
    this.phraseMel = mel;
    this.phraseFill = fill;
    this.phraseHat = hat;
  }

  private tone(
    freq: number,
    when: number,
    dur: number,
    gain: number,
    type: OscillatorType,
    dest: AudioNode,
  ) {
    if (!this.ctx || !this.enabled) return;
    // Linear ramps — exponentialRamp on near-zero gain often clicks / speaker-blips
    const now = this.ctx.currentTime;
    const start = Math.max(when, now);
    const peak = Math.min(0.18, Math.max(0.0001, gain));
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = Math.max(20, freq);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(peak, start + 0.018);
    g.gain.linearRampToValueAtTime(0.0001, start + Math.max(0.04, dur));
    o.connect(g);
    g.connect(dest);
    o.start(start);
    o.stop(start + Math.max(0.05, dur) + 0.03);
  }

  private noise(when: number, dur: number, gain: number, dest: AudioNode) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    const start = Math.max(when, now);
    this.ensureHatBuffer();
    const src = this.ctx.createBufferSource();
    // Prefer pooled hat buffer; fall back to tiny alloc only if missing
    if (this.hatBuffer) {
      src.buffer = this.hatBuffer;
    } else {
      const n = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
      src.buffer = buf;
    }
    const g = this.ctx.createGain();
    const peak = Math.min(0.12, Math.max(0, gain));
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(peak, start + 0.008);
    g.gain.linearRampToValueAtTime(0.0001, start + Math.max(0.02, dur));
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 4000;
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(start);
  }

  /** Heavy door bang */
  playBang(intensity = 1) {
    if (!this.ctx || !this.sfxGain || !this.enabled) return;
    const t = this.ctx.currentTime;
    const inten = Math.min(1.25, Math.max(0, intensity));
    this.tone(55 + inten * 20, t, 0.35, 0.22 * inten, 'sine', this.sfxGain);
    this.tone(90, t, 0.2, 0.12 * inten, 'triangle', this.sfxGain);
    this.noise(t, 0.25, 0.1 * inten, this.sfxGain);
  }

  playPickup() {
    if (!this.ctx || !this.sfxGain || !this.enabled) return;
    const t = this.ctx.currentTime;
    this.tone(660, t, 0.08, 0.08, 'square', this.sfxGain);
    this.tone(880, t + 0.07, 0.1, 0.06, 'square', this.sfxGain);
  }

  playReprogram() {
    if (!this.ctx || !this.sfxGain || !this.enabled) return;
    const t = this.ctx.currentTime;
    this.tone(220, t, 0.15, 0.09, 'sawtooth', this.sfxGain);
    this.tone(330, t + 0.12, 0.2, 0.07, 'sawtooth', this.sfxGain);
    this.tone(440, t + 0.28, 0.25, 0.06, 'triangle', this.sfxGain);
  }

  playWin() {
    if (!this.ctx || !this.sfxGain || !this.enabled) return;
    const t = this.ctx.currentTime;
    [392, 494, 587, 784].forEach((f, i) => {
      this.tone(f, t + i * 0.14, 0.28, 0.09, 'triangle', this.sfxGain!);
    });
  }
}
