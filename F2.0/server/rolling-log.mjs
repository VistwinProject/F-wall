import {mkdirSync,statSync,renameSync,rmSync,appendFileSync} from 'node:fs';
import path from 'node:path';
import {formatWithOptions} from 'node:util';

// A bounded, synchronous writer avoids both an unlimited file and an async queue.
export function createRollingLog(directory,{maxBytes=2*1024*1024,archives=3}={}){
  mkdirSync(directory,{recursive:true});
  const file=path.join(directory,'events.log');
  let size=0;
  try{size=statSync(file).size;}catch(error){if(error.code!=='ENOENT')throw error;}
  return (level,...args)=>{
    const message=formatWithOptions({depth:3,maxArrayLength:30,maxStringLength:4096,customInspect:false},...args);
    const line=Buffer.from(`${new Date().toISOString()} ${level} ${message.slice(0,8192)}\n`);
    if(size+line.length>maxBytes){
      rmSync(`${file}.${archives}`,{force:true});
      for(let n=archives-1;n>=0;n--){
        try{renameSync(n?`${file}.${n}`:file,`${file}.${n+1}`);}catch(error){if(error.code!=='ENOENT')throw error;}
      }
      size=0;
    }
    appendFileSync(file,line);size+=line.length;
  };
}
export function installRollingLog(directory){
  const write=createRollingLog(directory),originalError=console.error.bind(console);
  let warned=false;
  for(const level of ['log','info','warn','error'])console[level]=(...args)=>{
    try{write(level,...args);warned=false;}
    catch(error){if(!warned){warned=true;originalError('F log write failed:',error.message);}}
  };
}
