import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {monitorDisplays} from '../server/display-monitor.mjs';
test('three distinct rendered roles required; stale revision and duplicate wall fail closed',()=>{
  const wss=new EventEmitter();let revision=4;
  const monitor=monitorDisplays(wss,()=>({revision}));
  function peer(role){const ws=new EventEmitter();ws.readyState=1;ws.send=()=>{};wss.emit('connection',ws,{url:'/?role='+role});return ws;}
  function rendered(ws,orb='ready'){ws.emit('message',JSON.stringify({type:'f-render',revision,active:[],session:false,muted:true,output:{nodes:0,orb:{state:orb}}}));}
  const table=peer('table'),wall=peer('wall'),graph=peer('graph');
  assert.equal(monitor.status().ready,false,'socket open alone is not ready');
  rendered(table);rendered(graph);
  assert.equal(monitor.status().ready,false,'table+graph cannot cover wall');
  rendered(wall);assert.equal(monitor.status().ready,true);
  revision++;assert.equal(monitor.status().ready,false,'old rendered revision is not current');
  [table,wall,graph].forEach(ws=>rendered(ws));assert.equal(monitor.status().ready,true);
  rendered(table,'error');assert.equal(monitor.status().ready,false,'GPU error cannot be masked by current DOM revision');
  rendered(table,'starting');assert.equal(monitor.status().ready,false,'GPU startup is not a submitted frame');
  rendered(table);assert.equal(monitor.status().ready,true);
  const duplicate=peer('wall');rendered(duplicate);assert.equal(monitor.status().ready,false);
  duplicate.emit('close');assert.equal(monitor.status().ready,true);
  wall.emit('close');assert.equal(monitor.status().displays.wall.connected,false);assert.equal(monitor.status().ready,false);
});

test('Mac two-display deployment does not wait for Graph or wireless iPad',()=>{
 const wss=new EventEmitter();let revision=2;
 const monitor=monitorDisplays(wss,()=>({revision}),['table','wall']);
 const peers={};
 for(const role of ['table','wall']){
  const ws=new EventEmitter();ws.readyState=1;ws.send=()=>{};
  wss.emit('connection',ws,{url:'/?role='+role});peers[role]=ws;
  ws.emit('message',JSON.stringify({type:'f-render',revision,output:{orb:{state:'ready'}}}));
 }
 assert.deepEqual(monitor.status().required,['table','wall']);
 assert.equal(monitor.status().displays.graph.connected,false);
 assert.equal(monitor.status().displays.ipad.connected,false);
 assert.equal(monitor.status().ready,true);
 revision++;assert.equal(monitor.status().ready,false);
 for(const ws of Object.values(peers))ws.emit('message',JSON.stringify({type:'f-render',revision,output:{orb:{state:'ready'}}}));
 assert.equal(monitor.status().ready,true);
 peers.wall.emit('close');assert.equal(monitor.status().ready,false);
});

test('remote Graph must be unique and current before three-display readiness',()=>{
 const wss=new EventEmitter(),monitor=monitorDisplays(wss,()=>({revision:5}),['table','wall','graph']);
 function connect(role,revision){
  const ws=new EventEmitter();ws.readyState=1;ws.send=()=>{};
  wss.emit('connection',ws,{url:'/?role='+role});
  ws.emit('message',JSON.stringify({type:'f-render',revision,output:{orb:{state:'ready'}}}));return ws;
 }
 connect('table',5);connect('wall',5);
 assert.equal(monitor.status().ready,false,'Graph absent');
 const graph=connect('graph',4);
 assert.equal(monitor.status().ready,false,'Graph stale');
 graph.emit('message',JSON.stringify({type:'f-render',revision:5}));
 assert.equal(monitor.status().ready,true);
 const duplicate=connect('graph',5);assert.equal(monitor.status().ready,false,'duplicate Graph');
 duplicate.emit('close');assert.equal(monitor.status().ready,true);
 graph.emit('close');assert.equal(monitor.status().ready,false,'Graph disconnected');
});
