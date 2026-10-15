import {test,expect} from '@playwright/test';
test('automatic BR, swapped sides and SAM tracking remain active across context changes',async({page})=>{
  await page.goto('/');await page.waitForFunction(()=>window.ntlMap?.ready&&window.ntlApp);
  const fixture=await page.evaluate(()=>{
    const engine=window.ntlMap,sites=engine.variants().mirror;
    const runways=sites.flatMap(s=>(s.runways||[]).map(r=>({type:'airfield',sx:(r.start[0]+131072)/262144,sy:(131072-r.start[2])/262144,ex:(r.end[0]+131072)/262144,ey:(131072-r.end[2])/262144,color:s.team===1?'#174DFF':'#fa0C00'})));
    const contacts=sites.filter(s=>!s.runtime_relocated).flatMap(s=>(s.units_by_era?.['rank-40-50']||[]).filter(u=>!u.unplaced).map(u=>({x:(u.world_pos[0]+131072)/262144,y:(131072-u.world_pos[2])/262144,type:'ground_model',icon:/radar/i.test(u.role||'')?'Radar':({sam:'SAM',tracked:'MediumTank',tank:'MediumTank',wheeled:'Wheeled'} as Record<string,string>)[engine.specs(u.name).on_radar_as]||engine.specs(u.name).on_radar_as,color:s.team===1?'#174DFF':'#fa0C00'})));
    return [...runways,...contacts,{type:'aircraft',icon:'Player',x:.5,y:.5,color:'#ffff00'}];
  });
  await page.route('http://127.0.0.1:8111/**',route=>{const path=new URL(route.request().url()).pathname;return route.fulfill({json:path==='/map_obj.json'?fixture:path==='/map_info.json'?{valid:true,map_min:[-131072,-131072],map_max:[131072,131072],map_generation:5}:path==='/hudmsg'?{damage:[{id:1,msg:'"BUK-M3" (TELAR) shot down Test pilot (F-15E)'}]}:{valid:true}});});
  await page.locator('#player-team').selectOption('1');
  await page.locator('#connection-mode').selectOption('direct');await page.locator('#connect-button').click();
  await expect.poll(()=>page.evaluate(()=>window.ntlMap.context()),{timeout:20000}).toEqual({mapId:'archipelago',variant:'mirror',scenario:'rank-40-50'});
  await expect(page.locator('#match-static')).toBeChecked();await expect(page.locator('#auto-context')).toBeChecked();
  await expect.poll(()=>page.evaluate(()=>Object.values((window.ntlApp!.snapshot() as any).unitStates).filter((v:any)=>v.status==='REPORTED_ACTIVE').length)).toBeGreaterThan(10);
  await page.locator('#site-search').fill('short_sam_site_05');await page.locator('#site-select').selectOption({index:0});
  await page.locator('#destroy-site').click();await expect(page.locator('#site-summary')).toContainText('DESTROYED');
  await page.waitForTimeout(1000);await expect(page.locator('#site-summary')).toContainText('DESTROYED');
  await page.locator('#scenario-options').selectOption('rank-31-36');await expect(page.locator('#auto-context')).toBeChecked();await expect(page.locator('#match-static')).toBeChecked();
});
