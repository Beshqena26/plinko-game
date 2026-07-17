const clamp01 = (v: number) => (isNaN(v) ? 0 : Math.max(0, Math.min(1, v)));

// Game SFX are mixed quiet at the source — boost the master output so the
// slider's range feels right (100% ≈ 1.4x raw gain; tiny sines never clip).
const SFX_BOOST = 1.4;

class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled = localStorage.getItem('plinko_sfx') !== 'false';
  private masterGain: GainNode | null = null;
  private music: HTMLAudioElement | null = null;
  private musicGain: GainNode | null = null;
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

  // iOS ignores HTMLMediaElement.volume (hardware buttons only) — route the
  // music through a WebAudio gain node so the volume slider works everywhere.
  private wireMusicThroughCtx() {
    if (this.musicGain) return;
    try {
      const ctx = this.getCtx();
      const el = this.getMusic();
      const src = ctx.createMediaElementSource(el);
      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = this.musicVol;
      src.connect(this.musicGain);
      this.musicGain.connect(ctx.destination);
      el.volume = 1; // gain node owns the level now — avoid double attenuation
    } catch {
      /* unsupported — element.volume fallback stays in effect */
    }
  }

  setMusicVolume(v: number) {
    this.musicVol = clamp01(v);
    localStorage.setItem('plinko_music_vol', String(this.musicVol));
    if (this.musicGain) this.musicGain.gain.value = this.musicVol;
    else if (this.music) this.music.volume = this.musicVol;
  }

  getMusicVolume(): number {
    return this.musicVol;
  }

  getVolume(): number {
    return this.sfxVol;
  }

  // Start the music immediately if the browser allows it (returning visitors
  // usually can); when autoplay is blocked, fall back to the first gesture.
  // The gesture listener also re-kicks the AudioContext in case it started
  // suspended (music routes through it for iOS-proof volume control).
  armMusicAutostart() {
    if (!this.musicEnabled) return;
    const kick = () => {
      this.wireMusicThroughCtx();
      this.getCtx(); // resumes a suspended context when allowed
      if (this.musicEnabled) this.getMusic().play().catch(() => {});
    };
    kick();
    const onGesture = () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      kick();
    };
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
  }

  toggleMusic(): boolean {
    this.musicEnabled = !this.musicEnabled;
    localStorage.setItem('plinko_music', String(this.musicEnabled));
    if (this.musicEnabled) {
      this.wireMusicThroughCtx();
      this.getCtx();
      this.getMusic().play().catch(() => {});
    } else {
      this.music?.pause();
    }
    return this.musicEnabled;
  }

  isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.sfxVol * SFX_BOOST;
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
    if (this.masterGain) this.masterGain.gain.value = this.sfxVol * SFX_BOOST;
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
