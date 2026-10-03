const entries = [
  [
    "Harmonic Universe - 調性のスペクトルフィルタ",
    "Harmonic Universe - Spectral Filters for Tonality",
  ],
  ["Harmonic Universe トップ", "Harmonic Universe home"],
  ['"新しい音楽理論"！', '"A new music theory!"'],
  ["周波数スペクトルの", "Explore sound with"],
  ["特殊フィルター", "spectral filters"],
  [
    "スペクトル上の感情的な系列を分析しよう。",
    "Explore the emotional character of spectral series.",
  ],
  ["が長調系、", " passes major-like sounds; "],
  ["が短調系の音を通します。", " passes minor-like sounds."],
  ["聞いてみよう！", "Give it a listen!"],
  [
    "音声はこのブラウザ内だけで処理されます",
    "Audio is processed entirely in your browser",
  ],
  ["音楽を聴き比べる", "Compare the sounds"],
  ["サンプル曲の選択", "Choose a sample track"],
  ["音声ファイルの読み込み", "Load an audio file"],
  [
    "サンプル曲を再生できます · お好きなMP3・WAVのドロップで差し替え",
    "Play a sample, or drop your own MP3 or WAV file",
  ],
  ["曲を差し替える", "Choose a file"],
  [
    "お好きな音声ファイルをここにドロップして、曲を差し替えることもできます。",
    "You can also drop an audio file here to replace the current track.",
  ],
  ["▶ 再生", "▶ Play"],
  ["Ⅱ 一時停止", "Ⅱ Pause"],
  ["停止", "Stop"],
  ["再生位置", "Playback position"],
  ["音量", "Volume"],
  ["音声ファイルを待っています", "Waiting for an audio file"],
  ["響きを切り替える", "Switch the sound"],
  ["聴く音声", "Listening mode"],
  ["原音", "Original"],
  ["もとの響き", "The original sound"],
  ["ハーモニクス", "Harmonics"],
  ["サブハーモニクス", "Subharmonics"],
  ["長調的な響きへ", "A major-like sound"],
  ["短調的な響きへ", "A minor-like sound"],
  ["ふたつを重ねる", "Blend both sounds"],
  ["ステレオ", "Stereo"],
  ["トリッピーです⚠", "Trippy! ⚠"],
  ["音名スペクトル", "Pitch-class spectrum"],
  [
    "連続的な音名を横軸に、現在鳴っている音を表示します。",
    "See the sound playing now, with continuous pitch class on the horizontal axis.",
  ],
  [
    "再生音声に反応する単色の音名スペクトル",
    "A monochrome pitch-class spectrum responding to the audio output",
  ],
  ["再生すると音に反応します", "Press Play to see the spectrum respond"],
  [
    "停止中 · 再生すると音に反応します",
    "Stopped · Press Play to see the spectrum respond",
  ],
  ["音名スペクトルの準備中…", "Preparing the pitch-class spectrum…"],
  ["スペクトル系列のキー変更", "Change the spectral series’ key"],
  [
    "フィルターの音名基準を変えることができます。",
    "Adjust the reference pitch class of the filters.",
  ],
  ["エネルギー曲線と基準音名の変更", "Energy curves & reference pitch classes"],
  ["曲線の表示", "Visible curves"],
  [
    "音名基準と通過エネルギーの曲線。下のスライダーでも位置を操作できます。",
    "Energy transmission versus reference pitch class. Use the sliders below to adjust the position.",
  ],
  ["曲の中にある響きを見つけよう", "Discover the sounds within a track"],
  [
    "音声を読み込むと、3本のエネルギー曲線が表示されます。",
    "Load audio to display the three energy curves.",
  ],
  [
    "Both Mixの最大位置は、音声の実際のキー位置に対応することが多いです, 例外もあります.",
    "The Both Mix maximum often corresponds to the track’s actual key, though there are exceptions.",
  ],
  ["最大点の対象", "Find the maximum of"],
  ["最大点へ", "Go to maximum"],
  ["常に最大点に追従する", "Always follow the maximum"],
  ["ひとつ上の順位の局所ピーク", "Previous local peak in rank"],
  ["ひとつ下の順位の局所ピーク", "Next local peak in rank"],
  ["エネルギーの大きい順", "Ranked by energy, highest first"],
  ["第1系列のAからのcent位置", "Series 1 position in cents from A"],
  ["第2系列のAからのcent位置", "Series 2 position in cents from A"],
  [
    "横軸は1オクターブの連続音名です。バーの移動で系列の基準音名を変更できます。2系列が結合されている場合、Both Mixは第1系列を基準に移動します。",
    "The horizontal axis spans one octave of continuous pitch class. Move the sliders to change each series’ reference pitch class. When linked, Both Mix moves with the first series.",
  ],
  [
    "エネルギー曲線は原曲と比較したエネルギー通過率を計算しています",
    "The energy curves show the fraction of the original track’s energy passed by each filter.",
  ],
  ["音名基準のつながり", "Link reference pitch classes"],
  ["Odd Link · 奇数倍で連動", "Odd Link · Link by an odd ratio"],
  ["Link · 同じ位置で連動", "Link · Align both references"],
  ["それぞれ独立して操作", "Adjust independently"],
  ["奇数倍", "Odd ratio"],
  ["音楽理論的短調主音に合わせる", "Show the conventional minor tonic"],
  [
    "サブハーモニクス側の音名を完全五度下で読みます。音は変わりません。",
    "Read the subharmonic reference a perfect fifth lower. This does not change the sound.",
  ],
  [
    "平均律では各音階の主音を表示します。この補正は適用しません。",
    "Equal-tempered scales already show their tonics. This adjustment does not apply.",
  ],
  ["フィルター設定", "Filter settings"],
  ["フィルターを選ぶ", "Choose a filter"],
  ["フィルター", "Filter"],
  ["H・S 倍音枝", "H/S harmonic branches"],
  [
    "倍音・サブハーモニクスの特殊な部分系列",
    "Special subsets of the harmonic and subharmonic series",
  ],
  ["長・短 平均律", "Major / minor · 12-TET"],
  ["メジャーと自然短音階", "Major and natural minor scales"],
  ["カスタム倍音", "Custom harmonics"],
  ["好きな番号で響きを探す", "Explore with your own numbers"],
  [
    "純正律的な倍音系、平均律スケール、または指定番号の倍音系のフィルタが利用できます",
    "Choose just-intonation-like harmonic series, equal-tempered scales, or harmonic series defined by your own numbers.",
  ],
  ["倍音番号", "Harmonic numbers"],
  [
    "音名選択のため、奇数のみが意味を持ちます。偶数は2で割り切れなくなるまで割った奇数として扱います（例：12 → 3）。重複は無視されます。",
    "Only odd factors matter for pitch-class selection. Even numbers are divided by 2 until odd (for example, 12 → 3). Duplicates are ignored.",
  ],
  [
    "1, 3, 5はハーモニクスではメジャーコード、サブハーモニクスではマイナーコードを意味します。",
    "1, 3, 5 form a major chord in the harmonic series and a minor chord in the subharmonic series.",
  ],
  ["PC向け · A4 = 440 Hz", "For desktop · A4 = 440 Hz"],
  [
    "このアプリを使うにはJavaScriptを有効にしてください。",
    "Enable JavaScript to use this app.",
  ],
  [
    "音声を読み込んで、ハーモニクスとサブハーモニクスを聴き比べる。ブラウザで使える音楽・調性の実験ツール。",
    "Load audio and compare harmonics with subharmonics. A browser-based tool for exploring music and tonality.",
  ],
  ["エネルギー曲線を計算しています…", "Calculating energy curves…"],
  ["使用する番号：", "Effective numbers: "],
  ["倍音番号の入力を確認してください。", "Please check the harmonic numbers."],
  [
    "音声処理にはHTTPSまたはlocalhostでの表示が必要です。GitHub PagesのURLで開いてください。",
    "Audio processing requires HTTPS or localhost. Open the GitHub Pages URL.",
  ],
  [
    "このブラウザは音声処理に対応していません。PCの最新版Chrome・Edge・Firefoxをお試しください。",
    "This browser does not support the audio engine. Try an up-to-date desktop version of Chrome, Edge, or Firefox.",
  ],
  [
    "音声処理でエラーが発生しました。ページを再読み込みしてお試しください。",
    "An audio processing error occurred. Please reload the page.",
  ],
  ["音声を読み込んでいます…", "Loading audio…"],
  ["この端末内で処理", "processed on this device"],
  [
    "解析を完了できませんでした。短い音声でお試しください。",
    "Analysis could not finish. Please try a shorter file.",
  ],
  ["全曲を解析しています…", "Analyzing the entire track…"],
  [
    "解析完了 · 曲線は全曲の通過エネルギーを表します",
    "Analysis complete · Curves show energy transmission across the entire track",
  ],
  [
    "この形式を読み込めませんでした。MP3またはPCM WAVをお試しください。",
    "Unable to decode this format. Try MP3 or PCM WAV.",
  ],
  [
    "読み込みに失敗しました。別のファイルを選択してください。",
    "Loading failed. Please choose another file.",
  ],
  ["響きを解析しています", "Analyzing the sound"],
  [
    "解析結果が表示されるまでお待ちください。",
    "Please wait for the analysis results.",
  ],
  ["エネルギー曲線を表示できません", "Unable to display energy curves"],
  ["下のメッセージをご確認ください。", "Please check the message below."],
  [
    "1〜99999の奇数を入力してください。",
    "Enter an odd integer from 1 to 99999.",
  ],
  [
    "デモ曲を読み込めませんでした。音声ファイルを選択してください。",
    "Unable to load the sample. Please choose an audio file.",
  ],
  [
    "GitHub PagesまたはローカルHTTPサーバーから開いてください。ファイルの直接表示では音声処理が動作しません。",
    "Open this app on GitHub Pages or a local HTTP server. Audio processing does not work from a file URL.",
  ],
  [
    "GitHub PagesまたはローカルHTTPサーバーから開いてください。手順はREADME.mdにあります。",
    "Open this app on GitHub Pages or a local HTTP server. See README.md for instructions.",
  ],
  [
    "ファイルの直接表示では音声処理を利用できません。",
    "Audio processing is unavailable from a file URL.",
  ],
  [
    "入力は16,384文字以内にしてください。",
    "Use no more than 16,384 characters.",
  ],
  ["番号は1,024個以内にしてください。", "Use no more than 1,024 numbers."],
  [
    "1以上の整数を半角カンマで区切って入力してください。",
    "Enter positive integers separated by commas.",
  ],
  [
    "各番号は256桁以内にしてください。",
    "Each number must have no more than 256 digits.",
  ],
  ["不明なフィルターです。", "Unknown filter."],
  ["音声にサンプルがありません。", "The audio contains no samples."],
  [
    "解析できる音声エネルギーがありません。",
    "There is no audio energy to analyze.",
  ],
  ["同主調的な配置", "parallel-key relationship"],
  ["平行調的な配置", "relative-key relationship"],
  ["長調", "Major"],
  ["短調", "Minor"],
  ["の音名基準", " reference pitch class"],
  ["局所ピーク", "Local peak"],
  ["最大点", "Maximum"],
  ["再生中", "Playing"],
];
const normalize = (text) => text.replace(/\s+/g, " ").trim();
const dictionary = new Map(entries.map(([ja, en]) => [normalize(ja), en]));
const fragments = [...dictionary].sort((a, b) => b[0].length - a[0].length);
let language = "ja";
const textRecords = new Map(),
  attributeRecords = new Map();
