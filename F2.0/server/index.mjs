import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { WebSocketServer, WebSocket } from 'ws';
import { DEVICES, BY_ID, TIMING } from '../src/devices.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const live = process.argv.includes('--live');
const sim = process.argv.includes('--sim') && !live;
const slots = new Map();
let session = false, revision = 0, demoTimer = null, demoRunning = false;
const mime = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml' };
const snapshot = () => ({type:'snapshot',version:2,revision,session,sim,demo:demoRunning,completionAudioReady,slots:[...slots].map(([slot_index,data])=>({slot_index,...data}))});
let completionAudioReady=false, finalAudioSlot=null;
const servers = [];
mime['.wav']='audio/wav';
async function serve(req,res) {
  try {
    const url = new URL(req.url,'http://localhost');
    if (url.pathname === '/health') {res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(snapshot()));return;}
    const p = decodeURIComponent(url.pathname);
    let file;
    if (['/','/wall','/table','/ipad'].includes(p)) file=path.join(root,'index.html');
    else if (p.startsWith('/src/')) file=path.resolve(root,'.'+p);
    else if (p.startsWith('/vendor/')) file=path.resolve(root,'node_modules/three/build',p.slice(8));
    else if (p.startsWith('/vendor-addons/')) file=path.resolve(root,'node_modules/three/examples/jsm',p.slice(15));
    else file=path.resolve(root,'public','.'+p);
    const allowed=[path.join(root,'src')+path.sep,path.join(root,'public')+path.sep,path.join(root,'node_modules/three/build')+path.sep,path.join(root,'node_modules/three/examples/jsm')+path.sep];
    if(file!==path.join(root,'index.html')&&!allowed.some(a=>file.startsWith(a))){res.writeHead(403);res.end();return;}
    const s=await stat(file);if(!s.isFile())throw Error('not a file');
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    createReadStream(file).pipe(res);
  } catch {res.writeHead(404);res.end('Not found');}
}
const wss = new WebSocketServer({noServer:true,maxPayload:8192});
function broadcast(event) {
  revision++;
  const text=JSON.stringify({...event,revision,at:Date.now()});
  for(const client of wss.clients)if(client.readyState===WebSocket.OPEN)client.send(text);
}
function start(){if(!session){session=true;broadcast({type:'session-start'});}}
function put(slot,id,uid='SIM-'+id,suppressAudio=false){
  if(!BY_ID[id]||!Number.isInteger(slot)||slot<1||slot>9)return;
  start();
  const d=BY_ID[id];
  slots.set(slot,{reader:slots.get(slot)?.reader||'Virtual reader '+slot,uid,known:true,data:{id,label:d.label,description:d.sub}});
  const allConnected=new Set([...slots.values()].map(s=>s.data?.id).filter(Boolean)).size===9;
  completionAudioReady=allConnected&&suppressAudio;finalAudioSlot=allConnected&&!suppressAudio?slot:null;
  broadcast({type:'tag-present',slot_index:slot,...slots.get(slot),suppressAudio,completionAudioReady});
}
function remove(slot){
  const before=slots.get(slot);if(!before)return;
  completionAudioReady=false;finalAudioSlot=null;
  slots.set(slot,{reader:before.reader});
  broadcast({type:'tag-remove',slot_index:slot});
}
function stopDemo(){clearTimeout(demoTimer);demoTimer=null;if(demoRunning){demoRunning=false;broadcast({type:'demo-status',running:false});}}
function reset(){completionAudioReady=false;finalAudioSlot=null;broadcast({type:"audio-stop"});stopDemo();for(const [slot,d]of slots)if(d.data)remove(slot);session=false;broadcast({type:'session-end'});}
function runDemo(){
  if(!sim)return;stopDemo();demoRunning=true;broadcast({type:'demo-status',running:true});
  for(const [slot,d]of slots)if(d.data)remove(slot);start();
  let index=0,removing=false;
  function tick(){
    if(!demoRunning)return;
    if(!removing){put(index+1,DEVICES[index].id);index++;if(index===9){removing=true;index=0;demoTimer=setTimeout(tick,TIMING.hold);}else demoTimer=setTimeout(tick,TIMING.step);}
    else {remove(index+1);index++;if(index===9){removing=false;index=0;demoTimer=setTimeout(tick,TIMING.step);}else demoTimer=setTimeout(tick,TIMING.clear);}
  }
  demoTimer=setTimeout(tick,TIMING.step);
}
if(sim)for(let i=1;i<=9;i++)slots.set(i,{reader:'Virtual reader '+i});
wss.on('connection',(client,req)=>{
  const role=new URL(req.url,'http://localhost').searchParams.get('role');
  client.send(JSON.stringify(snapshot()));
  client.on('error',err=>console.error('Socket:',err.message));
  client.on('message',raw=>{
    let msg;try{msg=JSON.parse(String(raw));}catch{return;}
    if(!msg||typeof msg!=='object')return;
    if(msg.type==='ping'){client.send(JSON.stringify({type:'pong'}));return;}
    if(msg.type==='device-audio-finished'&&role==='table'){
      const slot=Number(msg.slot_index),s=slots.get(slot);
      if(finalAudioSlot===slot&&s?.data?.id===msg.id&&s?.uid===msg.uid&&new Set([...slots.values()].map(v=>v.data?.id).filter(Boolean)).size===9){completionAudioReady=true;finalAudioSlot=null;broadcast({type:'completion-audio-ready'});}
      return;
    }
    if(role==='wall'&&!sim)return;
    if(msg.type==='session-start')start();
    else if(msg.type==='session-end')reset();
    else if(sim&&msg.type==='simulate'){
      stopDemo();
      if(msg.action==='all'){for(let i=0;i<9;i++)put(i+1,DEVICES[i].id,'SIM-'+DEVICES[i].id,true);}
      else if(msg.action==='clear'){broadcast({type:'audio-stop'});for(const [slot,d]of slots)if(d.data)remove(slot);}
      else if(msg.action==='toggle'){
        const slot=Number(msg.slot_index);if(!Number.isInteger(slot)||slot<1||slot>9)return;
        if(slots.get(slot)?.data)remove(slot);else put(slot,msg.id||DEVICES[slot-1].id);
      }
    }else if(sim&&msg.type==='demo-start')runDemo();
    else if(sim&&msg.type==='demo-stop')stopDemo();
  });
});
for(const [port,role]of [[6273,'table'],[6274,'wall'],[6275,'ipad']]){
  const server=http.createServer(serve);
  server.on('upgrade',(req,socket,head)=>wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req)));
  server.on('error',err=>{console.error(`${role}: ${err.message}`);process.exitCode=1;for(const s of servers)s.close();});
  server.listen(port,'0.0.0.0',()=>console.log(`F 2.0 ${role}: http://localhost:${port}/${role} (${sim?'NFC simulation':'hardware'})`));
  servers.push(server);
}
if(live){
  try{
    const require=createRequire(import.meta.url);
    const {NFC}=require('nfc-pcsc');
    const uidMap=JSON.parse(await readFile(new URL('./uid-map.json',import.meta.url),'utf8'));
    let readerMap={};try{readerMap=JSON.parse(await readFile(new URL('./reader-map.json',import.meta.url),'utf8'));}catch{console.warn('No reader-map.json: allocating readers in discovery order.');}
    const nfc=new NFC();
    nfc.on('reader',reader=>{
      let slot=readerMap[reader.reader.name];
      if(slot==null)slot=Array.from({length:9},(_,i)=>i+1).find(i=>!slots.has(i));
      if(!Number.isInteger(slot)||slot<1||slot>9||slots.has(slot)){console.error('Invalid or occupied NFC slot:',reader.reader.name);return;}
      slots.set(slot,{reader:reader.reader.name});broadcast({type:'reader-connected',slot_index:slot,reader:reader.reader.name});
      reader.on('card',card=>{
        const uid=card.uid.toUpperCase(),data=uidMap[uid];
        if(data&&BY_ID[data.id])put(slot,data.id,uid);
        else{slots.set(slot,{reader:reader.reader.name,uid,known:false});broadcast({type:'tag-present',slot_index:slot,uid,known:false});}
      });
      reader.on('card.off',()=>remove(slot));
      reader.on('end',()=>{slots.delete(slot);broadcast({type:'reader-disconnected',slot_index:slot});});
      reader.on('error',err=>console.error('Reader:',err.message));
    });
    nfc.on('error',err=>console.error('NFC:',err.message));
  }catch(err){console.error('Hardware mode requires nfc-pcsc and PC/SC. Install with npm install nfc-pcsc.',err.message);for(const s of servers)s.close();process.exitCode=1;}
}
if(process.argv.includes('--demo')&&sim)runDemo();
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopDemo();for(const c of wss.clients)c.close();wss.close();for(const s of servers)s.close();});
