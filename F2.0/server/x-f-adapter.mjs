import {WebSocket} from 'ws';
import {randomUUID} from 'node:crypto';
// Drop-in X adapter. Only F uses this factory; no shared ws adapter changes.
export function makeFAdapter(zone,{onStatus,log=()=>{}}){
  let ws,timer,stopped=false,pending=null;
  const observed={displays:{},outputs:[],phase:null,revision:null,scope:'F-table / FWALL / F-knowledge-graph-27'};
  function fail(error){if(pending){clearTimeout(pending.timer);pending.reject(new Error(error));pending=null;}}
  function check(){
    if(!pending||pending.revision===undefined)return;
    const missing=['table','wall','graph'].filter(role=>!observed.displays[role]?.ready||observed.displays[role].revision<pending.revision);
    if(!missing.length){const p=pending;pending=null;clearTimeout(p.timer);p.resolve(`F 三屏 rendered ack revision ${p.revision}`);}
  }
  function connect(){
    if(stopped)return;
    ws=new WebSocket(zone.transport.url);
    ws.on('open',()=>{onStatus(false,'F 服務已連線，等待三屏 ready');ws.send(JSON.stringify({type:'f-status-request'}));});
    ws.on('message',raw=>{
      let m;try{m=JSON.parse(String(raw));}catch{return;}
      if(m.type==='f-command-accepted'&&m.requestId===pending?.id){pending.revision=m.revision;check();}
      if(m.type==='f-command-error'&&m.requestId===pending?.id)fail(m.error);
      if(m.type==='f-status'){
        observed.displays=m.displays;observed.revision=m.revision;
        observed.outputs=Object.entries(m.displays).map(([id,d])=>({id,...d}));
        observed.phase=m.displays.table?.session?'live':'welcome';
        onStatus(m.ready,['table','wall','graph'].map(r=>`${r}: ${m.displays[r]?.ready?'ready r'+m.displays[r].revision+' ('+(m.displays[r].active?.length||0)+')':m.displays[r]?.connected?'等待渲染':'離線'}`).join(' · '));check();
      }
    });
    ws.on('error',e=>log('warn',e.message));
    ws.on('close',()=>{fail('F 連線中斷，指令未確認');for(const d of Object.values(observed.displays)){d.connected=false;d.ready=false;}onStatus(false,'F 服務斷線');if(!stopped){clearTimeout(timer);timer=setTimeout(connect,1000);}});
  }
  return {observed,start:connect,stop(){stopped=true;clearTimeout(timer);fail('F adapter stopped');ws?.close();},send(action,option){
    if(zone.transport.readOnly)return Promise.reject(new Error('F 唯讀'));
    if(ws?.readyState!==WebSocket.OPEN)return Promise.reject(new Error('F 未連線'));
    if(pending)return Promise.reject(new Error('F 上一指令尚未確認'));
    const command=option&&action.sendFor?action.sendFor(option):action.send;
    return new Promise((resolve,reject)=>{const id=randomUUID();pending={id,resolve,reject,timer:setTimeout(()=>fail('F 三屏 rendered ack 逾時；請查看各屏狀態'),10000)};ws.send(JSON.stringify({type:'f-command',requestId:id,command}));});
  }};
}
