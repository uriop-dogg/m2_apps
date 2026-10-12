// WAV decoding preserves source sampling rate; browser codecs handle other formats.
export function decodeWav(buffer){
 const d=new DataView(buffer),str=(p,n)=>String.fromCharCode(...new Uint8Array(buffer,p,n));
 if(buffer.byteLength<44||str(0,4)!=='RIFF'||str(8,4)!=='WAVE')return null;
 let format,channels,sampleRate,bits,align,dataStart=0,dataSize=0;
 for(let p=12;p+8<=d.byteLength;){const id=str(p,4),size=d.getUint32(p+4,true),start=p+8;if(start+size>d.byteLength)throw Error('Truncated WAV');if(id==='fmt '){if(size<16)throw Error('Invalid WAV format');format=d.getUint16(start,true);channels=d.getUint16(start+2,true);sampleRate=d.getUint32(start+4,true);align=d.getUint16(start+12,true);bits=d.getUint16(start+14,true);if(format===65534&&size>=40)format=d.getUint16(start+24,true);}if(id==='data'){dataStart=start;dataSize=size;}p=start+size+(size%2);}
 if(![1,3].includes(format))return null;
 if(!dataStart||channels<1||channels>8||sampleRate<8000||sampleRate>384000||align!==channels*bits/8||(format===1?![8,16,24,32].includes(bits):![32,64].includes(bits)))throw Error('Unsupported WAV format');
 const length=Math.floor(dataSize/align),pcm=Array.from({length:channels},()=>new Float32Array(length));
 for(let i=0;i<length;i++)for(let c=0;c<channels;c++){const p=dataStart+i*align+c*bits/8;let v;if(format===3)v=bits===32?d.getFloat32(p,true):d.getFloat64(p,true);else if(bits===8)v=(d.getUint8(p)-128)/128;else if(bits===16)v=d.getInt16(p,true)/32768;else if(bits===24){let k=d.getUint8(p)|d.getUint8(p+1)<<8|d.getUint8(p+2)<<16;if(k&0x800000)k-=0x1000000;v=k/8388608;}else v=d.getInt32(p,true)/2147483648;if(!Number.isFinite(v))throw Error('Non-finite audio sample');pcm[c][i]=v;}
 return {pcm,sampleRate,duration:length/sampleRate};
}
export function crop(source,start,end){const a=Math.round(start*source.sampleRate),b=Math.min(source.pcm[0].length,Math.round(end*source.sampleRate));if(b-a<source.sampleRate*.1)throw Error('RANGE_TOO_SHORT');return {pcm:source.pcm.map(c=>c.slice(a,b)),sampleRate:source.sampleRate,duration:(b-a)/source.sampleRate,offset:(source.offset||0)+a/source.sampleRate};}
export function monoOf(pcm){const m=new Float32Array(pcm[0].length);for(let i=0;i<m.length;i++){let s=0;for(const c of pcm)s+=c[i];m[i]=s/pcm.length;}return m;}
export class Player{
 constructor(){this.ctx=null;this.source=null;this.buffer=null;this.offset=0;this.started=0;this.playing=false;this.pending=false;this.generation=0;this.volume=.6;}
 context(){if(!this.ctx){this.ctx=new AudioContext();this.gain=this.ctx.createGain();this.gain.connect(this.ctx.destination);this.gain.gain.value=this.volume;}return this.ctx;}
 set(track){this.pause();const ctx=this.context();this.buffer=ctx.createBuffer(track.pcm.length,track.pcm[0].length,track.sampleRate);track.pcm.forEach((a,i)=>this.buffer.copyToChannel(a,i));this.offset=0;}
 position(){if(!this.buffer)return 0;return Math.min(this.buffer.duration,this.playing?this.offset+this.ctx.currentTime-this.started:this.offset);}
 async play(){if(!this.buffer||this.playing||this.pending)return;const token=++this.generation;this.pending=true;try{await this.ctx.resume();}catch(e){if(token===this.generation)this.pending=false;throw e;}if(token!==this.generation)return;this.pending=false;if(this.position()>=this.buffer.duration)this.offset=0;this.source=this.ctx.createBufferSource();this.source.buffer=this.buffer;this.source.connect(this.gain);this.started=this.ctx.currentTime;this.source.start(0,this.offset);this.playing=true;const source=this.source;source.onended=()=>{if(this.source===source&&this.playing){this.offset=this.buffer.duration;this.playing=false;this.source=null;}};}
 pause(){const p=this.position();this.generation++;this.pending=false;this.playing=false;if(this.source){this.source.onended=null;try{this.source.stop();}catch{}this.source.disconnect();this.source=null;}this.offset=p;}
 seek(t){const resume=this.playing||this.pending;this.pause();this.offset=Math.max(0,Math.min(this.buffer?.duration||0,t));if(resume)return this.play();}
 setVolume(v){this.volume=v;if(this.gain)this.gain.gain.value=v;}
}
