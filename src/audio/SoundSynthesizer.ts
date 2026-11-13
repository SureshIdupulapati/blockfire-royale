/**
 * Procedural Sound Synthesizer using Web Audio API.
 * Synthesizes dynamic weapon sounds, impacts, hitmarkers, Free Fire abilities,
 * and Battle Royale victory fanfares without external audio asset downloads.
 */

export class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;

  constructor() {
    // AudioContext will be initialized on first user interaction to comply with browser autoplay policy
  }

  public init(): void {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
  }

  public resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.5, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  private createNoiseBuffer(duration: number = 0.5): AudioBuffer | null {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Rifle gunshot sound (M416, AK47, SMG)
   */
  public playGunshot(type: 'rifle' | 'heavy_rifle' | 'smg' | 'sniper' | 'shotgun'): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;

    // Pitch & duration configs
    let pitch = 140;
    let punchDuration = 0.08;
    let noiseFilterFreq = 2200;
    let decayDuration = 0.25;

    switch (type) {
      case 'heavy_rifle': // AK47
        pitch = 110;
        punchDuration = 0.12;
        noiseFilterFreq = 1800;
        decayDuration = 0.35;
        break;
      case 'smg': // MP40
        pitch = 200;
        punchDuration = 0.05;
        noiseFilterFreq = 3000;
        decayDuration = 0.18;
        break;
      case 'sniper': // AWM
        pitch = 80;
        punchDuration = 0.2;
        noiseFilterFreq = 1200;
        decayDuration = 0.65;
        break;
      case 'shotgun':
        pitch = 95;
        punchDuration = 0.15;
        noiseFilterFreq = 1500;
        decayDuration = 0.4;
        break;
    }

    // 1. Low frequency thump (sine wave punch)
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(pitch * 2, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + punchDuration);

    oscGain.gain.setValueAtTime(0.8, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + punchDuration);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + punchDuration);

    // 2. High frequency noise blast
    const noiseBuffer = this.createNoiseBuffer(decayDuration);
    if (noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(noiseFilterFreq, now);
      filter.Q.setValueAtTime(1.5, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.7, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + decayDuration);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.masterGain);
      noise.start(now);
      noise.stop(now + decayDuration);
    }
  }

  /**
   * Hitmarker confirmation click
   */
  public playHitmarker(isHeadshot: boolean = false): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    const freq = isHeadshot ? 1600 : 1000;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.05);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  /**
   * Free Fire Gloo Wall deployment sound (crystal freeze sweep)
   */
  public playGlooDeploy(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;

    // Upward glassy sweep
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(1800, now + 0.3);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.35);

    // Chime resonance
    const chime = this.ctx.createOscillator();
    const chimeGain = this.ctx.createGain();
    chime.type = 'triangle';
    chime.frequency.setValueAtTime(1200, now + 0.1);
    chime.frequency.linearRampToValueAtTime(800, now + 0.4);
    chimeGain.gain.setValueAtTime(0.3, now + 0.1);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    chime.connect(chimeGain);
    chimeGain.connect(this.masterGain);
    chime.start(now + 0.1);
    chime.stop(now + 0.45);
  }

  /**
   * Free Fire "Drop The Beat" Skill activation
   */
  public playSkillActivate(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.2);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.4);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  /**
   * Minecraft pickaxe mining block sound
   */
  public playMineBlock(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(150 + Math.random() * 50, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  /**
   * Block placement sound
   */
  public playPlaceBlock(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(250, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.09);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  /**
   * Weapon Reload sound
   */
  public playReload(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;

    // Mag out click
    const click1 = this.ctx.createOscillator();
    const g1 = this.ctx.createGain();
    click1.type = 'triangle';
    click1.frequency.setValueAtTime(700, now);
    click1.frequency.exponentialRampToValueAtTime(300, now + 0.05);
    g1.gain.setValueAtTime(0.3, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    click1.connect(g1);
    g1.connect(this.masterGain);
    click1.start(now);
    click1.stop(now + 0.05);

    // Mag in click
    const click2 = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    click2.type = 'square';
    click2.frequency.setValueAtTime(450, now + 0.25);
    click2.frequency.exponentialRampToValueAtTime(900, now + 0.32);
    g2.gain.setValueAtTime(0.3, now + 0.25);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    click2.connect(g2);
    g2.connect(this.masterGain);
    click2.start(now + 0.25);
    click2.stop(now + 0.35);
  }

  /**
   * Zone boundary damage / warning siren
   */
  public playZoneWarning(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.linearRampToValueAtTime(250, now + 0.15);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  /**
   * Free Fire "BOOYAH!" Victory Fanfare
   */
  public playBooyahFanfare(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99]; // C Major chord progression
    const noteDuration = 0.18;

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const startTime = now + idx * noteDuration;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = idx === notes.length - 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      const dur = idx === notes.length - 1 ? 1.0 : noteDuration * 0.9;
      gain.gain.setValueAtTime(0.4, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(startTime);
      osc.stop(startTime + dur);
    });
  }

  /**
   * Explosive blast
   */
  public playExplosion(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;
    // Sub-bass thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.6);

    gain.gain.setValueAtTime(1.0, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.65);
  }

  /**
   * Player hurt / bullet impact impact sound
   */
  public playPlayerHurt(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.18);

    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }
}

