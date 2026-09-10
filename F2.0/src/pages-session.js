import {DEVICES,BY_ID,TIMING} from './devices.js';
import {reduce} from './session.js';
const KEY='vistwin-f2-pages-session-v1';
const fresh=()=>({type:'snapshot',version:2,revision:0,session:false,sim:true,demo:false,demoOwner:null,completionAudioReady:false,finalAudioSlot:null,suppressCompletionAudio:false,cancelledAudio:false,slots:DEVICES.map((_,i)=>({slot_index:i+1,reader:'Demo reader '+(i+1)}))});
function read(){try{const data=JSON.parse(localStorage.getItem(KEY));return data?.snapshot?.version===2?data.snapshot:fresh();}catch{return fresh();}}
// GitHub Pages has no Node/PCSC server. All three project paths share one
// same-origin demo session; Web Locks serialize commands between tabs.
export class PagesSession extends EventTarget{
 state={slots:{},active:[],session:false,online:true,ready:false,sim:true,demo:false,focus:null};
 constructor(role){
  super();this.role=role;this.id=crypto.randomUUID();this.seen=-1;
  this.storageHandler=e=>{if(e.key!==KEY||!e.newValue)return;try{this.accept(JSON.parse(e.newValue));}catch(error){console.warn('Demo state unavailable',error);}};
  addEventListener('storage',this.storageHandler);
  queueMicrotask(()=>{const snapshot=read();this.seen=snapshot.revision;this.state=reduce(this.state,snapshot);this.state.online=true;this.state.suppressCompletionAudio=!!snapshot.suppressCompletionAudio;this.state.cancelledAudio=!!snapshot.cancelledAudio;this.emit('snapshot',snapshot);});
  addEventListener('pagehide',()=>{clearTimeout(this.demoTimer);removeEventListener('storage',this.storageHandler);},{once:true});
 }
 emit(type,event){this.dispatchEvent(new CustomEvent('change',{detail:{type,state:this.state,event}}));}
 accept(envelope){
  if(envelope.snapshot.revision<=this.seen)return;this.seen=envelope.snapshot.revision;
  this.state=reduce(this.state,envelope.before);this.state.online=true;
  for(const event of envelope.events){this.state=reduce(this.state,event);this.emit(event.type,event);}
 }
 send(type,fields={}){
  const execute=()=>this.command(type,fields);
  const task=navigator.locks?navigator.locks.request(KEY,execute):Promise.resolve().then(execute);
  task.catch(error=>{console.error('Demo command failed',error);this.state={...this.state,online:false};this.emit('connection');});
  return true;
 }
 command(type,msg){
  const before=read(),s=structuredClone(before),events=[];
  const emit=event=>{s.revision++;events.push({...event,revision:s.revision,at:Date.now()});};
  const activeCount=()=>new Set(s.slots.map(v=>v.data?.id).filter(Boolean)).size;
  const start=()=>{if(!s.session){s.session=true;s.cancelledAudio=false;emit({type:'session-start'});}};
  const stopDemo=()=>{if(s.demo){s.demo=false;s.demoOwner=null;emit({type:'demo-status',running:false});}};
  const remove=slot=>{const v=s.slots[slot-1];if(!v)return;s.slots[slot-1]={slot_index:slot,reader:v.reader};s.completionAudioReady=false;s.finalAudioSlot=null;emit({type:'tag-remove',slot_index:slot});};
  const put=(slot,id,silent=false)=>{
   if(!Number.isInteger(slot)||slot<1||slot>9||!BY_ID[id])return;start();
   const d=BY_ID[id],data={slot_index:slot,reader:'Demo reader '+slot,uid:'SIM-'+id,known:true,data:{id,label:d.label,description:d.sub}};s.slots[slot-1]=data;
   const all=activeCount()===9;s.completionAudioReady=all&&silent;s.finalAudioSlot=all&&!silent?slot:null;s.suppressCompletionAudio=silent;s.cancelledAudio=false;
   emit({type:'tag-present',...data,suppressAudio:silent,completionAudioReady:s.completionAudioReady});
  };
  const stopAudio=()=>{s.cancelledAudio=true;s.completionAudioReady=false;emit({type:'audio-stop'});};
  if(type==='session-start')start();
  else if(type==='session-end'){stopDemo();stopAudio();s.slots.forEach(v=>{if(v.data)remove(v.slot_index);});s.session=false;emit({type:'session-end'});}
  else if(type==='simulate'){
   stopDemo();
   if(msg.action==='all')DEVICES.forEach((d,i)=>put(i+1,d.id,true));
   else if(msg.action==='clear'){stopAudio();s.slots.forEach(v=>{if(v.data)remove(v.slot_index);});}
   else if(msg.action==='toggle'){const slot=Number(msg.slot_index);if(Number.isInteger(slot)&&slot>=1&&slot<=9){if(s.slots[slot-1]?.data)remove(slot);else put(slot,msg.id||DEVICES[slot-1].id);}}
  }else if(type==='device-audio-finished'&&this.role==='table'){
   const slot=Number(msg.slot_index),v=s.slots[slot-1];
   if(s.finalAudioSlot===slot&&v?.data?.id===msg.id&&v?.uid===msg.uid&&activeCount()===9){s.completionAudioReady=true;s.finalAudioSlot=null;emit({type:'completion-audio-ready'});}
  }else if(type==='demo-stop')stopDemo();
  else if(type==='demo-start'){
   stopDemo();s.slots.forEach(v=>{if(v.data)remove(v.slot_index);});start();s.demo=true;s.demoOwner=this.id;emit({type:'demo-status',running:true});
  }else if(type==='demo-tick'&&s.demo&&s.demoOwner===this.id){if(msg.removing)remove(msg.index+1);else put(msg.index+1,DEVICES[msg.index].id);}
  if(!events.length)return;
  const envelope={before,snapshot:s,events};localStorage.setItem(KEY,JSON.stringify(envelope));this.accept(envelope);
  if(type==='demo-start')this.scheduleDemo(0,false,TIMING.step);
  if(type==='demo-tick'&&s.demo&&s.demoOwner===this.id){const last=msg.index===8;this.scheduleDemo(last?0:msg.index+1,last?!msg.removing:msg.removing,last?(msg.removing?TIMING.step:TIMING.hold):(msg.removing?TIMING.clear:TIMING.step));}
 }
 scheduleDemo(index,removing,delay){clearTimeout(this.demoTimer);this.demoTimer=setTimeout(()=>{const s=read();if(s.demo&&s.demoOwner===this.id)this.send('demo-tick',{index,removing});},delay);}
}
