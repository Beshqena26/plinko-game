const clamp01 = (v: number) => (isNaN(v) ? 0 : Math.max(0, Math.min(1, v)));

class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled = localStorage.getItem('plinko_sfx') !== 'false';
  private masterGain: GainNode | null = null;
  private music: HTMLAudioElement | null = null;
  private musicEnabled = localStorage.getItem('plinko_music') !== 'false';
  private musicVol = clamp01(parseFloat(localStorage.getItem('plinko_music_vol') ?? '0.3'));
  private sfxVol = clamp01(parseFloat(localStorage.getItem('plinko_sfx_vol') ?? '0.5'));

  private getMusic(): HTMLAudioElement {
    if (!this.music) {
      this.music = new Audio(import.meta.env.BASE_URL + 'bg-music.m4a');
      this.music.loop = true;
      this.music.volume = this.musicVol;
    }
    return this.music;
  }

  setMusicVolume(v: number) {
    this.musicVol = clamp01(v);
    localStorage.setItem('plinko_music_vol', String(this.musicVol));
    if (this.music) this.music.volume = this.musicVol;
  }

  getMusicVolume(): number {
    return this.musicVol;
  }

  getVolume(): number {
    return this.sfxVol;
  }

  // Browsers block audio until a user gesture — arm a one-shot listener that
  // starts the music on the first interaction if it's enabled.
  armMusicAutostart() {
    if (!this.musicEnabled) return;
    const start = () => {
      cleanup();
      if (this.musicEnabled) this.getMusic().play().catch(() => {});
    };
    const cleanup = () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
    window.addEventListener('pointerdown', start);
    window.addEventListener('keydown', start);
  }

  toggleMusic(): boolean {
    this.musicEnabled = !this.musicEnabled;
    localStorage.setItem('plinko_music', String(this.musicEnabled));
    if (this.musicEnabled) this.getMusic().play().catch(() => {});
    else this.music?.pause();
    return this.musicEnabled;
  }

  isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.sfxVol;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  private getDest(): AudioNode {
    this.getCtx();
    return this.masterGain!;
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    localStorage.setItem('plinko_sfx', String(this.enabled));
    return this.enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setVolume(v: number) {
    this.sfxVol = clamp01(v);
    localStorage.setItem('plinko_sfx_vol', String(this.sfxVol));
    if (this.masterGain) this.masterGain.gain.value = this.sfxVol;
  }

  // Subtle tick — pitch rises with progress, very short
  pinHit(progress: number) {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(this.getDest());
    osc.frequency.value = 1400 + progress * 600;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.012, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.03);
  }

  land(multiplier: number) {
    if (!this.enabled) return;
    const ctx = this.getCtx();

    if (multiplier < 1) {
      // Loss — subtle low tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(this.getDest());
      osc.frequency.value = 180;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
      return;
    }

    if (multiplier >= 50) {
      // MEGA WIN — epic ascending arpeggio
      [523, 659, 784, 1047, 1319, 1568].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(this.getDest());
        osc.frequency.value = freq;
        osc.type = 'sine';
        const t = ctx.currentTime + i * 0.07;
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.start(t);
        osc.stop(t + 0.35);
      });
    } else if (multiplier >= 10) {
      // Big win
      [523, 659, 784, 1047].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(this.getDest());
        osc.frequency.value = freq;
        osc.type = 'sine';
        const t = ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0.09, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.start(t);
        osc.stop(t + 0.25);
      });
    } else if (multiplier >= 3) {
      [659, 784, 1047].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(this.getDest());
        osc.frequency.value = freq;
        osc.type = 'sine';
        const t = ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0.07, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.start(t);
        osc.stop(t + 0.2);
      });
    } else {
      // Small win — single note
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(this.getDest());
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
    }
  }

  // Soft UI blip for hovering interactive chrome (lines rail etc.) — only on
  // devices that actually hover, so touch taps don't double-fire with click.
  uiHover() {
    if (!this.enabled) return;
    if (!window.matchMedia('(hover: hover)').matches) return;
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(this.getDest());
    osc.frequency.value = 1150;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.014, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.04);
  }

  // Crisp confirm tick for clicking UI controls
  uiClick() {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    [660, 990].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(this.getDest());
      osc.frequency.value = freq;
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.035;
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      osc.start(t);
      osc.stop(t + 0.07);
    });
  }

  drop() {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(this.getDest());
    osc.frequency.value = 440;
    osc.type = 'triangle';
    gain.gain.setValueAtTime(0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  }
}

export const sound = new SoundManager();
