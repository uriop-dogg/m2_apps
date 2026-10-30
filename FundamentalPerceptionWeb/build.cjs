const fs=require('fs'),path=require('path'),vm=require('vm');
const base=__dirname,voicePath=path.join(base,'audio-engine.js');
let voices;
if(fs.existsSync(voicePath))voices=fs.readFileSync(voicePath,'utf8');
else{
 const original=fs.readFileSync('C:/Users/uriop/Videos/倍音調律きーぼーでぃずむ_v1.1.16_JA-EN.html','utf8');
 voices=original.slice(original.indexOf('function connectOscillator('),original.indexOf('function startVoice('));
 fs.writeFileSync(voicePath,voices);
}
if(!voices.includes('function buildVoice')||!voices.includes('case "piano"'))throw Error('Missing voice engine');
const translations=Object.fromEntries(fs.readFileSync(path.join(base,'translations.tsv'),'utf8').replace(/^\uFEFF/,'').trimEnd().split(/\r?\n/).map(line=>{const at=line.indexOf('\t');if(at<1)throw Error('Invalid translation row');return [line.slice(0,at),line.slice(at+1)];}));
const i18n=fs.readFileSync(path.join(base,'i18n.js'),'utf8').replace('/*__TRANSLATIONS__*/',()=>JSON.stringify(translations));
const kernel=fs.readFileSync(path.join(base,'kernel.js'),'utf8'),app=fs.readFileSync(path.join(base,'app.js'),'utf8');
new vm.Script(kernel+'\n'+voices+'\n'+i18n+'\n'+app);
const html=fs.readFileSync(path.join(base,'index.template.html'),'utf8').replace('/*__KERNEL__*/',()=>kernel).replace('/*__VOICES__*/',()=>voices).replace('/*__APP__*/',()=>i18n+'\n'+app);
fs.mkdirSync(path.join(base,'dist'),{recursive:true});
fs.writeFileSync(path.join(base,'dist','index.html'),html);
fs.writeFileSync(path.join(base,'基音の知覚・シミュレーター.web_v1.0.6.html'),html);
console.log('Built standalone HTML, '+Buffer.byteLength(html)+' bytes. Eight original voice presets included unchanged.');
