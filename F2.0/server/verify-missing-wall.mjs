import assert from 'node:assert/strict';
import {makeFAdapter} from './x-f-adapter.mjs';
let status;
const a=makeFAdapter({transport:{url:'ws://127.0.0.1:6373/?role=x-isolated'}},{onStatus:r=>status=r});a.start();
try{
  while(a.observed.revision===null)await new Promise(r=>setTimeout(r,50));
  assert.equal(a.observed.displays.wall.connected,false);
  assert.equal(a.observed.displays.table.ready,true);
  assert.equal(status,false);
  await assert.rejects(a.send({send:{type:'simulate',action:'all'}}),/ack 逾時/);
  console.log('PASS: FWALL absent; table/graph connected cannot acknowledge the three-display command.');
  console.log(JSON.stringify(a.observed.displays));
}finally{a.stop();}
