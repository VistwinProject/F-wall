import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEVICES} from '../src/devices.js';
import {AUDIO_CAPTIONS} from '../src/audio-captions.js';
import {WALL_PANEL_CONTENT} from '../src/panel-content.js';
import {REPORT_TYPES,DEVICE_REPORT} from '../src/table-reports.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFile(path.join(root,p),'utf8');
const seen=new Set();
async function visit(file){
  if(seen.has(file))return;
  seen.add(file);
  const source=await readFile(file,'utf8');
  for(const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|^import\s*)['"]([^'"]+)['"]/gm)){
    const spec=match[1];let next;
    if(spec.startsWith('.'))next=path.resolve(path.dirname(file),spec);
    else if(spec.startsWith('/'))next=path.join(root,spec.startsWith('/src/')?'':'public',spec);
    else if(spec==='three')next=path.join(root,'node_modules/three/build/three.module.js');
    else if(spec.startsWith('three/examples/jsm/'))next=path.join(root,'node_modules',spec);
    if(next)await visit(next);
  }
}
await visit(path.join(root,'src/app.js'));
const html=await read('index.html');
for(const [,url] of html.matchAll(/(?:src|href)="(\/[^"?]+)(?:\?[^" ]*)?"/g))await access(path.join(root,url));
for(const f of ['package-lock.json','server/index.mjs','server/uid-map.json','Install-F.cmd','Start-F.cmd','windows/install.ps1','windows/launch.ps1','windows/display.ps1','public/floorplan-lineart-v2.png','public/backgrounds/exhibition-arcs.svg'])await access(path.join(root,f));
for(const d of DEVICES){
  for(const key of ['value','unit','month','target','delta','rows','maintenance'])assert.ok(!(key in d),`${d.id}: unused legacy ${key}`);
  await access(path.join(root,`public/appliances/${d.id}.webp`));
}
function duration(wav){
  assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.toString('ascii',8,12),'WAVE');
  let rate=0,size=0;
  for(let offset=12;offset+8<=wav.length;){
    const tag=wav.toString('ascii',offset,offset+4),length=wav.readUInt32LE(offset+4);
    if(tag==='fmt ')rate=wav.readUInt32LE(offset+16);
    if(tag==='data')size=length;
    offset+=8+length+(length%2);
  }
  assert.ok(rate&&size);return size/rate;
}
for(const key of ['intro','completion',...DEVICES.map(d=>d.id)]){
  const file=key==='intro'||key==='completion'?`public/f-${key}.wav`:`public/device-audio/${key}.wav`;
  const seconds=duration(await readFile(path.join(root,file))),track=AUDIO_CAPTIONS[key];
  assert.ok(track?.cues.length,`${key}: captions missing`);
  assert.ok(Math.abs(track.duration-seconds)<.06,`${key}: duration mismatch`);
  let end=0;
  for(const cue of track.cues){assert.ok(cue.start>=end&&cue.end>cue.start&&cue.end<=seconds+.06&&cue.text,`${key}: invalid cue`);end=cue.end;}
}
assert.equal(WALL_PANEL_CONTENT.ac.rows.find(r=>r[0]==='下次維養')[1],'2026/10月');
assert.ok(AUDIO_CAPTIONS.purifier.text.includes('63%'));
for(const report of REPORT_TYPES)await access(path.join(root,'public',report.video));
for(const d of DEVICES)assert.ok(REPORT_TYPES.some(report=>report.id===DEVICE_REPORT[d.id]),`${d.id}: report missing`);
console.log(`PASS: ${seen.size} runtime modules, required assets, 11 WAV/caption timelines, clean device metadata and latest display values.`);
console.log('Packaging: use src/public/server/windows + index.html/package*.json/*.cmd; exclude node_modules, dist, reference archives and machine-specific windows/settings.json.');
