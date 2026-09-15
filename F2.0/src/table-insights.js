import {INSIGHTS,SNAPSHOT,MONTH_LABELS} from './ipad-insights.js';
const number=value=>Number(value).toLocaleString('en-US',{maximumFractionDigits:3});
export function tableSnapshotNote(){return `<p class="table-insight-note">${SNAPSHOT.replaceAll('-','/')} · 延伸圖表及保養計畫為模擬展示</p>`;}
export function tableGauge(id){
 const d=INSIGHTS[id];
 return `<div class="table-gauge"><svg viewBox="0 0 100 100" role="img" aria-label="${d.gaugeLabel} ${d.gauge}%"><circle class="table-gauge-track" cx="50" cy="50" r="41"/><circle class="table-gauge-fill" cx="50" cy="50" r="41" pathLength="100" stroke-dasharray="${d.gauge} 100" data-ring="${d.gauge}"/></svg><strong><span data-count="${d.gauge}">${d.gauge}</span><small>%</small></strong><span class="table-gauge-label">${d.gaugeLabel}</span></div>`;
}
export function tableInsights(id){
 const d=INSIGHTS[id],values=[...d.past,d.energy],max=Math.max(...values)*1.15,labels=MONTH_LABELS;
 return `<section class="metric-box trend table-energy"><h2>用電趨勢</h2><div class="table-energy-summary"><div class="table-energy-numbers"><span>本月用電 <strong data-count="${d.energy}">${number(d.energy)}</strong> kWh</span><span>累積用電 <b data-count="${d.totalEnergy}">${number(d.totalEnergy)}</b> kWh</span></div></div><div class="table-energy-bars" role="img" aria-label="${labels.map((label,i)=>`${label} ${number(values[i])} kWh`).join('；')}">${values.map((v,i)=>`<div class="table-energy-column"><span data-count="${v}">${number(v)}</span><div class="table-energy-track"><i style="height:${v/max*100}%"></i></div><small>${labels[i]}</small></div>`).join('')}</div><p class="table-chart-note">¹ 10 月統計至 11 日，其餘為完整月份</p></section><section class="metric-box maintenance table-plan"><h2>維護保養計畫</h2><ol>${d.plan.map(([date,item,status])=>`<li><div><time>${date}</time><small>${status}</small></div><p>${item}</p></li>`).join('')}</ol></section>`;
}
