import {DEVICES} from './devices.js';
export const WARP_DEVICES=[...DEVICES.map(device=>device.id),'hub','screen'];
export const identityQuad=()=>[[0,0],[1,0],[1,1],[0,1]];
// A convex quad prevents folded or inverted projection masks.
export function validQuad(q){
 return Array.isArray(q)&&q.length===4&&q.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<=4))&&q.every((a,i)=>{
  const b=q[(i+1)%4],c=q[(i+2)%4];
  return (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])>.002;
 });
}
// Projective mapping shared by sampled SVG contours and live HTML/SVG content.
export function quadProjection(q){
 const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]=q;
 const dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3;
 const dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3;
 const det=dx1*dy2-dx2*dy1;
 const g=(dx3*dy2-dx2*dy3)/det,h=(dx1*dy3-dx3*dy1)/det;
 return [x1-x0+g*x1,x3-x0+h*x3,x0,y1-y0+g*y1,y3-y0+h*y3,y0,g,h];
}
export function warpPoint([u,v],q){
 const [a,b,c,d,e,f,g,h]=quadProjection(q),den=g*u+h*v+1;
 return [(a*u+b*v+c)/den,(d*u+e*v+f)/den];
}
export function quadCssMatrix(q,w,height){
 const [a,b,c,d,e,f,g,h]=quadProjection(q);
 return `matrix3d(${[a,height*d/w,0,g/w,w*b/height,e,0,h/height,0,0,1,0,w*c,height*f,0,1].join(',')})`;
}
