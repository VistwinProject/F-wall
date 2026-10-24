import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
const runtime=path.resolve(process.argv[2]||'');
if(!process.argv[2])throw Error('Usage: node scripts/package-windows.mjs <verified Windows runtime artifact>');
const build=JSON.parse(await fs.readFile(path.join(runtime,'build-info.json'),'utf8'));
if(build.platform!=='win32'||build.arch!=='x64'||!build.nfcModuleLoaded)throw Error('A verified Windows x64 native runtime is required');
for(const file of ['runtime/node.exe','node_modules/@pokusew/pcsclite/build/Release/pcsclite.node']){
 const bytes=await fs.readFile(path.join(runtime,file));if(bytes.toString('ascii',0,2)!=='MZ')throw Error('Not a Windows executable: '+file);
}
const name='Final_F';
const releases=path.resolve(root,'../releases'),output=path.join(releases,name);
await fs.mkdir(releases,{recursive:true});await fs.rm(output,{recursive:true,force:true});await fs.mkdir(output);
const files=['build','src','public','server','windows','scripts','tests','index.html','package.json','package-lock.json','Install-F.cmd','Start-F.cmd','Stop-F.cmd','Diagnose-F.cmd','Windows展場安裝與操作.md','展期維護.md','formal-nfc-20261008.json'];
for(const item of files)await fs.cp(path.join(root,item),path.join(output,item),{recursive:true,filter:src=>!src.includes('uid-map.backup-')&&!src.endsWith('reader-map.json')&&!src.endsWith('led-settings.json')&&!src.endsWith(path.join('windows','settings.json'))});
for(const item of ['runtime','node_modules','build-info.json'])await fs.cp(path.join(runtime,item),path.join(output,item),{recursive:true});
await fs.copyFile(path.join(output,'server/led-settings.example.json'),path.join(output,'server/led-settings.json'));
const inventory=[];
async function walk(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())await walk(file);else if(item.isFile())inventory.push({file:path.relative(output,file).split(path.sep).join('/'),sha256:createHash('sha256').update(await fs.readFile(file)).digest('hex')});}}
await walk(output);
await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({version:'2026-10-12-final-f-14',platform:'win32',arch:'x64',node:build.node,windowsBuild:build,deployment:{localDisplays:['wall','table','graph'],requiredDisplays:['table','wall','graph'],ipad:'Wi-Fi LAN :6275/ipad',modeDefault:'live'},sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceIncludesLocalChanges:true,nfcVerification:'formal-nfc-20261008.json',graph:JSON.parse(await fs.readFile(path.join(output,'public/graph/source.json'),'utf8')),files:inventory},null,2));
const zip=output+'.zip';
// Python zipfile writes UTF-8 names that Windows Explorer can extract correctly.
execFileSync('python3',['-c',`import pathlib,sys,zipfile
root=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in root.rglob('*'):
  if p.is_file():z.write(p,str(p.relative_to(root.parent)))
`,output,zip],{stdio:'inherit'});
await fs.writeFile(zip+'.sha256',createHash('sha256').update(await fs.readFile(zip)).digest('hex')+'  '+path.basename(zip)+'\n');
console.log(zip);
