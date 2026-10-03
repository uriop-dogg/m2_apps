import assert from "node:assert/strict";
import {
  instantaneousDistribution,
  wholeDistributions,
  normalizeDistribution,
  PITCH_CELLS,
} from "../pitch-distribution.js";
import { makeFilters } from "../dsp.js";
const sum = (a) => a.reduce((x, y) => x + y, 0);
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
const peak = (a) => a.indexOf(Math.max(...a));
// Choose a sample rate that places 440 Hz exactly on a frequency bin.
const fftSize = 16384,
  sr = 45056,
  db = new Float32Array(fftSize / 2).fill(-Infinity);
db[160] = -20;
const a = instantaneousDistribution([db], sr, fftSize);
near(sum(a), 100);
assert.equal(peak(a), 0);
const octave = new Float32Array(db.length).fill(-Infinity);
octave[320] = -20;
assert.deepEqual(instantaneousDistribution([octave], sr, fftSize), a);
const fifth = new Float32Array(db.length).fill(-Infinity);
fifth[240] = -20;
assert.equal(peak(instantaneousDistribution([fifth], sr, fftSize)), 140);
// Independent channel powers add: an equally loud E survives beside A.
const stereo = instantaneousDistribution([db, fifth], sr, fftSize);
near(sum(stereo), 100);
assert.ok(stereo[0] > 10 && stereo[140] > 10);
assert.deepEqual(instantaneousDistribution([db, db], sr, fftSize), a);
assert.equal(
  sum(
    instantaneousDistribution(
      [new Float32Array(db.length).fill(-Infinity)],
      sr,
      fftSize,
    ),
  ),
  0,
);
const edge = new Float64Array(PITCH_CELLS);
edge[0] = 1;
const smooth = normalizeDistribution(edge);
near(sum(smooth), 100);
near(smooth[1], smooth.at(-1));
// A and its semitone neighbour: a one-note filter rejects the neighbour.
const hist = new Float64Array(2400);
hist[0] = 1;
hist[200] = 1;
const filters = makeFilters("custom", "1");
const full = wholeDistributions(hist, filters, [0, 100]);
near(sum(full.original), 100);
near(sum(full.a), 100);
near(sum(full.b), 100);
assert.equal(peak(full.a), 0);
assert.equal(peak(full.b), 20);
assert.ok(full.a[0] > full.a[20] * 100);
assert.ok(full.b[20] > full.b[0] * 100);
// Basis correction is display-only: physical keys are the inputs here.
assert.deepEqual(wholeDistributions(hist, filters, [1200, 1300]), full);
console.log(
  "PASS: octave folding, channel powers, silence, circular smoothing, normalization and physical filter positions",
);
