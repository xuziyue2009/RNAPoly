// ============================================================
//  RNA Polymerase 4K Rhythm Game — Audio Engine
// ============================================================

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.notes = [];
  }

  async init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.25;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  scheduleSong(beatmap, startOffset = 0) {
    this.notes = [];
    for (const b of beatmap) {
      const t = this.ctx.currentTime + startOffset + b.time / 1000;
      this.notes.push({ ...b, scheduledTime: t });
      this.scheduleNote(b.midiNote, t, b.durationMs / 1000);
    }
  }

  scheduleNote(midiNote, startTime, duration) {
    const freq = midiToFreq(midiNote);
    // Three-voice synthesis for rich timbre
    this._addVoice(freq, startTime, duration, 'triangle', 0.5);   // main
    this._addVoice(freq * 0.5, startTime, duration, 'sine', 0.12); // sub-octave
    this._addVoice(freq * 1.5, startTime, duration, 'sine', 0.08); // fifth harmonic
  }

  _addVoice(freq, startTime, duration, type, gain) {
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    const attack = 0.012, decay = 0.06, sustain = gain * 0.7, release = 0.08;
    env.gain.setValueAtTime(0, startTime);
    env.gain.linearRampToValueAtTime(gain, startTime + attack);
    env.gain.linearRampToValueAtTime(sustain, startTime + decay);
    env.gain.setValueAtTime(sustain, startTime + duration * 0.8);
    env.gain.linearRampToValueAtTime(0, startTime + duration);
    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration + release);
  }

  playHit(lane, judgment = 'good') {
    if (!this.ctx) return;
    const baseFreq = [220, 293, 370, 440][lane];
    const freq = judgment === 'perfect' ? baseFreq * 1.25 : judgment === 'great' ? baseFreq : baseFreq * 0.85;
    const gain = judgment === 'perfect' ? 0.22 : judgment === 'great' ? 0.16 : 0.12;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    env.gain.setValueAtTime(gain, this.ctx.currentTime);
    env.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
    osc.connect(env);
    env.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playMiss() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(80, this.ctx.currentTime);
    env.gain.setValueAtTime(0.08, this.ctx.currentTime);
    env.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.12);
    osc.connect(env);
    env.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  playTick() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    env.gain.setValueAtTime(0.12, this.ctx.currentTime);
    env.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.06);
    osc.connect(env);
    env.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);
  }

  get currentTime() { return this.ctx ? this.ctx.currentTime : 0; }
}
