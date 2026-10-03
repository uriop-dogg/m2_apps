// Shared numerical core. No DOM, network access or third-party dependencies.
export const BINS = 65536;
export const FFT_SIZE = 16384;
export const PLAYBACK_LATENCY = FFT_SIZE * 1.5;
export const WIDTH = 1 / 64;
export const FIFTH = 1200 * Math.log2(3);
export const MAX_ANALYSIS_FFT = 2 ** 24;
export const wrap = (x) => ((x % 1200) + 1200) % 1200;
export const delta = (target, current) => {
  let d = wrap(target - current);
  return d > 600 ? d - 1200 : d;
};
export const quantize = (x) => wrap(Math.round(wrap(x) * 10) / 10);
export const oddOffset = (q) => wrap(1200 * Math.log2(q));
export const displayKey = (key, corrected) =>
  wrap(key - (corrected ? FIFTH : 0));
export const actualKey = (key, corrected) =>
  wrap(key + (corrected ? FIFTH : 0));
export function formatKey(c) {
  c = wrap(c);
  const n = Math.round(c / 100) % 12;
  const names = [
    "A",
    "A♯ / B♭",
    "B",
    "C",
    "C♯ / D♭",
    "D",
    "D♯ / E♭",
    "E",
    "F",
    "F♯ / G♭",
    "G",
    "G♯ / A♭",
  ];
  const d = delta(c, n * 100);
  return `${names[n]} ${d < -0.049 ? "−" : "+"}${Math.abs(d).toFixed(1)} cent`;
}

export function parseNumbers(text) {
  if (text.length > 16384) throw Error("入力は16,384文字以内にしてください。");
  const tokens = text.split(",").map((x) => x.trim());
  if (tokens.length > 1024) throw Error("番号は1,024個以内にしてください。");
  const values = new Set();
  for (const token of tokens) {
    if (!/^\d+$/.test(token) || !/[1-9]/.test(token))
      throw Error("1以上の整数を半角カンマで区切って入力してください。");
    if (token.length > 256) throw Error("各番号は256桁以内にしてください。");
    let n = BigInt(token);
    while (n % 2n === 0n) n /= 2n;
    values.add(n.toString());
  }
  return [...values].map(BigInt).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
function normalizedInteger(n) {
  const bits = n.toString(2).length;
  const shift = Math.max(0, bits - 53);
  const r = Number(n >> BigInt(shift)) / 2 ** (bits - 1 - shift);
  return r >= 2 ? 1 : r;
}
export function makeFilters(kind, custom = "1, 3, 5") {
  if (kind === "et")
    return {
      a: [0, 2, 4, 5, 7, 9, 11].map((n) => 2 ** (n / 12)),
      b: [0, 2, 3, 5, 7, 8, 10].map((n) => 2 ** (n / 12)),
      numbers: [],
    };
  if (!["branch", "custom"].includes(kind))
    throw Error("不明なフィルターです。");
  const numbers =
    kind === "custom"
      ? parseNumbers(custom)
      : [
          ...new Set(
            [
              [1, 5],
              [3, 9],
              [5, 13],
            ].flatMap(([b, l]) =>
              Array.from({ length: Math.ceil(l / 2) }, (_, i) =>
                BigInt(b * (2 * i + 1)),
              ),
            ),
          ),
        ];
  const a = [...new Set(numbers.map(normalizedInteger))].sort((x, y) => x - y);
  const b = [...new Set(a.map((r) => (r === 1 ? 1 : 2 / r)))].sort(
    (x, y) => x - y,
  );
  return { a, b, numbers: numbers.map(String) };
}
export function extendedRatios(ratios) {
  return Float64Array.from(
    ratios.flatMap((x) => [x / 2, x, x * 2]).sort((a, b) => a - b),
  );
}
export function gainAtRatio(r, sorted) {
  let lo = 0,
    hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] < r) lo = mid + 1;
    else hi = mid;
  }
  const d = Math.min(
    lo < sorted.length ? Math.abs(sorted[lo] - r) : Infinity,
    lo > 0 ? Math.abs(sorted[lo - 1] - r) : Infinity,
  );
  return Math.exp(-((d / WIDTH) ** 2));
}
export function gain(f, key, ratios) {
  if (f <= 0) return 1;
  const x = f / (440 * 2 ** (key / 1200));
  const r = 2 ** (Math.log2(x) - Math.floor(Math.log2(x)));
  return gainAtRatio(r, extendedRatios(ratios));
}

