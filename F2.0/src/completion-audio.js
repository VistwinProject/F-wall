export function createCompletionAudio({stage,role,notify}){
 if(role!=='ipad')return {sync(){}};
 const overlay=stage.querySelector('#completion'),audio=new Audio('/f-completion.wav');audio.preload='metadata';
 const button=document.createElement('button');button.textContent='播放全屋連接完成語音';button.hidden=true;overlay.firstElementChild.append(button);
 let visible=false,muted=false,generation=0;
 function stop(){generation++;audio.pause();audio.currentTime=0;button.hidden=true;}
 async function play(){
  if(!visible||muted)return;const attempt=++generation;button.hidden=true;
  try{await audio.play();}
  catch(error){if(attempt!==generation||!visible)return;if(error.name==='NotAllowedError')button.hidden=false;else notify('全屋連接完成語音暫時無法播放。');}
 }
 button.addEventListener('click',e=>{e.stopPropagation();play();});
 addEventListener('f-stop-audio',()=>{muted=true;stop();});
 addEventListener('pagehide',()=>{visible=false;stop();},{once:true});
 return {sync(show,silent=false){
  muted=silent;
  if(show===visible){if(muted&&!audio.paused)stop();return;}
  visible=show;stop();if(show&&!muted)play();
 }};
}
