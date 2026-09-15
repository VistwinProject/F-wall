import {registerVoiceAudio,prepareVoiceAudio,claimVoice} from './table-audio.js';
export function createIntro({stage,role,notify,session}){
 if(role==='wall')return {sync(){}};
 const welcome=stage.querySelector('#welcome');
 if(role==='ipad'){
  const button=welcome.querySelector('[data-action="start"]');button.classList.add('intro-prompt');
  let current=session.state;
  welcome.addEventListener('click',e=>{
   if(current.session||current.introPhase==='done')return;
   e.preventDefault();e.stopImmediatePropagation();
   const busy=['requested','playing'].includes(current.introPhase);
   if(!session.send(busy?'intro-skip':'intro-play'))notify('尚未連線，請稍後再試。');
  },true);
  return {sync(state){
   current=state;button.hidden=!!state.session;
   button.textContent=state.introPhase==='done'?'點選任意位置開始體驗':state.introPhase==='playing'?'前導語音播放中 · 點選可略過':state.introPhase==='requested'?'等待 Table 播放 · 點選可略過':state.introPhase==='error'?'點選重試前導語音（請先啟用 Table 語音）':'點選任意位置播放前導語音';
  }};
 }
 const audio=registerVoiceAudio(new Audio('/f-intro.wav'),'intro');audio.preload='metadata';
 let current=session.state,played=-1,attempt=0,playingToken=-1;
 function stop(){attempt++;audio.pause();audio.currentTime=0;}
 async function play(token){
  const run=++attempt;playingToken=token;claimVoice('intro');
  try{
   await prepareVoiceAudio();if(run!==attempt)return;
   audio.currentTime=0;await audio.play();
   if(run!==attempt){audio.pause();return;}
   session.send('intro-status',{phase:'playing',token});
  }catch{if(run===attempt){session.send('intro-status',{phase:'error',token});notify('請先在 Table 點選「啟用語音」，再由 iPad 重試。');}}
 }
 audio.addEventListener('ended',()=>session.send('intro-status',{phase:'done',token:playingToken}));
 audio.addEventListener('error',()=>{stop();session.send('intro-status',{phase:'error',token:playingToken});});
 addEventListener('f-audio-claim',e=>{if(e.detail!=='intro')stop();});
 addEventListener('f-stop-audio',stop);
 addEventListener('f-table-audio-unlocked',()=>{if(!current.session&&['requested','error'].includes(current.introPhase))play(current.introToken);});
 addEventListener('pagehide',stop,{once:true});
 return {sync(state){
  current=state;
  if(state.session||['ready','done','error'].includes(state.introPhase)){if(!audio.paused)stop();return;}
  if(state.introPhase==='requested'&&played!==state.introToken){played=state.introToken;play(played);}
 }};
}
