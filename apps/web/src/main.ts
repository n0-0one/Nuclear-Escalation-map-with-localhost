import './live.css';
import {invoke} from '@tauri-apps/api/core';
import type * as Leaflet from 'leaflet';
import type {Context,RawFrame,UnitRecord,Status,Source,Observation,WorldPoint,NormalizedFrame} from '../../../packages/core/types';
import {STATUSES} from '../../../packages/core/types';
import {worldToMap,distance} from '../../../packages/core/coordinates';
import {normalize,recognizeMap,MatchLifecycle} from '../../../packages/core/telemetry';
import {BattleStore,siteSummary,matchObservations,timerLabel} from '../../../packages/core/battle';
import {Poller} from '../../../packages/core/poller';
import {catalog} from './engine';
import {directProvider,bridgeProvider,nativeProvider,demoProvider} from './providers';
import type {RouteResult} from '../../../packages/core/route';

const engine=window.ntlMap,L=engine.L;
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const safe=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const native=!!window.__TAURI_INTERNALS__;
const store=new BattleStore();let lifecycle=new MatchLifecycle();
let units:UnitRecord[]=[],context:Context,selectedSite='',mode='manual',connected=false;
let lastFrame:NormalizedFrame|null=null,rawFrame:RawFrame|null=null,lastSuccess:number|null=null;
let detected= {mapId:null,confidence:'unknown',matches:0,reason:'No telemetry'} as ReturnType<typeof recognizeMap>;
let applyingContext=false,previousView:{center:Leaflet.LatLng;zoom:number}|null=null;
let processingMs=0,matched=0,previousStatus='';
const liveLayer=L.layerGroup().addTo(engine.map),historyLayer=L.layerGroup().addTo(engine.map),convoyLayer=L.layerGroup().addTo(engine.map),routeLayer=L.layerGroup().addTo(engine.map);
let playerMarker:Leaflet.Marker|null=null;
const tracked=new Map<number,{observation:Observation;marker:Leaflet.CircleMarker;line:Leaflet.Polyline;history:Leaflet.LatLngExpression[];at:number}>();let nextTrack=1;
let routePoints:WorldPoint[]=[],routePicking=false,routeRequest=0,routeWorker:Worker|null=null;
const diagnostics:{at:number;message:string}[]=[];
function diagnostic(message:string){if(diagnostics.at(-1)?.message===message)return;diagnostics.push({at:Date.now(),message});if(diagnostics.length>100)diagnostics.shift();}
function readPrefs(){try{return JSON.parse(localStorage.getItem('ntl.preferences.v1')||'{}');}catch{return {};}}
const preferences=readPrefs();
function savePrefs(){try{localStorage.setItem('ntl.preferences.v1',JSON.stringify({mode:mode==='demo'?'manual':mode,follow:$<HTMLInputElement>('follow-player').checked,showObserved:$<HTMLInputElement>('show-observed').checked}));}catch{diagnostic('Settings storage unavailable');}}

