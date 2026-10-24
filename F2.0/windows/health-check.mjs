import http from 'node:http';
import {pathToFileURL} from 'node:url';

// Direct loopback HTTP: independent of Windows/PowerShell proxy settings.
export function readHealth(port=6273,{timeout=2000}={}){
  return new Promise(resolve=>{
    let done=false,timer;
    const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value);};
    const req=http.get({hostname:'127.0.0.1',port,path:'/health',agent:false},res=>{
      let body='';res.setEncoding('utf8');
      res.on('data',chunk=>{body+=chunk;if(body.length>1024*1024){finish({ok:false,error:'Health response exceeds 1 MiB'});req.destroy();}});
      res.on('error',error=>finish({ok:false,error:error.message}));
      res.on('end',()=>{
        if(res.statusCode!==200)return finish({ok:false,error:`HTTP ${res.statusCode}: ${body.slice(0,160)}`});
        try{
          const health=JSON.parse(body);
          if(health?.app!=='f-control-tower')return finish({ok:false,error:'Port responds, but is not this F server',occupied:true});
          finish({ok:true,health});
        }catch{finish({ok:false,error:'Port returned invalid JSON',occupied:true});}
      });
    });
    req.on('error',error=>finish({ok:false,error:`${error.code||'HTTP'}: ${error.message}`}));
    timer=setTimeout(()=>{finish({ok:false,error:`Loopback health timed out after ${timeout} ms`});req.destroy();},timeout);
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  console.log(JSON.stringify(await readHealth(Number(process.argv[2]||6273))));
}