const plans = new Map();
function fftPlan(n) {
  if (plans.has(n)) return plans.get(n);
  if (n > BINS) return null;
  const cos = new Float64Array(n / 2),
    sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n);
    sin[i] = Math.sin((2 * Math.PI * i) / n);
  }
  const plan = { cos, sin };
  plans.set(n, plan);
  return plan;
}
export function fft(re, im, inverse = false, progress) {
  const n = re.length;
  if (n < 2 || n !== im.length || n & (n - 1))
    throw Error("FFT size must be a power of two >= 2");
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >>> 1;
    while (j & bit) {
      j ^= bit;
      bit >>>= 1;
    }
    j ^= bit;
    if (i < j) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
    }
  }
  const plan = fftPlan(n),
    stages = Math.log2(n);
  let stage = 0;
  for (let len = 2; len <= n; len *= 2) {
    const half = len / 2,
      step = n / len;
    const angle = ((inverse ? 2 : -2) * Math.PI) / len,
      lr = Math.cos(angle),
      li = Math.sin(angle);
    for (let start = 0; start < n; start += len) {
      let wr = 1,
        wi = 0;
      for (let j = 0; j < half; j++) {
        if (plan) {
          wr = plan.cos[j * step];
          wi = (inverse ? 1 : -1) * plan.sin[j * step];
        }
        const a = start + j,
          b = a + half,
          vr = re[b] * wr - im[b] * wi,
          vi = re[b] * wi + im[b] * wr,
          ur = re[a],
          ui = im[a];
        re[a] = ur + vr;
        im[a] = ui + vi;
        re[b] = ur - vr;
        im[b] = ui - vi;
        if (!plan) {
          const next = wr * lr - wi * li;
          wi = wr * li + wi * lr;
          wr = next;
        }
      }
    }
    progress?.(++stage / stages);
  }
  if (inverse)
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
}
export function nextPowerOfTwo(n) {
  return 2 ** Math.ceil(Math.log2(Math.max(2, n)));
}
export function buildHistogram(channels, sampleRate, onProgress = () => {}) {
  const frames = channels[0]?.length || 0,
    pad = Math.round(8 * sampleRate),
    n = nextPowerOfTwo(frames + 2 * pad);
  if (!frames) throw Error("音声にサンプルがありません。");
  if (n > MAX_ANALYSIS_FFT)
    throw Error(
      `この音声は全曲解析のメモリ上限を超えます。${Math.floor((MAX_ANALYSIS_FFT / sampleRate - 16) / 60)}分程度以下に短くした音声をお試しください。`,
    );
  const histogram = new Float64Array(BINS),
    re = new Float64Array(n),
    im = new Float64Array(n);
  for (let ch = 0; ch < channels.length; ch++) {
    re.fill(0);
    im.fill(0);
    re.set(channels[ch], pad);
    fft(re, im, false, (p) =>
      onProgress(((ch + p * 0.8) / channels.length) * 100),
    );
    for (let i = 1; i < n / 2; i++) {
      const power = re[i] * re[i] + im[i] * im[i];
      const log = Math.log2((i * sampleRate) / n / 440),
        u = (log - Math.floor(log)) * BINS,
        j = Math.floor(u),
        f = u - j;
      histogram[j] += power * (1 - f);
      histogram[(j + 1) & (BINS - 1)] += power * f;
    }
    onProgress(((ch + 1) / channels.length) * 100);
  }
  const total = histogram.reduce((a, b) => a + b, 0);
  if (!(total > 0) || !Number.isFinite(total))
    throw Error("解析できる音声エネルギーがありません。");
  return { histogram, total };
}
export function powerResponse(a, b, offset, type) {
  const ea = extendedRatios(a),
    eb = extendedRatios(b),
    values = new Float64Array(BINS),
    factor = 2 ** (-wrap(offset) / 1200);
  for (let i = 0; i < BINS; i++) {
    const r = 2 ** (i / BINS);
    let s = r * factor;
    if (s < 1) s *= 2;
    const ga = gainAtRatio(r, ea),
      gb = gainAtRatio(s, eb);
    values[i] =
      type === "a"
        ? ga * ga
        : type === "b"
          ? gainAtRatio(r, eb) ** 2
          : ((ga + gb) / 2) ** 2;
  }
  return values;
}
export function histogramSpectrum(histogram) {
  const re = histogram.slice(),
    im = new Float64Array(BINS);
  fft(re, im);
  return { re, im };
}
export function responseCurve(histSpectrum, total, response) {
  const re = response.slice(),
    im = new Float64Array(BINS);
  fft(re, im);
  for (let i = 0; i < BINS; i++) {
    const ar = histSpectrum.re[i],
      ai = histSpectrum.im[i],
      br = re[i],
      bi = im[i];
    re[i] = ar * br + ai * bi;
    im[i] = ai * br - ar * bi;
  }
  fft(re, im, true);
  for (let i = 0; i < BINS; i++) re[i] = Math.max(0, re[i] / total);
  return curveSummary(re);
}
export function curveSummary(energy) {
  let max = 0;
  const peaks = [];
  for (let i = 0; i < energy.length; i++) {
    if (energy[i] > energy[max]) max = i;
    const prev = energy[(i - 1 + energy.length) % energy.length],
      next = energy[(i + 1) % energy.length];
    if (energy[i] > prev && energy[i] >= next) peaks.push(refine(energy, i));
  }
  peaks.sort((a, b) => b.energy - a.energy);
  return { energy, maximum: refine(energy, max), peaks };
}
function refine(y, i) {
  const prev = y[(i + y.length - 1) % y.length],
    next = y[(i + 1) % y.length],
    denom = prev - 2 * y[i] + next;
  const d =
    Math.abs(denom) < 1e-30
      ? 0
      : Math.max(-0.5, Math.min(0.5, (0.5 * (prev - next)) / denom));
  return {
    cents: wrap(((i + d) * 1200) / y.length),
    energy: y[i] - 0.25 * (prev - next) * d,
  };
}

