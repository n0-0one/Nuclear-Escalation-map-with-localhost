import {test,expect} from '@playwright/test';
test('independent map, all scenarios, variants, component status, planner and simulation',async({page})=>{
  const errors:string[]=[],remote:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:5173'))remote.push(r.url());});
  await page.goto('/');await expect(page.locator('#scenario-options option')).toHaveCount(5);await expect(page.locator('.leaflet-image-layer').first()).toBeVisible();
  await page.locator('#scenario-options').selectOption('rank-40-50');await page.getByRole('radio',{name:'South Eastern City',exact:true}).check();
  await expect.poll(()=>page.evaluate(()=>window.ntlMap.context().mapId)).toBe('city');await page.locator('#team-swap').click();await expect.poll(()=>page.evaluate(()=>window.ntlMap.context().variant)).toBe('city_mirror');
  await page.locator('#site-search').fill('long_sam');await page.locator('#site-select').selectOption({index:0});
  await page.locator('.unit-actions button[data-set="DESTROYED"]').first().click();await expect(page.locator('#site-summary')).toContainText('DAMAGED');
  await expect(page.locator('#unit-details .state-source').first()).toContainText('MANUAL');await page.locator('#undo-status').click();await expect(page.locator('#site-summary')).toContainText('UNKNOWN');
  await page.getByText('Threat-aware flight planner',{exact:true}).click();await page.locator('#pick-route').click();
  await page.locator('#map').click({position:{x:440,y:320}});await page.locator('#map').click({position:{x:600,y:400}});await page.locator('#pick-route').click();await page.locator('#calculate-route').click();await expect(page.locator('#route-result')).toContainText('ESTIMATE');
  await page.getByText('Convoys & movement',{exact:true}).click();await page.locator('#show-convoys').check();await expect(page.locator('#convoy-select option')).not.toHaveCount(1);
  await page.locator('#connection-mode').selectOption('demo');await page.locator('#connect-button').click();await expect(page.locator('#simulation-banner')).toBeVisible();await expect(page.locator('#connection-pill')).toContainText('SIMULATED');
  await page.locator('#connect-button').click();await expect(page.locator('#connection-pill')).toContainText('MANUAL');
  expect(errors).toEqual([]);expect(remote).toEqual([]);
});
test('mobile remains within viewport with collapsible panels',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.locator('#scenario-options option')).toHaveCount(5);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.locator('#live-panel')).toBeHidden();await page.locator('#open-live').click();await expect(page.locator('#live-panel')).toBeVisible();
  const bounds=await page.locator('#live-panel').boundingBox();expect(bounds!.height).toBeLessThan(510);expect(bounds!.width).toBeLessThanOrEqual(390);
});
