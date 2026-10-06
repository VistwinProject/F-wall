import test from 'node:test';
import assert from 'node:assert/strict';
import {OrthographicCamera,Vector3} from 'three';
import {Glow} from '../src/glow.js';

test('extended Table glow viewport preserves positions beyond the old right edge',()=>{
  const camera=new OrthographicCamera(0,1600,0,1600/1.92,-1000,1000);
  camera.position.z=10;
  let resizes=0;
  const glow=Object.assign(Object.create(Glow.prototype),{
    width:1920,height:1000,canvas:{style:{}},
    stage:{camera,world:{w:1600,h:1600/1.92},renderer:{setSize(){resizes++;}},composer:{setSize(){}}}
  });
  const width=1390/600*1000,height=1000,offsetX=140,offsetY=-40;
  glow.setViewportOffset(offsetX,offsetY,{width,height});
  for(const [x,y] of [[0,0],[1850,740],[1920,1000]]){
    const point=new Vector3(x/1920*1600,y/1000*(1600/1.92),0).project(camera);
    const pixelX=(point.x+1)/2*width,pixelY=(1-point.y)/2*height;
    assert.ok(Math.abs(pixelX-(x+offsetX+(width-1920)/2))<1e-8);
    assert.ok(Math.abs(pixelY-(y+offsetY))<1e-8);
    if(x===1850)assert.ok(point.x<1,'rightmost NFC remains inside the extended light canvas');
  }
  glow.setViewportOffset(160,-30,{width,height});
  assert.equal(resizes,1,'dragging does not reallocate unchanged render buffers');
  assert.equal(glow.canvas.style.width,width+'px');
});
