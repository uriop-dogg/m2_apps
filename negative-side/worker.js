importScripts('./dsp.js');
onmessage=e=>{try{const {channels,sr,settings}=e.data;const result=channels.map((a,ch)=>NHDSP.convertChannel(a,sr,settings,(iteration,fraction)=>postMessage({type:'progress',ch,iteration,fraction})));const {buffer,gain,peak}=NHDSP.wav(result,sr);postMessage({type:'done',buffer,gain,peak},[buffer]);}catch(error){postMessage({type:'error',message:error.message});}};
