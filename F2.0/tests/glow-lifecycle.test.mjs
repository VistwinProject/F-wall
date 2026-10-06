import test from 'node:test';
import assert from 'node:assert/strict';
import {Glow} from '../src/glow.js';

test('inactive view cancels glow scheduling and resumes only one loop',()=>{
  const originalRAF=globalThis.requestAnimationFrame,originalCancel=globalThis.cancelAnimationFrame;
  const pending=new Map();let id=0;
  globalThis.requestAnimationFrame=callback=>{pending.set(++id,callback);return id;};
  globalThis.cancelAnimationFrame=key=>pending.delete(key);
  try{
    const glow=Object.assign(Object.create(Glow.prototype),{_visible:true,disabled:false,animate(){}});
    glow.frame=requestAnimationFrame(glow.animate);
    glow.visible=false;assert.equal(pending.size,0);
    glow.visible=false;assert.equal(pending.size,0);
    glow.visible=true;assert.equal(pending.size,1);
    glow.visible=true;assert.equal(pending.size,1);
    glow.visible=false;assert.equal(pending.size,0);
  }finally{
    if(originalRAF)globalThis.requestAnimationFrame=originalRAF;else delete globalThis.requestAnimationFrame;
    if(originalCancel)globalThis.cancelAnimationFrame=originalCancel;else delete globalThis.cancelAnimationFrame;
  }
});
