// Shared shell integration; Graph source snapshot stays unchanged.
let busy=false;
const role=location.pathname.slice(1);
if(['wall','table','graph'].includes(role))document.addEventListener('keydown',async event=>{
 if(event.key==='Escape'&&!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
  event.preventDefault();event.stopImmediatePropagation();if(busy)return;busy=true;
  try{const response=await fetch('/exhibition-exit',{method:'POST'});if(!response.ok)throw Error(await response.text());}
  catch(error){console.error('F exit:',error);alert('關閉失敗，請雙擊 final_f 資料夾的 Stop.cmd。');busy=false;}
  return;
 }
 if(event.code!=='Space'||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.target.closest('input,textarea,select,[contenteditable="true"],button'))return;
 event.preventDefault();if(busy)return;busy=true;
 try{
  const response=await fetch('/display-fullscreen',{method:'POST'});
  if(response.status===501){
   if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();
  }else if(!response.ok)throw Error(await response.text());
 }catch(error){console.error('F fullscreen:',error);alert('全螢幕切換失敗，請用 Stop F 停止後，再以新版 Start F 啟動。');}
 finally{busy=false;}
},true);
