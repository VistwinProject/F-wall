import {spawn, execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const dir=path.join(root,'.runtime');
const stateFile=path.join(dir,'processes.json');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const alive=p=>{try{process.kill(p,0);return true;}catch{return false;}};
const command=p=>{try{return execFileSync('/bin/ps',['-p',String(p),'-o','command='],{encoding:'utf8'});}catch{return '';}};
const owned=p=>p&&alive(p.pid)&&command(p.pid).includes(p.marker);
const health=async port=>{try{return await (await fetch(`http://127.0.0.1:${port}/health`,{signal:AbortSignal.timeout(1000)})).json();}catch{return null;}};
await fs.mkdir(dir,{recursive:true});
const lock=path.join(dir,'launcher.lock');
try{await fs.mkdir(lock);}catch{
  let pid;try{pid=Number(await fs.readFile(path.join(lock,'pid'),'utf8'));}catch{}
  if(!pid||alive(pid))throw Error('另一個 Start／Stop 正在執行，請稍候。');
  await fs.rm(lock,{recursive:true});await fs.mkdir(lock);
}
await fs.writeFile(path.join(lock,'pid'),String(process.pid));
let state;try{state=await read(stateFile);}catch{state={browsers:{}};}
async function save(){await fs.writeFile(stateFile,JSON.stringify(state,null,2));}
async function stopRecord(p){
  if(!owned(p))return;
  process.kill(p.pid,'SIGTERM');
  for(let i=0;i<50&&owned(p);i++)await sleep(100);
  if(owned(p))throw Error(`程序 ${p.pid} 尚未結束，請再執行 Stop。`);
}
function launch(exe,args,marker,env={}){
  return fs.open(path.join(dir,'exhibition.log'),'a').then(async log=>{
    try{
      const child=spawn(exe,args,{cwd:root,env:{...process.env,...env},detached:true,stdio:['ignore',log.fd,log.fd]});
      await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
      child.unref();return {pid:child.pid,marker};
    }finally{await log.close();}
  });
}
try{
  if(process.argv[2]==='stop'){
    for(const p of Object.values(state.browsers))await stopRecord(p);
    await stopRecord(state.server);
    await fs.rm(stateFile,{force:true});
    console.log('已關閉 F 區三個視窗與服務。');
  }else{
    const config=await read(path.join(root,'offline/settings.json'));
    if(!['live','sim'].includes(config.mode))throw Error('mode 必須為 live 或 sim');
    const browser=config.browser||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if(!process.argv.includes('--no-browser'))await fs.access(browser);
    let current=await health(6273);
    if(current&&(!owned(state.server)||current.instance!==state.instance))throw Error('6273 已有其他服務，請先關閉舊版 F 區服務。');
    if(current&&(current.mode!==config.mode||current.sim!==(config.mode==='sim')))throw Error('模式已變更，請先 Stop 再 Start。');
    if(!current){
      if(owned(state.server))throw Error('原服務未回應，請先 Stop 再 Start。');
      state.instance=randomUUID();
      const entry=path.join(root,'server/index.mjs');
      state.server=await launch(process.execPath,[entry,`--${config.mode}`,...(config.mode==='live'?['--no-sim']:[])],entry,{F_PORT_BASE:'6273',F_INSTANCE_ID:state.instance});
      await save();
    }
    let ready=false;
    for(let n=0;n<60;n++){
      if(!owned(state.server))throw Error('服務啟動失敗，請查看 .runtime/exhibition.log');
      const endpoints=await Promise.all([6273,6274,6275].map(health));
      if(endpoints.every(h=>h?.instance===state.instance)){ready=true;break;}
      await sleep(200);
    }
    if(!ready)throw Error('三端服務尚未就緒，請查看 .runtime/exhibition.log');
    if(!process.argv.includes('--no-browser'))for(const [i,role] of ['table','wall','ipad'].entries()){
      if(owned(state.browsers[role]))continue;
      const profile=path.join(dir,`browser-${role}`),w=config.windows[role];
      const url=`http://localhost:${6273+i}/${role}?exhibition${role==='wall'?'&projection':''}`;
      state.browsers[role]=await launch(browser,[`--user-data-dir=${profile}`,`--app=${url}`,'--no-first-run','--no-default-browser-check','--disable-background-mode','--autoplay-policy=no-user-gesture-required',`--window-position=${w.x},${w.y}`,`--window-size=${w.width},${w.height}`],`--user-data-dir=${profile}`);
      await save();
      await sleep(500);
      if(!owned(state.browsers[role]))throw Error(`${role} 視窗啟動失敗，請查看記錄。`);
    }
    console.log('F 區已啟動：Table 6273 / Wall 6274 / iPad 6275');
    console.log('讀卡診斷：http://localhost:6275/diagnostics.html');
    console.log('iPad 使用 Sidecar 延伸時，將 iPad 視窗拖到 iPad 螢幕；Chrome 選單可進入全螢幕。');
  }
}finally{await fs.rm(lock,{recursive:true,force:true});}
