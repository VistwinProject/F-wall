// Called only after the real view renderer has committed its DOM.
function orbOutput(){
  const canvas=document.querySelector('.intro-quantum canvas');
  const result={state:canvas?.dataset.orbHealth||'starting',error:canvas?.dataset.orbError||null};
  let warning=document.querySelector('#f-orb-warning');
  if(!warning){warning=document.createElement('div');warning.id='f-orb-warning';warning.style.cssText='position:fixed;top:42px;right:5px;z-index:99999;background:#823c15;color:white;padding:8px;font:14px sans-serif';document.body.append(warning);}
  warning.hidden=result.state==='ready';
  warning.textContent=result.state==='error'?'桌面球體暫時無法顯示 · 等待恢復':'桌面球體載入／恢復中';
  return result;
}
export function reportRendered(session,state,role){
  if(!state.online || !state.ready)return;
  const output={nodes:document.querySelectorAll(role==='table'?'[data-slot-icon].active':role==='wall'?'[data-photo].active':'[data-node].active').length,canvas:document.querySelectorAll('canvas').length};
  if(role==='table')output.orb=orbOutput();
  session.renderReport={revision:state.revision??0,active:state.active,session:state.session,muted:new URLSearchParams(location.search).has('mute'),visible:!document.hidden,output};
  session.send('f-render',session.renderReport);
}
export function installRenderHeartbeat(session){
  const timer=setInterval(()=>{
    if(session.state.online&&session.state.ready&&session.renderReport){
      // Refresh GPU health, never promote the last rendered revision to received state.
      const output={...session.renderReport.output};
      if(session.role==='table')output.orb=orbOutput();
      session.send('f-render',{...session.renderReport,output,visible:!document.hidden});
    }
  },2000);
  addEventListener('pagehide',()=>clearInterval(timer),{once:true});
}
