import {
  BINS,
  PLAYBACK_LATENCY,
  MAX_ANALYSIS_FFT,
  nextPowerOfTwo,
  makeFilters,
  wrap,
  delta,
  quantize,
  oddOffset,
  displayKey,
  actualKey,
  formatKey,
} from "./dsp.js";
const $ = (id) => document.getElementById(id);
const state = {
  kind: "branch",
  filters: makeFilters("branch"),
  mode: "a",
  a: 0,
  b: quantize(oddOffset(3)),
  link: "odd",
  odd: 3,
  valid: true,
  linkValid: true,
  curves: null,
  ready: false,
  revision: 0,
  peakRank: 0,
  buffer: null,
  loading: false,
};
let context,
  contextReady,
  worker,
  curveTimer,
  loadGeneration = 0,
  source,
  processor,
  volumeNode,
  playing = false,
  position = 0,
  startedAt = 0,
  playGeneration = 0,
  seeking = false;
const corrected = () => state.kind !== "et" && $("tonic-correction").checked;
const names = () =>
  state.kind === "et" ? ["長調", "短調"] : ["ハーモニクス", "サブハーモニクス"];
const offset = () => quantize(state.b - state.a);
function status(text, error = false) {
  $("status").textContent = text;
  $("status").classList.toggle("error", error);
  if (error) draw();
}
function controls() {
  const enabled =
    !!state.buffer && state.valid && state.linkValid && !state.loading;
  $("play").disabled = !enabled;
  $("stop").disabled = !state.buffer;
  $("seek").disabled = !state.buffer;
  const c = selectedCurve();
  $("go-maximum").disabled = !c;
  const peaks = c?.peaks || [];
  $("go-peak").disabled = !peaks.length;
  $("peak-prev").disabled = state.peakRank <= 0 || !peaks.length;
  $("peak-next").disabled = state.peakRank >= peaks.length - 1 || !peaks.length;
}
function syncNames() {
  const [a, b] = names();
  for (const id of ["legend-a", "key-a-name", "listen-a"])
    $(id).textContent = a;
  for (const id of ["legend-b", "key-b-name", "listen-b"])
    $(id).textContent = b;
  $("peak-source").options[0].textContent = a;
  $("peak-source").options[1].textContent = b;
  $("key-a").setAttribute("aria-label", a + "の音名基準");
  $("key-b").setAttribute("aria-label", b + "の音名基準");
  $("tonic-correction").disabled = state.kind === "et";
  $("correction-note").textContent =
    state.kind === "et"
      ? "平均律では各音階の主音を表示します。この補正は適用しません。"
      : "サブハーモニクス側の音名を完全五度下で読みます。音は変わりません。";
  $("odd-detail").textContent =
    state.kind === "et"
      ? `×${state.odd} · ${oddOffset(state.odd).toFixed(1)} cent`
      : `×${state.odd} · ${state.odd === 3 ? "同主調的な配置" : state.odd === 5 ? "平行調的な配置" : oddOffset(state.odd).toFixed(1) + " cent"}`;
  syncListening();
}
function syncListening() {
  document.querySelectorAll("[data-listen]").forEach((button) => {
    const active = button.dataset.listen === state.mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    if (active) $("listening").textContent = button.textContent + "を選択中";
  });
}
function syncKeys() {
  const b = displayKey(state.b, corrected());
  $("key-a-label").textContent = formatKey(state.a);
  $("key-b-label").textContent = formatKey(b);
  $("key-a").value = Math.round(state.a * 10);
  $("key-b").value = Math.round(b * 10) % 12000;
  $("cent-a").value = state.a.toFixed(1);
  $("cent-b").value = quantize(b).toFixed(1);
  $("key-b").disabled = state.link !== "free";
  $("cent-b").disabled = state.link !== "free";
  draw();
  updatePeak();
}
function sendKeys() {
  processor?.port.postMessage({ type: "keys", keys: [state.a, state.b] });
}
function applyKey(which, value) {
  const before = offset();
  if (which === "mix") {
    const d = offset();
    state.a = quantize(value);
    state.b = quantize(state.a + d);
  } else if (which === "a") {
    state.a = quantize(value);
    if (state.link === "same") state.b = state.a;
    if (state.link === "odd")
      state.b = quantize(state.a + oddOffset(state.odd));
  } else {
    state.b = quantize(value);
    if (state.link === "same") state.a = state.b;
    if (state.link === "odd") {
      state.a = quantize(state.b - oddOffset(state.odd));
      state.b = quantize(state.a + oddOffset(state.odd));
    }
  }
  sendKeys();
  syncKeys();
  if (Math.abs(delta(offset(), before)) > 0.01) scheduleCurves(false);
}
function selectedCurve() {
  return state.curves?.[$("peak-source").value] || null;
}
function updatePeak() {
  const c = selectedCurve(),
    target = $("peak-source").value;
  state.peakRank = Math.max(
    0,
    Math.min(state.peakRank, (c?.peaks.length || 1) - 1),
  );
  const convert = (x) => (target === "b" ? displayKey(x, corrected()) : x);
  $("peak-value").textContent = c
    ? `最大点 ${formatKey(convert(c.maximum.cents))} · ${(c.maximum.energy * 100).toFixed(3)}%`
    : "最大点 —";
  $("go-peak").textContent = c?.peaks.length
    ? `局所ピーク ${state.peakRank + 1} / ${c.peaks.length}`
    : "局所ピーク —";
  $("go-peak").title = "エネルギーの大きい順";
  controls();
}
function goMaximum() {
  const c = selectedCurve();
  if (c) applyKey($("peak-source").value, c.maximum.cents);
}
function scheduleCurves(all = true) {
  clearTimeout(curveTimer);
  state.revision++;
  if (all) state.curves = null;
  else if (state.curves) state.curves = { ...state.curves, mix: null };
  draw();
  updatePeak();
  if (!state.ready || !state.valid || !state.linkValid) return;
  status("エネルギー曲線を計算しています…");
  const revision = state.revision;
  curveTimer = setTimeout(
    () =>
      worker?.postMessage({
        type: "curves",
        revision,
        filters: state.filters,
        offset: offset(),
      }),
    all ? 180 : 120,
  );
}
function updateFilter() {
  try {
    const filters = makeFilters(state.kind, $("custom-numbers").value);
    state.filters = filters;
    state.valid = true;
    $("custom-error").textContent = "";
    $("custom-numbers").removeAttribute("aria-invalid");
    $("custom-effective").textContent =
      "使用する番号：" + filters.numbers.join(", ");
    processor?.port.postMessage({ type: "config", filters, mode: state.mode });
    scheduleCurves();
  } catch (error) {
    state.valid = false;
    pause();
    clearTimeout(curveTimer);
    state.revision++;
    state.curves = null;
    $("custom-error").textContent = error.message;
    $("custom-numbers").setAttribute("aria-invalid", "true");
    status("倍音番号の入力を確認してください。", true);
    draw();
    updatePeak();
  }
  controls();
}
function chooseFilter(kind) {
  state.kind = kind;
  document.querySelectorAll("[data-filter]").forEach((b) => {
    const active = b.dataset.filter === kind;
    b.classList.toggle("selected", active);
    b.setAttribute("aria-pressed", String(active));
  });
  $("custom-editor").hidden = kind !== "custom";
  $("filter-description").textContent =
    kind === "branch"
      ? "3つの倍音枝から生まれる、ハーモニクスとサブハーモニクスの響きを比較します。"
      : kind === "et"
        ? "12平均律のメジャースケールと自然短音階を比較します。"
        : "番号を選んで、ふたつの響きの変化を探してみましょう。";
  syncNames();
  updateFilter();
  syncKeys();
}
function chooseListening(mode) {
  state.mode = mode;
  syncListening();
  processor?.port.postMessage({ type: "config", filters: state.filters, mode });
}

