'use strict';
window.I18n=(()=>{
const dictionary={
'ネガレル':'','ネガレル - Negallel -':'Negallel','使い方｜ネガレル':'Help | Negallel',
'音声をネガティブハーモニー化できるサイト':'Convert audio into negative harmony',
'光の色':'Light colors','タイプ1 A＝赤':'Type 1 · A = red','タイプ2 C＝赤':'Type 2 · C = red',
'音声をドラッグ＆ドロップ':'Drag and drop audio','またはクリックしてファイルを選択 · MP3 / WAV など':'or click to choose a file · MP3 / WAV and more',
'音声は端末内で処理します。':'Audio is processed on your device.',
'聴き比べる音声':'Compare audio','元音声':'Original','変換後':'Converted','元音声を保存':'Save original','変換後を保存':'Save converted',
'再生':'Play','一時停止':'Pause','▶ 再生':'▶ Play','Ⅱ 一時停止':'Ⅱ Pause','再生位置':'Playback position','音量':'Volume',
'音声を読み込むと再生できます。':'Load an audio file to play.',
'基準':'Reference','オクターブ基準':'Octave reference note','A4チューニング (Hz)':'A4 tuning (Hz)','セント値ずれ':'Cent offset',
'反転先の選択':'Reflection target','反転先の選択・時計型メーター':'Reflection target dial',
'倍音位置':'Harmonic positions','整数選択':'Harmonic ratio','前の倍音位置':'Previous harmonic position','次の倍音位置':'Next harmonic position',
'表示下限':'Min. displayed ratio','表示上限':'Max. displayed ratio','表示下限を下げる':'Decrease the minimum displayed ratio','表示下限を上げる':'Increase the minimum displayed ratio','表示上限を下げる':'Decrease the maximum displayed ratio','表示上限を上げる':'Increase the maximum displayed ratio',
'倍音位置に吸着':'Snap to harmonic positions','12平均律に吸着':'Snap to 12-TET','倍音位置の一覧':'Harmonic position list',
'Accelerated Griffin–Lim（AGLA）':'Accelerated Griffin–Lim (AGLA)','初期設定：24回。反復回数は変更できます。':'Default: 24 iterations. You can adjust the iteration count.','位相推定方式':'Phase estimation','Griffin–Lim（従来）':'Griffin–Lim (classic)','Fast Griffin–Lim（FGLA）':'Fast Griffin–Lim (FGLA)',
'加速係数 0.99 · 少ない反復回数でも比較できます。':'Momentum 0.99 · Try fewer iterations.','従来方式で再合成します。':'Resynthesize with the classic method.',
'窓長 (FFT)':'FFT size','ホップ長':'Hop size','反復回数':'Iterations','変換する':'Convert','停止':'Stop',
'長い音源・大きな窓長では、処理に時間がかかります。':'Longer audio and larger FFT sizes take more time.',
'音声ファイルを選択してください。':'Choose an audio file.',
'音声のアップロード・外部サービスへの送信は行いません。':'Your audio is never uploaded or sent to external services.',
'使い方':'Help','ネガレルに戻る':'Back to Negallel',
'目盛り範囲は正の奇数またはその逆数を小さい順で指定してください。':'Enter positive odd integers or their reciprocals, from minimum to maximum.',
'表示する倍音位置は80個以内にしてください。':'Display no more than 80 harmonic positions.',
'整数選択には正の奇数またはその逆数を入力してください。':'Enter a positive odd integer or its reciprocal.',
'停止しました。設定を変更して再実行できます。':'Stopped. You can change the settings and try again.',
'音声を読み込んでいます…':'Loading audio…','変換できます。':'Ready to convert.',
'水晶と後光の色を全体FFTで解析中…':'Analyzing the full audio spectrum for the crystal and halo…',
'水晶と後光の色の解析に失敗しました。変換は可能です。':'Color analysis failed. Audio conversion is still available.',
'背景解析は全体FFTの上限（2^25点）を超えるため省略しました。音声変換は可能です。':'Color analysis skipped: the full FFT exceeds 2^25 points. Audio conversion is still available.',
'音声ファイルを1つドロップしてください。':'Drop one audio file at a time.',
'設定を確認してください。ホップ長は窓長の1/16〜1/2、反復は1〜256、A4は100〜1000 Hz、偏差は±1200 centです。':'Check the settings: hop size must be 1/16 to 1/2 of the FFT size, iterations 1–256, A4 100–1000 Hz, and cent offset within ±1200 cents.',
'必要メモリが900 MBを超えます。音源を短くするか、ホップ長を大きくしてください。':'Estimated memory exceeds 900 MB. Use shorter audio or a larger hop size.',
'変換を優先するため背景解析を停止しました。':'Color analysis stopped to prioritize audio conversion.',
'再生できませんでした。もう一度再生ボタンを押してください。':'Playback failed. Press Play to try again.',
'再生中も同じ位置で切り替えられます。':'Switch sources at the same position during playback.',
'変換が完了すると聴き比べできます。':'Compare both versions once conversion is complete.',
'音声を再生できません。ファイルを読み込み直してください。':'Unable to play audio. Please load the file again.',
'音声を読み込む':'Load audio','反転先を選ぶ':'Choose a reflection target','聴き比べて保存する':'Compare and save','水晶と光の色':'Crystal and light colors','変換について':'About the conversion'
};
const rules=[
 [/^基準から (.+)セント、倍音位置 (.+)$/,(_,v,r)=>`${v} cents from reference; harmonic position ${r==='なし'?'none':r}`],
 [/^基準から (.+) cent$/,(_,v)=>`${v} cents from reference`],
 [/^基準周波数 (.+) Hz（音名目盛りは固定）$/,(_,v)=>`Reference: ${v} Hz (fixed note labels)`],
 [/^処理用メモリの目安：約 (.+) MB ＋ブラウザ・読込音声。窓長や反復回数が大きいほど時間がかかります。$/,(_,v)=>`Estimated processing memory: ${v} MB, plus the browser and loaded audio. Larger FFT sizes and more iterations take longer.`],
 [/^(.*) · ([\d.]+)秒 · (\d+) Hz · (\d+) ch$/,(_,name,t,sr,ch)=>`${name} · ${t} s · ${sr} Hz · ${ch} ch`],
 [/^(\d+\/\d+) ch · 振幅を再配置中 · (\d+)秒$/,(_,ch,t)=>`${ch} ch · Remapping magnitudes · ${t} s`],
 [/^(\d+\/\d+) ch · 位相推定 (\d+\/\d+) · (\d+)秒$/,(_,ch,it,t)=>`${ch} ch · Phase estimation ${it} · ${t} s`],
 [/^完了 · ([\d.]+)秒$/,(_,t)=>`Done · ${t} s`],
 [/^(AGLA|FGLA|GLA) · (\d+)回 · 16-bit PCM WAV · (\d+) ch · (\d+) Hz · 共通ゲイン (.+) dB$/,(_,m,i,ch,sr,g)=>`${m} · ${i} iterations · 16-bit PCM WAV · ${ch} ch · ${sr} Hz · Shared gain ${g} dB`],
 [/^読み込めませんでした：(.*)$/,(_,e)=>`Unable to load audio: ${e}`],
 [/^変換エラー：(.*)$/,(_,e)=>`Conversion error: ${e}`],
 [/^変換を終了しました：(.*)$/,(_,e)=>`Conversion stopped: ${e}`],
 [/^背景解析を省略しました: (.*)$/,(_,e)=>`Color analysis skipped: ${e}`]
];
let language='ja';try{if(localStorage.getItem('negallel-language')==='en')language='en';}catch{}
const staticTexts=[],staticAttrs=[],dynamicTexts=new Map(),dynamicAttrs=new Map();
function t(source){if(language==='ja')return source;const trimmed=source.trim();if(Object.hasOwn(dictionary,trimmed))return source.replace(trimmed,dictionary[trimmed]);for(const [re,replace] of rules)if(re.test(source))return source.replace(re,replace);return source;}
function text(element,source){dynamicTexts.set(element,String(source));const value=t(String(source));if(element.textContent!==value)element.textContent=value;}
function attr(element,name,source){let entries=dynamicAttrs.get(element);if(!entries){entries=new Map();dynamicAttrs.set(element,entries);}entries.set(name,source);element.setAttribute(name,t(source));}
function setLanguage(value){language=value==='en'?'en':'ja';try{localStorage.setItem('negallel-language',language);}catch{}
 document.documentElement.lang=language;document.title=t(document.body.classList.contains('help-document')?'使い方｜ネガレル':'ネガレル - Negallel -');
 for(const [node,source] of staticTexts)if(node.isConnected)node.nodeValue=t(source);
 for(const [el,name,source] of staticAttrs)el.setAttribute(name,t(source));
 for(const [el,source] of dynamicTexts)text(el,source);
 for(const [el,entries] of dynamicAttrs)for(const [name,source] of entries)el.setAttribute(name,t(source));
 const select=document.getElementById('language');if(select)select.value=language;
}
function initialize(){
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);while(walker.nextNode()){const node=walker.currentNode;if(!node.parentElement.closest('script,style,[data-no-i18n]')&&node.nodeValue.trim())staticTexts.push([node,node.nodeValue]);}
 for(const el of document.querySelectorAll('[aria-label],[title]'))for(const name of ['aria-label','title'])if(el.hasAttribute(name))staticAttrs.push([el,name,el.getAttribute(name)]);
 document.getElementById('language').addEventListener('change',e=>setLanguage(e.target.value));setLanguage(language);
}
return {t,text,attr,setLanguage,initialize,dictionary};
})();
