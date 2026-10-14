import type { RawFrame, NormalizedFrame, MapInfo, SiteData, MapId, Observation } from './types';
import { BOUNDS, telemetryToWorld, distance } from './coordinates';
export const record=(v:unknown): v is Record<string,any> => !!v && typeof v==='object' && !Array.isArray(v);
const finite=(v:unknown): v is number=>typeof v==='number' && Number.isFinite(v);
const pair=(v:unknown): v is [number,number] => Array.isArray(v) && v.length===2 && v.every(finite);
export function parseInfo(value:unknown): MapInfo|null {
  if (!record(value) || typeof value.valid!=='boolean' || !pair(value.map_min) || !pair(value.map_max)) return null;
  if (value.map_max[0]<=value.map_min[0] || value.map_max[1]<=value.map_min[1]) return null;
  return {valid:value.valid,map_min:value.map_min,map_max:value.map_max,map_generation:finite(value.map_generation)?value.map_generation:undefined};
}
export function normalize(frame:RawFrame):NormalizedFrame {
  const info=parseInfo(frame.mapInfo), objects:Observation[]=[];
  const connected=record(frame.mapInfo)||Array.isArray(frame.objects)||record(frame.state)||record(frame.indicators);
  const validObjects=Array.isArray(frame.objects);
  if(info?.valid && validObjects) for(const obj of (frame.objects as unknown[]).slice(0,5000)) {
    if(!record(obj)||!finite(obj.x)||!finite(obj.y)||obj.x<0||obj.x>1||obj.y<0||obj.y>1) continue;
    objects.push({position:telemetryToWorld(obj.x,obj.y,info),icon:typeof obj.icon==='string'?obj.icon:'unknown',type:typeof obj.type==='string'?obj.type:'unknown',
      color:typeof obj.color==='string'&&/^#[0-9a-f]{6}$/i.test(obj.color)?obj.color:'#a3a9b5',
      heading:finite(obj.dx)&&finite(obj.dy)&&Math.hypot(obj.dx,obj.dy)>0.001?(Math.atan2(obj.dx,-obj.dy)*180/Math.PI+360)%360:null,
      player:obj.icon==='Player'});
  }
  const player=objects.find(o=>o.player)||null;
  // A valid map alone may be cached in the hangar. Player or valid vehicle state is activity evidence.
  let active:boolean|null=null;
  if(info?.valid && (player || (record(frame.state)&&frame.state.valid===true))) active=true;
  else if(record(frame.mapInfo)&&frame.mapInfo.valid===false && record(frame.state)&&frame.state.valid===false) active=false;
  return {at:frame.at,connected,active,info,player,objects,unsupported:connected&&(!info||!validObjects),errors:frame.errors||{},source:frame.simulated?'SIMULATED':'TELEMETRY'};
}
export interface Recognition { mapId: MapId|null; confidence:'inferred'|'unknown'; matches:number; reason:string; }
export function recognizeMap(frame:RawFrame, variants:Record<string,SiteData[]>):Recognition {
  const info=parseInfo(frame.mapInfo);
  if(!info?.valid||!Array.isArray(frame.objects)) return {mapId:null,confidence:'unknown',matches:0,reason:'Map metadata unavailable'};
  const observed=frame.objects.filter(o=>record(o)&&o.type==='airfield'&&[o.sx,o.sy,o.ex,o.ey].every(finite)&&Math.hypot(o.ex-o.sx,o.ey-o.sy)>0.0001)
    .map(o=>telemetryToWorld((o.sx+o.ex)/2,(o.sy+o.ey)/2,info));
  const candidates=(['archipelago','city'] as MapId[]).map(mapId=>{
    const [min,max]=BOUNDS[mapId];
    if(Math.abs(info.map_min[0]-min)>10||Math.abs(info.map_max[0]-max)>10||Math.abs(info.map_min[1]-min)>10||Math.abs(info.map_max[1]-max)>10) return {mapId,matches:0};
    const sites=variants[mapId==='city'?'city':'standard']||[];
    const used=new Set<number>(); let matches=0;
    for(const site of sites) for(const r of site.runways||[]) {
      const p={x:(r.start[0]+r.end[0])/2,z:(r.start[2]+r.end[2])/2};
      const index=observed.findIndex((o,i)=>!used.has(i)&&distance(o,p)<350);
      if(index>=0){used.add(index);matches++;}
    }
    return {mapId,matches};
  }).sort((a,b)=>b.matches-a.matches);
  const best=candidates[0];
  return best.matches>=3&&best.matches>candidates[1].matches ? {mapId:best.mapId,confidence:'inferred',matches:best.matches,reason:`${best.matches} runway geometries and map bounds match`} : {mapId:null,confidence:'unknown',matches:best.matches,reason:'Insufficient unique geometry; select map manually'};
}

export class MatchLifecycle {
  active=false; session=0; private fingerprint:string|null=null; private candidate=''; private candidateCount=0; private idleSince:number|null=null;
  update(frame:NormalizedFrame): 'start'|'end'|'change'|null {
    if(!frame.connected || frame.active===null) return null; // Network errors never end a match.
    if(frame.active===false) {
      this.idleSince??=frame.at;
      if(this.active&&frame.at-this.idleSince>=3000){this.active=false;return 'end';}
      return null;
    }
    this.idleSince=null;
    const info=frame.info;
    const fingerprint=info?JSON.stringify([info.map_min,info.map_max,info.map_generation??null]):null;
    if(!this.active){this.active=true;this.session++;this.fingerprint=fingerprint;this.candidateCount=0;return 'start';}
    if(fingerprint&&fingerprint!==this.fingerprint) {
      if(this.candidate===fingerprint)this.candidateCount++;else {this.candidate=fingerprint;this.candidateCount=1;}
      if(this.candidateCount>=3){this.fingerprint=fingerprint;this.session++;this.candidateCount=0;return 'change';}
    } else this.candidateCount=0;
    return null;
  }
}
