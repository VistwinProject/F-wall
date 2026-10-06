import test from 'node:test';
import assert from 'node:assert/strict';
import {batchFrame} from '../src/frame-batch.js';
test('NFC bursts render latest state once, retain reset events, and cancel cleanly',()=>{
  const callbacks=new Map();let id=0,state=0;const seen=[];
  const oldRequest=globalThis.requestAnimationFrame,oldCancel=globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};
  globalThis.cancelAnimationFrame=id=>callbacks.delete(id);
  try{
    const queue=batchFrame(events=>seen.push({state,events:[...events]}));
    for(let i=0;i<9;i++){state++;queue('tag-present');}
    queue('session-end');assert.equal(callbacks.size,1);
    const frame=[...callbacks.values()][0];callbacks.clear();frame();
    assert.deepEqual(seen,[{state:9,events:['tag-present','session-end']}]);
    queue('connection');assert.equal(callbacks.size,1);queue.cancel();assert.equal(callbacks.size,0);
    queue('snapshot');const next=[...callbacks.values()][0];callbacks.clear();next();
    assert.deepEqual(seen[1],{state:9,events:['snapshot']});
  }finally{globalThis.requestAnimationFrame=oldRequest;globalThis.cancelAnimationFrame=oldCancel;}
});
