import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtempSync,readdirSync,statSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {guardTransport,sendBounded,MAX_BUFFERED_BYTES} from '../server/transport-guard.mjs';
import {createRollingLog} from '../server/rolling-log.mjs';
import {monitorDisplays} from '../server/display-monitor.mjs';

test('dead connections are removed, live peers survive; slow peers cannot accumulate send queues',()=>{
  const wss=new EventEmitter();wss.clients=new Set();
  const guard=guardTransport(wss),monitor=monitorDisplays(wss,()=>({revision:1}));
  function peer(role){
    const ws=new EventEmitter();Object.assign(ws,{readyState:1,bufferedAmount:0,ping(){},send(){this.sent=(this.sent||0)+1;},terminate(){this.readyState=3;wss.clients.delete(this);this.emit('close');}});
    wss.clients.add(ws);wss.emit('connection',ws,{url:'/?role='+role});return ws;
  }
  try{
    const live=peer('wall'),dead=peer('graph');
    guard.tick();live.emit('pong');guard.tick();
    assert.equal(dead.readyState,3);assert.equal(live.readyState,1);
    assert.equal(monitor.status().displays.graph.connected,false);
    live.bufferedAmount=MAX_BUFFERED_BYTES+1;
    assert.equal(sendBounded(live,{type:'snapshot'}),false);
    assert.equal(live.readyState,3);
    for(let i=0;i<10000;i++){const ws=peer('wall');ws.emit('message','null');ws.emit('message','[]');ws.terminate();}
    assert.equal(wss.clients.size,0);assert.equal(monitor.status().displays.wall.instances,0);
  }finally{guard.stop();monitor.stop();}
});

test('repeated errors rotate within a fixed disk budget and preserve latest entries',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'f-log-'));
  try{
    const write=createRollingLog(dir,{maxBytes:1024,archives:3});
    for(let i=0;i<10000;i++)write('warn',`NFC error ${i} `+'x'.repeat(100));
    const files=readdirSync(dir);
    assert.equal(files.length,4);
    assert.ok(files.reduce((n,f)=>n+statSync(path.join(dir,f)).size,0)<=4096);
    assert.match(readFileSync(path.join(dir,'events.log'),'utf8'),/NFC error 9999/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
