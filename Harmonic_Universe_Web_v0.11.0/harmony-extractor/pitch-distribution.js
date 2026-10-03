import { extendedRatios, gainAtRatio, wrap } from "./dsp.js";

// 5-cent cells, with a circular 5-cell triangular display kernel.
export const PITCH_CELLS = 240;
function add(out, octave, power) {
  const u = (((octave % 1) + 1) % 1) * out.length;
  const i = Math.floor(u),
    f = u - i;
  out[i] += power * (1 - f);
  out[(i + 1) % out.length] += power * f;
}
export function normalizeDistribution(values) {
  const out = new Float64Array(values.length);
  const total = values.reduce((a, b) => a + b, 0);
  if (!(total > 0) || !Number.isFinite(total)) return out;
  const weights = [1, 2, 3, 2, 1];
  for (let i = 0; i < out.length; i++) {
    for (let d = -2; d <= 2; d++)
      out[i] += values[(i + d + out.length) % out.length] * weights[d + 2];
    out[i] *= 100 / (9 * total);
  }
  return out;
}
export function instantaneousDistribution(channels, sampleRate, fftSize) {
  const out = new Float64Array(PITCH_CELLS);
  for (const db of channels) {
    for (let i = 1; i < db.length; i++) {
      // Silence / floating-point noise must not become a normalized peak.
      if (!Number.isFinite(db[i]) || db[i] < -120) continue;
      add(out, Math.log2((i * sampleRate) / fftSize / 440), 10 ** (db[i] / 10));
    }
  }
  return normalizeDistribution(out);
}
export function wholeDistributions(histogram, filters, keys) {
  const result = {
    original: new Float64Array(PITCH_CELLS),
    a: new Float64Array(PITCH_CELLS),
    b: new Float64Array(PITCH_CELLS),
  };
  const a = extendedRatios(filters.a),
    b = extendedRatios(filters.b);
  for (let i = 0; i < histogram.length; i++) {
    const power = histogram[i],
      octave = i / histogram.length;
    add(result.original, octave, power);
    const ra = 2 ** (wrap(octave * 1200 - keys[0]) / 1200);
    const rb = 2 ** (wrap(octave * 1200 - keys[1]) / 1200);
    add(result.a, octave, power * gainAtRatio(ra, a) ** 2);
    add(result.b, octave, power * gainAtRatio(rb, b) ** 2);
  }
  for (const key of Object.keys(result))
    result[key] = normalizeDistribution(result[key]);
  return result;
}