document.body.insertAdjacentHTML('beforeend',`
<div class="ntl-bar"><strong>NUCLEAR THUNDER LIVE</strong><span class="version">0.1 • FIELD BUILD</span><span id="connection-pill" class="ntl-pill" role="status">MANUAL • OFFLINE</span><button id="open-live" aria-expanded="true">Live panel</button></div>
<aside class="ntl-panel" id="live-panel" aria-label="Live battle controls">
<header><h2>BATTLE CONTROL</h2><button id="close-live" aria-label="Collapse live panel">−</button></header>
<section><div class="row"><select id="connection-mode" aria-label="Connection mode"><option value="manual">Manual / offline</option>${native?'<option value="native">Native War Thunder</option>':''}<option value="direct">Direct localhost</option><option value="bridge">Local bridge</option><option value="demo">Simulation / demo</option></select><button id="connect-button">Connect</button></div>
<label id="pairing-row" hidden>Bridge pairing code <input id="bridge-token" type="password" autocomplete="off" placeholder="Code printed by ntl-bridge.exe"></label>
<p id="connection-detail" class="ntl-muted">Static mission data is ready. Unit states begin unknown.</p>
<div id="simulation-banner" class="ntl-demo-banner" hidden>SIMULATION — all observations and demo actions are generated.</div>
<div class="row"><label><input id="follow-player" type="checkbox"> Follow player</label><label><input id="show-observed" type="checkbox" checked> Observed objects</label></div>
</section>
<details open><summary>Battle identification</summary><p id="identification" class="ntl-muted">Waiting for map data…</p>
<label><input id="auto-map" type="checkbox" checked> Infer map from runway geometry</label>
<label>Player affiliation <select id="player-team"><option value="0">Unknown</option><option value="1">REDFOR — manual</option><option value="2">BLUFOR — manual</option></select></label>
<label><input id="match-static" type="checkbox"> I selected the correct scenario and side layout</label>
<p class="ntl-muted">Required for inferred component observations. API colours do not establish REDFOR/BLUFOR. Use the original map controls for scenario and Swap sides.</p>
<button id="reset-battle">Start a new manual battle / reset states</button></details>
<details open><summary>Target & component states</summary>
<input id="site-search" type="search" placeholder="Search SAM, radar, airfield, depot…" aria-label="Search sites">
<select id="site-select" aria-label="Selected site"></select>
<div class="row"><button id="focus-site">Focus target</button><button id="return-view">Previous view</button><button id="undo-status">Undo</button></div>
<p id="site-summary" class="ntl-site-summary"></p><div id="unit-details" class="ntl-units"></div><button id="reset-site">Reset site to unknown</button>
</details>
<details><summary>Convoys & movement</summary><label><input id="show-convoys" type="checkbox"> Predicted mission routes</label>
<select id="convoy-select" aria-label="Predicted convoy route"></select><p id="convoy-detail" class="ntl-muted">Routes are mission predictions, not live convoy positions.</p>
<label><input id="show-history" type="checkbox" checked> Observed ground movement trails</label><p class="ntl-muted">Dashed amber: predicted. Solid cyan: observed movement, identity inferred. Blue: planned flight route. Generic vehicles are not assigned convoy identities.</p></details>
<details><summary>Threat-aware flight planner</summary><p class="ntl-route-note">Choose start, destination and optional waypoints on the map. Estimates only; terrain LOS remains available in the original map tools.</p>
<div class="row"><button id="pick-route">Place waypoints</button><button id="route-undo">Undo point</button><button id="route-clear">Clear</button></div>
<label><input id="avoid-active" type="checkbox" checked> Penalize active threats</label><label><input id="avoid-unknown" type="checkbox" checked> Penalize unknown threats</label>
<label>Threat side <select id="threat-team"><option value="0">Both sides (conservative)</option><option value="1">REDFOR</option><option value="2">BLUFOR</option></select></label>
<button id="calculate-route">Calculate estimate</button><p id="route-result" class="ntl-muted">No waypoints.</p></details>
<details><summary>Battle timeline</summary><select id="timeline-filter" aria-label="Timeline filter"><option value="all">All events</option><option value="sam">SAM</option><option value="radar">Radar</option><option value="ground">MBT / SPAA / strongpoints</option><option value="convoy">Convoys</option><option value="objective">Objectives</option><option value="manual">Manual changes</option><option value="system">System</option></select><ol id="timeline" class="ntl-timeline"></ol><button id="export-timeline">Export battle JSON</button></details>
<details><summary>Diagnostics & credits</summary><pre id="diagnostics"></pre><button id="export-diagnostics">Export diagnostic JSON</button>
<p class="ntl-muted">Map and mission extraction: majorlier, Nuclear Thunder Interactive Map. Leaflet © Vladimir Agafonkin, BSD-2-Clause. War Thunder assets © their respective owners. Unofficial project; not affiliated with Gaijin.</p><p><a href="./credits.html" target="_blank" rel="noopener">Data provenance & third-party notices</a></p>
<p class="ntl-muted">Public HTTPS sites may be blocked from localhost by browser policy. The bridge requires pairing and an allowed origin. The desktop build connects natively. No telemetry leaves your computer.</p></details>
</aside>`);
function togglePanel(open:boolean){$('live-panel').hidden=!open;$('open-live').setAttribute('aria-expanded',String(open));}
$('open-live').onclick=()=>togglePanel($('live-panel').hidden);$('close-live').onclick=()=>togglePanel(false);
if(matchMedia('(max-width:700px)').matches)togglePanel(false);
$<HTMLInputElement>('follow-player').checked=preferences.follow===true;
$<HTMLInputElement>('show-observed').checked=preferences.showObserved!==false;
const sourceSelect=$<HTMLSelectElement>('connection-mode');
sourceSelect.value=native?'native':['direct','bridge'].includes(preferences.mode)?preferences.mode:'manual';
sourceSelect.onchange=()=>{stopConnection();$('pairing-row').hidden=sourceSelect.value!=='bridge';};
$('pairing-row').hidden=sourceSelect.value!=='bridge';
$('connect-button').onclick=()=>connected?stopConnection():startConnection();
function stopConnection(){poller.stop();if(mode==='demo'){store.reset('Simulation ended; generated states cleared');refreshStates();}connected=false;mode='manual';lastFrame=null;rawFrame=null;lastSuccess=null;detected={mapId:null,confidence:'unknown',matches:0,reason:'No telemetry'};
  lifecycle=new MatchLifecycle();clearObserved();$('connect-button').textContent='Connect';$('simulation-banner').hidden=true;updateStatus();savePrefs();}
