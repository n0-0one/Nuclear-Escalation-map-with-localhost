import {spawn} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import http from 'node:http';
const binary=resolve('target/release/ntl-bridge.exe');
const proc=spawn(binary,[],{stdio:['ignore','pipe','pipe'],windowsHide:true});
let token;let output='';
try{
  token=await new Promise((res,rej)=>{const timeout=setTimeout(()=>rej(new Error('Bridge startup timed out')),10000);proc.on('error',rej);proc.stdout.on('data',chunk=>{output+=chunk.toString();const m=output.match(/Pairing code: ([a-f0-9]{64})/);if(m){clearTimeout(timeout);res(m[1]);}});proc.on('exit',code=>rej(new Error(`Bridge exited ${code}`)));});
  const base='http://127.0.0.1:8112';const headers={Authorization:`Bearer ${token}`,Origin:'http://127.0.0.1:5173'};
  assert.equal((await fetch(`${base}/v1/snapshot`)).status,401);
  assert.equal((await fetch(`${base}/v1/snapshot`,{headers:{...headers,Origin:'https://untrusted.invalid'}})).status,403);
  assert.equal((await fetch(`${base}/v1/snapshot`,{headers:{...headers,Authorization:'Bearer invalid'}})).status,401);
  const rebound=await new Promise((resolve,reject)=>{const req=http.get(`${base}/health`,{headers:{...headers,Host:'attacker.invalid:8112'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});
  assert.equal(rebound,403);
  assert.equal((await fetch(`${base}/v1/snapshot`,{method:'POST',headers})).status,405);
  const preflight=await fetch(`${base}/v1/snapshot`,{method:'OPTIONS',headers:{Origin:headers.Origin,'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'Authorization'}});
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),headers.Origin);
  const denied=await fetch(`${base}/v1/snapshot`,{method:'OPTIONS',headers:{Origin:'https://untrusted.invalid','Access-Control-Request-Method':'GET'}});assert.equal(denied.status,403);
  const start=performance.now(),response=await fetch(`${base}/v1/snapshot`,{headers});assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'no-store');const frame=await response.json();
  const report={securityAssertions:8,snapshotMs:Math.round(performance.now()-start),hasMapInfo:!!frame.mapInfo,objectCount:Array.isArray(frame.objects)?frame.objects.length:0,errors:frame.errors};
  mkdirSync('docs/verification',{recursive:true});writeFileSync('docs/verification/bridge.json',JSON.stringify(report,null,2));console.log(report);
  if(process.argv.includes('--browser')){
    const {chromium}=await import('@playwright/test');const browser=await chromium.launch({channel:'msedge',headless:true});
    try{const page=await browser.newPage({viewport:{width:1920,height:1080}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.ntlMap?.ready&&window.ntlApp);
      await page.selectOption('#connection-mode','bridge');await page.fill('#bridge-token',token);await page.click('#connect-button');
      await page.waitForFunction(()=>document.querySelector('#connection-pill').textContent.includes('IN BATTLE'),{timeout:15000});
      await page.waitForFunction(()=>window.ntlApp.snapshot().playerMarker!==null);
      const samples=[];for(let i=0;i<20;i++){await page.waitForTimeout(450);samples.push(await page.evaluate(()=>window.ntlApp.snapshot()));}
      assert.equal(errors.length,0);const first=samples[0],last=samples.at(-1);assert.equal(last.recognized.mapId,'archipelago');
      const perf={samples:samples.length,averageProcessingMs:samples.reduce((n,s)=>n+s.processingMs,0)/samples.length,maxProcessingMs:Math.max(...samples.map(s=>s.processingMs)),objects:last.observed,playerMarker:last.playerMarker,playerMoved:JSON.stringify(first.playerMarker)!==JSON.stringify(last.playerMarker),recognized:last.recognized,errors};
      writeFileSync('docs/verification/live-browser.json',JSON.stringify(perf,null,2));
      await page.screenshot({path:'docs/verification/live-desktop.png'});console.log(perf);
      await page.click('#connect-button');await page.screenshot({path:'docs/verification/manual-desktop.png'});
    }finally{await browser.close();}
  }
}finally{token=undefined;output='';await new Promise(resolve=>{proc.once('exit',resolve);proc.kill();setTimeout(resolve,2000).unref();});}
