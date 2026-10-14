import type * as Leaflet from 'leaflet';
import type {Context,SiteData,UnitRecord} from '../../../packages/core/types';
export interface MapEngine {
  L:typeof Leaflet;map:Leaflet.Map;ready:boolean;context():Context;sites():SiteData[];variants():Record<string,SiteData[]>;
  definitions:Record<string,any>;presets():{id:string;label:string}[];mission():any;roads():any[];
  specs(name:string):any;category(site:SiteData):string;displayName(name:string):string;lifecycle(unit:any,site:SiteData):any;
  worldToLatLng(x:number,z:number):[number,number];latLngToWorld(p:Leaflet.LatLng):[number,number];terrain(x:number,y:number):number|null;
  setContext(mapId:string,variant?:string,scenario?:string):void;focus(name:string):void;markUnit(id:string,status:string):void;markSite(name:string,status:string):void;
  convoyRoutes():{key:string;points:number[][];link:any;kind:string}[];
}
declare global {interface Window { ntlMap:MapEngine; __TAURI_INTERNALS__?:unknown; ntlApp?:{snapshot:()=>unknown}; }}
export function catalog(engine:MapEngine):UnitRecord[]{
  const context=engine.context();return engine.sites().flatMap(site=>{
    const result:UnitRecord[]=[];
    for(const kind of ['unit','building']){
      const records=(kind==='unit'?site.units_by_era:site.buildings_by_era)?.[context.scenario]||[];
      records.forEach((unit:any,index:number)=>{
        const specs=engine.specs(unit.name),life=engine.lifecycle(unit,site);
        let radarIcon=specs.on_radar_as||'';
        if(/radar/i.test(unit.role))radarIcon='Radar';
        const aliases:Record<string,string>={sam:'SAM',tracked:'MediumTank',wheeled:'Wheeled',tank:'MediumTank'};
        radarIcon=aliases[radarIcon]||radarIcon;
        result.push({id:[context.variant,context.scenario,site.name,kind,unit.id||index].join('|'),siteId:site.name,name:unit.name,label:engine.displayName(unit.name)+` #${index+1}`,
          role:unit.role||kind,category:engine.category(site),team:site.team,
          position:Array.isArray(unit.world_pos)?{x:unit.world_pos[0],z:unit.world_pos[2]}:null,
          approximate:!!unit.unplaced||!!site.runtime_relocated,range:Math.max(0,Number(specs.ai_engagement_range||specs.engagement_range||0)),
          detectionRange:Math.max(0,Number(unit.threat_range||specs.sensors?.detection?.nominal||0)),radarIcon,
          restoreSeconds:Number.isFinite(life.seconds)&&life.seconds>0?life.seconds:null,restoreKind:life.kind,restoreSource:life.source});
      });
    }
    if(!result.length)result.push({id:[context.variant,context.scenario,site.name,'objective'].join('|'),siteId:site.name,name:site.name,label:engine.displayName(site.name),role:'objective',category:engine.category(site),team:site.team,position:{x:site.world_pos[0],z:site.world_pos[2]},approximate:!!site.runtime_relocated,range:0,detectionRange:0,radarIcon:'',restoreSeconds:null,restoreKind:'unknown',restoreSource:'unknown'});
    return result;
  });
}
