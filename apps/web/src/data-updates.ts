import {invoke} from '@tauri-apps/api/core';
type Snapshot={revision:string;source:string;data:Record<string,unknown>|null;warning:string|null};
type Result={revision:string;updated:boolean;message:string};
const files=new Set(['map_data.json','map_data_mirror.json','map_data_city.json','map_data_city_mirror.json','mission_logic.json','mission_logic_mirror.json','mission_logic_city.json','mission_logic_city_mirror.json','presets.json','unit_specs.json','unit_display_names.json','datamine-lock.json']);
let snapshot:Snapshot|null=null,message='',pending=false,lastResult:Result|null=null;

/** Called before the map engine starts. Only native, verified data is overlaid. */
export async function bootstrapData(){
  if(!window.__TAURI_INTERNALS__)return;
  try{
    snapshot=await invoke<Snapshot>('datamine_bootstrap');
    if(snapshot.data){
      const data=snapshot.data,original=window.fetch.bind(window),base=new URL('.',document.baseURI);
      if(Object.keys(data).length!==files.size||![...files].every(name=>Object.hasOwn(data,name)))throw new Error('Incomplete data cache');
      window.fetch=async(input,init)=>{
        const url=new URL(input instanceof Request?input.url:String(input),document.baseURI),name=url.pathname.slice(base.pathname.length);
        if(url.origin===base.origin&&url.pathname.startsWith(base.pathname)&&files.has(name)&&(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase()==='GET'){
          return new Response(JSON.stringify(data[name]),{status:200,headers:{'Content-Type':'application/json','X-NTL-Data-Revision':snapshot!.revision}});
        }
        return original(input,init);
      };
    }
    message=snapshot.warning||'Automatic checks run on launch and every four hours. Downloaded data loads on the next launch.';
  }catch(error){snapshot=null;message=`Bundled data is in use. ${String(error)}`;}
}
function render(){
  const status=document.getElementById('data-update-status'),button=document.getElementById('check-data-update');
  if(status)status.textContent=`Loaded: ${snapshot?.source||'bundled'} data${snapshot?.revision?` · ${snapshot.revision.slice(0,12)}`:''}. ${message}`;
  if(button){(button as HTMLButtonElement).disabled=pending;button.textContent=pending?'Checking data…':'Check data now';}
}
async function check(){
  if(pending)return;pending=true;render();
  try{lastResult=await invoke<Result>('datamine_check');message=lastResult.revision===snapshot?.revision?'Your loaded datamine revision is current.':lastResult.message;}
  catch(error){message=`Update check failed: ${String(error)}. Your current data remains available.`;}
  finally{pending=false;render();}
}
export function startDataUpdates(){
  if(!window.__TAURI_INTERNALS__)return;
  const section=document.createElement('div');section.id='data-updates';section.innerHTML='<h3>Automatic mission data</h3><p id="data-update-status" class="ntl-muted"></p><button id="check-data-update">Check data now</button>';
  document.getElementById('settings-section')?.append(section);document.getElementById('check-data-update')!.onclick=()=>void check();render();
  const startup=setTimeout(()=>void check(),3000),interval=setInterval(()=>void check(),4*60*60*1000);
  window.addEventListener('beforeunload',()=>{clearTimeout(startup);clearInterval(interval);},{once:true});
}
export const dataUpdateSnapshot=()=>({loadedRevision:snapshot?.revision||null,source:snapshot?.source||'bundled',availableRevision:lastResult?.revision||null,message});
