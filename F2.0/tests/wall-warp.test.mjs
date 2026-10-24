import test from 'node:test';
import assert from 'node:assert/strict';
import {identityQuad,validQuad,warpPoint,quadCssMatrix} from '../src/wall-warp.js';
import {loadTuning} from '../src/editor.js';
import {tablePreset} from '../src/table-preset.js';
import {wallPreset} from '../src/wall-preset.js';
test('identity and independent corners preserve the opposite edge',()=>{
 const q=identityQuad();assert.deepEqual(warpPoint([.3,.7],q),[.3,.7]);
 q[0]=[-.2,.1];assert.ok(validQuad(q));
 assert.deepEqual(warpPoint([0,0],q),q[0]);
 assert.deepEqual(warpPoint([1,0],q),[1,0]);
 assert.ok(warpPoint([1,1],q).every(n=>Math.abs(n-1)<1e-10));
});
test('reject folded, collapsed and nonfinite masks',()=>{
 assert.equal(validQuad([[0,0],[1,1],[1,0],[0,1]]),false);
 assert.equal(validQuad([[0,0],[0,0],[1,1],[0,1]]),false);
 assert.equal(validQuad([[NaN,0],[1,0],[1,1],[0,1]]),false);
});
test('current calibration loads unchanged and new quads round trip',()=>{
 const saved=new Map([['f2-wall-preset-revision','2026-10-13-wall-tuning-5']]);
 globalThis.localStorage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
 const t=loadTuning('wall');assert.ok(validQuad(t.maskQuads.hrv));
 t.maskQuads.hrv[0]=[-.2,.1];saved.set('f2-tuning-wall',JSON.stringify(t));
 assert.deepEqual(loadTuning('wall').maskQuads.hrv,t.maskQuads.hrv);
 t.maskQuads.hrv=[[0,0],[1,1],[1,0],[0,1]];saved.set('f2-tuning-wall',JSON.stringify(t));
 assert.deepEqual(loadTuning('wall').maskQuads.hrv,identityQuad());
 delete globalThis.localStorage;
});

test('photo and animated icon CSS agree with mask projection, including interior points',()=>{
 const q=[[-.2,.1],[1.1,-.1],[.8,1.2],[.1,.9]],w=240,h=400;
 const m=quadCssMatrix(q,w,h).slice(9,-1).split(',').map(Number);
 for(const [u,v] of [[0,0],[1,0],[1,1],[0,1],[.3,.7],[.5,.5]]){
  const x=u*w,y=v*h,den=m[3]*x+m[7]*y+m[15];
  const css=[(m[0]*x+m[4]*y+m[12])/den/w,(m[1]*x+m[5]*y+m[13])/den/h];
  const svg=warpPoint([u,v],q);
  css.forEach((n,i)=>assert.ok(Math.abs(n-svg[i])<1e-10));
 }
});

test('legacy warp migrates to independent photo and icon layers and all three persist',()=>{
 const mask=identityQuad();mask[0]=[-.2,.1];
 const saved=new Map([['f2-wall-preset-revision','2026-10-13-wall-tuning-5'],['f2-tuning-wall',JSON.stringify({maskQuads:{hrv:mask}})]]);
 globalThis.localStorage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
 try{
  const t=loadTuning('wall');assert.deepEqual(t.iconQuads.hrv,mask);assert.deepEqual(t.photoQuads.hrv,mask);
  t.photoQuads.hrv[1]=[1.2,0];assert.deepEqual(t.maskQuads.hrv,mask);assert.deepEqual(t.iconQuads.hrv,mask);
  t.iconQuads.hrv[0]=[.1,.2];assert.deepEqual(t.maskQuads.hrv,mask);
  saved.set('f2-tuning-wall',JSON.stringify(t));const reloaded=loadTuning('wall');
  assert.deepEqual(reloaded.maskQuads.hrv,mask);assert.deepEqual(reloaded.iconQuads.hrv[0],[.1,.2]);assert.deepEqual(reloaded.photoQuads.hrv[1],[1.2,0]);
 }finally{delete globalThis.localStorage;}
});


