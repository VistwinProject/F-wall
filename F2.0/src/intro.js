// iPad narration: an explicit gesture starts audio; a second gesture after
// narration finishes starts the shared session. Table has no audio player.
export function createIntro({stage,role,notify}){
 if(role!=='ipad')return {sync(){}};
 const welcome=stage.querySelector('#welcome'),content=welcome.firstElementChild;
 const audio=new Audio('/f-intro.wav');audio.preload='metadata';
 const start=welcome.querySelector('[data-action="start"]');
 start.classList.add('intro-prompt');start.textContent='點選任意位置播放前導語音';start.hidden=false;
 const controls=document.createElement('div');controls.className='intro-controls';controls.innerHTML='<span class="intro-status" role="status" aria-live="polite"></span>';content.append(controls);
 const status=controls.querySelector('.intro-status');
 const sphere=document.createElement('div');sphere.className='intro-sphere';sphere.setAttribute('aria-hidden','true');
 sphere.innerHTML=`<div class="intro-orb-halo"></div><div class="intro-orb"><div class="intro-orb-flow"></div><div class="intro-orb-depth"></div><svg viewBox="0 0 240 160" class="intro-orb-waves" fill="none"><path d="M0 80C30 80 34 28 60 50S96 128 120 80 157 25 180 65 210 80 240 80"/><path d="M0 80C29 80 35 112 60 92S91 32 120 80 157 130 180 85 210 80 240 80"/><path d="M0 80C40 80 52 57 80 80S115 109 140 76 179 66 200 80 230 80 240 80"/></svg><div class="intro-orb-specular"></div></div>`;
 content.insertBefore(sphere,content.querySelector('.welcome-instruction'));
 let visible=false,phase='ready',token=0,context,analyser,source,bins,frame,last=0;
 function connectAudio(){
  if(context)return;const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)return;
  try{context=new AudioContext();analyser=context.createAnalyser();analyser.fftSize=256;analyser.smoothingTimeConstant=.82;source=context.createMediaElementSource(audio);source.connect(analyser);analyser.connect(context.destination);bins=new Uint8Array(analyser.frequencyBinCount);}catch{context?.close();context=null;}
 }
 function animate(t){
  if(!visible||audio.paused)return;frame=requestAnimationFrame(animate);if(t-last<40)return;last=t;
  let level=.15;if(analyser&&context.state==='running'){analyser.getByteFrequencyData(bins);level=bins.reduce((n,v)=>n+v,0)/bins.length/255;}
  sphere.style.setProperty('--voice',String(Math.min(1,level*2.5)));
 }
 function halt(){cancelAnimationFrame(frame);sphere.classList.remove('speaking');sphere.style.setProperty('--voice','0');}
 function retryPrompt(){phase='ready';halt();start.hidden=false;start.textContent='點選任意位置重新播放前導語音';status.textContent='語音未能播放，請點選重試';}
 async function play(){
  const attempt=token;phase='starting';start.hidden=true;status.textContent='語音準備中';connectAudio();
  try{
   await context?.resume();if(!visible||attempt!==token)return;
   await audio.play();if(!visible||attempt!==token){audio.pause();return;}
   phase='playing';status.textContent='前導語音播放中';sphere.classList.add('speaking');cancelAnimationFrame(frame);frame=requestAnimationFrame(animate);
  }catch{if(visible&&attempt===token)retryPrompt();}
 }
 audio.addEventListener('ended',()=>{if(!visible)return;phase='done';halt();status.textContent='';start.textContent='點選任意位置開始體驗';start.hidden=false;});
 audio.addEventListener('error',()=>{if(!visible)return;retryPrompt();notify('前導語音載入失敗，請點選首頁重試。');});
 welcome.addEventListener('click',e=>{
  if(visible&&phase==='done')return;
  // Preview shortcut: a second click skips narration, not the start screen.
  if(visible&&(phase==='starting'||phase==='playing')){
   e.preventDefault();e.stopImmediatePropagation();
   token++;audio.pause();halt();phase='done';status.textContent='';
   start.textContent='點選任意位置開始體驗';start.hidden=false;
   return;
  }
  e.preventDefault();e.stopImmediatePropagation();
  if(visible&&phase==='ready'){audio.currentTime=0;play();}
 },true);
 addEventListener('f-stop-audio',()=>{token++;audio.pause();halt();phase='ready';status.textContent='';if(visible){start.textContent='點選任意位置播放前導語音';start.hidden=false;}});
 addEventListener('pagehide',()=>{visible=false;token++;audio.pause();halt();context?.close();},{once:true});
 return {sync(state){
  if(!state.ready)return;const next=!state.session;if(next===visible)return;visible=next;token++;
  audio.pause();halt();status.textContent='';
  if(next){phase='ready';audio.currentTime=0;start.textContent='點選任意位置播放前導語音';start.hidden=false;}
  else start.hidden=true;
 }};
}
