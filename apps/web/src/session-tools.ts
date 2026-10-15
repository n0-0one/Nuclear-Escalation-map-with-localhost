import './affinity.css';
import {ScenarioMatcher,inferTeamFromRunways} from '../../../packages/core/identification';
import {AirfieldTracker} from '../../../packages/core/airfields';
import type {Context,NormalizedFrame} from '../../../packages/core/types';

let matcher:ScenarioMatcher|null=null,lastInference=0,lastRender='',lastEvidence='',consistent=0,lastSession='',teamMode=0;
const airfields=new AirfieldTracker();
const emit=(name:string,detail:unknown)=>window.dispatchEvent(new CustomEvent(name,{detail}));
window.addEventListener('ntl:team-mode',event=>{teamMode=(event as CustomEvent).detail.team;lastInference=0;lastEvidence='';consistent=0;});
function panel(){
  let section=document.getElementById('airfield-section');if(section)return section;
  const target=document.getElementById('live-panel');if(!target)return null;
  section=document.createElement('details');section.id='airfield-section';section.innerHTML='<summary>Airfields</summary><p class="ntl-muted">Track airfields you can see. Mark confirmed destruction here. A missing marker is not proof of destruction.</p><div id="airfield-list" class="ntl-airfield-status"></div>';
  section.addEventListener('click',event=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button[data-airfield]');if(!button)return;airfields.manual(button.dataset.airfield!,button.dataset.action==='destroy');lastRender='';renderAirfields();});
  target.appendChild(section);return section;
}
function renderAirfields(){
  if(!panel())return;const states=[...airfields.states.values()];const signature=JSON.stringify(states.map(s=>[s.id,s.status,s.source]));if(signature===lastRender)return;lastRender=signature;
  const list=document.getElementById('airfield-list')!;list.replaceChildren();
  for(const state of states){
    const row=document.createElement('div');row.className='ntl-airfield-row';const text=document.createElement('span');text.textContent=state.label;const status=document.createElement('small');
    status.textContent=`${{unknown:'Unknown',seen:'Visible in telemetry',missing:'No longer reported',destroyed:'Destroyed'}[state.status]} · ${state.source}`;if(state.status==='destroyed')status.className='ntl-airfield-dead';text.append(status);
    const button=document.createElement('button');button.dataset.airfield=state.id;button.dataset.action=state.status==='destroyed'?'reset':'destroy';button.textContent=state.status==='destroyed'?'Reset':'Destroyed';
    row.append(text,button);list.append(row);
  }
  emit('ntl:airfields-changed',null);
}
function resetAirfields(){airfields.reset(window.ntlMap.sites());lastRender='';lastEvidence='';consistent=0;renderAirfields();}
window.addEventListener('ntl:battle-reset',resetAirfields);
window.addEventListener('ntl:frame',event=>{
  const {frame,context,mode,mapAgrees,teamMode:modeTeam}=(event as CustomEvent<{frame:NormalizedFrame;context:Context;mode:string;mapAgrees?:boolean;teamMode?:number}>).detail;
  if(!context||!window.ntlMap?.ready)return;const engine=window.ntlMap;
  if(mapAgrees===false)return;
  if(modeTeam!==undefined)teamMode=modeTeam;
  matcher??=new ScenarioMatcher(engine.variants(),engine.presets(),name=>engine.specs(name),name=>engine.displayName(name));
  const session=frame.info?.valid?JSON.stringify([context.mapId,context.variant,frame.info.map_generation,mode]):lastSession;
  if(session!==lastSession){lastSession=session;airfields.reset(engine.sites());consistent=0;lastEvidence='';lastRender='';}
  airfields.update(frame,engine.sites());renderAirfields();
  if(!frame.active||frame.at-lastInference<2000)return;lastInference=frame.at;
  const evidence=matcher.infer(frame,context.mapId,teamMode===1||teamMode===2?teamMode:0);
  const signature=JSON.stringify([evidence.variant,evidence.scenario,evidence.playerTeam]);
  consistent=signature===lastEvidence?consistent+1:1;lastEvidence=signature;
  const runwaysTeam=inferTeamFromRunways(frame,engine.sites());
  // Runway colours establish friendly versus enemy for the selected static layout,
  // but do not establish a nation or a mirrored layout on their own.
  if(!teamMode&&runwaysTeam)emit('ntl:team-inferred',{team:runwaysTeam,reason:'Friendly/enemy runway colours match the selected layout; national identity is not reported.'});
  if(consistent>=2){
    if(!teamMode&&evidence.playerTeam&&evidence.variant===context.variant)emit('ntl:team-inferred',{team:evidence.playerTeam,reason:evidence.reason});
    emit('ntl:context-evidence',{mapId:context.mapId,variant:evidence.variant||undefined,scenario:evidence.scenario||undefined,alternatives:evidence.alternatives,reason:evidence.reason,confidence:evidence.confidence});
  }
});
window.addEventListener('ntl:context',()=>{const context=window.ntlMap.context();if(lastSession&&!lastSession.includes(`"${context.variant}"`))resetAirfields();lastRender='';renderAirfields();});
export const airfieldSnapshot=()=>[...airfields.states.values()];
