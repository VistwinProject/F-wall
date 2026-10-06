// Device identity and installation geometry only.
// Display readings live in panel-content.js and ipad-insights.js.
const device = (id,label,sub,code,box,panel,pos) => ({id,label,sub,code,box,panel,pos});
export const DEVICES = [
  device("hrv","新風機","全熱交換機","HRV-02",[470,170,295,170],[150,100,145,140],[0.2585,0.4903]),
  device("ac","冷氣","空調系統","AC-07",[1440,170,310,140],[1620,105,150,140],[0.3075,0.3606]),
  device("dehum","除濕機","除濕系統","DH-01",[460,520,200,325],[165,370,130,140],[0.6276,0.7413]),
  device("purifier","空氣清淨機","空氣淨化","AP-06",[1425,550,140,370],[1520,370,180,140],[0.2933,0.7853]),
  device("sensor","12合一感測器","12合一環境感測","SEN-09",[310,900,225,115],[160,680,135,140],[0.783,0.356]),
  device("light","燈","智慧照明","LT-03",[625,885,125,195],[455,810,90,145],[0.2806,0.2202]),
  device("socket","智慧插座","智慧電力監測","PG-04",[960,900,235,125],[715,805,120,145],[0.2106,0.6154]),
  device("curtain","窗簾","電動窗簾","CT-05",[1290,900,185,185],[1195,645,120,145],[0.6556,0.1277]),
  device("bathfan","浴室暖風機","浴室暖風乾燥","BF-08",[1600,900,195,180],[1555,650,165,140],[0.5005,0.839]),
];
export const BY_ID = Object.fromEntries(DEVICES.map(d => [d.id,d]));
export const RELATIONS = [
  ['ac','hrv','溫控 × 換氣聯動'],['ac','curtain','日照負載調節'],['ac','dehum','溫濕協同控制'],
  ['light','curtain','採光補光'],['light','socket','照明供電'],['curtain','hrv','通風連動'],
  ['hrv','purifier','換氣 × 淨化協同'],['socket','dehum','插座供電監測'],
  ['sensor','hrv','空氣品質換氣'],['sensor','ac','溫濕連動控溫'],['sensor','dehum','濕度連動除濕'],
  ['sensor','purifier','PM2.5 連動淨化'],['bathfan','hrv','浴室排氣連動'],['bathfan','sensor','濕度偵測啟動'],
];
export const LEFT = ['light','ac','hrv','socket','purifier'];
export const RIGHT = ['curtain','sensor','dehum','bathfan'];
export const WALL_HUB = [955,550,340,340];
export const SCREEN = [960,215,540,280];
export const GRAPH_HUB = [990,555];
export const TABLE_HUB = [1245,740];
export const SLOTS = [[705,740],[895,625],[865,442],[1100,470],[1245,330],[1390,470],[1625,442],[1595,625],[1785,740]];
export const TIMING = { transition: 280, welcome: 600, step: 2600, hold: 5000, clear: 420 };
