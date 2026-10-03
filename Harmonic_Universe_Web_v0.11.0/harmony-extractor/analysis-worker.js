import {
  buildHistogram,
  histogramSpectrum,
  powerResponse,
  responseCurve,
} from "./dsp.js";
import { wholeDistributions } from "./pitch-distribution.js";
let spectrum, histogram, total, cacheA, cacheB, signature;
self.onmessage = ({ data }) => {
  try {
    if (data.type === "audio") {
      const result = buildHistogram(data.channels, data.sampleRate, (p) =>
        self.postMessage({ type: "progress", value: p }),
      );
      spectrum = histogramSpectrum(result.histogram);
      histogram = result.histogram;
      total = result.total;
      cacheA = cacheB = null;
      signature = null;
      self.postMessage({ type: "ready" });
    }
    if (data.type === "distribution" && histogram) {
      self.postMessage({
        type: "distribution",
        distributionRevision: data.distributionRevision,
        value: wholeDistributions(histogram, data.filters, data.keys),
      });
    }
    if (data.type === "curves" && spectrum) {
      const { filters, offset, revision } = data,
        key = JSON.stringify([filters.a, filters.b]);
      if (key !== signature) {
        cacheA = responseCurve(
          spectrum,
          total,
          powerResponse(filters.a, filters.b, 0, "a"),
        );
        cacheB = responseCurve(
          spectrum,
          total,
          powerResponse(filters.a, filters.b, 0, "b"),
        );
        signature = key;
      }
      const mix = responseCurve(
        spectrum,
        total,
        powerResponse(filters.a, filters.b, offset, "mix"),
      );
      self.postMessage({ type: "curves", revision, a: cacheA, b: cacheB, mix });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error.message,
      revision: data.revision,
    });
  }
};
