import {AUDIO_CAPTIONS} from './audio-captions.js';

export function createTableCaptions(){
  const caption=document.querySelector('.table .core-caption');
  if(!caption)return ()=>{};
  caption.textContent='';caption.classList.add('audio-caption');
  caption.setAttribute('aria-label','語音字幕');
  let previous='';
  return (audio,kind)=>{
    const key=kind==='device'?audio?.src.split('/').pop()?.replace(/\.wav(?:\?.*)?$/,''):kind;
    const cues=AUDIO_CAPTIONS[key]?.cues;
    // Each cue follows its own speech-aligned start, without a global offset.
    const time=audio?audio.currentTime:0;
    const cue=audio&&!audio.paused&&!audio.ended?cues?.find(c=>time>=c.start&&time<c.end):null;
    const text=cue?.text||'';
    if(text===previous)return;previous=text;
    caption.textContent=text;
  };
}
