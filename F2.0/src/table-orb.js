import {createIntroQuantum} from './intro-quantum.js';
import {tableVoice} from './table-audio.js';
export function createTableOrb(core){
  const dispose=createIntroQuantum(core,()=>tableVoice,()=>{
    const welcome=document.querySelector('#welcome');
    return !welcome||welcome.classList.contains('dismissed');
  });
  addEventListener('pagehide',dispose,{once:true});
  return dispose;
}
