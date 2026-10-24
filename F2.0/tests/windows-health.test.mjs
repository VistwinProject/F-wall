import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readHealth} from '../windows/health-check.mjs';

test('Windows health check identifies F, foreign services, invalid responses and timeouts',async()=>{
  let response=JSON.stringify({app:'f-control-tower',instance:'test',mode:'live'}),status=200,hang=false;
  const server=http.createServer((req,res)=>{if(hang)return;res.writeHead(status);res.end(response);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  try{
    assert.equal((await readHealth(port)).health.instance,'test');
    response='{"app":"another-server"}';assert.equal((await readHealth(port)).occupied,true);
    response='<html>Another app</html>';assert.match((await readHealth(port)).error,/invalid JSON/);
    status=503;assert.match((await readHealth(port)).error,/HTTP 503/);
    hang=true;assert.match((await readHealth(port,{timeout:50})).error,/timed out/);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  assert.match((await readHealth(port)).error,/ECONNREFUSED/);
});