test('table background calibration migrates and persists without changing content geometry',()=>{
 const saved=new Map();
 globalThis.localStorage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
 try{
  const t=loadTuning('table');assert.deepEqual(t.bg.quad,tablePreset.tuning.bg.quad);
  const content=JSON.stringify([t.slots,t.hub,t.projection,t.phoneScale]);
  t.bg.quad=[[.1,.05],[.9,0],[1,1],[0,1]];saved.set('f2-tuning-table',JSON.stringify(t));
  const loaded=loadTuning('table');assert.deepEqual(loaded.bg.quad,t.bg.quad);
  assert.equal(JSON.stringify([loaded.slots,loaded.hub,loaded.projection,loaded.phoneScale]),content);
  for(const q of [[[0,0],[1,1],[1,0],[0,1]],[[-.1,0],[1,0],[1,1],[0,1]]]){
   t.bg.quad=q;saved.set('f2-tuning-table',JSON.stringify(t));assert.deepEqual(loadTuning('table').bg.quad,identityQuad());
  }
 }finally{delete globalThis.localStorage;}
});

test('core and TV rectangular masks support independent persisted corner calibration',async()=>{
 const {wallSilhouette}=await import('../src/wall-silhouettes.js');
 const saved=new Map();globalThis.localStorage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
 try{
  const t=loadTuning('wall'),original=wallSilhouette({id:'screen'},t).path;
  t.maskQuads.hub[0]=[.12,.08];t.maskQuads.screen[1]=[.85,.15];
  saved.set('f2-tuning-wall',JSON.stringify(t));const next=loadTuning('wall');
  for(const id of ['hub','screen']){
   assert.deepEqual(next.maskQuads[id],t.maskQuads[id]);
   const [cx,cy,w,h]=next.blocks[id],shape=wallSilhouette({id},next);
   assert.deepEqual(shape.corners,next.maskQuads[id].map(([u,v])=>[cx-w/2+u*w,cy-h/2+v*h]));
  }
  assert.notEqual(wallSilhouette({id:'screen'},next).path,original);
 }finally{delete globalThis.localStorage;}
});

test('October 13 migration backs up old calibration once and preserves subsequent edits',()=>{
 for(const [role,revision,preset] of [
  ['table','2026-10-13-table-tuning-recalibrated',tablePreset],
  ['wall','2026-10-13-wall-tuning-5',wallPreset]
 ]){
  const oldTuning=JSON.stringify({legacy:true}),oldPositions=JSON.stringify({legacy:[1,2]});
  const saved=new Map([[`f2-${role}-preset-revision`,'previous'],[`f2-tuning-${role}`,oldTuning],[`f2-layout-${role}`,oldPositions]]);
  globalThis.localStorage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
  try{
   const loaded=loadTuning(role),backupKey=`f2-${role}-backup-before-${revision}`;
   assert.deepEqual(JSON.parse(saved.get(backupKey)),{tuning:oldTuning,positions:oldPositions});
   assert.equal(saved.get(`f2-${role}-preset-revision`),revision);
   assert.deepEqual(JSON.parse(saved.get(`f2-tuning-${role}`)),preset.tuning);
   assert.deepEqual(JSON.parse(saved.get(`f2-layout-${role}`)),preset.positions||{});
   if(role==='table')loaded.bg.quad=[[.1,.05],[.9,0],[1,1],[0,1]];
   else loaded.maskQuads.hrv[0]=[-.2,.1];
   const edited=JSON.stringify(loaded),backup=saved.get(backupKey);
   saved.set(`f2-tuning-${role}`,edited); loadTuning(role);
   assert.equal(saved.get(`f2-tuning-${role}`),edited);
   assert.equal(saved.get(backupKey),backup);
  }finally{delete globalThis.localStorage;}
 }
});
