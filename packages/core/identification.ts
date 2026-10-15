import type {MapId,NormalizedFrame,Observation,SiteData,WorldPoint} from './types';
import {distance} from './coordinates';
import {hudCombat,unitHudNames} from './hud';
type Point={position:WorldPoint;icon:string;team:number;site:string;id:number};
type Candidate={mapId:MapId;variant:string;scenario:string;grid:Map<string,Point[]>;names:Set<string>};
export interface BattleEvidence {mapId:MapId;variant:string|null;scenario:string|null;alternatives:string[];playerTeam:0|1|2;matches:number;reason:string;confidence:'inferred'|'unknown';}
const cell=180,key=(p:WorldPoint)=>`${Math.floor(p.x/cell)},${Math.floor(p.z/cell)}`;
const iconName=(name:string)=>({sam:'SAM',tracked:'MediumTank',tank:'MediumTank',wheeled:'Wheeled'}[name.toLowerCase()]||name).toLowerCase();

/** Static signatures are indexed once. Never uses player's vehicle BR as match BR. */
export class ScenarioMatcher {
  private candidates:Candidate[]=[];
  lastScores:{variant:string;scenario:string;team:number;matches:number;wrong:number;score:number}[]=[];
  constructor(variants:Record<string,SiteData[]>,presets:{id:string}[],specs:(name:string)=>any,displayName:(name:string)=>string=name=>name){
    for(const [variant,sites] of Object.entries(variants))for(const preset of presets){
      const candidate:Candidate={mapId:variant.startsWith('city')?'city':'archipelago',variant,scenario:preset.id,grid:new Map(),names:new Set()};let id=0;
      for(const site of sites){
        if(site.runtime_relocated)continue;
        for(const item of [...(site.units_by_era?.[preset.id]||[]),...(site.buildings_by_era?.[preset.id]||[])]){
          for(const name of unitHudNames(item.name,displayName(item.name),specs(item.name).hud_names||[]))candidate.names.add(name);
          if(item.unplaced||!Array.isArray(item.world_pos)||!item.world_pos.every(Number.isFinite))continue;
          const spec=specs(item.name),icon=/radar/i.test(item.role||'')?'Radar':spec.on_radar_as||'';
          if(!icon)continue;
          const point:Point={position:{x:item.world_pos[0],z:item.world_pos[2]},icon:iconName(icon),team:site.team,site:site.name,id:id++};
          const bucket=key(point.position);if(!candidate.grid.has(bucket))candidate.grid.set(bucket,[]);candidate.grid.get(bucket)!.push(point);
        }
      }
      this.candidates.push(candidate);
    }
  }
  infer(frame:NormalizedFrame,mapId:MapId,knownTeam:0|1|2=0):BattleEvidence {
    const observations=frame.objects.filter(o=>o.type==='ground_model'&&!o.player&&o.kind!=='aiming-point'&&o.kind!=='point-of-interest').slice(0,700);
    const candidates=this.candidates.filter(c=>c.mapId===mapId),knownNames=new Set(candidates.flatMap(c=>[...c.names]));
    const seenNames=new Set((frame.hud||[]).flatMap(message=>{const combat=hudCombat(message);return combat?[combat.actor,combat.target].filter(name=>knownNames.has(name)):[];}));
    const scores=candidates.flatMap(candidate=>(knownTeam?[knownTeam]:[1,2]).map(team=>{
      const used=new Set<number>(),sites=new Set<string>();let matches=0,wrong=0;
      for(const observation of observations){
        const x=Math.floor(observation.position.x/cell),z=Math.floor(observation.position.z/cell);let best:Point|undefined,bestDistance=130;
        for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const point of candidate.grid.get(`${x+dx},${z+dz}`)||[]){
          if(used.has(point.id)||point.icon!==iconName(observation.icon))continue;
          const d=distance(point.position,observation.position);if(d<bestDistance){best=point;bestDistance=d;}
        }
        if(!best)continue;
        used.add(best.id);
        const friendly=observation.relation==='friendly',enemy=observation.relation==='enemy';
        if((friendly&&best.team!==team)||(enemy&&best.team===team)){wrong++;continue;}
        matches++;sites.add(best.site);
      }
      const incompatible=[...seenNames].filter(name=>!candidate.names.has(name)).length;
      return {...candidate,team,matches,sites:sites.size,score:matches-wrong*2,wrong,incompatible};
    })).sort((a,b)=>b.score-a.score);
    this.lastScores=scores.map(({variant,scenario,team,matches,wrong,score})=>({variant,scenario,team,matches,wrong,score}));
    const geometricBest=scores[0];
    // HUD can distinguish otherwise identical radar signatures, but it cannot
    // replace the multi-site geometric evidence or identify a player's faction.
    const plausible=scores.filter(s=>geometricBest.score-s.score<Math.max(4,geometricBest.score*.12));
    const compatible=seenNames.size?plausible.filter(s=>s.incompatible===0):plausible;
    const equivalent=compatible.length?compatible:plausible,best=equivalent[0];
    const empty:BattleEvidence={mapId,variant:null,scenario:null,alternatives:[],playerTeam:0,matches:best?.matches||0,confidence:'unknown',reason:'Not enough distinct static units to identify the battle. Select the bracket and sides manually.'};
    if(!best||best.matches<8||best.sites<3||best.score<6)return empty;
    // Require both an absolute and proportional lead; nearly identical eras remain manual.
    const unique=equivalent.every(s=>s.scenario===best.scenario);
    const variant=equivalent.every(s=>s.variant===best.variant)?best.variant:null;
    const playerTeam=equivalent.every(s=>s.team===best.team)?best.team as 1|2:0;
    return {mapId,variant,scenario:unique?best.scenario:null,alternatives:[...new Set(equivalent.map(s=>s.scenario))],playerTeam,matches:best.matches,confidence:variant||unique||playerTeam?'inferred':'unknown',reason:`${best.matches} static units across ${best.sites} sites match${unique?`. Bracket inferred from placements${compatible.length<plausible.length?' and HUD unit names':''}.`:'; several brackets share these radar signatures.'}${variant?'':' Choose your faction to resolve the mirrored side layout.'}`};
  }
}

