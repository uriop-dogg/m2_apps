'use strict';
const $=id=>document.getElementById(id),names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
let audioCtx=null,masterGain=null,programGain=null,limiter=null,analyser=null,mediaNode=null,micNode=null,stream=null;
let mode=null,view='power',octave=4,micTicket=0,fileURL=null;
const voices=new Map(),retiringVoices=new Set(),media=$('media');
const banks=[];let nextBankId=1,chordPlaying=true;
let worker=null,workerURL=null,pending=false,generation=0,timer=0,frame=null,lastBounds=null,dirty=true,raf=0,hover=null;
let fftData=null,computeMs=0,drawMs=0;
let selectedFile=null,decodedFile=null,decodePromise=null,fileRevision=0,wholeWorker=null,wholeURL=null,wholeBusy=false,wholeCache=null;
function cancelWhole(){if(wholeWorker)wholeWorker.terminate();wholeWorker=null;if(wholeURL)URL.revokeObjectURL(wholeURL);wholeURL=null;wholeBusy=false;}
async function decodeFile(){
  if(decodedFile)return decodedFile;if(decodePromise)return decodePromise;
  const file=selectedFile,revision=fileRevision;if(!file)throw Error('音声ファイルを選んでください。');
  const promise=(async()=>{
    await audioSetup();const decoded=await audioCtx.decodeAudioData(await file.arrayBuffer());
    const mono=new Float32Array(decoded.length);
    for(let c=0;c<decoded.numberOfChannels;c++){const channel=decoded.getChannelData(c);for(let i=0;i<mono.length;i++)mono[i]+=channel[i]/decoded.numberOfChannels;}
    const result={samples:mono,sampleRate:decoded.sampleRate};if(revision===fileRevision)decodedFile=result;return result;
  })();decodePromise=promise;
  try{return await promise;}finally{if(decodePromise===promise)decodePromise=null;}
}
async function analyseWhole(){
  if(wholeBusy||frame||!selectedFile)return;
  wholeBusy=true;const ticket=generation,revision=fileRevision;
  try{
    const opts=options(),n=Number($('fft').value),gain=Number($('volume').value);
    status('音声全体を解析しています…');const decoded=await decodeFile();
    if(ticket!==generation||revision!==fileRevision)return;
    const cached=wholeCache?.n===n?wholeCache:null;
    const source=audioPower.toString()+'\n'+averagePower.toString()+'\n'+analyse.toString()+`;
      onmessage=e=>{try{const d=e.data;let avg=d.cached;
        if(!avg)avg=averagePower(d.samples,d.sampleRate,d.n,p=>postMessage({progress:p}));
        const result=analyse(Float64Array.from(avg.power,v=>v*d.gain*d.gain),avg.df,d.opts);
        result.windowMs=d.n/d.sampleRate*1000;result.df=avg.df;result.whole=true;result.count=avg.count;
        postMessage({result,average:avg},[result.x.buffer,result.re.buffer,result.im.buffer,avg.power.buffer]);
      }catch(e){postMessage({error:e.message});}}`;
    wholeURL=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));wholeWorker=new Worker(wholeURL);
    wholeWorker.onmessage=e=>{
      if(ticket!==generation)return;
      if(e.data.progress!==undefined){status('音声全体を解析しています… '+Math.round(e.data.progress*100)+'%');return;}
      if(e.data.error){status('音声全体の解析に失敗しました：'+e.data.error,true);cancelWhole();return;}
      wholeCache={...e.data.average,n};frame=e.data.result;dirty=true;status('音声全体のSTFT平均 · '+frame.count+'フレーム');cancelWhole();
    };
    wholeWorker.onerror=e=>{if(ticket===generation){status('音声全体の解析に失敗しました：'+e.message,true);cancelWhole();}};
    wholeWorker.postMessage({samples:cached?null:decoded.samples,sampleRate:decoded.sampleRate,n,opts,gain,cached});
  }catch(e){if(ticket===generation){status('音声全体の解析に失敗しました：'+e.message,true);cancelWhole();}}
}

