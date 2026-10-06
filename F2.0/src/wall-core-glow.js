import * as THREE from 'three';
import {col} from './glow-reference/stage.js';
import {PARAMS} from './glow-reference/params.js';

// Evaluate the mask contour directly, without interpolated ribbon offsets.
export function createWallCoreGlow(worldW, spec){
  const xs=spec.pts.map(p=>p.x),ys=spec.pts.map(p=>p.y);
  const left=Math.min(...xs),right=Math.max(...xs);
  const top=Math.min(...ys),bottom=Math.max(...ys);
  const width=right-left,height=bottom-top;
  const radius=Math.min(Math.max(0,right-spec.pts[0].x),width/2,height/2);
  const halfWidth=Math.max((spec.width??PARAMS.line.width)*worldW/2,.001);
  const geometry=new THREE.PlaneGeometry(width+halfWidth*2+4,height+halfWidth*2+4);
  const group=new THREE.Group();
  const materials=['halo','core'].map((kind,index)=>{
    const halo=kind==='halo';
    const material=new THREE.ShaderMaterial({
      vertexShader:`
        varying vec2 localPoint;
        void main(){
          localPoint=position.xy;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
        }
      `,
      fragmentShader:`
        varying vec2 localPoint;
        uniform vec2 halfBox;
        uniform float radius, halfWidth, minCorePx, sharp, amp, gain;
        uniform vec3 color;
        void main(){
          vec2 q=abs(localPoint)-halfBox+radius;
          float signedDistance=length(max(q,0.0))+min(max(q.x,q.y),0.0)-radius;
          float side=signedDistance/halfWidth;
          // Match the appliance LINE_FRAG power profile and pixel-width
          // brightness compensation, retaining the exact mask contour.
          float footprint=max(fwidth(side),0.00001);
          float s1=min(sharp,1.386/footprint);
          float s=min(sharp,1.386/(minCorePx*footprint));
          float crossSection=max(0.0,1.0-abs(side));
          float ridge=pow(crossSection,s)*(s1/sharp);
          vec3 light=color*amp*gain*ridge;
          gl_FragColor=vec4(light,clamp(max(light.r,max(light.g,light.b)),0.0,1.0));
        }
      `,
      uniforms:{
        halfBox:{value:new THREE.Vector2(width/2,height/2)},
        radius:{value:radius},halfWidth:{value:halfWidth},
        minCorePx:{value:spec.minCorePx??1},
        color:{value:col(PARAMS.color.line)},
        sharp:{value:halo?PARAMS.line.softSharp:PARAMS.line.coreSharp},
        amp:{value:halo?PARAMS.line.soft:PARAMS.line.core},
        gain:{value:PARAMS.line.idle},
      },
      transparent:true,side:THREE.DoubleSide,depthWrite:false,depthTest:false,
      blending:THREE.CustomBlending,
      blendEquation:halo?THREE.AddEquation:THREE.MaxEquation,
      blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,
    });
    const mesh=new THREE.Mesh(geometry,material);
    mesh.position.set((left+right)/2,(top+bottom)/2,0);
    mesh.frustumCulled=false;mesh.renderOrder=index;group.add(mesh);
    return material;
  });
  return {group,gains:{[spec.id]:value=>{
    for(const material of materials)material.uniforms.gain.value=value;
  }}};
}
