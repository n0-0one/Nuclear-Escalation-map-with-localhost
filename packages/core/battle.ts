import type {UnitRecord,UnitState,Status,Source,TimelineEvent,Observation} from './types';
import {distance} from './coordinates';
export function siteSummary(states:UnitState[]):Status {
  if(!states.length) return 'UNKNOWN';
  if(states.every(s=>s.status==='DESTROYED'))return 'DESTROYED';
  if(states.some(s=>['DESTROYED','DAMAGED','POSSIBLY_DESTROYED'].includes(s.status)))return 'DAMAGED';
  if(states.some(s=>s.status==='UNKNOWN'))return 'UNKNOWN';
  if(states.every(s=>s.status==='RESPAWNING'))return 'RESPAWNING';
  if(states.some(s=>s.status==='RESPAWNING'))return 'UNKNOWN';
  if(states.every(s=>s.status==='RESTORED'))return 'RESTORED';
  if(states.every(s=>s.status==='CONFIRMED_ACTIVE'))return 'CONFIRMED_ACTIVE';
  return 'REPORTED_ACTIVE';
}
export class BattleStore {
  units=new Map<string,UnitState>(); events:TimelineEvent[]=[];
  private undoStack:{id:string;before:UnitState}[]=[]; private nextEvent=1;
  get(id:string):UnitState { return this.units.get(id)||{status:'UNKNOWN',source:'MANUAL',at:0,lastSeen:null,expectedAt:null}; }
  event(text:string,source:Source='MANUAL',category='system',objectId?:string) {
    this.events.push({id:this.nextEvent++,at:Date.now(),text,source,category,objectId,confidence:source==='INFERRED'?'inferred':source==='MANUAL'?'manual':'confirmed'});
    if(this.events.length>500)this.events.shift();
  }
  set(unit:UnitRecord,status:Status,source:Source,at=Date.now()):boolean {
    const before=this.get(unit.id);
    // A positional candidate cannot overrule a player's explicit observation.
    if(source==='INFERRED' && before.at>0 && before.source==='MANUAL')return false;
    const same=before.status===status && before.source===source;
    if(source==='MANUAL'&&!same){this.undoStack.push({id:unit.id,before:{...before}});if(this.undoStack.length>100)this.undoStack.shift();}
    this.units.set(unit.id,{status,source,at:same?before.at:at,lastSeen:['TELEMETRY','INFERRED','SIMULATED'].includes(source)?at:before.lastSeen,
      expectedAt:status==='DESTROYED'&&unit.restoreSeconds&&unit.restoreSeconds>0?(same?before.expectedAt:at+unit.restoreSeconds*1000):null});
    if(!same)this.event(`${unit.label}: ${status.replaceAll('_',' ')}`,source,unit.category,unit.id);
    return !same;
  }
  undo():string|null {const entry=this.undoStack.pop();if(!entry)return null;this.units.set(entry.id,entry.before);this.event('Manual change undone','MANUAL','manual',entry.id);return entry.id;}
  reset(reason='New battle') {this.units.clear();this.undoStack=[];this.events=[];this.event(reason,'MANUAL');}
  invalidateTimers(){for(const state of this.units.values())state.expectedAt=null;}
}
export function timerLabel(state:UnitState,now=Date.now()):string {
  if(state.expectedAt===null)return 'Restoration time unknown / no fixed rule';
  const seconds=Math.ceil((state.expectedAt-now)/1000);
  return seconds>0?`Expected in ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')} (conditional)`:'Restoration possible — unconfirmed';
}
export function matchObservations(observations:Observation[],units:UnitRecord[]):{unit:UnitRecord;observation:Observation;distance:number}[] {
  const used=new Set<string>(),matches:{unit:UnitRecord;observation:Observation;distance:number}[]=[];
  // Match only a unique compatible static position. No team inference from configurable colours.
  for(const observation of observations) {
    if(observation.player||observation.type!=='ground_model')continue;
    const candidates=units.filter(u=>u.position&&!u.approximate&&!used.has(u.id)&&u.radarIcon.toLowerCase()===observation.icon.toLowerCase())
      .map(unit=>({unit,observation,distance:distance(unit.position!,observation.position)})).filter(v=>v.distance<=65).sort((a,b)=>a.distance-b.distance);
    if(!candidates.length || (candidates[1]&&candidates[1].distance<candidates[0].distance+25))continue;
    used.add(candidates[0].unit.id);matches.push(candidates[0]);
  }
  return matches;
}
