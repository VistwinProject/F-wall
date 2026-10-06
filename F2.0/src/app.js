import {reportRendered,installRenderHeartbeat} from './display-report.js';
import {batchFrame} from './frame-batch.js';
import {DEVICES,BY_ID,RELATIONS,LEFT,RIGHT,WALL_HUB,SCREEN,GRAPH_HUB,TABLE_HUB,SLOTS} from './devices.js';
import {Session} from './session.js';
import {PANEL_CONTENT,panelFacts} from './panel-content.js';
import {tableReports} from './table-reports.js';
import {ipadDetail,insightPanel} from './ipad-insights.js';
import {applianceIcon} from './appliance-icons.js';
import {wallOperation} from './wall-operations.js';
import {Glow} from './glow.js';
import {createEditor,loadTuning,defaultPositions} from './editor.js';
import {wallSilhouette} from './wall-silhouettes.js';
import {createIntro} from './intro.js';
import {createDeviceAudio} from './device-audio.js';
import {createCompletionAudio} from './completion-audio.js';
import {setupTableAudio,tableVoice} from './table-audio.js';
import {ring,rect,between,WALL_ROUTES,wallRoutes,svgPoints} from './geometry.js';

const params=new URLSearchParams(location.search);
const silentTest=params.has('mute');
if(silentTest){const badge=document.createElement('div');badge.textContent='F 本機驗證 · 靜音';badge.style.cssText='position:fixed;top:4px;left:4px;z-index:99999;color:white;background:#234;padding:5px;font:12px sans-serif';document.body.append(badge);}
const role=location.pathname.includes('wall')||location.port==='6274'?'wall':location.pathname.includes('ipad')||location.port==='6275'?'ipad':'table';
const tune=loadTuning(role);
let fullEditor;
const titles={wall:'牆面投影',table:'桌面感應',ipad:'iPad 控制介面'};
document.title=`F 2.0 重製版 | ${titles[role]}`;
document.body.className=role;
document.body.classList.toggle('no-glass',params.has('noglass'));
document.body.classList.toggle('projection',params.has('projection'));
const app=document.querySelector('#app');
const stageHeight=role==='ipad'?1200:role==='table'?1000:1080;
const stage=document.createElement('div');stage.className='stage';stage.style.height=stageHeight+'px';app.append(stage);
let tableSurface,welcomeView,tableFrame,tableViewsReady=false,tableViewMode,tableViewAnimation,tableViewTransition=0;
function fit(){
  const p=role==='table'?tune.projection:null;
  if(p){
    if(!tableSurface){tableSurface=document.createElement('div');tableSurface.className='table-projection-surface';app.append(tableSurface);tableSurface.append(stage);}
    const width=Math.max(400,p.width),height=Math.max(200,p.height);
    const factor=p.on?Math.max(1920/width,1000/height):1;
    const surfaceWidth=p.on?width*factor:1920,surfaceHeight=p.on?height*factor:1000;
    const scale=Math.min(innerWidth/surfaceWidth,innerHeight/surfaceHeight);
    tableSurface.style.cssText=`position:absolute;left:50%;top:50%;width:${surfaceWidth}px;height:${surfaceHeight}px;transform:translate(-50%,-50%) scale(${scale});overflow:hidden;background:#16181d;isolation:isolate`;
    const radii=p.corners.map(r=>Math.max(0,Math.min(r,width/2,height/2))*factor+'px').join(' ');
    tableSurface.style.borderRadius=p.on?radii:'38px';
    stage.style.transform='translate(-50%,-50%)';stage.style.borderRadius='0';stage.style.overflow='visible';
    const welcome=welcomeView||stage.querySelector('#welcome');
    if(welcome){
      welcome.style.inset='auto';welcome.style.left=-(surfaceWidth-1920)/2+'px';welcome.style.top=-(surfaceHeight-1000)/2+'px';
      welcome.style.width=surfaceWidth+'px';welcome.style.height=surfaceHeight+'px';
      welcome.style.border='0';welcome.style.borderRadius='0';
    }
    document.body.style.background='#000';document.documentElement.style.background='#000';
    const frame=tableFrame||stage.querySelector('.table-frame');
    if(frame){frame.style.borderRadius='0';frame.style.border='0';frame.style.inset='0';frame.style.background='transparent';frame.style.overflow='visible';}
    const gradient=stage.querySelector('.table-gradient-field');if(gradient)tableSurface.prepend(gradient);
    let mask=tableSurface.querySelector('.table-ipad-mask');
    if(!mask){mask=document.createElement('div');mask.className='table-ipad-mask';mask.setAttribute('aria-label','iPad 投影黑色遮罩');mask.innerHTML='<span>iPad 黑色遮罩 · 拖曳移動</span>'+['top','right','bottom','left'].map(edge=>`<i data-mask-edge="${edge}"></i>`).join('');tableSurface.append(mask);}
    mask.hidden=!p.maskOn;
    mask.style.cssText=`position:absolute;z-index:50;background:#000;left:${50+p.maskX/width*100}%;bottom:0;width:${Math.min(width,Math.max(0,p.maskWidth))/width*100}%;height:${Math.min(height,Math.max(0,p.maskHeight))/height*100}%;transform:translateX(-50%);border-radius:${Math.max(0,p.maskRadius)*surfaceWidth/width}px ${Math.max(0,p.maskRadius)*surfaceWidth/width}px 0 0`;
  }else{const scale=Math.min(innerWidth/1920,innerHeight/stageHeight);stage.style.transform=`translate(-50%,-50%) scale(${scale})`;}
}
addEventListener('f-table-projection',fit);
addEventListener('resize',fit);fit();
const svg=(content,width=1920,height=1080,cls='scene-svg')=>`<svg class="${cls}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${content}</svg>`;
const boxMarkup=(box,extra='')=>{const[x,y,w,h]=box;return `<rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="6" fill="#000" ${extra}/>`;};
let glow,scene,session,state,intro,completionAudio,focused=null,detail=null,completionDismissed=false;
let completionTimer=null,completionReady=false;
let overrides=structuredClone(defaultPositions[role]);
try{const raw=JSON.parse(localStorage.getItem('f2-layout-'+role)||'{}');if(raw&&typeof raw==='object'&&!Array.isArray(raw))Object.assign(overrides,raw);}catch{}
const positioned=(key,x,y)=>{const v=overrides[key];return Array.isArray(v)&&v.length===2&&v.every(Number.isFinite)?v:[x,y];};
const posStyle=(key,x,y)=>{const p=positioned(key,x,y);return `left:${p[0]}px;top:${p[1]}px`;};
// Centers chosen outside all nine sensing circles and the central core.
const TABLE_ICON_POSITIONS=[[705,600],[1030,625],[810,305],[1080,325],[1245,180],[1410,325],[1680,305],[1470,625],[1800,600]];

