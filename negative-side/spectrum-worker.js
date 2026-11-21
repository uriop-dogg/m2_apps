/* Background color analysis only; independent of NH mapping and STFT. */
const mod=x=>((x%1)+1)%1;
// In-place FFT: calculate bit reversal and stage twiddles on demand, avoiding
// the O(N) lookup tables of the repeated, small NH transforms.
function fullFFT(re,im){const n=re.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){let a=re[i];re[i]=re[j];re[j]=a;}}
 for(let len=2;len<=n;len*=2){let half=len/2;for(let j=0;j<half;j++){const angle=-2*Math.PI*j/len,c=Math.cos(angle),s=Math.sin(angle);for(let base=0;base<n;base+=len){let a=base+j,b=a+half,tr=re[b]*c-im[b]*s,ti=re[b]*s+im[b]*c;re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;}}}}
onmessage=e=>{try{const {channels,sr}=e.data;let count=channels[0].length,n=2**Math.ceil(Math.log2(Math.max(2,count)));if(n>33554432){postMessage({error:'背景解析は全体FFTの上限（2^25点）を超えるため省略しました。音声変換は可能です。'});return;}
 const re=new Float32Array(n),im=new Float32Array(n),weights=new Float64Array(360);
 for(const channel of channels){re.fill(0);im.fill(0);re.set(channel);fullFFT(re,im);for(let k=1;k<=n/2;k++){let f=k*sr/n;let p=mod(Math.log2(f/440))*360,lo=Math.floor(p),a=p-lo,power=(re[k]*re[k]+im[k]*im[k])/channels.length;weights[lo]+=power*(1-a);weights[(lo+1)%360]+=power*a;}}
 let sum=weights.reduce((a,b)=>a+b,0);if(sum)for(let i=0;i<360;i++)weights[i]/=sum;postMessage({weights});}catch(error){postMessage({error:'背景解析を省略しました: '+error.message});}};
