import {extractEnvelope,analyze,harmonics,selectedTrace} from './dsp.js';
import {loadProject,saveProject,exportData} from './files.js';
let track=null,result=null,rhythm=null;
const progress=(id,stage,p)=>postMessage({id,event:'progress',stage,p});
self.onmessage=({data})=>{const {id,action}=data;try{
 let value;
 if(action==='load'){
  const e=extractEnvelope(data.mono,data.sampleRate,p=>progress(id,'envelope',p*.5));
  const nextTrack={envelope:e.envelope,rate:e.rate,metadata:{...e.metadata,source_range:data.sourceRange}},nextResult=analyze(e.envelope,e.rate,data.settings,nextTrack.metadata,p=>progress(id,'fourier',.5+.3*p));
  const nextRhythm=harmonics(nextResult,data.meter,p=>progress(id,'harmonics',.8+.2*p));track=nextTrack;result=nextResult;rhythm=nextRhythm;value={track,result,rhythm};
 }else if(action==='analyze'){
  if(!track)throw Error('NO_AUDIO');const nextResult=analyze(track.envelope,track.rate,data.settings,track.metadata,p=>progress(id,'fourier',.7*p)),nextRhythm=harmonics(nextResult,data.meter,p=>progress(id,'harmonics',.7+.3*p));result=nextResult;rhythm=nextRhythm;value={track,result,rhythm};
 }else if(action==='trace'){if(!result)throw Error('NO_AUDIO');value=selectedTrace(result,data.frequency);
 }else if(action==='restore'){track=data.track;result=data.result;rhythm=data.rhythm;value=true;
 }else if(action==='projectLoad'){const p=loadProject(data.buffer);const h=harmonics(p.result,p.meter,v=>progress(id,'harmonics',v));track=p.track;result=p.result;rhythm=h;value={...p,rhythm};
 }else if(action==='projectSave'){value=saveProject(data.audio,track,result,data.meter,data.view);
 }else if(action==='export'){value=exportData(result,rhythm,data.panel,data.position,data.scope,data.format,data.audio,data.meter);}
 else throw Error('Unknown operation');
 if(value instanceof Uint8Array)postMessage({id,event:'done',value},[value.buffer]);else postMessage({id,event:'done',value});
 }catch(e){postMessage({id,event:'error',error:e.message,stack:e.stack});}};
