import {invoke} from '@tauri-apps/api/core';
import type {RawFrame} from '../../../packages/core/types';
import type {Provider} from '../../../packages/core/poller';
async function getJson(url:string,signal:AbortSignal,headers?:HeadersInit){
  const combined=AbortSignal.any([signal,AbortSignal.timeout(1500)]);
  const response=await fetch(url,{signal:combined,headers,cache:'no-store',redirect:'error'});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const text=await response.text();if(text.length>2*1024*1024)throw new Error('Telemetry response too large');return JSON.parse(text);
}
export function directProvider():Provider {
  const cache:RawFrame={at:0,mapInfo:null,objects:null,errors:{}};const last:Record<string,number>={};
  return async signal=>{
    const now=Date.now(), entries=[['objects','map_obj.json',0],['mapInfo','map_info.json',2000],['state','state',1000],['indicators','indicators',3000]] as const;
    await Promise.all(entries.filter(([key,,cadence])=>!last[key]||now-last[key]>=cadence).map(async([key,path])=>{
      last[key]=now;
      try{cache[key]=await getJson(`http://127.0.0.1:8111/${path}`,signal);delete cache.errors![key];}
      catch(error){cache[key]=null;cache.errors![key]=String(error);}
    }));
    return {...cache,at:Date.now(),errors:{...cache.errors}};
  };
}
export const bridgeProvider=(token:string):Provider=>async signal=>getJson('http://127.0.0.1:8112/v1/snapshot',signal,{Authorization:`Bearer ${token}`});
export const nativeProvider:Provider=async()=>invoke<RawFrame>('telemetry_snapshot');
export function demoProvider():Provider {
  let tick=0;
  return async()=>{
    tick++;const phase=tick%100,active=phase>=5&&phase<87;
    if(phase>=66&&phase<=70)return {at:Date.now(),mapInfo:null,objects:null,simulated:true,errors:{demo:'SIMULATED connection loss'}};
    return {at:Date.now(),simulated:true,mapInfo:{valid:active,map_min:[-131072,-131072],map_max:[131072,131072],map_generation:Math.floor(tick/100)+1},state:{valid:active},
      objects:active?[{type:'aircraft',icon:'Player',x:0.5+0.12*Math.cos(tick/18),y:0.5+0.12*Math.sin(tick/18),dx:-Math.sin(tick/18),dy:Math.cos(tick/18),color:'#f3bc55'},
      {type:'ground_model',icon:'Wheeled',x:0.55+tick%60/1200,y:0.6,color:'#f3bc55'}]:[]};
  };
}
