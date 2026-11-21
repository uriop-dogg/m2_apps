/* Original implementation. No external dependencies. */
(function(root){
'use strict';
const mod=x=>((x%1)+1)%1;
function mappedFrequency(f,f0,c){if(f<=0)return 0;const x=Math.log2(f/f0),n=Math.floor(x);return f0*2**(n+mod(c-(x-n)));}
class FFT{
 constructor(n){this.n=n;this.rev=new Uint32Array(n);this.cos=new Float64Array(n/2);this.sin=new Float64Array(n/2);let bits=Math.log2(n);for(let i=0;i<n;i++){let a=i,b=0;for(let j=0;j<bits;j++){b=(b<<1)|(a&1);a>>=1;}this.rev[i]=b;}for(let i=0;i<n/2;i++){this.cos[i]=Math.cos(2*Math.PI*i/n);this.sin[i]=Math.sin(2*Math.PI*i/n);}}
 run(re,im,inverse=false){const n=this.n;for(let i=0;i<n;i++){let j=this.rev[i];if(j>i){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}for(let len=2;len<=n;len*=2){let half=len/2,step=n/len;for(let base=0;base<n;base+=len)for(let j=0;j<half;j++){let k=j*step,c=this.cos[k],s=this.sin[k]*(inverse?1:-1),a=base+j,b=a+half,tr=re[b]*c-im[b]*s,ti=re[b]*s+im[b]*c;re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;}}if(inverse)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n;}}
}
function wav(ch,sr){let frames=ch[0].length,buffer=new ArrayBuffer(44+frames*ch.length*2),v=new DataView(buffer);const str=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};str(0,'RIFF');v.setUint32(4,buffer.byteLength-8,true);str(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,ch.length,true);v.setUint32(24,sr,true);v.setUint32(28,sr*ch.length*2,true);v.setUint16(32,ch.length*2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,buffer.byteLength-44,true);let peak=0;for(const a of ch)for(const x of a)peak=Math.max(peak,Math.abs(x));let gain=peak>10**(-1/20)?10**(-1/20)/peak:1;let p=44;for(let i=0;i<frames;i++)for(const a of ch){let x=Math.max(-1,Math.min(1,a[i]*gain));v.setInt16(p,Math.round(x*(x<0?32768:32767)),true);p+=2;}return {buffer,gain,peak};}
function convertChannel(input,sr,{n,hop,iterations,f0,c,method="gla",momentum=.99},progress=()=>{}){
 if(!['gla','fgla','agla'].includes(method)||!Number.isFinite(momentum)||momentum<0||momentum>=1)throw Error('Invalid phase reconstruction settings');
 const acceleration=method==='fgla'?momentum/(1+momentum):0;
 const bins=n/2+1,pad=n/2,frames=Math.ceil(input.length/hop)+1,length=(frames-1)*hop+n;
 const fft=new FFT(n),win=Float64Array.from({length:n},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/n));
 const re=new Float64Array(n),im=new Float64Array(n),mag=new Float64Array(bins),target=new Float32Array(frames*bins),norm=new Float64Array(length);
 // Read the previous iterate while accumulating the next into a separate buffer.
 let out=new Float64Array(length),next=new Float64Array(length);
 const source=Float64Array.from({length:bins},(_,k)=>mappedFrequency(k*sr/n,f0,c)*n/sr);
 for(let t=0;t<frames;t++){let start=t*hop;for(let i=0;i<n;i++){re[i]=(input[start+i-pad]||0)*win[i];im[i]=0;norm[start+i]+=win[i]*win[i];}fft.run(re,im);for(let k=0;k<bins;k++)mag[k]=Math.hypot(re[k],im[k]);for(let k=0;k<bins;k++){let p=source[k];if(p>n/2||p<0){target[t*bins+k]=0;continue;}let lo=Math.floor(p),a=p-lo;target[t*bins+k]=mag[lo]*(1-a)+(mag[Math.min(lo+1,bins-1)]||0)*a;}if(t%32===0)progress(0,t/frames);}
 let seed=0x6d2b79f5;const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
 function synthInitial(){out.fill(0);for(let t=0;t<frames;t++){let start=t*hop;for(let k=0;k<bins;k++){let phase=random()*2*Math.PI,a=target[t*bins+k];re[k]=a*Math.cos(phase);im[k]=(k===0||k===n/2)?0:a*Math.sin(phase);if(k===0||k===n/2)re[k]=a*(Math.cos(phase)<0?-1:1);if(k>0&&k<n/2){re[n-k]=re[k];im[n-k]=-im[k];}}fft.run(re,im,true);for(let i=0;i<n;i++)out[start+i]+=re[i]*win[i];}for(let i=0;i<length;i++)out[i]=norm[i]>1e-12?out[i]/norm[i]:0;}
 const previousRe=acceleration?new Float64Array(frames*bins):null,previousIm=acceleration?new Float64Array(frames*bins):null;
 synthInitial();
 const isAGLA=method==='agla';
 const tPrevious=isAGLA?out.slice():null,d=isAGLA?out.slice():null;

 for(let iter=0;iter<iterations;iter++){
 next.fill(0);
 for(let t=0;t<frames;t++){
 let start=t*hop;
 for(let i=0;i<n;i++){re[i]=out[start+i]*win[i];im[i]=0;}
 fft.run(re,im);
 for(let k=0;k<bins;k++){
 const j=t*bins+k;let pr,pi;
 if(acceleration){const rr=re[k],ii=im[k];pr=rr-acceleration*previousRe[j];pi=ii-acceleration*previousIm[j];previousRe[j]=rr;previousIm[j]=ii;}
 else {pr=re[k];pi=im[k];}
 // Project the complex direction directly onto the target magnitude.
 // A zero vector uses phase zero; DC and Nyquist must remain real.
 const a=target[j],m=Math.hypot(pr,pi);re[k]=m?a*(pr/m):a;im[k]=m?a*(pi/m):0;if(k===0||k===n/2){re[k]=a*(pr<0?-1:1);im[k]=0;}
 if(k>0&&k<n/2){re[n-k]=re[k];im[n-k]=-im[k];}
 }
 fft.run(re,im,true);
 for(let i=0;i<n;i++)next[start+i]+=re[i]*win[i];
 }
 for(let i=0;i<length;i++)next[i]=norm[i]>1e-12?next[i]/norm[i]:0;
 if(isAGLA){
 // AGLA recurrence in the waveform domain; coefficients from the auditioned trial.
 // Nenov et al., Algorithm 3, https://arxiv.org/abs/2306.12504
 const alpha=.95,beta=1,gamma=1.3;
 for(let i=0;i<length;i++){
  const t=(1-gamma)*d[i]+gamma*next[i],delta=t-tPrevious[i];
  out[i]=t+alpha*delta;d[i]=t+beta*delta;tPrevious[i]=t;
 }
 }else{let swap=out;out=next;next=swap;}
 progress(iter+1,1);
 }
 return Float32Array.from((isAGLA?next:out).subarray(pad,pad+input.length));
}
root.NHDSP={FFT,mod,mappedFrequency,convertChannel,wav};
})(typeof self!=='undefined'?self:globalThis);