export function inferTeamFromRunways(frame:NormalizedFrame,sites:SiteData[]):0|1|2 {
  const votes=[0,0,0];
  for(const object of frame.objects.filter(o=>o.type==='airfield'&&(o.relation==='friendly'||o.relation==='enemy'))){
    const candidates=sites.flatMap(site=>(site.runways||[]).map(r=>({site,d:distance(object.position,{x:(r.start[0]+r.end[0])/2,z:(r.start[2]+r.end[2])/2})}))).filter(x=>x.d<350).sort((a,b)=>a.d-b.d);
    if(!candidates.length||(candidates[1]&&candidates[1].site.team!==candidates[0].site.team&&candidates[1].d<candidates[0].d+100))continue;
    const team=candidates[0].site.team;if(team!==1&&team!==2)continue;
    votes[object.relation==='friendly'?team:3-team]++;
  }
  if(votes[1]>=3&&votes[1]>=votes[2]*3)return 1;
  if(votes[2]>=3&&votes[2]>=votes[1]*3)return 2;
  return 0;
}

export function nearbyGroups(objects:Observation[],player:WorldPoint,radius:number,exclusionRadius:number,minimum=4){
  const points=objects.filter(o=>o.kind==='aiming-point'||o.kind==='point-of-interest');
  const vehicles=objects.filter(o=>!o.player&&o.type==='ground_model'&&(o.kind??'vehicle')==='vehicle'&&o.relation==='enemy'&&distance(o.position,player)<=radius&&!points.some(p=>distance(p.position,o.position)<=exclusionRadius));
  const buckets=new Map<string,Observation[]>();const size=1500;
  for(const vehicle of vehicles){const k=`${Math.floor(vehicle.position.x/size)},${Math.floor(vehicle.position.z/size)}`;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k)!.push(vehicle);}
  return [...buckets.values()].filter(v=>v.length>=minimum).map(v=>({count:v.length,position:{x:v.reduce((n,o)=>n+o.position.x,0)/v.length,z:v.reduce((n,o)=>n+o.position.z,0)/v.length}}));
}