// Yield FFT stages so an AudioWorklet can distribute a frame across callbacks.
function* fftSteps(re, im, inverse = false) {
  const n = re.length,
    plan = fftPlan(n);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >>> 1;
    while (j & bit) {
      j ^= bit;
      bit >>>= 1;
    }
    j ^= bit;
    if (i < j) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
    }
  }
  yield;
  for (let len = 2; len <= n; len *= 2) {
    const half = len / 2,
      step = n / len;
    for (let start = 0; start < n; start += len)
      for (let j = 0; j < half; j++) {
        const wr = plan.cos[j * step],
          wi = (inverse ? 1 : -1) * plan.sin[j * step],
          a = start + j,
          b = a + half,
          vr = re[b] * wr - im[b] * wi,
          vi = re[b] * wi + im[b] * wr,
          ur = re[a],
          ui = im[a];
        re[a] = ur + vr;
        im[a] = ui + vi;
        re[b] = ur - vr;
        im[b] = ui - vi;
      }
    yield;
  }
  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
    yield;
  }
}
function outputGain(mode, a, b, side) {
  return mode === "original"
    ? 1
    : mode === "a"
      ? a
      : mode === "b"
        ? b
        : mode === "mix"
          ? (a + b) / 2
          : side === 0
            ? a
            : b;
}
// The same hop engine is exercised in Node tests and used by the AudioWorklet.
// Sqrt-Hann analysis/synthesis windows, 50% overlap, 40% circular key smoothing.
export class SpectralEngine {
  constructor(sampleRate, channels = 2, size = FFT_SIZE) {
    this.size = size;
    this.hop = size / 2;
    this.sampleRate = sampleRate;
    this.channels = channels;
    this.keys = [0, 0];
    this.targets = [0, 0];
    this.window = Float64Array.from({ length: size }, (_, n) =>
      Math.sqrt(0.5 - 0.5 * Math.cos((2 * Math.PI * n) / size)),
    );
    this.input = Array.from({ length: channels }, () => new Float64Array(size));
    this.spectrum = Array.from({ length: channels }, () => ({
      re: new Float64Array(size),
      im: new Float64Array(size),
    }));
    this.out = Array.from({ length: 2 }, () => ({
      re: new Float64Array(size),
      im: new Float64Array(size),
    }));
    this.ola = [new Float64Array(size), new Float64Array(size)];
    this.result = [new Float32Array(this.hop), new Float32Array(this.hop)];
    this.local = new Float64Array(this.hop + 1);
    this.local[0] = 1;
    for (let i = 1; i <= this.hop; i++) {
      let v = Math.log2((i * sampleRate) / size / 440);
      this.local[i] = 2 ** (v - Math.floor(v));
    }
    this.setConfiguration(makeFilters("branch"), "a", false);
    fftPlan(size);
  }
  setKeys(a, b, immediate = false) {
    this.targets = [a, b];
    if (immediate) this.keys = [a, b];
  }
  setConfiguration(filters, mode, fade = true) {
    if (fade && this.config) {
      this.old = this.config;
      this.fade = 2;
    } else {
      this.old = null;
      this.fade = 0;
    }
    this.config = {
      a: extendedRatios(filters.a),
      b: extendedRatios(filters.b),
      mode,
    };
  }
  process(hopInput) {
    const steps = this.processSteps(hopInput);
    let next;
    do {
      next = steps.next();
    } while (!next.done);
    return next.value;
  }
  *processSteps(hopInput) {
    const n = this.size,
      h = this.hop,
      config = this.config,
      oldConfig = this.old,
      fade = this.fade;
    for (let c = 0; c < this.channels; c++) {
      const input = this.input[c];
      input.copyWithin(0, h);
      input.set(hopInput[c] || hopInput[0], h);
      const s = this.spectrum[c];
      for (let i = 0; i < n; i++) {
        s.re[i] = input[i] * this.window[i];
        s.im[i] = 0;
      }
      yield;
      yield* fftSteps(s.re, s.im);
    }
    for (let k = 0; k < 2; k++)
      this.keys[k] = wrap(
        this.keys[k] + 0.4 * delta(this.targets[k], this.keys[k]),
      );
    const fa = 2 ** (-this.keys[0] / 1200),
      fb = 2 ** (-this.keys[1] / 1200),
      blend = fade ? 1 - fade / 2 : 1;
    for (let bin = 0; bin <= h; bin++) {
      let ra = this.local[bin] * fa,
        rb = this.local[bin] * fb;
      if (ra < 1) ra *= 2;
      if (rb < 1) rb *= 2;
      const ga = bin ? gainAtRatio(ra, config.a) : 1,
        gb = bin ? gainAtRatio(rb, config.b) : 1,
        oa = oldConfig && fade && bin ? gainAtRatio(ra, oldConfig.a) : ga,
        ob = oldConfig && fade && bin ? gainAtRatio(rb, oldConfig.b) : gb;
      for (let side = 0; side < 2; side++) {
        const index = Math.min(side, this.channels - 1);
        let re = this.spectrum[index].re[bin],
          im = this.spectrum[index].im[bin];
        let mr = 0,
          mi = 0;
        if (
          config.mode === "stereo" ||
          (fade && oldConfig?.mode === "stereo")
        ) {
          for (const s of this.spectrum) {
            mr += s.re[bin];
            mi += s.im[bin];
          }
          mr /= this.channels;
          mi /= this.channels;
        }
        const cg = outputGain(config.mode, ga, gb, side);
        let rr = (config.mode === "stereo" ? mr : re) * cg,
          ii = (config.mode === "stereo" ? mi : im) * cg;
        if (fade) {
          const og = outputGain(oldConfig.mode, oa, ob, side);
          rr =
            (oldConfig.mode === "stereo" ? mr : re) * og * (1 - blend) +
            rr * blend;
          ii =
            (oldConfig.mode === "stereo" ? mi : im) * og * (1 - blend) +
            ii * blend;
        }
        const out = this.out[side];
        out.re[bin] = rr;
        out.im[bin] = ii;
        if (bin > 0 && bin < h) {
          out.re[n - bin] = rr;
          out.im[n - bin] = -ii;
        }
      }
      if ((bin & 511) === 511) yield;
    }
    for (let side = 0; side < 2; side++) {
      const out = this.out[side],
        ola = this.ola[side];
      yield* fftSteps(out.re, out.im, true);
      for (let i = 0; i < n; i++) ola[i] += out.re[i] * this.window[i];
      for (let i = 0; i < h; i++)
        this.result[side][i] = Math.max(-1.5, Math.min(1.5, ola[i]));
      ola.copyWithin(0, h);
      ola.fill(0, h);
      yield;
    }
    if (this.config === config && this.fade) this.fade--;
    return this.result;
  }
}
