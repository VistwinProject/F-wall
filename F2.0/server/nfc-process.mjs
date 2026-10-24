import {fork} from 'node:child_process';

// Native PC/SC work stays outside HTTP. Restart only after the old host exits.
export function startNfcProcess({mapping,connected,onConnect,onCard,onRemove,onDisconnect,onError,onState=()=>{}},
  {moduleURL=new URL('./nfc-host.mjs',import.meta.url),timeout=10000,retryDelay=2000,maxRetryDelay=60000,stableAfter=60000}={}){
  let closing=false,child,watchdog,retryTimer,killTimer,failures=0,closePromise;
  const clearReaders=()=>{for(const slot of [...connected.keys()]){connected.delete(slot);onDisconnect(slot);}};
  function launch(){
    if(closing)return;
    let failed=false,lastSeen=Date.now(),readyAt=0;
    onState('starting');
    const host=child=fork(moduleURL,[],{execArgv:[],windowsHide:true,stdio:['ignore','pipe','pipe','ipc']});
    host.stdout.on('data',()=>{});
    host.stderr.on('data',chunk=>{if(!closing&&!failed)onError(String(chunk).slice(0,2048));});
    function fail(message){
      if(closing||failed)return;failed=true;clearInterval(watchdog);
      onState('unavailable');onError(message);clearReaders();
      host.kill();killTimer=setTimeout(()=>host.kill('SIGKILL'),1000);killTimer.unref();
    }
    watchdog=setInterval(()=>{
      if(Date.now()-lastSeen>timeout)fail('NFC process is not responding; retrying automatically. Check Windows Smart Card (SCardSvr) and reader USB connections.');
      if(readyAt&&Date.now()-readyAt>=stableAfter)failures=0;
    },Math.min(1000,timeout/2));watchdog.unref();
    host.on('error',error=>fail(error.message));
    host.on('exit',(code,signal)=>{
      if(!closing&&!failed)fail(`NFC process exited (${code??signal}); retrying automatically.`);
      clearInterval(watchdog);clearTimeout(killTimer);
      if(closing)return;
      const delay=Math.min(maxRetryDelay,retryDelay*2**Math.min(failures++,10));
      retryTimer=setTimeout(launch,delay);retryTimer.unref();
    });
    host.on('message',msg=>{
      if(closing||failed||!msg)return;
      lastSeen=Date.now();const args=msg.args||[];
      if(msg.type==='ready'){readyAt=Date.now();onState('ready');}
      else if(msg.type==='connect'){connected.set(args[0],{name:args[1]});onConnect(...args);}
      else if(msg.type==='card')onCard(...args);
      else if(msg.type==='remove')onRemove(...args);
      else if(msg.type==='disconnect'){connected.delete(args[0]);onDisconnect(...args);}
      else if(msg.type==='error')onError(...args);
      else if(msg.type==='fatal')fail(args[0]);
    });
    host.send({type:'init',mapping},error=>{if(error)fail(error.message);});
  }
  launch();
  return {close(){
    if(closePromise)return closePromise;
    closing=true;clearInterval(watchdog);clearTimeout(retryTimer);clearTimeout(killTimer);
    closePromise=new Promise(resolve=>{
      if(!child||child.exitCode!==null||child.signalCode!==null)return resolve();
      const host=child,force=setTimeout(()=>host.kill('SIGKILL'),1000);
      host.once('exit',()=>{clearTimeout(force);resolve();});
      if(host.connected)host.send({type:'stop'},()=>{});else host.kill('SIGKILL');
    });
    return closePromise;
  }};
}