function buildWall(){
  Object.assign(WALL_ROUTES,wallRoutes(tune));
  stage.innerHTML=`<div id="scene" class="wall-scene"></div>`;scene=stage.querySelector('#scene');
  const frames=`<rect x="130" y="50" width="1610" height="985" rx="31"/><g>${[310,460,625,760,1150,1290,1435,1600].map(x=>`<path d="M${x} 50V1035"/>`).join('')}${[335,550,760,900].map(y=>`<path d="M130 ${y}H1740"/>`).join('')}</g>`;
  scene.innerHTML=svg(`<g class="wall-grid">${frames}</g><g id="wall-links">${DEVICES.map(d=>`<polyline data-wire="${d.id}" class="wire" points="${svgPoints(WALL_ROUTES[d.id])}"/>`).join('')}</g><g class="masks">${boxMarkup(SCREEN)}${boxMarkup(WALL_HUB,'data-core="true"')}${DEVICES.map(d=>boxMarkup(d.box,`data-mask="${d.id}"`)).join('')}</g>`);
  for(const d of DEVICES){
    const[x,y,w,h]=d.box;
    const photo=document.createElement('img');photo.className='appliance-photo';photo.dataset.photo=d.id;photo.src=`/appliances/${d.id}.webp`;photo.alt='';photo.style.cssText=`left:${x-w/2+8}px;top:${y-h/2+8}px;width:${w-16}px;height:${h-16}px`;scene.append(photo);
    const operation=document.createElement('div');operation.className='wall-operation';operation.dataset.operation=d.id;operation.style.cssText=`left:${x-w*.4}px;top:${y-h*.4}px;width:${w*.8}px;height:${h*.8}px`;operation.innerHTML=wallOperation(d.id);scene.append(operation);
    const[px,py,pw,ph]=d.panel;
    const panel=document.createElement('section');panel.className='glass wall-panel';panel.dataset.panel=d.id;panel.dataset.move='panel-'+d.id;panel.style.cssText=`${posStyle('panel-'+d.id,px,py)};width:${pw}px;height:${ph}px`;
    panel.innerHTML=`<h2 class="wall-panel-heading"><span>${PANEL_CONTENT[d.id].label}</span><span class="wall-panel-status">運轉中</span></h2>${panelFacts(d.id,'wall')}`;scene.append(panel);
  }
  glow=new Glow(scene,1920,1080);
}
function buildTable(){
  stage.innerHTML=`<div class="table-frame"><div id="scene" class="table-scene"></div><aside id="info-panel" class="info-panel" aria-live="polite"></aside></div>`;
  scene=stage.querySelector('#scene');
  scene.innerHTML=svg(SLOTS.map((p,i)=>`<polyline class="table-wire" data-slot-wire="${i+1}" points="${svgPoints(between(p,TABLE_HUB,58,180))}"/>`).join(''),1920,1000);
  SLOTS.forEach(([x,y],i)=>{
    const item=document.createElement('div');item.className='slot';item.dataset.slot=i+1;item.style.cssText=`left:${x}px;top:${y}px`;
    item.innerHTML=`<button class="slot-circle" data-toggle="${i+1}" aria-label="感應區 ${i+1}"><span>+</span><small>${String(i+1).padStart(2,'0')}</small></button><span class="slot-label">NFC ${String(i+1).padStart(2,'0')}</span><span class="slot-device"></span>`;scene.append(item);
    const [ix,iy]=TABLE_ICON_POSITIONS[i];
    const icon=document.createElement('div');icon.className='table-slot-icon';icon.dataset.slotIcon=i+1;icon.style.cssText=`left:${ix}px;top:${iy}px`;icon.hidden=true;scene.append(icon);
  });
  scene.insertAdjacentHTML('beforeend',`<div class="table-core" style="left:${TABLE_HUB[0]}px;top:${TABLE_HUB[1]}px"></div><div class="core-caption" style="left:${TABLE_HUB[0]}px;top:946px">SYSTEM CORE</div>`);
  glow=new Glow(scene,1920,1000);
  import('./table-orb.js').then(({createTableOrb})=>createTableOrb(scene.querySelector('.table-core'))).catch(error=>console.warn('Table orb could not load:',error));
}
function graphPosition(id){const d=BY_ID[id];return positioned('node-'+id,d.pos[0]*1920,d.pos[1]*1080);}
function hubPosition(){return positioned('hub',...GRAPH_HUB);}
function buildIpad(){
  stage.innerHTML=`<header class="statusbar"><div class="brand"><b>F</b><span>AI 大腦控制塔</span></div><div class="status-right"><span id="complete-badge">全屋連動完成</span><span class="connection"><i></i><span id="connection-label">連線中</span></span></div></header><div id="scene" class="graph-scene"><img class="floorplan" src="/floorplan-lineart-v2.png" alt="智慧家庭灰階空間線稿圖"><div id="graph-lines"></div></div><button class="reset" data-action="reset">↶ 重置</button>`;
  scene=stage.querySelector('#scene');
  for(const[ids,right]of [[LEFT,false],[RIGHT,true]])ids.forEach((id,i)=>{
    const d=BY_ID[id],x=right?1570:40,y=right?60+i*290:60+i*220;
    const card=document.createElement('button');card.className=`glass device-card${right?' right':''}`;card.dataset.device=id;card.dataset.move='card-'+id;card.style.cssText=posStyle('card-'+id,x,y);
    card.innerHTML=`<span class="device-indicator"></span><span class="device-copy"><span>${PANEL_CONTENT[id].label}</span></span>`;scene.append(card);
  });
  for(const d of DEVICES){
    const p=graphPosition(d.id);const node=document.createElement('button');node.className='graph-node';node.dataset.node=d.id;node.dataset.move='node-'+d.id;node.setAttribute('aria-label',d.label+'詳細資料');node.style.cssText=`left:${p[0]}px;top:${p[1]}px`;node.innerHTML=applianceIcon(d.id);scene.append(node);
  }
  const h=hubPosition();scene.insertAdjacentHTML('beforeend',`<div class="graph-hub" data-move="hub" style="left:${h[0]}px;top:${h[1]}px"><span>AI<br>大<br>腦</span></div><div class="completion" id="completion"><div><p>ALL SYSTEMS LINKED</p><h1>全屋家電已串聯至 AI 大腦</h1><h2>AI 正在學習你的生活方式，將自動調節出最舒適的居家情境。</h2><button data-action="view-graph">檢視連動圖</button></div></div>`);
  glow=new Glow(scene,1920,1080);
}
if(role==='wall')buildWall();else if(role==='table')buildTable();else buildIpad();
if(role!=='wall')stage.insertAdjacentHTML('beforeend',`<div class="welcome" id="welcome"><div><h1>AI 大腦控制塔</h1><p class="welcome-instruction">請拿取前方設備裝置，放置相對的感應範圍，<br>開始將居家設備連結到 AI 大腦！</p>${role==='ipad'?'<button data-action="start">點擊任意位置開始</button>':''}</div></div>`);

