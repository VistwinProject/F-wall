import {identityQuad,validQuad,warpPoint,quadCssMatrix} from './wall-warp.js';
// Hand-drawn, normalized silhouettes. No pixel tracing or small surface details.
const profiles={
 hrv:{aspect:519/289,paths:['M 5 1 H 95 Q 99 1 99 8 V 92 Q 99 99 95 99 H 5 Q 1 99 1 92 V 8 Q 1 1 5 1 Z']},
 ac:{aspect:546/221,paths:['M 4 1 Q 1 1 1 8 L 1 80 Q 1 94 4 99 L 96 99 Q 99 95 99 81 L 99 8 Q 99 1 96 1 Z']},
 dehum:{aspect:313/572,paths:['M 9 0 Q 0 0 0 5 L 0 96 Q 0 100 8 100 L 92 100 Q 100 100 100 96 L 100 5 Q 100 0 91 0 Z']},
 purifier:{aspect:205/651,paths:['M 50 0 C 27 0 12 5 12 13 L 12 45 Q 12 50 7 54 L 0 58 L 0 98 Q 0 100 5 100 L 95 100 Q 100 100 100 98 L 100 58 L 93 54 Q 88 50 88 45 L 88 13 C 88 5 73 0 50 0 Z']},
 sensor:{aspect:396/174,paths:['M 13 0 Q 0 0 0 25 L 0 74 Q 0 100 13 100 L 85 100 Q 100 100 100 69 L 100 31 Q 100 0 85 0 Z']},
 light:{aspect:196/343,paths:['M 50 0 C 20 0 0 12 0 29 Q 0 39 10 47 Q 22 62 24 76 L 26 81 L 31 82 L 32 91 Q 33 96 43 98 L 43 100 L 58 100 L 58 98 Q 68 96 69 91 L 70 82 L 75 81 L 77 76 Q 79 62 91 47 Q 100 39 100 29 C 100 12 80 0 50 0 Z']},
 socket:{aspect:414/203,paths:['M 2 0 H 98 Q 100 0 100 4 V 96 Q 100 100 98 100 H 2 Q 0 100 0 96 V 4 Q 0 0 2 0 Z']},
 curtain:{aspect:315/326,paths:['M 6 0 Q 0 0 0 6 L 0 95 Q 0 100 5 100 L 95 100 Q 100 100 100 95 L 100 6 Q 100 0 94 0 Z']},
 bathfan:{aspect:343/311,paths:['M 7 0 Q 0 0 0 7 L 0 93 Q 0 100 7 100 L 93 100 Q 100 100 100 93 L 100 7 Q 100 0 93 0 Z']},
};
const samples=new Map();
const MASK_OFFSET=4;
function expandContour(points){
 const vertices=points.slice(0,-1),n=vertices.length;
 const area=vertices.reduce((sum,p,i)=>{const q=vertices[(i+1)%n];return sum+p[0]*q[1]-q[0]*p[1];},0);
 const sign=area>=0?1:-1;
 const normal=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;return [sign*dy/len,-sign*dx/len];};
 const expanded=vertices.map((p,i)=>{
  const a=normal(vertices[(i+n-1)%n],p),b=normal(p,vertices[(i+1)%n]);
  const divisor=Math.max(.5,1+a[0]*b[0]+a[1]*b[1]);
  return [p[0]+MASK_OFFSET*(a[0]+b[0])/divisor,p[1]+MASK_OFFSET*(a[1]+b[1])/divisor];
 });
 return [...expanded,expanded[0]];
}
export function wallSilhouette(device,tune,layer='maskQuads'){
 if(device.id==='hub'||device.id==='screen'){
  const [cx,cy,w,h]=tune.blocks[device.id],x=cx-w/2,y=cy-h/2;
  const raw=tune.maskQuads?.[device.id],quad=validQuad(raw)?raw:identityQuad();
  const corners=quad.map(([u,v])=>[x+u*w,y+v*h]);
  return {x,y,w,h,corners,contours:[[...corners,corners[0]]],path:'M '+corners.map(p=>p.join(' ')).join(' L ')+' Z',transform:''};
 }
 const profile=profiles[device.id],setting=tune.images?.[device.id],scale=setting?.scale??1;
 const [cx,cy,bw,bh]=device.box,availableW=Math.max(1,bw-16),availableH=Math.max(1,bh-16);
 let w=Math.min(availableW,availableH*profile.aspect)*scale,h=w/profile.aspect;
 const x=cx-w/2,y=cy-h/2;
 if(!samples.has(device.id))samples.set(device.id,profile.paths.map(d=>{
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);
  const length=path.getTotalLength();return Array.from({length:161},(_,i)=>{const p=path.getPointAtLength(length*i/160);return [p.x,p.y];});
 }));
 const raw=tune[layer]?.[device.id],quad=validQuad(raw)?raw:identityQuad();
 const corners=quad.map(([u,v])=>[x+u*w,y+v*h]);
 const sourceContours=samples.get(device.id).map(points=>expandContour(points.map(p=>[p[0]*w/100,p[1]*h/100])));
 const contours=sourceContours.map(points=>points.map(p=>{
  const [u,v]=warpPoint([p[0]/w,p[1]/h],quad);return [x+u*w,y+v*h];
 }));
 return {x,y,w,h,corners,sourceContours,cssTransform:quadCssMatrix(quad,w,h),path:contours.map(points=>'M '+points.map(p=>p.join(' ')).join(' L ')+' Z').join(' '),transform:'',contours};
}
