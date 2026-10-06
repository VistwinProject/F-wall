import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
if(process.platform!=='darwin'||process.arch!=='arm64')throw Error('Build on the target Mac arm64 with working NFC dependencies.');
const name='F-Zone-Mac-arm64-Offline-2026-10-06';
const releases=path.resolve(root,'../releases');
await fs.mkdir(releases,{recursive:true});
const staging=await fs.mkdtemp(path.join(releases,'.f-build-'));
const output=path.join(staging,name);
await fs.mkdir(output);
for(const f of ['src','public','server','offline','node_modules','index.html','package.json','package-lock.json','Start-F.command','Stop-F.command','Mac離線安裝與實測.md','版本紀錄-2026-10-06.md']){
 await fs.cp(path.join(root,f),path.join(output,f),{recursive:true,filter:src=>!src.includes('uid-map.backup-')&&!src.endsWith('reader-map.json')});
}
await fs.mkdir(path.join(output,'runtime'),{recursive:true});
await fs.copyFile(process.execPath,path.join(output,'runtime/node'));
await fs.chmod(path.join(output,'runtime/node'),0o755);
await fs.copyFile(path.resolve(path.dirname(process.execPath),'../LICENSE'),path.join(output,'runtime/NODE-LICENSE'));
for(const f of ['Start-F.command','Stop-F.command'])await fs.chmod(path.join(output,f),0o755);
execFileSync(path.join(output,'runtime/node'),['-e',"require('nfc-pcsc');console.log('Bundled NFC module OK')"],{cwd:output,stdio:'inherit'});
const inventory=[];
async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const f=path.join(dir,entry.name);if(entry.isDirectory())await walk(f);else if(entry.isFile())inventory.push({file:path.relative(output,f),sha256:createHash('sha256').update(await fs.readFile(f)).digest('hex')});}}
await walk(output);await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({platform:process.platform,arch:process.arch,node:process.version,files:inventory},null,2));
const zip=path.join(releases,name+'.zip');await fs.rm(zip,{force:true});
execFileSync('/usr/bin/ditto',['-c','-k','--keepParent',output,zip]);
await fs.writeFile(zip+'.sha256',createHash('sha256').update(await fs.readFile(zip)).digest('hex')+'  '+path.basename(zip)+'\n');
await fs.cp(output,path.join(releases,name),{recursive:true});
await fs.rm(staging,{recursive:true,force:true});
console.log(zip);
