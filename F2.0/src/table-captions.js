import {AUDIO_CAPTIONS} from './audio-captions.js';

export function createTableCaptions(){
  const caption=document.querySelector('.table .core-caption');
  const introCaption=document.querySelector('.table .welcome-caption');
  if(!caption&&!introCaption)return ()=>{};
  if(caption){
    caption.textContent='';caption.classList.add('audio-caption');
    caption.setAttribute('aria-label','語音字幕');
  }
  let previous='',previousKind;
  return (audio,kind)=>{
    const key=kind==='device'?audio?.src.split('/').pop()?.replace(/\.wav(?:\?.*)?$/,''):kind;
    const cues=AUDIO_CAPTIONS[key]?.cues;
    // Each cue follows its own speech-aligned start, without a global offset.
    const time=audio?audio.currentTime:0;
    const cue=audio&&!audio.paused&&!audio.ended?cues?.find(c=>time>=c.start&&time<c.end):null;
    const text=cue?.text||'';
    if(text===previous&&kind===previousKind)return;previous=text;previousKind=kind;
    if(caption)caption.textContent=kind==='intro'?'':text;
    if(introCaption)introCaption.textContent=kind==='intro'?text:'';
  };
}
