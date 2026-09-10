import {DEVICES,BY_ID,RELATIONS,LEFT,RIGHT,WALL_HUB,SCREEN,GRAPH_HUB,TABLE_HUB,SLOTS,TIMING,TREND} from './devices.js';
import {Session} from './session.js';
import {applianceIcon} from './appliance-icons.js';
import {wallOperation} from './wall-operations.js';
import {Glow} from './glow.js';
import {createEditor,loadTuning,defaultPositions} from './editor.js';
import {wallSilhouette} from './wall-silhouettes.js';
import {createIntro} from './intro.js';
import {createDeviceAudio} from './device-audio.js';
import {createCompletionAudio} from './completion-audio.js';
import {ring,rect,between,WALL_ROUTES,svgPoints} from './geometry.js';

const params=new URLSearchParams(location.search);
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
function fit(){const scale=Math.min(innerWidth/1920,innerHeight/stageHeight);stage.style.transform=`translate(-50%,-50%) scale(${scale})`;}
addEventListener('resize',fit);fit();
const svg=(content,width=1920,height=1080,cls='scene-svg')=>`<svg class="${cls}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${content}</svg>`;
const boxMarkup=(box,extra='')=>{const[x,y,w,h]=box;return `<rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="6" fill="#000" ${extra}/>`;};
const metric=d=>d.id==='socket'?'負載功率':d.unit==='次'?(d.id==='sensor'?'偵測次數':'啟閉次數'):d.unit==='hr'?'運轉時數':'用電量';
const today=d=>d.id==='socket'?'目前負載':d.unit==='次'?(d.id==='sensor'?'今日偵測':'今日啟閉'):d.unit==='hr'?'今日運轉':'今日用電量';
const monthUnit=d=>d.id==='socket'?'kWh':d.unit;
let glow,scene,session,state,rotation,intro,completionAudio,focused=null,detail=null,completionDismissed=false;
let completionTimer=null,completionReady=false;
let overrides=structuredClone(defaultPositions[role]);
try{const raw=JSON.parse(localStorage.getItem('f2-layout-'+role)||'{}');if(raw&&typeof raw==='object'&&!Array.isArray(raw))Object.assign(overrides,raw);}catch{}
const positioned=(key,x,y)=>{const v=overrides[key];return Array.isArray(v)&&v.length===2&&v.every(Number.isFinite)?v:[x,y];};
const posStyle=(key,x,y)=>{const p=positioned(key,x,y);return `left:${p[0]}px;top:${p[1]}px`;};
// Centers chosen outside all nine sensing circles and the central core.
const TABLE_ICON_POSITIONS=[[705,600],[1030,625],[810,305],[1080,325],[1245,180],[1410,325],[1680,305],[1470,625],[1800,600]];

