/**
 * Procedural Web Audio soundtrack and effects for the game.
 *
 * There are deliberately no audio files and no AudioContext is created until
 * unlock() is called from a user gesture. Calling start() before unlock() only
 * remembers the request, so it is safe to construct this class on page load.
 */

export type SoundEffectName =
  | "shoot"
  | "hit"
  | "explosion"
  | "pickup"
  | "jump"
  | "hurt"
  | "ui"
  | "boss"
  | "victory"
  | "defeat";

export type MusicMode = "ride" | "boss";

export interface AudioSystemOptions {
  masterVolume?: number;
  musicVolume?: number;
  sfxVolume?: number;
}

type AudioContextConstructor = new () => AudioContext;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const midi = (note: number): number => 440 * 2 ** ((note - 69) / 12);

export class AudioSystem {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private readonly activeMusicSources = new Set<AudioScheduledSourceNode>();
  private readonly activeSfxSources = new Set<AudioScheduledSourceNode>();
  private schedulerId: number | null = null;
  private nextStepTime = 0;
  private songStep = 0;
  private requestedMusic = false;
  private paused = false;
  private mode: MusicMode = "ride";
  private bossEnergy = 0;
  private rideIntensity = 0.72;

  private masterLevel: number;
  private musicLevel: number;
  private sfxLevel: number;

  private readonly bpm = 148;
  private readonly scheduleAheadSeconds = 0.16;

  constructor(options: AudioSystemOptions = {}) {
    this.masterLevel = clamp01(options.masterVolume ?? 0.82);
    this.musicLevel = clamp01(options.musicVolume ?? 0.58);
    this.sfxLevel = clamp01(options.sfxVolume ?? 0.88);
  }

  /** True only after a successful user-gesture unlock. */
  get isUnlocked(): boolean {
    return this.context?.state === "running";
  }

  get isPlaying(): boolean {
    return this.requestedMusic && !this.paused && this.schedulerId !== null;
  }

  get musicMode(): MusicMode {
    return this.mode;
  }

