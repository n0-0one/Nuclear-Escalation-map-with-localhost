import {BattleStore} from './battle';
import {distance} from './coordinates';
import {hudCombat,unitHudNames} from './hud';
import type {NormalizedFrame,Observation,UnitRecord} from './types';

const cell=180,key=(x:number,z:number)=>`${Math.floor(x/cell)},${Math.floor(z/cell)}`;
const icon=(text:string)=>({tracked:'mediumtank',tank:'mediumtank'}[text.toLowerCase()]||text.toLowerCase());
type Seen={first:number;last:number;samples:number;missingAt:number|null};
export class StaticTracker {
  private grid=new Map<string,UnitRecord[]>();private seen=new Map<string,Seen>();
  private lastHud=-1;private initializedHud=false;private pending:{id:number;target:string;at:number}[]=[];
  private aliases=new Map<string,Set<string>>();
  matches=0;
  constructor(private units:UnitRecord[],displayName:(name:string)=>string=name=>name,shortNames:(name:string)=>string[]=()=>[]){
    for(const unit of units){
      if(!unit.position||unit.approximate||!unit.radarIcon)continue;
      const k=key(unit.position.x,unit.position.z);if(!this.grid.has(k))this.grid.set(k,[]);this.grid.get(k)!.push(unit);
      this.aliases.set(unit.id,new Set(unitHudNames(unit.name,displayName(unit.name),shortNames(unit.name))));
    }
  }
  match(objects:Observation[],team:number){
    const used=new Set<string>(),matches:{unit:UnitRecord;observation:Observation}[]=[];
    for(const observation of objects){
      if(observation.player||observation.type!=='ground_model'||observation.kind&&observation.kind!=='vehicle')continue;
      const x=Math.floor(observation.position.x/cell),z=Math.floor(observation.position.z/cell),candidates:{unit:UnitRecord;d:number}[]=[];
      for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const unit of this.grid.get(`${x+dx},${z+dz}`)||[]){
        if(used.has(unit.id)||icon(unit.radarIcon)!==icon(observation.icon))continue;
        if(team&&((observation.relation==='friendly'&&unit.team!==team)||(observation.relation==='enemy'&&unit.team===team)))continue;
        const d=distance(unit.position!,observation.position);if(d<=130)candidates.push({unit,d});
      }
      candidates.sort((a,b)=>a.d-b.d);if(!candidates.length||candidates[1]&&candidates[1].d<candidates[0].d+25)continue;
      used.add(candidates[0].unit.id);matches.push({unit:candidates[0].unit,observation});
    }return matches;
  }
  update(frame:NormalizedFrame,store:BattleStore,team=0){
    if(!frame.connected||!frame.active||frame.errors.objects||!frame.info?.valid){
      for(const seen of this.seen.values())seen.missingAt=null;
      this.pending=[];return false;
    }
    const matches=this.match(frame.objects,team),current=new Set(matches.map(m=>m.unit.id));this.matches=matches.length;let changed=false;
    for(const {unit,observation} of matches){
      const prior=this.seen.get(unit.id),seen=prior||{first:frame.at,last:frame.at,samples:0,missingAt:null};
      seen.last=frame.at;seen.samples++;seen.missingAt=null;this.seen.set(unit.id,seen);
      changed=store.set(unit,observation.explicitStatus==='destroyed'?'DESTROYED':'REPORTED_ACTIVE',frame.source==='SIMULATED'?'SIMULATED':'INFERRED',frame.at)||changed;
    }
    for(const [id,seen] of this.seen){
      if(current.has(id)||seen.samples<3)continue;
      seen.missingAt??=frame.at;
      const status=store.get(id).status;
      if(frame.at-seen.missingAt>=8000&&status!=='DESTROYED'){
        const unit=this.units.find(u=>u.id===id)!;changed=store.set(unit,'POSSIBLY_DESTROYED',frame.source==='SIMULATED'?'SIMULATED':'INFERRED',frame.at)||changed;
      }
    }
    const hud=frame.hud||[],newMessages=this.initializedHud?hud.filter(m=>m.id>this.lastHud):[];
    if(hud.length){this.lastHud=Math.max(this.lastHud,...hud.map(m=>m.id));this.initializedHud=true;}
    for(const message of newMessages){const combat=hudCombat(message);if(combat?.destroyed)this.pending.push({id:combat.id,target:combat.target,at:frame.at});}
    this.pending=this.pending.filter(kill=>frame.at-kill.at<=12000);
    for(const kill of [...this.pending]){
      const candidates=this.units.filter(unit=>{
        const seen=this.seen.get(unit.id);return seen&&seen.samples>=3&&seen.missingAt!==null&&frame.at-seen.missingAt>=1500&&Math.abs(seen.missingAt-kill.at)<=6000&&this.aliases.get(unit.id)?.has(kill.target)&&store.get(unit.id).status!=='DESTROYED';
      });
      if(candidates.length!==1)continue;
      changed=store.set(candidates[0],'DESTROYED',frame.source==='SIMULATED'?'SIMULATED':'INFERRED',frame.at)||changed;
      this.pending=this.pending.filter(item=>item!==kill);
    }
    return changed;
  }
}
