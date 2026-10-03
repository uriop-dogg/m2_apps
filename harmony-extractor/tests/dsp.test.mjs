import assert from "node:assert/strict";

import * as d from "../dsp.js";
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
assert.deepEqual(d.parseNumbers("1, 2, 5, 7, 9, 13, 20").map(String), [
  "1",
  "5",
  "7",
  "9",
  "13",
]);
assert.deepEqual(d.parseNumbers("12, 3, 24, 0006").map(String), ["3"]);
assert.deepEqual(d.parseNumbers("9007199254740993").map(String), [
  "9007199254740993",
]);
for (const input of ["", "0", "-1", "1.5", "1,,3", "1,", "a", "1e3"])
  assert.throws(() => d.parseNumbers(input));
const hs = d.makeFilters("custom", "1,3,5");
assert.deepEqual(hs.a, [1, 1.25, 1.5]);
assert.deepEqual(hs.b, [1, 4 / 3, 1.6]);
const hmaj = d.makeFilters("custom", "1,3,5,9,15,21,27");
assert.deepEqual(hmaj.a, [1, 9 / 8, 5 / 4, 21 / 16, 3 / 2, 27 / 16, 15 / 8]);
const branch = d.makeFilters("branch");
const manual = d.makeFilters("custom", "1,3,5,9,15,21,27,25,35,45,55,65");
assert.deepEqual(branch.a, manual.a);
assert.deepEqual(branch.b, manual.b);
for (const key of [0, 1, 300, 1199.9])
  near(Math.abs(d.delta(d.actualKey(d.displayKey(key, true), true), key)), 0);
near(d.displayKey(d.oddOffset(3), true), 0);
near(d.oddOffset(3), 701.9550008653874);
const n = 1024,
  re = Float64Array.from({ length: n }, (_, i) => Math.sin(i / 13)),
  im = new Float64Array(n),
  original = re.slice();
d.fft(re, im);
d.fft(re, im, true);
for (let i = 0; i < n; i++) near(re[i], original[i]);
const hist = new Float64Array(d.BINS),
  bins = [0, 17, 981, 16384, 32000, 65535];
for (const i of bins) hist[i] = 1 + (i % 7);
const total = hist.reduce((a, b) => a + b, 0),
  spectrum = d.histogramSpectrum(hist);
for (const filters of [branch, hs, d.makeFilters("et")])
  for (const offset of [0, 701.9550008653874, 386.3, 1199.9]) {
    const curve = d.responseCurve(
      spectrum,
      total,
      d.powerResponse(filters.a, filters.b, offset, "mix"),
    );
    for (const key of [0, 1, 5000, 16000, 35000, 65535]) {
      let expected = 0;
      for (const i of bins) {
        const f = 440 * 2 ** (i / d.BINS),
          a = d.gain(f, (key * 1200) / d.BINS, filters.a),
          b = d.gain(f, (key * 1200) / d.BINS + offset, filters.b);
        expected += hist[i] * ((a + b) / 2) ** 2;
      }
      near(curve.energy[key], expected / total, 2e-10);
    }
  }
const rate = 44100,
  h = d.FFT_SIZE / 2,
  len = h * 7;
const input = [new Float32Array(len), new Float32Array(len)];
for (let i = 0; i < len; i++) {
  input[0][i] =
    0.2 * Math.sin((2 * Math.PI * 220 * i) / rate) +
    0.1 * Math.sin((2 * Math.PI * 731 * i) / rate);
  input[1][i] =
    0.15 * Math.sin((2 * Math.PI * 330 * i) / rate + 0.3) +
    0.07 * Math.sin((2 * Math.PI * 997 * i) / rate);
}
function render(mode, src = input) {
  const engine = new d.SpectralEngine(rate, src.length);
  engine.setConfiguration(branch, mode, false);
  engine.setKeys(137.4, 741.2, true);
  const out = [new Float32Array(len + 2 * h), new Float32Array(len + 2 * h)];
  for (let i = 0; i < len + 2 * h; i += h) {
    const block = src.map((x) =>
        i < len ? x.slice(i, i + h) : new Float32Array(h),
      ),
      result = engine.process(block);
    for (let c = 0; c < 2; c++) out[c].set(result[c], i);
  }
  return out;
}
const start = performance.now(),
  a = render("a"),
  b = render("b"),
  mix = render("mix"),
  raw = render("original"),
  stereo = render("stereo");
const mono = [Float32Array.from(input[0], (x, i) => (x + input[1][i]) / 2)],
  ma = render("a", mono),
  mb = render("b", mono);
let maxMix = 0,
  maxRaw = 0,
  maxStereo = 0;
for (let c = 0; c < 2; c++)
  for (let i = 0; i < len; i++) {
    maxMix = Math.max(maxMix, Math.abs(mix[c][i] - (a[c][i] + b[c][i]) / 2));
    maxRaw = Math.max(maxRaw, Math.abs(raw[c][i + h] - input[c][i]));
    maxStereo = Math.max(
      maxStereo,
      Math.abs(stereo[c][i] - (c === 0 ? ma : mb)[c][i]),
    );
  }
assert.ok(maxMix < 1e-7);
assert.ok(maxRaw < 1e-7);
assert.ok(maxStereo < 1e-7);
const ch = new Float32Array(8000);
for (let i = 0; i < ch.length; i++)
  ch[i] = Math.sin((2 * Math.PI * 440 * i) / 8000);
const result = d.buildHistogram([ch], 8000);
assert.ok(result.total > 0);
assert.throws(() => d.buildHistogram([new Float32Array(128)], 8000));
console.log(
  JSON.stringify(
    {
      result: "PASS",
      tests:
        "integer parsing, fixed filters, ET, reciprocal sets, coordinates, FFT round trip, direct Mix energy, original reconstruction, stereo comparison, silence rejection",
      maxMix,
      maxRaw,
      maxStereo,
      renderMilliseconds: performance.now() - start,
    },
    null,
    2,
  ),
);