welcomeView=stage.querySelector('#welcome');tableFrame=stage.querySelector('.table-frame');

if(role==='table'){
  const welcome=stage.querySelector('#welcome'),content=welcome.firstElementChild;
  const sphere=document.createElement('div');sphere.className='intro-sphere table-welcome-orb';sphere.setAttribute('aria-hidden','true');
  content.insertBefore(sphere,content.querySelector('.welcome-instruction'));
  const caption=document.createElement('div');caption.className='welcome-caption audio-caption';
  caption.setAttribute('aria-label','開場語音字幕');
  sphere.after(caption);
  let disposed=false,disposeOrb;
  addEventListener('pagehide',()=>{disposed=true;disposeOrb?.();},{once:true});
  import('./intro-quantum.js').then(({createIntroQuantum})=>{
    if(disposed)return;
    disposeOrb=createIntroQuantum(sphere,()=>tableVoice,()=>!welcome.classList.contains('dismissed'));
  }).catch(error=>console.warn('Table welcome orb unavailable:',error));
}
const tools=document.createElement('div');tools.className='tools';
tools.innerHTML=`<details id="sim-tray"><summary><b>替代 NFC 卡片</b><span id="tray-count">0/9 已放上</span><span class="tray-arrow">展開</span></summary><div class="sim-body"><div class="preview-heading"><span>F 2.0 重製版</span><span id="server-status">連線中</span></div><p>點選卡片模擬放上／拿走，三個介面同步更新。</p><div class="sim-cards">${DEVICES.map((d,i)=>`<button data-toggle="${i+1}" title="鍵盤 ${i+1}"><small>${i+1}</small>${d.label}</button>`).join('')}</div><div class="sim-actions"><button data-action="start">開始體驗</button><button data-action="all">全部放上</button><button data-action="clear">全部拿走</button><button data-action="demo" id="demo-button">自動展示</button><button data-action="reset">重置</button></div><p class="key-help">鍵盤 1–9 放卡 · A 全放 · 0 全拿 · E 校正</p><nav><a href="http://${location.hostname}:6274/wall" target="_blank">牆面</a><a href="http://${location.hostname}:6273/table" target="_blank">桌面</a><a href="http://${location.hostname}:6275/ipad" target="_blank">iPad</a></nav></div></details>`;
app.append(tools);
const notice=document.createElement('div');notice.className='notice';notice.setAttribute('role','status');app.append(notice);
let noticeTimer;
function notify(text){notice.textContent=text;notice.classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.classList.remove('show'),3500);}

