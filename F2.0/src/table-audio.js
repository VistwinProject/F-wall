import {createTableCaptions} from './table-captions.js';
export const tableVoice={level:0,orbLevel:0,showActive:false,pitch:.4,speaking:false,nfcAt:0,nfcDirection:1,active:false,activeCount:0,completionReady:false};
const tracks=new Map();
let context,analyser,samples,frame,last=0,updateCaption=()=>{};
function connect(){
  if(!context){
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return;
    context=new AC();analyser=context.createAnalyser();analyser.fftSize=2048;
    analyser.connect(context.destination);samples=new Float32Array(2048);
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
  updateCaption=createTableCaptions();
  const button=document.createElement('button');button.className='device-audio-unlock';button.textContent='啟用 Table 語音';document.querySelector('#app').append(button);
  button.addEventListener('click',async()=>{
    try{await prepareVoiceAudio();button.hidden=true;dispatchEvent(new Event('f-table-audio-unlocked'));}
    catch{notify('音訊尚未啟用，請再點一次。');}
  });
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
