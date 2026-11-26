/* =========================================================
   SLINGSHOT DUMMY — 8-Bit Arcade Pinball Audio Synthesizer
   Zero external audio files; crisp Web Audio chiptune + SFX!
   ========================================================= */

(function () {
  class SlingAudio {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.bgmTimer = null;
      this.bgmStep = 0;
      this.currentTheme = 0;
    }

    init() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }

    toggleMute() {
      this.muted = !this.muted;
      if (this.muted) this.stopBGM();
      else this.startBGM(this.currentTheme);
      return this.muted;
    }

    _tone(freq, dur, type = 'square', vol = 0.08, slideTo = null, delay = 0) {
      if (this.muted || !this.ctx) return;
      const now = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(40, freq), now);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), now + dur);
      }
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.015);
    }

    playStretch(ratio) {
      this._tone(160 + ratio * 220, 0.045, 'triangle', 0.045);
    }

    playLaunch(power) {
      this._tone(190, 0.14, 'sawtooth', 0.11, 520 + power * 280);
      this._tone(110, 0.12, 'triangle', 0.09, 260, 0.02);
    }

    playWallBounce(speedRatio = 0.6) {
      const f = 140 + Math.min(1, speedRatio) * 160;
      this._tone(f, 0.06, 'triangle', 0.07, f * 0.72);
    }

    playBumper(combo = 1) {
      const base = 360 * Math.pow(1.08, Math.min(10, combo));
      this._tone(base, 0.09, 'square', 0.09, base * 1.45);
      this._tone(base * 1.5, 0.11, 'triangle', 0.07, base * 1.9, 0.03);
    }

    playSmash(combo = 1) {
      const base = 420 * Math.pow(1.11, Math.min(10, combo));
      this._tone(base, 0.08, 'square', 0.1, base * 1.25);
      this._tone(base * 1.25, 0.12, 'square', 0.09, base * 1.65, 0.04);
    }

    playBomb() {
      this._tone(160, 0.28, 'sawtooth', 0.14, 38);
      this._tone(95, 0.32, 'square', 0.11, 32, 0.03);
    }

    playPortal() {
      this._tone(320, 0.15, 'sine', 0.09, 980);
      this._tone(640, 0.12, 'triangle', 0.07, 420, 0.05);
    }

    playBoost() {
      this._tone(280, 0.13, 'sawtooth', 0.09, 880);
    }

    playBossHit() {
      this._tone(210, 0.12, 'square', 0.12, 95);
      this._tone(520, 0.1, 'square', 0.08, 760, 0.04);
    }

    playDeath() {
      this._tone(360, 0.12, 'sawtooth', 0.11, 120);
      this._tone(220, 0.24, 'square', 0.1, 68, 0.1);
    }

    playTrollLaugh() {
      [520, 440, 520, 390, 480].forEach((f, i) => {
        this._tone(f, 0.07, 'square', 0.07, f * 0.94, i * 0.075);
      });
    }

    playPoke() {
      this._tone(480, 0.06, 'square', 0.07, 680);
    }

    playVictory() {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((n, i) => {
        this._tone(n, 0.16, 'square', 0.09, null, i * 0.095);
        this._tone(n * 0.5, 0.16, 'triangle', 0.06, null, i * 0.095);
      });
    }

    startBGM(worldIdx = 0) {
      this.currentTheme = worldIdx;
      this.stopBGM();
      if (this.muted) return;
      this.init();

      const motifs = [
        [262, 330, 392, 523, 392, 330, 294, 392], // Lab bounce
        [330, 392, 494, 587, 523, 440, 392, 330], // Neon arcade
        [294, 349, 440, 523, 440, 392, 349, 294], // Frost rink
        [220, 262, 311, 330, 294, 247, 220, 196], // Lava foundry
        [247, 311, 370, 494, 440, 370, 311, 247]  // Royal throne
      ];
      const seq = motifs[Math.floor(worldIdx / 4) % motifs.length];
      this.bgmStep = 0;
      this.bgmTimer = setInterval(() => {
        if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
        const f = seq[this.bgmStep % seq.length];
        this._tone(f, 0.11, 'square', 0.024);
        if (this.bgmStep % 2 === 0) this._tone(f * 0.5, 0.13, 'triangle', 0.028);
        this.bgmStep++;
      }, 210);
    }

    stopBGM() {
      if (this.bgmTimer) {
        clearInterval(this.bgmTimer);
        this.bgmTimer = null;
      }
    }
  }

  window.SlingAudio = new SlingAudio();
})();
