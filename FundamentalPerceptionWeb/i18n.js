'use strict';
const TRANSLATIONS=/*__TRANSLATIONS__*/;
let language='ja';try{language=localStorage.getItem('FundamentalPerceptionWeb.language')==='en'?'en':'ja';}catch{}
const translationKeys=Object.keys(TRANSLATIONS).sort((a,b)=>b.length-a.length);
const translationPattern=new RegExp(translationKeys.map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');
function tr(text){text=String(text);return language==='en'?text.replace(translationPattern,match=>TRANSLATIONS[match]):text;}
function paintText(ctx,text,...args){ctx.fillText(tr(text),...args);}
function installLanguage(){
 const textRecords=new WeakMap(),attributeRecords=new WeakMap();let observer;
 function skip(element){return !element||!!element.closest('script,style,[data-no-i18n]');}
 function converted(value,element){return tr(value);}
 function localize(root){
  if(root.nodeType===3){if(skip(root.parentElement))return;const prev=textRecords.get(root),current=root.nodeValue,original=prev&&current===prev.output?prev.original:current,output=converted(original,root.parentElement);if(output!==current)root.nodeValue=output;textRecords.set(root,{original,output});return;}
  if(root.nodeType!==1||skip(root))return;
  for(const name of ['aria-label','title'])if(root.hasAttribute(name)){let records=attributeRecords.get(root);if(!records){records={};attributeRecords.set(root,records);}const prev=records[name],current=root.getAttribute(name),original=prev&&current===prev.output?prev.original:current,output=tr(original);if(current!==output)root.setAttribute(name,output);records[name]={original,output};}
  for(const child of root.childNodes)localize(child);
 }
 function watch(){observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','title']});}
 function refresh(){observer?.disconnect();document.documentElement.lang=language;for(const el of document.querySelectorAll('[data-language]'))el.value=language;for(const el of document.querySelectorAll('[data-language-label]'))el.textContent=language==='ja'?'LANGUAGE':'言語';document.title=tr('基音の知覚・シミュレーター.web');localize(document.body);if(observer)watch();dirty=true;}
 observer=new MutationObserver(records=>{observer.disconnect();for(const record of records)localize(record.type==='characterData'?record.target:record.target);watch();});
 for(const el of document.querySelectorAll('[data-language]'))el.onchange=e=>{language=e.target.value;try{localStorage.setItem('FundamentalPerceptionWeb.language',language);}catch{}refresh();};refresh();
}
