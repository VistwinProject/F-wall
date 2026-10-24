import {createRequire} from 'node:module';
import {attachReaders,validateReaderMap} from './nfc-readers.mjs';
const connected=new Map();let nfc,heartbeat;
const send=(type,...args)=>{if(process.connected)process.send({type,args},()=>{});};
function stop(){clearInterval(heartbeat);for(const reader of connected.values()){try{reader.close();}catch{}}try{nfc?.close();}catch{}process.exit(0);}
process.on('disconnect',stop);
process.on('message',msg=>{
  if(msg.type==='stop')return stop();
  if(msg.type!=='init'||nfc)return;
  try{
    const {NFC}=createRequire(import.meta.url)('nfc-pcsc');
    nfc=new NFC();
    attachReaders(nfc,{mapping:validateReaderMap(msg.mapping),connected,
      onConnect:(...a)=>send('connect',...a),onCard:(...a)=>send('card',...a),
      onRemove:(...a)=>send('remove',...a),onDisconnect:(...a)=>send('disconnect',...a),onError:e=>send('error',e),onFatal:e=>send('fatal',e)});
    send('ready');heartbeat=setInterval(()=>send('heartbeat'),2000);
  }catch(error){send('fatal',`NFC initialization failed: ${error.message}`);}
});
