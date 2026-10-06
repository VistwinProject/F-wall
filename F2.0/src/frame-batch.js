// Keep every event type, but render only the latest state once per frame.
export function batchFrame(flush){
  let frame=null,events=new Set();
  function queue(type){
    events.add(type);
    if(frame!==null)return;
    frame=requestAnimationFrame(()=>{
      frame=null;
      const pending=events;events=new Set();
      flush(pending);
    });
  }
  queue.cancel=()=>{cancelAnimationFrame(frame);frame=null;events.clear();};
  return queue;
}
