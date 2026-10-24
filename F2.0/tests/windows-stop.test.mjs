import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
test('installation-scoped stop file stops only the matching server', {timeout:15000}, async()=>{
 let base;
 for(let attempt=0;attempt<30;attempt++){
  const candidate=20000+Math.floor(Math.random()*30000),sockets=[];
  try{for(let i=0;i<3;i++){const socket=net.createServer();sockets.push(socket);await new Promise((ok,no)=>{socket.once('error',no);socket.listen(candidate+i,'0.0.0.0',ok);});}base=candidate;break;}
  catch(error){if(error.code!=='EADDRINUSE')throw error;}
  finally{await Promise.all(sockets.map(s=>new Promise(r=>s.close(r))));}
 }
 assert.ok(base);
 const tmp=await mkdtemp(path.join(os.tmpdir(),'f-stop-')),stop=path.join(tmp,'stop-request');
 const child=spawn(process.execPath,['server/index.mjs','--sim'],{cwd:new URL('../',import.meta.url),env:{...process.env,F_PORT_BASE:String(base),F_INSTANCE_ID:'test-instance',F_STOP_FILE:stop},stdio:'pipe'});
 let logs='';child.stderr.on('data',d=>logs+=d);child.stdout.on('data',()=>{});
 const exited=once(child,'exit');
 try{
  let ready=false;
  for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error(logs);try{ready=(await fetch(`http://127.0.0.1:${base}/health`)).ok;if(ready)break;}catch{}await delay(30);}
  assert.ok(ready);
  await writeFile(stop,'another-instance');await delay(650);assert.equal(child.exitCode,null);
  await writeFile(stop,'test-instance');
  let timeout;await Promise.race([exited,new Promise((_,reject)=>timeout=setTimeout(()=>reject(Error('stop timed out')),5000))]).finally(()=>clearTimeout(timeout));
  assert.equal(child.exitCode,0);
 }finally{if(child.exitCode===null){child.kill();await exited;}await rm(tmp,{recursive:true,force:true});}
});