function startConnection(){
  const next=sourceSelect.value;if(next==='manual'){stopConnection();return;}
  const token=$<HTMLInputElement>('bridge-token').value.trim();
  if(next==='bridge'&&!/^[a-f0-9]{64}$/i.test(token)){$('connection-detail').textContent='Paste the 64-character pairing code printed by the bridge.';return;}
  if((mode==='demo')!==(next==='demo')){store.reset('Telemetry source changed; previous session cleared');refreshStates();}
  clearObserved();lifecycle=new MatchLifecycle();mode=next;connected=true;lastSuccess=null;lastFrame=null;
  $('simulation-banner').hidden=mode!=='demo';$('connect-button').textContent='Disconnect';
  store.event(`Connection mode: ${mode}`,mode==='demo'?'SIMULATED':'MANUAL');
  poller.start(next==='native'?nativeProvider:next==='bridge'?bridgeProvider(token):next==='demo'?demoProvider():directProvider());savePrefs();updateStatus();
}
const poller=new Poller(receive);
function receive(frame:RawFrame){
  const start=performance.now();rawFrame=frame;const value=normalize(frame);lastFrame=value;
  const transition=lifecycle.update(value);
  if(transition==='start'||transition==='change'){
    store.reset(transition==='start'?'Battle activity detected':'Map generation changed; new session');
    store.event('Battle identity inferred from local activity / map generation',mode==='demo'?'SIMULATED':'INFERRED');
    $<HTMLInputElement>('match-static').checked=false;
    clearObserved();clearRoute();refreshStates();
  }else if(transition==='end'){store.invalidateTimers();clearObserved();store.event('Battle ended (sustained inactive telemetry)',mode==='demo'?'SIMULATED':'INFERRED');}
  if(value.connected&&value.objects.length)lastSuccess=frame.at;
  if(mode==='demo')detected={mapId:'archipelago',confidence:'inferred',matches:0,reason:'SIMULATED Archipelago fixture'};
  else detected=recognizeMap(frame,engine.variants());
  if(value.active&&detected.mapId&&$<HTMLInputElement>('auto-map').checked&&context.mapId!==detected.mapId){
    applyingContext=true;engine.setContext(detected.mapId,detected.mapId==='city'?'city':'standard');applyingContext=false;
  }
  const mapAgrees=detected.mapId===context.mapId || (!$<HTMLInputElement>('auto-map').checked && value.info?.valid===true &&
    value.info.map_min[0]===engine.definitions[context.mapId].mapCoord0[0]&&value.info.map_max[0]===engine.definitions[context.mapId].mapCoord1[0]);
  if(mapAgrees&&value.active){
    drawPlayer(value.player,frame.at);
    updateObserved(value.objects.filter(o=>!o.player),frame.at);
    const matches=matchObservations(value.objects,units);matched=matches.length;
    if($<HTMLInputElement>('match-static').checked) {
      let changed=false;for(const match of matches)changed=store.set(match.unit,'REPORTED_ACTIVE',mode==='demo'?'SIMULATED':'INFERRED',frame.at)||changed;
      if(changed)refreshStates();
    }
  } else {clearObserved();matched=0;}
  for(const [endpoint,error] of Object.entries(value.errors))diagnostic(`${endpoint}: ${error}`);
  if(mode==='demo')demoEvents();
  processingMs=performance.now()-start;updateStatus();renderTimeline();
}
function clearObserved(){liveLayer.clearLayers();historyLayer.clearLayers();tracked.clear();playerMarker=null;}
function drawPlayer(player:Observation|null,at:number){
  if(!player){if(playerMarker)playerMarker.setOpacity(.35);return;}
  const latlng=worldToMap(player.position,context.mapId);
  if(!playerMarker){playerMarker=L.marker(latlng,{zIndexOffset:3000,icon:L.divIcon({className:'ntl-player',html:'<span>▲</span>',iconSize:[28,28],iconAnchor:[14,14]})}).bindTooltip('Player • telemetry').addTo(liveLayer);}
  playerMarker.setLatLng(latlng).setOpacity(1);
  const el=playerMarker.getElement()?.firstElementChild as HTMLElement|undefined;
  if(el){el.textContent=player.heading===null?'●':'▲';el.style.transform=`rotate(${player.heading??0}deg)`;}
  playerMarker.setTooltipContent(`${mode==='demo'?'SIMULATED':'TELEMETRY'} player • ${player.heading===null?'heading unknown':Math.round(player.heading)+'°'}`);
  if($<HTMLInputElement>('follow-player').checked)engine.map.panTo(latlng,{animate:false});
}
function updateObserved(observations:Observation[],at:number){
  if(!$<HTMLInputElement>('show-observed').checked)return;
  const used=new Set<number>();
  for(const observation of observations.slice(0,700)){
    const candidates=[...tracked].filter(([id,t])=>!used.has(id)&&t.observation.type===observation.type&&t.observation.icon===observation.icon&&t.observation.color===observation.color&&at-t.at<3000)
      .map(([id,t])=>({id,t,d:distance(t.observation.position,observation.position)})).filter(x=>x.d<(observation.type==='aircraft'?2000:220)).sort((a,b)=>a.d-b.d);
    let chosen=candidates[0];if(chosen&&candidates[1]&&candidates[1].d<chosen.d+20)chosen=undefined!;
    let id=chosen?.id,track=chosen?.t;
    const pos=worldToMap(observation.position,context.mapId);
    if(!track){id=nextTrack++;const marker=L.circleMarker(pos,{radius:observation.type==='aircraft'?4:3,color:observation.color,weight:1,fillOpacity:.7}).addTo(liveLayer);
      const line=L.polyline([],{color:'#72cfd5',weight:2,opacity:.6,interactive:false});
      track={observation,marker,line,history:[],at};tracked.set(id!,track);
      marker.bindTooltip(`${safe(observation.icon)} • ${mode==='demo'?'SIMULATED':'observed'}<br>Track continuity inferred; mission identity unknown`);
    }
    used.add(id!);track.marker.setLatLng(pos);track.marker.setStyle({opacity:1,fillOpacity:.7});
    if(observation.type==='ground_model'&&distance(track.observation.position,observation.position)>8){track.history.push(pos);if(track.history.length>40)track.history.shift();track.line.setLatLngs(track.history);if($<HTMLInputElement>('show-history').checked&&!historyLayer.hasLayer(track.line))historyLayer.addLayer(track.line);}
    track.observation=observation;track.at=at;
  }
  for(const [id,t]of tracked){if(at-t.at>6000){liveLayer.removeLayer(t.marker);historyLayer.removeLayer(t.line);tracked.delete(id);}else if(at-t.at>1500)t.marker.setStyle({opacity:.25,fillOpacity:.15});}
  // Hard bound even during rapidly changing/ambiguous detections.
  while(tracked.size>900){const [id,t]=tracked.entries().next().value!;liveLayer.removeLayer(t.marker);historyLayer.removeLayer(t.line);tracked.delete(id);}
}
function onContext(){
  const next=engine.context();if(context&&(next.mapId!==context.mapId||next.variant!==context.variant||next.scenario!==context.scenario)){
    if(!applyingContext&&next.mapId!==context.mapId)$<HTMLInputElement>('auto-map').checked=false;
    $<HTMLInputElement>('match-static').checked=false;
    store.event(`Selected ${next.mapId} / ${next.variant} / ${next.scenario}`,applyingContext?'INFERRED':'MANUAL');
    clearObserved();clearRoute();
  }
  context=next;units=catalog(engine);populateSites();renderConvoys();refreshStates();updateStatus();
}
function populateSites(){
  const query=$<HTMLInputElement>('site-search').value.toLowerCase(),select=$<HTMLSelectElement>('site-select');
  const sites=engine.sites().filter(s=>`${s.name} ${engine.category(s)}`.toLowerCase().includes(query));
  select.innerHTML=sites.map(s=>`<option value="${safe(s.name)}">${s.team===1?'RED':'BLUE'} · ${safe(s.name.replace(/^t[12]_/,'').replaceAll('_',' '))}</option>`).join('');
  if(sites.some(s=>s.name===selectedSite))select.value=selectedSite;else selectedSite=select.value;
  renderDetails();
}
function selectSite(name:string){selectedSite=name;$<HTMLInputElement>('site-search').value='';populateSites();togglePanel(true);}
function renderDetails(){
  const items=units.filter(u=>u.siteId===selectedSite),states=items.map(u=>store.get(u.id));
  $('site-summary').textContent=`${items.length} components • ${siteSummary(states).replaceAll('_',' ')} • ${context?.scenario||''}`;
  $('unit-details').innerHTML=items.map(u=>{const state=store.get(u.id);return `<div class="ntl-unit" data-unit-id="${safe(u.id)}"><strong>${safe(u.label)}</strong><span class="ntl-muted">${safe(u.role)} · ${u.approximate?'approximate placement':'mission position'}${u.range?` · weapon ${(u.range/1000).toFixed(1)} km`:''}${u.detectionRange?` · radar ${(u.detectionRange/1000).toFixed(1)} km`:''}</span>
    <select data-status="${safe(u.id)}" aria-label="Status for ${safe(u.label)}">${STATUSES.map(s=>`<option ${s===state.status?'selected':''} value="${s}">${s.replaceAll('_',' ')}</option>`).join('')}</select>
    <div class="row unit-actions"><button data-set="DESTROYED" data-id="${safe(u.id)}">Destroyed</button><button data-set="CONFIRMED_ACTIVE" data-id="${safe(u.id)}">Active</button><button data-set="UNKNOWN" data-id="${safe(u.id)}">Unknown</button></div>
    <span class="state-source">${state.at?`${state.source} · ${new Date(state.at).toLocaleTimeString()}`:'UNKNOWN · no observation'}${state.lastSeen?` · seen ${new Date(state.lastSeen).toLocaleTimeString()}`:''}</span>
    <span class="ntl-muted" data-timer="${safe(u.id)}">${state.status==='DESTROYED'?timerLabel(state):u.restoreSeconds?`Rule: ${u.restoreSeconds}s ${safe(u.restoreKind)} (${safe(u.restoreSource)}, conditional)`:'No fixed restoration rule'}</span></div>`;}).join('');
}
function refreshStates(){for(const u of units)engine.markUnit(u.id,store.get(u.id).status);for(const site of engine.sites())engine.markSite(site.name,siteSummary(units.filter(u=>u.siteId===site.name).map(u=>store.get(u.id))));renderDetails();renderTimeline();}
function changeUnit(id:string,status:Status){const unit=units.find(u=>u.id===id);if(!unit||!STATUSES.includes(status))return;store.set(unit,status,mode==='demo'?'SIMULATED':'MANUAL');engine.markUnit(id,status);engine.markSite(unit.siteId,siteSummary(units.filter(u=>u.siteId===unit.siteId).map(u=>store.get(u.id))));renderDetails();renderTimeline();$('route-result').textContent=routePoints.length?'Threats changed; recalculate the route estimate.':$('route-result').textContent;}
$('unit-details').onclick=event=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button[data-set]');if(button)changeUnit(button.dataset.id!,button.dataset.set as Status);};
$('unit-details').onchange=event=>{const select=event.target as HTMLSelectElement;if(select.dataset.status)changeUnit(select.dataset.status,select.value as Status);};
$('site-search').oninput=populateSites;$('site-select').onchange=()=>{selectedSite=$<HTMLSelectElement>('site-select').value;renderDetails();};
$('focus-site').onclick=()=>{previousView={center:engine.map.getCenter(),zoom:engine.map.getZoom()};engine.focus(selectedSite);const site=engine.sites().find(s=>s.name===selectedSite);if(site)engine.map.setView(engine.worldToLatLng(site.world_pos[0],site.world_pos[2]),1,{animate:false});};
$('return-view').onclick=()=>{if(previousView)engine.map.setView(previousView.center,previousView.zoom);};
$('undo-status').onclick=()=>{store.undo();refreshStates();};
$('reset-site').onclick=()=>{for(const u of units.filter(u=>u.siteId===selectedSite))store.set(u,'UNKNOWN',mode==='demo'?'SIMULATED':'MANUAL');refreshStates();};
$('reset-battle').onclick=()=>{store.reset('Manual new battle');lifecycle=new MatchLifecycle();clearObserved();refreshStates();};
$('player-team').onchange=()=>{store.event(`Player affiliation: ${$<HTMLSelectElement>('player-team').selectedOptions[0].textContent}`);renderTimeline();};
$('match-static').onchange=()=>{store.event(`Static matching ${$<HTMLInputElement>('match-static').checked?'enabled for manually selected scenario/layout':'disabled'}`);renderTimeline();};
$('follow-player').onchange=savePrefs;$('show-observed').onchange=()=>{clearObserved();savePrefs();};
$('show-history').onchange=()=>{if(!$<HTMLInputElement>('show-history').checked)historyLayer.clearLayers();};
engine.map.on('dragstart',()=>{$<HTMLInputElement>('follow-player').checked=false;savePrefs();});
window.addEventListener('ntl:context',onContext);window.addEventListener('ntl:select',event=>selectSite((event as CustomEvent<string>).detail));

