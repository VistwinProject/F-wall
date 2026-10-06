// Reserve configured slots even while their readers are disconnected.
export function selectSlot(name, mapping, connected) {
  const mapped=mapping[name];
  if(mapped!==undefined)return Number.isInteger(mapped)&&mapped>=1&&mapped<=9&&!connected.has(mapped)?mapped:null;
  const reserved=new Set(Object.values(mapping));
  return Array.from({length:9},(_,i)=>i+1).find(i=>!reserved.has(i)&&!connected.has(i))??null;
}
export function validateReaderMap(mapping) {
  if(!mapping||typeof mapping!=='object'||Array.isArray(mapping))throw Error('reader-map.json 必須為物件');
  const slots=Object.values(mapping);
  if(slots.some(s=>!Number.isInteger(s)||s<1||s>9)||new Set(slots).size!==slots.length)throw Error('reader-map.json 槽位必須為 1–9 且不可重複');
  return mapping;
}
export function attachReaders(nfc,{mapping,connected,onConnect,onCard,onRemove,onDisconnect,onError}) {
  nfc.on('reader',reader=>{
    const name=reader.reader.name;
    const slot=selectSlot(name,mapping,connected);
    // Attach error listener even to rejected readers: EventEmitter error must not crash service.
    reader.on('error',error=>onError(`${name}: ${error.message}`));
    if(slot===null){onError(`Invalid or occupied NFC slot: ${name}`);return;}
    connected.set(slot,reader);onConnect(slot,name,mapping[name]!==undefined);
    reader.on('card',card=>{
      if(connected.get(slot)!==reader)return;
      const uid=String(card.uid||'').replace(/[^a-f0-9]/gi,'').toUpperCase();
      if(uid)onCard(slot,name,uid);
    });
    reader.on('card.off',()=>{if(connected.get(slot)===reader)onRemove(slot);});
    reader.on('end',()=>{if(connected.get(slot)!==reader)return;connected.delete(slot);onDisconnect(slot);});
  });
  nfc.on('error',error=>onError(error.message));
}
