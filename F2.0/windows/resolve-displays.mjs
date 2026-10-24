import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export function resolveDisplays(displays,settings={}){
  if(displays.length<3)throw Error('Connect Wall, Table and Graph in Windows Extend mode.');
  const byRole={},used=new Set();
  for(const role of ['wall','table','graph']){
    const identity=settings.displayBindings?.[role];
    if(!identity)continue;
    const matches=displays.filter(d=>d.Identity===identity);
    if(matches.length>1)throw Error(`Duplicate ${role} device identity. Run Install-F.cmd to bind displays.`);
    if(matches.length===1){
      if(used.has(matches[0].DeviceName))throw Error('Wall, Table and Graph must be different displays.');
      byRole[role]=matches[0];used.add(matches[0].DeviceName);
    }
  }
  for(const role of ['wall','table']){
    if(byRole[role])continue;
    const matches=displays.filter(d=>!used.has(d.DeviceName)&&(role==='wall'
      ? /acer/i.test(d.FriendlyName||'')||/^ACR$/i.test(d.Manufacturer||'')
      : /jmgo|坚果|堅果/i.test(d.FriendlyName||'')));
    if(matches.length!==1)throw Error(`Cannot uniquely identify ${role==='wall'?'Acer Wall':'JMGO Table'}. Run Install-F.cmd once to bind the correct device.`);
    byRole[role]=matches[0];used.add(matches[0].DeviceName);
  }
  if(!byRole.graph){
    const rest=displays.filter(d=>!used.has(d.DeviceName));
    if(rest.length!==1)throw Error('Graph TV is ambiguous. Run Install-F.cmd once to select it.');
    byRole.graph=rest[0];
  }
  if(new Set(Object.values(byRole).map(d=>d.DeviceName)).size!==3)throw Error('Wall, Table and Graph must be different displays.');
  if(Object.values(byRole).some(d=>!d.Identity))throw Error('Display identity unavailable; check HDMI/EDID and try again.');
  return Object.fromEntries(Object.entries(byRole).map(([role,d])=>[role,{deviceName:d.DeviceName,identity:d.Identity,name:d.FriendlyName}]));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const input=JSON.parse(readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,''));
    console.log(JSON.stringify({ok:true,roles:resolveDisplays(input.displays,input.settings)}));
  }catch(error){console.log(JSON.stringify({ok:false,error:error.message}));process.exitCode=1;}
}
