import test from 'node:test';
import assert from 'node:assert/strict';
import {Session} from '../src/session.js';

test('silent connection recovers with one retry and snapshot; page disposal cancels timers',t=>{
  t.mock.timers.enable({apis:['setInterval','setTimeout','Date'],now:1000});
  const saved={WebSocket:globalThis.WebSocket,location:globalThis.location};
  const peers=[];
  class Socket{
    static OPEN=1;
    readyState=0;bufferedAmount=0;sent=[];
    constructor(){peers.push(this);}
    send(raw){this.sent.push(JSON.parse(raw));}
    close(){this.readyState=3;}
    open(){this.readyState=1;this.onopen?.();}
    message(value){this.onmessage?.({data:JSON.stringify(value)});}
  }
  globalThis.WebSocket=Socket;globalThis.location={search:'',protocol:'http:',host:'localhost:6273'};
  let session;
  try{
    session=new Session('table');peers[0].open();
    t.mock.timers.tick(40000);
    assert.equal(peers[0].readyState,3);assert.equal(session.state.online,false);
    t.mock.timers.tick(1000);assert.equal(peers.length,2);
    peers[1].open();peers[1].message({type:'snapshot',revision:12,session:false,slots:[]});
    assert.equal(session.state.ready,true);assert.equal(session.state.revision,12);
    for(let i=0;i<100;i++){t.mock.timers.tick(10000);peers[1].message({type:'pong'});}
    assert.equal(peers.length,2,'healthy connection does not accumulate reconnects');
    session.dispose();t.mock.timers.tick(60000);
    assert.equal(peers.length,2);assert.equal(peers[1].readyState,3);
  }finally{session?.dispose();globalThis.WebSocket=saved.WebSocket;if(saved.location===undefined)delete globalThis.location;else globalThis.location=saved.location;}
});