function buildWall(){
  stage.innerHTML=`<div id="scene" class="wall-scene"></div>`;scene=stage.querySelector('#scene');
  const frames=`<rect x="130" y="50" width="1610" height="985" rx="31"/><g>${[310,460,625,760,1150,1290,1435,1600].map(x=>`<path d="M${x} 50V1035"/>`).join('')}${[335,550,760,900].map(y=>`<path d="M130 ${y}H1740"/>`).join('')}</g>`;
  scene.innerHTML=svg(`<g class="wall-grid">${frames}</g><g id="wall-links">${DEVICES.map(d=>`<polyline data-wire="${d.id}" class="wire" points="${svgPoints(WALL_ROUTES[d.id])}"/>`).join('')}</g><g class="masks">${boxMarkup(SCREEN)}${boxMarkup(WALL_HUB,'data-core="true"')}${DEVICES.map(d=>boxMarkup(d.box,`data-mask="${d.id}"`)).join('')}</g>`);
  for(const d of DEVICES){
    const[x,y,w,h]=d.box;
    const photo=document.createElement('img');photo.className='appliance-photo';photo.dataset.photo=d.id;photo.src=`/appliances/${d.id}.webp`;photo.alt='';photo.style.cssText=`left:${x-w/2+8}px;top:${y-h/2+8}px;width:${w-16}px;height:${h-16}px`;scene.append(photo);
    const operation=document.createElement('div');operation.className='wall-operation';operation.dataset.operation=d.id;operation.style.cssText=`left:${x-w*.4}px;top:${y-h*.4}px;width:${w*.8}px;height:${h*.8}px`;operation.innerHTML=wallOperation(d.id);scene.append(operation);
    const[px,py,pw,ph]=d.panel;
    const panel=document.createElement('section');panel.className='glass wall-panel';panel.dataset.panel=d.id;panel.dataset.move='panel-'+d.id;panel.style.cssText=`${posStyle('panel-'+d.id,px,py)};width:${pw}px;height:${ph}px`;
    panel.innerHTML=`<h2>${d.label}</h2><div class="wall-code"><span>${d.code}</span><span>運轉中 ●</span></div><dl>${d.rows.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;scene.append(panel);
  }
  glow=new Glow(scene,1920,1080);
}
function buildTable(){
  stage.innerHTML=`<div class="table-frame"><div id="scene" class="table-scene"></div><aside id="info-panel" class="glass info-panel" aria-live="polite"></aside></div>`;
  scene=stage.querySelector('#scene');
  scene.innerHTML=svg(SLOTS.map((p,i)=>`<polyline class="table-wire" data-slot-wire="${i+1}" points="${svgPoints(between(p,TABLE_HUB,58,180))}"/>`).join(''),1920,1000);
  SLOTS.forEach(([x,y],i)=>{
    const item=document.createElement('div');item.className='slot';item.dataset.slot=i+1;item.style.cssText=`left:${x}px;top:${y}px`;
    item.innerHTML=`<button class="slot-circle" data-toggle="${i+1}" aria-label="感應區 ${i+1}"><span>+</span><small>${String(i+1).padStart(2,'0')}</small></button><span class="slot-label">NFC ${String(i+1).padStart(2,'0')}</span><span class="slot-device"></span>`;scene.append(item);
    const [ix,iy]=TABLE_ICON_POSITIONS[i];
    const icon=document.createElement('div');icon.className='table-slot-icon';icon.dataset.slotIcon=i+1;icon.style.cssText=`left:${ix}px;top:${iy}px`;icon.hidden=true;scene.append(icon);
    const leader=document.createElementNS('http://www.w3.org/2000/svg','polyline');leader.classList.add('slot-icon-leader');leader.dataset.iconLeader=i+1;leader.setAttribute('points',svgPoints(between([x,y],[ix,iy],65,54)));scene.querySelector('svg').append(leader);
  });
  scene.insertAdjacentHTML('beforeend',`<div class="table-core" style="left:${TABLE_HUB[0]}px;top:${TABLE_HUB[1]}px"></div><div class="core-caption" style="left:${TABLE_HUB[0]}px;top:946px">SYSTEM CORE</div>`);
  glow=new Glow(scene,1920,1000);
}
function graphPosition(id){const d=BY_ID[id];return positioned('node-'+id,d.pos[0]*1920,d.pos[1]*1080);}
function hubPosition(){return positioned('hub',...GRAPH_HUB);}
function buildIpad(){
  stage.innerHTML=`<header class="statusbar"><div class="brand"><b>F</b><span>AI 大腦控制塔</span></div><div class="status-right"><span id="complete-badge">全屋連動完成</span><span>已放置 <strong id="counter">0</strong> / 9</span><span class="connection"><i></i><span id="connection-label">連線中</span></span></div></header><div id="scene" class="graph-scene"><img class="floorplan" src="/floorplan-lineart-v2.png" alt="智慧家庭灰階空間線稿圖"><div id="graph-lines"></div></div><button class="reset" data-action="reset">↶ 重置</button>`;
  scene=stage.querySelector('#scene');
  for(const[ids,right]of [[LEFT,false],[RIGHT,true]])ids.forEach((id,i)=>{
    const d=BY_ID[id],x=right?1620:40,y=right?60+i*290:60+i*220;
    const card=document.createElement('button');card.className=`glass device-card${right?' right':''}`;card.dataset.device=id;card.dataset.move='card-'+id;card.style.cssText=posStyle('card-'+id,x,y);
    card.innerHTML=`<span class="device-indicator"></span><span class="device-copy"><span>${d.label}</span><span class="device-reading">${d.sub}</span></span>`;scene.append(card);
  });
  for(const d of DEVICES){
    const p=graphPosition(d.id);const node=document.createElement('button');node.className='graph-node';node.dataset.node=d.id;node.dataset.move='node-'+d.id;node.setAttribute('aria-label',d.label+'詳細資料');node.style.cssText=`left:${p[0]}px;top:${p[1]}px`;node.innerHTML=applianceIcon(d.id);scene.append(node);
  }
  const h=hubPosition();scene.insertAdjacentHTML('beforeend',`<div class="graph-hub" data-move="hub" style="left:${h[0]}px;top:${h[1]}px"><span>AI<br>大<br>腦</span></div><div class="completion" id="completion"><div><p>ALL SYSTEMS LINKED</p><h1>全屋家電已串聯至 AI 大腦</h1><h2>AI 正在學習你的生活方式，將自動調節出最舒適的居家情境。</h2><button data-action="view-graph">檢視連動圖</button></div></div>`);
  glow=new Glow(scene,1920,1080);
}
if(role==='wall')buildWall();else if(role==='table')buildTable();else buildIpad();
if(role!=='wall')stage.insertAdjacentHTML('beforeend',`<div class="welcome" id="welcome"><div><p class="welcome-eyebrow">歡　迎　來　到</p><h1>AI 大腦控制塔</h1><p class="welcome-instruction">請拿取前方設備裝置，放置相對的感應範圍，<br>開始將居家設備連結到 AI 大腦！</p>${role==='ipad'?'<button data-action="start">點擊任意位置開始</button>':''}</div></div>`);

const tools=document.createElement('div');tools.className='tools';
tools.innerHTML=`<details id="sim-tray"><summary><b>替代 NFC 卡片</b><span id="tray-count">0/9 已放上</span><span class="tray-arrow">展開</span></summary><div class="sim-body"><div class="preview-heading"><span>F 2.0 重製版</span><span id="server-status">連線中</span></div><p>點選卡片模擬放上／拿走，三個介面同步更新。</p><div class="sim-cards">${DEVICES.map((d,i)=>`<button data-toggle="${i+1}" title="鍵盤 ${i+1}"><small>${i+1}</small>${d.label}</button>`).join('')}</div><div class="sim-actions"><button data-action="start">開始體驗</button><button data-action="all">全部放上</button><button data-action="clear">全部拿走</button><button data-action="demo" id="demo-button">自動展示</button><button data-action="reset">重置</button></div><p class="key-help">鍵盤 1–9 放卡 · A 全放 · 0 全拿 · E 校正</p><nav><a href="http://${location.hostname}:6274/wall" target="_blank">牆面</a><a href="http://${location.hostname}:6273/table" target="_blank">桌面</a><a href="http://${location.hostname}:6275/ipad" target="_blank">iPad</a></nav></div></details>`;
app.append(tools);
const notice=document.createElement('div');notice.className='notice';notice.setAttribute('role','status');app.append(notice);
let noticeTimer;
function notify(text){notice.textContent=text;notice.classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.classList.remove('show'),3500);}

function chart(d){
  const max=Math.max(...TREND),scale=d.id==='hrv'?1:Math.max(.15,d.value/28.5);
  return `<div class="chart-caption">${monthUnit(d)}</div><div class="bar-chart"><div class="y-axis">${[50,40,30,20,10,0].map(n=>`<span>${Math.round(n*scale)}</span>`).join('')}</div><div class="bars">${TREND.map((n,i)=>`<i style="height:${n/max*100}%" title="${String(i).padStart(2,'0')}:00 ${(n*scale).toFixed(1)} ${monthUnit(d)}"></i>`).join('')}</div></div><div class="x-axis"><span>00</span><span>04</span><span>08</span><span>12</span><span>16</span><span>20</span><span>24</span></div>`;
}
function infoMarkup(d){
  if(!d)return `<h1>感應 待機 中</h1><section class="metric-box waiting-message"><div class="waiting-dots">● ● ●</div><h2>請將物件放上感應區</h2><p>感應後將顯示該家電的即時用電、累積消耗與<br>預測性維護排程</p></section><section class="metric-box system-status"><div><span>系統狀態</span><b>${state?.online?'正常運作':'連線中斷'}</b></div><div><span>資料來源</span><b>展示數據</b></div></section>`;
  const percent=Math.round(d.month/d.target*100);
  return `<h1>${d.label}${metric(d)}</h1><section class="metric-box usage"><h2>${today(d)}</h2><div class="today-value"><span><strong data-count="${d.value}">${d.value}</strong> ${d.unit}</span><span class="delta">較昨日<br><b>${d.delta<0?'↓':d.delta>0?'↑':'－'} ${Math.abs(d.delta)}%</b></span></div><div class="month"><span>本月累積${d.id==='socket'?'用電量':metric(d)}</span><span><strong data-count="${d.month}">${d.month.toLocaleString('en-US')}</strong> / 目標 ${d.target.toLocaleString('en-US')} ${monthUnit(d)}</span></div><div class="progress"><div><i style="width:${Math.min(100,percent)}%"></i></div><b data-count="${percent}" data-count-suffix="%">${percent}%</b></div></section><section class="metric-box trend"><h2>${metric(d)}趨勢</h2>${chart(d)}</section><section class="metric-box maintenance"><h2>維養排程</h2><table><thead><tr><th>項目</th><th>上次維養</th><th>下次維養</th><th>狀態</th></tr></thead><tbody>${d.maintenance.map((name,i)=>`<tr><td>${name}</td><td>2026/${['05/20','04/20','05/10','03/15'][i]}</td><td>2026/${['06/20','07/20','08/10','09/15'][i]}</td><td>${i===0?'即將到期':'正常'}</td></tr>`).join('')}</tbody></table></section>`;
}
let focusTimer=null,focusAnimations=[],metricFrame=null,metricAnimations=[];
function stopMetricEntry(){
  cancelAnimationFrame(metricFrame);metricFrame=null;
  for(const animation of metricAnimations)animation.cancel();metricAnimations=[];
}
function animateMetricEntry(panel){
  stopMetricEntry();
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const duration=1600,started=performance.now();
  const counters=Array.from(panel.querySelectorAll('[data-count]'),el=>{
    const value=Number(el.dataset.count),decimals=(String(value).split('.')[1]||'').length;
    const formatter=new Intl.NumberFormat('en-US',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
    const suffix=el.dataset.countSuffix||'';
    el.textContent=formatter.format(0)+suffix;
    return {el,value,formatter,suffix};
  });
  const options={duration,easing:'cubic-bezier(.16,1,.3,1)'};
  for(const bar of panel.querySelectorAll('.bars i')){
    bar.style.transformOrigin='center bottom';
    metricAnimations.push(bar.animate([{transform:'scaleY(0)',opacity:.25},{transform:'scaleY(1)',opacity:1}],options));
  }
  for(const fill of panel.querySelectorAll('.progress i')){
    fill.style.transformOrigin='left center';
    metricAnimations.push(fill.animate([{transform:'scaleX(0)'},{transform:'scaleX(1)'}],options));
  }
  function tick(now){
    const t=Math.min(1,(now-started)/duration),eased=1-Math.pow(1-t,4);
    for(const {el,value,formatter,suffix}of counters)el.textContent=formatter.format(t===1?value:value*eased)+suffix;
    if(t<1)metricFrame=requestAnimationFrame(tick);else metricFrame=null;
  }
  metricFrame=requestAnimationFrame(tick);
}
function updateFocus(id){
  if(role!=='table'){focused=id;return;}
  const panel=stage.querySelector('#info-panel');
  if(focused===id&&panel.childElementCount)return;
  focused=id;clearTimeout(focusTimer);focusTimer=null;
  stopMetricEntry();
  for(const animation of focusAnimations)animation.cancel();focusAnimations=[];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animateContent=(frames,options)=>{
    focusAnimations=Array.from(panel.children,el=>el.animate(frames,options));
  };
  if(!panel.childElementCount||reduced){panel.innerHTML=infoMarkup(BY_ID[id]);animateMetricEntry(panel);return;}
  animateContent([{opacity:1,transform:'translateX(0)'},{opacity:0,transform:'translateX(-40px)'}],{duration:240,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
  focusTimer=setTimeout(()=>{
    focusTimer=null;
    for(const animation of focusAnimations)animation.cancel();focusAnimations=[];
    panel.innerHTML=infoMarkup(BY_ID[id]);
    animateMetricEntry(panel);
    animateContent([{opacity:0,transform:'translateX(40px)'},{opacity:1,transform:'translateX(0)'}],{duration:460,easing:'cubic-bezier(.16,1,.3,1)'});
  },240);
}
addEventListener('pagehide',()=>{clearTimeout(focusTimer);stopMetricEntry();for(const animation of focusAnimations)animation.cancel();},{once:true});
function startRotation(){clearInterval(rotation);if(role!=='table')return;updateFocus(state.focus);rotation=setInterval(()=>{if(state.active.length<2)return;const i=state.active.indexOf(focused);updateFocus(state.active[(i+1)%state.active.length]);},TIMING.rotation);}
function addLight(paths,key,points,beam=false,width=1.8,opacity=1,period=1.5){paths.push({key,points,beam,width,opacity,period,tuneWidth:beam?tune.beamWidth:tune.lineWidth,minCorePx:tune.minCorePx,phase:paths.length*47});}
function renderWall(active){
  glow.setFrame(tune);
  const paths=[],[fx,fy,fw,fh,fr]=tune.frame;addLight(paths,'frame',rect(fx,fy,fw,fh,fr),false,1.1,.8,3);
  for(const x of tune.vlines)addLight(paths,'v'+x,[[x,fy],[x,fy+fh]],false,.8,.65,3);
  for(const y of tune.hlines)addLight(paths,'h'+y,[[fx,y],[fx+fw,y]],false,.8,.65,3);
  for(const d of DEVICES){
    const on=active.includes(d.id);scene.querySelector(`[data-panel="${d.id}"]`)?.classList.toggle('active',on);scene.querySelector(`[data-photo="${d.id}"]`).classList.toggle('active',on);scene.querySelector(`[data-wire="${d.id}"]`).classList.toggle('active',on);scene.querySelector(`[data-operation="${d.id}"]`).classList.toggle('active',on);
    if(on){wallSilhouette(d,tune).contours.forEach((points,i)=>addLight(paths,'frame-'+d.id+'-'+i,points,false,1.9));addLight(paths,'route-'+d.id,WALL_ROUTES[d.id],false,1.1,.8);addLight(paths,'packet-'+d.id,WALL_ROUTES[d.id],true,3);}
  }
  if(active.length){const[x,y,w,h]=WALL_HUB;addLight(paths,'core',rect(x-w/2,y-h/2,w,h),false,2);}
  for(const[id,p]of Object.entries(tune.panels))scene.querySelector(`[data-panel="${id}"]`)?.classList.toggle('active',active.includes(p.source));
  glow.setPaths(paths);
}
function renderTable(){
  const paths=[];
  stage.querySelector('#info-panel').classList.toggle('nfc-linked',state.active.length>0);
  SLOTS.forEach((p,i)=>{
    const s=state.slots[i+1],device=BY_ID[s?.data?.id],on=!!device;
    const icon=scene.querySelector(`[data-slot-icon="${i+1}"]`);
    if(on){
      if(icon.dataset.deviceId!==device.id){icon.innerHTML=applianceIcon(device.id);icon.dataset.deviceId=device.id;}
      icon.setAttribute('aria-label',`感應區 ${i+1}：${device.label}運作中`);icon.hidden=false;icon.classList.add('active');
    }else{
      icon.hidden=true;icon.classList.remove('active');icon.replaceChildren();delete icon.dataset.deviceId;icon.removeAttribute('aria-label');
    }
    scene.querySelector(`[data-icon-leader="${i+1}"]`).classList.toggle('active',on);
    const el=scene.querySelector(`[data-slot="${i+1}"]`);el.classList.toggle('active',on);el.classList.toggle('reader-online',!!s?.reader);el.classList.toggle('unknown',s?.known===false);
    el.querySelector('.slot-label').textContent=on?device.label:`NFC ${String(i+1).padStart(2,'0')}`;
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
    card.querySelector('.device-reading').innerHTML=on?`<strong>${d.value}</strong> <small>${d.unit}</small>`:d.sub;
    const cp=positioned('card-'+id,right?1620:40,right?60+i*290:60+i*220);
    svgLines.push(`<polyline class="leader ${on?'active':''}" points="${svgPoints([[cp[0]+(right?0:250),cp[1]+46],p])}"/>`);
    if(on){addLight(paths,'node-'+id,ring(...p,tune.ringR),false,1.3);const route=between(p,hub,tune.ringR+2,tune.hubR+2);addLight(paths,'node-link-'+id,route,false,1.4);addLight(paths,'node-packet-'+id,route,true,2.6);}
  });
  for(const[a,b,label]of RELATIONS)if(active.includes(a)&&active.includes(b)){
    const points=between(graphPosition(a),graphPosition(b),tune.ringR,tune.ringR);addLight(paths,'relation-'+a+'-'+b,points,false,1.3,.8);svgLines.push(`<polyline class="relation" points="${svgPoints(points)}"><title>${label}</title></polyline>`);
  }
  scene.querySelector('#graph-lines').innerHTML=svg(svgLines.join(''));
  scene.querySelector('.graph-hub').classList.toggle('active',active.length>0);
  if(active.length)addLight(paths,'hub',ring(...hub,tune.hubR),false,3.5);
  glow.setPaths(paths);
  stage.querySelector('#counter').textContent=active.length;
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
function render(eventType='state'){
  intro?.sync(state);
  const active=role==='wall'&&params.has('all')?DEVICES.map(d=>d.id):state.active;
  if(role==='wall')renderWall(active);else if(role==='table')renderTable();else renderGraph();
  const welcome=stage.querySelector('#welcome');if(welcome){welcome.classList.toggle('dismissed',state.session);welcome.inert=state.session;}
  tools.hidden=!state.sim||params.has('projection');
  tools.querySelector('#tray-count').textContent=`${state.active.length}/9 已放上`;
  tools.querySelector('#server-status').textContent=state.online?'三端同步已連線':'重新連線中';
  tools.querySelector('#demo-button').textContent=state.demo?'停止展示':'自動展示';
  for(const b of tools.querySelectorAll('[data-toggle]')){b.classList.toggle('selected',!!state.slots[b.dataset.toggle]?.data);b.setAttribute('aria-pressed',String(!!state.slots[b.dataset.toggle]?.data));b.disabled=!state.online;}
  if(['snapshot','tag-present','tag-remove','reader-disconnected','session-end'].includes(eventType))startRotation();
}
session=new Session(role);state=session.state;
intro=createIntro({stage,role,notify});
completionAudio=createCompletionAudio({stage,role,notify});
createDeviceAudio({session,role,notify});
session.addEventListener('change',({detail:event})=>{state=event.state;if(event.type==='audio-stop')dispatchEvent(new Event('f-stop-audio'));render(event.type);});
render();if(role==='table')updateFocus(null);
fullEditor=createEditor({role,stage,scene,tune,positions:overrides,refresh:()=>render(),notify,initialOpen:params.has('edit')});

function send(type,fields){if(!session.send(type,fields)){notify('連線中斷，正在重新連線；恢復後可繼續操作。');return false;}return true;}
function toggle(slot){if(!state.sim){notify('現場模式請使用實體 NFC 卡片。');return;}send('simulate',{action:'toggle',slot_index:Number(slot)});}
function closeDetail(){document.querySelector('.detail-backdrop')?.remove();detail=null;}
function showDetail(id){
  if(!state.active.includes(id)){notify('請先將對應家電放上感應區。');return;}
  closeDetail();detail=id;const d=BY_ID[id];
  const modal=document.createElement('div');modal.className='detail-backdrop';modal.innerHTML=`<section class="glass detail-card" role="dialog" aria-modal="true" aria-label="${d.label}詳細資料"><button class="close-detail" data-action="close-detail" aria-label="關閉">×</button><div class="detail-header"><img src="/appliances/${id}.webp" alt=""><div><p>${d.code} · 已連線</p><h1>${d.label}</h1><p>${d.sub}</p></div></div><div class="detail-body">${infoMarkup(d)}</div><h3>AI 連動關係</h3><div class="relation-list">${RELATIONS.filter(([a,b])=>a===id||b===id).map(([a,b,label])=>`<div><span>${label}</span><b>${state.active.includes(a)&&state.active.includes(b)?'已串聯':'等待設備'}</b></div>`).join('')}</div><p class="sample-label">展示數據 · 維養排程為初代內容範例</p></section>`;
  modal.addEventListener('click',e=>{if(e.target===modal)closeDetail();});app.append(modal);modal.querySelector('.close-detail').focus();
  modal.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();modal.querySelector('.close-detail').focus();}});
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
  if(event.target.matches('input,textarea,select')||event.metaKey||event.ctrlKey||event.altKey)return;
  if(event.key==='Escape'){closeDetail();return;}
  if(!state.sim)return;
  if(/^[1-9]$/.test(event.key)){event.preventDefault();toggle(Number(event.key));}
  else if(event.key.toLowerCase()==='a')send('simulate',{action:'all'});
  else if(event.key==='0')send('simulate',{action:'clear'});
});
if(params.has('fps')){
  const meter=document.createElement('div');meter.className='fps';app.append(meter);let last=performance.now(),frames=0,start=last,longest=0;
  function measure(t){longest=Math.max(longest,t-last);last=t;frames++;if(t-start>1000){meter.textContent=`${Math.round(frames*1000/(t-start))} FPS · 最長幀 ${longest.toFixed(1)} ms`;start=t;frames=0;longest=0;}requestAnimationFrame(measure);}requestAnimationFrame(measure);
}
