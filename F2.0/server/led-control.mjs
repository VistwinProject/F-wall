// Aggregate all known appliance slots. A second card must not restart the light.
export const hasDetectedAppliance = slots => [...slots.values()].some(slot => slot.known !== false && !!slot.data?.id);
export function createLedControl(config={}, {send, retryMs=2000}={}) {
  const enabled=config.enabled===true;
  if(enabled && (config.transport!=='http-json'||!/^https?:\/\//.test(config.url||'')))throw Error('LED: configure http-json URL before enabling output');
  const state={enabled,transport:enabled?config.transport:'disabled',desired:false,applied:null,status:enabled?'pending':'not-configured',error:null};
  let running=false,timer,closed=false,generation=0,appliedGeneration=-1;
  const transmit=send|| (async on=>{
    const response=await fetch(config.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(on?(config.onPayload||{power:true,mode:'steady'}):(config.offPayload||{power:false})),signal:AbortSignal.timeout(2000)});
    if(!response.ok)throw Error('HTTP '+response.status);
  });
  async function flush(){
    if(running||closed||!enabled)return;
    running=true;
    try{
      while(!closed&&appliedGeneration!==generation){
        const current=generation,on=state.desired;state.status='sending';
        await transmit(on);state.applied=on;appliedGeneration=current;state.error=null;state.status='command-accepted';
      }
    }catch(error){
      state.error=error.message;state.status='error';
      if(!closed){timer=setTimeout(()=>{timer=null;void flush();},retryMs);timer.unref?.();}
    }finally{running=false;}
  }
  function set(on){
    on=!!on;
    if(closed)return;
    if(state.desired!==on){state.desired=on;generation++;if(timer){clearTimeout(timer);timer=null;}}
    if(!timer)void flush();
  }
  // Startup explicitly requests off if a controller has been configured.
  set(false);
  return {set,sync(slots){set(hasDetectedAppliance(slots));},status(){return {...state};},async stop(){
    clearTimeout(timer);closed=true;
    // Await an in-flight command before the final off so it cannot turn on later.
    while(running)await new Promise(resolve=>setTimeout(resolve,10));
    if(enabled){try{await transmit(false);state.applied=false;state.status='command-accepted';}catch(error){state.error=error.message;state.status='error';}}
    state.desired=false;
  }};
}
