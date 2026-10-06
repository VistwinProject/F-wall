// Runs an isolated adapter against the actual browser displays; never drives X/PAD.
import {makeFAdapter} from './x-f-adapter.mjs';
import {writeFile} from 'node:fs/promises';
const result=[];
let ready=false;
const adapter=makeFAdapter({id:'F',transport:{url:'ws://127.0.0.1:6373/?role=x-isolated'}},{onStatus:r=>ready=r});
adapter.start();
try{
  const deadline=Date.now()+12000;
  while(!ready&&Date.now()<deadline)await new Promise(r=>setTimeout(r,100));
  if(!ready)throw Error('Three real display pages must be open and ready');
  const only=process.argv[2];
  const cases={reset:{type:'session-end'},start:{type:'session-start'},single:{type:'simulate',action:'toggle',slot_index:2},manual:{type:'manual-trigger',id:'light'},manualRepeat:{type:'manual-trigger',id:'light'},manualClear:{type:'manual-clear'},all:{type:'simulate',action:'all'},clear:{type:'simulate',action:'clear'}};
  for(const [name,send]of Object.entries(cases)){
    if(only&&only!==name)continue;
    const note=await adapter.send({id:name,send});
    result.push({name,note,displays:structuredClone(adapter.observed.displays)});
  }
  console.log(JSON.stringify(result,null,2));
  if(process.env.F_RESULT)await writeFile(process.env.F_RESULT,JSON.stringify(result,null,2));
}finally{adapter.stop();}
