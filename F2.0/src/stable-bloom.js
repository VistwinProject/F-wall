import * as THREE from 'three';

// Preserve the reference Bloom pipeline, but extract only its halo from a
// stable source. Composite that halo with a separately rendered live source.
export function createStableBloom(stage){
 const {renderer,composer,scene,camera}=stage;
 const size=renderer.getDrawingBufferSize(new THREE.Vector2());
 const target=()=>{const t=new THREE.WebGLRenderTarget(size.x,size.y,{type:THREE.HalfFloatType,depthBuffer:false,stencilBuffer:false});t.texture.colorSpace=THREE.LinearSRGBColorSpace;return t;};
 const baseline=target(),dynamic=target();
 const material=new THREE.ShaderMaterial({
  depthTest:false,depthWrite:false,
  uniforms:{stable:{value:null},baseline:{value:baseline.texture},dynamic:{value:dynamic.texture}},
  vertexShader:'varying vec2 uvPoint;void main(){uvPoint=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`precision highp float;varying vec2 uvPoint;
   uniform sampler2D stable,baseline,dynamic;
   void main(){
    vec3 halo=max(texture2D(stable,uvPoint).rgb-texture2D(baseline,uvPoint).rgb,vec3(0.));
    vec3 light=texture2D(dynamic,uvPoint).rgb+halo;
    gl_FragColor=vec4(light,clamp(max(light.r,max(light.g,light.b)),0.,1.));
   }`,
 });
 const geometry=new THREE.PlaneGeometry(2,2),output=new THREE.Scene(),outputCamera=new THREE.Camera();
 const quad=new THREE.Mesh(geometry,material);quad.frustumCulled=false;output.add(quad);
 return {
  render(makeStable,restore){
   const previousTarget=renderer.getRenderTarget(),screen=composer.renderToScreen;
   try{
    makeStable();
    renderer.setRenderTarget(baseline);renderer.clear();renderer.render(scene,camera);
    composer.renderToScreen=false;composer.render();
    material.uniforms.stable.value=composer.readBuffer.texture;
    restore();
    renderer.setRenderTarget(dynamic);renderer.clear();renderer.render(scene,camera);
    renderer.setRenderTarget(previousTarget);renderer.render(output,outputCamera);
   }finally{restore();composer.renderToScreen=screen;renderer.setRenderTarget(previousTarget);}
  },
  dispose(){baseline.dispose();dynamic.dispose();geometry.dispose();material.dispose();},
 };
}
