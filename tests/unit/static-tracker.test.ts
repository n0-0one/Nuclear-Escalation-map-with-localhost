import {describe,it,expect} from 'vitest';
import {BattleStore,siteSummary} from '../../packages/core/battle';
import {StaticTracker} from '../../packages/core/static-tracker';
import {ScenarioMatcher} from '../../packages/core/identification';
import {normalize} from '../../packages/core/telemetry';
import type {NormalizedFrame,Observation,UnitRecord,SiteData} from '../../packages/core/types';
const unit=(id:string,x=0):UnitRecord=>({id,siteId:'sam',name:'sw_crotale_ng',label:'ItO 90M',role:'spaa',category:'sam',team:2,position:{x,z:0},approximate:false,range:12000,detectionRange:16000,radarIcon:'SAM',restoreSeconds:null,restoreKind:'none',restoreSource:'template'});
const observation=(x=0):Observation=>({position:{x,z:0},icon:'SAM',type:'ground_model',color:'#fa0C00',heading:null,player:false,relation:'enemy',kind:'vehicle'});
const frame=(at:number,objects:Observation[],hud=[{id:1,text:'Earlier event'}]):NormalizedFrame=>({at,connected:true,active:true,info:{valid:true,map_min:[-1000,-1000],map_max:[1000,1000]},player:null,objects,hud,unsupported:false,errors:{},source:'TELEMETRY'});
function observed(units=[unit('one')]){const store=new BattleStore(),tracker=new StaticTracker(units);for(const at of [1000,1500,2000])tracker.update(frame(at,units.map(u=>observation(u.position!.x))),store,1);return {store,tracker};}
describe('automatic component states',()=>{
  it('honors explicit destruction, summarizes partial sites and preserves manual corrections',()=>{
    const {store,tracker}=observed([unit('one'),unit('two',500)]);
    tracker.update(frame(2500,[{...observation(),explicitStatus:'destroyed'},observation(500)]),store,1);
    expect(store.get('one').status).toBe('DESTROYED');expect(siteSummary([...store.units.values()])).toBe('DAMAGED');
    store.set(unit('one'),'DESTROYED','MANUAL');tracker.update(frame(3000,[observation()]),store,1);expect(store.get('one').source).toBe('MANUAL');
  });
  it('marks sustained disappearance as possible, not confirmed destruction, and restores returning contacts',()=>{
    const {store,tracker}=observed();tracker.update(frame(2500,[]),store,1);tracker.update(frame(11000,[]),store,1);
    expect(store.get('one')).toMatchObject({status:'POSSIBLY_DESTROYED',lastSeen:2000});expect(siteSummary([...store.units.values()])).toBe('POSSIBLY_DESTROYED');
    tracker.update(frame(11500,[observation()]),store,1);expect(store.get('one').status).toBe('REPORTED_ACTIVE');
  });
  it('does not infer loss during a network gap or for never-seen units',()=>{
    const {store,tracker}=observed();tracker.update({...frame(12000,[]),errors:{objects:'timeout'}},store,1);tracker.update(frame(13000,[]),store,1);
    expect(store.get('one').status).toBe('REPORTED_ACTIVE');const unknown=new BattleStore();new StaticTracker([unit('never')]).update(frame(20000,[]),unknown,1);expect(unknown.get('never').status).toBe('UNKNOWN');
  });
  it('correlates a fresh exact HUD kill with one recently missing component',()=>{
    const {store,tracker}=observed();const hud=[{id:2,text:'Test pilot (Su-34) destroyed ItO 90M'}];
    tracker.update(frame(2500,[],hud),store,1);tracker.update(frame(4500,[],hud),store,1);expect(store.get('one')).toMatchObject({status:'DESTROYED',source:'INFERRED'});
  });
  it('refuses ambiguous duplicate kills, old history and weapon-name matches',()=>{
    const {store,tracker}=observed([unit('one'),unit('two',500)]);const hud=[{id:2,text:'Test pilot (Su-34) destroyed ItO 90M'}];
    tracker.update(frame(2500,[],hud),store,1);tracker.update(frame(4500,[],hud),store,1);expect(store.get('one').status).toBe('REPORTED_ACTIVE');
    const other=observed();other.tracker.update(frame(2500,[],[{id:1,text:'Pilot destroyed ItO 90M'},{id:3,text:'Pilot destroyed weapons/ito90m'}]),other.store,1);other.tracker.update(frame(4500,[]),other.store,1);expect(other.store.get('one').status).toBe('REPORTED_ACTIVE');
  });
});
describe('HUD-assisted BR detection',()=>{
  const sites:SiteData[]=Array.from({length:3},(_,i)=>({name:`site${i}`,team:1,world_pos:[i*2000,0,0],units_by_era:{early:Array.from({length:4},(_,j)=>({name:'old_sam',world_pos:[i*2000+j*300,0,0]})),late:Array.from({length:4},(_,j)=>({name:'ussr_buk_m3_launcher',world_pos:[i*2000+j*300,0,0]}))}}));
  const matcher=new ScenarioMatcher({standard:sites},[{id:'early'},{id:'late'}],()=>({on_radar_as:'SAM'}));
  const contacts=sites.flatMap(s=>s.units_by_era!.late.map(u=>({...observation(u.world_pos[0]),relation:'friendly' as const})));
  it('resolves identical radar icons using an exact static model in the HUD',()=>{expect(matcher.infer(frame(1000,contacts,[{id:1,text:'"BUK-M3" (TELAR) shot down Test pilot (F-15E)'}]),'archipelago',1)).toMatchObject({scenario:'late',variant:'standard'});});
  it('does not infer a preset from a player name, a weapon kill or a generic SAM icon',()=>{expect(matcher.infer(frame(1000,contacts,[{id:1,text:'BUK-M3-player (Su-34) destroyed 360mm_9m317m'}]),'archipelago',1).scenario).toBeNull();});
  it('bounds HUD input and preserves only supported message fields',()=>{const normalized=normalize({at:1,mapInfo:{valid:true,map_min:[-1,-1],map_max:[1,1]},objects:[],hud:{damage:[{id:1,msg:'Test',sender:'private'}, {id:'bad',msg:'bad'}]}});expect(normalized.hud).toEqual([{id:1,text:'Test'}]);});
});
