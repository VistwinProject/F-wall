import test from 'node:test';
import assert from 'node:assert/strict';
import {mountOrb} from '../public/anlb-orb/orb.js';
test('late GPU loss after ready remains observable; submitted frame required for health',async()=>{
  const original=globalThis.document;
  globalThis.document={createElement:()=>({dataset:{},style:{},setAttribute(){},remove(){}})};
  let callbacks;
  try{
    const orb=mountOrb({append(){}},{createRenderer:options=>{callbacks=options;return {setState(){},setSpeechLevel(){},dispose(){}};}});
    assert.equal(orb.canvas.dataset.orbHealth,'starting');
    callbacks.onReady();await orb.ready;
    assert.equal(orb.canvas.dataset.orbHealth,'starting','initialization alone is not an output frame');
    callbacks.onFrame();assert.equal(orb.canvas.dataset.orbHealth,'ready');
    callbacks.onError(new Error('GPU lost after ready'));
    assert.equal(orb.canvas.dataset.orbHealth,'error');
    assert.equal(orb.canvas.dataset.orbError,'GPU lost after ready');
    assert.equal(orb.canvas.style.visibility,'hidden');
    orb.dispose();callbacks.onFrame();assert.equal(orb.canvas.dataset.orbHealth,'error','disposed renderer must not report recovery');
  }finally{globalThis.document=original;}
});
