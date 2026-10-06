import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {attachReaders,selectSlot,validateReaderMap} from '../server/nfc-readers.mjs';
test('fixed slots remain reserved for disconnected readers; invalid mappings rejected',()=>{
 assert.equal(selectSlot('new',{fixed:1},new Map()),2);
 assert.equal(selectSlot('fixed',{fixed:1},new Map([[1,{}]])),null);
 assert.throws(()=>validateReaderMap({a:1,b:1}));assert.throws(()=>validateReaderMap({a:10}));
});
test('nine PC/SC readers: present, remove, disconnect, reconnect and overflow',()=>{
 const nfc=new EventEmitter(),connected=new Map(),events=[],readers=[];
 attachReaders(nfc,{mapping:{},connected,onConnect:(...e)=>events.push(['connect',...e]),onCard:(...e)=>events.push(['card',...e]),onRemove:s=>events.push(['remove',s]),onDisconnect:s=>events.push(['disconnect',s]),onError:e=>events.push(['error',e])});
 for(let i=1;i<=9;i++){const r=new EventEmitter();r.reader={name:`reader ${i}`};readers.push(r);nfc.emit('reader',r);r.emit('card',{uid:'ab:cd'});}
 assert.equal(connected.size,9);assert.equal(events.filter(e=>e[0]==='card').length,9);assert.equal(events.find(e=>e[0]==='card')[3],'ABCD');
 const overflow=new EventEmitter();overflow.reader={name:'overflow'};nfc.emit('reader',overflow);overflow.emit('error',Error('test'));assert.equal(connected.size,9);
 readers[4].emit('card.off');readers[4].emit('end');assert.equal(connected.size,8);
 const replacement=new EventEmitter();replacement.reader={name:'replacement'};nfc.emit('reader',replacement);assert.equal(connected.get(5),replacement);
 readers[4].emit('card',{uid:'FFFF'});assert.equal(events.filter(e=>e[0]==='card').length,9);
 assert.ok(events.some(e=>e[0]==='remove'&&e[1]===5));assert.ok(events.some(e=>e[0]==='disconnect'&&e[1]===5));
});
