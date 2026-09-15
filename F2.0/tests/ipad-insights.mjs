import assert from 'node:assert/strict';
import {DEVICES} from '../src/devices.js';
import {PANEL_CONTENT} from '../src/panel-content.js';
import {INSIGHTS,SNAPSHOT,EXHIBITION,MONTH_LABELS,SNAPSHOT_DAY,SOCKET_BREAKDOWN,dailyValues,insightPanel,ipadDetail} from '../src/ipad-insights.js';
const sum=values=>values.reduce((a,b)=>a+b,0);
assert.equal(sum(SOCKET_BREAKDOWN.map(r=>r[1])),284);
assert.equal(INSIGHTS.socket.energy,284);
assert.equal(INSIGHTS.ac.energy,SOCKET_BREAKDOWN[0][1]);
assert.equal(INSIGHTS.dehum.energy,SOCKET_BREAKDOWN[1][1]);
assert.equal(INSIGHTS.dehum.activity,126);
assert.equal(INSIGHTS.dehum.totalActivity,1532);
for(const [id,total] of Object.entries({light:8200,ac:6523,hrv:4320,bathfan:820,purifier:2830,curtain:8200}))assert.equal(INSIGHTS[id].totalActivity,total);
assert.equal(25000-INSIGHTS.light.totalActivity,16800);
assert.equal(Math.round((25000-8200)/25000*100),INSIGHTS.light.gauge);
assert.equal(10000-INSIGHTS.curtain.totalActivity,1800);
assert.equal(INSIGHTS.purifier.gauge,63);
assert.equal(INSIGHTS.hrv.gauge,72);
for(const {id} of DEVICES){
 const data=INSIGHTS[id];assert.ok(data,id);
 assert.equal(data.past.length,5);assert.equal(data.pastActivity.length,5);
 assert.ok(Math.abs(sum(dailyValues(data.energy))-data.energy)<1e-8,id+' daily energy sum');
 assert.ok(sum(data.past)+data.energy<=data.totalEnergy,id+' historical energy within lifetime');
 assert.ok(sum(data.pastActivity)+data.activity<=data.totalActivity,id+' historical activity within lifetime');
 if(data.unit==='小時')assert.ok(data.activity<=SNAPSHOT_DAY*24,id+' monthly hours within elapsed time');
 assert.ok(data.gauge>=0&&data.gauge<=100);
 for(const view of ['overview','trends','maintenance']){const html=insightPanel(id,view);assert.ok(!/NaN|undefined/.test(html),id+' '+view);}
 for(const [,value] of PANEL_CONTENT[id].rows)assert.ok(insightPanel(id).includes(value),id+' preserves '+value);
 assert.match(ipadDetail(id),/模擬展示資料/);
}
assert.match(insightPanel('purifier','maintenance'),/2027\/01\/17/);
assert.match(insightPanel('hrv','maintenance'),/2027\/02\/12/);
console.log('PASS: all 9 devices, approved values, chart sums, lifetime bounds, maintenance dates, and disclosure.');

assert.equal(SNAPSHOT,'2026-10-11');
assert.equal(EXHIBITION.end,'2027-04-30');
assert.deepEqual(MONTH_LABELS,['5月','6月','7月','8月','9月','10月¹']);
for(const {id} of DEVICES){
 assert.equal(dailyValues(INSIGHTS[id].energy).length,11);
 assert.match(insightPanel(id,'trends'),/10 月統計至 11 日/);
 for(const [date] of INSIGHTS[id].plan){if(/^\d{4}\/\d{2}/.test(date))assert.ok(date.slice(0,7)>='2026/10',id+' no past upcoming maintenance');}
}
