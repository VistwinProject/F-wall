export const REPORT_TYPES=[
  {id:'health',label:'健康報告',startTime:0,video:'/table-reports/health-from-3s.mp4'},
  {id:'energy',label:'用電報告',video:'/table-reports/energy.mp4'},
  {id:'maintenance',label:'設備維養報告',video:'/table-reports/maintenance.mp4'},
];

export const DEVICE_REPORT={
  sensor:'health',curtain:'health',hrv:'health',
  ac:'energy',socket:'energy',dehum:'energy',
  light:'maintenance',purifier:'maintenance',bathfan:'maintenance',
};

export function tableReports(id,deviceLabel){
  const report=REPORT_TYPES.find(report=>report.id===DEVICE_REPORT[id]);
  return `<div class="table-reports"><section class="table-report" data-report="${report.id}" aria-label="${report.label}"><header><h1>365 app</h1><div class="table-report-heading"><p>${deviceLabel}</p></div></header><div class="table-report-media"><div class="table-report-phone"><div class="table-report-crop"><video class="table-report-video" src="${report.video}" data-start-time="${report.startTime||0}" muted playsinline preload="auto" aria-label="${report.label}影片"></video></div></div></div></section></div>`;
}

// Every first play and replay seeks to the report offset before playing.
export function playReportVideo(video){
  video.pause();
  const start=()=>{
    if(!video.isConnected)return;
    const offset=Number(video.dataset.startTime)||0;
    const target=Number.isFinite(video.duration)&&video.duration<=offset?0:offset;
    const play=()=>{if(video.isConnected)video.play().catch(()=>{});};
    if(Math.abs(video.currentTime-target)<0.01&&!video.seeking){play();return;}
    video.addEventListener('seeked',play,{once:true});
    video.currentTime=target;
  };
  if(video.readyState>=1)start();
  else video.addEventListener('loadedmetadata',start,{once:true});
}
