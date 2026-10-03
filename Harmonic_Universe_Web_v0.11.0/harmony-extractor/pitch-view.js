import { setText } from "./i18n.js";
import { FFT_SIZE, PITCH_NAMES } from "./dsp.js";
import {
  instantaneousDistribution,
  PITCH_CELLS,
} from "./pitch-distribution.js";

export function createPitchView(getPlayback) {
  const canvas = document.getElementById("pitch-chart");
  const message = document.getElementById("pitch-status");
  let whole = null,
    live = null,
    context,
    analysers,
    splitter,
    sink,
    arrays;
  let wasPlaying = false,
    frames = 0,
    mode = "a";
  function draw() {
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const p = { left: 24, right: w - 24, top: 22, bottom: h - 35 };
    // One track-wide scale, never expanded to follow a live frame or mode.
    const maximum = whole ? Math.max(1e-9, ...whole.original) : null;
    canvas.dataset.scaleMax = maximum === null ? "" : String(maximum);
    const step = (p.right - p.left) / PITCH_CELLS;
    const fill = ctx.createLinearGradient(0, p.top, 0, p.bottom);
    fill.addColorStop(0, "#d6ee8b");
    fill.addColorStop(1, "#8ca95b");
    ctx.fillStyle = fill;
    for (let i = 0; i < PITCH_CELLS; i++) {
      const fraction =
        maximum && live ? Math.min(1, Math.max(0, live[i] / maximum)) : 0;
      const height = Math.max(2, fraction * (p.bottom - p.top));
      const x = p.left + i * step,
        y = p.bottom - height;
      ctx.globalAlpha = fraction > 0 ? 0.95 : 0.23;
      ctx.fillRect(x, y, Math.max(1, step * 0.62), height);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#b4bcac";
    ctx.font = '11px "Segoe UI",sans-serif';
    ctx.textAlign = "center";
    for (let i = 0; i <= 12; i++) {
      const name = PITCH_NAMES[i % 12];
      const x = p.left + ((p.right - p.left) * i) / 12;
      ctx.fillText(name, x, h - 12);
    }
    canvas.dataset.frames = String(frames);
    canvas.dataset.livePeak = live
      ? String(live.indexOf(Math.max(...live)) * 5)
      : "";
  }
  const observer = new ResizeObserver(draw);
  observer.observe(canvas);
  const timer = setInterval(() => {
    const playback = getPlayback();
    if (playback.playing && analysers) {
      arrays.forEach((a, i) => analysers[i].getFloatFrequencyData(a));
      live = instantaneousDistribution(arrays, context.sampleRate, FFT_SIZE);
      mode = playback.mode;
      wasPlaying = true;
      frames++;
      const caption = whole
        ? `再生中 · ${playback.name}`
        : "音名スペクトルの準備中…";
      if (message.textContent !== caption) setText(message, caption);
      draw();
    } else if (wasPlaying) {
      live = null;
      wasPlaying = false;
      setText(message, "停止中 · 再生すると音に反応します");
      draw();
    }
  }, 50);
  return {
    attach(ctx, output) {
      context = ctx;
      splitter?.disconnect();
      sink?.disconnect();
      analysers?.forEach((a) => a.disconnect());
      splitter = ctx.createChannelSplitter(2);
      sink = ctx.createGain();
      sink.gain.value = 0;
      sink.connect(ctx.destination);
      output.connect(splitter);
      analysers = [0, 1].map((ch) => {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        analyser.smoothingTimeConstant = 0;
        splitter.connect(analyser, ch);
        analyser.connect(sink);
        return analyser;
      });
      arrays = analysers.map((a) => new Float32Array(a.frequencyBinCount));
    },
    clear() {
      whole = null;
      live = null;
      wasPlaying = false;
      setText(message, "再生すると音に反応します");
      draw();
    },
    pending() {
      // Keep the same track reference while filter settings update.
      draw();
    },
    setWhole(value) {
      whole = value;

      draw();
    },
    dispose() {
      clearInterval(timer);
      observer.disconnect();
      splitter?.disconnect();
      analysers?.forEach((a) => a.disconnect());
      sink?.disconnect();
    },
  };
}
