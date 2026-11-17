import test from 'node:test';
import assert from 'node:assert/strict';
import {parseByteRange} from '../server/video-byte-range.mjs';
import {tableReports,playReportVideo} from '../src/table-reports.js';
import {createWebVolume} from '../server/web-volume.mjs';

test('MP4 byte ranges support seeking and reject unsatisfiable requests',()=>{
 assert.deepEqual(parseByteRange('bytes=100-199',1000),{start:100,end:199});
 assert.deepEqual(parseByteRange('bytes=900-',1000),{start:900,end:999});
 assert.deepEqual(parseByteRange('bytes=-100',1000),{start:900,end:999});
 assert.equal(parseByteRange('bytes=1000-',1000),false);
 assert.equal(parseByteRange('bytes=9-2',1000),false);
 assert.equal(parseByteRange(undefined,1000),null);
 assert.equal(parseByteRange('bytes=0-1,4-5',1000),null);
});
test('each health report uses the trimmed asset from zero, including replay',()=>{
 for(const id of ['sensor','curtain','hrv']){const html=tableReports(id,id);assert.match(html,/health-from-3s\.mp4/);assert.match(html,/data-start-time="0"/);}
 const events={};let plays=0;
 const video={isConnected:true,readyState:0,duration:12.4,currentTime:0,seeking:false,dataset:{startTime:'0'},pause(){},addEventListener(name,fn){events[name]=fn;},play(){assert.equal(this.currentTime,0);plays++;return Promise.resolve();}};
 playReportVideo(video);assert.equal(plays,0);events.loadedmetadata();assert.equal(plays,1);
 video.readyState=4;video.currentTime=12.4;playReportVideo(video);assert.equal(plays,1);assert.equal(video.currentTime,0);events.seeked();assert.equal(plays,2);
 video.isConnected=false;playReportVideo(video);assert.equal(plays,2);
});
test('web volume acknowledges only the unique audio renderer applied value',()=>{
 const sent=[];let now=0;const v=createWebVolume({send:(peer,message)=>sent.push({peer,message}),now:()=>now,epoch:'test'});
 const x={},table={},other={};v.open(x,'x');v.open(table,'table');
 v.receive(table,{type:'f-volume-report',protocol:'web-volume-v1',supported:true,volume:100});
 v.receive(x,{type:'f-volume-command',epoch:'test',reqId:'quiet',value:20});
 assert.equal(sent.at(-1).message.type,'f-volume-apply');
 assert.equal(sent.some(r=>r.message.type==='f-volume-ack'&&r.message.ok),false);
 v.receive(table,{type:'f-volume-report',protocol:'web-volume-v1',supported:true,volume:20,appliedId:'quiet'});
 assert.ok(sent.some(r=>r.message.type==='f-volume-ack'&&r.message.ok));
 v.open(other,'table');v.receive(other,{type:'f-volume-report',protocol:'web-volume-v1',supported:true,volume:20});assert.equal(v.snapshot().supported,false);
 v.close(other);now=5001;assert.equal(v.snapshot().supported,false);
});
