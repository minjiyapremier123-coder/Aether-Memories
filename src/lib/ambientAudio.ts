// Aether Memories Procedural Ambient Soundscape Engine
// Synthesizes high-quality immersive environments in real-time via the Web Audio API.

export type SoundscapePreset = 'rain' | 'library' | 'ocean' | 'cosmic' | 'off';

class AmbientEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private currentPreset: SoundscapePreset = 'off';
  private isActive: boolean = false;
  private volume: number = 0.35; // default volume (0 to 1)

  // Nodes for Ocean
  private oceanSource: AudioBufferSourceNode | null = null;
  private oceanFilter: BiquadFilterNode | null = null;
  private oceanGain: GainNode | null = null;
  private oceanLfo: OscillatorNode | null = null;
  private oceanLfoGain: GainNode | null = null;

  // Nodes for Rain
  private rainSource: AudioBufferSourceNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  private rainGain: GainNode | null = null;
  private rainTimer: any = null;

  // Nodes for Library (Warm hearth, vintage vinyl, soft drone)
  private libraryDrones: OscillatorNode[] = [];
  private libraryDroneGains: GainNode[] = [];
  private libraryDroneFilter: BiquadFilterNode | null = null;
  private libraryDroneLfos: OscillatorNode[] = [];
  private libraryCrackleSource: AudioBufferSourceNode | null = null;
  private libraryCrackleGain: GainNode | null = null;

  // Nodes for Cosmic
  private cosmicOscillators: OscillatorNode[] = [];
  private cosmicGains: GainNode[] = [];
  private cosmicFilter: BiquadFilterNode | null = null;
  private cosmicLfos: OscillatorNode[] = [];
  private cosmicDelay: DelayNode | null = null;
  private cosmicDelayFeedback: GainNode | null = null;

  constructor() {
    // Initialized lazily on first user interaction to satisfy browser autoplay policies
  }

  private initContext() {
    if (this.ctx) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.error("Failed to initialize Web Audio API:", e);
    }
  }

  // Helper to generate a 2-second white noise buffer
  private createNoiseBuffer(): AudioBuffer {
    if (!this.ctx) throw new Error("AudioContext not initialized");
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.1);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public getPreset(): SoundscapePreset {
    return this.currentPreset;
  }

  public async start(preset: SoundscapePreset) {
    this.initContext();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    if (this.currentPreset === preset && this.isActive) return;
    this.stopAll();

    this.currentPreset = preset;
    this.isActive = true;

    if (preset === 'rain') {
      this.startRain();
    } else if (preset === 'library') {
      this.startLibrary();
    } else if (preset === 'ocean') {
      this.startOcean();
    } else if (preset === 'cosmic') {
      this.startCosmic();
    } else {
      this.isActive = false;
    }
  }

  public stop() {
    this.stopAll();
    this.currentPreset = 'off';
    this.isActive = false;
  }

  private stopAll() {
    if (!this.ctx) return;

    // Stop Ocean
    try {
      if (this.oceanSource) this.oceanSource.stop();
      if (this.oceanLfo) this.oceanLfo.stop();
    } catch (e) {}
    this.oceanSource = null;
    this.oceanFilter = null;
    this.oceanGain = null;
    this.oceanLfo = null;
    this.oceanLfoGain = null;

    // Stop Rain
    try {
      if (this.rainSource) this.rainSource.stop();
    } catch (e) {}
    if (this.rainTimer) {
      clearInterval(this.rainTimer);
      this.rainTimer = null;
    }
    this.rainSource = null;
    this.rainFilter = null;
    this.rainGain = null;

    // Stop Library
    this.libraryDrones.forEach(osc => { try { osc.stop(); } catch (e) {} });
    this.libraryDroneLfos.forEach(lfo => { try { lfo.stop(); } catch (e) {} });
    try {
      if (this.libraryCrackleSource) this.libraryCrackleSource.stop();
    } catch (e) {}
    this.libraryDrones = [];
    this.libraryDroneGains = [];
    this.libraryDroneFilter = null;
    this.libraryDroneLfos = [];
    this.libraryCrackleSource = null;
    this.libraryCrackleGain = null;

    // Stop Cosmic
    this.cosmicOscillators.forEach(osc => { try { osc.stop(); } catch (e) {} });
    this.cosmicLfos.forEach(lfo => { try { lfo.stop(); } catch (e) {} });
    this.cosmicOscillators = [];
    this.cosmicGains = [];
    this.cosmicFilter = null;
    this.cosmicLfos = [];
    this.cosmicDelay = null;
    this.cosmicDelayFeedback = null;
  }

  // --- Rain Preset ---
  private startRain() {
    if (!this.ctx || !this.masterGain) return;

    // 1. Continuous steady rain (lowpass white noise)
    const noiseBuffer = this.createNoiseBuffer();
    this.rainSource = this.ctx.createBufferSource();
    this.rainSource.buffer = noiseBuffer;
    this.rainSource.loop = true;

    this.rainFilter = this.ctx.createBiquadFilter();
    this.rainFilter.type = 'lowpass';
    this.rainFilter.frequency.setValueAtTime(800, this.ctx.currentTime);
    this.rainFilter.Q.setValueAtTime(1.0, this.ctx.currentTime);

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.setValueAtTime(0.5, this.ctx.currentTime);

    this.rainSource.connect(this.rainFilter);
    this.rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.masterGain);
    this.rainSource.start();

    // 2. Dynamic raindrop patters (procedural clicks/drips)
    const playRaindrop = () => {
      if (!this.ctx || !this.masterGain || this.currentPreset !== 'rain') return;

      const osc = this.ctx.createOscillator();
      const dripGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // High pitch drop element
      osc.type = 'sine';
      const startFreq = 1200 + Math.random() * 800;
      osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150 + Math.random() * 100, this.ctx.currentTime + 0.08);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
      filter.Q.setValueAtTime(4, this.ctx.currentTime);

      dripGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
      dripGain.gain.linearRampToValueAtTime(0.08 + Math.random() * 0.07, this.ctx.currentTime + 0.005);
      dripGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.09);

      osc.connect(filter);
      filter.connect(dripGain);
      dripGain.connect(this.masterGain);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    };

    // Spawn raindrops at semi-random intervals
    this.rainTimer = setInterval(() => {
      const dripsCount = Math.floor(Math.random() * 4) + 1;
      for (let i = 0; i < dripsCount; i++) {
        setTimeout(playRaindrop, Math.random() * 180);
      }
    }, 200);
  }

  // --- Ocean Waves Preset ---
  private startOcean() {
    if (!this.ctx || !this.masterGain) return;

    // 1. Noise base
    const noiseBuffer = this.createNoiseBuffer();
    this.oceanSource = this.ctx.createBufferSource();
    this.oceanSource.buffer = noiseBuffer;
    this.oceanSource.loop = true;

    this.oceanFilter = this.ctx.createBiquadFilter();
    this.oceanFilter.type = 'lowpass';
    this.oceanFilter.frequency.setValueAtTime(320, this.ctx.currentTime);

    this.oceanGain = this.ctx.createGain();
    this.oceanGain.gain.setValueAtTime(0.05, this.ctx.currentTime);

    this.oceanSource.connect(this.oceanFilter);
    this.oceanFilter.connect(this.oceanGain);
    this.oceanGain.connect(this.masterGain);
    this.oceanSource.start();

    // 2. Slow LFO (0.07 Hz) to modulate volume and filter cutoff to simulate waves
    this.oceanLfo = this.ctx.createOscillator();
    this.oceanLfo.type = 'sine';
    this.oceanLfo.frequency.setValueAtTime(0.065, this.ctx.currentTime); // ~15 seconds cycle

    this.oceanLfoGain = this.ctx.createGain();
    this.oceanLfoGain.gain.setValueAtTime(0.12, this.ctx.currentTime); // scale output

    // Direct connections to control gain and cutoff
    this.oceanLfo.connect(this.oceanLfoGain);
    this.oceanLfoGain.connect(this.oceanGain.gain); // modulates volume
    
    // Also modulate filter frequency
    const filterMod = this.ctx.createGain();
    filterMod.gain.setValueAtTime(250, this.ctx.currentTime);
    this.oceanLfo.connect(filterMod);
    filterMod.connect(this.oceanFilter.frequency);

    this.oceanLfo.start();
  }

  // --- Warm Library Preset (Crackling hearth, soft drone) ---
  private startLibrary() {
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;

    // 1. Cozy warm harmonic chords (mellow drone)
    // Chord frequencies: A1 (55Hz), E2 (82.4Hz), A2 (110Hz), C#3 (138.6Hz)
    const chord = [55.0, 82.4, 110.0, 138.6];
    
    this.libraryDroneFilter = this.ctx.createBiquadFilter();
    this.libraryDroneFilter.type = 'lowpass';
    this.libraryDroneFilter.frequency.setValueAtTime(140, t); // Super warm and muffled

    chord.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      
      // Detune slightly for lush chorusing
      osc.detune.setValueAtTime((Math.random() * 2 - 1) * 8, t);

      // Muffled drone gain
      const baseGain = idx === 0 ? 0.35 : 0.18;
      gainNode.gain.setValueAtTime(baseGain, t);

      // Create a slow LFO to modulate individual chord voice volume
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.05 + idx * 0.02, t);
      lfoGain.gain.setValueAtTime(baseGain * 0.4, t);

      lfo.connect(lfoGain);
      lfoGain.connect(gainNode.gain);

      osc.connect(this.libraryDroneFilter);
      this.libraryDroneFilter.connect(gainNode);
      gainNode.connect(this.masterGain!);

      osc.start();
      lfo.start();

      this.libraryDrones.push(osc);
      this.libraryDroneLfos.push(lfo);
      this.libraryDroneGains.push(gainNode);
    });

    // 2. Procedural vintage fireplace crackle
    const noiseBuffer = this.createNoiseBuffer();
    this.libraryCrackleSource = this.ctx.createBufferSource();
    this.libraryCrackleSource.buffer = noiseBuffer;
    this.libraryCrackleSource.loop = true;

    const crackleFilter = this.ctx.createBiquadFilter();
    crackleFilter.type = 'highpass';
    crackleFilter.frequency.setValueAtTime(4000, t); // only high-frequency crackle clicks

    this.libraryCrackleGain = this.ctx.createGain();
    this.libraryCrackleGain.gain.setValueAtTime(0.003, t); // extremely quiet background crackle

    // Add intermittent louder embers popping
    this.libraryCrackleSource.connect(crackleFilter);
    crackleFilter.connect(this.libraryCrackleGain);
    this.libraryCrackleGain.connect(this.masterGain);
    this.libraryCrackleSource.start();

    // Ember pop sequencer
    const playEmberPop = () => {
      if (!this.ctx || !this.masterGain || this.currentPreset !== 'library') return;
      
      const popOsc = this.ctx.createOscillator();
      const popGain = this.ctx.createGain();
      const popFilter = this.ctx.createBiquadFilter();

      popOsc.type = 'triangle';
      popOsc.frequency.setValueAtTime(100 + Math.random() * 300, this.ctx.currentTime);

      popFilter.type = 'bandpass';
      popFilter.frequency.setValueAtTime(300 + Math.random() * 200, this.ctx.currentTime);
      popFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);

      popGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
      popGain.gain.linearRampToValueAtTime(0.06 + Math.random() * 0.06, this.ctx.currentTime + 0.002);
      popGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.02 + Math.random() * 0.03);

      popOsc.connect(popFilter);
      popFilter.connect(popGain);
      popGain.connect(this.masterGain);

      popOsc.start();
      popOsc.stop(this.ctx.currentTime + 0.1);
    };

    this.rainTimer = setInterval(() => {
      if (Math.random() > 0.4) {
        playEmberPop();
      }
    }, 600);
  }

  // --- Cosmic Serenity Preset (Sweeping space pads + delay feedback) ---
  private startCosmic() {
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;

    // Cozy choral intervals: G2 (98Hz), D3 (146.8Hz), G3 (196Hz), B3 (246.9Hz)
    const chord = [98.0, 146.8, 196.0, 246.9];

    this.cosmicFilter = this.ctx.createBiquadFilter();
    this.cosmicFilter.type = 'lowpass';
    this.cosmicFilter.frequency.setValueAtTime(650, t);

    // Filter LFO sweeps
    const filterLfo = this.ctx.createOscillator();
    filterLfo.type = 'sine';
    filterLfo.frequency.setValueAtTime(0.08, t); // slow sweep
    const filterLfoGain = this.ctx.createGain();
    filterLfoGain.gain.setValueAtTime(280, t);

    filterLfo.connect(filterLfoGain);
    filterLfoGain.connect(this.cosmicFilter.frequency);
    filterLfo.start();
    this.cosmicLfos.push(filterLfo);

    // Multi-tap Space Delay Node
    this.cosmicDelay = this.ctx.createDelay(2.0);
    this.cosmicDelay.delayTime.setValueAtTime(0.65, t); // 650ms delay echo

    this.cosmicDelayFeedback = this.ctx.createGain();
    this.cosmicDelayFeedback.gain.setValueAtTime(0.62, t); // high feedback echo

    // Feedback Loop Connection
    this.cosmicDelay.connect(this.cosmicDelayFeedback);
    this.cosmicDelayFeedback.connect(this.cosmicDelay);

    chord.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.detune.setValueAtTime((Math.random() * 2 - 1) * 12, t); // rich chorusing

      const baseGain = idx === 0 ? 0.35 : 0.16;
      gainNode.gain.setValueAtTime(baseGain, t);

      // Volume sweep
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.04 + idx * 0.015, t);
      lfoGain.gain.setValueAtTime(baseGain * 0.5, t);

      lfo.connect(lfoGain);
      lfoGain.connect(gainNode.gain);

      osc.connect(this.cosmicFilter);
      osc.start();
      lfo.start();

      this.cosmicOscillators.push(osc);
      this.cosmicLfos.push(lfo);
      this.cosmicGains.push(gainNode);
    });

    // Connect filter output to dry output AND space delay
    const dryGain = this.ctx.createGain();
    dryGain.gain.setValueAtTime(0.4, t);
    this.cosmicFilter.connect(dryGain);
    dryGain.connect(this.masterGain);

    const wetGain = this.ctx.createGain();
    wetGain.gain.setValueAtTime(0.35, t);
    this.cosmicFilter.connect(this.cosmicDelay);
    this.cosmicDelay.connect(wetGain);
    wetGain.connect(this.masterGain);
  }
}

// Export singleton instance so background soundscape is unified across tabs & clicks!
export const ambientAudio = new AmbientEngine();
