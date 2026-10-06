import * as THREE from 'three';

// Explicit center vertices keep aSide=0 on the path, rather than allowing
// interpolation across a diagonally split quad to displace the light core.
export function wallRouteRibbon(points,width,closed=false){
  const base=points.filter((p,i)=>!i||p.x!==points[i-1].x||p.y!==points[i-1].y);
  if(closed&&base.length>1&&base[0].x===base.at(-1).x&&base[0].y===base.at(-1).y)base.pop();
  const pts=closed&&base.length?[...base,base[0]]:base;
  const n=pts.length,half=width/2,acc=new Float32Array(n),normals=[];
  for(let i=1;i<n;i++){
    const dx=pts[i].x-pts[i-1].x,dy=pts[i].y-pts[i-1].y;
    const length=Math.hypot(dx,dy);
    acc[i]=acc[i-1]+length;
    normals.push({x:-dy/length,y:dx/length});
  }
  const total=acc[n-1]||1;
  const pos=new Float32Array(n*9),side=new Float32Array(n*3),time=new Float32Array(n*3),indices=[];
  for(let i=0;i<n;i++){
    const seam=closed&&(i===0||i===n-1);
    const before=(seam?normals.at(-1):normals[Math.max(0,i-1)])||{x:0,y:1};
    const after=(seam?normals[0]:normals[Math.min(normals.length-1,i)])||before;
    let mx=before.x+after.x,my=before.y+after.y;
    const length=Math.hypot(mx,my);
    if(length<.0001){mx=after.x;my=after.y;}else{mx/=length;my/=length;}
    const reach=half/Math.max(.25,mx*after.x+my*after.y);
    for(let j=0;j<3;j++){
      const sign=j-1,index=i*3+j;
      pos[index*3]=pts[i].x+mx*reach*sign;
      pos[index*3+1]=pts[i].y+my*reach*sign;
      side[index]=sign;time[index]=acc[i]/total;
    }
    if(i<n-1)for(let j=0;j<2;j++){
      const a=i*3+j,b=a+3;
      indices.push(a,b,a+1,a+1,b,b+1);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(pos,3));
  geometry.setAttribute('aSide',new THREE.BufferAttribute(side,1));
  geometry.setAttribute('aT',new THREE.BufferAttribute(time,1));
  geometry.setIndex(indices);geometry.userData.length=total;
  return geometry;
}
