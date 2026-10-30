function audioPower(samples,sampleRate,padding=8){
  const n=samples.length,size=n*padding;
  if(n<2||(n&(n-1))||padding<1||(padding&(padding-1)))throw Error('FFT sizes must be powers of two.');
  let cache=audioPower.cache;
  if(!cache||cache.size!==size||cache.n!==n){
    const reverse=new Uint32Array(size),window=new Float64Array(n),cos=new Float64Array(size/2),sin=new Float64Array(size/2);
    for(let i=1;i<size;i++)reverse[i]=(reverse[i>>1]>>1)|((i&1)?size>>1:0);
    for(let i=0;i<n;i++)window[i]=.42-.5*Math.cos(2*Math.PI*i/n)+.08*Math.cos(4*Math.PI*i/n);
    for(let i=0;i<size/2;i++){cos[i]=Math.cos(-2*Math.PI*i/size);sin[i]=Math.sin(-2*Math.PI*i/size);}
    cache=audioPower.cache={n,size,reverse,window,cos,sin,re:new Float64Array(size),im:new Float64Array(size)};
  }
  const {re,im,reverse,window,cos,sin}=cache;re.fill(0);im.fill(0);
  for(let i=0;i<n;i++)re[reverse[i]]=samples[i]*window[i];
  for(let length=2;length<=size;length*=2){
    const half=length/2,stride=size/length;
    for(let start=0;start<size;start+=length)for(let j=0;j<half;j++){
      const a=start+j,b=a+half,k=j*stride,vr=re[b]*cos[k]-im[b]*sin[k],vi=re[b]*sin[k]+im[b]*cos[k];
      re[b]=re[a]-vr;im[b]=im[a]-vi;re[a]+=vr;im[a]+=vi;
    }
  }
  const power=new Float64Array(size/2);
  // Normalize by the actual observation length, not padded FFT length.
  for(let i=1;i<power.length;i++)power[i]=(re[i]*re[i]+im[i]*im[i])/(n*n);
  return {power,df:sampleRate/size};
}
function analyse(power,df,o){
  const root=o.a4*2**((-57+o.edge)/12),last=power.length-1;
  const onlyP=o.view==='power',characteristic=o.view==='characteristic',extent=onlyP?1:o.N;
  let W=0;for(let n=2;n<=o.N;n++)if(o.weight!=='square'||n%2)W+=1/n;
  const low=o.axis==='octave'?o.octave:Math.log2(df/extent/root);
  const high=o.axis==='octave'?o.octave+1:Math.log2(last*df*extent/root);
  const folded=o.axis==='fold',xs=new Set();
  const size=folded?1536:Math.min(8192,Math.max(1536,Math.ceil((high-low)*512)));
  for(let j=0;j<=size;j++)xs.add(folded?j/size:low+(high-low)*j/size);
  let peak=0;for(let i=1;i<power.length;i++)peak=Math.max(peak,power[i]);
  const peaks=[];
  for(let i=1;i<last;i++)if(power[i]>power[i-1]&&power[i]>=power[i+1]&&power[i]>Math.max(1e-22,peak*1e-6))peaks.push(i);
  peaks.sort((a,b)=>power[b]-power[a]);
  const add=t=>{if(t>=low&&t<=high)xs.add(folded?((t%1)+1)%1:t)};
  for(const i of peaks.slice(0,64)){
    const t=Math.log2(i*df/root);add(t);
    if(!onlyP)for(let n=2;n<=o.N;n++)if(o.weight!=='square'||n%2){add(t-Math.log2(n));add(t+Math.log2(n));}
  }
  const x=Float64Array.from([...xs].sort((a,b)=>a-b)),re=new Float64Array(x.length),im=new Float64Array(x.length);
  function sample(f){const a=f/df;if(a<1||a>last)return 0;const i=Math.floor(a),t=a-i;return power[i]*(1-t)+power[Math.min(i+1,last)]*t;}
  for(let j=0;j<x.length;j++){
    const h=folded&&x[j]===1?0:x[j];
    const from=folded?Math.ceil(low-h-1e-12):0,to=folded?Math.ceil(high-h-1e-12):1;
    let p=0,v=0,total=0;
    for(let k=from;k<to;k++){
      const f=root*2**(h+k);p+=sample(f);
      if(!onlyP)for(let n=2;n<=o.N;n++)if(o.weight!=='square'||n%2){
        const H=sample(f*n)/n,S=sample(f/n)/n;v+=H-S;if(characteristic)total+=H+S;
      }
    }
    re[j]=characteristic?W*p-total/2:p;im[j]=characteristic?Math.sqrt(3)/2*v:v;
  }
  return {x,re,im,lo:folded?0:low,hi:folded?1:high,root,options:o};
}
function peakIndices(y,circular){
  const n=y.length-(circular?1:0),out=[];if(n<2)return out;
  let start=0;if(circular){while(start<n&&y[start]===y[(start+n-1)%n])start++;if(start===n)return out;}
  for(let at=0;at<n;){const a=at,i=(start+a)%n;let end=a+1;while(end<n&&y[(start+end)%n]===y[i])end++;
    const prev=circular||a>0?y[(i+n-1)%n]:Infinity,last=(start+end-1)%n,next=circular||end<n?y[(last+1)%n]:Infinity;
    if(y[i]>prev&&y[i]>next)out.push((start+Math.floor((a+end-1)/2))%n);at=end;
  }return out;
}
function phaseColor(p,v){return p===0&&v===0?'#78858c':`hsl(${120-Math.atan2(v,p)*240/Math.PI} 80% 65%)`;}

function characteristicColor(p,v){return p===0&&v===0?'#78858c':`hsl(${((120-Math.atan2(v,p)*180/Math.PI)%360+360)%360} 80% 65%)`;}

function averagePower(samples,sampleRate,n,progress=()=>{}){
  const hop=n/2,count=Math.max(1,Math.ceil(samples.length/hop));
  const window=new Float32Array(n),sum=new Float64Array(n*4);
  for(let j=0;j<count;j++){
    window.fill(0);const start=j*hop-n/2,lo=Math.max(0,start),hi=Math.min(samples.length,start+n);
    if(hi>lo)window.set(samples.subarray(lo,hi),lo-start);
    const {power}=audioPower(window,sampleRate);
    for(let i=0;i<sum.length;i++)sum[i]+=power[i]/count;
    if(j%16===0)progress((j+1)/count);
  }
  return {power:sum,df:sampleRate/(n*8),count};
}
