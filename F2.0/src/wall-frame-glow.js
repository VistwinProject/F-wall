import * as THREE from 'three';
import {PARAMS} from './glow-reference/params.js';

// A single distance field makes intersections a union, not an accumulation.
// Composite after bloom so nearby beams cannot amplify the framework halo.
export function createWallFrameGlow(stage,width,height){
  const uniforms={
    size:{value:new THREE.Vector2(width,height)},
    frame:{value:new THREE.Vector4(130,50,1610,985)},
    radius:{value:31},halfWidth:{value:13.5},gain:{value:1},
    vertical:{value:new Float32Array(32)},horizontal:{value:new Float32Array(32)},
    nv:{value:0},nh:{value:0},minCore:{value:2},
    color:{value:new THREE.Vector3(...[0,2,4].map(i=>parseInt(PARAMS.color.line.slice(1+i,3+i),16)/255))},
  };
  const material=new THREE.ShaderMaterial({
    uniforms,transparent:true,depthTest:false,depthWrite:false,
    blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,
    blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,
    vertexShader:`varying vec2 uvPoint;
      void main(){uvPoint=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader:`precision highp float;
      varying vec2 uvPoint;
      uniform vec2 size;
      uniform vec4 frame;
      uniform float radius,halfWidth,gain,minCore;
      uniform float vertical[32],horizontal[32];
      uniform int nv,nh;
      uniform vec3 color;
      float segmentDistance(vec2 p,vec2 a,vec2 b){
        vec2 ab=b-a;float t=clamp(dot(p-a,ab)/max(dot(ab,ab),.0001),0.,1.);
        return length(p-a-t*ab);
      }
      float smoothUnion(float a,float b,float k){
        float h=max(k-abs(a-b),0.)/k;
        return min(a,b)-h*h*k*.25;
      }
      void main(){
        vec2 p=vec2(uvPoint.x,1.-uvPoint.y)*size;
        vec2 halfBox=frame.zw*.5;
        float r=min(radius,min(halfBox.x,halfBox.y));
        vec2 q=abs(p-frame.xy-halfBox)-halfBox+r;
        float d=abs(length(max(q,0.))+min(max(q.x,q.y),0.)-r);
        float glowDistance=d;
        float blendWidth=max(halfWidth*2.,1.);
        for(int i=0;i<32;i++){
          if(i<nv){
            float next=segmentDistance(p,vec2(vertical[i],frame.y),vec2(vertical[i],frame.y+frame.w));
            d=min(d,next);glowDistance=smoothUnion(glowDistance,next,blendWidth);
          }
          if(i<nh){
            float next=segmentDistance(p,vec2(frame.x,horizontal[i]),vec2(frame.x+frame.z,horizontal[i]));
            d=min(d,next);glowDistance=smoothUnion(glowDistance,next,blendWidth);
          }
        }
        float pixel=max(length(fwidth(p))*.7071,.001);
        float coreWidth=max(halfWidth/17.,minCore*pixel*.5);
        // A pixel-wide plateau prevents different subpixel alignments from
        // changing the peak intensity of horizontal and vertical lines.
        float core=exp(-max(0.,d-pixel*.5)/coreWidth);
        // Smooth only the halo union, removing diagonal max-blend seams.
        // Clamp the distance so junctions never exceed a single line's peak.
        float haloDistance=max(0.,glowDistance);
        float soft=exp(-haloDistance/max(halfWidth/2.2,.01));
        float halo=exp(-.5*pow(haloDistance/max(halfWidth*1.8,.01),2.));
        vec3 c=color*gain*(1.95*core+.3*soft+.16*halo);
        gl_FragColor=vec4(c,0.);
      }`,
  });
  const geometry=new THREE.PlaneGeometry(2,2),scene=new THREE.Scene(),camera=new THREE.Camera();
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;scene.add(mesh);
  return {
    set({frame,vlines,hlines,lineWidth,frameWidth,minCorePx}){
      uniforms.frame.value.set(...frame.slice(0,4));uniforms.radius.value=frame[4];
      uniforms.halfWidth.value=(frameWidth??lineWidth)*width*.5;uniforms.minCore.value=minCorePx;
      uniforms.vertical.value.fill(0);uniforms.horizontal.value.fill(0);
      uniforms.vertical.value.set(vlines.slice(0,32));uniforms.horizontal.value.set(hlines.slice(0,32));
      uniforms.nv.value=Math.min(vlines.length,32);uniforms.nh.value=Math.min(hlines.length,32);
    },
    render(time){
      if(uniforms.halfWidth.value<=0)return;
      uniforms.gain.value=PARAMS.line.on*(PARAMS.breathe.lo+(1-PARAMS.breathe.lo)*(.5+.5*Math.cos(time*Math.PI*2/3)));
      const renderer=stage.renderer,previous=renderer.autoClear;
      renderer.autoClear=false;renderer.render(scene,camera);renderer.autoClear=previous;
    },
    dispose(){geometry.dispose();material.dispose();},
  };
}
