import {BY_ID} from './devices.js';

export function createDeviceAudio({session,role,notify}){
 if(role!=='table')return;
 const audio=new Audio();audio.preload='none';
 const button=document.createElement('button');button.className='device-audio-unlock';button.textContent='點此播放家電語音';button.hidden=true;document.querySelector('#app').append(button);
 let present=new Map(),previous=new Map(),pending=null,current=null,timer=null,fadeFrame=null,generation=0;
 const occupancy=state=>new Map(Object.entries(state.slots).filter(([,s])=>BY_ID[s?.data?.id]).map(([slot,s])=>[slot,{slot,id:s.data.id,uid:s.uid,key:`${slot}:${s.uid||s.data.id}:${s.data.id}`} ]));
 const exists=item=>!!item&&present.get(item.slot)?.key===item.key;
 function stop(){
  generation++;clearTimeout(timer);timer=null;cancelAnimationFrame(fadeFrame);fadeFrame=null;
  audio.pause();audio.volume=1;current=null;pending=null;button.hidden=true;
 }
 function fadeOut(){
  generation++;clearTimeout(timer);timer=null;pending=null;current=null;button.hidden=true;cancelAnimationFrame(fadeFrame);
  const attempt=generation,start=performance.now(),volume=audio.volume;
  if(audio.paused){audio.volume=1;return;}
  function tick(now){
   if(attempt!==generation)return;
   const t=Math.min(1,(now-start)/220);audio.volume=volume*(1-t);
   if(t<1)fadeFrame=requestAnimationFrame(tick);
   else{audio.pause();audio.volume=1;fadeFrame=null;}
  }
  fadeFrame=requestAnimationFrame(tick);
 }
 async function play(){
  timer=null;const item=pending;if(!exists(item)){pending=null;button.hidden=true;return;}
  pending=null;current=item;button.hidden=true;audio.volume=1;
  const attempt=++generation;audio.src=`/device-audio/${item.id}.wav`;
  try{await audio.play();}
  catch(error){
   if(attempt!==generation)return;current=null;
   if(error.name==='NotAllowedError'&&exists(item)){pending=item;button.hidden=false;}
   else notify(`${BY_ID[item.id].label}語音無法播放，已略過。`);
  }
 }
 function schedule(item){stop();pending=item;timer=setTimeout(play,500);}
 button.addEventListener('click',()=>{if(pending&&timer===null)play();});
 audio.addEventListener('ended',()=>{const finished=current;current=null;if(exists(finished))session.send('device-audio-finished',{slot_index:Number(finished.slot),id:finished.id,uid:finished.uid});});
 audio.addEventListener('error',()=>{if(!current)return;const name=BY_ID[current.id].label;stop();notify(`${name}語音載入失敗，已略過。`);});
 session.addEventListener('change',({detail:{type,state,event}})=>{
  present=occupancy(state);
  if(type==='audio-stop'||!state.session||event?.suppressAudio){stop();previous=present;return;}
  if((current&&!exists(current))||(pending&&!exists(pending)))fadeOut();
  if(type==='tag-present'){
   const slot=String(event?.slot_index),item=present.get(slot);
   if(item&&previous.get(slot)?.key!==item.key)schedule(item);
  }
  previous=present;
 });
 addEventListener('pagehide',()=>{stop();audio.removeAttribute('src');audio.load();},{once:true});
}
