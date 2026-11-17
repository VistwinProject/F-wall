import {randomUUID} from 'node:crypto';
import {sendBounded} from './transport-guard.mjs';
// Volume has its own epoch and acknowledgement; it never advances show revision.
export function createWebVolume({send,now=Date.now,epoch=randomUUID()}){
 const peers=new Map(),reports=new Map(),history=new Map();let pending=null;
 const live=()=>[...reports.entries()].filter(([ws,r])=>peers.get(ws)==='table'&&now()-r.at<4000);
 function snapshot(){const rows=live(),r=rows.length===1?rows[0][1]:null;return {type:'f-volume-status',protocol:'web-volume-v1',epoch,supported:!!r,volume:r?.volume??null,muted:r?.muted??false,clients:rows.length};}
 function finish(ok,note){if(!pending)return;const p=pending;pending=null;const ack={type:'f-volume-ack',protocol:'web-volume-v1',epoch,reqId:p.id,ok,note,audioControl:snapshot()};history.set(p.id,{value:p.value,ack});if(history.size>100)history.delete(history.keys().next().value);send(p.client,ack);}
 function tick(){if(pending){const rows=live(),r=rows.length===1?rows[0][1]:null;if(r?.appliedId===pending.id&&r.volume===pending.value)finish(true,'網頁音量已套用');else if(now()-pending.at>5000)finish(false,'F 音量未回報，結果待確認');}const s=snapshot();for(const [ws,role]of peers)if(role==='x')send(ws,s);}
 function receive(client,m){
  const role=peers.get(client);
  if(m?.type==='f-volume-report'&&role==='table'){
   if(m.protocol!=='web-volume-v1'||m.supported!==true||!Number.isInteger(m.volume)||m.volume<0||m.volume>100)return;
   reports.set(client,{volume:m.volume,muted:m.muted===true,appliedId:m.appliedId,at:now()});tick();return;
  }
  if(m?.type!=='f-volume-command'||role!=='x')return;
  const id=m.reqId,value=m.value;
  const reject=note=>send(client,{type:'f-volume-ack',protocol:'web-volume-v1',epoch,reqId:id,ok:false,note});
  if(typeof id!=='string'||!id.length||id.length>128||!Number.isInteger(value)||value<0||value>100){reject('音量必須為 0–100');return;}
  const old=history.get(id);if(old){if(old.value===value)send(client,old.ack);else reject('reqId-reused');return;}
  if(pending){reject('上一個音量操作尚未完成');return;}
  if(m.epoch!==epoch||!snapshot().supported){reject('F 唯一音訊端尚未就緒');return;}
  pending={id,value,client,at:now()};send(live()[0][0],{type:'f-volume-apply',protocol:'web-volume-v1',epoch,reqId:id,value});
 }
 return {snapshot,receive,tick,open(ws,role){peers.set(ws,role);tick()},close(ws){peers.delete(ws);reports.delete(ws);if(pending?.client===ws)pending=null;tick()}};
}
export function installWebVolume(wss){
 const v=createWebVolume({send:(ws,m)=>sendBounded(ws,m)});
 wss.on('connection',(ws,req)=>{v.open(ws,new URL(req.url,'http://localhost').searchParams.get('role'));ws.on('message',raw=>{let m;try{m=JSON.parse(String(raw))}catch{return}v.receive(ws,m)});ws.on('close',()=>v.close(ws));});
 const timer=setInterval(v.tick,700);timer.unref();wss.once('close',()=>clearInterval(timer));return v;
}