  /**
   * Must be called directly from pointerdown/keydown/click. It is the only
   * method that creates the AudioContext, which prevents autoplay violations.
   */
  async unlock(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    if (!this.context) {
      const audioWindow = window as typeof window & {
        webkitAudioContext?: AudioContextConstructor;
      };
      const Context = window.AudioContext ?? audioWindow.webkitAudioContext;
      if (!Context) return false;
      this.context = new Context();
      this.buildMixer(this.context);
      this.noiseBuffer = this.makeNoiseBuffer(this.context);
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    const ready = this.context.state === "running";
    if (ready && this.requestedMusic && !this.paused) this.beginScheduler();
    return ready;
  }

  /**
   * Convenience gesture hook. It removes itself after a successful unlock.
   * Return value is a cleanup function for scene/component disposal.
   */
  bindUnlock(target: EventTarget = document): () => void {
    let disposed = false;
    const events: Array<keyof DocumentEventMap> = ["pointerdown", "keydown"];
    const onGesture = (): void => {
      void this.unlock().then((ready) => {
        if (ready) cleanup();
      });
    };
    const cleanup = (): void => {
      if (disposed) return;
      disposed = true;
      for (const event of events) target.removeEventListener(event, onGesture);
    };
    for (const event of events) {
      target.addEventListener(event, onGesture, { passive: true, once: false });
    }
    return cleanup;
  }

  /** Start or request music. This never unlocks audio by itself. */
  start(mode: MusicMode = this.mode): void {
    this.mode = mode;
    this.requestedMusic = true;
    this.paused = false;
    if (this.isUnlocked) this.beginScheduler();
  }

  /** Stop the soundtrack and rewind it; current one-shot SFX may finish. */
  stop(): void {
    this.requestedMusic = false;
    this.paused = false;
    this.stopScheduler();
    this.stopSources(this.activeMusicSources);
    this.songStep = 0;
    this.nextStepTime = 0;
    this.bossEnergy = 0;
  }

  /** Pause the whole mix. */
  async pause(): Promise<void> {
    this.paused = true;
    this.stopScheduler();
    if (this.context?.state === "running") await this.context.suspend();
  }

  /** Resume after pause. Call it from a user gesture on restrictive browsers. */
  async resume(): Promise<boolean> {
    if (!this.context) return false;
    if (this.context.state === "suspended") await this.context.resume();
    this.paused = false;
    if (this.context.state === "running" && this.requestedMusic) {
      this.nextStepTime = Math.max(this.nextStepTime, this.context.currentTime + 0.04);
      this.beginScheduler();
    }
    return this.context.state === "running";
  }

  /** Switch immediately; boss arrangement grows denser over its first bars. */
  setMusicMode(mode: MusicMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.bossEnergy = mode === "boss" ? 0 : this.bossEnergy;
    if (mode === "boss") this.sfx("boss", 1);
  }

  setBossMode(active: boolean): void {
    this.setMusicMode(active ? "boss" : "ride");
  }

  /** 0..1 changes the density of the normal riding arrangement. */
  setIntensity(value: number): void {
    this.rideIntensity = clamp01(value);
  }

  setMasterVolume(value: number): void {
    this.masterLevel = clamp01(value);
    this.smoothGain(this.masterGain, this.masterLevel);
  }

  setMusicVolume(value: number): void {
    this.musicLevel = clamp01(value);
    this.smoothGain(this.musicGain, this.musicLevel);
  }

  setSfxVolume(value: number): void {
    this.sfxLevel = clamp01(value);
    this.smoothGain(this.sfxGain, this.sfxLevel);
  }

  /** Play a synthesized one-shot. Safe no-op before unlock. */
  sfx(name: SoundEffectName, intensity = 1): boolean {
    const context = this.context;
    if (!context || context.state !== "running" || !this.sfxGain) return false;
    const output = this.sfxGain;
    const amount = Math.max(0.05, Math.min(1.5, intensity));
    const now = context.currentTime + 0.006;

    switch (name) {
      case "shoot":
        this.tone(now, 0.095, 760 + amount * 160, 165, "square", 0.11 * amount, output, false);
        this.noise(now, 0.035, 0.025 * amount, 4200, "highpass", output, false);
        break;
      case "hit":
        this.noise(now, 0.075, 0.115 * amount, 2400, "bandpass", output, false);
        this.tone(now, 0.055, 190, 105, "square", 0.065 * amount, output, false);
        break;
      case "explosion":
        this.noise(now, 0.34 + amount * 0.16, 0.23 * amount, 650, "lowpass", output, false);
        this.noise(now + 0.025, 0.18, 0.09 * amount, 2100, "bandpass", output, false);
        this.tone(now, 0.4, 105, 34, "sawtooth", 0.15 * amount, output, false);
        break;
      case "pickup":
        [76, 81, 88].forEach((note, index) =>
          this.tone(now + index * 0.065, 0.11, midi(note), midi(note + 5), "square", 0.075 * amount, output, false),
        );
        break;
      case "jump":
        this.tone(now, 0.19, 185, 510, "square", 0.095 * amount, output, false);
        break;
      case "hurt":
        this.tone(now, 0.25, 250, 72, "sawtooth", 0.13 * amount, output, false);
        this.noise(now, 0.12, 0.06 * amount, 1350, "bandpass", output, false);
        break;
      case "ui":
        this.tone(now, 0.055, 620, 880, "square", 0.055 * amount, output, false);
        break;
      case "boss":
        this.tone(now, 0.7, midi(37), midi(25), "sawtooth", 0.18 * amount, output, false);
        this.tone(now + 0.09, 0.62, midi(38), midi(26), "square", 0.08 * amount, output, false);
        this.noise(now, 0.5, 0.08 * amount, 480, "lowpass", output, false);
        break;
      case "victory": {
        const fanfare = [64, 67, 71, 76, 71, 79];
        fanfare.forEach((note, index) =>
          this.tone(now + index * 0.115, index === fanfare.length - 1 ? 0.55 : 0.15, midi(note), midi(note), "square", 0.085 * amount, output, false),
        );
        break;
      }
      case "defeat":
        [52, 51, 47, 40].forEach((note, index) =>
          this.tone(now + index * 0.16, 0.25, midi(note), midi(note - 2), "triangle", 0.09 * amount, output, false),
        );
        break;
    }
    return true;
  }

  /** Release all browser audio resources. */
  async destroy(): Promise<void> {
    this.stop();
    this.stopSources(this.activeSfxSources);
    const context = this.context;
    this.context = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.noiseBuffer = null;
    if (context && context.state !== "closed") await context.close();
  }

  private buildMixer(context: AudioContext): void {
    const master = context.createGain();
    const music = context.createGain();
    const sfx = context.createGain();
    const compressor = context.createDynamicsCompressor();

    master.gain.value = this.masterLevel;
    music.gain.value = this.musicLevel;
    sfx.gain.value = this.sfxLevel;
    compressor.threshold.value = -13;
    compressor.knee.value = 9;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.16;

    music.connect(master);
    sfx.connect(master);
    master.connect(compressor);
    compressor.connect(context.destination);
    this.masterGain = master;
    this.musicGain = music;
    this.sfxGain = sfx;
  }

  private makeNoiseBuffer(context: AudioContext): AudioBuffer {
    const length = Math.ceil(context.sampleRate * 2);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      previous = previous * 0.22 + white * 0.78;
      data[index] = previous;
    }
    return buffer;
  }

