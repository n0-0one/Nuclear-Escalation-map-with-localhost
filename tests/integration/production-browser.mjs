import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[],failures=[],remote=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failures.push([r.status(),r.url()]);});
  page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:4174/ntl-test/'))remote.push(r.url());});
  const start=performance.now();await page.goto('http://127.0.0.1:4174/ntl-test/');await page.waitForFunction(()=>window.ntlMap?.ready&&window.ntlApp);
  const readyMs=performance.now()-start;
  await page.waitForFunction(()=>Number.isFinite(window.ntlMap.terrain(2048,2048)));
  const terrainArchipelago=await page.evaluate(()=>window.ntlMap.terrain(2048,2048));
  await page.click('#close-live');
  for(const mapId of ['archipelago','city']){
    await page.locator(`input[name=map][value=${mapId}]`).check();
    for(const scenario of ['rank-0-26','rank-27-30','rank-31-36','rank-37-39','rank-40-50']){
      await page.selectOption('#scenario-options',scenario);
      assert.equal(await page.evaluate(()=>window.ntlMap.context().scenario),scenario);
    }
    await page.click('#team-swap');assert.ok((await page.evaluate(()=>window.ntlMap.context().variant)).includes('mirror'));
    await page.click('#team-swap');
    for(const family of ['vanilla','pact','nato'])await page.locator(`[data-icon-family=${family}]`).click();
  }
  await page.waitForFunction(()=>Number.isFinite(window.ntlMap.terrain(2048,2048)));
  const terrainCity=await page.evaluate(()=>window.ntlMap.terrain(2048,2048));
  await page.getByRole('button',{name:'Measure',exact:true}).click();
  await page.locator('#map').click({position:{x:740,y:430}});await page.locator('#map').click({position:{x:980,y:550}});
  await page.getByRole('button',{name:'Clear',exact:true}).click();
  // Terrain tools and layer controls are exercised at UI entry points; numeric LOS fidelity is a separate gameplay check.
  await page.getByRole('button',{name:'Line of sight',exact:true}).click();
  await page.locator('#map').click({position:{x:800,y:470}});
  await page.waitForTimeout(750);await page.getByRole('button',{name:'Clear',exact:true}).click();
  await page.getByRole('button',{name:'Flight brush',exact:true}).click();await page.getByRole('button',{name:'Clear',exact:true}).click();
  const perf=await page.evaluate(()=>({heapBytes:performance.memory?.usedJSHeapSize,resources:performance.getEntriesByType('resource').length,layers:Object.keys(window.ntlMap.map._layers).length}));
  assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);assert.deepEqual(failures,[]);
  mkdirSync('docs/verification',{recursive:true});
  const report={basePath:'/ntl-test/',readyMs:Math.round(readyMs),maps:2,scenarioSelections:10,variants:4,iconFamilies:3,terrainArchipelago,terrainCity,...perf,errors,failedResources:failures,remoteRequests:remote};
  writeFileSync('docs/verification/production-browser.json',JSON.stringify(report,null,2));
  await page.screenshot({path:'docs/verification/production-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/verification/production-mobile.png'});
  console.log(report);
}finally{await browser.close();}
