import {mountOrb} from '/anlb-orb/orb.js';

// One approved renderer moves between the welcome and experience hosts.
// Only the public controller API is used; no shader or preset overrides.
const hosts=new Set();
let orb,container,frame=0,engaged=false,ready=false;
let recoveryAttempts=0,retryAfter=0;
let lastMotion=0,seenNfc=0,turn=0,turnTarget=0,spin=0,spinSpeed=0;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
function update(){
  frame=requestAnimationFrame(update);
  if(document.hidden){lastMotion=0;return;}
  const host=[...hosts].find(item=>item.sphere.isConnected&&item.isVisible());
  if(!host||!orb)return;
  if(orb.canvas.dataset.orbHealth==='error'){
    ready=false;for(const item of hosts)item.sphere.classList.remove('quantum-ready');
    // Retry only while visible, at most twice per page. Keep failures observable.
    if(!retryAfter)retryAfter=performance.now()+2000;
    if(recoveryAttempts<2&&performance.now()>=retryAfter){
      recoveryAttempts++;retryAfter=0;orb.dispose();engaged=false;mountCurrentOrb();
    }
  }
  if(container.parentElement!==host.sphere){
    container.parentElement?.classList.remove('quantum-ready');
    host.sphere.append(container);
  }
  if(ready)host.sphere.classList.add('quantum-ready');
  const voice=host.getVoice();
  const active=!!voice.showActive;
  if(active!==engaged){engaged=active;if(active)orb.start();else orb.end();}
  orb.setLevel(active?(voice.orbLevel??0):0);
  const now=performance.now(),dt=lastMotion?Math.min(.05,(now-lastMotion)/1000):0;
  lastMotion=now;
  if(voice.nfcAt&&voice.nfcAt!==seenNfc){
    seenNfc=voice.nfcAt;turnTarget+=(voice.nfcDirection??1)*.22;
  }
  const allConnected=active&&voice.activeCount===9&&voice.completionReady;
  // Readiness is published by the player after the last device narration.
  // Rotate the approved canvas as a unit; leave its internal shader untouched.
  spinSpeed+=((allConnected?.32:0)-spinSpeed)*(1-Math.exp(-dt*1.4));
  spin+=spinSpeed*dt;
  turn+=(turnTarget-turn)*(1-Math.exp(-dt*3));
  const age=voice.nfcAt?Math.max(0,(now-voice.nfcAt)/1000):10;
  const impulse=Math.sin(Math.min(age/1.6,1)*Math.PI)*Math.exp(-age*1.1);
  const direction=voice.nfcDirection??1;
  const tiltX=direction*impulse*5,tiltY=direction*impulse*10;
  container.style.transform=reducedMotion.matches?'none':
    `perspective(900px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) rotateZ(${turn+spin}rad)`;
  container.style.transformOrigin='50% 50%';
}
addEventListener('f-table-view-change',()=>{
  const host=[...hosts].find(item=>item.sphere.isConnected&&item.isVisible());
  if(host&&container){container.parentElement?.classList.remove('quantum-ready');host.sphere.append(container);if(ready)host.sphere.classList.add('quantum-ready');}
});
function mountCurrentOrb(){
  delete container.dataset.orbError;
  orb=mountOrb(container);
  const instance=orb;
  orb.ready.then(()=>{if(orb===instance)ready=true;}).catch(error=>{
    if(orb!==instance)return;
    container.dataset.orbError=error.message;
    console.warn('Approved ANLB orb unavailable:',error);
  });
}
export function createIntroQuantum(sphere,getVoice,isVisible){
  const host={sphere,getVoice,isVisible};hosts.add(host);
  if(!orb){
    container=document.createElement('div');container.className='intro-quantum';
    container.setAttribute('aria-hidden','true');sphere.append(container);
    mountCurrentOrb();
    update();
  }
  return ()=>{
    hosts.delete(host);sphere.classList.remove('quantum-ready');
    if(!hosts.size){
      cancelAnimationFrame(frame);orb?.dispose();container?.remove();
      orb=null;container=null;engaged=false;ready=false;
      recoveryAttempts=0;retryAfter=0;
      lastMotion=0;seenNfc=0;turn=0;turnTarget=0;spin=0;spinSpeed=0;
    }
  };
}
