function connectOscillator(bus,sources,now,freq,type="sine",level=1,harmonic=1){
  const osc=audioCtx.createOscillator(), gain=audioCtx.createGain();
  osc.type=type;
  osc._amtHarmonic=harmonic;
  osc.frequency.setValueAtTime(freq*harmonic,now);
  gain.gain.setValueAtTime(level,now);
  osc.connect(gain);gain.connect(bus);osc.start(now);
  sources.push(osc);
  return osc;
}
function addNoiseTransient(bus,sources,now,duration=.035,level=.06){
  const count=Math.max(1,Math.floor(audioCtx.sampleRate*duration));
  const buffer=audioCtx.createBuffer(1,count,audioCtx.sampleRate);
  const data=buffer.getChannelData(0);
  const fadeIn=Math.max(1,Math.min(count,Math.floor(audioCtx.sampleRate*.0015)));
  const fadeOut=Math.max(1,Math.min(count,Math.floor(audioCtx.sampleRate*.008)));
  for(let i=0;i<count;i++){
    const decay=Math.exp(-7*i/count);
    const inGain=i<fadeIn?Math.sin((i/fadeIn)*Math.PI/2):1;
    const remaining=count-1-i;
    const outGain=remaining<fadeOut?Math.sin((remaining/fadeOut)*Math.PI/2):1;
    data[i]=(Math.random()*2-1)*decay*inGain*outGain;
  }
  // バッファの最終サンプルを厳密に0にして、BufferSource自然終了時の段差を除く。
  data[count-1]=0;
  const src=audioCtx.createBufferSource(), gain=audioCtx.createGain();
  src.buffer=buffer;gain.gain.setValueAtTime(level,now);
  src.connect(gain);gain.connect(bus);src.start(now);sources.push(src);
}
function buildVoice(freq,timbre,now){
  const sources=[];
  const sourceBus=audioCtx.createGain();
  const amp=audioCtx.createGain();
  // ampはアタック／音色固有の減衰専用。
  // キーリリースは別のreleaseGateで行い、進行中のamp自動化を中断しない。
  const releaseGate=audioCtx.createGain();
  const userAttack=Math.max(.001,Number($("attack").value)/1000);
  const userRelease=Math.max(.01,Number($("release").value)/1000);
  let attack=userAttack,release=userRelease,peak=.16,sustain=.16,decayTime=0;
  let outputNode=sourceBus;

  const addFilter=(type,frequency,q=.7)=>{
    const filter=audioCtx.createBiquadFilter();
    filter.type=type;filter.frequency.setValueAtTime(frequency,now);filter.Q.setValueAtTime(q,now);
    sourceBus.connect(filter);outputNode=filter;
  };

  switch(timbre){
    case "organ":
      connectOscillator(sourceBus,sources,now,freq,"sine",1.00,1);
      connectOscillator(sourceBus,sources,now,freq,"sine",.42,2);
      connectOscillator(sourceBus,sources,now,freq,"sine",.23,3);
      connectOscillator(sourceBus,sources,now,freq,"sine",.12,4);
      attack=Math.max(userAttack,.018);release=Math.max(userRelease,.22);peak=.105;sustain=.105;
      break;
    case "strings":
      connectOscillator(sourceBus,sources,now,freq,"sawtooth",.45,1);
      connectOscillator(sourceBus,sources,now,freq,"triangle",.42,1);
      connectOscillator(sourceBus,sources,now,freq,"sine",.16,2);
      addFilter("lowpass",Math.min(5200,Math.max(1450,freq*10)),.8);
      attack=Math.max(userAttack,.16);release=Math.max(userRelease,.85);peak=.105;sustain=.09;decayTime=.8;
      break;
    case "guitar":
      connectOscillator(sourceBus,sources,now,freq,"triangle",.82,1);
      connectOscillator(sourceBus,sources,now,freq,"sine",.34,2);
      connectOscillator(sourceBus,sources,now,freq,"sine",.18,3);
      connectOscillator(sourceBus,sources,now,freq,"sine",.09,4);
      addNoiseTransient(sourceBus,sources,now,.025,.035);
      addFilter("lowpass",Math.min(6200,Math.max(1800,freq*13)),.7);
      attack=Math.max(userAttack,.004);release=Math.max(userRelease,.38);peak=.18;sustain=.018;decayTime=.46;
      break;
    case "piano":
      connectOscillator(sourceBus,sources,now,freq,"sine",1.00,1);
      connectOscillator(sourceBus,sources,now,freq,"triangle",.30,2);
      connectOscillator(sourceBus,sources,now,freq,"sine",.17,3);
      connectOscillator(sourceBus,sources,now,freq,"sine",.08,4);
      connectOscillator(sourceBus,sources,now,freq,"sine",.035,6);
      addNoiseTransient(sourceBus,sources,now,.018,.028);
      addFilter("lowpass",Math.min(7600,Math.max(2200,freq*16)),.65);
      attack=Math.max(userAttack,.003);release=Math.max(userRelease,.52);peak=.17;sustain=.022;decayTime=.68;
      break;
    default:
      connectOscillator(sourceBus,sources,now,freq,["sine","triangle","sawtooth","square"].includes(timbre)?timbre:"triangle",1,1);
      peak=.16;sustain=.16;
  }

  outputNode.connect(amp);
  amp.connect(releaseGate);
  releaseGate.connect(masterGain);
  releaseGate.gain.setValueAtTime(1,now);
  amp.gain.setValueAtTime(.0001,now);
  amp.gain.exponentialRampToValueAtTime(peak,now+attack);
  if(decayTime>0) amp.gain.setTargetAtTime(sustain,now+attack,decayTime);
  return {sources,sourceBus,outputNode,amp,releaseGate,release,timbre,frequency:freq};
}
function releaseVoice(v){
  if(!v||!audioCtx)return;
  const now=audioCtx.currentTime,rel=Math.max(.06,v.release);
  const gate=v.releaseGate.gain;
  gate.cancelScheduledValues(now);
  gate.setValueAtTime(Math.max(1e-5,gate.value||1),now);
  gate.exponentialRampToValueAtTime(1e-5,now+rel);
  const stopAt=now+rel+.04;
  v.sources.forEach(source=>{try{source.stop(stopAt)}catch{}});
  window.setTimeout(()=>{
    const nodes=new Set([v.sourceBus,v.outputNode,v.amp,v.releaseGate,...v.sources]);
    nodes.forEach(node=>{try{node?.disconnect()}catch{}});
  },Math.ceil((rel+.14)*1000));
}
