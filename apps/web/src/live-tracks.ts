import type * as Leaflet from 'leaflet';
import type {Observation,MapId} from '../../../packages/core/types';
import {distance,worldToMap} from '../../../packages/core/coordinates';

export type LiveObservation=Observation & {relation?:'friendly'|'enemy'|'neutral'|'unknown';nuclear?:boolean;kind?:'vehicle'|'aiming-point'|'point-of-interest'|'objective';telemetryId?:string};
export interface TrackSettings {markerScale:number;trails:boolean;trailLength:number;smoothMovement:boolean;showObserved:boolean;}
export interface ObservedTrack {id:number;observation:LiveObservation;at:number;nuclearManual?:boolean;}
interface Track extends ObservedTrack {marker:Leaflet.CircleMarker|Leaflet.Marker;line:Leaflet.Polyline;history:Leaflet.LatLngExpression[];lastTrail:number;styleKey:string;stale:boolean;telemetryNuclear?:boolean;animation?:{from:Leaflet.LatLng;to:Leaflet.LatLng;start:number;duration:number};}
const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const observationColor=(o:LiveObservation)=>o.kind==='aiming-point'?'#ffe14e':o.kind==='point-of-interest'?'#ff5262':o.relation==='enemy'?'#ff4557':o.relation==='friendly'?'#69b8ff':o.relation==='neutral'?'#d2d9e3':'#e6c26b';
export const observationLabel=(o:LiveObservation)=>o.kind==='aiming-point'?'Your aiming point':o.kind==='point-of-interest'?'Your point of interest':`${o.nuclear?'NUCLEAR AIRCRAFT · ':''}${o.icon||o.type} · ${o.relation||'unknown'} affiliation`;
const isAircraft=(o:LiveObservation)=>o.type==='aircraft';
const bucketSize=(o:LiveObservation)=>isAircraft(o)?2000:220;
const group=(o:LiveObservation)=>`${o.kind||'vehicle'}|${o.type}|${o.icon}|${o.relation||'unknown'}`;

