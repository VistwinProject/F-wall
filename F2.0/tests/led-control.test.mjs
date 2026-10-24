import test from 'node:test';
import assert from 'node:assert/strict';
import {createLedControl,hasDetectedAppliance} from '../server/led-control.mjs';
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
const card=id=>({known:true,data:{id}});
test('LED stays on until the last recognized appliance leaves; unknown cards stay off',async()=>{
 const calls=[],led=createLedControl({enabled:true,transport:'http-json',url:'http://controller.invalid'},{send:async on=>{calls.push(on);}});
 await tick();const slots=new Map();
 assert.equal(hasDetectedAppliance(new Map([[1,{known:false,uid:'unknown'}]])),false);
 slots.set(1,card('ac'));led.sync(slots);await tick();
 slots.set(2,card('hrv'));led.sync(slots);await tick();
 slots.delete(1);led.sync(slots);await tick();assert.deepEqual(calls,[false,true]);
 slots.clear();led.sync(slots);await tick();assert.deepEqual(calls,[false,true,false]);
 await led.stop();
});
test('unconfigured output reports desired light without sending hardware commands',async()=>{
 const led=createLedControl({}, {send:async()=>assert.fail('must not send')});led.set(true);
 assert.deepEqual(led.status(),{enabled:false,transport:'disabled',desired:true,applied:null,status:'not-configured',error:null});await led.stop();
});
test('late on acknowledgment cannot overwrite newer off request',async()=>{
 const calls=[];let release;
 const led=createLedControl({enabled:true,transport:'http-json',url:'http://controller.invalid'}, {send:async on=>{calls.push(on);if(on)await new Promise(r=>release=r);}});
 await tick();led.set(true);await tick();led.set(false);release();await tick();
 assert.deepEqual(calls,[false,true,false]);assert.equal(led.status().applied,false);await led.stop();
});
test('failed output retries latest desired state instead of replaying old on',async()=>{
 let fail=true;const calls=[];
 const led=createLedControl({enabled:true,transport:'http-json',url:'http://controller.invalid'},{retryMs:20,send:async on=>{calls.push(on);if(fail)throw Error('offline');}});
 await tick();assert.equal(led.status().status,'error');led.set(true);await tick();fail=false;led.set(false);await tick();
 assert.equal(led.status().applied,false);assert.equal(calls.at(-1),false);await led.stop();
});
