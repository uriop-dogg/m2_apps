// Rhythm Fourier Web: complex Fourier coefficients, no magnitude doubling.
export const DEFAULTS={smooth:0,normalize:false,window:4,hop:.05,padding:1,window_kind:'Hann',high:40,remove_mean:true,remove_dc:true,fft_window:'Hann',method:'STFT'};
export const METER={bpm:110,numerator:4,denominator:4,base_note:'1小節',order:32};
export const nextPow=n=>2**Math.ceil(Math.log2(Math.max(1,n)));
export function fft(re,im,inverse=false){
 const n=re.length;
 if(n&(n-1))throw Error('FFT length must be a power of two');
 for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}
 for(let len=2;len<=n;len*=2){const a=(inverse?2:-2)*Math.PI/len,wr=Math.cos(a),wi=Math.sin(a);
  for(let i=0;i<n;i+=len){let ur=1,ui=0;for(let j=0;j<len/2;j++){const p=i+j,q=p+len/2,vr=re[q]*ur-im[q]*ui,vi=re[q]*ui+im[q]*ur;re[q]=re[p]-vr;im[q]=im[p]-vi;re[p]+=vr;im[p]+=vi;const t=ur*wr-ui*wi;ui=ur*wi+ui*wr;ur=t;}}
 }if(inverse)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n;}return {re,im};
}
export function transform(input){
 const n=input.length;if(!(n&(n-1)))return fft(Float64Array.from(input),new Float64Array(n));
 // Bluestein preserves the original whole-audio frequency grid exactly.
 const m=nextPow(2*n-1),ar=new Float64Array(m),ai=new Float64Array(m),br=new Float64Array(m),bi=new Float64Array(m);
 for(let j=0;j<n;j++){const a=Math.PI*((j*j)%(2*n))/n,c=Math.cos(a),s=Math.sin(a);ar[j]=input[j]*c;ai[j]=-input[j]*s;br[j]=c;bi[j]=s;if(j){br[m-j]=c;bi[m-j]=s;}}
 fft(ar,ai);fft(br,bi);for(let j=0;j<m;j++){const r=ar[j]*br[j]-ai[j]*bi[j];ai[j]=ar[j]*bi[j]+ai[j]*br[j];ar[j]=r;}fft(ar,ai,true);
 const re=new Float64Array(n),im=new Float64Array(n);for(let j=0;j<n;j++){const a=Math.PI*((j*j)%(2*n))/n,c=Math.cos(a),s=Math.sin(a);re[j]=ar[j]*c+ai[j]*s;im[j]=ai[j]*c-ar[j]*s;}return {re,im};
}
export function reflect(i,n){if(n===1)return 0;const period=2*(n-1);i=((i%period)+period)%period;return i<n?i:period-i;}
function i0(x){let sum=1,term=1;for(let k=1;k<80;k++){term*=x*x/(4*k*k);sum+=term;if(term<sum*1e-16)break;}return sum;}
function kaiser(n){const out=new Float64Array(n),den=i0(12);for(let j=0;j<n;j++)out[j]=i0(12*Math.sqrt(Math.max(0,1-(2*j/(n-1)-1)**2)))/den;return out;}
export function fir(input,kernel,notify=()=>{}){
 const block=65536,L=kernel.length,half=(L-1)/2,nfft=nextPow(block+2*(L-1)),kr=new Float64Array(nfft),ki=new Float64Array(nfft);kr.set(kernel);fft(kr,ki);
 const out=new Float64Array(input.length),re=new Float64Array(nfft),im=new Float64Array(nfft);
 for(let start=0;start<input.length;start+=block){const count=Math.min(block,input.length-start);re.fill(0);im.fill(0);for(let j=0;j<count+L-1;j++)re[j]=input[reflect(start-half+j,input.length)];fft(re,im);for(let j=0;j<nfft;j++){const r=re[j]*kr[j]-im[j]*ki[j];im[j]=re[j]*ki[j]+im[j]*kr[j];re[j]=r;}fft(re,im,true);out.set(re.subarray(L-1,L-1+count),start);notify(Math.min(1,(start+count)/input.length));}return out;
}
export function extractEnvelope(mono,sr,notify=()=>{}){
 const length=Math.max(511,Math.ceil(32767*sr/48000))|1,half=length>>1,h=kaiser(length);for(let j=0;j<length;j++){const k=j-half;h[j]*=k%2?2/(Math.PI*k):0;}
 const quadrature=fir(mono,h,p=>notify(.45*p)),raw=new Float32Array(mono.length);for(let j=0;j<raw.length;j++)raw[j]=Math.sqrt(mono[j]*mono[j]+quadrature[j]*quadrature[j]);
 const dec=Math.max(1,Math.floor(sr/1024)),rate=sr/dec,stop=rate/2,L=Math.max(63,Math.ceil(12*sr/(stop-200)))|1,low=kaiser(L),cutoff=(200+stop)/2;let sum=0;
 for(let j=0;j<L;j++){const k=j-(L>>1),x=2*cutoff/sr*k;low[j]*=2*cutoff/sr*(x===0?1:Math.sin(Math.PI*x)/(Math.PI*x));sum+=low[j];}for(let j=0;j<L;j++)low[j]/=sum;
 const filtered=fir(raw,low,p=>notify(.45+.5*p)),env=new Float64Array(Math.ceil(mono.length/dec));for(let j=0;j<env.length;j++)env[j]=filtered[j*dec];notify(1);
 return {envelope:env,rate,metadata:{hilbert_taps:length,lowpass_taps:L,decimation:dec,envelope_rate:rate,passband_hz:200,stopband_hz:stop,filter_edge_seconds:(half+(L>>1))/sr}};
}
export function validate(s,m){for(const [key,lo,hi] of [['smooth',0,2],['window',.05,32],['hop',.005,2],['high',.001,200]])if(!Number.isFinite(s[key])||s[key]<lo||s[key]>hi)throw Error(`${key}: ${lo}–${hi}`);if(![1,2,4].includes(s.padding)||!['Hann','Gaussian'].includes(s.window_kind)||!['Hann','矩形'].includes(s.fft_window))throw Error('Invalid Fourier settings');if(m){for(const [k,lo,hi]of [['bpm',1,1600],['numerator',1,32],['order',1,128]])if(!Number.isFinite(m[k])||m[k]<lo||m[k]>hi||(k!=='bpm'&&!Number.isInteger(m[k])))throw Error(`${k}: ${lo}–${hi}`);if(![1,2,4,8,16,32].includes(m.denominator)||!Number.isFinite(noteFraction(m.base_note,m)))throw Error('Invalid meter');}}
// Python round uses ties-to-even; preserve the desktop sampling choices.
const round=x=>{const f=Math.floor(x),d=x-f;return d===.5?(f%2?f+1:f):Math.round(x);};
export function geometry(rate,s){let n=Math.max(3,round(s.window*rate));n+=1-n%2;const hop=Math.max(1,round(s.hop*rate)),nfft=nextPow(n)*s.padding,bins=Math.min(nfft/2+1,Math.floor(s.high*nfft/rate+1e-10)+1);return {n,half:n>>1,hop,nfft,bins};}
export function capacity(rate,s){const g=geometry(rate,s),frames=Math.floor(512000000/(g.bins*16));return {seconds:frames*g.hop/rate,samples:frames*g.hop,...g};}
export function windowWeights(n,kind){const w=new Float64Array(n);let sum=0;for(let j=0;j<n;j++){w[j]=kind==='Hann'?.5-.5*Math.cos(2*Math.PI*j/(n-1)):kind==='Gaussian'?Math.exp(-.5*((j-(n>>1))/(n/6))**2):1;sum+=w[j];}return {w,sum};}
export function analyze(env,rate,s,trackMeta={},notify=()=>{}){
 validate(s);if(env.length>capacity(rate,s).samples)throw Error('STFT_LIMIT');let A=Float64Array.from(env,x=>Math.max(0,x)),mean=A.reduce((a,b)=>a+b,0)/A.length;
 if(s.normalize&&mean>1e-30)for(let j=0;j<A.length;j++)A[j]/=mean;
 if(s.smooth){const radius=Math.max(1,Math.ceil(4*s.smooth*rate)),g=new Float64Array(2*radius+1);let sum=0;for(let j=0;j<g.length;j++){g[j]=Math.exp(-.5*((j-radius)/(s.smooth*rate))**2);sum+=g[j];}for(let j=0;j<g.length;j++)g[j]/=sum;A=fir(A,g);for(let j=0;j<A.length;j++)A[j]=Math.max(0,A[j]);}
 const {n,half,hop,nfft,bins}=geometry(rate,s),frames=Math.ceil(A.length/hop),{w,sum}=windowWeights(n,s.window_kind),Z=new Float64Array(frames*bins*2),frame_t=new Float64Array(frames),k=Float64Array.from({length:bins},(_,j)=>j*rate/nfft),re=new Float64Array(nfft),im=new Float64Array(nfft),phase=Float64Array.from(k,f=>2*Math.PI*f*half/rate);
 for(let frame=0;frame<frames;frame++){const center=frame*hop;frame_t[frame]=center/rate;let avg=0;re.fill(0);im.fill(0);for(let j=0;j<n;j++){re[j]=A[reflect(center-half+j,A.length)];avg+=re[j];}avg=s.remove_mean?avg/n:0;for(let j=0;j<n;j++)re[j]=(re[j]-avg)*w[j];fft(re,im);for(let j=0;j<bins;j++){const c=Math.cos(phase[j]),si=Math.sin(phase[j]),p=2*(frame*bins+j);Z[p]=(re[j]*c-im[j]*si)/sum;Z[p+1]=(re[j]*si+im[j]*c)/sum;}if(s.remove_dc){Z[frame*bins*2]=0;Z[frame*bins*2+1]=0;}if(frame%32===0)notify(.8*frame/frames);}
 const fw=windowWeights(A.length,s.fft_window),whole=new Float64Array(A.length);mean=s.remove_mean?A.reduce((a,b)=>a+b,0)/A.length:0;for(let j=0;j<A.length;j++)whole[j]=(A[j]-mean)*fw.w[j];notify(.85);const f=transform(whole),nb=Math.min(Math.floor(A.length/2)+1,Math.floor(s.high*A.length/rate+1e-10)+1),Ahat=new Float64Array(nb*2),fft_k=Float64Array.from({length:nb},(_,j)=>j*rate/A.length);for(let j=0;j<nb;j++){Ahat[2*j]=f.re[j]/fw.sum;Ahat[2*j+1]=f.im[j]/fw.sum;}if(s.remove_dc){Ahat[0]=0;Ahat[1]=0;}
 notify(1);return {settings:{...s},rate,A,t:Float64Array.from({length:A.length},(_,j)=>j/rate),frame_t,k,Z,fft_k,Ahat,metadata:{rate_hz:rate,actual_window_s:n/rate,actual_hop_s:hop/rate,stft_bin_hz:rate/nfft,fft_bin_hz:rate/A.length,nfft,phase_reference:'STFT: window center; whole audio: clip start',amplitude_convention:'complex coefficients / sum(window); no doubling',boundary:'reflect',edge_s:half/rate+(trackMeta.filter_edge_seconds||0)+4*s.smooth,source_range:trackMeta.source_range}};
}
export function selectedTrace(r,f){
 if(!Number.isFinite(f)||f<0||f>r.settings.high)throw Error('Fixed frequency exceeds analysis range');const {n,half,hop}=geometry(r.rate,r.settings),{w,sum}=windowWeights(n,r.settings.window_kind),kr=new Float64Array(n),ki=new Float64Array(n);let mr=0,mi=0;
 for(let j=0;j<n;j++){const a=2*Math.PI*f*(j-half)/r.rate;kr[j]=w[j]*Math.cos(a)/sum;ki[j]=w[j]*Math.sin(a)/sum;mr+=kr[j];mi+=ki[j];}
 const zr=fir(r.A,kr),zi=fir(r.A,ki),out=new Float64Array(r.frame_t.length*2);let means=null;if(r.settings.remove_mean)means=fir(r.A,new Float64Array(n).fill(1/n));
 for(let j=0;j<r.frame_t.length;j++){out[2*j]=zr[j*hop]-(means?means[j*hop]*mr:0);out[2*j+1]=zi[j*hop]-(means?means[j*hop]*mi:0);}if(f===0&&r.settings.remove_dc)out.fill(0);return out;
}
export function noteFraction(label,m){if(label==='1小節')return m.numerator/m.denominator;const v=/^(付点)?(全|二分|四分|八分|十六分|三十二分|六十四分)音符(3連)?$/.exec(label);if(!v)return NaN;const den={'全':1,'二分':2,'四分':4,'八分':8,'十六分':16,'三十二分':32,'六十四分':64}[v[2]];return (v[1]?1.5:v[3]?2/3:1)/den;}
export const NOTE_NAMES=['全','二分','四分','八分','十六分','三十二分','六十四分'];
export const NOTE_OPTIONS=['1小節',...NOTE_NAMES.map(x=>x+'音符'),...NOTE_NAMES.map(x=>'付点'+x+'音符'),...NOTE_NAMES.slice(1).map(x=>x+'音符3連')];
export function noteInfo(duration){for(const [dots,mul] of [[0,1],[1,1.5],[2,1.75]])for(let p=0;p<7;p++)if(Math.abs(duration-mul/2**p)<1e-12)return {base:2**p,dots,label:NOTE_NAMES[p]+'音符'+(dots?' ·'.repeat(dots):'')};for(const a of [3,5,7,9,11,13])for(let p=0;p<7;p++){const b=2**Math.floor(Math.log2(a));if(Math.abs(duration-b/(a*2**p))<1e-12)return {base:2**p,dots:0,tuplet:a,label:`${NOTE_NAMES[p]}音符 ${a}:${b}`};}return {label:duration.toPrecision(4)+' whole'};}
export function harmonics(r,m,notify=()=>{}){
 validate(r.settings,m);const fraction=noteFraction(m.base_note,m),seconds=fraction*240/m.bpm,hz=1/seconds,count=Math.min(m.order,Math.floor(r.settings.high/hz+1e-10));if(count<1)throw Error('BASE_ABOVE_LIMIT');if(r.frame_t.length*count*16>128000000)throw Error('HARMONIC_LIMIT');const Z=new Float64Array(r.frame_t.length*count*2),F=new Float64Array(count*2),freq=Float64Array.from({length:count},(_,j)=>(j+1)*hz),fw=windowWeights(r.A.length,r.settings.fft_window),mean=r.settings.remove_mean?r.A.reduce((a,b)=>a+b,0)/r.A.length:0;
 for(let j=0;j<count;j++){const trace=selectedTrace(r,freq[j]);for(let t=0;t<r.frame_t.length;t++){Z[(t*count+j)*2]=trace[t*2];Z[(t*count+j)*2+1]=trace[t*2+1];}let re=0,im=0;for(let t=0;t<r.A.length;t++){const a=-2*Math.PI*freq[j]*t/r.rate,v=(r.A[t]-mean)*fw.w[t]/fw.sum;re+=v*Math.cos(a);im+=v*Math.sin(a);}F[j*2]=re;F[j*2+1]=im;notify((j+1)/count);}
 return {order:Float64Array.from({length:count},(_,j)=>j+1),k_hz:freq,Z,F,notes:Array.from({length:count},(_,j)=>{const note=noteInfo(fraction/(j+1));if(!note.base)note.label=m.base_note+(j?'÷'+(j+1):'');return note;}),seconds,hz};
}