let staticNodes = [];
export function t(raw) {
  const text = String(raw);
  if (language === "ja") return text;
  const normalized = normalize(text);
  if (dictionary.has(normalized)) return dictionary.get(normalized);
  let output = normalized;
  output = output.replace(
    /^サンプル曲(\d+)を読み込んでいます…$/,
    "Loading sample track $1…",
  );
  output = output.replace(/サンプル曲(\d+)/g, "Sample track $1");
  output = output.replace(/^(.+)を選択中$/, "Selected: $1");
  output = output.replace(
    /^ステレオ：左（L）＝(.+) ／ 右（R）＝(.+)$/,
    "Stereo: left (L) = $1 / right (R) = $2",
  );
  output = output.replace(
    /^全曲解析の上限を超えています。(\d+)分程度以下に短くしてください。試聴と手動の音名基準操作は利用できます。$/,
    "This track exceeds the analysis limit. Shorten it to about $1 minutes or less. Playback and manual reference adjustment are still available.",
  );
  output = output.replace(
    /^この音声は全曲解析のメモリ上限を超えます。(\d+)分程度以下に短くした音声をお試しください。$/,
    "This track exceeds the analysis memory limit. Try a file about $1 minutes long or shorter.",
  );
  for (const [ja, en] of fragments) output = output.split(ja).join(en);
  return output;
}
export function setText(element, raw, translate = true) {
  textRecords.set(element, { raw, translate });
  const value = translate ? t(raw) : raw;
  if (element.textContent !== value) element.textContent = value;
}
export function setLabel(element, attribute, raw) {
  if (!attributeRecords.has(element)) attributeRecords.set(element, new Map());
  attributeRecords.get(element).set(attribute, raw);
  element.setAttribute(attribute, t(raw));
}
export function setLanguage(value) {
  language = value === "en" ? "en" : "ja";
  document.documentElement.lang = language;
  for (const [node, raw] of staticNodes)
    if (node.isConnected) node.data = t(raw);
  for (const [element, attrs] of attributeRecords)
    for (const [attribute, raw] of attrs)
      element.setAttribute(attribute, t(raw));
  for (const [element, { raw, translate }] of textRecords)
    setText(element, raw, translate);
  document
    .querySelectorAll("[data-language]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.language === language),
      ),
    );
  try {
    localStorage.setItem("harmonic-universe-language", language);
  } catch {}
}
export function initLanguage() {
  const walker = document.createTreeWalker(
    document.documentElement,
    NodeFilter.SHOW_TEXT,
  );
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (
      !node.parentElement?.closest(
        "script,style,noscript,[data-language],#file-name",
      ) &&
      /[ぁ-んァ-ヶ一-龠]/.test(node.data)
    )
      staticNodes.push([node, node.data]);
  }
  document
    .querySelectorAll('[aria-label],[title],meta[name="description"]')
    .forEach((element) => {
      for (const attr of ["aria-label", "title", "content"])
        if (element.hasAttribute(attr))
          setLabel(element, attr, element.getAttribute(attr));
    });
  document
    .querySelectorAll("[data-language]")
    .forEach(
      (button) => (button.onclick = () => setLanguage(button.dataset.language)),
    );
  let saved = "ja";
  try {
    saved = localStorage.getItem("harmonic-universe-language") || "ja";
  } catch {}
  setLanguage(saved);
}
