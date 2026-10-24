// Drop stalled peers instead of retaining an unbounded send queue.
export const MAX_BUFFERED_BYTES=256*1024;
export function sendBounded(ws,value){
  if(ws.readyState!==1)return false;
  if(ws.bufferedAmount>MAX_BUFFERED_BYTES){ws.terminate();return false;}
  try{ws.send(typeof value==='string'?value:JSON.stringify(value));return true;}
  catch{ws.terminate();return false;}
}
export function guardTransport(wss,{intervalMs=15000}={}){
  const onConnection=ws=>{
    ws.transportAlive=true;
    ws.on('pong',()=>{ws.transportAlive=true;});
  };
  wss.on('connection',onConnection);
  const tick=()=>{
    for(const ws of wss.clients){
      if(ws.readyState!==1)continue;
      if(ws.transportAlive===false||ws.bufferedAmount>MAX_BUFFERED_BYTES){ws.terminate();continue;}
      ws.transportAlive=false;
      try{ws.ping();}catch{ws.terminate();}
    }
  };
  const timer=setInterval(tick,intervalMs);timer.unref?.();
  const stop=()=>{clearInterval(timer);wss.off('connection',onConnection);};
  wss.once('close',stop);
  return {tick,stop};
}
