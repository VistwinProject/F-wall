// Transport liveness and application rendering are deliberately separate.
export function monitorDisplays(wss, snapshot) {
  const required = ['table', 'wall', 'graph'];
  const peers = new Map();
  const send = (ws, value) => { if (ws.readyState === 1) ws.send(JSON.stringify(value)); };
  function status() {
    const displays = Object.fromEntries([...required, 'ipad'].map(role => {
      const rows = [...peers.values()].filter(p => p.role === role);
      const row = rows.sort((a,b) => (b.at || 0) - (a.at || 0))[0];
      return [role, { connected: rows.length > 0, instances: rows.length,
        ready: rows.length === 1 && !!row?.report && row.report.revision === snapshot().revision && Date.now() - row.at < 7000 && (role!=='table'||row.report.output?.orb?.state==='ready'),
        ...(row?.report || {}), lastSeen: row?.at || null }];
    }));
    return {type:'f-status', revision:snapshot().revision, displays,
      ready:required.every(role => displays[role].ready)};
  }
  function publish() { const value=status(); for(const [ws,p] of peers) if(!required.includes(p.role)&&p.role!=='ipad')send(ws,value); }
  wss.on('connection',(ws,req)=>{
    const role=new URL(req.url,'http://localhost').searchParams.get('role') || 'controller';
    peers.set(ws,{role}); publish();
    ws.on('close',()=>{peers.delete(ws);publish();});
    ws.on('message',raw=>{
      let msg;try{msg=JSON.parse(String(raw));}catch{return;}
      if(msg.type==='f-render' && [...required,'ipad'].includes(role)) {
        if(!Number.isInteger(msg.revision)||msg.revision<0||msg.revision>snapshot().revision)return;
        peers.set(ws,{role,at:Date.now(),report:{revision:msg.revision,active:msg.active,
          session:msg.session,muted:msg.muted,visible:msg.visible,output:msg.output}});publish();
      }
      if(msg.type==='f-status-request')send(ws,status());
    });
  });
  const timer=setInterval(publish,2000);timer.unref();
  return {status};
}
