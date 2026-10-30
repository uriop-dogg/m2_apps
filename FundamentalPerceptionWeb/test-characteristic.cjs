const fs=require('fs'),assert=require('assert/strict');
const {analyse,characteristicColor}=new Function(fs.readFileSync(__dirname+'/kernel.js','utf8')+';return {analyse,characteristicColor}')();
const input=Float64Array.from({length:1025},(_,i)=>i?Math.exp(-i/150)*(1+Math.sin(i))**2:0);
const sample=f=>{if(f<1||f>1024)return 0;const i=Math.floor(f),t=f-i;return input[i]*(1-t)+input[Math.min(i+1,1024)]*t;};
for(const weight of ['saw','square'])for(const axis of ['full','octave','fold']){
 const o={a4:440,edge:1,octave:3,N:7,view:'characteristic',axis,weight},r=analyse(input,1,o);
 const terms=Array.from({length:6},(_,i)=>i+2).filter(n=>weight!=='square'||n%2),W=terms.reduce((s,n)=>s+1/n,0);
 for(let j=0;j<r.x.length;j+=13){
  const h=axis==='fold'&&r.x[j]===1?0:r.x[j],lo=Math.log2(1/o.N/r.root),hi=Math.log2(1024*o.N/r.root);
  const start=axis==='fold'?Math.ceil(lo-h-1e-12):0,end=axis==='fold'?Math.ceil(hi-h-1e-12):1;
  let re=0,im=0;
  for(let k=start;k<end;k++){const f=r.root*2**(h+k);let H=0,S=0;for(const n of terms){H+=sample(n*f)/n;S+=sample(f/n)/n;}re+=W*sample(f)-(H+S)/2;im+=Math.sqrt(3)/2*(H-S);}
  assert(Math.abs(r.re[j]-re)<1e-11);assert(Math.abs(r.im[j]-im)<1e-11);
 }
 if(axis==='fold'){assert.equal(r.re[0],r.re.at(-1));assert.equal(r.im[0],r.im.at(-1));}
}
const zero=analyse(input,1,{a4:440,edge:0,N:2,view:'characteristic',axis:'fold',weight:'square'});assert(zero.re.every(x=>x===0));assert(zero.im.every(x=>x===0));
for(const [p,v,hue] of [[1,0,120],[-.5,Math.sqrt(3)/2,0],[-.5,-Math.sqrt(3)/2,240],[-1,0,300],[-1,-0,300]]){
 const actual=parseFloat(characteristicColor(p,v).slice(4));assert(Math.min(Math.abs(actual-hue),360-Math.abs(actual-hue))<1e-10);
}
assert.equal(characteristicColor(0,0),'#78858c');
console.log('PASS characteristic: independent direct sums, both weights, all axes, periodic seam, W=0, full-circle hue anchors.');
