const assert=require('assert');require('../dsp.js');
for(const n of [4096,8192,16384,32768]){
 const s={n,hop:n/4,iterations:24,f0:440,c:Math.log2(3)%1,method:'agla'},x=Float32Array.from({length:3000},(_,i)=>.2*Math.sin(i*.031)+.1*Math.sin(i*.079));
 const y=NHDSP.convertChannel(x,44100,s);assert.equal(y.length,x.length);assert(y.every(Number.isFinite));assert(y.some(v=>Math.abs(v)>.001));assert.deepStrictEqual(y,NHDSP.convertChannel(x,44100,s));
 const right=NHDSP.convertChannel(Float32Array.from(x,v=>v*.25),44100,s);assert(right.every((v,i)=>Math.abs(v-y[i]*.25)<1e-6));
 for(const hop of [n/16,n/2])assert(NHDSP.convertChannel(new Float32Array(17),44100,{...s,hop}).every(v=>v===0));
 const wav=NHDSP.wav([y,right],44100),v=new DataView(wav.buffer);assert.equal(v.getUint16(22,true),2);assert.equal(v.getUint32(40,true),x.length*4);
}
console.log('PASS AGLA four windows, determinism, finite output, silence, hop limits, stereo scale and WAV');