function renderConvoys(){
  const routes=engine.convoyRoutes(),select=$<HTMLSelectElement>('convoy-select'),previous=select.value;
  select.innerHTML='<option value="">Choose predicted route…</option>'+routes.map((r,i)=>`<option value="${i}">${safe(r.kind)} ${safe(r.link.resource||'')} · ${safe(r.link.factory||r.link.assembly||r.link.from_site||i)}</option>`).join('');
  if(previous&&Number(previous)<routes.length)select.value=previous;drawConvoys();
}
function drawConvoys(){
  convoyLayer.clearLayers();if(!$<HTMLInputElement>('show-convoys').checked)return;
  const routes=engine.convoyRoutes(),selected=$<HTMLSelectElement>('convoy-select').value;
  routes.forEach((route,index)=>{if(selected!==''&&Number(selected)!==index)return;
    L.polyline(route.points.map(p=>engine.worldToLatLng(p[0],p[2])),{color:'#e1b36d',weight:selected===''?1.5:4,dashArray:'7 8',opacity:selected===''?.45:.9}).bindTooltip(`PREDICTED ${safe(route.kind)} route — not a live convoy`).addTo(convoyLayer);
  });
  if(selected!==''){
    const route=routes[Number(selected)];if(route){$('convoy-detail').textContent=`PREDICTED ${route.kind} · ${route.link.resource||'armoured'} · team ${route.link.team} · ${route.link.factory||route.link.assembly||'?'} → ${route.link.assembly||route.link.target||'?'} · Actual position unknown.`;
      store.event(`Selected predicted ${route.kind} route`,'MANUAL','convoy');}
  }
}
$('show-convoys').onchange=drawConvoys;$('convoy-select').onchange=()=>{$<HTMLInputElement>('show-convoys').checked=true;drawConvoys();};
function drawWaypoints(){routeLayer.clearLayers();for(const [i,p]of routePoints.entries())L.circleMarker(worldToMap(p,context.mapId),{radius:6,color:'#84baff',fillOpacity:1}).bindTooltip(`Waypoint ${i+1}`).addTo(routeLayer);$('route-result').textContent=`${routePoints.length} waypoints. ${routePicking?'Click map to add; press Finish placing to pan.':''}`;}
function clearRoute(){routePoints=[];routeRequest++;routePicking=false;routeLayer.clearLayers();$('pick-route').textContent='Place waypoints';$('route-result').textContent='No waypoints.';}
$('pick-route').onclick=()=>{routePicking=!routePicking;$('pick-route').textContent=routePicking?'Finish placing':'Place waypoints';drawWaypoints();};
$('route-clear').onclick=clearRoute;$('route-undo').onclick=()=>{routePoints.pop();routeRequest++;drawWaypoints();};
// Capture before unit-marker handlers consume the click. Planning works over markers too.
engine.map.getContainer().addEventListener('click',(event:MouseEvent)=>{
  if(!routePicking||routePoints.length>=12)return;
  event.stopImmediatePropagation();event.preventDefault();
  const [x,z]=engine.latLngToWorld(engine.map.mouseEventToLatLng(event));
  const def=engine.definitions[context.mapId];
  if(x<def.mapCoord0[0]||x>def.mapCoord1[0]||z<def.mapCoord0[1]||z>def.mapCoord1[1]){$('route-result').textContent='Choose a point inside the map image.';return;}
  routePoints.push({x,z});routeRequest++;drawWaypoints();
},true);
$('calculate-route').onclick=()=>{
  if(!routeWorker){routeWorker=new Worker(new URL('./route-worker.ts',import.meta.url),{type:'module'});routeWorker.onmessage=event=>{
    if(event.data.id!==routeRequest)return;if(event.data.error){$('route-result').textContent=event.data.error;return;}
    const result=event.data.result as RouteResult;drawWaypoints();L.polyline(result.points.map(p=>worldToMap(p,context.mapId)),{color:'#78abff',weight:4}).addTo(routeLayer);
    $('route-result').textContent=`ESTIMATE ${(result.distance/1000).toFixed(1)} km · ${(result.exposure/1000).toFixed(1)} km inside selected threat rings · grid ${(result.resolution/1000).toFixed(2)} km. No terrain masking guarantee.`;
  };routeWorker.onerror=()=>{$('route-result').textContent='Route worker failed. Reload to retry.';};}
  routeWorker.postMessage({id:++routeRequest,request:{points:routePoints,mapId:context.mapId,avoidUnknown:$<HTMLInputElement>('avoid-unknown').checked,avoidActive:$<HTMLInputElement>('avoid-active').checked,enemyTeam:Number($<HTMLSelectElement>('threat-team').value),threats:units.filter(u=>u.position&&u.range>0).map(u=>({position:u.position!,range:u.range,status:store.get(u.id).status,team:u.team}))}});
  $('route-result').textContent='Calculating…';
};

