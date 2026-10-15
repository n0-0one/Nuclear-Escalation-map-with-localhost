import type {NormalizedFrame,SiteData,WorldPoint} from './types';
import {distance} from './coordinates';
export interface AirfieldState {id:string;label:string;position:WorldPoint;team:number;status:'unknown'|'seen'|'missing'|'destroyed';source:'telemetry'|'manual';lastSeen:number|null;missingSince:number|null;}
export class AirfieldTracker {
  states=new Map<string,AirfieldState>();
  reset(sites:SiteData[]){this.states.clear();for(const site of sites.filter(s=>s.runways?.length))this.states.set(site.name,{id:site.name,label:site.name.replace(/^t[12]_/, '').replaceAll('_',' '),position:{x:site.world_pos[0],z:site.world_pos[2]},team:site.team,status:'unknown',source:'telemetry',lastSeen:null,missingSince:null});}
  manual(id:string,destroyed:boolean){const state=this.states.get(id);if(state){state.status=destroyed?'destroyed':'unknown';state.source=destroyed?'manual':'telemetry';state.missingSince=null;}}
  update(frame:NormalizedFrame,sites:SiteData[]){
    if(!frame.active||!frame.info?.valid||frame.errors.objects)return;
    const observed=frame.objects.filter(o=>o.type==='airfield');
    for(const site of sites){const state=this.states.get(site.name);if(!state||state.source==='manual')continue;
      const runways=(site.runways||[]).map(r=>({x:(r.start[0]+r.end[0])/2,z:(r.start[2]+r.end[2])/2}));
      const matches=observed.filter(o=>runways.some(p=>distance(p,o.position)<350));
      if(matches.length){
        state.lastSeen=frame.at;state.missingSince=null;
        state.status=matches.every(o=>o.explicitStatus==='destroyed')&&runways.every(p=>matches.some(o=>distance(p,o.position)<350))?'destroyed':'seen';
      }else if(state.lastSeen!==null&&observed.length>=3){
        state.missingSince??=frame.at;
        if(frame.at-state.missingSince>=8000)state.status='missing';
      }
      // Disappearance never establishes destruction; only explicit object flags or manual evidence do.
    }
  }
}
