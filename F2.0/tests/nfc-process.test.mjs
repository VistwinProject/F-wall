import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import http from 'node:http';
import {startNfcProcess} from '../server/nfc-process.mjs';
import {readHealth} from '../windows/health-check.mjs';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('blocked native NFC initialization cannot block HTTP or shutdown',{timeout:5000},async()=>{
 const tmp=await mkdtemp(path.join(tmpdir(),'f-nfc-block-'));
 const file=path.join(tmp,'blocked.mjs');await writeFile(file,'process.on("message",()=>{while(true){}});');
 const states=[],errors=[],server=http.createServer((q,r)=>r.end('{"app":"f-control-tower"}'));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const bridge=startNfcProcess({mapping:{},connected:new Map(),onState:s=>states.push(s),onError:e=>errors.push(e),onDisconnect:()=>{}},{moduleURL:pathToFileURL(file),timeout:200});
 try{
  await delay(80);assert.equal((await readHealth(server.address().port,{timeout:500})).ok,true);
  for(let i=0;i<30&&!states.includes('unavailable');i++)await delay(25);
  assert.ok(states.includes('unavailable'));assert.match(errors[0],/not responding/);
  await bridge.close();
 }finally{await bridge.close();await new Promise(resolve=>server.close(resolve));await rm(tmp,{recursive:true,force:true});}
});
test('NFC process forwards nine slots and disconnects cleanly after a native crash',{timeout:5000},async()=>{
 const tmp=await mkdtemp(path.join(tmpdir(),'f-nfc-events-')),file=path.join(tmp,'reader.mjs');
 await writeFile(file,`process.on('message',msg=>{if(msg.type==='init'){
 process.send({type:'ready'});
 for(let i=1;i<=9;i++){process.send({type:'connect',args:[i,'reader '+i,true]});process.send({type:'card',args:[i,'reader '+i,'ABCD']});}
 process.send({type:'remove',args:[3]});process.send({type:'disconnect',args:[3]});setTimeout(()=>process.exit(2),20);
 }});`);
 const connected=new Map(),cards=[],removed=[],disconnected=[],states=[];
 const bridge=startNfcProcess({mapping:{},connected,onConnect:()=>{},onCard:(...a)=>cards.push(a),onRemove:s=>removed.push(s),onDisconnect:s=>disconnected.push(s),onError:()=>{},onState:s=>states.push(s)},{moduleURL:pathToFileURL(file)});
 try{
  for(let i=0;i<80&&!states.includes('unavailable');i++)await delay(25);
  assert.equal(cards.length,9);assert.deepEqual(removed,[3]);assert.equal(new Set(disconnected).size,9);assert.equal(connected.size,0);assert.ok(states.includes('ready'));assert.ok(states.includes('unavailable'));
 }finally{await bridge.close();await rm(tmp,{recursive:true,force:true});}
});
test('failed host recovers automatically without stale slots; close cancels further retries',{timeout:5000},async()=>{
 const tmp=await mkdtemp(path.join(tmpdir(),'f-nfc-retry-')),file=path.join(tmp,'recover.mjs');
 await writeFile(file,`import fs from 'node:fs';
 const marker=new URL('./attempt',import.meta.url);
 process.on('message',msg=>{if(msg.type==='stop')process.exit(0);if(msg.type!=='init')return;
 process.send({type:'ready'});process.send({type:'connect',args:[1,'fixed reader',true]});
 if(!fs.existsSync(marker)){fs.writeFileSync(marker,'1');process.send({type:'card',args:[1,'fixed reader','AAAA']});setTimeout(()=>process.exit(2),20);}
 else {process.send({type:'card',args:[1,'fixed reader','BBBB']});setInterval(()=>process.send({type:'heartbeat'}),50);}
 });`);
 const connected=new Map(),cards=[],disconnected=[],states=[];
 const bridge=startNfcProcess({mapping:{'fixed reader':1},connected,onConnect:()=>{},onCard:(...a)=>cards.push(a),onRemove:()=>{},onDisconnect:s=>disconnected.push(s),onError:()=>{},onState:s=>states.push(s)}, {moduleURL:pathToFileURL(file),timeout:400,retryDelay:40,maxRetryDelay:80});
 try{
  for(let i=0;i<100&&cards.length<2;i++)await delay(20);
  assert.deepEqual(cards.map(c=>c[2]),['AAAA','BBBB']);assert.deepEqual(disconnected,[1]);assert.equal(connected.size,1);
  assert.equal(states.filter(s=>s==='ready').length,2);
  await bridge.close();const count=states.length;await delay(150);assert.equal(states.length,count);
 }finally{await bridge.close();await rm(tmp,{recursive:true,force:true});}
});
