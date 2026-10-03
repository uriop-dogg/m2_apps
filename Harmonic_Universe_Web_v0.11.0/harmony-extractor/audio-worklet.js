import { SpectralEngine, FFT_SIZE } from "./dsp.js";
class HarmonyProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = options.processorOptions;
    this.engine = new SpectralEngine(sampleRate, opts.channels);
    this.engine.setConfiguration(opts.filters, opts.mode, false);
    this.engine.setKeys(opts.keys[0], opts.keys[1], true);
    this.hop = FFT_SIZE / 2;
    this.input = Array.from(
      { length: opts.channels },
      () => new Float32Array(this.hop),
    );
    this.pending = Array.from(
      { length: opts.channels },
      () => new Float32Array(this.hop),
    );
    this.output = [new Float32Array(this.hop), new Float32Array(this.hop)];
    this.cursor = 0;
    this.job = null;
    this.finished = null;
    this.port.onmessage = ({ data }) => {
      if (data.type === "keys") this.engine.setKeys(...data.keys);
      if (data.type === "config")
        this.engine.setConfiguration(data.filters, data.mode);
    };
  }
  process(inputs, outputs) {
    const src = inputs[0],
      dst = outputs[0];
    // At least two complete frame budgets fit in one hop, including >2 channels.
    const steps = Math.max(
      4,
      Math.ceil(
        (((this.input.length + 2) * 18 + 24) * dst[0].length) / this.hop,
      ) * 2,
    );
    for (let s = 0; s < steps && this.job; s++) {
      const result = this.job.next();
      if (result.done) {
        this.finished = result.value;
        this.job = null;
      }
    }
    for (let i = 0; i < dst[0].length; i++) {
      for (let ch = 0; ch < this.input.length; ch++)
        this.input[ch][this.cursor] = src[ch]?.[i] || 0;
      for (let side = 0; side < 2; side++)
        dst[side][i] = this.output[side][this.cursor];
      if (++this.cursor === this.hop) {
        if (this.finished) {
          this.output[0].set(this.finished[0]);
          this.output[1].set(this.finished[1]);
          this.finished = null;
        } else {
          this.output[0].fill(0);
          this.output[1].fill(0);
        }
        const temp = this.pending;
        this.pending = this.input;
        this.input = temp;
        this.job = this.engine.processSteps(this.pending);
        this.cursor = 0;
      }
    }
    return true;
  }
}
registerProcessor("harmony-processor", HarmonyProcessor);