async function ensureContext() {
  if (!contextReady) {
    contextReady = (async () => {
      if (!window.isSecureContext)
        throw Error(
          "音声処理にはHTTPSまたはlocalhostでの表示が必要です。GitHub PagesのURLで開いてください。",
        );
      context = new AudioContext({ latencyHint: "playback" });
      if (!context.audioWorklet)
        throw Error(
          "このブラウザは音声処理に対応していません。PCの最新版Chrome・Edge・Firefoxをお試しください。",
        );
      await context.audioWorklet.addModule(
        new URL("./audio-worklet.js", import.meta.url),
      );
      volumeNode = context.createGain();
      volumeNode.gain.value = Number($("volume").value) / 100;
      volumeNode.connect(context.destination);
    })();
  }
  try {
    await contextReady;
  } catch (error) {
    contextReady = null;
    if (context) await context.close().catch(() => {});
    context = null;
    throw error;
  }
  return context;
}
function teardown() {
  if (source) {
    try {
      source.stop();
    } catch {}
    source.disconnect();
    source = null;
  }
  if (processor) {
    processor.disconnect();
    processor.port.close();
    processor = null;
  }
}
function currentPosition() {
  return playing
    ? Math.min(
        state.buffer.duration,
        position +
          Math.max(
            0,
            context.currentTime -
              startedAt -
              PLAYBACK_LATENCY / context.sampleRate,
          ),
      )
    : position;
}
function pause() {
  ++playGeneration;
  if (playing) position = currentPosition();
  playing = false;
  teardown();
  $("play").textContent = "▶ 再生";
  updateTime();
}
async function play() {
  if (!state.buffer || !state.valid || !state.linkValid || state.loading)
    return;
  if (playing) {
    pause();
    return;
  }
  const generation = ++playGeneration;
  try {
    await ensureContext();
    await context.resume();
    if (generation !== playGeneration || !state.buffer) return;
    if (position >= state.buffer.duration) position = 0;
    processor = new AudioWorkletNode(context, "harmony-processor", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      channelCountMode: "max",
      processorOptions: {
        channels: state.buffer.numberOfChannels,
        filters: state.filters,
        mode: state.mode,
        keys: [state.a, state.b],
      },
    });
    processor.onprocessorerror = () => {
      pause();
      status(
        "音声処理でエラーが発生しました。ページを再読み込みしてお試しください。",
        true,
      );
    };
    source = context.createBufferSource();
    source.buffer = state.buffer;
    source.connect(processor);
    processor.connect(volumeNode);
    startedAt = context.currentTime;
    source.start(0, position);
    playing = true;
    $("play").textContent = "Ⅱ 一時停止";
  } catch (error) {
    pause();
    status(error.message, true);
  }
}
function seek(value) {
  const resume = playing;
  pause();
  position = Math.max(0, Math.min(state.buffer?.duration || 0, value));
  updateTime();
  if (resume) void play();
}
function updateTime() {
  const total = state.buffer?.duration || 0,
    now = currentPosition();
  if (!seeking) $("seek").value = total ? Math.round((now / total) * 10000) : 0;
  $("time").textContent = `${time(now)} / ${time(total)}`;
}
function time(s) {
  s = Math.max(0, Math.floor(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
setInterval(() => {
  if (playing) {
    updateTime();
    if (
      context.currentTime - startedAt >=
      state.buffer.duration - position + PLAYBACK_LATENCY / context.sampleRate
    ) {
      pause();
      position = state.buffer.duration;
      updateTime();
    }
  }
}, 100);

export async function loadFile(file) {
  if (!file) return;
  const generation = ++loadGeneration;
  pause();
  worker?.terminate();
  worker = null;
  clearTimeout(curveTimer);
  state.revision++;
  state.buffer = null;
  state.curves = null;
  state.ready = false;
  state.loading = true;
  position = 0;
  $("file-name").textContent = file.name;
  $("file-detail").textContent = "音声を読み込んでいます…";
  $("analysis-progress").hidden = false;
  $("analysis-progress").value = 0;
  status("音声を読み込んでいます…");
  draw();
  controls();
  updatePeak();
  updateTime();
  try {
    await ensureContext();
    const bytes = await file.arrayBuffer();
    if (generation !== loadGeneration) return;
    const buffer = await context.decodeAudioData(bytes);
    if (generation !== loadGeneration) return;
    state.buffer = buffer;
    state.loading = false;
    $("file-detail").textContent =
      `${time(buffer.duration)} · ${(buffer.sampleRate / 1000).toFixed(1)} kHz · ${buffer.numberOfChannels} ch · この端末内で処理`;
    if (
      nextPowerOfTwo(buffer.length + buffer.sampleRate * 16) > MAX_ANALYSIS_FFT
    )
      throw Error(
        `全曲解析の上限を超えています。${Math.floor((MAX_ANALYSIS_FFT / buffer.sampleRate - 16) / 60)}分程度以下に短くしてください。試聴と手動の音名基準操作は利用できます。`,
      );
    worker = new Worker(new URL("./analysis-worker.js", import.meta.url), {
      type: "module",
    });
    worker.onerror = () => {
      if (generation !== loadGeneration) return;
      state.ready = false;
      $("analysis-progress").hidden = true;
      status("解析を完了できませんでした。短い音声でお試しください。", true);
    };
    worker.onmessage = ({ data }) => {
      if (generation !== loadGeneration) return;
      if (data.type === "progress") {
        $("analysis-progress").value = data.value;
        status(`全曲を解析しています… ${Math.round(data.value)}%`);
      }
      if (data.type === "ready") {
        state.ready = true;
        $("analysis-progress").hidden = true;
        scheduleCurves();
      }
      if (
        data.type === "curves" &&
        data.revision === state.revision &&
        state.valid &&
        state.linkValid
      ) {
        state.curves = { a: data.a, b: data.b, mix: data.mix };
        state.peakRank = 0;
        status("解析完了 · 曲線は全曲の通過エネルギーを表します");
        $("chart-empty").hidden = true;
        if ($("auto-follow").checked) goMaximum();
        updatePeak();
        draw();
      }
      if (
        data.type === "error" &&
        (data.revision === undefined || data.revision === state.revision)
      ) {
        $("analysis-progress").hidden = true;
        status(data.message, true);
      }
    };
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
      buffer.getChannelData(i).slice(),
    );
    worker.postMessage(
      { type: "audio", channels, sampleRate: buffer.sampleRate },
      channels.map((x) => x.buffer),
    );
    status("全曲を解析しています…");
  } catch (error) {
    if (generation !== loadGeneration) return;
    state.loading = false;
    $("analysis-progress").hidden = true;
    const message =
      error.name === "EncodingError"
        ? "この形式を読み込めませんでした。MP3またはPCM WAVをお試しください。"
        : error.message;
    status(message, true);
    if (!state.buffer)
      $("file-detail").textContent =
        "読み込みに失敗しました。別のファイルを選択してください。";
  } finally {
    if (generation === loadGeneration) {
      controls();
      updateTime();
      draw();
    }
  }
}

const canvas = $("energy-chart");
function chartBox() {
  return {
    left: 48,
    top: 18,
    right: canvas.clientWidth - 16,
    bottom: canvas.clientHeight - 30,
  };
}
function sampleCurve(c, cents) {
  const u = (wrap(cents) / 1200) * BINS,
    i = Math.floor(u),
    f = u - i;
  return c.energy[i] * (1 - f) + c.energy[(i + 1) % BINS] * f;
}
function draw() {
  const dpr = window.devicePixelRatio || 1,
    w = canvas.clientWidth,
    h = canvas.clientHeight;
  if (!w || !h) return;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const p = chartBox(),
    pw = p.right - p.left,
    ph = p.bottom - p.top;
  const colors = { a: "#2864ce", b: "#c34d62", mix: "#218264" },
    visible = ["a", "b", "mix"].filter((k) => $("show-" + k).checked),
    curves = visible.filter((k) => state.curves?.[k]);
  let min = Infinity,
    max = -Infinity;
  for (const k of curves) {
    for (const y of state.curves[k].energy) {
      if (y < min) min = y;
      if (y > max) max = y;
    }
  }
  if (!Number.isFinite(min)) {
    min = 0;
    max = 1;
  }
  const span = Math.max(1e-9, max - min),
    yPos = (v) => p.bottom - 5 - ((v - min) / span) * (ph - 10);
  ctx.font = '11px "Segoe UI",sans-serif';
  ctx.strokeStyle = "#e8edf5";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 12; i++) {
    const x = p.left + (pw * i) / 12;
    ctx.beginPath();
    ctx.moveTo(x, p.top);
    ctx.lineTo(x, p.bottom);
    ctx.stroke();
    ctx.fillStyle = "#8390a5";
    ctx.textAlign = "center";
    ctx.fillText(
      ["A", "A♯", "B", "C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A"][i],
      x,
      h - 8,
    );
  }
  for (let i = 0; i <= 4; i++) {
    const y = p.top + (ph * i) / 4;
    ctx.beginPath();
    ctx.moveTo(p.left, y);
    ctx.lineTo(p.right, y);
    ctx.stroke();
    ctx.textAlign = "right";
    ctx.fillStyle = "#8390a5";
    if (curves.length)
      ctx.fillText(
        ((max - ((max - min) * i) / 4) * 100).toFixed(1) + "%",
        p.left - 7,
        y + 4,
      );
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(p.left, p.top, pw, ph);
  ctx.clip();
  for (const k of curves) {
    const c = state.curves[k];
    ctx.strokeStyle = colors[k];
    ctx.lineWidth = k === "mix" ? 2.4 : 1.7;
    ctx.setLineDash([]);
    ctx.beginPath();
    for (let pixel = 0; pixel <= pw * 2; pixel++) {
      const cents = (pixel / (pw * 2)) * 1200,
        actual = k === "b" ? actualKey(cents, corrected()) : cents;
      const y = yPos(sampleCurve(c, actual)),
        x = p.left + pixel / 2;
      if (!pixel) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    const mx =
      p.left +
      ((k === "b"
        ? displayKey(c.maximum.cents, corrected())
        : c.maximum.cents) /
        1200) *
        pw;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(mx, p.top);
    ctx.lineTo(mx, p.bottom);
    ctx.stroke();
  }
  for (const k of ["a", "b"]) {
    if (!visible.includes(k) && !(k === "a" && visible.includes("mix")))
      continue;
    const value = k === "a" ? state.a : displayKey(state.b, corrected()),
      x = p.left + (value / 1200) * pw;
    ctx.strokeStyle = colors[visible.includes(k) ? k : "mix"];
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, p.top);
    ctx.lineTo(x, p.bottom);
    ctx.stroke();
  }
  ctx.restore();
  $("chart-empty").hidden = !!state.curves;
  $("chart-empty").querySelector("strong").textContent = state.buffer
    ? "響きを解析しています"
    : "曲の中にある響きを見つけよう";
  $("chart-empty").querySelector("span").textContent = state.buffer
    ? "解析結果が表示されるまでお待ちください。"
    : "音声を読み込むと、3本のエネルギー曲線が表示されます。";
  if (
    !state.valid ||
    !state.linkValid ||
    $("status").classList.contains("error") ||
    (state.buffer && !state.loading && !state.ready && !worker)
  ) {
    $("chart-empty").querySelector("strong").textContent =
      "エネルギー曲線を表示できません";
    $("chart-empty").querySelector("span").textContent =
      "下のメッセージをご確認ください。";
  }
}
new ResizeObserver(draw).observe(canvas);
$("open-file").onclick = () => $("file-input").click();
$("file-input").onchange = (e) => {
  void loadFile(e.target.files[0]);
  e.target.value = "";
};
const drop = $("drop-zone");
for (const event of ["dragenter", "dragover"])
  drop.addEventListener(event, (e) => {
    e.preventDefault();
    drop.classList.add("dragging");
  });
for (const event of ["dragleave", "drop"])
  drop.addEventListener(event, (e) => {
    e.preventDefault();
    drop.classList.remove("dragging");
  });
drop.addEventListener("drop", (e) => {
  void loadFile(e.dataTransfer.files[0]);
});
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());
document
  .querySelectorAll("[data-filter]")
  .forEach((b) => (b.onclick = () => chooseFilter(b.dataset.filter)));
document
  .querySelectorAll("[data-listen]")
  .forEach((b) => (b.onclick = () => chooseListening(b.dataset.listen)));
$("custom-numbers").oninput = updateFilter;
function updateLink() {
  const value = Number($("odd-number").value);
  if (
    $("link-mode").value === "odd" &&
    (!Number.isInteger(value) || value < 1 || value > 99999 || value % 2 !== 1)
  ) {
    state.linkValid = false;
    $("link-error").textContent = "1〜99999の奇数を入力してください。";
    pause();
    scheduleCurves(false);
    controls();
    return;
  }
  state.linkValid = true;
  $("link-error").textContent = "";
  state.link = $("link-mode").value;
  if (Number.isInteger(value) && value > 0 && value % 2 === 1)
    state.odd = value;
  $("odd-row").hidden = state.link !== "odd";
  const old = offset();
  applyKey("a", state.a);
  if (Math.abs(delta(old, offset())) < 0.01) scheduleCurves(false);
  syncNames();
  controls();
}
$("link-mode").onchange = updateLink;
$("odd-number").oninput = updateLink;
$("tonic-correction").onchange = () => {
  syncKeys();
  draw();
};
for (const key of ["a", "b"]) {
  $("key-" + key).oninput = (e) =>
    applyKey(
      key,
      key === "b"
        ? actualKey(Number(e.target.value) / 10, corrected())
        : Number(e.target.value) / 10,
    );
  $("cent-" + key).onchange = (e) => {
    const value = Number(e.target.value);
    if (!Number.isFinite(value) || e.target.value === "") {
      syncKeys();
      return;
    }
    applyKey(key, key === "b" ? actualKey(value, corrected()) : value);
  };
}
$("peak-source").onchange = () => {
  state.peakRank = 0;
  if ($("auto-follow").checked) goMaximum();
  updatePeak();
};
$("auto-follow").onchange = () => {
  if ($("auto-follow").checked) goMaximum();
};
$("go-maximum").onclick = goMaximum;
$("peak-prev").onclick = () => {
  state.peakRank--;
  updatePeak();
};
$("peak-next").onclick = () => {
  state.peakRank++;
  updatePeak();
};
$("go-peak").onclick = () => {
  const p = selectedCurve()?.peaks[state.peakRank];
  if (p) applyKey($("peak-source").value, p.cents);
};
for (const key of ["a", "b", "mix"]) $("show-" + key).onchange = draw;
canvas.onclick = (e) => {
  const p = chartBox(),
    r = canvas.getBoundingClientRect(),
    x = e.clientX - r.left,
    y = e.clientY - r.top;
  if (x < p.left || x > p.right || y < p.top || y > p.bottom) return;
  const cents = wrap(((x - p.left) / (p.right - p.left)) * 1200),
    target = $("peak-source").value;
  applyKey(target, target === "b" ? actualKey(cents, corrected()) : cents);
};
$("play").onclick = () => void play();
$("stop").onclick = () => {
  pause();
  position = 0;
  updateTime();
};
$("seek").oninput = () => {
  seeking = true;
  $("time").textContent =
    `${time((Number($("seek").value) / 10000) * (state.buffer?.duration || 0))} / ${time(state.buffer?.duration || 0)}`;
};
$("seek").onchange = () => {
  const value =
    (Number($("seek").value) / 10000) * (state.buffer?.duration || 0);
  seeking = false;
  seek(value);
};
$("volume").oninput = () => {
  if (volumeNode)
    volumeNode.gain.setTargetAtTime(
      Number($("volume").value) / 100,
      context.currentTime,
      0.015,
    );
};
window.addEventListener("pagehide", () => {
  pause();
  worker?.terminate();
  context?.close();
});
syncNames();
syncKeys();
draw();
controls();
if (location.protocol === "file:")
  status(
    "GitHub PagesまたはローカルHTTPサーバーから開いてください。ファイルの直接表示では音声処理が動作しません。",
    true,
  );

// Optional browser-native agent integration; uses the same visible UI actions.
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  window.addEventListener("pagehide", () => lifecycle.abort(), { once: true });
  const tool = {
    name: "configure_harmony_filter",
    description:
      "表示中のHarmony Extractorのフィルターを選択します。音声ファイルの送信や再生開始は行いません。",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", enum: ["branch", "et", "custom"] },
        numbers: { type: "string" },
      },
      required: ["filter"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input) => {
      if (!input || !["branch", "et", "custom"].includes(input.filter))
        throw Error("Invalid filter");
      const numbers = input.numbers ?? $("custom-numbers").value;
      if (typeof numbers !== "string") throw Error("Invalid numbers");
      makeFilters(input.filter, numbers);
      if (input.filter === "custom") $("custom-numbers").value = numbers;
      chooseFilter(input.filter);
      return {
        filter: state.kind,
        numbers: state.filters.numbers,
        analysis: state.ready ? "updating" : "no audio analysis",
      };
    },
  };
  try {
    Promise.resolve(
      document.modelContext.registerTool(tool, { signal: lifecycle.signal }),
    ).catch(() => {});
  } catch {}
}
