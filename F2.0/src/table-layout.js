// NFC 5 defines the vertical symmetry axis; paired slots share their Y value.
export function moveSymmetricSlot(slots,index,x,y){
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  y=clamp(y,0,1000);
  if(index===4){slots[index].splice(0,2,clamp(x,0,1920),y);return;}
  const axis=slots[4][0];
  x=clamp(x,Math.max(0,2*axis-1920),Math.min(1920,2*axis));
  slots[index].splice(0,2,x,y);
  slots[8-index].splice(0,2,2*axis-x,y);
}
