import {moveSymmetricSlot} from './table-layout.js';
import {DEVICES,LEFT,RIGHT,WALL_HUB,SCREEN,TABLE_HUB,SLOTS} from './devices.js';
import {WALL_ROUTES,wallRoutes,between,svgPoints,framePaths} from './geometry.js';
import {wallSilhouette} from './wall-silhouettes.js';
import {WARP_DEVICES,identityQuad,validQuad,quadCssMatrix} from './wall-warp.js';
import {wallPreset} from './wall-preset.js';
import {ipadPreset} from './ipad-preset.js';
import {tablePreset} from './table-preset.js';
const clone=v=>structuredClone(v);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Resize one edge while keeping its opposite edge and the other axis fixed.
export function resizeWallFrame(box,edge,dx,dy,snap=v=>v){
 const b=clone(box),right=b[0]+b[2],bottom=b[1]+b[3];
 if(edge==='left'){b[0]=clamp(snap(b[0]+dx,false),Math.max(0,right-1920),right-20);b[2]=right-b[0];}
 if(edge==='right')b[2]=clamp(snap(right+dx,false)-b[0],20,1920);
 if(edge==='top'){b[1]=clamp(snap(b[1]+dy,true),Math.max(0,bottom-1080),bottom-20);b[3]=bottom-b[1];}
 if(edge==='bottom')b[3]=clamp(snap(bottom+dy,true)-b[1],20,1080);
 return b;
}
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const baseSlots=clone(SLOTS),baseHub=clone(TABLE_HUB),baseBoxes=Object.fromEntries(DEVICES.map(d=>[d.id,clone(d.box)]));
const common={lineWidth:.014063,beamWidth:.013542,minCorePx:2};
export const defaults={
 wall:{...common,blocks:{...baseBoxes,hub:clone(WALL_HUB),screen:clone(SCREEN)},frame:[130,50,1610,985,31],vlines:[310,460,625,760,1150,1290,1435,1600],hlines:[335,550,760,900],panels:Object.fromEntries(DEVICES.map(d=>[d.id,{box:clone(d.panel),source:d.id,hidden:false}])),panelText:{title:15,rowGap:15},panelPad:[10,10,10,10]},
 table:{...common,sensingOffset:[0,0],phoneScale:1,projection:{on:true,width:1390,height:600,corners:[120,120,120,120],maskOn:true,maskWidth:220,maskHeight:80,maskX:0,maskBottom:0,maskRadius:16},panelPct:28.125,slotSize:116,hubSize:360,slots:clone(SLOTS),hub:clone(TABLE_HUB),bg:{on:true,spread:100,strength:.45,drift:9,speed:1.4,points:[{x:34,y:20,color:'#1b4fa8'},{x:90,y:66,color:'#1f6b72'},{x:18,y:92,color:'#3a2e7a'}]}},
 ipad:{...common,ringR:10,hubR:58,dotSize:7}
};
defaults.wall.showFrame=true;
defaults.wall.frameWidth=common.lineWidth;
defaults.wall.previewImages=false;
defaults.wall.imageOpacity=100;
defaults.wall.images=Object.fromEntries(DEVICES.map(d=>[d.id,{scale:1}]));
defaults.wall.maskQuads=Object.fromEntries(WARP_DEVICES.map(id=>[id,identityQuad()]));
defaults.wall.iconQuads=clone(defaults.wall.maskQuads);
defaults.wall.frameQuad=identityQuad();
defaults.wall.photoQuads=clone(defaults.wall.maskQuads);
Object.assign(defaults.wall,clone(wallPreset.tuning));
for(const layer of ['maskQuads','photoQuads','iconQuads'])for(const id of ['hub','screen'])defaults.wall[layer][id]=identityQuad();
Object.assign(defaults.ipad,clone(ipadPreset.tuning));
Object.assign(defaults.table,clone(tablePreset.tuning));
defaults.table.bg.quad=clone(tablePreset.tuning.bg?.quad||identityQuad());
defaults.table.projection.offsetY=tablePreset.tuning.projection?.offsetY??0;
defaults.table.projection.maskQuad=clone(tablePreset.tuning.projection?.maskQuad||identityQuad());
for(const role of ['table','ipad'])defaults[role].homeCopy={
 title:{text:'AI 大腦控制塔',size:116},
 instruction:{text:'請拿取前方設備裝置，放置相對的感應範圍，\n開始將居家設備連結到 AI 大腦！',size:role==='table'?22:30}
};
export const defaultPositions={wall:clone(wallPreset.positions||{}),table:clone(tablePreset.positions),ipad:clone(ipadPreset.positions)};
// Accept only known settings; custom panels have a separately validated schema.
function merge(base,raw){
 if(typeof base==='number')return Number.isFinite(raw)?clamp(raw,-10000,10000):base;
 if(typeof base==='boolean')return typeof raw==='boolean'?raw:base;
 if(typeof base==='string')return typeof raw==='string'&&/^#[0-9a-f]{6}$/i.test(raw)?raw:base;
 if(Array.isArray(base))return base.map((v,i)=>merge(v,raw?.[i]));
 return Object.fromEntries(Object.entries(base).map(([k,v])=>[k,merge(v,raw?.[k])]));
}
export function loadTuning(role){
 if(role==='table'){
  const revision='2026-10-13-table-tuning-recalibrated';
  try{
   if(localStorage.getItem('f2-table-preset-revision')!==revision){
    const tuning=localStorage.getItem('f2-tuning-table'),positions=localStorage.getItem('f2-layout-table');
    if(tuning||positions)localStorage.setItem('f2-table-backup-before-'+revision,JSON.stringify({tuning,positions}));
    localStorage.setItem('f2-tuning-table',JSON.stringify(tablePreset.tuning));
    localStorage.setItem('f2-layout-table',JSON.stringify(tablePreset.positions||{}));
    localStorage.setItem('f2-table-preset-revision',revision);
   }
  }catch{}
 }
 if(role==='wall'){
  const revision='2026-10-13-wall-tuning-5';
  try{
   if(localStorage.getItem('f2-wall-preset-revision')!==revision){
    const tuning=localStorage.getItem('f2-tuning-wall'),positions=localStorage.getItem('f2-layout-wall');
    if(tuning||positions)localStorage.setItem('f2-wall-backup-before-'+revision,JSON.stringify({tuning,positions}));
    localStorage.setItem('f2-tuning-wall',JSON.stringify(wallPreset.tuning));
    localStorage.setItem('f2-layout-wall',JSON.stringify(wallPreset.positions||{}));
    localStorage.setItem('f2-wall-preset-revision',revision);
   }
  }catch{}
 }
 let raw;try{raw=JSON.parse(localStorage.getItem('f2-tuning-'+role)||'null');}catch{}
 const t=merge(defaults[role],raw);
 if(t.homeCopy)for(const key of ['title','instruction']){
  if(typeof raw?.homeCopy?.[key]?.text==='string')t.homeCopy[key].text=raw.homeCopy[key].text.slice(0,2000);
  t.homeCopy[key].size=clamp(t.homeCopy[key].size,8,200);
 }
 if(role==='wall')for(const id of WARP_DEVICES){
  if(!validQuad(t.maskQuads[id]))t.maskQuads[id]=identityQuad();
  if(!raw?.photoQuads?.[id])t.photoQuads[id]=clone(t.maskQuads[id]);
  else if(!validQuad(t.photoQuads[id]))t.photoQuads[id]=identityQuad();
  if(!raw?.iconQuads?.[id])t.iconQuads[id]=clone(t.maskQuads[id]);
  else if(!validQuad(t.iconQuads[id]))t.iconQuads[id]=identityQuad();
 }
 if(role==='wall')t.imageOpacity=clamp(t.imageOpacity,0,100);
 if(role==='wall'&&!validQuad(t.frameQuad))t.frameQuad=identityQuad();
 if(role==='wall')t.frameWidth=clamp(Number.isFinite(raw?.frameWidth)?raw.frameWidth:defaults.wall.frameWidth,0,.04);
 if(role==='wall'&&raw?.panels){for(const[id,p]of Object.entries(raw.panels)){if(!/^(custom-[\w-]+|hrv|ac|dehum|purifier|sensor|light|socket|curtain|bathfan)$/.test(id)||!DEVICES.some(d=>d.id===p?.source))continue;t.panels[id]={source:p.source,hidden:!!p.hidden,box:merge([150,100,150,140],p.box)};}}
 t.lineWidth=clamp(t.lineWidth,0,.04);t.beamWidth=clamp(t.beamWidth,0,.04);t.minCorePx=clamp(t.minCorePx,1,5);
 if(role==='table'){if(!validQuad(t.projection.maskQuad)||t.projection.maskQuad.some(p=>p.some(v=>v<0||v>1)))t.projection.maskQuad=identityQuad();t.projection.offsetY=clamp(t.projection.offsetY,-2000,2000);if(!validQuad(t.bg.quad)||t.bg.quad.some(p=>p.some(v=>v<0||v>1)))t.bg.quad=identityQuad();t.projection.on=true;t.projection.maskBottom=0;t.phoneScale=clamp(t.phoneScale,.25,2);t.projection.corners.fill(t.projection.corners[0]);t.slotSize=clamp(t.slotSize,40,200);t.hubSize=clamp(t.hubSize,100,600);t.panelPct=clamp(t.panelPct,15,55);}
 if(role==='ipad'){t.ringR=clamp(t.ringR,4,40);t.hubR=clamp(t.hubR,8,100);t.dotSize=clamp(t.dotSize,4,40);}
 return t;
}
export function createEditor({role,stage,scene,tune,positions,refresh,notify,initialOpen=false,onSensingOffset=()=>{}}){
 const storage='f2-tuning-'+role,positionKey='f2-layout-'+role;
 let open=false,selected=role==='wall'?'block:hrv':role==='table'?'slot:0':'node:hrv',tab=role==='wall'?'block':'layout',drag=null,warpLayer='maskQuads',backgroundWarp=false,maskWarp=false;
 const panel=document.createElement('aside');panel.className='tuning-editor';panel.setAttribute('aria-label',`${role} 版面編輯器`);
 const sensingHandle=role==='table'?document.createElement('div'):null;
 if(sensingHandle){sensingHandle.className='sensing-edit-handle';sensingHandle.innerHTML='<span>整個感應區 · 拖曳框線移動</span>'+['top','right','bottom','left'].map(edge=>`<i data-sensing-edge="${edge}"></i>`).join('');stage.append(sensingHandle);}
 const phoneHandle=role==='table'?document.createElement('div'):null;
 if(phoneHandle){phoneHandle.className='phone-edit-handle';phoneHandle.innerHTML='<span>手機畫面 · 拖移</span><i data-phone-resize title="拖曳等比例縮放"></i>';stage.append(phoneHandle);}
 const tableInfo=role==='table'?scene.parentElement.querySelector('#info-panel'):null;
 const overlay=document.createElement('div');overlay.className='tuning-overlay';scene.append(overlay);
 const backgroundOverlay=role==='table'?document.createElement('div'):null;
 if(backgroundOverlay){backgroundOverlay.className='tuning-overlay background-edit-overlay';stage.parentElement.parentElement.append(backgroundOverlay);}
 document.querySelector('#app').append(panel);
 let savedPanel;try{savedPanel=JSON.parse(localStorage.getItem('f2-editor-position-'+role)||'null');}catch{}
 if(savedPanel){panel.style.left=clamp(savedPanel[0],0,Math.max(0,innerWidth-350))+'px';panel.style.top=clamp(savedPanel[1],0,Math.max(0,innerHeight-80))+'px';panel.style.right='auto';}
 const save=()=>{try{localStorage.setItem(storage,JSON.stringify(tune));localStorage.setItem(positionKey,JSON.stringify(positions));}catch{notify('瀏覽器無法儲存，請匯出 JSON 保留設定。');}};
 const apply=()=>{dispatchEvent(new Event('f-home-copy'));applyGeometry();if(role==='table')background();refresh();drawHandles();save();};
 let backgroundWarpFrame=0;
 function paintBackgroundWarp(){
  backgroundWarpFrame=0;
  const surface=stage.parentElement,w=surface.clientWidth,h=surface.clientHeight;
  const plane=surface.querySelector('.table-background-plane');
  if(plane)plane.style.transform=quadCssMatrix(tune.bg.quad,w,h);
  backgroundOverlay.querySelector('polygon')?.setAttribute('points',tune.bg.quad.map(([x,y])=>`${x*w},${y*h}`).join(' '));
  backgroundOverlay.querySelectorAll('[data-bg-corner]').forEach(el=>{const [x,y]=tune.bg.quad[+el.dataset.bgCorner];el.style.left=x*w+'px';el.style.top=y*h+'px';});
  panel.querySelectorAll('[data-bg-corner]').forEach(el=>{const a=+el.dataset.bgAxis;if(document.activeElement!==el)el.value=Math.round(tune.bg.quad[+el.dataset.bgCorner][a]*(a?tune.projection.height:tune.projection.width)*10)/10;});
 }
 function queueBackgroundWarp(){if(!backgroundWarpFrame)backgroundWarpFrame=requestAnimationFrame(paintBackgroundWarp);}

 const num=(path,label,min,max,step=1)=>{const v=get(path);return `<label class="tune-row"><span>${label}</span><input data-path="${path}" type="range" min="${min}" max="${max}" step="${step}" value="${v}"><input aria-label="${label}" data-path="${path}" type="number" min="${min}" max="${max}" step="${step}" value="${v}"></label>`;};
 const get=p=>p.split('.').reduce((v,k)=>v[k],tune);
 const set=(p,v)=>{const keys=p.split('.'),key=keys.pop();keys.reduce((v,k)=>v[k],tune)[key]=v;};
 function objects(){
  if(role==='wall')return [...Object.keys(tune.blocks).map(id=>({id:'block:'+id,label:DEVICES.find(d=>d.id===id)?.label||({hub:'中樞',screen:'螢幕'}[id]),box:tune.blocks[id],center:true})),{id:'frame',label:'外框',box:tune.frame},...Object.entries(tune.panels).filter(([,p])=>!p.hidden).map(([id,p])=>({id:'panel:'+id,label:(DEVICES.find(d=>d.id===p.source)?.label||id)+' 資料面板',box:p.box}))];
  if(role==='table')return [...tune.slots.map((p,i)=>({id:'slot:'+i,label:'NFC '+(i+1),box:[...p,tune.slotSize,tune.slotSize],center:true,point:p})),{id:'table-hub',label:'中樞',box:[...tune.hub,tune.hubSize,tune.hubSize],center:true,point:tune.hub},{id:'info',label:'資訊面板',box:[...(positions.info||[38,24]),1920*tune.panelPct/100,950],position:'info'},...tune.bg.points.map((p,i)=>({id:'bg:'+i,label:'漸層色點 '+(i+1),box:[p.x*stage.parentElement.clientWidth/100,p.y*stage.parentElement.clientHeight/100,30,30],center:true,bg:p}))];
  return [...DEVICES.map(d=>({id:'node:'+d.id,label:d.label,box:[...(positions['node-'+d.id]||[d.pos[0]*1920,d.pos[1]*1080]),44,44],center:true,position:'node-'+d.id})),{id:'hub',label:'AI 大腦',box:[...(positions.hub||[990,555]),tune.hubR*2,tune.hubR*2],center:true,position:'hub'},...[LEFT,RIGHT].flatMap((ids,r)=>ids.map((id,i)=>({id:'card:'+id,label:DEVICES.find(d=>d.id===id).label+' 卡片',box:[...(positions['card-'+id]||[r?1570:40,60+i*(r?290:220)]),300,94],position:'card-'+id})))];
 }
 function selectedFields(){const o=objects().find(o=>o.id===selected);if(!o)return '';return `<label class="tune-select">編輯物件<select data-select>${objects().filter(o=>role!=='wall'||(tab==='block'?o.id.startsWith('block:'):tab==='panel'?o.id.startsWith('panel:'):o.id==='frame')).map(o=>`<option value="${o.id}" ${o.id===selected?'selected':''}>${esc(o.label)}</option>`).join('')}</select></label><div class="tune-coordinates">${['X','Y',...(role==='wall'?['寬','高']:[])].map((label,i)=>`<label>${label}<input type="number" data-coordinate="${i}" value="${Math.round(o.box[i]*10)/10}" step="${(role==='wall'||role==='table')?.1:1}"></label>`).join('')}</div>`;}
 function ui(){
 if(role==='wall'&&['block:hub','block:screen'].includes(selected))warpLayer='maskQuads';
 let body=role==='table'?'':selectedFields();
 if(tune.homeCopy)body+=`<h3>首頁文案</h3>${role==='table'?'<button data-cmd="home-preview">切換首頁／版面預覽</button>':''}<p>依類別調整內容與字級；Enter 換行，清空可隱藏該段文字。R 返回首頁。</p>`+[['title','主標題'],['instruction','操作說明']].map(([key,label])=>`<h4>${label}</h4><label>${label}內容<textarea aria-label="${label}內容" data-home-text="${key}" maxlength="2000" rows="3">${esc(tune.homeCopy[key].text)}</textarea></label>`+num(`homeCopy.${key}.size`,label+'字級',8,200,1)).join('');
 if(role==='wall'){
  if(tab==='block'){
   body+=`<h3>家電圖片 / Mapping</h3><p>感應後自動顯示對應家電圖片，移除後隱藏。</p><label><input type="checkbox" data-image-flag="previewImages" ${tune.previewImages?'checked':''}>未感應也顯示圖片（現場校正）</label>`;
   body+=num('imageOpacity','全部家電圖片透明度 %',0,100,1)+`<p>100% 為原圖，數值越低越淡；僅調整家電圖片。</p>`;
   const id=selected.startsWith('block:')?selected.slice(6):null;
   if(tune.images[id])body+=`<p>目前家電：${esc(DEVICES.find(d=>d.id===id).label)}</p>`+num(`images.${id}.scale`,'圖片／輪廓倍率',.2,3,.01)+`<p>倍率同步縮放圖片與輪廓；支援四角校正的家電，遮罩、圖片與動態 icon 可分層校正。中樞與螢幕也可獨立校正黑塊四角。</p>`;
   if(id==='hub'||id==='screen')body+=`<h3>黑塊四角校正</h3><p>拖曳青色四角調整梯形，僅改變此黑塊。</p><button data-cmd="reset-quad">還原黑塊四角</button>`;
   else if(WARP_DEVICES.includes(id))body+=`<h3>分層四角變形</h3><label class="tune-select">變形圖層<select data-warp-layer aria-label="變形圖層"><option value="maskQuads" ${warpLayer==='maskQuads'?'selected':''}>家電遮罩</option><option value="photoQuads" ${warpLayer==='photoQuads'?'selected':''}>家電圖片</option><option value="iconQuads" ${warpLayer==='iconQuads'?'selected':''}>動態 icon</option></select></label><p>目前調整：${warpLayer==='maskQuads'?'家電遮罩（青色）':warpLayer==='photoQuads'?'家電圖片（橘色）':'動態 icon（紫色）'}。拖曳四角只改變此層；其他兩層保持不動。Alt 取消吸附。原本虛線框的移動／尺寸仍共同調整整台。</p><button data-cmd="reset-quad">還原此層四角</button>${warpLayer!=='maskQuads'?'<button data-cmd="align-layer">此層對齊遮罩</button>':''}`;
  }
  if(tab==='frame')body+=`<p>拖曳四角紅色十字，只校正框架與框架連接光線，不移動家電及資料面板。</p><button data-cmd="reset-frame-quad">還原框架四角</button>`+`<label><input type="checkbox" data-setting-flag="showFrame" ${tune.showFrame?'checked':''}>顯示外框格線</label>`+num('frameWidth','背景框架粗細',0,.04,.0005)+num('frame.4','外框圓角',0,200)+`<p>拖曳外框四邊可分別調整寬高，對邊保持不動；拖曳框內移動整個外框，右下角同時調整寬高。橘色格線可個別移動。背景粗細只影響外框與格線。</p>`;
  if(tab==='panel')body+=`<div class="tune-actions"><button data-cmd="add">新增面板</button><button data-cmd="delete">刪除選取</button><button data-cmd="restore">還原刪除</button><button data-cmd="unify">統一為選取尺寸</button><button data-cmd="common">統一為常用尺寸</button></div>`+num('panelText.title','標題字級',6,30)+num('panelText.rowGap','資料列間距',10,60)+['上','右','下','左'].map((s,i)=>num('panelPad.'+i,s+'內距',0,60)).join('');
 }else if(role==='table'){
 body+=`<h3>整體畫面位置</h3><p>負值往上、正值往下；背景、內容、感應圈與遮罩一起移動。超出投影畫面的部分會被裁切。</p>`+num('projection.offsetY','整體上下位移',-2000,2000,.1)+`<button data-cmd="reset-table-offset">還原上下位置</button><h3>投影範圍與 iPad 遮罩</h3><p>拖曳感應區框線移動整區；框內可拖曳 NFC 與核心。NFC 1↔9、2↔8、3↔7、4↔6 以 5 號為中線鏡像移動。以 1390 × 600 為基準；保留物件原始比例，向外延伸背景。黑塊固定貼底，拖曳內部可左右移動，上下邊調整高度、左右邊調整寬度。尺寸與圓角使用相同基準單位。</p>`+num('projection.width','投影寬度',400,4000,.1)+num('projection.height','投影高度',200,2000,.1)+num('projection.corners.0','圓角大小',0,300,.1)+`<label><input type="checkbox" data-setting-flag="projection.maskOn" ${tune.projection.maskOn?'checked':''}>啟用底部黑色遮罩</label>`+`<h3>底部遮罩四角校正</h3><button data-cmd="mask-warp" aria-pressed="${maskWarp}">${maskWarp?'結束遮罩四角校正':'編輯遮罩四角'}</button><button data-cmd="reset-mask-warp">還原遮罩四角</button><p>拖曳四角向內調整黑色遮罩；僅影響遮罩。最小單位 0.1。</p>${maskWarp?tune.projection.maskQuad.map((p,i)=>`<div class="tune-coordinates"><span>${['左上','右上','右下','左下'][i]}</span>${p.map((v,a)=>`<label>${a?'Y':'X'}<input type="number" aria-label="遮罩${['左上','右上','右下','左下'][i]}${a?'Y':'X'}" data-table-mask-corner="${i}" data-mask-axis="${a}" min="0" max="${a?tune.projection.maskHeight:tune.projection.maskWidth}" step="0.1" value="${Math.round(v*(a?tune.projection.maskHeight:tune.projection.maskWidth)*10)/10}"></label>`).join('')}</div>`).join(''):''}`+num('phoneScale','手機畫面倍率',.25,2,.01)+num('slotSize','九個 NFC 圈統一直徑',40,200,.1)+num('hubSize','中樞直徑',100,600,.1)+`<button data-cmd="orbit">恢復感應圈與中樞位置</button><h3>背景梯形校正</h3><button data-cmd="background-warp" aria-pressed="${backgroundWarp}">${backgroundWarp?'結束背景四角校正':'編輯背景四角'}</button><button data-cmd="reset-background-warp">還原背景四角</button><p>拖曳青色四角，僅校正漸層背景。內容、感應圈與底部遮罩保持原樣；數值單位與投影寬高一致。</p>${backgroundWarp?tune.bg.quad.map((p,i)=>`<div class="tune-coordinates"><span>${['左上','右上','右下','左下'][i]}</span>${p.map((v,a)=>`<label>${a?'Y':'X'}<input type="number" aria-label="背景${['左上','右上','右下','左下'][i]}${a?'Y':'X'}" data-bg-corner="${i}" data-bg-axis="${a}" min="0" max="${a?tune.projection.height:tune.projection.width}" step="0.1" value="${Math.round(v*(a?tune.projection.height:tune.projection.width)*10)/10}"></label>`).join('')}</div>`).join(''):''}<h3>背景漸層</h3><label><input data-bg-on type="checkbox" ${tune.bg.on?'checked':''}>啟用漸層</label>`+num('bg.spread','擴散半徑',20,160)+num('bg.strength','濃度',0,1,.01)+`<p>背景為靜態漸層，僅在調整色點時更新。</p>`+tune.bg.points.map((p,i)=>`<label class="tune-color">色點 ${i+1}<input type="color" data-color="${i}" value="${p.color}"></label>`+num(`bg.points.${i}.x`,'X %',0,100,.5)+num(`bg.points.${i}.y`,'Y %',0,100,.5)).join('');
 }else body+=num('ringR','節點外圈半徑',4,40)+num('hubR','中樞環半徑',8,100)+num('dotSize','節點白點直徑',4,40);
 body+=`<h3>範例版發光線</h3>`+num('lineWidth','外圈／格線粗細',0,.04,.0005)+num('beamWidth','流動光束粗細',0,.04,.0005)+num('minCorePx','最小亮芯 px',1,5,.1);
 panel.innerHTML=`<header class="tune-head"><strong>${role.toUpperCase()} · E 編輯器</strong><button data-cmd="collapse" aria-label="收合">收合</button><button data-cmd="close" aria-label="關閉">關閉</button></header><div class="tune-body">${role==='wall'?`<nav>${[['block','家電遮罩'],['frame','外框格線'],['panel','資料面板']].map(([k,n])=>`<button data-tab="${k}" aria-pressed="${tab===k}">${n}</button>`).join('')}</nav>`:''}<p>${(role==='wall'||role==='table')?'拖曳步距 0.1；方向鍵每次 0.1，Shift＋方向鍵每次 1，Alt 取消吸附。':'拖曳校正；方向鍵微調，Shift 加速，Alt 取消吸附。'}按住 H 暫看原畫面。設定自動儲存在此瀏覽器。</p>${body}<footer class="tune-actions"><button data-cmd="export">匯出 JSON</button><button data-cmd="copy">複製設定</button><button data-cmd="import">匯入 JSON</button><button data-cmd="reset">恢復本介面預設</button></footer><input type="file" data-import accept="application/json,.json" hidden></div>`;
 
 }
 function drawSensingHandle(){
  if(!sensingHandle)return;sensingHandle.hidden=!open||backgroundWarp||maskWarp;if(!open||backgroundWarp||maskWarp)return;
  const bounds=[...scene.querySelectorAll('.slot,.table-core,.core-caption')].filter(el=>getComputedStyle(el).visibility!=='hidden').map(el=>el.getBoundingClientRect()).filter(r=>r.width&&r.height);
  if(!bounds.length){sensingHandle.hidden=true;return;}
  const rect=stage.getBoundingClientRect(),scale=rect.width/1920,pad=20;
  const left=(Math.min(...bounds.map(r=>r.left))-rect.left)/scale-pad,top=(Math.min(...bounds.map(r=>r.top))-rect.top)/scale-pad;
  const right=(Math.max(...bounds.map(r=>r.right))-rect.left)/scale+pad,bottom=(Math.max(...bounds.map(r=>r.bottom))-rect.top)/scale+pad;
  sensingHandle.style.cssText=`left:${left}px;top:${top}px;width:${right-left}px;height:${bottom-top}px`;
 }
 if(sensingHandle)sensingHandle.addEventListener('pointerdown',e=>{
  if(!open||!e.target.closest('[data-sensing-edge]'))return;e.preventDefault();e.stopPropagation();
  drag={sensing:true,start:[e.clientX,e.clientY],offset:clone(tune.sensingOffset)};
  sensingHandle.setPointerCapture(e.pointerId);
 });
 function drawPhoneHandle(){
  if(!phoneHandle)return;
  const phone=stage.querySelector('.table-report-phone');phoneHandle.hidden=!open||backgroundWarp||maskWarp||!phone;
  if(!open||backgroundWarp||maskWarp||!phone)return;
  const a=stage.getBoundingClientRect(),b=phone.getBoundingClientRect(),scale=a.width/1920;
  phoneHandle.style.cssText=`left:${(b.left-a.left)/scale}px;top:${(b.top-a.top)/scale}px;width:${b.width/scale}px;height:${b.height/scale}px`;
 }
 if(phoneHandle)phoneHandle.addEventListener('pointerdown',e=>{
  if(!open)return;e.preventDefault();e.stopPropagation();
  selected='info';const rect=phoneHandle.getBoundingClientRect();
  drag={phone:true,resize:!!e.target.closest('[data-phone-resize]'),start:[e.clientX,e.clientY],position:clone(positions.info||[38,24]),phoneScale:tune.phoneScale,width:rect.width,height:rect.height,offset:[parseFloat(phoneHandle.style.left)-(positions.info||[38,24])[0],parseFloat(phoneHandle.style.top)-(positions.info||[38,24])[1]]};
  phoneHandle.setPointerCapture(e.pointerId);
 });
 function drawHandles(){
  if(backgroundOverlay){backgroundOverlay.style.cssText=stage.parentElement.style.cssText;backgroundOverlay.style.background='transparent';backgroundOverlay.style.overflow='visible';backgroundOverlay.style.borderRadius='0';backgroundOverlay.style.zIndex='60';}
  drawPhoneHandle();drawSensingHandle();overlay.replaceChildren();backgroundOverlay?.replaceChildren();if(!open||(role==='wall'&&tab==='frame'&&tune.showFrame===false))return;
  if(role==='table'&&maskWarp){
   const p=tune.projection,surface=stage.parentElement,sx=surface.clientWidth/p.width,sy=surface.clientHeight/p.height;
   const left=p.width/2+p.maskX-p.maskWidth/2,top=p.height-p.maskHeight;
   const corners=p.maskQuad.map(([x,y])=>[(left+x*p.maskWidth)*sx,(top+y*p.maskHeight)*sy]);
   const guide=document.createElementNS('http://www.w3.org/2000/svg','svg');guide.classList.add('mask-quad-guide');guide.style.width='100%';guide.style.height='100%';guide.setAttribute('viewBox',`0 0 ${surface.clientWidth} ${surface.clientHeight}`);
   guide.innerHTML=`<polygon points="${corners.map(p=>p.join(',')).join(' ')}"/>`;backgroundOverlay.append(guide);
   corners.forEach(([x,y],i)=>{const h=document.createElement('button');h.className='mask-corner table-bg-corner';h.dataset.tableMaskCorner=i;h.ariaLabel=h.title=['左上','右上','右下','左下'][i]+'底部遮罩角點';h.textContent=i+1;h.style.cssText=`left:${x}px;top:${y}px`;backgroundOverlay.append(h);});return;
  }
  if(role==='table'&&backgroundWarp){
   const surface=stage.parentElement,w=surface.clientWidth,h=surface.clientHeight;
   const guide=document.createElementNS('http://www.w3.org/2000/svg','svg');guide.classList.add('mask-quad-guide');guide.style.width='100%';guide.style.height='100%';guide.setAttribute('viewBox',`0 0 ${w} ${h}`);
   guide.innerHTML=`<polygon points="${tune.bg.quad.map(([x,y])=>`${x*w},${y*h}`).join(' ')}"/>`;backgroundOverlay.append(guide);
   tune.bg.quad.forEach(([x,y],i)=>{const handle=document.createElement('button');handle.className='mask-corner table-bg-corner';handle.dataset.bgCorner=i;handle.ariaLabel=handle.title=['左上','右上','右下','左下'][i]+'背景角點';handle.textContent=i+1;handle.style.cssText=`left:${x*w}px;top:${y*h}px`;backgroundOverlay.append(handle);});
   return;
  }
  if(role==='table'&&document.body.classList.contains('editing-home'))return;
  for(const o of objects()){ 
   if(role==='table'&&o.id==='info')continue;
   if(role==='wall'&&!(tab==='block'?o.id.startsWith('block:'):tab==='panel'?o.id.startsWith('panel:'):o.id==='frame'))continue;
   const[x,y,w,h]=o.box,el=document.createElement('div');el.className='tuning-handle'+(o.id===selected?' selected':'');el.dataset.editObject=o.id;el.style.cssText=`left:${x-(o.center?w/2:0)}px;top:${y-(o.center?h/2:0)}px;width:${w}px;height:${h}px`;el.innerHTML=`<span>${esc(o.label)}</span>${role==='wall'?'<i data-resize title="拖曳調整尺寸"></i>':''}`;(o.bg&&backgroundOverlay?backgroundOverlay:overlay).append(el);
   if(o.id==='frame')el.insertAdjacentHTML('beforeend',['top','right','bottom','left'].map(edge=>`<b class="frame-resize-edge" data-frame-edge="${edge}" title="拖曳${{top:'上',right:'右',bottom:'下',left:'左'}[edge]}邊調整外框"></b>`).join(''));
  }
  if(role==='wall'&&tab==='block'&&WARP_DEVICES.includes(selected.slice(6))){
   const id=selected.slice(6),shape=wallSilhouette(DEVICES.find(d=>d.id===id)||{id},tune,warpLayer);
   const guide=document.createElementNS('http://www.w3.org/2000/svg','svg');guide.classList.add('mask-quad-guide');guide.dataset.warpLayer=warpLayer;guide.setAttribute('viewBox','0 0 1920 1080');
   guide.innerHTML=`<polygon points="${shape.corners.map(p=>p.join(',')).join(' ')}"/>`;overlay.append(guide);
   shape.corners.forEach(([x,y],i)=>{const handle=document.createElement('button');handle.className='mask-corner';handle.dataset.warpLayer=warpLayer;handle.dataset.editObject=selected;handle.dataset.maskCorner=i;handle.title=handle.ariaLabel=['左上','右上','右下','左下'][i]+(warpLayer==='maskQuads'?'遮罩':warpLayer==='photoQuads'?'圖片':'動態 icon')+'角點';handle.textContent=i+1;handle.style.cssText=`left:${x}px;top:${y}px`;overlay.append(handle);});
  }
  if(role==='wall'&&tab==='frame'){
   const [x,y,w,h]=tune.frame;
   tune.frameQuad.forEach(([u,v],i)=>{const handle=document.createElement('button');handle.className='frame-cross';handle.dataset.frameCorner=i;handle.ariaLabel=['左上','右上','右下','左下'][i]+'框架十字';handle.style.cssText=`left:${x+u*w}px;top:${y+v*h}px`;overlay.append(handle);});
  }
  if(role==='wall'&&tab==='frame')for(const[key,vertical]of [['vlines',true],['hlines',false]])tune[key].forEach((v,i)=>{const el=document.createElement('div');el.className='tuning-line '+(vertical?'vertical':'horizontal');el.dataset.editLine=key+':'+i;el.style.cssText=vertical?`left:${v}px;top:${tune.frame[1]}px;height:${tune.frame[3]}px`:`top:${v}px;left:${tune.frame[0]}px;width:${tune.frame[2]}px`;overlay.append(el);});
 }
 function setOpen(v){if(v&&!open&&role==='table')document.body.classList.toggle('editing-home',!!stage.querySelector('#welcome'));open=v;if(!v)document.body.classList.remove('editing-home');panel.hidden=!open;overlay.hidden=!open;if(backgroundOverlay)backgroundOverlay.hidden=!open;document.body.classList.toggle('editing',open);document.body.classList.remove('tuning-peek');if(role==='table')refresh();ui();drawHandles();if(role==='ipad')scene.querySelectorAll('.graph-node').forEach(n=>n.disabled=!open&&!n.classList.contains('active'));}
 panel.addEventListener('input',e=>{
  const el=e.target;if(el.dataset.homeText){tune.homeCopy[el.dataset.homeText].text=el.value.slice(0,2000);dispatchEvent(new Event('f-home-copy'));save();return;}if(el.dataset.path){if(el.value===''||!Number.isFinite(+el.value))return;const value=clamp(+el.value,+el.min,+el.max);set(el.dataset.path,value);if(el.dataset.path==='projection.corners.0')tune.projection.corners.fill(value);panel.querySelectorAll(`[data-path="${el.dataset.path}"]`).forEach(n=>{if(n!==el)n.value=value;});}
  else if(el.dataset.tableMaskCorner!==undefined){
   if(el.value===''||!Number.isFinite(+el.value))return;
   const q=clone(tune.projection.maskQuad),a=+el.dataset.maskAxis,size=a?tune.projection.maskHeight:tune.projection.maskWidth;
   q[+el.dataset.tableMaskCorner][a]=clamp(+el.value/Math.max(size,.1),0,1);if(!validQuad(q))return;
   tune.projection.maskQuad=q;dispatchEvent(new Event('f-table-projection'));drawHandles();save();return;
  }
  else if(el.dataset.bgCorner!==undefined){
   if(el.value===''||!Number.isFinite(+el.value))return;
   const q=clone(tune.bg.quad),axis=+el.dataset.bgAxis;q[+el.dataset.bgCorner][axis]=clamp(+el.value/(axis?tune.projection.height:tune.projection.width),0,1);
   if(!validQuad(q))return;tune.bg.quad=q;queueBackgroundWarp();save();return;
  }
  else if(el.matches('[data-bg-on]'))tune.bg.on=el.checked;
  else if(el.dataset.imageFlag)set(el.dataset.imageFlag,el.checked);
  else if(el.dataset.settingFlag)set(el.dataset.settingFlag,el.checked);
  else if(el.dataset.color!==undefined)tune.bg.points[+el.dataset.color].color=el.value;
  else if(el.dataset.coordinate!==undefined){const o=objects().find(o=>o.id===selected);if(!o||el.value===''||!Number.isFinite(+el.value))return;const b=clone(o.box);b[+el.dataset.coordinate]=+el.value;move(o,b);}
  else return;
  if(el.dataset.path?.startsWith('homeCopy.')){dispatchEvent(new Event('f-home-copy'));save();return;}
  if(el.dataset.path==='projection.offsetY'){dispatchEvent(new Event('f-table-projection'));drawHandles();save();return;}
  apply();
 });
 panel.addEventListener('change',async e=>{
  if(e.target.matches('[data-warp-layer]')){warpLayer=e.target.value;ui();drawHandles();}
  if(e.target.matches('[data-select]')){selected=e.target.value;ui();drawHandles();}
  if(e.target.matches('[data-import]')&&e.target.files[0]){try{const data=JSON.parse(await e.target.files[0].text());if(data.version!==2||data.view!==role||!data.tuning)throw Error();localStorage.setItem(storage,JSON.stringify(data.tuning));const p={};for(const[k,v]of Object.entries(data.positions||{}))if(/^(hub|info|node-[\w-]+|card-[\w-]+|panel-[\w-]+)$/.test(k)&&Array.isArray(v)&&v.length===2&&v.every(Number.isFinite))p[k]=v;localStorage.setItem(positionKey,JSON.stringify(p));location.reload();}catch{notify('匯入失敗：請選擇此介面匯出的 2.0 JSON。');}}
 });
 panel.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.tab){tab=b.dataset.tab;selected=tab==='block'?'block:hrv':tab==='frame'?'frame':'panel:'+Object.keys(tune.panels).find(k=>!tune.panels[k].hidden);ui();drawHandles();return;}
  const cmd=b.dataset.cmd;
  if(cmd==='reset-frame-quad'){tune.frameQuad=identityQuad();apply();ui();return;}
  if(cmd==='home-preview'){document.body.classList.toggle('editing-home');refresh();drawHandles();return;}
  if(cmd==='mask-warp'){maskWarp=!maskWarp;backgroundWarp=false;if(maskWarp)tune.projection.maskOn=true;dispatchEvent(new Event('f-table-projection'));save();ui();drawHandles();return;}
  if(cmd==='reset-mask-warp'){tune.projection.maskQuad=identityQuad();dispatchEvent(new Event('f-table-projection'));save();ui();drawHandles();return;}
  if(cmd==='reset-table-offset'){tune.projection.offsetY=0;dispatchEvent(new Event('f-table-projection'));drawHandles();save();ui();return;}
  if(cmd==='background-warp'){backgroundWarp=!backgroundWarp;maskWarp=false;ui();drawHandles();return;}
  if(cmd==='reset-background-warp')tune.bg.quad=identityQuad();
  if(cmd==='close')return setOpen(false);
  if(cmd==='collapse'){panel.classList.toggle('collapsed');return;}
  if(cmd==='import'){panel.querySelector('[data-import]').click();return;}
  const data=JSON.stringify({version:2,view:role,tuning:tune,positions},null,2);
  if(cmd==='copy'){try{await navigator.clipboard.writeText(data);notify('已複製完整設定。');}catch{notify('剪貼簿不可用，請使用匯出 JSON。');}return;}
  if(cmd==='export'){const url=URL.createObjectURL(new Blob([data],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`f2-${role}-tuning.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
  if(cmd==='reset'){if(!confirm('恢復此介面預設？目前設定會被清除，建議先匯出。'))return;for(const k of Object.keys(tune))delete tune[k];Object.assign(tune,clone(defaults[role]));for(const k of Object.keys(positions))delete positions[k];Object.assign(positions,clone(defaultPositions[role]));}
  if(cmd==='reset-quad'&&WARP_DEVICES.includes(selected.slice(6)))tune[warpLayer][selected.slice(6)]=identityQuad();
  if(cmd==='align-layer'&&warpLayer!=='maskQuads'&&WARP_DEVICES.includes(selected.slice(6)))tune[warpLayer][selected.slice(6)]=clone(tune.maskQuads[selected.slice(6)]);
  if(cmd==='orbit'){tune.slots=clone(baseSlots);tune.hub=clone(baseHub);tune.sensingOffset=[0,0];}
  if(cmd==='add'){const id='custom-'+Date.now();tune.panels[id]={box:[800,100,150,140],source:selected.startsWith('panel:')?tune.panels[selected.slice(6)]?.source||'hrv':'hrv',hidden:false};selected='panel:'+id;}
  if(cmd==='delete'&&selected.startsWith('panel:')){tune.panels[selected.slice(6)].hidden=true;selected='panel:'+Object.keys(tune.panels).find(k=>!tune.panels[k].hidden);}
  if(cmd==='restore')for(const p of Object.values(tune.panels))p.hidden=false;
  if(cmd==='unify'||cmd==='common'){let size=objects().find(o=>o.id===selected)?.box.slice(2,4);if(cmd==='common'){const counts=new Map();for(const p of Object.values(tune.panels).filter(p=>!p.hidden)){const k=JSON.stringify(p.box.slice(2));counts.set(k,(counts.get(k)||0)+1);}const entry=[...counts].sort((a,b)=>b[1]-a[1])[0];if(entry)size=JSON.parse(entry[0]);}if(size)for(const p of Object.values(tune.panels))p.box.splice(2,2,...size);}
  apply();ui();
 });
 function move(o,b){
  if(role==='table'&&o.bg){o.bg.x=clamp(b[0]/stage.parentElement.clientWidth*100,0,100);o.bg.y=clamp(b[1]/stage.parentElement.clientHeight*100,0,100);return;}
  b[0]=clamp(b[0],0,1920);b[1]=clamp(b[1],0,role==='table'?1000:1080);
  if(role==='wall'){b[2]=clamp(b[2],20,1920);b[3]=clamp(b[3],20,1080);o.box.splice(0,4,...b.slice(0,4));}
  else if(role==='table'&&o.id.startsWith('slot:'))moveSymmetricSlot(tune.slots,Number(o.id.slice(5)),b[0],b[1]);
  else if(o.point)o.point.splice(0,2,...b.slice(0,2));
  else if(o.bg){o.bg.x=b[0]/19.2;o.bg.y=b[1]/10;}
  else positions[o.position]=b.slice(0,2);
 }
 const startObjectDrag=e=>{
  if(e.target.dataset.frameCorner!==undefined){
   e.preventDefault();e.stopPropagation();drag={frameCorner:+e.target.dataset.frameCorner,quad:clone(tune.frameQuad),start:[e.clientX,e.clientY],bounds:stage.getBoundingClientRect(),capture:e.currentTarget,pointerId:e.pointerId};e.currentTarget.setPointerCapture(e.pointerId);return;
  }
  if(role==='table'&&e.target.dataset.tableMaskCorner!==undefined){
   e.preventDefault();e.stopPropagation();const p=tune.projection,r=stage.parentElement.getBoundingClientRect();
   drag={tableMaskCorner:+e.target.dataset.tableMaskCorner,start:[e.clientX,e.clientY],quad:clone(p.maskQuad),scaleX:r.width/p.width,scaleY:r.height/p.height,capture:e.currentTarget,pointerId:e.pointerId};e.currentTarget.setPointerCapture(e.pointerId);return;
  }
  if(role==='table'&&e.target.dataset.bgCorner!==undefined){
   e.preventDefault();e.stopPropagation();drag={backgroundCorner:+e.target.dataset.bgCorner,start:[e.clientX,e.clientY],quad:clone(tune.bg.quad),bounds:stage.parentElement.getBoundingClientRect(),capture:e.currentTarget,pointerId:e.pointerId};e.currentTarget.setPointerCapture(e.pointerId);return;
  }
  const target=e.target.closest('[data-edit-object],[data-edit-line]');if(!target)return;e.preventDefault();e.stopPropagation();
  if(target.dataset.editLine)drag={line:target.dataset.editLine,start:[e.clientX,e.clientY],value:tune[target.dataset.editLine.split(':')[0]][+target.dataset.editLine.split(':')[1]]};
  else{selected=target.dataset.editObject;const o=objects().find(o=>o.id===selected);drag={o,start:[e.clientX,e.clientY],box:clone(o.box),edge:e.target.closest('[data-frame-edge]')?.dataset.frameEdge,resize:!!e.target.closest('[data-resize]'),sceneX:role==='table'&&!o.bg?new DOMMatrixReadOnly(getComputedStyle(scene).transform).m41:null};ui();
   if(e.target.dataset.maskCorner!==undefined){const id=selected.slice(6);drag.corner=+e.target.dataset.maskCorner;drag.deviceId=id;drag.warpLayer=warpLayer;drag.quad=clone(tune[warpLayer][id]);drag.shape=wallSilhouette(DEVICES.find(d=>d.id===id)||{id},tune,warpLayer);}
  }
  // Capture on the persistent overlay: handles are rebuilt on every move.
  e.currentTarget.setPointerCapture(e.pointerId);drag.capture=e.currentTarget;drag.pointerId=e.pointerId;drawHandles();
 };
 overlay.addEventListener('pointerdown',startObjectDrag);
 backgroundOverlay?.addEventListener('pointerdown',startObjectDrag);
 if(role==='table')stage.parentElement.addEventListener('pointerdown',e=>{
  const mask=e.target.closest('.table-ipad-mask');if(!open||!mask||maskWarp)return;
  e.preventDefault();e.stopPropagation();
  const p=tune.projection,r=stage.parentElement.getBoundingClientRect();
  drag={mask:true,edge:e.target.dataset.maskEdge,start:[e.clientX,e.clientY],projection:clone(p),scaleX:r.width/p.width,scaleY:r.height/p.height};
  mask.setPointerCapture(e.pointerId);
 });
 panel.addEventListener('pointerdown',e=>{if(!e.target.closest('.tune-head')||e.target.closest('button'))return;e.preventDefault();const r=panel.getBoundingClientRect();drag={panel:true,start:[e.clientX,e.clientY],box:[r.left,r.top]};});
 addEventListener('pointermove',e=>{
  if(drag?.frameCorner!==undefined){
   const q=clone(drag.quad),i=drag.frameCorner;
   const dx=(e.clientX-drag.start[0])*1920/drag.bounds.width,dy=(e.clientY-drag.start[1])*1080/drag.bounds.height;
   q[i]=[q[i][0]+Math.round(dx*10)/10/tune.frame[2],q[i][1]+Math.round(dy*10)/10/tune.frame[3]];
   if(validQuad(q)){tune.frameQuad=q;apply();}return;
  }
  if(drag?.tableMaskCorner!==undefined){
   const p=tune.projection,q=clone(drag.quad),i=drag.tableMaskCorner;
   for(let a=0;a<2;a++){const size=a?p.maskHeight:p.maskWidth,delta=((a?e.clientY:e.clientX)-drag.start[a])/(a?drag.scaleY:drag.scaleX),v=q[i][a]*size+delta;q[i][a]=clamp((e.altKey?v:Math.round(v*10)/10)/Math.max(size,.1),0,1);}
   if(validQuad(q)){p.maskQuad=q;dispatchEvent(new Event('f-table-projection'));drawHandles();}return;
  }
  if(drag?.backgroundCorner!==undefined){
   const q=clone(drag.quad),i=drag.backgroundCorner;
   for(let a=0;a<2;a++){const size=a?tune.projection.height:tune.projection.width,delta=((a?e.clientY:e.clientX)-drag.start[a])/(a?drag.bounds.height:drag.bounds.width);const value=(q[i][a]+delta)*size;q[i][a]=clamp((e.altKey?value:Math.round(value*10)/10)/size,0,1);}
   if(validQuad(q)){tune.bg.quad=q;queueBackgroundWarp();}return;
  }
  if(drag?.sensing){
   const scale=stage.getBoundingClientRect().width/1920;
   tune.sensingOffset=[clamp(drag.offset[0]+(e.clientX-drag.start[0])/scale,-1920,1920),clamp(drag.offset[1]+(e.clientY-drag.start[1])/scale,-1000,1000)];
   apply();for(const input of panel.querySelectorAll('[data-path^="sensingOffset."]'))input.value=Math.round(get(input.dataset.path));return;
  }
  if(drag?.phone){
   const scale=stage.getBoundingClientRect().width/1920,dx=e.clientX-drag.start[0],dy=e.clientY-drag.start[1];
   if(drag.resize){
    const change=Math.abs(dx/drag.width)>Math.abs(dy/drag.height)?dx/drag.width:dy/drag.height;
    tune.phoneScale=clamp(drag.phoneScale*(1+change),.25,2);
    const ratio=tune.phoneScale/drag.phoneScale;
    positions.info=drag.position.map((v,i)=>v+drag.offset[i]*(1-ratio));
   }else positions.info=[drag.position[0]+dx/scale,drag.position[1]+dy/scale];
   apply();return;
  }
  if(drag?.mask){
   const p=tune.projection,b=drag.projection,dx=(e.clientX-drag.start[0])/drag.scaleX,dy=(e.clientY-drag.start[1])/drag.scaleY;
   let left=b.width/2+b.maskX-b.maskWidth/2,right=left+b.maskWidth,bottom=b.height,top=bottom-b.maskHeight;
   if(!drag.edge){const x=clamp(dx,-left,b.width-right);left+=x;right+=x;}
   else if(drag.edge==='left')left=clamp(left+dx,0,right-10);
   else if(drag.edge==='right')right=clamp(right+dx,left+10,b.width);
   else if(drag.edge==='top')top=clamp(top+dy,0,bottom-10);
   else if(drag.edge==='bottom')top=clamp(top-dy,0,bottom-10);
   p.maskWidth=right-left;p.maskHeight=bottom-top;p.maskX=(left+right-b.width)/2;p.maskBottom=0;
   apply();for(const input of panel.querySelectorAll('[data-path^="projection.mask"]'))input.value=get(input.dataset.path);
   return;
  }
  if(!drag)return;const scale=stage.getBoundingClientRect().width/1920,dx=(e.clientX-drag.start[0])/scale,dy=(e.clientY-drag.start[1])/(stage.getBoundingClientRect().height/parseFloat(stage.style.height));
  if(drag.panel){panel.style.right='auto';panel.style.left=clamp(drag.box[0]+e.clientX-drag.start[0],0,Math.max(0,innerWidth-panel.offsetWidth))+'px';panel.style.top=clamp(drag.box[1]+e.clientY-drag.start[1],0,Math.max(0,innerHeight-50))+'px';return;}
  const snap=v=>e.altKey?v:(role==='wall'||role==='table')?Math.round(v*10)/10:Math.round(v/5)*5;
  if(drag.line){const[k,i]=drag.line.split(':');tune[k][+i]=clamp(snap(drag.value+(k==='vlines'?dx:dy),k==='hlines'),0,k==='vlines'?1920:1080);}
  else if(drag.corner!==undefined){
   const q=clone(drag.quad),i=drag.corner,s=drag.shape;
   q[i]=[(snap(s.x+q[i][0]*s.w+dx,false)-s.x)/s.w,(snap(s.y+q[i][1]*s.h+dy,true)-s.y)/s.h];
   if(validQuad(q))tune[drag.warpLayer][drag.deviceId]=q;
  }
  else if(drag.edge)move(drag.o,resizeWallFrame(drag.box,drag.edge,dx,dy,snap));
  else{const b=clone(drag.box);if(drag.resize){b[2]=snap(b[2]+dx*(drag.o.center?2:1),false);b[3]=snap(b[3]+dy*(drag.o.center?2:1),true);}else{b[0]=snap(b[0]+dx,false);b[1]=snap(b[1]+dy,true);}move(drag.o,b);}
  apply();const o=objects().find(o=>o.id===selected);if(o)panel.querySelectorAll('[data-coordinate]').forEach(n=>n.value=Math.round(o.box[+n.dataset.coordinate]*10)/10);
 });
 function stopDrag(){if(drag?.tableMaskCorner!==undefined){save();ui();}if(drag?.backgroundCorner!==undefined){cancelAnimationFrame(backgroundWarpFrame);paintBackgroundWarp();save();}if(drag?.panel){try{localStorage.setItem('f2-editor-position-'+role,JSON.stringify([parseFloat(panel.style.left),parseFloat(panel.style.top)]));}catch{}}if(drag?.capture?.hasPointerCapture(drag.pointerId))drag.capture.releasePointerCapture(drag.pointerId);drag=null;}
 addEventListener('pointerup',stopDrag);addEventListener('pointercancel',stopDrag);addEventListener('blur',()=>{stopDrag();document.body.classList.remove('tuning-peek');});
 document.addEventListener('keydown',e=>{
  if(e.metaKey||e.ctrlKey)return;
  if(open&&e.key.toLowerCase()==='h'&&!e.target.matches('textarea,input:not([type=range])')){document.body.classList.add('tuning-peek');return;}
  if(e.target.matches('input,select,textarea'))return;
  if(e.key.toLowerCase()==='e'){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)setOpen(!open);return;}
  if(open&&e.key==='Escape'){e.stopImmediatePropagation();setOpen(false);return;}
  if(open&&(backgroundWarp||maskWarp)&&e.key.startsWith('Arrow')){e.preventDefault();return;}
  if(open&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){const o=objects().find(o=>o.id===selected);if(!o)return;e.preventDefault();const b=clone(o.box),n=(role==='wall'||role==='table')?(e.shiftKey?1:.1):(e.shiftKey?10:1);b[0]+=(e.key==='ArrowRight'?n:e.key==='ArrowLeft'?-n:0);b[1]+=(e.key==='ArrowDown'?n:e.key==='ArrowUp'?-n:0);move(o,b);apply();ui();}
 },true);
 document.addEventListener('keyup',e=>{if(e.key.toLowerCase()==='h')document.body.classList.remove('tuning-peek');});
 // Prevent editing gestures from being interpreted as NFC simulation or detail clicks.
 stage.addEventListener('click',e=>{if(open){e.preventDefault();e.stopImmediatePropagation();}},true);
 function applyGeometry(){
  if(role==='wall'){
   scene.style.setProperty('--appliance-photo-opacity',String(clamp(tune.imageOpacity,0,100)/100));
   for(const d of DEVICES)d.box.splice(0,4,...tune.blocks[d.id]);WALL_HUB.splice(0,4,...tune.blocks.hub);SCREEN.splice(0,4,...tune.blocks.screen);
   const[fX,fY,fW,fH,r]=tune.frame;
   scene.querySelector('.wall-grid').innerHTML=framePaths(tune).map(points=>`<polyline points="${svgPoints(points)}"/>`).join('');
   for(const[id,b]of Object.entries(tune.blocks)){
    const[x,y,w,h]=b;
    let mask=id==='screen'?scene.querySelector('[data-screen]'):id==='hub'?scene.querySelector('[data-core]'):scene.querySelector(`[data-mask="${id}"]`);
    if(!baseBoxes[id]){
     const shape=wallSilhouette({id},tune);
     if(mask.tagName.toLowerCase()!=='path'){const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute(id==='hub'?'data-core':'data-screen','true');path.setAttribute('fill','#000');mask.replaceWith(path);mask=path;}
     mask.setAttribute('d',shape.path);continue;
    }
    const silhouette=wallSilhouette(DEVICES.find(d=>d.id===id),tune);
    if(mask.tagName.toLowerCase()!=='path'){const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.dataset.mask=id;path.setAttribute('fill','#000');mask.replaceWith(path);mask=path;}
    mask.setAttribute('d',silhouette.path);mask.setAttribute('transform',silhouette.transform);
    const photo=scene.querySelector(`[data-photo="${id}"]`);
    const photoShape=wallSilhouette(DEVICES.find(d=>d.id===id),tune,'photoQuads');
    photo.style.cssText=`left:${silhouette.x}px;top:${silhouette.y}px;width:${silhouette.w}px;height:${silhouette.h}px;object-fit:contain;transform-origin:0 0;transform:${photoShape.cssTransform};`;
    photo.classList.toggle('mapping-preview',tune.previewImages);
    const operation=scene.querySelector(`[data-operation="${id}"]`);
    const iconShape=wallSilhouette(DEVICES.find(d=>d.id===id),tune,'iconQuads');
    operation.style.cssText=`left:${silhouette.x}px;top:${silhouette.y}px;width:${silhouette.w}px;height:${silhouette.h}px;transform-origin:0 0;transform:${iconShape.cssTransform}`;
    operation.style.clipPath=`polygon(${silhouette.sourceContours[0].map(p=>`${p[0]/silhouette.w*100}% ${p[1]/silhouette.h*100}%`).join(',')})`;
    WALL_ROUTES[id]=wallRoutes(tune)[id];
    scene.querySelector(`[data-wire="${id}"]`).setAttribute('points',svgPoints(WALL_ROUTES[id]));
   }
   for(const el of scene.querySelectorAll('[data-panel]'))if(!tune.panels[el.dataset.panel])el.remove();
   for(const[id,p]of Object.entries(tune.panels)){
    let el=scene.querySelector(`[data-panel="${id}"]`);if(!el){const source=scene.querySelector(`[data-panel="${p.source}"]`);el=source.cloneNode(true);el.dataset.panel=id;delete el.dataset.move;scene.append(el);}
    const[x,y,w,h]=p.box;el.style.cssText=`left:${x}px;top:${y}px;width:${w}px;height:${h}px;padding:${tune.panelPad.map(n=>n+'px').join(' ')};${p.hidden?'display:none;':''}`;el.querySelector('h2').style.fontSize=tune.panelText.title+'px';el.querySelector('dl').style.lineHeight=tune.panelText.rowGap+'px';
   }
  }else if(role==='table'){
   tune.slots.forEach((p,i)=>SLOTS[i].splice(0,2,...p));TABLE_HUB.splice(0,2,...tune.hub);
   const ip=tableInfo,p=positions.info||[38,24];ip.style.left=p[0]+'px';ip.style.top=p[1]+'px';ip.style.width=1920*tune.panelPct/100+'px';ip.style.transformOrigin='top left';ip.style.transform=`scale(${tune.phoneScale})`;
   SLOTS.forEach((p,i)=>{const el=scene.querySelector(`[data-slot="${i+1}"]`);el.style.left=p[0]+'px';el.style.top=p[1]+'px';el.style.width=el.style.height=tune.slotSize+'px';el.querySelector('button').style.width=el.querySelector('button').style.height=tune.slotSize+'px';scene.querySelector(`[data-slot-wire="${i+1}"]`).setAttribute('points',svgPoints(between(p,TABLE_HUB,tune.slotSize/2,tune.hubSize/2)));});
   const core=scene.querySelector('.table-core');core.style.left=TABLE_HUB[0]+'px';core.style.top=TABLE_HUB[1]+'px';core.style.width=core.style.height=tune.hubSize+'px';const caption=scene.querySelector('.core-caption');caption.style.left=TABLE_HUB[0]+'px';caption.style.top=TABLE_HUB[1]+tune.hubSize/2+26+'px';
   dispatchEvent(new Event('f-table-projection'));
   alignSensingArea();
  }else{
  for(const o of objects()){ const el=o.id.startsWith('node:')?scene.querySelector(`[data-node="${o.id.slice(5)}"]`):o.id==='hub'?scene.querySelector('.graph-hub'):scene.querySelector(`[data-device="${o.id.slice(5)}"]`);el.style.left=o.box[0]+'px';el.style.top=o.box[1]+'px';}
   const hub=scene.querySelector('.graph-hub');hub.style.width=hub.style.height=tune.hubR*2+'px';scene.style.setProperty('--edit-dot',tune.dotSize+'px');
  }
 }
 // Keep the complete sensing layout centered in the space beside the phone.
 // Apply one transform so wires, icons, orb, captions and glow move together.
 function alignSensingArea(){
  const phone=stage.querySelector('.table-report-phone');
  if(!phone)return;
  const frame=stage.querySelector('.table-frame'),scale=stage.getBoundingClientRect().width/1920;
  if(!scale)return;
  const bounds=tune.slots.map(([x])=>[x-tune.slotSize/2,x+tune.slotSize/2]);
  bounds.push([tune.hub[0]-310,tune.hub[0]+310]);
  const left=Math.min(...bounds.map(b=>b[0])),right=Math.max(...bounds.map(b=>b[1]));
  const phoneRight=(phone.getBoundingClientRect().right-frame.getBoundingClientRect().left)/scale-frame.clientLeft;
  const shiftX=(phoneRight+frame.clientWidth-left-right)/2;
  // Keep the dragged object under the pointer while automatic centering changes.
  if(drag?.o&&Number.isFinite(drag.sceneX))tune.sensingOffset[0]=drag.sceneX-shiftX;
  const x=shiftX+tune.sensingOffset[0],y=-40+tune.sensingOffset[1];
  scene.style.transform=`translate(${x}px, ${y}px)`;
  onSensingOffset(x,y);drawSensingHandle();
 }
 let bgStaticKey=null;
 let backgroundLayer;
 function background(){
  if(!backgroundLayer)return;
  const b=tune.bg,key=JSON.stringify([b.on,b.spread,b.strength,b.points]);
  if(key===bgStaticKey)return;bgStaticKey=key;
  backgroundLayer.style.background=!b.on?'#16181d':b.points.map(p=>{
   const hex=p.color.slice(1),rgb=[0,2,4].map(n=>parseInt(hex.slice(n,n+2),16)).join(',');
   return `radial-gradient(circle ${b.spread*10}px at ${p.x}% ${p.y}%,rgba(${rgb},${b.strength}) 0%,rgba(${rgb},${b.strength*.88}) 15%,rgba(${rgb},${b.strength*.6}) 30%,rgba(${rgb},${b.strength*.32}) 45%,rgba(${rgb},${b.strength*.13}) 60%,rgba(${rgb},${b.strength*.04}) 75%,rgba(${rgb},${b.strength*.008}) 90%,rgba(${rgb},0) 100%)`;
  }).join(',')+',#16181d';
 }
 if(role==='wall')for(const[id,p]of Object.entries(tune.panels)){if(positions['panel-'+id]){p.box.splice(0,2,...positions['panel-'+id]);delete positions['panel-'+id];}}
 if(role==='table'){backgroundLayer=document.createElement('div');backgroundLayer.className='table-gradient-field';backgroundLayer.setAttribute('aria-hidden','true');const frame=stage.querySelector('.table-frame');frame.style.background='transparent';const plane=document.createElement('div');plane.className='table-background-plane';plane.append(backgroundLayer);frame.prepend(plane);background();}
 apply();setOpen(initialOpen);
 if(role==='table'){
  const layoutObserver=new ResizeObserver(()=>{alignSensingArea();drawPhoneHandle();});
  const phoneObserver=new MutationObserver(drawPhoneHandle);phoneObserver.observe(tableInfo,{childList:true,subtree:true});
  addEventListener('resize',drawHandles);
  addEventListener('pagehide',()=>phoneObserver.disconnect(),{once:true});
  layoutObserver.observe(tableInfo);
  addEventListener('pagehide',()=>layoutObserver.disconnect(),{once:true});
 }
 return {get open(){return open;},close:()=>setOpen(false),tune};
}
