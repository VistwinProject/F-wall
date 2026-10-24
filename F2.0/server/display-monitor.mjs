import {sendBounded} from './transport-guard.mjs';
// Transport liveness and application rendering are deliberately separate.
export function monitorDisplays(wss, snapshot, required = ['table', 'wall', 'graph']) {
  const roles = ['table', 'wall', 'graph', 'ipad'];
  if(!required.length||new Set(required).size!==required.length||required.some(role=>!roles.includes(role)))throw Error('Invalid required display roles');
  const peers = new Map();
  const send = sendBounded;
  function status() {
    const displays = Object.fromEntries(roles.map(role => {
      const rows = [...peers.values()].filter(p => p.role === role);
      const row = rows.sort((a,b) => (b.at || 0) - (a.at || 0))[0];
      return [role, { connected: rows.length > 0, instances: rows.length,
        ready: rows.length === 1 && !!row?.report && row.report.revision === snapshot().revision && Date.now() - row.at < 7000 && (role!=='table'||row.report.output?.orb?.state==='ready'),
        ...(row?.report || {}), lastSeen: row?.at || null }];
    }));
    return {type:'f-status', revision:snapshot().revision, required:[...required], displays,
      ready:required.every(role => displays[role].ready)};
  }
  function publish() { const value=status(); for(const [ws,p] of peers) if(!required.includes(p.role)&&p.role!=='ipad')send(ws,value); }
  wss.on('connection',(ws,req)=>{
    const role=new URL(req.url,'http://localhost').searchParams.get('role') || 'controller';
    peers.set(ws,{role}); publish();
    ws.on('close',()=>{peers.delete(ws);publish();});
    ws.on('message',raw=>{
      let msg;try{msg=JSON.parse(String(raw));}catch{return;}
      if(!msg||typeof msg!=='object'||Array.isArray(msg))return;
      if(msg.type==='f-render' && roles.includes(role)) {
        if(!Number.isInteger(msg.revision)||msg.revision<0||msg.revision>snapshot().revision)return;
        peers.set(ws,{role,at:Date.now(),report:{revision:msg.revision,active:msg.active,
          session:msg.session,muted:msg.muted,visible:msg.visible,output:msg.output}});publish();
      }
      if(msg.type==='f-status-request')send(ws,status());
    });
  });
  const timer=setInterval(publish,2000);timer.unref();
  const stop=()=>clearInterval(timer);
  wss.once('close',stop);
  return {status,stop};
}
