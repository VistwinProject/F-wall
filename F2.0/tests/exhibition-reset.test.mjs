import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import net from 'node:net';
import {WebSocket} from 'ws';
import {reduce} from '../src/session.js';

async function freePortRange(){
  for(let attempt=0;attempt<30;attempt++){
    const base=20000+Math.floor(Math.random()*30000),held=[];
    try{
      for(let n=0;n<3;n++){
        const s=net.createServer();held.push(s);
        await new Promise((resolve,reject)=>{s.once('error',reject);s.listen(base+n,'0.0.0.0',resolve);});
      }
      return base;
    }catch(error){if(error.code!=='EADDRINUSE')throw error;}finally{await Promise.all(held.map(s=>new Promise(r=>s.close(r))));}
  }
  throw Error('No test ports available');
}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check){
  for(let i=0;i<100;i++){if(await check())return;await pause(30);}
  throw Error('Timed out waiting for synchronized state');
}

test('iPad reset clears Table/Wall/Graph and controller, stops audio/demo, and permits a new intro', {timeout:15000}, async()=>{
  const base=await freePortRange();
  const server=spawn(process.execPath,['server/index.mjs','--sim'],{
    cwd:new URL('../',import.meta.url),env:{...process.env,F_PORT_BASE:String(base)},stdio:['ignore','pipe','pipe']
  });
  let logs='';server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
  const peers=[];
  try{
    await until(async()=>{
      if(server.exitCode!==null)throw Error(logs);
      try{return (await fetch(`http://127.0.0.1:${base}/health`)).ok;}catch{return false;}
    });
    for(const [index,role] of ['table','wall','ipad','graph'].entries()){
      const ws=new WebSocket(`ws://127.0.0.1:${base+(index%3)}?role=${role}`);
      const peer={ws,role,events:[],state:{slots:{},active:[]}};peers.push(peer);
      ws.on('message',raw=>{const event=JSON.parse(raw);peer.events.push(event);peer.state=reduce(peer.state,event);});
      await once(ws,'open');
    }
    await until(()=>peers.every(p=>p.state.ready));
    const graphResponse=await fetch(`http://127.0.0.1:${base}/graph`);
    assert.equal(graphResponse.status,200);assert.ok((await graphResponse.text()).includes('function reportGraph()'));
    const ipad=peers[2];const send=(type,fields={})=>ipad.ws.send(JSON.stringify({type,...fields}));
    send('simulate',{action:'all'});
    await until(()=>peers.every(p=>p.state.active.length===9&&p.state.completionAudioReady));
    // A display launched after all nine cards are present must receive the full state.
    const late=new WebSocket(`ws://127.0.0.1:${base}?role=table`);
    const snapshotPromise=once(late,'message');
    try{
      const [raw]=await snapshotPromise;
      const occupied=reduce({slots:{},active:[]},JSON.parse(raw));
      assert.equal(occupied.session,true);assert.equal(occupied.active.length,9);
    }finally{late.close();await once(late,'close');}
    const activeHealth=await (await fetch(`http://127.0.0.1:${base}/health`)).json();
    assert.equal(activeHealth.led.desired,true);assert.equal(activeHealth.led.enabled,false);
    send('session-end');
    await until(()=>peers.every(p=>p.events.some(e=>e.type==='session-end')));
    for(const p of peers){
      assert.equal(p.state.session,false,p.role);
      assert.equal(p.state.active.length,0,p.role);
      assert.equal(p.state.introPhase,'ready',p.role);
      assert.equal(p.state.completionAudioReady,false,p.role);
      assert.equal(p.state.focus,null,p.role);
      assert.ok(p.events.some(e=>e.type==='audio-stop'),p.role);
    }
    send('demo-start');
    await until(()=>peers.every(p=>p.state.demo));
    send('session-end');
    await until(()=>peers.every(p=>!p.state.demo&&!p.state.session));
    send('intro-play');
    await until(()=>peers.every(p=>p.state.introPhase==='requested'));
    const health=await (await fetch(`http://127.0.0.1:${base}/health`)).json();
    assert.equal(health.app,'f-control-tower');assert.equal(health.mode,'sim');assert.equal(health.led.desired,false);assert.equal(health.graphBundled,true);
    // Repeated full occupancy/removal exercises the real server, all views and revision protocol.
    for(let cycle=0;cycle<100;cycle++){
      send('simulate',{action:'all'});
      await until(()=>peers.every(p=>p.state.active.length===9));
      send('simulate',{action:'clear'});
      await until(()=>peers.every(p=>p.state.active.length===0));
      for(const p of peers)p.events.length=0;
    }
    const after=await (await fetch(`http://127.0.0.1:${base}/health`)).json();
    assert.equal(after.slots.length,9);assert.ok(after.slots.every(s=>!s.uid&&!s.data));
    assert.equal(after.runtime.websocketClients,4);
    assert.ok(after.nfc.events.length<=after.runtime.nfcEventLimit);
    assert.ok(after.nfc.errors.length<=after.runtime.nfcErrorLimit);
    assert.ok(Number.isFinite(after.runtime.memory.rss));

  }finally{
    for(const p of peers)p.ws.terminate();
    if(server.exitCode===null){const exited=once(server,'exit');server.kill();await exited;}
  }
});
