import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {worldToMap,mapToWorld,telemetryToWorld} from '../../packages/core/coordinates';
import {normalize,recognizeMap,MatchLifecycle} from '../../packages/core/telemetry';
import {BattleStore,siteSummary,timerLabel,matchObservations} from '../../packages/core/battle';
import {planRoute} from '../../packages/core/route';
import {Poller} from '../../packages/core/poller';
import type {UnitRecord,RawFrame} from '../../packages/core/types';
const load=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const fixture=load('tests/fixtures/schema-fixture.json');
const variants=Object.fromEntries([['standard',''],['mirror','_mirror'],['city','_city'],['city_mirror','_city_mirror']].map(([k,s])=>[k,load(`apps/web/public/map_data${s}.json`)]));
const unit:UnitRecord={id:'site|launcher|1',siteId:'sam',name:'sam',label:'Launcher 1',role:'launcher',category:'longSams',team:1,position:{x:0,z:0},approximate:false,range:10000,detectionRange:0,radarIcon:'SAM',restoreSeconds:720,restoreKind:'restore',restoreSource:'template'};
const raw=(at=1000):RawFrame=>({...fixture,at});
describe('coordinates and observed schema',()=>{
  it('preserves asymmetric city/archipelago bounds',()=>{expect(worldToMap({x:0,z:0},'city')).toEqual([2048,2048]);expect(worldToMap({x:65536,z:-65536},'city')).toEqual([0,4096]);expect(worldToMap({x:65536,z:-65536},'archipelago')).toEqual([1024,3072]);});
  it('roundtrips and inverts telemetry Y',()=>{const p={x:12345,z:-54321};const [lat,lng]=worldToMap(p,'archipelago');expect(mapToWorld(lat,lng,'archipelago')).toEqual(p);expect(telemetryToWorld(0,0,fixture.mapInfo)).toEqual({x:-131072,z:131072});});
  it('recognizes actual runway geometry, never bounds alone',()=>{const found=recognizeMap(raw(),variants);expect(found.mapId).toBe('archipelago');expect(found.matches).toBeGreaterThanOrEqual(8);expect(found.confidence).toBe('inferred');expect(recognizeMap({...raw(),objects:[]},variants).mapId).toBeNull();});
  it('reads real player fields and rejects malformed coordinates',()=>{const result=normalize(raw());expect(result.active).toBe(true);expect(result.player?.icon).toBe('Player');expect(result.player?.position.x).toBeTypeOf('number');const bad=normalize({...raw(),objects:[{x:'1',y:1,icon:'Player'},{x:NaN,y:.2},{x:.3,y:2}]});expect(bad.objects).toHaveLength(0);});
  it('does not promote a cached map to active battle',()=>{expect(normalize({...raw(),state:{valid:false},objects:[]}).active).toBeNull();});
  it('does not infer affiliation or scenario from vehicle/colour',()=>{const result=normalize(raw());expect(result).not.toHaveProperty('scenario');expect(result).not.toHaveProperty('playerTeam');});
});
describe('battle boundaries',()=>{
  it('timeouts do not reset; inactive evidence is debounced',()=>{const life=new MatchLifecycle();expect(life.update(normalize(raw()))).toBe('start');expect(life.update(normalize({at:2000,mapInfo:null,objects:null}))).toBeNull();expect(life.active).toBe(true);const idle=(at:number)=>normalize({at,mapInfo:{...fixture.mapInfo,valid:false},objects:[],state:{valid:false}});expect(life.update(idle(3000))).toBeNull();expect(life.update(idle(6100))).toBe('end');expect(life.update(normalize(raw(7000)))).toBe('start');expect(life.session).toBe(2);});
  it('requires three consistent generation samples',()=>{const life=new MatchLifecycle();life.update(normalize(raw()));const changed=()=>normalize({...raw(),mapInfo:{...fixture.mapInfo,map_generation:9}});expect(life.update(changed())).toBeNull();expect(life.update(changed())).toBeNull();expect(life.update(changed())).toBe('change');});
});
describe('component evidence',()=>{
  it('partial destruction degrades the site and unknown remains unknown',()=>{const store=new BattleStore();store.set(unit,'DESTROYED','MANUAL',1000);expect(siteSummary([store.get(unit.id),store.get('other')])).toBe('DAMAGED');expect(siteSummary([store.get('other')])).toBe('UNKNOWN');expect(siteSummary([store.get(unit.id)])).toBe('DESTROYED');});
  it('timers cannot establish active state, and undo restores state',()=>{const store=new BattleStore();store.set(unit,'DESTROYED','MANUAL',1000);expect(timerLabel(store.get(unit.id),800000)).toContain('unconfirmed');expect(store.get(unit.id).status).toBe('DESTROYED');store.undo();expect(store.get(unit.id).status).toBe('UNKNOWN');});
  it('manual correction survives inferred presence; duplicate observations do not spam',()=>{const store=new BattleStore();store.set(unit,'DESTROYED','MANUAL',1000);store.set(unit,'REPORTED_ACTIVE','INFERRED',2000);expect(store.get(unit.id).status).toBe('DESTROYED');store.reset();store.set(unit,'REPORTED_ACTIVE','INFERRED',3000);const n=store.events.length;store.set(unit,'REPORTED_ACTIVE','INFERRED',4000);expect(store.events).toHaveLength(n);expect(store.get(unit.id).lastSeen).toBe(4000);});
  it('missing objects never mean destroyed and ambiguous candidates are rejected',()=>{const o={position:{x:1,z:0},icon:'SAM',type:'ground_model',color:'#ffffff',heading:null,player:false};expect(matchObservations([o],[unit])).toHaveLength(1);expect(matchObservations([o],[unit,{...unit,id:'2',position:{x:2,z:0}}])).toHaveLength(0);expect(matchObservations([], [unit])).toHaveLength(0);expect(matchObservations([o],[{...unit,approximate:true}])).toHaveLength(0);});
  it('history and undo storage are bounded; reset clears timers',()=>{const store=new BattleStore();for(let i=0;i<800;i++)store.event(String(i));expect(store.events.length).toBe(500);store.set(unit,'DESTROYED','MANUAL');store.reset();expect(store.units.size).toBe(0);expect(store.undo()).toBeNull();});
  it('respawning components cannot summarize as active',()=>{const store=new BattleStore();store.set(unit,'RESPAWNING','MANUAL');expect(siteSummary([store.get(unit.id)])).toBe('RESPAWNING');});
});
describe('route estimates',()=>{
  const input={points:[{x:-30000,z:0},{x:30000,z:0}],mapId:'city' as const,avoidUnknown:true,avoidActive:true,enemyTeam:0,threats:[{position:{x:0,z:0},range:14000,status:'UNKNOWN' as const,team:1}]};
  it('routes around unknown threat rings by default',()=>{const result=planRoute(input);const shortest=planRoute({...input,threats:[]});expect(result.distance).toBeGreaterThan(shortest.distance);expect(result.exposure).toBeLessThan(3000);expect(result.points[0]).toEqual(input.points[0]);expect(result.points.at(-1)).toEqual(input.points.at(-1));});
  it('ignores destroyed threats and rejects invalid waypoints',()=>{expect(planRoute({...input,threats:[{...input.threats[0],status:'DESTROYED'}]}).distance).toBe(planRoute({...input,threats:[]}).distance);expect(()=>planRoute({...input,points:[{x:Infinity,z:0},input.points[1]]})).toThrow();});
});
describe('polling',()=>{
  it('does not overlap and ignores late responses after switching modes',async()=>{vi.useFakeTimers();let resolve!:(f:RawFrame)=>void;const provider=vi.fn(()=>new Promise<RawFrame>(r=>resolve=r)),receive=vi.fn();const poller=new Poller(receive);poller.start(provider);await vi.advanceTimersByTimeAsync(5000);expect(provider).toHaveBeenCalledTimes(1);poller.stop();resolve(raw());await Promise.resolve();expect(receive).not.toHaveBeenCalled();vi.useRealTimers();});
  it('backs off on failure and recovers',async()=>{vi.useFakeTimers();let count=0;const receive=vi.fn(),p=new Poller(receive);p.start(async()=>{if(count++===0)throw new Error('offline');return raw();});await vi.advanceTimersByTimeAsync(1);expect(p.failures).toBe(1);await vi.advanceTimersByTimeAsync(1000);expect(p.failures).toBe(0);expect(p.interval).toBe(400);p.stop();vi.useRealTimers();});
});
