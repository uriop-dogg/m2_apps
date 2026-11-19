/* Shared transport for position-preserving original / NH comparison. */
'use strict';
(()=>{
 const get=id=>document.getElementById(id),tracks=[get('original'),get('result')],choices=[get('listenOriginal'),get('listenResult')];
 const play=get('playPause'),seek=get('seekAudio'),status=get('playerStatus');
 let active=0,request=0,frame=0;
 const ready=i=>tracks[i].readyState>=1&&Number.isFinite(tracks[i].duration)&&tracks[i].duration>0;
 const time=s=>{s=Math.max(0,Math.floor(s||0));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
 function paint(){
  const audio=tracks[active],valid=ready(active),running=!audio.paused&&!audio.ended;
  choices.forEach((b,i)=>{b.disabled=!ready(i);b.setAttribute('aria-pressed',String(i===active));});
  play.disabled=seek.disabled=!valid;
  play.textContent=running?'Ⅱ 一時停止':'▶ 再生';play.setAttribute('aria-label',running?'一時停止':'再生');
  
  seek.max=valid?audio.duration:1;seek.value=valid?audio.currentTime:0;
  seek.style.setProperty('--played',valid?100*audio.currentTime/audio.duration+'%':'0%');
  get('elapsed').textContent=time(audio.currentTime);get('duration').textContent=time(valid?audio.duration:0);
 }
 async function start(){const ticket=++request,audio=tracks[active];try{await audio.play();if(ticket!==request&&audio!==tracks[active])audio.pause();}catch(e){if(ticket===request)status.textContent='再生できませんでした。もう一度再生ボタンを押してください。';}paint();}
 function select(i){if(i===active||!ready(i))return;const old=tracks[active],position=old.currentTime,running=!old.paused&&!old.ended;++request;old.pause();active=i;const next=tracks[i];next.currentTime=Math.min(position,next.duration);status.textContent='';paint();if(running&&next.currentTime<next.duration)start();}
 choices.forEach((b,i)=>b.onclick=()=>select(i));
 play.onclick=()=>{if(!ready(active))return;const audio=tracks[active];if(audio.paused){if(audio.ended)audio.currentTime=0;start();}else{++request;audio.pause();paint();}};
 seek.oninput=()=>{if(ready(active)){tracks[active].currentTime=+seek.value;paint();}};
 get('volumeAudio').oninput=e=>tracks.forEach(a=>a.volume=+e.target.value);
 function animate(){paint();if(!tracks[active].paused)frame=requestAnimationFrame(animate);else frame=0;}
 tracks.forEach((audio,i)=>{
  audio.addEventListener('play',()=>{tracks[1-i].pause();if(!frame)frame=requestAnimationFrame(animate);});
  for(const event of ['loadedmetadata','durationchange','pause','ended','timeupdate','seeked'])audio.addEventListener(event,()=>{paint();});
  audio.addEventListener('loadedmetadata',()=>{status.textContent=ready(0)&&ready(1)?'再生中も同じ位置で切り替えられます。':'変換が完了すると聴き比べできます。';});
  audio.addEventListener('emptied',()=>{++request;if(active===i){audio.pause();active=0;}paint();});
  audio.addEventListener('error',()=>{status.textContent='音声を再生できません。ファイルを読み込み直してください。';paint();});
 });paint();
})();
