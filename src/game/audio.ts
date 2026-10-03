type Effect = "splash" | "reel" | "bell" | "creak";
class BayAudio {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private drone: GainNode | null = null;
  private enabled = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  async toggle() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(this.ctx.destination);
      const buffer = this.ctx.createBuffer(
        1,
        this.ctx.sampleRate * 4,
        this.ctx.sampleRate,
      );
      const a = buffer.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < a.length; i++) {
        previous = (previous + (Math.random() * 2 - 1) * 0.04) / 1.02;
        a[i] = previous * 4;
      }
      for (const [freq, vol] of [
        [330, 0.26],
        [900, 0.09],
      ]) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = freq;
        const level = this.ctx.createGain();
        level.gain.value = vol;
        noise.connect(filter).connect(level).connect(this.gain);
        noise.start();
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.12;
        const g = this.ctx.createGain();
        g.gain.value = vol * 0.45;
        lfo.connect(g).connect(level.gain);
        lfo.start();
      }
      this.drone = this.ctx.createGain();
      this.drone.gain.value = 0;
      this.drone.connect(this.gain);
      for (const freq of [46, 48.5, 69]) {
        const osc = this.ctx.createOscillator();
        osc.frequency.value = freq;
        osc.type = "sine";
        osc.connect(this.drone);
        osc.start();
      }
      this.timer = setInterval(() => this.effect("creak"), 19000);
    }
    await this.ctx.resume();
    this.enabled = !this.enabled;
    this.gain!.gain.setTargetAtTime(
      this.enabled ? 0.36 : 0,
      this.ctx.currentTime,
      0.3,
    );
    return this.enabled;
  }
  night(value: boolean) {
    if (this.ctx && this.drone)
      this.drone.gain.setTargetAtTime(
        value ? 0.08 : 0,
        this.ctx.currentTime,
        2,
      );
  }
  effect(type: Effect) {
    if (!this.ctx || !this.gain || !this.enabled) return;
    const c = this.ctx,
      o = c.createOscillator(),
      g = c.createGain();
    const [freq, duration, vol] =
      type === "bell"
        ? [440, 2, 0.2]
        : type === "reel"
          ? [850, 0.06, 0.12]
          : type === "creak"
            ? [86, 0.9, 0.07]
            : [150, 0.45, 0.2];
    o.type =
      type === "creak" ? "sawtooth" : type === "reel" ? "square" : "sine";
    o.frequency.setValueAtTime(freq, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      type === "bell" ? freq * 0.998 : freq * 0.3,
      c.currentTime + duration,
    );
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    o.connect(g).connect(this.gain);
    o.start();
    o.stop(c.currentTime + duration);
  }
  pause(paused: boolean) {
    if (this.ctx && this.gain)
      this.gain.gain.setTargetAtTime(
        this.enabled && !paused ? 0.36 : 0,
        this.ctx.currentTime,
        0.2,
      );
  }
}
export const bayAudio = new BayAudio();