  private beginScheduler(): void {
    const context = this.context;
    if (!context || !this.musicGain || this.schedulerId !== null || this.paused) return;
    if (this.nextStepTime < context.currentTime) this.nextStepTime = context.currentTime + 0.06;
    this.schedulerId = window.setInterval(() => this.scheduleWindow(), 25);
    this.scheduleWindow();
  }

  private stopScheduler(): void {
    if (this.schedulerId === null) return;
    window.clearInterval(this.schedulerId);
    this.schedulerId = null;
  }

  private scheduleWindow(): void {
    const context = this.context;
    if (!context || context.state !== "running" || !this.requestedMusic || this.paused) return;
    const stepDuration = 60 / this.bpm / 4;
    while (this.nextStepTime < context.currentTime + this.scheduleAheadSeconds) {
      this.scheduleMusicStep(this.songStep, this.nextStepTime, stepDuration);
      this.songStep += 1;
      this.nextStepTime += stepDuration;
    }
  }

  private scheduleMusicStep(absoluteStep: number, time: number, stepDuration: number): void {
    const output = this.musicGain;
    if (!output) return;
    const step = absoluteStep % 16;
    const bar = Math.floor(absoluteStep / 16);
    const intro = bar < 2;
    const boss = this.mode === "boss";
    const energy = boss ? Math.min(1, this.bossEnergy + 0.012) : this.rideIntensity;
    if (boss) this.bossEnergy = energy;

    // Drums: the boss adds double-kicks and constant hats as its energy rises.
    const kickSteps = boss && energy > 0.42 ? [0, 3, 6, 8, 10, 14] : [0, 6, 8, 14];
    if (kickSteps.includes(step)) this.kick(time, boss ? 0.18 : 0.145, output);
    if (step === 4 || step === 12) this.snare(time, boss ? 0.15 : 0.125, output);
    if (step % (boss && energy > 0.68 ? 1 : 2) === 0) {
      this.hat(time, step % 4 === 2 ? 0.035 : 0.024, output);
    }

    const roadRoots = [40, 40, 36, 38, 40, 43, 38, 35]; // E, C, D, E, G, D, B
    const bossRoots = [40, 41, 38, 35];
    const root = boss ? bossRoots[bar % bossRoots.length] : roadRoots[bar % roadRoots.length];

    if (step % 2 === 0) {
      const bassPattern = boss ? [0, 0, 12, 0, 3, 0, 10, 0] : [0, 0, 7, 0, 12, 7, 3, 0];
      const note = root - 12 + bassPattern[(step / 2) % bassPattern.length];
      this.bass(time, stepDuration * 1.7, midi(note), boss ? 0.105 : 0.085, output);
    }

    if (!intro && [0, 5, 8, 11, 14].includes(step)) {
      const accent = step === 0 || step === 8;
      this.powerChord(time, accent ? stepDuration * 3.2 : stepDuration * 1.45, midi(root), boss ? 0.07 : 0.056, output);
    } else if (intro && [0, 8].includes(step)) {
      this.powerChord(time, stepDuration * 5.5, midi(root), 0.045, output);
    }

    // Alternating lead phrases make the ride feel like distinct A/B sections.
    if (!intro && !boss && bar % 4 >= 2) {
      const lead = [64, -1, 67, 69, -1, 71, 69, 67, 64, -1, 62, 64, 67, 64, 62, -1];
      const note = lead[step];
      if (note >= 0 && (this.rideIntensity > 0.45 || step % 2 === 0)) {
        this.lead(time, stepDuration * 0.82, midi(note + (bar % 8 >= 4 ? 3 : 0)), 0.037, output);
      }
    }

    if (boss) {
      const bossLead = [76, 75, 72, -1, 70, 72, 75, -1, 79, 78, 75, 72, 70, -1, 66, 67];
      const note = bossLead[step];
      if (note >= 0 && (energy > 0.26 || step % 2 === 0)) {
        this.lead(time, stepDuration * 0.72, midi(note), 0.035 + energy * 0.014, output);
      }
      if (step === 15 && bar % 2 === 1 && energy > 0.55) {
        this.tone(time, stepDuration * 0.9, midi(59), midi(71), "sawtooth", 0.045, output, true);
      }
    }
  }

