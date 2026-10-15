import {test,expect} from '@playwright/test';

test('live contacts, manual BR, relative factions, marks, nearby exclusion and settings',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await page.waitForFunction(()=>window.ntlMap?.ready&&window.ntlApp);
  const runways=await page.evaluate(()=>window.ntlMap.sites().flatMap(s=>(s.runways||[]).map(r=>({type:'airfield',sx:(r.start[0]+131072)/262144,sy:(131072-r.start[2])/262144,ex:(r.end[0]+131072)/262144,ey:(131072-r.end[2])/262144,color:s.team===1?'#174DFF':'#fa0C00'}))));
  const at=(x:number,z:number)=>({x:(x+131072)/262144,y:(131072-z)/262144});
  const objects=[...runways,{...at(0,0),type:'aircraft',icon:'Player',color:'#ffff00'},
    {...at(5500,5500),type:'aircraft',icon:'Bomber',color:'#fa0C00',id:'test-plane'},
    {...at(3100,3100),type:'point_of_interest',icon:'point_of_interest',color:'#fa0C00'},
    {...at(-3000,-3000),type:'waypoint',icon:'waypoint',color:'#faC81E'},
    ...[3100,9000].flatMap(base=>Array.from({length:5},(_,i)=>({...at(base+i*20,base),type:'ground_model',icon:'MediumTank',color:'#fa0C00',id:`test-${base}-${i}`})))];
  await page.route('http://127.0.0.1:8111/**',route=>{
    const path=new URL(route.request().url()).pathname;
    return route.fulfill({json:path==='/map_obj.json'?objects:path==='/map_info.json'?{valid:true,map_min:[-131072,-131072],map_max:[131072,131072],map_generation:10}:{valid:true}});
  });
  await page.locator('#match-max-br').fill('14.3');await page.locator('#apply-match-br').click();
  await expect.poll(()=>page.evaluate(()=>window.ntlMap.context().scenario)).toBe('rank-40-50');
  await page.locator('#player-team').selectOption('1');
  await expect.poll(()=>page.evaluate(()=>window.ntlMap.playerTeam())).toBe(1);
  await expect(page.locator('#site-select option').first()).toContainText('FRIENDLY');
  await page.locator('#player-team').selectOption('2');
  await expect(page.locator('#site-select option').first()).toContainText('ENEMY');
  await page.locator('#player-team').selectOption('1');
  await page.locator('#connection-mode').selectOption('direct');await page.locator('#connect-button').click();
  await expect(page.locator('#connection-pill')).toContainText('IN BATTLE');
  await expect.poll(()=>page.evaluate(()=>(window.ntlApp!.snapshot() as any).liveContacts.length)).toBe(13);
  const snapshot=await page.evaluate(()=>(window.ntlApp!.snapshot() as any));
  expect(snapshot.liveContacts.find((t:any)=>t.observation.icon==='Bomber').observation).toMatchObject({relation:'enemy',nuclear:false});
  expect(snapshot.liveContacts.filter((t:any)=>t.observation.kind==='aiming-point')).toHaveLength(1);
  expect(snapshot.liveContacts.filter((t:any)=>t.observation.kind==='point-of-interest')).toHaveLength(1);
  await page.locator('#movement-section summary').click();
  await page.locator('#track-select').selectOption(String(snapshot.liveContacts.find((t:any)=>t.observation.icon==='Bomber').id));
  await page.locator('#manual-nuclear').check();await expect(page.locator('.ntl-nuclear-icon')).toContainText('MANUAL');
  await page.locator('#follow-track').check();await expect(page.locator('#follow-track')).toBeChecked();
  await page.locator('#open-nearby').click();await expect(page.locator('#nearby-summary')).toContainText('1 enemy vehicle groups');
  await page.locator('#nearby-map summary').click();
  await page.locator('#nearby-exclusion').selectOption('500');await expect(page.locator('#nearby-summary')).toContainText('1 enemy vehicle groups');
  await page.locator('#nearby-opacity').fill('0.5');await page.locator('#nearby-opacity').dispatchEvent('change');await expect(page.locator('#nearby-map')).toHaveCSS('opacity','0.5');
  await page.locator('#nearby-close').click();
  await page.locator('#airfield-section summary').click();
  await page.locator('#airfield-list button').first().click();await expect(page.locator('#airfield-list .ntl-airfield-dead').first()).toContainText('Destroyed · manual');
  await page.locator('#reset-battle').click();await expect(page.locator('#airfield-list .ntl-airfield-dead')).toHaveCount(0);
  await page.locator('#open-settings').click();await page.locator('#update-speed').selectOption('750');await page.locator('#trail-length').selectOption('60');
  await page.locator('#connect-button').click();await page.reload();await page.waitForFunction(()=>window.ntlApp);
  await page.locator('#open-settings').click();await expect(page.locator('#update-speed')).toHaveValue('750');await expect(page.locator('#trail-length')).toHaveValue('60');
  expect(errors).toEqual([]);
});

test('nearby view refuses telemetry from an unrecognized map',async({page})=>{
  await page.goto('/');await page.waitForFunction(()=>window.ntlApp);await page.locator('#open-nearby').click();
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('ntl:frame',{detail:{frame:{at:Date.now(),active:true,connected:true,player:{position:{x:0,z:0}},objects:[],errors:{}},context:window.ntlMap.context(),tracks:[],mode:'test',mapAgrees:false}})));
  await expect(page.locator('#nearby-summary')).toContainText('No current contacts');
});
