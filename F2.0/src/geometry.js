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
// Paths avoid the fixed television mask and enter the physical core perpendicularly.
export const WALL_ROUTES={
  hrv:rounded([[470,170],[650,170],[650,416],[955,416],[955,550]]),
  ac:rounded([[1440,170],[1325,170],[1325,416],[955,416],[955,550]]),
  dehum:[[460,540],[955,540]],
  purifier:[[1425,550],[955,550]],
  sensor:rounded([[310,900],[310,712],[740,712],[740,644],[955,644],[955,550]]),
  light:rounded([[625,885],[760,885],[760,740],[890,740],[890,550],[955,550]]),
  socket:[[960,900],[960,550]],
  curtain:rounded([[1290,900],[1115,900],[1115,750],[1045,750],[1045,550],[955,550]]),
  bathfan:rounded([[1600,900],[1600,764],[1170,764],[1170,644],[955,644],[955,550]]),
};
export const svgPoints=points=>points.map(p=>p.join(',')).join(' ');
