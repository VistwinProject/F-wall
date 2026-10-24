import {BY_ID} from './devices.js';
// One reducer used by every view. A slot removal deliberately has no device ID.
export function reduce(previous,event){
  const next={...previous,slots:{...previous.slots}};
  if(Number.isInteger(event.revision))next.revision=event.revision;
  if(event.type==='snapshot'){
    next.slots=Object.fromEntries(event.slots.map(({slot_index,...rest})=>[slot_index,rest]));
    next.completionAudioReady=!!event.completionAudioReady;
    next.session=event.session;next.sim=event.sim;next.demo=event.demo;next.ready=true;
    next.introPhase=event.introPhase||'ready';next.introToken=event.introToken||0;
  }else if(event.type==='intro-state'){
    next.introPhase=event.phase;next.introToken=event.token;
  }else if(event.type==='tag-present'){
    next.suppressCompletionAudio=!!event.suppressAudio;
    next.completionAudioReady=!!event.completionAudioReady;next.cancelledAudio=false;
    next.slots[event.slot_index]={...next.slots[event.slot_index],uid:event.uid,known:event.known,data:event.known!==false&&BY_ID[event.data?.id]?event.data:null};
    if(next.slots[event.slot_index].data)next.focus=event.data.id;
  }else if(event.type==='audio-stop'){
    next.cancelledAudio=true;next.completionAudioReady=false;
  }else if(event.type==='completion-audio-ready'){
    next.completionAudioReady=true;
  }else if(event.type==='tag-remove'){
    next.completionAudioReady=false;
    next.slots[event.slot_index]={reader:next.slots[event.slot_index]?.reader};
  }else if(event.type==='reader-connected')next.slots[event.slot_index]={reader:event.reader};
  else if(event.type==='reader-disconnected')delete next.slots[event.slot_index];
  else if(event.type==='session-start')next.session=true;
  else if(event.type==='session-end'){next.session=false;next.focus=null;for(const slot in next.slots)next.slots[slot]={reader:next.slots[slot].reader};}
  else if(event.type==='demo-status')next.demo=event.running;
  next.active=[...new Set(Object.values(next.slots).map(s=>s.data?.id).filter(id=>BY_ID[id]))];
  if(!next.active.includes(next.focus))next.focus=next.active[0]||null;
  return next;
}
export class Session extends EventTarget{
  state={slots:{},active:[],session:false,online:false,ready:false,sim:false,demo:false,focus:null};
  constructor(role){
    super();this.role=role;
    this.onPageHide=()=>this.dispose();
    this.onPageShow=e=>{if(e.persisted&&this.stopped){this.stopped=false;this.connect();}};
    globalThis.addEventListener?.('pagehide',this.onPageHide);
    globalThis.addEventListener?.('pageshow',this.onPageShow);
    this.connect();
  }
  connect(){
    if(this.stopped)return;
    clearTimeout(this.timer);clearInterval(this.heartbeat);
    const params=new URLSearchParams(location.search);
    const override=params.get('ws');
    const address=override?(override.includes('://')?override:`${location.protocol==='https:'?'wss':'ws'}://${override}`):`${location.protocol==='https:'?'wss':'ws'}://${location.host}`;
    let socket;
    try{const url=new URL(address);url.searchParams.set('role',this.role);socket=this.socket=new WebSocket(url);}catch{this.retry();return;}
    this.lastMessage=Date.now();
    this.heartbeat=setInterval(()=>{
      if(Date.now()-this.lastMessage>30000){this.disconnect(socket);return;}
      if(socket.readyState===WebSocket.OPEN)this.send('ping');
    },10000);
    socket.onopen=()=>{if(this.socket!==socket)return;this.delay=1000;this.state={...this.state,online:true};this.emit('connection');};
    socket.onmessage=({data})=>{
      if(this.socket!==socket)return;
      this.lastMessage=Date.now();
      try{const event=JSON.parse(data);if(!event||typeof event!=='object')return;if(event.type==='pong')return;this.state=reduce(this.state,event);this.emit(event.type,event);}catch(error){console.warn('Ignored malformed state message',error);}
    };
    socket.onclose=()=>this.disconnect(socket);
    socket.onerror=()=>this.disconnect(socket);
  }
  disconnect(socket){
    if(this.socket!==socket)return;
    this.socket=null;clearInterval(this.heartbeat);
    socket.onopen=socket.onmessage=socket.onclose=socket.onerror=null;
    try{socket.close();}catch{}
    this.state={...this.state,online:false,ready:false};this.emit('connection');this.retry();
  }
  retry(){if(this.stopped)return;clearTimeout(this.timer);this.delay=Math.min(this.delay||1000,8000);this.timer=setTimeout(()=>this.connect(),this.delay);this.delay*=1.6;}
  dispose(){
    this.stopped=true;clearTimeout(this.timer);clearInterval(this.heartbeat);
    if(this.socket)this.disconnect(this.socket);
  }
  emit(type,event){this.dispatchEvent(new CustomEvent('change',{detail:{type,state:this.state,event}}));}
  send(type,fields={}){
    if(this.socket?.readyState!==WebSocket.OPEN)return false;
    if(this.socket.bufferedAmount>256*1024){this.disconnect(this.socket);return false;}
    try{this.socket.send(JSON.stringify({type,...fields}));return true;}catch{this.disconnect(this.socket);return false;}
  }
}
