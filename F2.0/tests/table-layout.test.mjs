import test from 'node:test';
import assert from 'node:assert/strict';
import {moveSymmetricSlot} from '../src/table-layout.js';

test('NFC pairs mirror in either direction, leaving other slots unchanged',()=>{
  for(const index of [0,1,2,3,5,6,7,8]){
    const slots=Array.from({length:9},(_,i)=>[560+i*100,300+i*20]);
    const before=structuredClone(slots),axis=slots[4][0];
    moveSymmetricSlot(slots,index,725,450);
    assert.deepEqual(slots[index],[725,450]);
    assert.deepEqual(slots[8-index],[2*axis-725,450]);
    slots.forEach((p,i)=>{if(i!==index&&i!==8-index)assert.deepEqual(p,before[i]);});
  }
});
test('NFC 5 moves alone; edge clamping preserves paired symmetry',()=>{
  const slots=Array.from({length:9},()=>[960,500]);
  moveSymmetricSlot(slots,4,1245,300);
  assert.deepEqual(slots[0],[960,500]);
  moveSymmetricSlot(slots,0,-100,-20);
  assert.deepEqual(slots[0],[570,0]);
  assert.deepEqual(slots[8],[1920,0]);
});
