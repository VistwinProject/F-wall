import {createRestoredOrb} from './restored-orb.js';
// One MediaElementAudioSource per media element; reuse across reconnections.
const audioGraphs = new WeakMap();
export function mountOrb(container) {
  const canvas=document.createElement('canvas'), status=document.createElement('div');
  canvas.style.cssText='display:block;width:100%;height:100%;';
  status.hidden=true; status.setAttribute('role','status');
  container.append(canvas,status);
  let active=false, disposed=false, cleanup=null;
  let resolveReady,rejectReady;
  const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
  const renderer=createRestoredOrb({canvas,status,onReady:resolveReady,onError:rejectReady});
  // Keep errors visible even when the caller does not await ready.
  ready.catch(()=>{});
  const api={ready,canvas,
    start(){if(disposed)return; active=true;renderer.setState('thinking');},
    setLevel(value){if(disposed)return;renderer.setSpeechLevel(active?value:0);},
    end(){if(disposed)return;active=false;renderer.setSpeechLevel(0);renderer.setState('idle');},
    // Call from a user click BEFORE audio.play(). A pause/ended event does not end the show.
    async connectAudio(audio,{gain=5,noiseFloor=0.008}={}){
      if(disposed)throw new Error('Orb has been disposed');
      cleanup?.();
      let graph=audioGraphs.get(audio);
      if(!graph){
        const context=new AudioContext();
        const source=context.createMediaElementSource(audio);
        const analyser=context.createAnalyser();analyser.fftSize=1024;
        source.connect(analyser);analyser.connect(context.destination);
        graph={context,analyser};audioGraphs.set(audio,graph);
      }
      await graph.context.resume();
      if(disposed)return;
      const samples=new Float32Array(graph.analyser.fftSize);
      let frame=0,stopped=false;
      const update=()=>{
        if(stopped)return;
        graph.analyser.getFloatTimeDomainData(samples);
        const rms=Math.sqrt(samples.reduce((sum,x)=>sum+x*x,0)/samples.length);
        api.setLevel(audio.paused||audio.ended?0:Math.min(1,Math.max(0,rms-noiseFloor)*gain));
        frame=requestAnimationFrame(update);
      };
      update();
      cleanup=()=>{stopped=true;cancelAnimationFrame(frame);api.setLevel(0);};
      return cleanup;
    },
    disconnectAudio(){cleanup?.();cleanup=null;},
    dispose(){if(disposed)return;cleanup?.();renderer.dispose();disposed=true;canvas.remove();status.remove();}
  };
  return api;
}
