export const line=(...points)=>points;
export function ring(x,y,r,count=128){return Array.from({length:count+1},(_,i)=>{const a=i/count*Math.PI*2;return[x+Math.cos(a)*r,y+Math.sin(a)*r];});}
export function rounded(points,radius=20){
  if(points.length<3)return points;
  const out=[points[0]];
  for(let i=1;i<points.length-1;i++){
    const a=points[i-1],b=points[i],c=points[i+1];
    const before=Math.hypot(b[0]-a[0],b[1]-a[1]),after=Math.hypot(c[0]-b[0],c[1]-b[1]);
    if(!before||!after)continue;
    const r=Math.min(radius,before/2,after/2);
    const p=[b[0]+(a[0]-b[0])*r/before,b[1]+(a[1]-b[1])*r/before];
    const q=[b[0]+(c[0]-b[0])*r/after,b[1]+(c[1]-b[1])*r/after];
    out.push(p);
    for(let j=1;j<=10;j++){const t=j/10,s=1-t;out.push([s*s*p[0]+2*s*t*b[0]+t*t*q[0],s*s*p[1]+2*s*t*b[1]+t*t*q[1]]);}
  }
  out.push(points.at(-1));return out;
}
export function rect(x,y,w,h,r=6){
  const p=[];
  for(const [cx,cy,start]of [[x+w-r,y+r,-90],[x+w-r,y+h-r,0],[x+r,y+h-r,90],[x+r,y+r,180]])
    for(let i=0;i<=12;i++){const a=(start+i*90/12)*Math.PI/180;p.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}
  p.push(p[0]);return p;
}
export function between(a,b,startRadius=0,endRadius=0){
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1;
  return [[a[0]+dx*startRadius/length,a[1]+dy*startRadius/length],[b[0]-dx*endRadius/length,b[1]-dy*endRadius/length]];
}
// SVG wires and animated lights share routes derived from the editable grid.
export const WALL_ROUTES={};
export function wallRoutes({vlines:v,hlines:h,blocks:b}){
  const [upper,middle,lower,bottom]=h;
  const [sensorX,hrvX,leftX,socketX,,rightX,acX,bathX]=v;
  const [hubX]=b.hub;
  // Start on the framework inside each appliance mask, never at an
  // off-grid appliance center. Every visible segment stays on a grid rail.
  const vertical=(id,x)=>[[x,b[id][1]]];
  const routes={
    hrv:[...vertical('hrv',hrvX),[hrvX,upper],[leftX,upper],[leftX,middle]],
    ac:[...vertical('ac',acX),[acX,upper],[rightX,upper],[rightX,middle]],
    dehum:[[b.dehum[0],middle]],
    purifier:[[b.purifier[0],middle]],
    sensor:[...vertical('sensor',sensorX),[sensorX,lower],[leftX,lower],[leftX,middle]],
    light:[...vertical('light',leftX),[leftX,middle]],
    socket:[[b.socket[0],bottom],[socketX,bottom],[socketX,middle]],
    curtain:[...vertical('curtain',rightX),[rightX,middle]],
    bathfan:[...vertical('bathfan',bathX),[bathX,lower],[rightX,lower],[rightX,middle]],
  };
  return Object.fromEntries(Object.entries(routes).map(([id,points])=>{
    points.push([hubX,middle]);
    return [id,points.filter((p,i)=>!i||p[0]!==points[i-1][0]||p[1]!==points[i-1][1])];
  }));
}
export const svgPoints=points=>points.map(p=>p.join(',')).join(' ');