function renderTimeline(){
  const filter=$<HTMLSelectElement>('timeline-filter').value;
  const events=store.events.filter(e=>filter==='all'||filter==='manual'&&e.source==='MANUAL'||filter==='system'&&e.category==='system'||filter==='sam'&&/sam/i.test(e.category)||filter==='radar'&&/radar/i.test(e.category)||filter==='ground'&&/strong|vehicle|spaa/i.test(e.category)||filter==='convoy'&&e.category==='convoy'||filter==='objective'&&/airfield|fuel|strategic/i.test(e.category));
  $('timeline').innerHTML=events.slice(-70).reverse().map(e=>`<li><span class="ntl-muted">${new Date(e.at).toLocaleTimeString()} · ${e.source}</span><br>${safe(e.text)}</li>`).join('');
}
$('timeline-filter').onchange=renderTimeline;
function updateStatus(){
  const stale=lastSuccess!==null&&Date.now()-lastSuccess>3000;
  const status=mode==='manual'?'MANUAL • OFFLINE':!lastFrame?'SEARCHING':!lastFrame.connected?'CONNECTION LOST':lastFrame.unsupported?'UNSUPPORTED / PARTIAL':lastFrame.active?'IN BATTLE':lastFrame.active===false?'CONNECTED • NO BATTLE':'CONNECTED • ACTIVITY UNKNOWN';
  $('connection-pill').textContent=(mode==='demo'?'SIMULATED • ':'')+status+(stale?' • STALE':'');
  $('connection-pill').dataset.active=String(lastFrame?.connected&&!stale);$('connection-pill').dataset.demo=String(mode==='demo');
  if(previousStatus!==status){if(mode!=='manual')store.event(status,mode==='demo'?'SIMULATED':'TELEMETRY');previousStatus=status;}
  $('connection-detail').textContent=mode==='manual'?'Static map • manual operation. No live data.':!lastFrame?.connected?(mode==='direct'?'Connection failed: game unavailable or browser blocked localhost. Try the paired bridge or desktop app.':'Waiting for local telemetry. Requests retry automatically.'):
    `${mode.toUpperCase()} · ${lastFrame.objects.length} observed objects · ${stale?'STALE':lastSuccess?new Date(lastSuccess).toLocaleTimeString():'No current player position'}${lastFrame.unsupported?' · Some endpoints unavailable':''}`;
  if(context)$('identification').textContent=`Map: ${context.mapId} (${$<HTMLInputElement>('auto-map').checked?(detected.mapId===context.mapId?'inferred':'static selection; live unknown'):'manually selected'}). ${detected.reason}. Layout: ${context.variant} (manual). Scenario: ${engine.presets().find(p=>p.id===context.scenario)?.label||context.scenario} (manual). Mission ID / live BR: unknown.`;
  if(stale&&playerMarker)playerMarker.setOpacity(.3);
  $('diagnostics').textContent=JSON.stringify(diagnosticSnapshot(),null,2);
}
function diagnosticSnapshot(){return {version:'0.1.0',mode,connection:lastFrame?.connected||false,activity:lastFrame?.active??null,session:lifecycle.session,selected:context,recognized:detected,lastSuccess,pollingMs:poller.interval,processingMs:Math.round(processingMs*100)/100,observed:lastFrame?.objects.length||0,trackedComponents:units.length,confirmedIdentityMatches:0,inferredPositionCandidates:matched,matchingEnabled:$<HTMLInputElement>('match-static').checked,errors:lastFrame?.errors||{},warnings:['Scenario, mission ID, REDFOR/BLUFOR and kill events are not exposed in the observed API.','A generation change is an inferred session boundary, not a confirmed battle ID.','No missing object is considered destroyed.']};}
async function exportJson(name:string,value:unknown){
  const content=JSON.stringify(value,null,2);
  if(native){try{const path=await invoke<string>('export_json',{kind:name.includes('diagnostics')?'diagnostics':'battle',content});diagnostic(`Export saved: ${path}`);$('connection-detail').textContent=`Saved to ${path}`;}catch(error){diagnostic(`Export failed: ${error}`);$('connection-detail').textContent=`Export failed: ${error}`;}return;}
  const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('export-timeline').onclick=()=>exportJson('nuclear-thunder-battle.json',{context,mode,events:store.events,states:Object.fromEntries(store.units)});
$('export-diagnostics').onclick=()=>exportJson('nuclear-thunder-diagnostics.json',{...diagnosticSnapshot(),log:diagnostics});
let demoTick=0;
function demoEvents(){demoTick++;if(!lastFrame?.active)return;const sam=units.find(u=>u.role==='launcher'),radar=units.find(u=>/radar/i.test(u.role));
  if(demoTick%25===0&&sam){store.set(sam,'DESTROYED','SIMULATED');selectSite(sam.siteId);refreshStates();}
  if(demoTick%40===0&&radar){store.set(radar,'DESTROYED','SIMULATED');refreshStates();}
}
const timer=setInterval(()=>{updateStatus();document.querySelectorAll<HTMLElement>('[data-timer]').forEach(el=>{const state=store.get(el.dataset.timer!);if(state.status==='DESTROYED')el.textContent=timerLabel(state);});},1000);
window.addEventListener('beforeunload',()=>{poller.stop();clearInterval(timer);routeWorker?.terminate();});
window.ntlApp={snapshot:()=>({...diagnosticSnapshot(),unitStates:Object.fromEntries(store.units),events:store.events,playerMarker:playerMarker?.getLatLng()||null})};
if(engine.ready){onContext();if(native)startConnection();}
else window.addEventListener('ntl:context',()=>{if(native&&!connected)startConnection();},{once:true});