/** Canvas vehicle/trail rendering, spatial matching and bounded movement interpolation. */
export class LiveTracks {
  private tracks=new Map<number,Track>();
  private nextId=1;
  private renderer:Leaflet.Canvas;
  private markers:Leaflet.LayerGroup;
  private lines:Leaflet.LayerGroup;
  private request=0;
  private lastPaint=0;
  selected:number|null=null;
  comparisonCount=0;
  constructor(private L:typeof Leaflet,private map:Leaflet.Map,private settings:()=>TrackSettings,private onSelect:(id:number)=>void){
    this.renderer=L.canvas({padding:.3,tolerance:7}).addTo(map);
    this.markers=L.layerGroup().addTo(map);this.lines=L.layerGroup().addTo(map);
  }
  snapshot():ObservedTrack[]{return [...this.tracks.values()].map(({id,observation,at,nuclearManual})=>({id,observation,at,nuclearManual}));}
  setManualNuclear(id:number|null,value:boolean){const track=this.get(id);if(!track||track.observation.type!=='aircraft')return;track.nuclearManual=value;track.observation={...track.observation,nuclear:value||track.telemetryNuclear===true};this.style(track,true);}
  hidePoints(){for(const[id,t]of this.tracks)if(t.observation.kind==='aiming-point'||t.observation.kind==='point-of-interest'){this.markers.removeLayer(t.marker);this.lines.removeLayer(t.line);this.tracks.delete(id);}}
  get(id:number|null){return id===null?undefined:this.tracks.get(id);}
  select(id:number|null){const old=this.get(this.selected);this.selected=id;if(old)this.style(old,true);const current=this.get(id);if(current)this.style(current,true);}
  clear(){cancelAnimationFrame(this.request);this.request=0;this.markers.clearLayers();this.lines.clearLayers();this.tracks.clear();this.selected=null;}
  refresh(){for(const t of this.tracks.values()){this.style(t,true);this.syncTrail(t);}if(!this.settings().showObserved)this.clear();}
  private syncTrail(t:Track){
    const settings=this.settings();if(t.history.length>settings.trailLength)t.history=t.history.slice(-settings.trailLength);
    t.line.setLatLngs(t.history);
    if(settings.trails&&t.history.length>1&&!this.lines.hasLayer(t.line))this.lines.addLayer(t.line);
    else if(!settings.trails)this.lines.removeLayer(t.line);
  }
  private icon(o:LiveObservation,selected:boolean,manual=false){
    const scale=this.settings().markerScale,nuclear=!!o.nuclear,size=(nuclear?38:o.kind&&o.kind!=='vehicle'?25:25)*scale;
    const symbol=o.kind==='aiming-point'?'⌖':o.kind==='point-of-interest'?'◆':'✈';
    return this.L.divIcon({className:`ntl-live-icon ${nuclear?'ntl-nuclear-icon':''} ${selected?'ntl-track-selected':''}`,html:`<span style="color:${observationColor(o)};font-size:${size}px;transform:rotate(${isAircraft(o)?(o.heading??0)-45:0}deg)">${symbol}</span>${nuclear?`<b>NUKE${manual?' · MANUAL':''}</b>`:''}`,iconSize:[size,size],iconAnchor:[size/2,size/2]});
  }
  private style(t:Track,force=false){
    const o=t.observation,s=this.settings(),selected=t.id===this.selected,color=observationColor(o);
    const key=[color,o.nuclear,selected,s.markerScale,t.stale,o.heading].join('|');if(!force&&key===t.styleKey)return;t.styleKey=key;
    if(t.marker instanceof this.L.CircleMarker)t.marker.setStyle({radius:(selected?9:5.5)*s.markerScale,color:selected?'#ffffff':'#10151e',weight:selected?2.5:1.5,fillColor:color,fillOpacity:t.stale?.3:.95,opacity:t.stale?.4:1});
    else {t.marker.setIcon(this.icon(o,selected,t.nuclearManual));t.marker.setOpacity(t.stale?.35:1);t.marker.setZIndexOffset(o.nuclear?6500:selected?5500:4000);}
    t.line.setStyle({color,weight:selected?3:1.8,opacity:selected?.8:.4});
    t.marker.setTooltipContent(`${escapeHtml(observationLabel(o))}${t.nuclearManual?' · marked manually':''}<br>${o.telemetryId?'Telemetry identifier available':'Track continuity estimated'} · click to select`);
  }
  update(observations:LiveObservation[],at:number,mapId:MapId,interval:number){
    if(!this.settings().showObserved)return;
    const buckets=new Map<string,Track[]>(),explicit=new Map<string,Track[]>(),used=new Set<number>();this.comparisonCount=0;
    for(const t of this.tracks.values()){
      if(at-t.at>3000)continue;const o=t.observation,size=bucketSize(o),key=`${group(o)}|${Math.floor(o.position.x/size)}|${Math.floor(o.position.z/size)}`;
      const bucket=buckets.get(key)||[];bucket.push(t);buckets.set(key,bucket);
      if(o.telemetryId){const list=explicit.get(o.telemetryId)||[];list.push(t);explicit.set(o.telemetryId,list);}
    }
    for(const o of observations.slice(0,900)){
      let track:Track|undefined;const matches=o.telemetryId?explicit.get(o.telemetryId)?.filter(t=>!used.has(t.id)&&t.observation.type===o.type):undefined;
      if(matches?.length===1)track=matches[0];
      if(!track){
        const size=bucketSize(o),gx=Math.floor(o.position.x/size),gz=Math.floor(o.position.z/size),prefix=group(o);let first:{t:Track;d:number}|undefined,second=Infinity;
        for(let x=gx-1;x<=gx+1;x++)for(let z=gz-1;z<=gz+1;z++)for(const t of buckets.get(`${prefix}|${x}|${z}`)||[]){
          if(used.has(t.id)||o.telemetryId&&t.observation.telemetryId&&o.telemetryId!==t.observation.telemetryId)continue;
          this.comparisonCount++;const d=distance(t.observation.position,o.position);if(d>=size)continue;
          if(!first||d<first.d){second=first?.d??Infinity;first={t,d};}else second=Math.min(second,d);
        }
        if(first&&(second>=first.d+20||first.d<1&&second>1))track=first.t;
      }
      const position=this.L.latLng(worldToMap(o.position,mapId));
      if(!track){
        const id=this.nextId++,dom=isAircraft(o)||!!o.kind&&o.kind!=='vehicle';
        const marker=dom?this.L.marker(position,{icon:this.icon(o,false),keyboard:true}):this.L.circleMarker(position,{renderer:this.renderer});
        marker.bindTooltip('',{direction:'top',offset:[0,-9]});marker.on('click',()=>this.onSelect(id));this.markers.addLayer(marker);
        const line=this.L.polyline([],{renderer:this.renderer,interactive:false});
        track={id,observation:o,at,marker,line,history:[position],lastTrail:at,styleKey:'',stale:false};this.tracks.set(id,track);
      }else{
        const moved=distance(track.observation.position,o.position);
        if(moved>1){
          if(this.settings().smoothMovement&&moved<bucketSize(o)&&this.map.getBounds().pad(.2).contains(position))track.animation={from:track.marker.getLatLng(),to:position,start:performance.now(),duration:Math.min(600,Math.max(150,interval))};
          else {track.animation=undefined;track.marker.setLatLng(position);}
        }
        if(moved>8&&at-track.lastTrail>350&&(!o.kind||o.kind==='vehicle')){track.history.push(position);track.lastTrail=at;this.syncTrail(track);}
      }
      used.add(track.id);track.telemetryNuclear=!!o.nuclear;track.observation=track.nuclearManual?{...o,nuclear:true}:o;track.at=at;track.stale=false;this.style(track);
    }
    for(const [id,t]of this.tracks){if(at-t.at>6000){this.markers.removeLayer(t.marker);this.lines.removeLayer(t.line);this.tracks.delete(id);if(this.selected===id)this.selected=null;}else if(at-t.at>1500&&!t.stale){t.stale=true;this.style(t);}}
    while(this.tracks.size>1100){const [id,t]=this.tracks.entries().next().value!;this.markers.removeLayer(t.marker);this.lines.removeLayer(t.line);this.tracks.delete(id);}
    if(!this.request&&[...this.tracks.values()].some(t=>t.animation))this.request=requestAnimationFrame(this.animate);
  }
  private animate=(now:number)=>{
    this.request=0;if(now-this.lastPaint<32){this.request=requestAnimationFrame(this.animate);return;}this.lastPaint=now;let active=false;
    for(const t of this.tracks.values()){const a=t.animation;if(!a)continue;const f=Math.min(1,(now-a.start)/a.duration);t.marker.setLatLng([a.from.lat+(a.to.lat-a.from.lat)*f,a.from.lng+(a.to.lng-a.from.lng)*f]);if(f===1)t.animation=undefined;else active=true;}
    if(active)this.request=requestAnimationFrame(this.animate);
  };
}