function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function audioSetup(){
  if(!audioCtx){
    audioCtx=new (window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'});
    analyser=audioCtx.createAnalyser();analyser.smoothingTimeConstant=0;analyser.fftSize=Number($('fft').value);
    programGain=audioCtx.createGain();programGain.gain.value=Number($('volume').value);
    programGain.connect(audioCtx.destination);programGain.connect(analyser);
    masterGain=audioCtx.createGain();masterGain.gain.value=1;
    limiter=audioCtx.createDynamicsCompressor();limiter.threshold.value=-7;limiter.knee.value=12;limiter.ratio.value=10;limiter.attack.value=.003;limiter.release.value=.16;
    masterGain.connect(limiter);limiter.connect(programGain);
    mediaNode=audioCtx.createMediaElementSource(media);mediaNode.connect(programGain);
  }
  if(audioCtx.state==='suspended')return audioCtx.resume();
  return Promise.resolve();
}
function killVoices(bank=null){
  const stop=({voice,gain})=>{
    for(const source of voice.sources){try{source.stop()}catch{}try{source.disconnect()}catch{}}
    for(const node of [voice.sourceBus,voice.outputNode,voice.amp,voice.releaseGate,gain])try{node.disconnect()}catch{}
  };
  for(const [key,entry] of voices)if(!bank||entry.bankId===bank.id){stop(entry);voices.delete(key);}
  for(const entry of retiringVoices)if(!bank||entry.bankId===bank.id){stop(entry);retiringVoices.delete(entry);}
}
function setNote(bank,i){
  const key=bank.id+':'+i,existing=voices.get(key);
  if(!audioCtx||mode!=='chord'||!chordPlaying||!banks.includes(bank))return;
  if(bank.levels[i]===0){if(existing){releaseVoice(existing.voice);voices.delete(key);retiringVoices.add(existing);setTimeout(()=>{existing.gain.disconnect();retiringVoices.delete(existing);},(existing.voice.release+.2)*1000);}return;}
  const level=bank.levels[i]*bank.volume;
  if(existing){existing.gain.gain.setTargetAtTime(level,audioCtx.currentTime,.012);return;}
  const freq=Number($('a4').value)*2**(((bank.octave+1)*12+i-69)/12);
  const voice=buildVoice(freq,bank.timbre,audioCtx.currentTime),gain=audioCtx.createGain();
  gain.gain.value=level;voice.releaseGate.disconnect(masterGain);voice.releaseGate.connect(gain);gain.connect(masterGain);voices.set(key,{voice,gain,bankId:bank.id});
}
function rebuildChord(bank=null){killVoices(bank);if(mode==='chord'&&chordPlaying)for(const b of bank?[bank]:banks)for(let i=0;i<12;i++)setNote(b,i);}
function unusedOctave(after=3){
  for(let step=1;step<=9;step++){const n=(after+step)%9;if(!banks.some(b=>b.octave===n))return n;}
  return null;
}
function changeBankOctave(bank,raw){
  const n=Number(raw);
  if(String(raw).trim()===''||!Number.isInteger(n)||n<0||n>8)return 'オクターブは0～8の整数にしてください。';
  if(banks.some(b=>b!==bank&&b.octave===n))return 'オクターブ '+n+' はすでに存在します。';
  bank.octave=n;return '';
}
function refreshBankControls(){
  $('addOctave').disabled=banks.length>=9;
  for(const b of banks){b.element.querySelector('.remove-bank').disabled=banks.length===1;b.element.setAttribute('aria-label','オクターブ '+b.octave);for(let i=0;i<12;i++)b.element.querySelectorAll('.notes input')[i].setAttribute('aria-label',names[i]+b.octave+' の音量');}
}
function addBank(){
  const source=banks.at(-1),oct=unusedOctave(source?source.octave:3);if(oct===null)return;
  const bank={id:nextBankId++,octave:oct,timbre:source?.timbre||'sine',volume:source?.volume??1,levels:source?Float64Array.from(source.levels):new Float64Array(12)};
  const el=document.createElement('section');bank.element=el;el.className='octave-bank';el.dataset.bank=bank.id;
  el.innerHTML=`<div class="chord-controls"><strong>コード理論の裏側</strong><select class="bank-timbre" aria-label="音色"><option value="sine">サイン波</option><option value="triangle">三角波</option><option value="sawtooth">ノコギリ波</option><option value="square">矩形波</option><option value="organ">オルガン</option><option value="strings">ストリングス</option><option value="guitar">ギター</option><option value="piano">ピアノ</option></select><label>音源オクターブ <input class="bank-octave" type="number" min="0" max="8" step="1" style="width:64px"></label><button class="remove-bank" style="margin-left:auto" aria-label="このオクターブを削除">×</button></div><div class="bank-error" role="status"></div><div class="notes"></div><div class="row" style="margin-top:10px"><label class="volume">音量 <input class="bank-volume" type="range" min="0" max="1" step="0.01"></label></div>`;
  const find=s=>el.querySelector(s),error=find('.bank-error');
  find('.bank-timbre').value=bank.timbre;find('.bank-octave').value=oct;find('.bank-volume').value=bank.volume;
  for(let i=0;i<12;i++){
    const note=document.createElement('label');note.className='note'+([1,3,6,8,10].includes(i)?' black':'');note.classList.toggle('on',bank.levels[i]>0);
    const value=Math.round(bank.levels[i]*100);note.innerHTML=`<b>${names[i]}</b><input type="range" min="0" max="100" step="1" value="${value}"><output>${value}</output>`;
    note.querySelector('input').oninput=async e=>{bank.levels[i]=Number(e.target.value)/100;note.querySelector('output').textContent=e.target.value;note.classList.toggle('on',bank.levels[i]>0);try{await audioSetup();setNote(bank,i);}catch(err){status(err.message,true);}};
    find('.notes').append(note);
  }
  const commitOctave=e=>{const previous=bank.octave,message=changeBankOctave(bank,e.target.value);e.target.value=bank.octave;if(message)error.textContent=message;else if(previous!==bank.octave){error.textContent='';refreshBankControls();rebuildChord(bank);}};
  find('.bank-octave').onchange=commitOctave;
  find('.bank-octave').onblur=commitOctave;
  find('.bank-timbre').onchange=e=>{bank.timbre=e.target.value;rebuildChord(bank);};
  find('.bank-volume').oninput=e=>{bank.volume=Number(e.target.value);for(let i=0;i<12;i++)setNote(bank,i);};
  find('.remove-bank').onclick=()=>{if(banks.length===1)return;killVoices(bank);banks.splice(banks.indexOf(bank),1);el.remove();refreshBankControls();};
  banks.push(bank);$('octaveBanks').append(el);refreshBankControls();rebuildChord(bank);
  if(source)el.scrollIntoView({block:'nearest',behavior:'smooth'});
}
function stopMic(){
  micTicket++;if(stream){for(const t of stream.getTracks())t.stop();stream=null;}
  if(micNode){micNode.disconnect();micNode=null;}$('micToggle').textContent='マイクを開始';
}
async function startMic(){
  const ticket=++micTicket;
  $('micToggle').disabled=true;status('マイクへのアクセスを待っています…');
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw Error('マイクはHTTPSまたはlocalhostで開いてください。');
    await audioSetup();
    const incoming=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
    if(ticket!==micTicket||mode!=='mic'){incoming.getTracks().forEach(t=>t.stop());return;}
    stream=incoming;micNode=audioCtx.createMediaStreamSource(stream);micNode.connect(analyser);
    stream.getAudioTracks().forEach(t=>t.addEventListener('ended',()=>{if(stream===incoming){stopMic();resetAnalysis();status('マイクが切断されました。');}}));
    $('micToggle').textContent='■ マイクを停止';status('マイク入力中 · スピーカー出力なし');restartAnalysis();
  }catch(e){if(ticket===micTicket)status(e.name==='NotAllowedError'?'マイクの使用が許可されませんでした。ブラウザーの権限設定を確認してください。':e.message,true);}
  finally{if(ticket===micTicket)$('micToggle').disabled=false;}
}
async function chooseMode(next){
  if(mode!==next){media.pause();stopMic();killVoices();mode=next;resetAnalysis();}
  document.body.dataset.mode=mode;
  if(masterGain)masterGain.gain.value=mode==='chord'?1:0;
  for(const key of ['file','mic','chord'])$(key+'Panel').hidden=mode!==key;
  $('outputControls').hidden=mode==='mic';$('cancelMode').hidden=false;$('modeDialog').close();
  $('micToggle').disabled=false;
  if(mode==='file'){
    status(media.src?'音声を再生して解析できます。':'音声ファイルを選んでください。');
    if(!fileURL)$('fileInput').click();
  }else if(mode==='mic'){if(!stream)await startMic();}
  else{try{await audioSetup();masterGain.gain.value=1;rebuildChord();status('音量バーを動かして和音をつくります。');restartAnalysis();}catch(e){status(e.message,true);}}
  restartAnalysis();
}
for(let i=0;i<12;i++){
  const opt=document.createElement('option');opt.value=i;opt.textContent=names[i];$('edge').append(opt);
}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>chooseMode(b.dataset.mode));
$('changeMode').onclick=()=>{$('modeDialog').showModal();};
$('cancelMode').onclick=()=>{$('modeDialog').close();restartAnalysis();};
$('modeDialog').addEventListener('cancel',e=>{if(!mode)e.preventDefault();});
$('modeDialog').addEventListener('close',()=>restartAnalysis());
$('pickFile').onclick=()=>$('fileInput').click();
$('fileInput').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  selectedFile=file;fileRevision++;decodedFile=null;decodePromise=null;wholeCache=null;
  media.pause();if(fileURL)URL.revokeObjectURL(fileURL);fileURL=URL.createObjectURL(file);media.src=fileURL;
  $('fileName').setAttribute('data-no-i18n','');$('fileName').textContent=file.name;$('fileName').title=file.name;$('filePlay').disabled=true;$('seek').disabled=true;
  resetAnalysis();status('音声を読み込んでいます…');media.load();e.target.value='';restartAnalysis();
};
media.addEventListener('loadedmetadata',()=>{
  $('filePlay').disabled=false;$('seek').disabled=!Number.isFinite(media.duration);$('seek').max=Number.isFinite(media.duration)?media.duration:1;
  updateTransport();status('再生ボタンで開始します。');
});
media.addEventListener('error',()=>{status('この音声を読み込めませんでした。対応形式はブラウザーのコーデックに依存します。別のWAVまたはMP3でもお試しください。',true);$('filePlay').disabled=true;});
media.addEventListener('play',()=>{$('filePlay').textContent='Ⅱ 一時停止';if(mode==='file')status('再生中');restartAnalysis();});
media.addEventListener('pause',()=>{$('filePlay').textContent='▶ 再生';updateTransport();if(mode==='file')status('一時停止');});
media.addEventListener('ended',()=>{$('filePlay').textContent='▶ 再生';updateTransport();if(mode==='file')status('再生終了');});
media.addEventListener('timeupdate',updateTransport);
function timeLabel(v){if(!Number.isFinite(v))return '—';const s=Math.floor(v);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
function updateTransport(){if(!$('seek').matches(':active'))$('seek').value=media.currentTime;$('time').textContent=timeLabel(media.currentTime)+' / '+timeLabel(media.duration);}
$('filePlay').onclick=async()=>{try{await audioSetup();if(media.paused)await media.play();else media.pause();}catch(e){status('再生できませんでした：'+e.message,true);}};
$('seek').oninput=e=>{if(Number.isFinite(media.duration)){media.currentTime=Number(e.target.value);if($('fileScope').value!=='whole')resetAnalysis();updateTransport();}};
$('micToggle').onclick=()=>{if(stream){stopMic();resetAnalysis();status('マイクを停止しました。');}else startMic();};
$('chordPlay').onclick=async()=>{try{await audioSetup();if(mode!=='chord')return;chordPlaying=!chordPlaying;$('chordPlay').textContent=chordPlaying?'■ 停止':'▶ 発音';rebuildChord();restartAnalysis();}catch(e){status(e.message,true);}};
$('chordStrike').onclick=()=>rebuildChord();
$('chordClear').onclick=()=>{killVoices();for(const bank of banks){bank.levels.fill(0);const notes=bank.element.querySelector('.notes');notes.querySelectorAll('input').forEach(e=>e.value=0);notes.querySelectorAll('output').forEach(e=>e.textContent='0');notes.querySelectorAll('.note').forEach(e=>e.classList.remove('on'));}};
$('addOctave').onclick=addBank;
addBank();
$('volume').oninput=e=>{if(programGain)programGain.gain.setTargetAtTime(Number(e.target.value),audioCtx.currentTime,.01);if(mode==='file'&&$('fileScope').value==='whole'){resetAnalysis();restartAnalysis();}};
$('fileScope').onchange=()=>{resetAnalysis();restartAnalysis();};
function options(){
  const N=Number($('harmonics').value),a4=Number($('a4').value),max=Number($('yMax').value);
  if(!Number.isInteger(N)||N<2||N>128)throw Error('倍音上限は2～128の整数にしてください。');
  if(!Number.isFinite(a4)||a4<300||a4>500)throw Error('A4は300～500Hzにしてください。');
  if($('yMode').value==='fixed'&&(!Number.isFinite(max)||max<=0))throw Error('縦軸上限は正の有限値にしてください。');
  return {view,axis:$('axis').value,edge:Number($('edge').value),octave,N,a4,weight:$('weight').value};
}
function resetAnalysis(){cancelWhole();generation++;frame=null;lastBounds=null;hover=null;dirty=true;$('freeze').disabled=true;}
function stopWorker(){clearTimeout(timer);timer=0;generation++;if(worker)worker.terminate();worker=null;pending=false;if(workerURL)URL.revokeObjectURL(workerURL);workerURL=null;}
function restartAnalysis(){clearTimeout(timer);if(!pending)timer=setTimeout(tick,0);}
function tick(){
  if(document.hidden||!mode||pending)return;
  if(mode==='file'&&$('fileScope').value==='whole'){analyseWhole();return;}
  if(!analyser)return;
  if($('modeDialog').open){timer=setTimeout(tick,100);return;}
  let opts;
  try{opts=options();}catch(e){status(e.message,true);timer=setTimeout(tick,250);return;}
  if(mode==='mic'&&!stream){timer=setTimeout(tick,100);return;}
  const fft=Number($('fft').value);
  if(analyser.fftSize!==fft||!fftData){analyser.fftSize=fft;fftData=new Float32Array(fft);}
  analyser.getFloatTimeDomainData(fftData);
  if(!worker){
    const source=audioPower.toString()+'\n'+analyse.toString()+`;onmessage=e=>{try{const start=performance.now();const spectrum=audioPower(e.data.samples,e.data.sampleRate);const result=analyse(spectrum.power,spectrum.df,e.data.options);result.windowMs=e.data.samples.length/e.data.sampleRate*1000;result.df=spectrum.df;postMessage({result,generation:e.data.generation,ms:performance.now()-start},[result.x.buffer,result.re.buffer,result.im.buffer]);}catch(err){postMessage({error:err.message,generation:e.data.generation});}}`;
    workerURL=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
    try{worker=new Worker(workerURL);}catch(e){status('解析Workerを開始できません：'+e.message,true);stopWorker();return;}
    worker.onmessage=e=>{
      pending=false;
      if(e.data.generation===generation){if(e.data.error)status(e.data.error,true);else{frame=e.data.result;computeMs=e.data.ms;dirty=true;}}
      timer=setTimeout(tick,Math.max(0,Number($('interval').value)-(performance.now()-sentAt)));
    };
    worker.onerror=e=>{status('解析処理でエラーが発生しました：'+e.message,true);stopWorker();};
  }
  pending=true;sentAt=performance.now();worker.postMessage({samples:fftData,sampleRate:audioCtx.sampleRate,options:opts,generation});
}
let sentAt=0;
function updateAxis(){
  const edge=Number($('edge').value);$('pager').hidden=$('axis').value!=='octave';
  $('octavePage').textContent=names[edge]+octave+' – '+names[edge]+(octave+1);
  $('prevOct').disabled=octave<=-8;$('nextOct').disabled=octave>=18;
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{
  view=b.dataset.view;document.querySelectorAll('[data-view]').forEach(x=>{const on=x===b;x.classList.toggle('active',on);x.setAttribute('aria-pressed',on);});
  $('legend').hidden=!isVector();
  $('legend').innerHTML=view==='characteristic'?'<span>−180°</span><span class="gradient" style="background:linear-gradient(90deg,#ed5ced,#5c5ced,#5ceded,#5ced5c,#eded5c,#ed5c5c,#ed5ced)"></span><span>+180° · S −120° / P 0° / H +120°</span>':'<span>−90°</span><span class="gradient"></span><span>+90°</span>';
  resetAnalysis();restartAnalysis();
});
$('prevOct').onclick=()=>{octave=Math.max(-8,octave-1);updateAxis();resetAnalysis();restartAnalysis();};
$('nextOct').onclick=()=>{octave=Math.min(18,octave+1);updateAxis();resetAnalysis();restartAnalysis();};
for(const id of ['axis','edge','weight','harmonics','fft','a4'])$(id).addEventListener('change',()=>{
  try{options();if(id==='a4')rebuildChord();updateAxis();resetAnalysis();restartAnalysis();}catch(e){status(e.message,true);}
});
for(const id of ['angles','yMode','yMax'])$(id).addEventListener('change',()=>{$('yMax').disabled=$('yMode').value!=='fixed';dirty=true;});
$('freeze').onclick=()=>{if(!lastBounds)return;$('yMax').value=String(Math.max(Math.abs(lastBounds.min),lastBounds.max));$('yMode').value='fixed';$('yMax').disabled=false;dirty=true;};
function isVector(){return view==='vector'||view==='characteristic';}
function vectorColor(p,v){return view==='characteristic'?characteristicColor(p,v):phaseColor(p,v);}
function yBounds(y){
  const fixed=$('yMode').value==='fixed',limit=Number($('yMax').value);
  if(fixed&&Number.isFinite(limit)&&limit>0)return {min:view==='term'?-limit:0,max:limit};
  let max=0;for(const v of y)max=Math.max(max,Math.abs(v));max=max>1e-24?max*1.16:1e-8;
  return {min:view==='term'?-max:0,max};
}
function draw(){
  const canvas=$('plot'),w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(2,devicePixelRatio||1);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#090d0f';ctx.fillRect(0,0,w,h);
  const l=w<500?64:84,r=w-22,t=38,b=h-62;
  const d=frame;
  if(!d){ctx.fillStyle='#82949e';ctx.font='13px system-ui';ctx.textAlign='center';paintText(ctx,mode?'音声入力を待っています':'入力を選んでください',w/2,h/2);$('readout').textContent='—';return;}
  const y=Float64Array.from(d.re,(p,i)=>view==='power'?p:view==='term'?d.im[i]:Math.hypot(p,d.im[i]));
  const bounds=yBounds(y);lastBounds=bounds;$('freeze').disabled=false;
  const px=v=>l+(v-d.lo)/(d.hi-d.lo)*(r-l),py=v=>b-(v-bounds.min)/(bounds.max-bounds.min)*(b-t);
  ctx.font='11px system-ui';ctx.lineWidth=1;
  for(let j=0;j<=4;j++){
    const v=bounds.min+(bounds.max-bounds.min)*j/4,yy=py(v);ctx.strokeStyle='#202a30';ctx.beginPath();ctx.moveTo(l,yy);ctx.lineTo(r,yy);ctx.stroke();
    ctx.textAlign='right';ctx.fillStyle='#859aa6';paintText(ctx,v===0?'0':v.toExponential(2),l-10,yy+4);
  }
  ctx.textAlign='left';ctx.fillStyle='#a8c1ca';paintText(ctx,view==='power'?'P(f)':view==='term'?'Π(f)':'|Z(f)|',l,20);
  ctx.textAlign='right';ctx.fillStyle='#6f8792';paintText(ctx,(d.whole?'音声全体（STFT平均） · ':'現在位置 · ')+'線形二乗強度',r,20);
  ctx.textAlign='center';ctx.fillStyle='#a9bdc7';
  if(d.options.axis==='fold'||d.options.axis==='octave'){
    for(let k=0;k<=12;k++){
      const x=d.lo+k/12,m=d.options.edge+k,pc=m%12,oct=d.options.octave+Math.floor(m/12);
      paintText(ctx,names[pc]+(d.options.axis==='octave'?oct:''),px(x),b+23);
      if(d.options.axis==='octave'&&(k===0||k===6||k===12))paintText(ctx,(d.root*2**x).toFixed(1)+' Hz',px(x),b+44);
    }
  }else{
    const step=Math.max(1,Math.ceil((d.hi-d.lo)*82/(r-l)));
    for(let oct=Math.ceil(d.lo/step)*step;oct<=d.hi;oct+=step){paintText(ctx,names[d.options.edge]+oct,px(oct),b+23);paintText(ctx,(d.root*2**oct).toPrecision(3)+' Hz',px(oct),b+44);}
  }
  ctx.save();ctx.beginPath();ctx.rect(l,t,r-l,b-t);ctx.clip();
  if(view==='term'){ctx.strokeStyle='#6c8089';ctx.beginPath();ctx.moveTo(l,py(0));ctx.lineTo(r,py(0));ctx.stroke();}
  const ix=[];
  for(let start=0;start<y.length;){const col=Math.floor(px(d.x[start]));let end=start+1,min=start,max=start;
    while(end<y.length&&Math.floor(px(d.x[end]))===col){if(y[end]<y[min])min=end;if(y[end]>y[max])max=end;end++;}
    ix.push(...[...new Set([start,min,max,end-1])].sort((a,b)=>a-b));start=end;
  }
  ctx.lineWidth=1.6;
  if(!isVector()){
    ctx.strokeStyle=view==='power'?'#84dbcc':'#97b9f5';ctx.beginPath();ix.forEach((i,j)=>j?ctx.lineTo(px(d.x[i]),py(y[i])):ctx.moveTo(px(d.x[i]),py(y[i])));ctx.stroke();
  }else for(let j=1;j<ix.length;j++){const a=ix[j-1],i=ix[j];ctx.strokeStyle=vectorColor(d.re[i],d.im[i]);ctx.beginPath();ctx.moveTo(px(d.x[a]),py(y[a]));ctx.lineTo(px(d.x[i]),py(y[i]));ctx.stroke();}
  ctx.restore();
  if(isVector()&&$('angles').checked){
    const candidates=peakIndices(y,d.options.axis==='fold').filter(i=>y[i]>bounds.max*.015&&y[i]<=bounds.max).sort((a,b)=>y[b]-y[a]),boxes=[];
    for(const i of candidates){
      const angle=Math.atan2(d.im[i],d.re[i])*180/Math.PI,label=angle.toFixed(1)+'°',width=ctx.measureText(label).width+10;
      const xx=Math.max(l+width/2,Math.min(r-width/2,px(d.x[i]))),yy=Math.max(t+12,py(y[i])-9),box={l:xx-width/2,r:xx+width/2,t:yy-12,b:yy+2};
      if(boxes.some(b=>box.l<b.r&&box.r>b.l&&box.t<b.b&&box.b>b.t))continue;
      ctx.fillStyle=vectorColor(d.re[i],d.im[i]);paintText(ctx,label,xx,yy);boxes.push(box);if(boxes.length>=60)break;
    }
  }
  if(hover!==null){
    const target=d.lo+Math.max(0,Math.min(1,(hover-l)/(r-l)))*(d.hi-d.lo);let low=0,high=d.x.length-1;
    while(low<high){const mid=(low+high)>>1;if(d.x[mid]<target)low=mid+1;else high=mid;}
    const i=low&&Math.abs(d.x[low-1]-target)<Math.abs(d.x[low]-target)?low-1:low;
    ctx.strokeStyle='#ffffff30';ctx.beginPath();ctx.moveTo(px(d.x[i]),t);ctx.lineTo(px(d.x[i]),b);ctx.stroke();
    const midi=12*d.x[i]+d.options.edge+12,nearest=Math.round(midi),pc=((nearest%12)+12)%12;
    const location=names[pc]+(d.options.axis==='fold'?'':Math.floor(nearest/12)-1)+' '+((midi-nearest)*100).toFixed(1)+' c';
    $('readout').textContent=location+' · '+(d.options.axis==='fold'?'':(d.root*2**d.x[i]).toFixed(2)+' Hz · ')+y[i].toExponential(4)+(isVector()&&y[i]>0?' · '+(Math.atan2(d.im[i],d.re[i])*180/Math.PI).toFixed(2)+'°':'');
  }else $('readout').textContent=(d.options.axis==='fold'?'オクターブ集計':d.options.axis==='full'?'全周波数':$('octavePage').textContent)+(d.whole?' · 音声全体 STFT平均（'+d.count+'フレーム）':'')+' · '+d.windowMs.toFixed(0)+' ms 窓 · FFT刻み '+d.df.toFixed(2)+' Hz';
  canvas.setAttribute('aria-label',(view==='power'?'音高周波数値':view==='term'?'調波極性(スカラー)':view==='characteristic'?'調波特性ベクトル':'調波極性ベクトル')+'。縦軸 '+bounds.min.toExponential(2)+' ～ '+bounds.max.toExponential(2));
}
$('plot').addEventListener('pointermove',e=>{hover=e.clientX-$('plot').getBoundingClientRect().left;dirty=true;});
$('plot').addEventListener('pointerleave',()=>{hover=null;dirty=true;});
new ResizeObserver(()=>dirty=true).observe($('plotWrap'));
function animate(){if(dirty&&!document.hidden){const start=performance.now();draw();drawMs=performance.now()-start;dirty=false;}raf=requestAnimationFrame(animate);}
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopWorker();cancelWhole();}else{dirty=true;restartAnalysis();}});
window.addEventListener('pagehide',()=>{stopMic();killVoices();stopWorker();cancelWhole();if(fileURL)URL.revokeObjectURL(fileURL);audioCtx?.close();});
updateAxis();$('freeze').disabled=true;$('modeDialog').showModal();animate();

installLanguage();
