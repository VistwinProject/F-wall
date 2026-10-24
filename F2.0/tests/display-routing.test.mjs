import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveDisplays} from '../windows/resolve-displays.mjs';
const display=(DeviceName,Identity,FriendlyName,Manufacturer='')=>({DeviceName,Identity,FriendlyName,Manufacturer});
const acer=display('DISPLAY2','acer:123','Acer 4K PJ','ACR');
const jmgo=display('DISPLAY1','jmgo:456','JMGO Projector');
const tv=display('DISPLAY3','tv:789','Unknown TV');
test('Acer maps to Wall, JMGO to Table, sole remaining TV to Graph regardless of numbering',()=>{
  const roles=resolveDisplays([tv,acer,jmgo]);
  assert.equal(roles.wall.deviceName,'DISPLAY2');assert.equal(roles.table.deviceName,'DISPLAY1');assert.equal(roles.graph.deviceName,'DISPLAY3');
  const changed=resolveDisplays([ {...acer,DeviceName:'DISPLAY7'},{...tv,DeviceName:'DISPLAY4'},{...jmgo,DeviceName:'DISPLAY9'}]);
  assert.equal(changed.wall.deviceName,'DISPLAY7');assert.equal(changed.table.deviceName,'DISPLAY9');
});
test('saved hardware binding handles generic EDID names and changed Windows indexes',()=>{
  const roles=resolveDisplays([{...acer,DeviceName:'DISPLAY8'}, {...jmgo,FriendlyName:'Generic PnP Monitor'},tv],{displayBindings:{wall:acer.Identity,table:jmgo.Identity,graph:tv.Identity}});
  assert.equal(roles.wall.deviceName,'DISPLAY8');assert.equal(roles.table.identity,jmgo.Identity);
});
test('missing or ambiguous displays fail instead of routing to the wrong screen',()=>{
  assert.throws(()=>resolveDisplays([acer,jmgo]),/three|Connect/);
  assert.throws(()=>resolveDisplays([acer,{...jmgo,FriendlyName:'Generic'},tv]),/JMGO/);
  assert.throws(()=>resolveDisplays([acer,jmgo,tv,display('DISPLAY4','extra','Laptop')]),/ambiguous/);
  assert.throws(()=>resolveDisplays([acer,jmgo,tv,display('DISPLAY4','acer:999','Acer')]),/Acer/);
  assert.throws(()=>resolveDisplays([acer,jmgo,tv],{displayBindings:{wall:acer.Identity,table:acer.Identity}}),/different/);
  assert.throws(()=>resolveDisplays([acer,jmgo,{...tv,Identity:''}]),/identity/);
});
test('an explicitly bound Graph allows an additional operator display',()=>{
  const roles=resolveDisplays([acer,jmgo,tv,display('DISPLAY4','extra','Laptop')],{displayBindings:{graph:tv.Identity}});
  assert.equal(roles.graph.identity,tv.Identity);
});
