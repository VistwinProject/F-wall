import * as THREE from 'three';
import {col} from './glow-reference/stage.js';
import {PARAMS} from './glow-reference/params.js';

// Bake only when mask geometry changes. Both layers expand from the same
// polygon used by the black SVG mask, not from a separately offset ribbon.
export function createWallMaskGlow(worldW,spec){
  const halfWidth=Math.max((spec.width??PARAMS.line.width)*worldW/2,.001);
  const padding=halfWidth+2;
  const xs=spec.pts.map(p=>p.x),ys=spec.pts.map(p=>p.y);
  const left=Math.min(...xs)-padding,top=Math.min(...ys)-padding;
  const width=Math.max(...xs)-left+padding,height=Math.max(...ys)-top+padding;
  const geometry=new THREE.PlaneGeometry(width,height);
  const group=new THREE.Group();
  const path=new Path2D();
  spec.pts.forEach((p,i)=>i?path.lineTo(p.x-left,p.y-top):path.moveTo(p.x-left,p.y-top));
  path.closePath();
  const materials=['halo','core'].map((kind,index)=>{
    const halo=kind==='halo',sharp=halo?PARAMS.line.softSharp:PARAMS.line.coreSharp;
    const s1=Math.min(sharp,1.386*halfWidth);
    const exponent=Math.min(sharp,1.386*halfWidth/(spec.minCorePx??1));
    const canvas=document.createElement('canvas');
    canvas.width=Math.ceil(width*2);canvas.height=Math.ceil(height*2);
    const context=canvas.getContext('2d');
    context.scale(canvas.width/width,canvas.height/height);
    context.fillStyle='#000';context.fillRect(0,0,width,height);
    context.lineJoin='round';context.lineCap='round';
    // Concentric strokes approximate the existing power falloff. Subpixel
    // rasterization supplies coverage without diagonal triangle seams.
    for(let i=96;i>=1;i--){
      const distance=halfWidth*i/96;
      const value=Math.round(255*Math.pow(1-(i-.5)/96,exponent));
      context.strokeStyle=`rgb(${value},${value},${value})`;
      context.lineWidth=distance*2;context.stroke(path);
    }
    // The edge is the origin of the light; no inward light band is emitted.
    context.fillStyle='#000';context.fill(path);
    const texture=new THREE.CanvasTexture(canvas);
    texture.generateMipmaps=false;
    texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;
    const material=new THREE.ShaderMaterial({
      vertexShader:`varying vec2 maskUv;
        void main(){maskUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`varying vec2 maskUv;
        uniform sampler2D profile;
        uniform vec3 color;
        uniform float amp,gain;
        void main(){
          vec3 light=color*amp*gain*texture2D(profile,maskUv).r;
          gl_FragColor=vec4(light,clamp(max(light.r,max(light.g,light.b)),0.0,1.0));
        }`,
      uniforms:{profile:{value:texture},color:{value:col(PARAMS.color.line)},
        amp:{value:(halo?PARAMS.line.soft:PARAMS.line.core)*s1/sharp},
        gain:{value:PARAMS.line.idle}},
      transparent:true,side:THREE.DoubleSide,depthWrite:false,depthTest:false,
      blending:THREE.CustomBlending,
      blendEquation:halo?THREE.AddEquation:THREE.MaxEquation,
      blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,
    });
    material.addEventListener('dispose',()=>texture.dispose());
    const mesh=new THREE.Mesh(geometry,material);
    mesh.position.set(left+width/2,top+height/2,0);
    mesh.scale.y=-1;
    mesh.frustumCulled=false;mesh.renderOrder=index;group.add(mesh);
    return material;
  });
  return {group,gains:{[spec.id]:value=>{
    for(const material of materials)material.uniforms.gain.value=value;
  }}};
}
