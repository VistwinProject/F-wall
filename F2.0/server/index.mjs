import {toggleDisplays,reloadDisplay} from './window-control.mjs';
import {createExhibitionExit,isLocalExitRequest} from './exhibition-exit.mjs';
import {guardTransport,sendBounded} from './transport-guard.mjs';
import {installRollingLog} from './rolling-log.mjs';
import http from 'node:http';
import {createLedControl} from './led-control.mjs';
import {monitorDisplays} from './display-monitor.mjs';
import { readFile, stat, unlink } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { DEVICES, BY_ID, TIMING } from '../src/devices.js';
import {validateReaderMap} from './nfc-readers.mjs';
import {startNfcProcess} from './nfc-process.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const exitExhibition=createExhibitionExit(root);
if(process.env.F_LOG_DIR)installRollingLog(process.env.F_LOG_DIR);
const live = process.argv.includes('--live');
const sim = process.argv.includes('--sim') || (live && !process.argv.includes('--no-sim'));
const portBase = Number(process.env.F_PORT_BASE || 6273);
if(!Number.isInteger(portBase)||portBase<1024||portBase>65533)throw Error('Invalid F_PORT_BASE');
const slots = new Map();
let introPhase='ready',introToken=0;
const connectedReaders = new Map();
let hardware=null;
const nfcStatus={state:live?'starting':'simulation',expected:9,connected:0,mapped:[],errors:[],events:[]};
function nfcEvent(type,details){nfcStatus.events.push({at:new Date().toISOString(),type,...details});if(nfcStatus.events.length>100)nfcStatus.events.shift();}
function nfcError(message){console.error('NFC:',message);nfcStatus.errors.push(message);if(nfcStatus.errors.length>20)nfcStatus.errors.shift();}
let session = false, revision = 0, demoTimer = null, demoRunning = false;
const mime = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml' };
let ledConfig={};
try{ledConfig=JSON.parse(await readFile(process.env.F_LED_CONFIG||new URL('./led-settings.json',import.meta.url),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const ledControl=createLedControl(ledConfig);
const snapshot = () => ({type:'snapshot',version:2,revision,session,sim,demo:demoRunning,introPhase,introToken,completionAudioReady,slots:[...slots].map(([slot_index,data])=>({slot_index,...data}))});
let completionAudioReady=false, finalAudioSlot=null;
const servers = [];
mime['.webmanifest']='application/manifest+json';
mime['.wav']='audio/wav';
mime['.mp4']='video/mp4';
async function serve(req,res) {
  const roleRoot = req.socket.localPort===portBase+1 ? process.env.F_WALL_ROOT : req.socket.localPort===portBase+2 ? process.env.F_IPAD_ROOT : null;
  const contentRoot = roleRoot ? path.resolve(roleRoot) : root;
  try {
    const url = new URL(req.url,'http://localhost');
    if(url.pathname==='/exhibition-exit'){
      if(!isLocalExitRequest(req,portBase)){res.writeHead(403);res.end('Local display request required');return;}
      if(process.platform!=='win32'||process.env.F_WINDOW_CONTROL!=='1'||!process.env.F_INSTANCE_ID){res.writeHead(501);res.end('Windows launcher required');return;}
      try{await exitExhibition();res.writeHead(202);res.end('Stopping exhibition');}
      catch(error){console.error('Exhibition exit:',error);res.writeHead(503);res.end('Use Stop.cmd to close the exhibition');}return;
    }
    if(url.pathname==='/display-fullscreen'){
      const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
      const origin=req.headers.origin;
      const allowed=origin&&['http://localhost:','http://127.0.0.1:'].some(prefix=>[portBase,portBase+1,portBase+2].some(port=>origin===prefix+port));
      if(req.method!=='POST'||!local||!allowed){res.writeHead(403);res.end('Local display request required');return;}
      if(process.platform!=='win32'||process.env.F_WINDOW_CONTROL!=='1'){res.writeHead(501);res.end('Browser fullscreen only');return;}
      try{const result=await toggleDisplays();res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));}
      catch(error){res.writeHead(503);res.end(error.message);}return;
    }
    if (url.pathname === '/health') {res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({...snapshot(),displayStatus:displayMonitor.status(),app:'f-control-tower',mode:live?'live':'sim',instance:process.env.F_INSTANCE_ID||null,graphBundled:true,runtime:{uptimeSeconds:Math.floor(process.uptime()),memory:process.memoryUsage(),websocketClients:wss.clients.size,nfcEventLimit:100,nfcErrorLimit:20},led:ledControl.status(),nfc:{...nfcStatus,connected:connectedReaders.size}}));return;}
    const p = decodeURIComponent(url.pathname);
    let file;
    if(p==='/graph'){const graph=await readFile(path.join(process.env.F_GRAPH_ROOT||path.join(root,'public/graph'),'index.html'));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(graph.toString().replace('</body>','<script src="/display-fullscreen.js"></script></body>'));return;}
    if (['/','/wall','/table','/ipad'].includes(p)) file=path.join(contentRoot,'index.html');
    else if (p.startsWith('/src/')) file=path.resolve(contentRoot,'.'+p);
    else if (p.startsWith('/vendor/')) file=path.resolve(root,'node_modules/three/build',p.slice(8));
    else if (p.startsWith('/vendor-addons/')) file=path.resolve(root,'node_modules/three/examples/jsm',p.slice(15));
    else file=path.resolve(contentRoot,'public','.'+p);
    const allowed=[path.join(contentRoot,'src')+path.sep,path.join(contentRoot,'public')+path.sep,path.join(root,'node_modules/three/build')+path.sep,path.join(root,'node_modules/three/examples/jsm')+path.sep];
    if(file!==path.join(contentRoot,'index.html')&&!allowed.some(a=>file.startsWith(a))){res.writeHead(403);res.end();return;}
    const s=await stat(file);if(!s.isFile())throw Error('not a file');
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    const stream=createReadStream(file);
    res.once('close',()=>stream.destroy());
    stream.on('error',error=>{console.error('Asset stream:',error.message);res.destroy();});
    stream.pipe(res);
  } catch {res.writeHead(404);res.end('Not found');}
}
const wss = new WebSocketServer({noServer:true,maxPayload:8192});
const transportGuard=guardTransport(wss);
const displayMonitor=monitorDisplays(wss,snapshot,process.env.F_REQUIRED_DISPLAYS?.split(',').map(role=>role.trim()));
function broadcast(event) {
  ledControl.sync(slots);
  revision++;
  const text=JSON.stringify({...event,revision,at:Date.now()});
  for(const client of wss.clients)if(client.readyState===WebSocket.OPEN)sendBounded(client,text);
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
function reset(){completionAudioReady=false;finalAudioSlot=null;broadcast({type:"audio-stop"});stopDemo();for(const [slot,d]of slots)if(d.data||d.uid)remove(slot);session=false;broadcast({type:'session-end'});}
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
if(sim&&!live)for(let i=1;i<=9;i++)slots.set(i,{reader:'Virtual reader '+i});
wss.on('connection',(client,req)=>{
  const role=new URL(req.url,'http://localhost').searchParams.get('role');
  sendBounded(client,JSON.stringify(snapshot()));
  client.on('error',err=>console.error('Socket:',err.message));
  client.on('message',raw=>{
    let msg;try{msg=JSON.parse(String(raw));}catch{return;}
    if(!msg||typeof msg!=='object')return;
    if(msg.type==='f-status-request'&&role==='x'){sendBounded(client,JSON.stringify(snapshot()));return;} if(msg.type==='f-command'){
      const requestId=msg.requestId,command=msg.command;
      const valid=typeof requestId==='string'&&command&&['session-start','session-end','simulate','manual-trigger','manual-clear'].includes(command.type)&&
        (!command.type.startsWith('manual-')||(sim&&(command.type==='manual-clear'||BY_ID[command.id])))&&
        (command.type!=='simulate'||((sim||(role==='x'&&command.action==='all'))&&(['all','clear'].includes(command.action)||(command.action==='toggle'&&Number.isInteger(command.slot_index)&&command.slot_index>=1&&command.slot_index<=9&&(!command.id||BY_ID[command.id])))));
      if(!valid){sendBounded(client,JSON.stringify({type:'f-command-error',requestId,error:'Unsupported F command'}));return;}
      msg=command;
      queueMicrotask(()=>{if(client.readyState===WebSocket.OPEN)sendBounded(client,JSON.stringify({type:'f-command-accepted',requestId,revision}));});
    }

    if(msg.type==='ping'){sendBounded(client,JSON.stringify({type:'pong'}));return;}
    if(msg.type==='intro-play'&&role==='ipad'&&!session){introToken++;introPhase='requested';broadcast({type:'intro-state',phase:introPhase,token:introToken});return;}
    if(msg.type==='intro-skip'&&role==='ipad'&&!session){introPhase='done';broadcast({type:'intro-state',phase:introPhase,token:introToken});return;}
    if(msg.type==='intro-status'&&role==='table'&&!session&&msg.token===introToken&&['requested','playing','error'].includes(introPhase)&&['playing','done','error'].includes(msg.phase)){introPhase=msg.phase;broadcast({type:'intro-state',phase:introPhase,token:introToken});return;}
    if(msg.type==='completion-play'&&role==='ipad'&&session&&completionAudioReady){broadcast({type:'completion-play'});return;}
    if(msg.type==='session-end'||(msg.type==='simulate'&&msg.action==='clear')){introPhase='ready';introToken++;broadcast({type:'intro-state',phase:introPhase,token:introToken});}
    if(msg.type==='device-audio-finished'&&role==='table'){
      const slot=Number(msg.slot_index),s=slots.get(slot);
      if(finalAudioSlot===slot&&s?.data?.id===msg.id&&s?.uid===msg.uid&&new Set([...slots.values()].map(v=>v.data?.id).filter(Boolean)).size===9){completionAudioReady=true;finalAudioSlot=null;broadcast({type:'completion-audio-ready'});}
      return;
    }
    if(role==='wall'&&!sim)return;
    if(sim&&msg.type==='manual-trigger'){stopDemo();put(DEVICES.findIndex(d=>d.id===msg.id)+1,msg.id);}
    else if(sim&&msg.type==='manual-clear'){stopDemo();broadcast({type:'audio-stop'});for(const [slot,d]of slots)if(d.data)remove(slot);}
    else if(msg.type==='session-start')start();
    else if(msg.type==='session-end'){
      reset();
      if(role==='ipad'&&msg.recoverTable===true&&process.platform==='win32'&&process.env.F_WINDOW_CONTROL==='1'){
        reloadDisplay('table').then(()=>console.log('[Table recovery] Reload requested after iPad reset')).catch(error=>console.error('[Table recovery]',error.message));
      }
    }
    else if((sim||(role==='x'&&msg.action==='all'))&&msg.type==='simulate'){
      stopDemo();
      if(msg.action==='all'){broadcast({type:'audio-stop'});for(let i=0;i<9;i++)put(i+1,DEVICES[i].id,'SIM-'+DEVICES[i].id,true);if(role==='x')broadcast({type:'completion-play'});}
      else if(msg.action==='clear'){broadcast({type:'audio-stop'});for(const [slot,d]of slots)if(d.data)remove(slot);}
      else if(msg.action==='toggle'){
        const slot=Number(msg.slot_index);if(!Number.isInteger(slot)||slot<1||slot>9)return;
        if(slots.get(slot)?.data)remove(slot);else put(slot,msg.id||DEVICES[slot-1].id);
      }
    }else if(sim&&msg.type==='demo-start')runDemo();
    else if(sim&&msg.type==='demo-stop')stopDemo();
  });
});
for(const [port,role]of [[portBase,'table'],[portBase+1,'wall'],[portBase+2,'ipad']]){
  const server=http.createServer(serve);
  server.on('upgrade',(req,socket,head)=>wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req)));
  server.on('error',err=>{console.error(`${role}: ${err.message}`);process.exitCode=1;for(const s of servers)s.close();});
  server.listen(port,process.env.F_BIND_HOST||'0.0.0.0',()=>console.log(`F 2.0 ${role}: http://localhost:${port}/${role} (${live?(sim?'hardware + NFC simulation':'hardware'):'NFC simulation'})`));
  servers.push(server);
}
if(live){
  try{
    const uidMap=JSON.parse(await readFile(new URL('./uid-map.json',import.meta.url),'utf8'));
    let readerMap={};
    try{readerMap=validateReaderMap(JSON.parse(await readFile(new URL('./reader-map.json',import.meta.url),'utf8')));}
    catch(error){if(error.code!=='ENOENT')throw error;console.warn('No reader-map.json: allocating readers in discovery order.');}
    hardware=startNfcProcess({
      mapping:readerMap,connected:connectedReaders,
      onConnect(slot,name,mapped){
        if(mapped)nfcStatus.mapped.push(slot);
        slots.set(slot,{reader:name});broadcast({type:'reader-connected',slot_index:slot,reader:name});
        nfcEvent('reader-connected',{slot,reader:name,mapped});
      },
      onCard(slot,name,uid){
        const data=uidMap[uid];nfcEvent('card',{slot,reader:name,uid,id:data?.id||null});
        if(data&&BY_ID[data.id])put(slot,data.id,uid);
        else{
          completionAudioReady=false;finalAudioSlot=null;
          slots.set(slot,{reader:name,uid,known:false});
          broadcast({type:'tag-present',slot_index:slot,reader:name,uid,known:false,completionAudioReady:false});
        }
      },
      onRemove(slot){nfcEvent('card.off',{slot});remove(slot);},
      onDisconnect(slot){
        remove(slot);slots.delete(slot);
        nfcStatus.mapped=nfcStatus.mapped.filter(s=>s!==slot);
        broadcast({type:'reader-disconnected',slot_index:slot});nfcEvent('reader-disconnected',{slot});
      },
      onState:value=>{nfcStatus.state=value;},
      onError:nfcError
    });
  }catch(err){nfcStatus.state='unavailable';nfcError('NFC configuration failed: '+err.message);}
}
if(process.argv.includes('--demo')&&sim)runDemo();
let shuttingDown=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{
  if(shuttingDown)return;shuttingDown=true;transportGuard.stop();displayMonitor.stop();stopDemo();await ledControl.stop();
  await hardware?.close();
  for(const c of wss.clients)c.close();wss.close();for(const s of servers)s.close();
  setTimeout(()=>{for(const c of wss.clients)c.terminate();for(const s of servers)s.closeAllConnections();},1000).unref();
});

// Windows launcher stop requests use a local file, scoped by installation ID.
if(process.env.F_STOP_FILE&&process.env.F_INSTANCE_ID){
  const timer=setInterval(async()=>{
    try{
      const value=(await readFile(process.env.F_STOP_FILE,'utf8')).trim();
      if(value!==process.env.F_INSTANCE_ID)return;
      await unlink(process.env.F_STOP_FILE);process.emit('SIGTERM');
    }catch(error){if(error.code!=='ENOENT')console.error('Stop request:',error.message);}
  },500);timer.unref();
}
