const fs=require('fs'),assert=require('assert');
const {audioPower,analyse}=new Function(fs.readFileSync(__dirname+'/kernel.js','utf8')+';return {audioPower,analyse}')();
function direct(samples,sr,f){let re=0,im=0;for(let i=0;i<samples.length;i++){const v=samples[i]*(.42-.5*Math.cos(2*Math.PI*i/samples.length)+.08*Math.cos(4*Math.PI*i/samples.length));re+=v*Math.cos(2*Math.PI*f*i/sr);im-=v*Math.sin(2*Math.PI*f*i/sr);}return (re*re+im*im)/samples.length**2;}
for(const sr of [44100,48000]){
 const small=Float64Array.from({length:128},(_,i)=>Math.sin(i*.31)+.2*Math.cos(i*.7));
 for(const padding of [1,4,8]){
  const s=audioPower(small,sr,padding);
  for(const i of [1,7,23,50])assert(Math.abs(s.power[i]-direct(small,sr,i*s.df))<1e-13);
 }
}
const sr=48000,n=8192,f=440*2**(-9/12),samples=Float32Array.from({length:n},(_,i)=>.1*Math.sin(2*Math.PI*f*i/sr));
const coarse=audioPower(samples,sr,1),fine=audioPower(samples,sr,8);
const sample=(s,f)=>{const t=f/s.df,i=Math.floor(t);return s.power[i]*(1-t+i)+s.power[i+1]*(t-i)};
let oldError=0,newError=0;
for(let k=0;k<=100;k++){const hz=f-15+k*.3,exact=direct(samples,sr,hz);oldError+=(sample(coarse,hz)-exact)**2;newError+=(sample(fine,hz)-exact)**2;}
assert(newError<oldError/100);
for(let i=1;i<coarse.power.length;i++)assert(Math.abs(coarse.power[i]-fine.power[i*8])<1e-14);
console.log('RMS interpolation error ratio:',Math.sqrt(newError/oldError).toFixed(4));
const o={a4:440,edge:0,octave:4,N:32,view:'vector',axis:'fold',weight:'saw'};
for(let i=0;i<3;i++){const s=audioPower(samples,sr);analyse(s.power,s.df,o);}
const start=performance.now();for(let i=0;i<10;i++){const s=audioPower(samples,sr);analyse(s.power,s.df,o);}
console.log('8192-sample, padded FFT + vector fold:',((performance.now()-start)/10).toFixed(1),'ms/frame');
console.log('PASS FFT vs direct transform, padding preserves original bins and normalization, sine curve accuracy.');
