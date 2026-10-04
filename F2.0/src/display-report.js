// Called only after the real view renderer has committed its DOM.
export function reportRendered(session,state,role){
  if(!state.online || !state.ready)return;
  const output={nodes:document.querySelectorAll(role==='table'?'[data-slot-icon].active':role==='wall'?'[data-photo].active':'[data-node].active').length,canvas:document.querySelectorAll('canvas').length};
  session.renderReport={revision:state.revision??0,active:state.active,session:state.session,muted:new URLSearchParams(location.search).has('mute'),visible:!document.hidden,output};
  session.send('f-render',session.renderReport);
}
export function installRenderHeartbeat(session){
  const timer=setInterval(()=>{if(session.state.online&&session.state.ready&&session.renderReport)session.send('f-render',{...session.renderReport,visible:!document.hidden});},2000);
  addEventListener('pagehide',()=>clearInterval(timer),{once:true});
}
