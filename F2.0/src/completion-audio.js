import {registerVoiceAudio,prepareVoiceAudio,claimVoice} from './table-audio.js';
export function createCompletionAudio({role,session,notify}){
 if(role==='ipad'){
  let visible=false;
  return {sync(show,silent=false){if(show&&!visible&&!silent)session.send('completion-play');visible=show;}};
 }
 if(role!=='table')return {sync(){}};
 const audio=registerVoiceAudio(new Audio('/f-completion.wav'),'completion');audio.preload='metadata';
 const button=document.createElement('button');button.className='device-audio-unlock';button.textContent='播放全屋連接完成語音';button.hidden=true;document.querySelector('#app').append(button);
 let attempt=0,wanted=false;
 function stop(){attempt++;wanted=false;audio.pause();audio.currentTime=0;button.hidden=true;}
 async function play(){
  if(!wanted)return;const run=++attempt;claimVoice('completion');button.hidden=true;
  try{await prepareVoiceAudio();if(run!==attempt)return;await audio.play();if(run!==attempt)audio.pause();}
  catch{if(run===attempt){button.hidden=false;notify('請在 Table 啟用語音後重試。');}}
 }
 button.addEventListener('click',play);
 addEventListener('f-table-audio-unlocked',()=>{if(wanted&&audio.paused)play();});
 addEventListener('f-audio-claim',e=>{if(e.detail!=='completion')stop();});
 session.addEventListener('change',({detail:{type,state,event}})=>{
  if(type==='audio-stop'||!state.session||state.active.length<9||event?.suppressAudio){stop();return;}
  if(type==='completion-play'){wanted=true;play();}
 });
 addEventListener('pagehide',stop,{once:true});
 return {sync(){}};
}
