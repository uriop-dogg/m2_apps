const fs=require('fs'),assert=require('assert/strict'),vm=require('vm');
const {audioPower,averagePower,analyse}=new Function(fs.readFileSync(__dirname+'/kernel.js','utf8')+';return {audioPower,averagePower,analyse}')();
for(const length of [1,15,64,137,1024]){
 const n=64,sr=2048,input=Float32Array.from({length},(_,i)=>Math.sin(2*Math.PI*128*i/sr)*(i<length/2?.4:1));
 const actual=averagePower(input,sr,n),count=Math.ceil(length/(n/2)),expected=new Float64Array(n*4);
 for(let j=0;j<count;j++){
  const win=Float32Array.from({length:n},(_,i)=>input[j*n/2+i-n/2]||0),power=audioPower(win,sr).power;
  for(let i=0;i<expected.length;i++)expected[i]+=power[i]/count;
 }
 assert.equal(actual.count,count);assert.equal(actual.df,sr/(n*8));
 for(let i=0;i<expected.length;i++)assert(Math.abs(actual.power[i]-expected[i])<1e-13);
}
assert(averagePower(new Float32Array(100),2048,64).power.every(v=>v===0));
// Exercise the exact serialized worker body used by the UI, including cached reuse.
const app=fs.readFileSync(__dirname+'/app.js','utf8'),begin=app.indexOf('const source=audioPower.toString()'),end=app.indexOf('wholeURL=URL.createObjectURL',begin);
const source=new Function('audioPower','averagePower','analyse',app.slice(begin,end)+'return source;')(audioPower,averagePower,analyse);
const messages=[],ctx={postMessage:m=>messages.push(m)};vm.createContext(ctx);vm.runInContext(source,ctx);
const samples=Float32Array.from({length:512},(_,i)=>Math.sin(2*Math.PI*i/16));
const opts={view:'characteristic',a4:440,edge:0,N:5,axis:'fold',weight:'saw'};
ctx.onmessage({data:{samples,sampleRate:2048,n:64,opts,gain:1,cached:null}});
let first=messages.at(-1);assert(!first.error);assert(first.result.whole);assert.equal(first.result.count,16);
for(const view of ['power','term','vector','characteristic']){
 messages.length=0;ctx.onmessage({data:{sampleRate:2048,n:64,opts:{...opts,view},gain:.5,cached:first.average}});
 const got=messages.at(-1);assert(!got.error);assert.equal(messages.length,1);
 const expected=analyse(Float64Array.from(first.average.power,v=>v*.25),first.average.df,{...opts,view});
 for(let i=0;i<got.result.re.length;i++){assert(Math.abs(got.result.re[i]-expected.re[i])<1e-12);assert(Math.abs(got.result.im[i]-expected.im[i])<1e-12);}
}
console.log('PASS whole-file STFT: centered windows, short audio, silence, serialized Worker, cached spectra, volume scaling, all four targets.');
