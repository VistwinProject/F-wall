import {createStage} from './glow-reference/stage.js';
import {createGlowLines,createGlowBeams} from './glow-reference/scene.js';
import {PARAMS} from './glow-reference/params.js';
import {createWallFrameGlow} from './wall-frame-glow.js';
import {createWallMaskGlow} from './wall-mask-glow.js';
import {Scene} from 'three';

// Adapter for the existing three-view geometry API. The reference shaders,
// ribbon, bloom stage, materials and parameters are retained without edits.
export class Glow {
  paths=new Map();idlePaths=new Map();disabled=false;visible=true;sequence=0;time=0;
  constructor(container,width,height){
    this.width=width;this.height=height;
    this.stableRidge=!container.classList.contains('wall-scene');
    if(new URLSearchParams(location.search).has('nofx')){this.disabled=true;return;}
    const canvas=document.createElement('canvas');canvas.className='glow-canvas';container.prepend(canvas);
    try{
      this.stage=createStage(canvas,width/height,{transparent:!container.classList.contains('wall-scene')});
      canvas.style.width='100%';canvas.style.height='100%';
      canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.disabled=true;cancelAnimationFrame(this.frame);canvas.hidden=true;});
      this.last=performance.now();this.animate=this.animate.bind(this);this.frame=requestAnimationFrame(this.animate);
      addEventListener('pagehide',()=>this.dispose(),{once:true});
    }catch(error){this.disabled=true;canvas.hidden=true;console.warn('Reference glow unavailable; SVG fallback retained.',error);}
  }
  setPaths(definitions){
    if(this.disabled)return;
    definitions=definitions.filter(d=>d.tuneWidth!==0);
    // Reference beam materials already include the base light. Do not draw
    // the old separate base ribbon a second time on top of the same beam.
    const beamRoutes=new Set(definitions.filter(d=>d.beam).map(d=>JSON.stringify(d.points)));
    const items=definitions.filter(d=>(!this.frameGlow||!(d.key==='frame'||/^[vh][\d.-]+$/.test(d.key)))&&(d.beam||!beamRoutes.has(JSON.stringify(d.points))));
    const keys=new Set(items.map(d=>d.key));
    for(const[key,item]of this.paths)if(!keys.has(key))item.target=0;
    for(const def of items){
      const signature=JSON.stringify([def.points,!!def.beam,def.tuneWidth,def.minCorePx]);
      const old=this.paths.get(def.key)||this.idlePaths.get(def.key);
      if(old?.signature===signature){
        old.target=1;
        if(this.idlePaths.delete(def.key)){
          this.paths.set(def.key,old);
          this.stage.scene.add(old.beam?old.beam.mesh:old.lines.group);
        }
        continue;
      }
      const on=old?.on||0,progress=old?.progress||0;
      if(old)this.disposePath(def.key);
      const world=this.stage.world;
      const pts=def.points.map(([x,y])=>({x:x/this.width*world.w,y:y/this.height*world.h}));
      const first=pts[0],last=pts.at(-1);
      const closed=!def.beam&&pts.length>2&&Math.hypot(first.x-last.x,first.y-last.y)<.01;
      if(closed)pts.pop();
      const spec={id:def.key,pts,closed,width:def.tuneWidth,minCorePx:def.minCorePx??(def.beam?2: def.key.startsWith('relation-')?2.5:1)};
      spec.wallRoute=!this.stableRidge&&(/^(route-|packet-)/.test(def.key)||def.key==='core');
      const item={signature,target:1,on,progress,period:def.period||PARAMS.breathe.period};
      if(def.beam){
        item.beam=createGlowBeams(world.w,[spec])[0];
        if(!this.stableRidge&&def.key.startsWith('packet-')){
          const uniforms=item.beam.mat.uniforms;
          uniforms.uTail.value.set(.008,.12,1);
          uniforms.uBody.value.set(.015,.32,1);
          uniforms.uHead.value.set(.08,.58,1);
        }
        if(this.stableRidge)item.beam.mat.defines={...item.beam.mat.defines,STABLE_RIDGE:1};
        item.beam.mat.uniforms.uPhase.value=(this.sequence++*.37)%1;
        this.stage.scene.add(item.beam.mesh);
      }else{
        item.lines=!this.stableRidge&&(def.key==='core'||def.key.startsWith('frame-'))
          ?createWallMaskGlow(world.w,spec)
          :createGlowLines(world.w,[spec]);
        if(!this.stableRidge&&def.key.startsWith('route-'))item.lines.group.traverse(o=>{
          if(o.material?.uniforms.uColor)o.material.uniforms.uColor.value.set(.008,.12,1);
        });
        if(this.stableRidge)item.lines.group.traverse(o=>{if(o.material)o.material.defines={...o.material.defines,STABLE_RIDGE:1};});
        this.stage.scene.add(item.lines.group);
      }
      this.paths.set(def.key,item);
    }
  }
  animate(now){
    if(this.disabled)return;
    if(!this.visible||document.hidden){this.last=now;this.frame=requestAnimationFrame(this.animate);return;}
    const dt=Math.min(.05,(now-this.last)/1000);this.last=now;this.time+=dt;
    const wave=period=>PARAMS.breathe.lo+(1-PARAMS.breathe.lo)*(.5+.5*Math.cos(this.time*2*Math.PI/period));
    for(const[key,item]of this.paths){
      item.on+=(item.target-item.on)*Math.min(1,dt*6);
      if(Math.abs(item.target-item.on)<.02)item.on=item.target;
      if(!item.target&&!item.on){this.parkPath(key);continue;}
      if(item.beam){
        const b=item.beam;
        item.progress=item.target?Math.min(1,item.progress+dt/b.drawSec):0;
        b.mat.uniforms.uTime.value=this.time;b.mat.uniforms.uOn.value=item.on;
        b.mat.uniforms.uProgress.value=item.progress;b.mat.uniforms.uBreathe.value=wave(PARAMS.breathe.period);
      }else item.lines.gains[key](PARAMS.line.idle+(PARAMS.line.on*wave(item.period)-PARAMS.line.idle)*item.on);
    }
    this.stage.render();this.frameGlow?.render(this.time);this.frame=requestAnimationFrame(this.animate);
  }
  setFrame(tune){
    if(this.disabled)return;
    this.frameGlow??=createWallFrameGlow(this.stage,this.width,this.height);
    this.frameGlow.set(tune);
  }
  prewarm(tune){
    if(this.disabled||this.warmupStarted)return;
    this.warmupStarted=true;
    const run=()=>{
      if(this.disabled)return;
      const world=this.stage.world,scene=new Scene();
      const spec={id:'warmup',pts:[{x:10,y:10},{x:110,y:10}],closed:false,minCorePx:tune.minCorePx,wallRoute:!this.stableRidge};
      const lines=createGlowLines(world.w,[{...spec,width:tune.lineWidth||.001}]);
      const beam=createGlowBeams(world.w,[{...spec,width:tune.beamWidth||.001}])[0];
      if(this.stableRidge){
        lines.group.traverse(o=>{if(o.material)o.material.defines={...o.material.defines,STABLE_RIDGE:1};});
        beam.mat.defines={...beam.mat.defines,STABLE_RIDGE:1};
      }
      scene.add(lines.group,beam.mesh);
      this.warmupResources={scene,lines,beam};
      this.stage.renderer.compileAsync(scene,this.stage.camera).catch(error=>{
        if(!this.disabled)console.warn('Glow warmup skipped:',error);
      });
    };
    this.warmupTimer=setTimeout(run,150);
  }
  parkPath(key){
    const item=this.paths.get(key);if(!item)return;
    this.stage.scene.remove(item.beam?item.beam.mesh:item.lines.group);
    item.progress=0;this.paths.delete(key);this.idlePaths.set(key,item);
    // Retain resources for repeated NFC scans without unbounded growth.
    if(this.idlePaths.size>64)this.disposePath(this.idlePaths.keys().next().value);
  }
  disposePath(key){
    const item=this.paths.get(key)||this.idlePaths.get(key);if(!item)return;
    if(item.beam){this.stage.scene.remove(item.beam.mesh);item.beam.mesh.geometry.dispose();item.beam.mat.dispose();}
    if(item.lines){
      this.stage.scene.remove(item.lines.group);const geometries=new Set();
      item.lines.group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);o.material?.dispose();});
      for(const geometry of geometries)geometry.dispose();
    }
    this.paths.delete(key);this.idlePaths.delete(key);
  }
  dispose(){
    this.disabled=true;cancelAnimationFrame(this.frame);clearTimeout(this.warmupTimer);
    for(const key of [...this.paths.keys(),...this.idlePaths.keys()])this.disposePath(key);
    if(this.warmupResources){
      const {lines,beam}=this.warmupResources,geometries=new Set();
      lines.group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);o.material?.dispose();});
      for(const geometry of geometries)geometry.dispose();
      beam.mesh.geometry.dispose();beam.mat.dispose();this.warmupResources=null;
    }
    this.frameGlow?.dispose();this.stage?.dispose();
  }
}
