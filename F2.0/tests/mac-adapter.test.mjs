import test from 'node:test';
import assert from 'node:assert/strict';
import {WebSocketServer} from 'ws';
import {once} from 'node:events';
import {makeFAdapter} from '../server/x-f-adapter.mjs';

test('Mac adapter waits for current rendered Wall/Table revision without Graph',async()=>{
 const server=new WebSocketServer({port:0,host:'127.0.0.1'});
 await once(server,'listening');
 let peer;
 const status=(revision)=>({type:'f-status',revision,required:['table','wall'],ready:true,displays:{table:{ready:true,revision,output:{orb:{state:'ready'}}},wall:{ready:true,revision},graph:{ready:false,connected:false},ipad:{ready:false,connected:false}}});
 const adapter=makeFAdapter({transport:{url:`ws://127.0.0.1:${server.address().port}`}}, {onStatus(){}});
 try{
  const connected=once(server,'connection');adapter.start();[peer]=await connected;
  peer.send(JSON.stringify(status(1)));
  const command=once(peer,'message');
  // Await first status in the adapter, without relying on fixed sleep timing.
  while(adapter.observed.revision!==1)await new Promise(r=>setTimeout(r,5));
  let done=false;const result=adapter.send({send:'reset'}).then(value=>{done=true;return value;});
  let request;
  peer.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='f-command')request=m;});
  await command;
  while(!request)await new Promise(r=>setTimeout(r,5));
  peer.send(JSON.stringify({type:'f-command-accepted',requestId:request.requestId,revision:2}));
  peer.send(JSON.stringify(status(1)));
  await new Promise(r=>setTimeout(r,20));assert.equal(done,false,'accepted and stale renders must not complete command');
  peer.send(JSON.stringify(status(2)));
  assert.match(await result,/revision 2/);
 }finally{adapter.stop();for(const ws of server.clients)ws.terminate();await new Promise(r=>server.close(r));}
});
