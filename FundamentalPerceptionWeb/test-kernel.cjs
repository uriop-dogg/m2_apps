const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(__dirname+'/kernel.js','utf8');
// Evaluate in this JS context, as the worker does (avoid cross-context Math overhead).
const {analyse,peakIndices}=new Function(src+';return {analyse,peakIndices}')();
const base={a4:440,edge:0,octave:4,N:5,view:'vector',axis:'full',weight:'saw'};
const input=new Float64Array(4097);input[440]=1;
let out=analyse(input,1,base);
const at=(r,f)=>{const t=Math.log2(f/r.root);return [...r.x].findIndex(x=>Math.abs(x-t)<1e-10);};
assert.equal(out.re[at(out,440)],1);assert(Math.abs(out.im[at(out,220)]-.5)<1e-10);assert(Math.abs(out.im[at(out,880)]+.5)<1e-10);
out=analyse(input,1,{...base,N:2,weight:'square'});assert(out.im.every(x=>x===0));
for(const edge of [0,1,9,11])for(const view of ['power','term','vector']){
 const r=analyse(input,1,{...base,axis:'fold',edge,view});assert.equal(r.re[0],r.re.at(-1));assert.equal(r.im[0],r.im.at(-1));assert(r.re.every(x=>x>=0));
}
const broad=Float64Array.from({length:2048},(_,i)=>i?Math.exp(-i/300)*(1+Math.sin(i))**2:0);
function sample(f){const x=f/2;if(x<1||x>2047)return 0;const i=Math.floor(x),t=x-i;return broad[i]*(1-t)+broad[Math.min(i+1,2047)]*t;}
for(const axis of ['full','octave','fold'])for(const weight of ['saw','square']){
 const o={...base,axis,weight},r=analyse(broad,2,o);
 for(let j=0;j<r.x.length;j+=7){
  let p=0,v=0;const h=axis==='fold'&&r.x[j]===1?0:r.x[j];
  const low=Math.log2(2/o.N/r.root),high=Math.log2(2047*2*o.N/r.root);
  const from=axis==='fold'?Math.ceil(low-h-1e-12):0,to=axis==='fold'?Math.ceil(high-h-1e-12):1;
  for(let k=from;k<to;k++){const f=r.root*2**(h+k);p+=sample(f);for(let n=2;n<=o.N;n++)if(weight!=='square'||n%2)v+=(sample(n*f)-sample(f/n))/n;}
  assert(Math.abs(p-r.re[j])<1e-11);assert(Math.abs(v-r.im[j])<1e-11);
 }
}
assert.deepEqual(peakIndices([3,1,0,1,3],true),[0]);assert.deepEqual(peakIndices([3,3,1,3,3],true),[0]);assert.deepEqual(peakIndices([1,1,1],true),[]);
for(const axis of ['full','fold','octave']){
 const p=new Float64Array(16384);for(let n=1;n<32;n++)p[80*n]=1/n**2;
 const o={...base,N:32,axis};analyse(p,1.46,o);
 const start=performance.now();for(let i=0;i<5;i++)analyse(p,1.46,o);
 console.log(axis,((performance.now()-start)/5).toFixed(1)+' ms / frame');
}
console.log('PASS: signed harmonic response, square weights, octave folding, edge rotation seams, direct-sum reference, peak detection.');
