import {test} from 'node:test';
import assert from 'node:assert/strict';
import {framePaths,warpFramePoint,wallRoutes} from '../src/geometry.js';
import {wallPreset} from '../src/wall-preset.js';
import {identityQuad} from '../src/wall-warp.js';
test('frame corners warp grid and connection routes together without moving appliances',()=>{
 const tune=structuredClone(wallPreset.tuning),blocks=structuredClone(tune.blocks);
 tune.frameQuad=identityQuad();const before=wallRoutes(tune);
 tune.frameQuad=[[.1,.1],[.9,0],[1,1],[0,1]];
 const [x,y,w,h]=tune.frame;assert.deepEqual(warpFramePoint([x,y],tune),[x+.1*w,y+.1*h]);
 const after=wallRoutes(tune);
 for(const id of Object.keys(before))for(let i=0;i<before[id].length;i++){
  const expected=warpFramePoint(before[id][i],tune);
  assert.ok(Math.hypot(...after[id][i].map((v,a)=>v-expected[a]))<1e-8);
 }
 assert.equal(framePaths(tune).length,1+tune.vlines.length+tune.hlines.length);
 assert.deepEqual(tune.blocks,blocks);
});