function infoMarkup(d){
  if(!d)return `<div class="table-reports"><section class="table-report table-report-idle" aria-label="感應待機"><div class="table-report-media"><div class="table-report-phone"><div class="table-report-crop table-report-waiting"><h1>感應待機中</h1><h2>請將物件放上右側的感應區</h2><p>感應後顯示家電對應報告</p></div></div></div></section></div>`;
  if(role!=='table')return `<section class="metric-box panel-facts-detail">${panelFacts(d.id,role)}</section>`;
  return tableReports(d.id,PANEL_CONTENT[d.id].label);
}
function releaseReportLayer(layer){
  if(!layer)return;
  for(const video of layer.querySelectorAll('video')){
    video.pause();video.removeAttribute('src');video.load();
  }
  layer.remove();
}
let focusCleanup=()=>{};

function updateFocus(id){
  if(role!=='table'){focused=id;return;}
  const panel=tableFrame.querySelector('#info-panel');
  if(tableViewsReady&&!tableFrame.isConnected)return;
  if(focused===id&&panel.childElementCount)return;
  focused=id;
  focusCleanup();
  // Keep the most visible layer when rapid NFC scans interrupt a transition.
  const layers=Array.from(panel.children);
  const outgoing=layers.sort((a,b)=>Number(getComputedStyle(b).opacity)-Number(getComputedStyle(a).opacity))[0];
  for(const layer of layers){
    layer.querySelector('video')?.pause();
    if(layer!==outgoing)releaseReportLayer(layer);
  }
  const holder=document.createElement('div');
  holder.innerHTML=infoMarkup(BY_ID[id]);
  const incoming=holder.firstElementChild;
  incoming.style.opacity=outgoing?'0':'1';
  panel.append(incoming);
  const video=incoming.querySelector('video');
  video?.addEventListener('ended',()=>{
    if(!video.isConnected||focused!==id)return;
    const active=state.active;
    if(!active.length){updateFocus(null);return;}
    const next=active[(active.indexOf(id)+1)%active.length];
    if(next!==id){updateFocus(next);return;}
    video.currentTime=0;
    video.play().catch(()=>{});
  });
  const controller=new AbortController();
  let animations=[],timer=null,started=false,cancelled=false;
  focusCleanup=()=>{
    cancelled=true;clearTimeout(timer);controller.abort();
    for(const animation of animations){animation.commitStyles();animation.cancel();}
  };
  const reveal=()=>{
    if(started||cancelled)return;
    started=true;clearTimeout(timer);controller.abort();
    if(!outgoing||matchMedia('(prefers-reduced-motion: reduce)').matches){
      releaseReportLayer(outgoing);incoming.style.opacity='1';focusCleanup=()=>{};return;
    }
    outgoing.setAttribute('aria-hidden','true');
    const options={duration:420,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'};
    animations=[
      outgoing.animate([{opacity:getComputedStyle(outgoing).opacity},{opacity:0}],options),
      incoming.animate([{opacity:0},{opacity:1}],options),
    ];
    Promise.all(animations.map(animation=>animation.finished)).then(()=>{
      if(cancelled)return;
      incoming.style.opacity='1';releaseReportLayer(outgoing);
      for(const animation of animations)animation.cancel();
      animations=[];focusCleanup=()=>{};
    }).catch(()=>{});
  };
  // Hold the previous frame until the replacement video has an image to show.
  if(video&&video.readyState<2){
    video.addEventListener('loadeddata',reveal,{once:true,signal:controller.signal});
    video.addEventListener('error',reveal,{once:true,signal:controller.signal});
    timer=setTimeout(reveal,1800);
  }else reveal();
}
addEventListener('pagehide',()=>{focusCleanup();stage.querySelectorAll('#info-panel>.table-reports').forEach(releaseReportLayer);},{once:true});
function syncReportFocus(preferNew=false){
  if(role!=='table')return;
  // A newly detected card takes priority; otherwise preserve current playback.
  if(!preferNew&&state.active.includes(focused))return;
  updateFocus(state.focus);
}
function addLight(paths,key,points,beam=false,width=1.8,opacity=1,period=1.5){paths.push({key,points,beam,width,opacity,period,tuneWidth:beam?tune.beamWidth:tune.lineWidth,minCorePx:tune.minCorePx,phase:paths.length*47});}
function renderWall(active){
  glow.setFrame(tune);
  const paths=[],[fx,fy,fw,fh,fr]=tune.frame;
  scene.querySelector('.wall-grid').style.display=tune.showFrame===false?'none':'';
  if(tune.showFrame!==false){
    addLight(paths,'frame',rect(fx,fy,fw,fh,fr),false,1.1,.8,3);
    for(const x of tune.vlines)addLight(paths,'v'+x,[[x,fy],[x,fy+fh]],false,.8,.65,3);
    for(const y of tune.hlines)addLight(paths,'h'+y,[[fx,y],[fx+fw,y]],false,.8,.65,3);
  }
  for(const d of DEVICES){
    const on=active.includes(d.id);scene.querySelector(`[data-panel="${d.id}"]`)?.classList.toggle('active',on);scene.querySelector(`[data-photo="${d.id}"]`).classList.toggle('active',on);scene.querySelector(`[data-wire="${d.id}"]`).classList.toggle('active',on);scene.querySelector(`[data-operation="${d.id}"]`).classList.toggle('active',on);
    const silhouette=wallSilhouette(d,tune);
    let mask=scene.querySelector(`[data-mask="${d.id}"]`);
    if(mask.tagName.toLowerCase()!=='path'){
      const path=document.createElementNS('http://www.w3.org/2000/svg','path');
      path.dataset.mask=d.id;path.setAttribute('fill','#000');mask.replaceWith(path);mask=path;
    }
    mask.setAttribute('d',silhouette.path);mask.removeAttribute('transform');
    if(on){silhouette.contours.forEach((points,i)=>addLight(paths,'frame-'+d.id+'-'+i,points,false,1.9));addLight(paths,'route-'+d.id,WALL_ROUTES[d.id],false,1.1,.8);addLight(paths,'packet-'+d.id,WALL_ROUTES[d.id],true,3);}
  }
  const[x,y,w,h]=WALL_HUB,coreContour=rect(x-w/2,y-h/2,w,h);
  let coreMask=scene.querySelector('[data-core]');
  if(coreMask.tagName.toLowerCase()!=='path'){
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.dataset.core='true';path.setAttribute('fill','#000');coreMask.replaceWith(path);coreMask=path;
  }
  coreMask.setAttribute('d','M '+coreContour.map(p=>p.join(' ')).join(' L ')+' Z');
  if(active.length)addLight(paths,'core',coreContour,false,2);
  for(const[id,p]of Object.entries(tune.panels))scene.querySelector(`[data-panel="${id}"]`)?.classList.toggle('active',active.includes(p.source));
  glow.setPaths(paths);
}
function renderTable(){
  const paths=[];
  SLOTS.forEach((p,i)=>{
    const s=state.slots[i+1],device=BY_ID[s?.data?.id],on=!!device;
    const icon=scene.querySelector(`[data-slot-icon="${i+1}"]`);
    if(on){
      if(icon.dataset.deviceId!==device.id){icon.innerHTML=applianceIcon(device.id);icon.dataset.deviceId=device.id;}
      icon.setAttribute('aria-label',`感應區 ${i+1}：${device.label}運作中`);icon.hidden=false;icon.classList.add('active');
    }else{
      icon.hidden=true;icon.classList.remove('active');icon.replaceChildren();delete icon.dataset.deviceId;icon.removeAttribute('aria-label');
    }
    const el=scene.querySelector(`[data-slot="${i+1}"]`);el.classList.toggle('active',on);el.classList.toggle('reader-online',!!s?.reader);el.classList.toggle('unknown',s?.known===false);
    el.querySelector('.slot-label').textContent=on?PANEL_CONTENT[device.id].label:`NFC ${String(i+1).padStart(2,'0')}`;
    el.querySelector('.slot-device').textContent=s?.known===false?'未登記卡片':'';
    el.querySelector('button').disabled=!state.sim||!state.online;
    scene.querySelector(`[data-slot-wire="${i+1}"]`).classList.toggle('active',on);
    if(on){addLight(paths,'slot-'+i,ring(...p,tune.slotSize/2),false,2.8);const route=between(p,TABLE_HUB,tune.slotSize/2+2,tune.hubSize/2+2);addLight(paths,'link-'+i,route,false,1.4);addLight(paths,'packet-'+i,route,true,2.8);}
  });
  const count=state.active.length;scene.querySelector('.table-core').classList.toggle('active',count>0);
  if(count)addLight(paths,'core',ring(...TABLE_HUB,tune.hubSize/2),false,3.5);
  glow.setPaths(paths);
}
function renderGraph(){
  const paths=[],active=state.active,hub=hubPosition(),svgLines=[];
  for(const [ids,right]of [[LEFT,false],[RIGHT,true]])ids.forEach((id,i)=>{
    const d=BY_ID[id],on=active.includes(id),p=graphPosition(id),card=scene.querySelector(`[data-device="${id}"]`),node=scene.querySelector(`[data-node="${id}"]`);
    card.classList.toggle('active',on);card.setAttribute('aria-disabled',String(!on));node.classList.toggle('active',on);node.disabled=!on&&!fullEditor?.open;
    const cp=positioned('card-'+id,right?1570:40,right?60+i*290:60+i*220);
    svgLines.push(`<polyline class="leader ${on?'active':''}" points="${svgPoints([[cp[0]+(right?0:300),cp[1]+46],p])}"/>`);
    if(on){addLight(paths,'node-'+id,ring(...p,tune.ringR),false,1.3);const route=between(p,hub,tune.ringR+2,tune.hubR+2);addLight(paths,'node-link-'+id,route,false,1.4);addLight(paths,'node-packet-'+id,route,true,2.6);}
  });
  for(const[a,b,label]of RELATIONS)if(active.includes(a)&&active.includes(b)){
    const points=between(graphPosition(a),graphPosition(b),tune.ringR,tune.ringR);addLight(paths,'relation-'+a+'-'+b,points,false,1.3,.8);svgLines.push(`<polyline class="relation" points="${svgPoints(points)}"><title>${label}</title></polyline>`);
  }
  const lines=scene.querySelector('#graph-lines'),markup=svg(svgLines.join(''));
  if(lines.dataset.markup!==markup){lines.innerHTML=markup;lines.dataset.markup=markup;}
  scene.querySelector('.graph-hub').classList.toggle('active',active.length>0);
  if(active.length)addLight(paths,'hub',ring(...hub,tune.hubR),false,3.5);
  glow.setPaths(paths);

  stage.querySelector('#connection-label').textContent=state.online?'已連線':'重新連線中';stage.querySelector('.connection').classList.toggle('offline',!state.online);
  stage.querySelector('#complete-badge').classList.toggle('show',active.length===9);
  if(active.length<9||!state.completionAudioReady){
    clearTimeout(completionTimer);completionTimer=null;completionReady=false;completionDismissed=false;
  }else if(!completionReady&&!completionDismissed&&completionTimer===null){
    completionTimer=setTimeout(()=>{
      completionTimer=null;
      if(state.active.length===9&&!completionDismissed){completionReady=true;renderGraph();}
    },2000);
  }
  const complete=scene.querySelector('#completion');const show=active.length===9&&completionReady&&!completionDismissed;
  complete.classList.toggle('show',show);complete.inert=!show;
  completionAudio?.sync(show,!!state.suppressCompletionAudio||!!state.cancelledAudio);
  if(detail&&!active.includes(detail))closeDetail();
}
function switchTableView(){
  if(role!=='table'||!tableViewsReady)return;
  const experience=state.session||document.body.classList.contains('editing');
  const mode=experience?'experience':'home';
  if(mode===tableViewMode&&!(document.body.classList.contains('editing')&&!tableFrame.isConnected))return;
  const initial=tableViewMode===undefined,transition=++tableViewTransition;
  const opacity=getComputedStyle(tableSurface).opacity;
  tableViewAnimation?.cancel();
  tableViewMode=mode;
  const mount=()=>{
  if(experience){
    welcomeView.remove();stage.prepend(tableFrame);updateFocus(state.focus);fit();
  }else{
    focusCleanup();focused=null;
    for(const layer of tableFrame.querySelectorAll('#info-panel>.table-reports'))releaseReportLayer(layer);
    const bg=tableSurface.querySelector('.table-gradient-field');if(bg)tableFrame.prepend(bg);
    tableFrame.remove();stage.append(welcomeView);welcomeView.classList.remove('dismissed');welcomeView.inert=false;fit();
  }
  dispatchEvent(new Event('f-table-view-change'));
  };
  // Fade one mounted page out, replace it, then fade the next page in.
  // Editing needs synchronous mounting so its handles can measure the new page.
  if(initial||document.body.classList.contains('editing')||matchMedia('(prefers-reduced-motion: reduce)').matches||!tableSurface.animate){mount();return;}
  tableViewAnimation=tableSurface.animate([{opacity},{opacity:0}],{duration:240,easing:'ease-in',fill:'forwards'});
  tableViewAnimation.finished.then(()=>{
    if(transition!==tableViewTransition)return;
    mount();render();if(experience)syncReportFocus();
    tableViewAnimation.cancel();
    tableViewAnimation=tableSurface.animate([{opacity:0},{opacity:1}],{duration:360,easing:'ease-out',fill:'forwards'});
    return tableViewAnimation.finished.then(()=>{
      if(transition===tableViewTransition){tableViewAnimation.cancel();tableViewAnimation=null;}
    });
  }).catch(()=>{}); // A newer switch cancels the previous animation.
}
function render(){
  intro?.sync(state);
  switchTableView();
  glow.visible=role==='table'?tableFrame.isConnected:role==='wall'||state.session||document.body.classList.contains('editing');
  const active=role==='wall'&&params.has('all')?DEVICES.map(d=>d.id):state.active;
  if(role==='wall')renderWall(active);else if(role==='table'){if(!tableViewsReady||tableFrame.isConnected)renderTable();}else renderGraph();
  const welcome=stage.querySelector('#welcome');if(welcome){if(role!=='table')welcome.classList.toggle('dismissed',state.session);welcome.inert=state.session;}
  tools.hidden=!state.sim||params.has('projection');
  tools.querySelector('#tray-count').textContent=`${state.active.length}/9 已放上`;
  tools.querySelector('#server-status').textContent=state.online?'三端同步已連線':'重新連線中';
  tools.querySelector('#demo-button').textContent=state.demo?'停止展示':'自動展示';
  for(const b of tools.querySelectorAll('[data-toggle]')){b.classList.toggle('selected',!!state.slots[b.dataset.toggle]?.data);b.setAttribute('aria-pressed',String(!!state.slots[b.dataset.toggle]?.data));b.disabled=!state.online;}
  let connectionNotice=document.querySelector('#f-disconnected');
  if(!connectionNotice){connectionNotice=document.createElement('div');connectionNotice.id='f-disconnected';connectionNotice.textContent='連線中斷 · 保留最後畫面 · 等待重新同步';connectionNotice.style.cssText='position:fixed;top:5px;right:5px;z-index:99999;background:#823c15;color:white;padding:8px;font:14px sans-serif';document.body.append(connectionNotice);}
  connectionNotice.hidden=state.online&&state.ready;
  reportRendered(session,state,role);

}
session=new Session(role);state=session.state;
if(!silentTest&&role==='table')setupTableAudio({session,notify});
intro=silentTest?{sync(){}}:createIntro({stage,role,notify,session});
completionAudio=silentTest?{sync(){}}:createCompletionAudio({stage,role,notify,session});
if(!silentTest)createDeviceAudio({session,role,notify});
installRenderHeartbeat(session);
// Process audio immediately; collapse bursts of NFC updates into one visual frame.
const queueRender=batchFrame(events=>{
  render();
  if(['snapshot','tag-present','tag-remove','reader-disconnected','session-end'].some(type=>events.has(type)))syncReportFocus(events.has('tag-present'));
});
session.addEventListener('change',({detail:event})=>{
  state=event.state;
  if(event.type==='audio-stop')dispatchEvent(new Event('f-stop-audio'));
  intro?.sync(state);
  queueRender(event.type);
});
addEventListener('pagehide',()=>{queueRender.cancel();clearTimeout(completionTimer);tableViewTransition++;tableViewAnimation?.cancel();},{once:true});
render();if(role==='table')updateFocus(null);
fullEditor=createEditor({role,stage,scene,tune,positions:overrides,refresh:()=>render(),notify,initialOpen:params.has('edit'),onSensingOffset:(x,y)=>glow?.setViewportOffset(x,y,{width:stage.parentElement.clientWidth,height:stage.parentElement.clientHeight})});
tableViewsReady=true;render();if(role==='table'&&tableFrame.isConnected)syncReportFocus();
glow.visible=role==='wall'||state.session||fullEditor.open;
if(glow.visible)glow.prewarm(tune);

function send(type,fields){if(!session.send(type,fields)){notify('連線中斷，正在重新連線；恢復後可繼續操作。');return false;}return true;}
function toggle(slot){if(!state.sim){notify('現場模式請使用實體 NFC 卡片。');return;}send('simulate',{action:'toggle',slot_index:Number(slot)});}
let detailOpener=null;
// iPad: freeze the glow while the detail panel covers it, so the blur behind it is not recomputed every frame.
function syncGlowPause(){if(role!=='ipad')return;if(glow)glow.paused=!!detail;document.body.classList.toggle('detail-open',!!detail);}
function closeDetail(){document.querySelector('.detail-backdrop')?.remove();detail=null;syncGlowPause();if(detailOpener?.isConnected)detailOpener.focus();detailOpener=null;}
function showDetail(id){
  if(!state.active.includes(id)){notify('請先將對應家電放上感應區。');return;}
  const opener=document.activeElement;closeDetail();detailOpener=opener;detail=id;syncGlowPause();const d={...BY_ID[id],label:PANEL_CONTENT[id].label};
  const modal=document.createElement('div');modal.className='detail-backdrop';modal.innerHTML=`<section class="glass detail-card" role="dialog" aria-modal="true" aria-label="${d.label}詳細資料"><button class="close-detail" data-action="close-detail" aria-label="關閉">×</button><div class="detail-header"><img src="/appliances/${id}.webp" alt="${d.label}"><div>${role==='ipad'?'':`<p>${d.code} · 已連線</p>`}<h1>${d.label}</h1>${role==='ipad'?'':`<p>${d.sub}</p>`}</div></div><div class="detail-body">${role==='ipad'?ipadDetail(id):infoMarkup(d)}</div><section class="detail-relations" ${role==='ipad'?'hidden':''}><h3>AI 連動關係</h3><div class="relation-list">${RELATIONS.filter(([a,b])=>a===id||b===id).map(([a,b,label])=>`<div><span>${label}</span><b>${state.active.includes(a)&&state.active.includes(b)?'已串聯':'等待設備'}</b></div>`).join('')}</div></section><p class="sample-label">${role==='ipad'?'展覽模擬資訊非現場的即時資訊':'展示數據 · 依業主提供文案呈現'}</p></section>`;
  modal.addEventListener('click',e=>{if(e.target===modal)closeDetail();});app.append(modal);modal.querySelector('.close-detail').focus();
  const selectView=(button)=>{
    modal.querySelectorAll('[data-insight-view]').forEach(tab=>{const selected=tab===button;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;});
    const panel=modal.querySelector('#insight-panel');panel.innerHTML=insightPanel(id,button.dataset.insightView);panel.setAttribute('aria-labelledby',button.id);
    modal.querySelector('.detail-relations').hidden=button.dataset.insightView!=='maintenance';
    modal.querySelector('.insight-disclaimer').hidden=button.dataset.insightView!=='trends';
  };
  modal.addEventListener('click',e=>{
    const tab=e.target.closest('[data-insight-view]');if(tab)selectView(tab);
    const question=e.target.closest('[data-insight-question]');if(!question)return;
    const expand=question.getAttribute('aria-expanded')!=='true';
    modal.querySelectorAll('[data-insight-question]').forEach(button=>{
      const open=button===question&&expand;
      button.setAttribute('aria-expanded',String(open));
      modal.querySelector('#'+button.getAttribute('aria-controls')).hidden=!open;
      button.querySelector('.question-toggle').textContent=open?'−':'＋';
    });
  });
  modal.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();closeDetail();return;}
    const tabs=[...modal.querySelectorAll('[data-insight-view]')];
    if(tabs.includes(document.activeElement)&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
      e.preventDefault();const i=tabs.indexOf(document.activeElement);const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowLeft'?-1:1)+tabs.length)%tabs.length;selectView(tabs[next]);tabs[next].focus();return;
    }
    if(e.key==='Tab'){
      const items=[...modal.querySelectorAll('button:not([disabled]):not([tabindex="-1"])')];const first=items[0],last=items.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
}
document.addEventListener('click',event=>{
  if(fullEditor?.open&&event.target.closest('[data-move]'))return;
  const toggleButton=event.target.closest('[data-toggle]');if(toggleButton){toggle(toggleButton.dataset.toggle);return;}
  const device=event.target.closest('[data-device],[data-node]');if(device){showDetail(device.dataset.device||device.dataset.node);return;}
  let action=event.target.closest('[data-action]')?.dataset.action;
  if(!action&&role!=='wall'&&event.target.closest('#welcome'))action='start';
  switch(action){
    case 'start':send('session-start');break;
    case 'reset':closeDetail();completionDismissed=false;send('session-end');break;
    case 'all':send('simulate',{action:'all'});break;
    case 'clear':send('simulate',{action:'clear'});break;
    case 'demo':send(state.demo?'demo-stop':'demo-start');break;
    case 'view-graph':completionDismissed=true;renderGraph();break;
    case 'close-detail':closeDetail();break;

  }
});
document.addEventListener('keydown',event=>{
  if(event.target.matches('input,textarea,select')||event.target.isContentEditable||event.metaKey||event.ctrlKey||event.altKey||event.repeat)return;
  if(event.key==='Escape'){closeDetail();return;}
  if(!state.sim)return;
  const digit=/^Numpad[0-9]$/.test(event.code)?event.code.slice(-1):event.key;
  if(/^[1-9]$/.test(digit)){event.preventDefault();toggle(Number(digit));}
  else if(event.key.toLowerCase()==='a')send('simulate',{action:'all'});
  else if(digit==='0'){event.preventDefault();send('simulate',{action:'clear'});}
});
if(params.has('fps')){
  const meter=document.createElement('div');meter.className='fps';app.append(meter);let last=performance.now(),frames=0,start=last,longest=0;
  function measure(t){longest=Math.max(longest,t-last);last=t;frames++;if(t-start>1000){meter.textContent=`${Math.round(frames*1000/(t-start))} FPS · 最長幀 ${longest.toFixed(1)} ms`;start=t;frames=0;longest=0;}requestAnimationFrame(measure);}requestAnimationFrame(measure);
}
