import {spawn} from 'node:child_process';
import path from 'node:path';
import {openSync,closeSync} from 'node:fs';

export function isLocalExitRequest(req,portBase){
  return req.method==='POST'
    && ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)
    && [portBase,portBase+1,portBase+2].some(port=>
      ['localhost','127.0.0.1'].some(host=>req.headers.origin===`http://${host}:${port}`));
}

// Run the existing installation-scoped graceful stop in an independent process.
export function createExhibitionExit(root,launch=spawn,logFile=path.join(root,'shutdown.log')){
  let pending;
  return ()=>{
    if(pending)return pending;
    pending=new Promise((resolve,reject)=>{
      const fd=openSync(logFile,'a');
      let child;
      try{child=launch('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(root,'windows','stop.ps1'),'-CloseDisplaysFirst'],
        {cwd:root,windowsHide:true,stdio:['ignore',fd,fd]});}
      finally{closeSync(fd);}
      child.once('error',error=>{pending=null;reject(error);});
      child.once('exit',code=>{if(code)pending=null;});
      child.once('spawn',()=>{child.unref();resolve();});
    });
    return pending;
  };
}
