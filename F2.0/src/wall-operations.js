import {mappingDrawings} from './mapping-operations.js';
// Functional cutaways, not product-specific teardown drawings. No outer housings.
const route=(d,tone='cool',speed=2.8)=>`<g class="op-${tone}"><path class="op-duct" d="${d}"/><path class="op-stream" d="${d}" style="--speed:${speed}s"/>${[0,1,2].map(i=>`<path class="op-tracer" d="M-3-2 0 0-3 2" style="offset-path:path('${d}');--speed:${speed}s;--delay:${-i*speed/3}s"/>`).join('')}</g>`;
const fan=(x,y,r=9)=>`<g transform="translate(${x} ${y})"><circle class="op-part" r="${r+2}"/><g class="op-rotor">${[0,90,180,270].map(a=>`<path transform="rotate(${a})" d="M0 0 Q${-r} ${-r*.3} ${-r*.5} ${-r*.9} Q${r*.1} ${-r} 0 0Z"/>`).join('')}</g><circle class="op-hub" r="1.8"/></g>`;
const coil=(x,y,w,h,tone)=>`<g class="op-${tone}"><rect class="op-part" x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/><path class="op-coil" d="M${x+3} ${y+3}h${w-6}v${h/4}H${x+3}v${h/4}h${w-6}v${h/4}H${x+3}"/></g>`;
const drop=(x,y,i)=>`<g transform="translate(${x} ${y})"><path class="op-drop" style="--delay:${-i*.65}s" d="M0 0Q-5 7-2 9Q0 11 2 9Q5 7 0 0Z"/></g>`;
const titles={hrv:'雙流路全熱交換示意',ac:'冷氣室內冷卻及室外散熱循環示意',dehum:'冷凝除濕與再熱出風示意',purifier:'過濾吸附與風道送風示意',sensor:'多種環境感測與訊號處理示意',light:'LED 驅動與發光示意',socket:'繼電器供電與用電量測示意',curtain:'馬達皮帶與雙向滑車示意',bathfan:'暖風循環與獨立排濕示意'};
const drawings=mappingDrawings({route,fan,coil,drop});
titles.light='接收供電後燈泡逐漸亮起示意';
titles.socket='正向供電與反向監測訊號回傳示意，非電力回送';
titles.sensor='外部訊號接收、由左向右光束掃描及訊號輸出示意';
titles.purifier='底部孔洞進風、濾網過濾、葉輪加壓與上方環形出風口送風示意';
titles.curtain='八片百葉窗葉片開合示意';
export function wallOperation(id){
 const d=drawings[id];if(!d)return '';
 return `<svg class="process-diagram" viewBox="0 0 ${d.w} ${d.h}" preserveAspectRatio="xMidYMid meet" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${titles[id]}"><title>${titles[id]}；通用原理，非指定型號拆機圖</title>${d.body}</svg>`;
}
