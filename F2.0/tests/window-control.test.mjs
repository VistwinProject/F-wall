import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {WebSocketServer} from 'ws';
import {displayPorts,displayWindow,toggleDisplays} from '../server/window-control.mjs';
test('dedicated display fullscreen startup and synchronized toggling',async()=>{
 const resources=[],states={};
 try{
  for(const role of Object.keys(displayPorts)){
   states[role]='normal';
   const server=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.url==='/json/list'?[{id:role,type:'page',url:`http://localhost:6273/${role}`}]:{webSocketDebuggerUrl:`ws://127.0.0.1:${server.address().port}`}));});
   const wss=new WebSocketServer({server});resources.push({server,wss});
   wss.on('connection',ws=>ws.on('message',raw=>{const m=JSON.parse(raw);if(m.method==='Browser.setWindowBounds')states[role]=m.params.bounds.windowState;ws.send(JSON.stringify({id:m.id,result:{windowId:1,bounds:{windowState:states[role]}}}));}));
   await new Promise(r=>server.listen(0,'127.0.0.1',r));displayPorts[role]=server.address().port;
   assert.equal(await displayWindow(role,'fullscreen'),'fullscreen');
  }
  assert.deepEqual(await toggleDisplays(),{state:'normal'});
  assert.deepEqual(Object.values(states),['normal','normal','normal']);
  states.table='fullscreen';assert.deepEqual(await toggleDisplays(),{state:'fullscreen'});
  await assert.rejects(displayWindow('ipad'),/Unknown display/);
 }finally{for(const {server,wss} of resources){for(const ws of wss.clients)ws.terminate();await new Promise(r=>wss.close(r));await new Promise(r=>server.close(r));}}
});

 test('reload targets only the dedicated Table page and deduplicates simultaneous requests',async()=>{
 const {reloadDisplay}=await import('../server/window-control.mjs');
 const previous=displayPorts.table;let requests=0,wrong=false;
 const server=http.createServer((req,res)=>res.end(JSON.stringify([{id:'table',type:'page',url:wrong?'http://example.com/table':'http://localhost:6273/table',webSocketDebuggerUrl:`ws://127.0.0.1:${server.address().port}`}])));
 const wss=new WebSocketServer({server});
 wss.on('connection',ws=>ws.on('message',raw=>{const m=JSON.parse(raw);requests++;assert.equal(m.method,'Page.reload');assert.equal(m.params.ignoreCache,true);ws.send(JSON.stringify({id:m.id,result:{}}));}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));displayPorts.table=server.address().port;
 try{
  await Promise.all([reloadDisplay('table'),reloadDisplay('table')]);assert.equal(requests,1);
  wrong=true;await assert.rejects(reloadDisplay('table'),/not found/);assert.equal(requests,1);
  wrong=false;await reloadDisplay('table');assert.equal(requests,2);
 }finally{displayPorts.table=previous;for(const ws of wss.clients)ws.terminate();await new Promise(r=>wss.close(r));await new Promise(r=>server.close(r));}
 });
