/* Visual color sampling only. No dependency on the NH synthesis engine. */
'use strict';
window.NegallelGlow=(()=>{
 let distribution=null,mode=0;
 const crystal=document.querySelector('.crystal'),halo=document.querySelector('.dial-halo');
 function shine(){
  if(document.hidden)return;
  let index=Math.random()*360;
  if(distribution){let draw=Math.random(),sum=0;for(let i=0;i<360;i++){sum+=distribution[i];if(draw<sum){index=i;break;}}}
  const hue=((index-mode)%360+360)%360,color=`hsl(${hue} 78% 65%)`;
  crystal.style.color=color;halo.style.color=color;
 }
 function update(weights,offset){
  mode=offset;
  const total=weights?.reduce((sum,w)=>sum+(Number.isFinite(w)&&w>0?w:0),0)||0;
  distribution=total>0?Array.from(weights,w=>Math.max(0,w)/total):null;
  shine();
 }
 setInterval(shine,6500);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)shine();});
 shine();return {update};
})();
