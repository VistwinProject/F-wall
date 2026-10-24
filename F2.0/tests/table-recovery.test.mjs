import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('function switchTableView(){'),source.indexOf('\nfunction render(){'));
test('Table mounts occupied startup immediately and survives failed/interrupted transitions',async()=>{
 const context=vm.createContext({console:{warn(){}},Event:class{},dispatchEvent(){},matchMedia:()=>({matches:false}),document:{body:{classList:{contains:()=>false}}}});
 vm.runInContext(`let role='table',tableViewsReady=true,state={session:true},tableViewMode,tableViewAnimation,tableViewTransition=0,focused;
 let tableSurface={dataset:{},style:{opacity:'0'},animate(){throw Error('Animation unavailable')}};
 let tableFrame={isConnected:false,remove(){this.isConnected=false},querySelectorAll(){return []}};
 let welcomeView={isConnected:true,remove(){this.isConnected=false},classList:{remove(){}},inert:false};
 let stage={prepend(node){node.isConnected=true},append(node){node.isConnected=true}};
 const updateFocus=()=>{},fit=()=>{},focusCleanup=()=>{},releaseReportLayer=()=>{};
 ${fn}
 switchTableView();`,context);
 const check=()=>assert.equal(vm.runInContext("tableSurface.style.opacity==='1' && (state.session?tableFrame.isConnected:welcomeView.isConnected)",context),true);
 check();
 vm.runInContext('state.session=false;switchTableView();',context);check();
 vm.runInContext("tableSurface.animate=()=>({cancel(){},finished:Promise.reject(Error('cancelled'))});state.session=true;switchTableView();state.session=false;switchTableView();",context);
 await new Promise(r=>setImmediate(r));check();
 assert.equal(vm.runInContext('tableViewAnimation',context),null);
});