  private kick(time: number, volume: number, output: AudioNode): void {
    this.tone(time, 0.16, 145, 43, "sine", volume, output, true);
    this.noise(time, 0.025, volume * 0.22, 3400, "lowpass", output, true);
  }

  private snare(time: number, volume: number, output: AudioNode): void {
    this.noise(time, 0.13, volume, 1850, "bandpass", output, true);
    this.tone(time, 0.08, 190, 125, "triangle", volume * 0.34, output, true);
  }

  private hat(time: number, volume: number, output: AudioNode): void {
    this.noise(time, 0.045, volume, 6800, "highpass", output, true);
  }

  private bass(time: number, duration: number, frequency: number, volume: number, output: AudioNode): void {
    const context = this.context;
    if (!context) return;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 680;
    filter.Q.value = 2.2;
    filter.connect(output);
    this.tone(time, duration, frequency, frequency * 0.995, "sawtooth", volume, filter, true);
  }

  private powerChord(time: number, duration: number, root: number, volume: number, output: AudioNode): void {
    const context = this.context;
    if (!context) return;
    const shaper = context.createWaveShaper();
    const filter = context.createBiquadFilter();
    shaper.curve = this.distortionCurve(72);
    shaper.oversample = "2x";
    filter.type = "lowpass";
    filter.frequency.value = this.mode === "boss" ? 3300 : 2750;
    filter.Q.value = 0.7;
    shaper.connect(filter);
    filter.connect(output);
    [1, 1.5, 2].forEach((ratio, index) => {
      this.tone(time + index * 0.004, duration, root * ratio, root * ratio * 0.992, "sawtooth", volume / (index + 1.3), shaper, true);
    });
  }

  private lead(time: number, duration: number, frequency: number, volume: number, output: AudioNode): void {
    const context = this.context;
    if (!context) return;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = Math.min(4200, frequency * 2.8);
    filter.Q.value = 0.8;
    filter.connect(output);
    this.tone(time, duration, frequency, frequency * 1.006, "square", volume, filter, true);
    this.tone(time, duration, frequency * 0.502, frequency * 0.505, "sawtooth", volume * 0.36, filter, true);
  }

  private tone(
    time: number,
    duration: number,
    startFrequency: number,
    endFrequency: number,
    type: OscillatorType,
    volume: number,
    output: AudioNode,
    music: boolean,
  ): void {
    const context = this.context;
    if (!context) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const attack = Math.min(0.012, duration * 0.18);
    const end = time + duration;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, startFrequency), time);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), end);
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), time + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(envelope);
    envelope.connect(output);
    this.track(oscillator, music);
    oscillator.start(time);
    oscillator.stop(end + 0.02);
  }

  private noise(
    time: number,
    duration: number,
    volume: number,
    frequency: number,
    filterType: BiquadFilterType,
    output: AudioNode,
    music: boolean,
  ): void {
    const context = this.context;
    if (!context || !this.noiseBuffer) return;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    const end = time + duration;
    source.buffer = this.noiseBuffer;
    source.playbackRate.value = 0.92 + Math.random() * 0.18;
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = filterType === "bandpass" ? 1.15 : 0.45;
    envelope.gain.setValueAtTime(Math.max(0.0002, volume), time);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(output);
    this.track(source, music);
    const maxOffset = Math.max(0, this.noiseBuffer.duration - duration - 0.02);
    source.start(time, Math.random() * maxOffset);
    source.stop(end + 0.02);
  }

  private track(source: AudioScheduledSourceNode, music: boolean): void {
    const set = music ? this.activeMusicSources : this.activeSfxSources;
    set.add(source);
    source.addEventListener("ended", () => set.delete(source), { once: true });
  }

  private stopSources(sources: Set<AudioScheduledSourceNode>): void {
    for (const source of sources) {
      try {
        source.stop();
      } catch {
        // A source that ended between iteration and stop is already harmless.
      }
    }
    sources.clear();
  }

  private smoothGain(node: GainNode | null, value: number): void {
    const context = this.context;
    if (!node || !context) return;
    node.gain.cancelScheduledValues(context.currentTime);
    node.gain.setTargetAtTime(value, context.currentTime, 0.025);
  }

  private distortionCurve(amount: number): Float32Array<ArrayBuffer> {
    const samples = 256;
    const curve = new Float32Array(samples);
    const radians = Math.PI / 180;
    for (let index = 0; index < samples; index += 1) {
      const x = (index * 2) / samples - 1;
      curve[index] = ((3 + amount) * x * 20 * radians) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }
}

export const audio = new AudioSystem();
export default AudioSystem;
