import {WebSocket} from 'ws';
export const displayPorts={table:6283,wall:6284,graph:6285};
const reloads=new Map();
export function reloadDisplay(role){
 if(reloads.has(role))return reloads.get(role);
 const operation=(async()=>{
  const port=displayPorts[role];if(!port)throw Error('Unknown display');
  const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(3000)})).json();
  const target=targets.find(t=>{try{const u=new URL(t.url);return t.type==='page'&&['localhost','127.0.0.1'].includes(u.hostname)&&u.pathname==='/'+role;}catch{return false;}});
  if(!target?.webSocketDebuggerUrl)throw Error(`${role}: dedicated F display not found`);
  await new Promise((resolve,reject)=>{
   const ws=new WebSocket(target.webSocketDebuggerUrl);let done=false;
   const finish=error=>{if(done)return;done=true;clearTimeout(timer);ws.close();error?reject(error):resolve();};
   const timer=setTimeout(()=>{finish(Error(`${role}: reload timeout`));ws.terminate();},5000);
   ws.on('error',finish);
   ws.on('close',()=>finish(Error(`${role}: reload connection closed`)));
   ws.on('open',()=>ws.send(JSON.stringify({id:1,method:'Page.reload',params:{ignoreCache:true}})));
   ws.on('message',raw=>{try{const m=JSON.parse(raw);if(m.id===1)finish(m.error?Error(m.error.message):null);}catch(error){finish(error);}});
  });
 })();
 reloads.set(role,operation);
 operation.finally(()=>reloads.delete(role)).catch(()=>{});
 return operation;
}
export async function displayWindow(role,state){
 const port=displayPorts[role];if(!port)throw Error('Unknown display');
 const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(3000)});
 const targets=await response.json();
 const target=targets.find(t=>{try{const u=new URL(t.url);return t.type==='page'&&['localhost','127.0.0.1'].includes(u.hostname)&&u.pathname==='/'+role;}catch{return false;}});
 if(!target)throw Error(`${role}: dedicated F display not found`);
 const version=await (await fetch(`http://127.0.0.1:${port}/json/version`,{signal:AbortSignal.timeout(3000)})).json();
 return new Promise((resolve,reject)=>{
  const ws=new WebSocket(version.webSocketDebuggerUrl);let id=0;const pending=new Map();
  const finish=(error,value)=>{clearTimeout(timer);ws.close();error?reject(error):resolve(value);};
  const timer=setTimeout(()=>{ws.terminate();finish(Error(`${role}: window control timeout`));},5000);
  const call=(method,params)=>new Promise((res,rej)=>{pending.set(++id,{res,rej});ws.send(JSON.stringify({id,method,params}));});
  ws.on('message',data=>{const message=JSON.parse(data);const p=pending.get(message.id);if(p){pending.delete(message.id);message.error?p.rej(Error(message.error.message)):p.res(message.result);}});
  ws.on('error',error=>finish(error));
  ws.on('open',async()=>{try{
   const current=await call('Browser.getWindowForTarget',{targetId:target.id});
   if(state)await call('Browser.setWindowBounds',{windowId:current.windowId,bounds:{windowState:state}});
   const result=await call('Browser.getWindowBounds',{windowId:current.windowId});
   finish(null,result.bounds.windowState);
  }catch(error){finish(error);}});
 });
}
let busy=false;
export async function toggleDisplays(){
 if(busy)throw Error('Window transition in progress');busy=true;
 try{
  const current=await Promise.all(Object.keys(displayPorts).map(role=>displayWindow(role)));
  const state=current.every(s=>s==='fullscreen')?'normal':'fullscreen';
  await Promise.all(Object.keys(displayPorts).map(role=>displayWindow(role,state)));
  return {state};
 }finally{busy=false;}
}
if(process.argv[1]?.endsWith('window-control.mjs')){
 try{await displayWindow(process.argv[2],'fullscreen');console.log('Fullscreen ready');}catch(e){console.error(e.message);process.exitCode=1;}
}
