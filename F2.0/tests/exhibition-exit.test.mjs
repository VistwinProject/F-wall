import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {isLocalExitRequest,createExhibitionExit} from '../server/exhibition-exit.mjs';

test('exit only accepts local POST from an exhibition origin',()=>{
 const req={method:'POST',socket:{remoteAddress:'127.0.0.1'},headers:{origin:'http://localhost:6274'}};
 assert.equal(isLocalExitRequest(req,6273),true);
 for(const patch of [{method:'GET'},{socket:{remoteAddress:'192.168.1.2'}},{headers:{}},{headers:{origin:'https://example.com'}},{headers:{origin:'http://localhost:9999'}}])assert.equal(isLocalExitRequest({...req,...patch},6273),false);
});
test('exit starts one hidden installation-specific stop process',async()=>{
 const calls=[];
 const stop=createExhibitionExit('C:/F folder',(command,args,options)=>{calls.push({command,args,options});const child=new EventEmitter();child.unref=()=>{};queueMicrotask(()=>child.emit('spawn'));return child;},path.join(os.tmpdir(),'f-exit-test.log'));
 await Promise.all([stop(),stop()]);assert.equal(calls.length,1);
 assert.ok(calls[0].args.at(-2).endsWith('stop.ps1'));assert.equal(calls[0].args.at(-1),'-CloseDisplaysFirst');
 assert.equal(calls[0].options.cwd,'C:/F folder');assert.equal(calls[0].options.windowsHide,true);
});
test('exit can retry when Windows process creation fails',async()=>{
 let tries=0;
 const stop=createExhibitionExit('C:/F',()=>{const child=new EventEmitter();child.unref=()=>{};queueMicrotask(()=>++tries===1?child.emit('error',Error('denied')):child.emit('spawn'));return child;},path.join(os.tmpdir(),'f-exit-test.log'));
 await assert.rejects(stop(),/denied/);await stop();assert.equal(tries,2);
});
test('Escape from each display calls exit once, while iPad has no exit shortcut',async()=>{
 const source=readFileSync(new URL('../public/display-fullscreen.js',import.meta.url),'utf8');
 for(const role of ['table','wall','graph','ipad']){
  let handler;const calls=[];
  vm.runInNewContext(source,{location:{pathname:'/'+role},document:{addEventListener:(type,fn)=>handler=fn},fetch:async(url,options)=>{calls.push({url,options});return {ok:true};},console,alert:()=>{throw Error('Unexpected alert');}});
  if(role==='ipad'){assert.equal(handler,undefined);continue;}
  const event={key:'Escape',code:'Escape',repeat:false,preventDefault(){},stopImmediatePropagation(){}};
  await handler(event);await handler(event);
  assert.equal(calls.length,1);assert.equal(calls[0].url,'/exhibition-exit');assert.equal(calls[0].options.method,'POST');
 }
});
