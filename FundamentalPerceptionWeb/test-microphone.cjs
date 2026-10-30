const fs=require('fs'),assert=require('assert');
const app=fs.readFileSync(__dirname+'/app.js','utf8');
const src=app.slice(app.indexOf('function stopMic()'),app.indexOf('async function chooseMode('));
const button={};let stopped=0,disconnected=0,connected=[],restarts=0,lastStatus='';
let resolveRequest;
const track={stop(){stopped++},addEventListener(){}};
const input={getTracks:()=>[track],getAudioTracks:()=>[track]};
const nav={mediaDevices:{getUserMedia:()=>new Promise(resolve=>resolveRequest=resolve)}};
const analyser={},ctx={createMediaStreamSource:()=>({connect:node=>connected.push(node),disconnect:()=>disconnected++})};
const api=new Function('navigator','$','status','audioSetup','audioCtx','analyser','restartAnalysis','resetAnalysis',
 'let micTicket=0,stream=null,micNode=null,mode="mic";'+src+';return {startMic,stopMic,setMode:m=>mode=m};')
 (nav,()=>button,s=>lastStatus=s,async()=>{},ctx,analyser,()=>restarts++,()=>{});
(async()=>{
 const first=api.startMic();await Promise.resolve();resolveRequest(input);await first;
 assert.deepEqual(connected,[analyser]);assert.equal(button.textContent,'■ マイクを停止');assert.equal(button.disabled,false);assert.equal(restarts,1);
 api.stopMic();assert.equal(stopped,1);assert.equal(disconnected,1);
 const late=api.startMic();await Promise.resolve();api.stopMic();api.setMode('file');resolveRequest(input);await late;
 assert.equal(stopped,2);assert.equal(connected.length,1);
 api.setMode('mic');nav.mediaDevices.getUserMedia=async()=>{const e=new Error('denied');e.name='NotAllowedError';throw e;};await api.startMic();
 assert(lastStatus.includes('許可されません'));assert.equal(button.disabled,false);
 nav.mediaDevices=null;await api.startMic();assert(lastStatus.includes('HTTPS'));
 console.log('PASS microphone routing to analyser only, track cleanup, late permission race, denial, insecure context.');
})().catch(e=>{console.error(e);process.exitCode=1});
