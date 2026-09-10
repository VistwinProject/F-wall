import {DEVICES,LEFT,RIGHT,WALL_HUB,SCREEN,TABLE_HUB,SLOTS} from './devices.js';
import {WALL_ROUTES,between,svgPoints} from './geometry.js';
import {wallSilhouette} from './wall-silhouettes.js';
import {wallPreset} from './wall-preset.js';
import {ipadPreset} from './ipad-preset.js';
import {tablePreset} from './table-preset.js';
const clone=v=>structuredClone(v);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const baseSlots=clone(SLOTS),baseHub=clone(TABLE_HUB),baseRoutes=clone(WALL_ROUTES),baseBoxes=Object.fromEntries(DEVICES.map(d=>[d.id,clone(d.box)]));
const common={lineWidth:.014063,beamWidth:.013542,minCorePx:2};
export const defaults={
 wall:{...common,blocks:{...baseBoxes,hub:clone(WALL_HUB),screen:clone(SCREEN)},frame:[130,50,1610,985,31],vlines:[310,460,625,760,1150,1290,1435,1600],hlines:[335,550,760,900],panels:Object.fromEntries(DEVICES.map(d=>[d.id,{box:clone(d.panel),source:d.id,hidden:false}])),panelText:{title:15,rowGap:15},panelPad:[10,10,10,10]},
 table:{...common,panelPct:28.125,slotSize:116,hubSize:360,slots:clone(SLOTS),hub:clone(TABLE_HUB),cards:{usage:1,trend:1.55,maintenance:1.35},font:{scale:1,title:32,stat:64,label:22,body:15},bg:{on:true,spread:100,strength:.45,drift:9,speed:1.4,points:[{x:34,y:20,color:'#1b4fa8'},{x:90,y:66,color:'#1f6b72'},{x:18,y:92,color:'#3a2e7a'}]}},
 ipad:{...common,ringR:10,hubR:58,dotSize:7}
};
defaults.wall.frameWidth=common.lineWidth;
defaults.wall.showImages=true;
defaults.wall.previewImages=false;
defaults.wall.images=Object.fromEntries(DEVICES.map(d=>[d.id,{show:true,scale:1}]));
Object.assign(defaults.wall,clone(wallPreset.tuning));
Object.assign(defaults.ipad,clone(ipadPreset.tuning));
Object.assign(defaults.table,clone(tablePreset.tuning));
export const defaultPositions={wall:{},table:clone(tablePreset.positions),ipad:clone(ipadPreset.positions)};
// Accept only known settings; custom panels have a separately validated schema.
function merge(base,raw){
 if(typeof base==='number')return Number.isFinite(raw)?clamp(raw,-10000,10000):base;
 if(typeof base==='boolean')return typeof raw==='boolean'?raw:base;
 if(typeof base==='string')return typeof raw==='string'&&/^#[0-9a-f]{6}$/i.test(raw)?raw:base;
 if(Array.isArray(base))return base.map((v,i)=>merge(v,raw?.[i]));
 return Object.fromEntries(Object.entries(base).map(([k,v])=>[k,merge(v,raw?.[k])]));
}
export function loadTuning(role){
 let raw;try{raw=JSON.parse(localStorage.getItem('f2-tuning-'+role)||'null');}catch{}
 const t=merge(defaults[role],raw);
 if(role==='wall')t.frameWidth=clamp(Number.isFinite(raw?.frameWidth)?raw.frameWidth:defaults.wall.frameWidth,0,.04);
 if(role==='wall'&&raw?.panels){for(const[id,p]of Object.entries(raw.panels)){if(!/^(custom-[\w-]+|hrv|ac|dehum|purifier|sensor|light|socket|curtain|bathfan)$/.test(id)||!DEVICES.some(d=>d.id===p?.source))continue;t.panels[id]={source:p.source,hidden:!!p.hidden,box:merge([150,100,150,140],p.box)};}}
 t.lineWidth=clamp(t.lineWidth,0,.04);t.beamWidth=clamp(t.beamWidth,0,.04);t.minCorePx=clamp(t.minCorePx,1,5);
 if(role==='table'){t.slotSize=clamp(t.slotSize,40,200);t.hubSize=clamp(t.hubSize,100,600);t.panelPct=clamp(t.panelPct,15,55);}
 if(role==='ipad'){t.ringR=clamp(t.ringR,4,40);t.hubR=clamp(t.hubR,8,100);t.dotSize=clamp(t.dotSize,4,40);}
 return t;
}
export function createEditor({role,stage,scene,tune,positions,refresh,notify,initialOpen=false}){
 const storage='f2-tuning-'+role,positionKey='f2-layout-'+role;
 let open=initialOpen,selected=role==='wall'?'block:hrv':role==='table'?'slot:0':'node:hrv',tab=role==='wall'?'block':'layout',drag=null;
 const panel=document.createElement('aside');panel.className='tuning-editor';panel.setAttribute('aria-label',`${role} 版面編輯器`);
 const badge=document.createElement('button');badge.className='edit-badge';badge.textContent='已套用編輯值 · E';
 const overlay=document.createElement('div');overlay.className='tuning-overlay';scene.append(overlay);
 document.querySelector('#app').append(panel,badge);
 let savedPanel;try{savedPanel=JSON.parse(localStorage.getItem('f2-editor-position-'+role)||'null');}catch{}
 if(savedPanel){panel.style.left=clamp(savedPanel[0],0,Math.max(0,innerWidth-350))+'px';panel.style.top=clamp(savedPanel[1],0,Math.max(0,innerHeight-80))+'px';panel.style.right='auto';}
 const save=()=>{try{localStorage.setItem(storage,JSON.stringify(tune));localStorage.setItem(positionKey,JSON.stringify(positions));}catch{notify('瀏覽器無法儲存，請匯出 JSON 保留設定。');}badge.hidden=JSON.stringify(tune)===JSON.stringify(defaults[role])&&JSON.stringify(positions)===JSON.stringify(defaultPositions[role]);};
 const apply=()=>{applyGeometry();refresh();drawHandles();save();};
 const num=(path,label,min,max,step=1)=>{const v=get(path);return `<label class="tune-row"><span>${label}</span><input data-path="${path}" type="range" min="${min}" max="${max}" step="${step}" value="${v}"><input aria-label="${label}" data-path="${path}" type="number" min="${min}" max="${max}" step="${step}" value="${v}"></label>`;};
 const get=p=>p.split('.').reduce((v,k)=>v[k],tune);
 const set=(p,v)=>{const keys=p.split('.'),key=keys.pop();keys.reduce((v,k)=>v[k],tune)[key]=v;};
 function objects(){
  if(role==='wall')return [...Object.keys(tune.blocks).map(id=>({id:'block:'+id,label:DEVICES.find(d=>d.id===id)?.label||({hub:'中樞',screen:'螢幕'}[id]),box:tune.blocks[id],center:true})),{id:'frame',label:'外框',box:tune.frame},...Object.entries(tune.panels).filter(([,p])=>!p.hidden).map(([id,p])=>({id:'panel:'+id,label:(DEVICES.find(d=>d.id===p.source)?.label||id)+' 資料面板',box:p.box}))];
  if(role==='table')return [...tune.slots.map((p,i)=>({id:'slot:'+i,label:'NFC '+(i+1),box:[...p,tune.slotSize,tune.slotSize],center:true,point:p})),{id:'table-hub',label:'中樞',box:[...tune.hub,tune.hubSize,tune.hubSize],center:true,point:tune.hub},{id:'info',label:'資訊面板',box:[...(positions.info||[38,24]),1920*tune.panelPct/100,950],position:'info'},...tune.bg.points.map((p,i)=>({id:'bg:'+i,label:'漸層色點 '+(i+1),box:[p.x*19.2,p.y*10,30,30],center:true,bg:p}))];
  return [...DEVICES.map(d=>({id:'node:'+d.id,label:d.label,box:[...(positions['node-'+d.id]||[d.pos[0]*1920,d.pos[1]*1080]),44,44],center:true,position:'node-'+d.id})),{id:'hub',label:'AI 大腦',box:[...(positions.hub||[990,555]),tune.hubR*2,tune.hubR*2],center:true,position:'hub'},...[LEFT,RIGHT].flatMap((ids,r)=>ids.map((id,i)=>({id:'card:'+id,label:DEVICES.find(d=>d.id===id).label+' 卡片',box:[...(positions['card-'+id]||[r?1620:40,60+i*(r?290:220)]),250,94],position:'card-'+id})))];
 }
 function selectedFields(){const o=objects().find(o=>o.id===selected);if(!o)return '';return `<label class="tune-select">編輯物件<select data-select>${objects().filter(o=>role!=='wall'||(tab==='block'?o.id.startsWith('block:'):tab==='panel'?o.id.startsWith('panel:'):o.id==='frame')).map(o=>`<option value="${o.id}" ${o.id===selected?'selected':''}>${esc(o.label)}</option>`).join('')}</select></label><div class="tune-coordinates">${['X','Y',...(role==='wall'?['寬','高']:[])].map((label,i)=>`<label>${label}<input type="number" data-coordinate="${i}" value="${Math.round(o.box[i]*10)/10}" step="1"></label>`).join('')}</div>`;}
 function ui(){
 let body=selectedFields();
 if(role==='wall'){
  if(tab==='block'){
   body+=`<h3>家電圖片 / Mapping</h3><label><input type="checkbox" data-image-flag="showImages" ${tune.showImages?'checked':''}>顯示家電圖片（全部）</label><br><label><input type="checkbox" data-image-flag="previewImages" ${tune.previewImages?'checked':''}>未感應也顯示圖片（現場校正）</label>`;
   const id=selected.startsWith('block:')?selected.slice(6):null;
   if(tune.images[id])body+=`<p>目前家電：${esc(DEVICES.find(d=>d.id===id).label)}</p><label><input type="checkbox" data-image-flag="images.${id}.show" ${tune.images[id].show?'checked':''}>顯示這台家電圖片</label>`+num(`images.${id}.scale`,'圖片／輪廓倍率',.2,3,.01)+`<p>圖片保留原始比例；黑色遮罩和發光外框同步縮放。中樞與螢幕保留矩形。</p>`;
  }
  if(tab==='frame')body+=num('frameWidth','背景框架粗細',0,.04,.0005)+num('frame.4','外框圓角',0,200)+`<p>背景粗細只影響外框與格線，不影響家電外框與流動光束。拖曳橘色格線調整位置；外框可移動及縮放。</p>`;
  if(tab==='panel')body+=`<div class="tune-actions"><button data-cmd="add">新增面板</button><button data-cmd="delete">刪除選取</button><button data-cmd="restore">還原刪除</button><button data-cmd="unify">統一為選取尺寸</button><button data-cmd="common">統一為常用尺寸</button></div>`+num('panelText.title','標題字級',6,30)+num('panelText.rowGap','資料列間距',10,60)+['上','右','下','左'].map((s,i)=>num('panelPad.'+i,s+'內距',0,60)).join('');
 }else if(role==='table'){
 body+=num('panelPct','左面板寬度 %',15,55,.5)+num('slotSize','感應圈直徑',40,200)+num('hubSize','中樞直徑',100,600,2)+`<button data-cmd="orbit">恢復感應圈與中樞位置</button><h3>資訊卡高度權重</h3>`+Object.keys(tune.cards).map((k,i)=>num('cards.'+k,['用量','趨勢','維養'][i],.3,4,.05)).join('')+`<output class="tune-metrics"></output><h3>文字</h3>`+num('font.scale','整體字級倍率',.6,2,.02)+num('font.title','家電標題',12,48)+num('font.stat','主數值',20,96)+num('font.label','卡片標題',10,32)+num('font.body','內文',9,28,.5)+`<h3>背景漸層</h3><label><input data-bg-on type="checkbox" ${tune.bg.on?'checked':''}>啟用漸層</label>`+num('bg.spread','擴散半徑',20,160)+num('bg.strength','濃度',0,1,.01)+num('bg.drift','漂移幅度',0,20,.5)+num('bg.speed','漂移速度',0,4,.1)+tune.bg.points.map((p,i)=>`<label class="tune-color">色點 ${i+1}<input type="color" data-color="${i}" value="${p.color}"></label>`+num(`bg.points.${i}.x`,'X %',0,100,.5)+num(`bg.points.${i}.y`,'Y %',0,100,.5)).join('');
 }else body+=num('ringR','節點外圈半徑',4,40)+num('hubR','中樞環半徑',8,100)+num('dotSize','節點白點直徑',4,40);
 body+=`<h3>範例版發光線</h3>`+num('lineWidth','外圈／格線粗細',0,.04,.0005)+num('beamWidth','流動光束粗細',0,.04,.0005)+num('minCorePx','最小亮芯 px',1,5,.1);
 panel.innerHTML=`<header class="tune-head"><strong>${role.toUpperCase()} · E 編輯器</strong><button data-cmd="collapse" aria-label="收合">收合</button><button data-cmd="close" aria-label="關閉">關閉</button></header><div class="tune-body">${role==='wall'?`<nav>${[['block','家電遮罩'],['frame','外框格線'],['panel','資料面板']].map(([k,n])=>`<button data-tab="${k}" aria-pressed="${tab===k}">${n}</button>`).join('')}</nav>`:''}<p>拖曳校正；方向鍵微調，Shift 加速，Alt 取消吸附。按住 H 暫看原畫面。設定自動儲存在此瀏覽器。</p>${body}<footer class="tune-actions"><button data-cmd="export">匯出 JSON</button><button data-cmd="copy">複製設定</button><button data-cmd="import">匯入 JSON</button><button data-cmd="reset">恢復本介面預設</button></footer><input type="file" data-import accept="application/json,.json" hidden></div>`;
 updateMetrics();
 }
 function drawHandles(){
  overlay.replaceChildren();if(!open)return;
  for(const o of objects()){
   if(role==='wall'&&!(tab==='block'?o.id.startsWith('block:'):tab==='panel'?o.id.startsWith('panel:'):o.id==='frame'))continue;
   const[x,y,w,h]=o.box,el=document.createElement('div');el.className='tuning-handle'+(o.id===selected?' selected':'');el.dataset.editObject=o.id;el.style.cssText=`left:${x-(o.center?w/2:0)}px;top:${y-(o.center?h/2:0)}px;width:${w}px;height:${h}px`;el.innerHTML=`<span>${esc(o.label)}</span>${role==='wall'?'<i data-resize title="拖曳調整尺寸"></i>':''}`;overlay.append(el);
  }
  if(role==='wall'&&tab==='frame')for(const[key,vertical]of [['vlines',true],['hlines',false]])tune[key].forEach((v,i)=>{const el=document.createElement('div');el.className='tuning-line '+(vertical?'vertical':'horizontal');el.dataset.editLine=key+':'+i;el.style.cssText=vertical?`left:${v}px;top:${tune.frame[1]}px;height:${tune.frame[3]}px`:`top:${v}px;left:${tune.frame[0]}px;width:${tune.frame[2]}px`;overlay.append(el);});
 }
 function setOpen(v){open=v;panel.hidden=!open;overlay.hidden=!open;document.body.classList.toggle('editing',open);document.body.classList.remove('tuning-peek');ui();drawHandles();if(role==='ipad')scene.querySelectorAll('.graph-node').forEach(n=>n.disabled=!open&&!n.classList.contains('active'));}
 badge.addEventListener('click',()=>setOpen(true));
 panel.addEventListener('input',e=>{
  const el=e.target;if(el.dataset.path){if(el.value===''||!Number.isFinite(+el.value))return;const value=clamp(+el.value,+el.min,+el.max);set(el.dataset.path,value);panel.querySelectorAll(`[data-path="${el.dataset.path}"]`).forEach(n=>{if(n!==el)n.value=value;});}
  else if(el.matches('[data-bg-on]'))tune.bg.on=el.checked;
  else if(el.dataset.imageFlag)set(el.dataset.imageFlag,el.checked);
  else if(el.dataset.color!==undefined)tune.bg.points[+el.dataset.color].color=el.value;
  else if(el.dataset.coordinate!==undefined){const o=objects().find(o=>o.id===selected);if(!o||el.value===''||!Number.isFinite(+el.value))return;const b=clone(o.box);b[+el.dataset.coordinate]=+el.value;move(o,b);}
  else return;apply();updateMetrics();
 });
 panel.addEventListener('change',async e=>{
  if(e.target.matches('[data-select]')){selected=e.target.value;ui();drawHandles();}
  if(e.target.matches('[data-import]')&&e.target.files[0]){try{const data=JSON.parse(await e.target.files[0].text());if(data.version!==2||data.view!==role||!data.tuning)throw Error();localStorage.setItem(storage,JSON.stringify(data.tuning));const p={};for(const[k,v]of Object.entries(data.positions||{}))if(/^(hub|info|node-[\w-]+|card-[\w-]+|panel-[\w-]+)$/.test(k)&&Array.isArray(v)&&v.length===2&&v.every(Number.isFinite))p[k]=v;localStorage.setItem(positionKey,JSON.stringify(p));location.reload();}catch{notify('匯入失敗：請選擇此介面匯出的 2.0 JSON。');}}
 });
 panel.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.tab){tab=b.dataset.tab;selected=tab==='block'?'block:hrv':tab==='frame'?'frame':'panel:'+Object.keys(tune.panels).find(k=>!tune.panels[k].hidden);ui();drawHandles();return;}
  const cmd=b.dataset.cmd;
  if(cmd==='close')return setOpen(false);
  if(cmd==='collapse'){panel.classList.toggle('collapsed');return;}
  if(cmd==='import'){panel.querySelector('[data-import]').click();return;}
  const data=JSON.stringify({version:2,view:role,tuning:tune,positions},null,2);
  if(cmd==='copy'){try{await navigator.clipboard.writeText(data);notify('已複製完整設定。');}catch{notify('剪貼簿不可用，請使用匯出 JSON。');}return;}
  if(cmd==='export'){const url=URL.createObjectURL(new Blob([data],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`f2-${role}-tuning.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
  if(cmd==='reset'){if(!confirm('恢復此介面預設？目前設定會被清除，建議先匯出。'))return;for(const k of Object.keys(tune))delete tune[k];Object.assign(tune,clone(defaults[role]));for(const k of Object.keys(positions))delete positions[k];Object.assign(positions,clone(defaultPositions[role]));}
  if(cmd==='orbit'){tune.slots=clone(baseSlots);tune.hub=clone(baseHub);}
  if(cmd==='add'){const id='custom-'+Date.now();tune.panels[id]={box:[800,100,150,140],source:selected.startsWith('panel:')?tune.panels[selected.slice(6)]?.source||'hrv':'hrv',hidden:false};selected='panel:'+id;}
  if(cmd==='delete'&&selected.startsWith('panel:')){tune.panels[selected.slice(6)].hidden=true;selected='panel:'+Object.keys(tune.panels).find(k=>!tune.panels[k].hidden);}
  if(cmd==='restore')for(const p of Object.values(tune.panels))p.hidden=false;
  if(cmd==='unify'||cmd==='common'){let size=objects().find(o=>o.id===selected)?.box.slice(2,4);if(cmd==='common'){const counts=new Map();for(const p of Object.values(tune.panels).filter(p=>!p.hidden)){const k=JSON.stringify(p.box.slice(2));counts.set(k,(counts.get(k)||0)+1);}const entry=[...counts].sort((a,b)=>b[1]-a[1])[0];if(entry)size=JSON.parse(entry[0]);}if(size)for(const p of Object.values(tune.panels))p.box.splice(2,2,...size);}
  apply();ui();
 });
 function move(o,b){
  b[0]=clamp(b[0],0,1920);b[1]=clamp(b[1],0,role==='table'?1000:1080);
  if(role==='wall'){b[2]=clamp(b[2],20,1920);b[3]=clamp(b[3],20,1080);o.box.splice(0,4,...b.slice(0,4));}
  else if(o.point)o.point.splice(0,2,...b.slice(0,2));
  else if(o.bg){o.bg.x=b[0]/19.2;o.bg.y=b[1]/10;}
  else positions[o.position]=b.slice(0,2);
 }
 overlay.addEventListener('pointerdown',e=>{
  const target=e.target.closest('[data-edit-object],[data-edit-line]');if(!target)return;e.preventDefault();e.stopPropagation();
  if(target.dataset.editLine)drag={line:target.dataset.editLine,start:[e.clientX,e.clientY],value:tune[target.dataset.editLine.split(':')[0]][+target.dataset.editLine.split(':')[1]]};
  else{selected=target.dataset.editObject;const o=objects().find(o=>o.id===selected);drag={o,start:[e.clientX,e.clientY],box:clone(o.box),resize:!!e.target.closest('[data-resize]')};ui();}
 });
 panel.addEventListener('pointerdown',e=>{if(!e.target.closest('.tune-head')||e.target.closest('button'))return;e.preventDefault();const r=panel.getBoundingClientRect();drag={panel:true,start:[e.clientX,e.clientY],box:[r.left,r.top]};});
 addEventListener('pointermove',e=>{
  if(!drag)return;const scale=stage.getBoundingClientRect().width/1920,dx=(e.clientX-drag.start[0])/scale,dy=(e.clientY-drag.start[1])/scale;
  if(drag.panel){panel.style.right='auto';panel.style.left=clamp(drag.box[0]+e.clientX-drag.start[0],0,Math.max(0,innerWidth-panel.offsetWidth))+'px';panel.style.top=clamp(drag.box[1]+e.clientY-drag.start[1],0,Math.max(0,innerHeight-50))+'px';return;}
  const snap=(v,axis)=>e.altKey?v:Math.round(v/(role==='table'?(axis?5:9.6):5))*(role==='table'?(axis?5:9.6):5);
  if(drag.line){const[k,i]=drag.line.split(':');tune[k][+i]=clamp(snap(drag.value+(k==='vlines'?dx:dy),k==='hlines'),0,k==='vlines'?1920:1080);}
  else{const b=clone(drag.box);if(drag.resize){b[2]=snap(b[2]+dx*(drag.o.center?2:1),false);b[3]=snap(b[3]+dy*(drag.o.center?2:1),true);}else{b[0]=snap(b[0]+dx,false);b[1]=snap(b[1]+dy,true);}move(drag.o,b);}
  apply();const o=objects().find(o=>o.id===selected);if(o)panel.querySelectorAll('[data-coordinate]').forEach(n=>n.value=Math.round(o.box[+n.dataset.coordinate]*10)/10);
 });
 function stopDrag(){if(drag?.panel){try{localStorage.setItem('f2-editor-position-'+role,JSON.stringify([parseFloat(panel.style.left),parseFloat(panel.style.top)]));}catch{}}drag=null;}
 addEventListener('pointerup',stopDrag);addEventListener('pointercancel',stopDrag);addEventListener('blur',()=>{stopDrag();document.body.classList.remove('tuning-peek');});
 document.addEventListener('keydown',e=>{
  if(e.metaKey||e.ctrlKey)return;
  if(open&&e.key.toLowerCase()==='h'&&!e.target.matches('textarea,input:not([type=range])')){document.body.classList.add('tuning-peek');return;}
  if(e.target.matches('input,select,textarea'))return;
  if(e.key.toLowerCase()==='e'){e.preventDefault();e.stopImmediatePropagation();setOpen(!open);return;}
  if(open&&e.key==='Escape'){e.stopImmediatePropagation();setOpen(false);return;}
  if(open&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){const o=objects().find(o=>o.id===selected);if(!o)return;e.preventDefault();const b=clone(o.box),n=e.shiftKey?10:1;b[0]+=(e.key==='ArrowRight'?n:e.key==='ArrowLeft'?-n:0);b[1]+=(e.key==='ArrowDown'?n:e.key==='ArrowUp'?-n:0);move(o,b);apply();ui();}
 },true);
 document.addEventListener('keyup',e=>{if(e.key.toLowerCase()==='h')document.body.classList.remove('tuning-peek');});
 // Prevent editing gestures from being interpreted as NFC simulation or detail clicks.
 stage.addEventListener('click',e=>{if(open){e.preventDefault();e.stopImmediatePropagation();}},true);
 function applyGeometry(){
  if(role==='wall'){
   for(const d of DEVICES)d.box.splice(0,4,...tune.blocks[d.id]);WALL_HUB.splice(0,4,...tune.blocks.hub);SCREEN.splice(0,4,...tune.blocks.screen);
   const[fX,fY,fW,fH,r]=tune.frame;
   scene.querySelector('.wall-grid').innerHTML=`<rect x="${fX}" y="${fY}" width="${fW}" height="${fH}" rx="${r}"/>${tune.vlines.map(x=>`<path d="M${x} ${fY}V${fY+fH}"/>`).join('')}${tune.hlines.map(y=>`<path d="M${fX} ${y}H${fX+fW}"/>`).join('')}`;
   for(const[id,b]of Object.entries(tune.blocks)){
    const[x,y,w,h]=b;
    let mask=id==='screen'?scene.querySelector('.masks rect'):id==='hub'?scene.querySelector('[data-core]'):scene.querySelector(`[data-mask="${id}"]`);
    if(!baseBoxes[id])for(const[k,v]of Object.entries({x:x-w/2,y:y-h/2,width:w,height:h}))mask.setAttribute(k,v);
    if(!baseBoxes[id])continue;
    const silhouette=wallSilhouette(DEVICES.find(d=>d.id===id),tune);
    if(mask.tagName.toLowerCase()!=='path'){const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.dataset.mask=id;path.setAttribute('fill','#000');mask.replaceWith(path);mask=path;}
    mask.setAttribute('d',silhouette.path);mask.setAttribute('transform',silhouette.transform);
    const photo=scene.querySelector(`[data-photo="${id}"]`);
    photo.style.cssText=`left:${silhouette.x}px;top:${silhouette.y}px;width:${silhouette.w}px;height:${silhouette.h}px;object-fit:contain;${!tune.showImages||!tune.images[id].show?'display:none;':''}`;
    photo.classList.toggle('mapping-preview',tune.previewImages);
    const operation=scene.querySelector(`[data-operation="${id}"]`);
    operation.style.cssText=`left:${silhouette.x}px;top:${silhouette.y}px;width:${silhouette.w}px;height:${silhouette.h}px`;
    operation.style.clipPath=`polygon(${silhouette.contours[0].map(p=>`${(p[0]-silhouette.x)/silhouette.w*100}% ${(p[1]-silhouette.y)/silhouette.h*100}%`).join(',')})`;
    const route=baseRoutes[id],a=baseBoxes[id],hb=defaults.wall.blocks.hub;
    // Preserve the original route shape while moving both anchors continuously.
    WALL_ROUTES[id]=route.map((p,i)=>{const t=i/(route.length-1);return [p[0]+(x-a[0])*(1-t)+(WALL_HUB[0]-hb[0])*t,p[1]+(y-a[1])*(1-t)+(WALL_HUB[1]-hb[1])*t];});
    scene.querySelector(`[data-wire="${id}"]`).setAttribute('points',svgPoints(WALL_ROUTES[id]));
   }
   for(const el of scene.querySelectorAll('[data-panel]'))if(!tune.panels[el.dataset.panel])el.remove();
   for(const[id,p]of Object.entries(tune.panels)){
    let el=scene.querySelector(`[data-panel="${id}"]`);if(!el){const source=scene.querySelector(`[data-panel="${p.source}"]`);el=source.cloneNode(true);el.dataset.panel=id;delete el.dataset.move;scene.append(el);}
    const[x,y,w,h]=p.box;el.style.cssText=`left:${x}px;top:${y}px;width:${w}px;height:${h}px;padding:${tune.panelPad.map(n=>n+'px').join(' ')};${p.hidden?'display:none;':''}`;el.querySelector('h2').style.fontSize=tune.panelText.title+'px';el.querySelector('dl').style.lineHeight=tune.panelText.rowGap+'px';
   }
  }else if(role==='table'){
   tune.slots.forEach((p,i)=>SLOTS[i].splice(0,2,...p));TABLE_HUB.splice(0,2,...tune.hub);
   const ip=stage.querySelector('#info-panel'),p=positions.info||[38,24];ip.style.left=p[0]+'px';ip.style.top=p[1]+'px';ip.style.width=1920*tune.panelPct/100+'px';
   for(const[k,v]of Object.entries(tune.font))if(k!=='scale')ip.style.setProperty('--edit-'+k,v*tune.font.scale+'px');
   SLOTS.forEach((p,i)=>{const el=scene.querySelector(`[data-slot="${i+1}"]`);el.style.left=p[0]+'px';el.style.top=p[1]+'px';el.style.width=el.style.height=tune.slotSize+'px';el.querySelector('button').style.width=el.querySelector('button').style.height=tune.slotSize+'px';scene.querySelector(`[data-slot-wire="${i+1}"]`).setAttribute('points',svgPoints(between(p,TABLE_HUB,tune.slotSize/2,tune.hubSize/2)));});
   const core=scene.querySelector('.table-core');core.style.left=TABLE_HUB[0]+'px';core.style.top=TABLE_HUB[1]+'px';core.style.width=core.style.height=tune.hubSize+'px';const caption=scene.querySelector('.core-caption');caption.style.left=TABLE_HUB[0]+'px';caption.style.top=TABLE_HUB[1]+tune.hubSize/2+26+'px';
   placeIcons();styleCards();
  }else{
   for(const o of objects()){const el=o.id.startsWith('node:')?scene.querySelector(`[data-node="${o.id.slice(5)}"]`):o.id==='hub'?scene.querySelector('.graph-hub'):scene.querySelector(`[data-device="${o.id.slice(5)}"]`);el.style.left=o.box[0]+'px';el.style.top=o.box[1]+'px';}
   const hub=scene.querySelector('.graph-hub');hub.style.width=hub.style.height=tune.hubR*2+'px';scene.style.setProperty('--edit-dot',tune.dotSize+'px');
  }
 }
 function placeIcons(){
  const used=[],ip=stage.querySelector('#info-panel'),left=parseFloat(ip.style.left),right=left+parseFloat(ip.style.width),top=parseFloat(ip.style.top);
  SLOTS.forEach((p,i)=>{
   let result=null;
   for(let radius=tune.slotSize/2+86;radius<700&&!result;radius+=38)for(let j=0;j<32;j++){
    const a=-Math.PI/2+j*Math.PI/16,q=[p[0]+Math.cos(a)*radius,p[1]+Math.sin(a)*radius];
    if(q[0]<52||q[0]>1868||q[1]<52||q[1]>948||(q[0]>left-55&&q[0]<right+55&&q[1]>top-55&&q[1]<top+1005))continue;
    if(SLOTS.some(s=>Math.hypot(q[0]-s[0],q[1]-s[1])<tune.slotSize/2+70)||Math.hypot(q[0]-TABLE_HUB[0],q[1]-TABLE_HUB[1])<tune.hubSize/2+70||used.some(s=>Math.hypot(q[0]-s[0],q[1]-s[1])<110))continue;
    result=q;break;
   }
   const icon=scene.querySelector(`[data-slot-icon="${i+1}"]`),leader=scene.querySelector(`[data-icon-leader="${i+1}"]`);icon.style.visibility=result?'':'hidden';leader.style.visibility=result?'':'hidden';
   if(result){used.push(result);icon.style.left=result[0]+'px';icon.style.top=result[1]+'px';leader.setAttribute('points',svgPoints(between(p,result,tune.slotSize/2+7,54)));}
  });
 }
 function styleCards(){const ip=stage.querySelector('#info-panel');for(const[k,v]of Object.entries(tune.cards)){const el=ip?.querySelector('.'+k);if(el)el.style.flexGrow=v;}updateMetrics();}
 function updateMetrics(){if(role!=='table')return;requestAnimationFrame(()=>{const output=panel.querySelector('.tune-metrics'),ip=stage.querySelector('#info-panel');if(!output||!ip)return;const scale=stage.getBoundingClientRect().width/1920,sum=Object.values(tune.cards).reduce((a,b)=>a+b,0),rows=Object.keys(tune.cards).map(k=>{const e=ip.querySelector('.'+k);return e?`${({usage:'用量',trend:'趨勢',maintenance:'維養'})[k]}：要求 ${Math.round(tune.cards[k]/sum*100)}% / 實際 ${Math.round(e.getBoundingClientRect().height/scale)}px`:'';}).filter(Boolean);output.textContent=rows.join('\n')+(ip.scrollHeight>ip.clientHeight+2?'\n內容超出面板，請縮小字級或增加可用空間。':'');});}
 let bgFrame,bgLast=0;
 function background(time){bgFrame=requestAnimationFrame(background);if(role!=='table'||time-bgLast<50)return;bgLast=time;const b=tune.bg;const frame=stage.querySelector('.table-gradient-field');if(!b.on){frame.style.background='#16181d';return;}frame.style.background=b.points.map((p,i)=>{const angle=Math.atan2(p.y-50,p.x-50)-time*.000065*b.speed, radius=Math.min(47,Math.hypot(p.x-50,p.y-50)),motion=open?0:Math.min(1,Math.max(0,b.drift/9)),dx=(50+Math.cos(angle)*radius-p.x)*motion,dy=(50+Math.sin(angle)*radius-p.y)*motion;const hex=p.color.slice(1),rgb=[0,2,4].map(n=>parseInt(hex.slice(n,n+2),16)).join(',');return `radial-gradient(circle ${b.spread*10}px at ${p.x+dx}% ${p.y+dy}%,rgba(${rgb},${b.strength}) 0%,rgba(${rgb},${b.strength*.88}) 15%,rgba(${rgb},${b.strength*.6}) 30%,rgba(${rgb},${b.strength*.32}) 45%,rgba(${rgb},${b.strength*.13}) 60%,rgba(${rgb},${b.strength*.04}) 75%,rgba(${rgb},${b.strength*.008}) 90%,rgba(${rgb},0) 100%)`;}).join(',')+',#16181d';}
 if(role==='wall')for(const[id,p]of Object.entries(tune.panels)){if(positions['panel-'+id]){p.box.splice(0,2,...positions['panel-'+id]);delete positions['panel-'+id];}}
 if(role==='table'){const backgroundLayer=document.createElement('div');backgroundLayer.className='table-gradient-field';backgroundLayer.setAttribute('aria-hidden','true');const frame=stage.querySelector('.table-frame');frame.style.background='#16181d';frame.prepend(backgroundLayer);const observer=new MutationObserver(styleCards);observer.observe(stage.querySelector('#info-panel'),{childList:true});requestAnimationFrame(background);addEventListener('pagehide',()=>{observer.disconnect();cancelAnimationFrame(bgFrame);},{once:true});}
 apply();setOpen(open);
 return {get open(){return open;},tune};
}
