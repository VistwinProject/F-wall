import {createTableCaptions} from './table-captions.js';
export const tableVoice={level:0,orbLevel:0,showActive:false,pitch:.4,speaking:false,nfcAt:0,nfcDirection:1,active:false,activeCount:0,completionReady:false};
const tracks=new Map();
let context,analyser,masterGain,samples,frame,last=0,updateCaption=()=>{};
let webVolume=100,volumeAppliedId=null;
try{const raw=localStorage.getItem('x-web-volume-F'),n=Number(raw);if(raw!==null&&Number.isInteger(n)&&n>=0&&n<=100)webVolume=n}catch{}
export function webAudioControl(){return {protocol:'web-volume-v1',supported:!!masterGain,volume:masterGain?Math.round(masterGain.gain.value*100):null,muted:!!masterGain&&masterGain.gain.value===0,appliedId:volumeAppliedId}}
export function applyWebVolume(value,id){
 if(!masterGain||!Number.isInteger(value)||value<0||value>100||typeof id!=='string')return false;
 masterGain.gain.value=value/100;webVolume=Math.round(masterGain.gain.value*100);volumeAppliedId=id;
 try{localStorage.setItem('x-web-volume-F',String(webVolume))}catch{}
 return true;
}
function connect(){
  if(!context){
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return;
    context=new AC();analyser=context.createAnalyser();analyser.fftSize=2048;
    masterGain=context.createGain();masterGain.gain.value=webVolume/100;analyser.connect(masterGain);masterGain.connect(context.destination);samples=new Float32Array(2048);
  }
  for(const [audio,track]of tracks)if(!track.source){
    track.source=context.createMediaElementSource(audio);track.source.connect(analyser);
  }
}
function tick(now){
  frame=requestAnimationFrame(tick);
  if(now-last<33)return;last=now;
  const playing=[...tracks.keys()].find(a=>!a.paused&&!a.ended);
  tableVoice.speaking=!!playing;
  updateCaption(playing,tracks.get(playing)?.kind);
  let level=0;tableVoice.orbLevel=0;
  if(tableVoice.speaking&&context?.state==='running'){
    analyser.getFloatTimeDomainData(samples);
    let power=0;for(let i=0;i<samples.length;i++)power+=samples[i]*samples[i];
    const rms=Math.sqrt(power/samples.length);
    level=Math.max(0,Math.min(1,(rms-.008)*8));
    tableVoice.orbLevel=Math.max(0,Math.min(1,(rms-.008)*5));
  }
  tableVoice.level+=(level-tableVoice.level)*(level>tableVoice.level?.23:.09);
}
export function registerVoiceAudio(audio,kind){tracks.set(audio,{kind});if(context)connect();return audio;}
export async function prepareVoiceAudio(){connect();await context?.resume();}
export function claimVoice(kind){dispatchEvent(new CustomEvent('f-audio-claim',{detail:kind}));}
export function setupTableAudio({session,notify}){
 const reportVolume=()=>{const a=webAudioControl();if(a.supported)session.send('f-volume-report',a)};
 const applyVolume=({detail:m})=>{if(m.protocol==='web-volume-v1'&&applyWebVolume(m.value,m.reqId))reportVolume()};
 session.addEventListener('web-volume',applyVolume);
 const volumeTimer=setInterval(reportVolume,700);
 addEventListener('pagehide',()=>{clearInterval(volumeTimer);session.removeEventListener('web-volume',applyVolume)},{once:true});
  updateCaption=createTableCaptions();
  const button=document.createElement('button');button.className='device-audio-unlock';button.textContent='啟用 Table 語音';document.querySelector('#app').append(button);
  button.addEventListener('click',async()=>{
    try{await prepareVoiceAudio();button.hidden=true;dispatchEvent(new Event('f-table-audio-unlocked'));}
    catch{notify('音訊尚未啟用，請再點一次。');}
  });
  // The Windows exhibition launcher permits autoplay. Keep the manual fallback
  // when the browser or an enterprise policy still requires a user gesture.
  if(new URLSearchParams(location.search).has('exhibition')){
    prepareVoiceAudio().then(()=>{
      if(context?.state==='running'){button.hidden=true;dispatchEvent(new Event('f-table-audio-unlocked'));}
    }).catch(()=>{});
  }
  session.addEventListener('change',({detail:{type,state,event}})=>{
    // A show spans intro, device tracks, their pauses and the closing track.
    // Neither silence, NFC removal nor a single audio ended event ends it.
    if(type==='session-end')tableVoice.showActive=false;
    else if(type==='session-start'||state.session||['requested','playing','done'].includes(state.introPhase))tableVoice.showActive=true;
    tableVoice.active=state.active.length>0;
    tableVoice.activeCount=state.active.length;
    tableVoice.completionReady=!!state.completionAudioReady&&!state.cancelledAudio;
    if((type==='tag-present'&&event?.known!==false)||type==='tag-remove'){
      tableVoice.nfcAt=performance.now();tableVoice.nfcDirection=type==='tag-remove'?-1:1;
    }
    if(type==='audio-stop'||type==='session-end'){for(const a of tracks.keys())a.pause();tableVoice.level=0;tableVoice.orbLevel=0;tableVoice.speaking=false;updateCaption(null,null);}
  });
  frame=requestAnimationFrame(tick);
  addEventListener('pagehide',()=>{cancelAnimationFrame(frame);for(const a of tracks.keys())a.pause();context?.close();tracks.clear();},{once:true});
}
