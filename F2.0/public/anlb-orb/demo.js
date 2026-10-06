import {mountOrb} from './orb.js';
const orb=mountOrb(document.querySelector('#orb'));window.anlbOrb=orb;
const audio=document.querySelector('#audio'),mode=document.querySelector('#mode');
let simulation=0,url=null,connected=false;
function stopSimulation(){cancelAnimationFrame(simulation);simulation=0;orb.setLevel(0);}
function note(text){mode.textContent=text;}
orb.ready.then(()=>note('待機 · 按下示範或選擇旁白')).catch(e=>note('無法啟動：'+e.message));
document.querySelector('#simulate').onclick=()=>{
 stopSimulation();audio.pause();orb.disconnectAudio();connected=false;orb.start();note('無聲示範 · 合成音量，並非正式旁白');
 const start=performance.now();function tick(now){const t=(now-start)%2300;const pulse=Math.max(0,Math.sin(Math.PI*(t%280)/280));orb.setLevel(t<1500?(.14+.66*pulse*pulse)*Math.min(1,t/80,(1500-t)/100):0);simulation=requestAnimationFrame(tick);}simulation=requestAnimationFrame(tick);
};
document.querySelector('#quiet').onclick=()=>{stopSimulation();audio.pause();orb.start();note('停頓 · 保持思考，額外起伏收回');};
document.querySelector('#end').onclick=()=>{stopSimulation();audio.pause();orb.end();note('整場結束 · 待機');};
document.querySelector('#file').onchange=e=>{stopSimulation();audio.pause();orb.end();if(url)URL.revokeObjectURL(url);const file=e.target.files[0];if(file){url=URL.createObjectURL(file);audio.src=url;note('已選旁白 · 按播放開始');}};
async function prepare(){stopSimulation();if(!connected){await orb.connectAudio(audio);connected=true;}orb.start();note('實際音訊 · 依聲音強弱起伏');}
document.querySelector('#play').onclick=async()=>{if(!audio.src){note('請先選擇音檔');return;}try{await prepare();await audio.play();}catch(e){note('播放失敗：'+e.message);}};
audio.addEventListener('play',()=>prepare().catch(e=>note(e.message)));
audio.addEventListener('pause',()=>{orb.setLevel(0);});
audio.addEventListener('ended',()=>note('音檔播放完 · 保持思考，整場結束請按上方按鈕'));
