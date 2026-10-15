import {emit,listen} from '@tauri-apps/api/event';
import {invoke} from '@tauri-apps/api/core';
import type {Context,NormalizedFrame,Observation} from '../../../packages/core/types';
import {BOUNDS,distance} from '../../../packages/core/coordinates';
import {nearbyGroups} from '../../../packages/core/identification';
import './nearby.css';

type NearbyPreferences={radius:number;exclusionRadius:number;minimum:number;opacity:number};
type NearbyFrame={frame:NormalizedFrame;context:Context;tracks:{id:number;observation:Observation;at:number;nuclearManual?:boolean}[];mode:string;mapAgrees?:boolean;preferences?:unknown;nearbyPreferences?:NearbyPreferences};
const defaults:NearbyPreferences={radius:20000,exclusionRadius:2000,minimum:4,opacity:.92};
let preferences={...defaults};try{preferences={...defaults,...JSON.parse(localStorage.getItem('ntl.nearby.v1')||'{}')};}catch{}
let latest:NearbyFrame|null=null,canvas:HTMLCanvasElement|null=null,host:HTMLElement|null=null,overlayOpen=false,lastSend=0,request=0,lastFrameAt=0;
let observer:ResizeObserver|null=null;
const images=new Map<string,HTMLImageElement>(),overlay=new URLSearchParams(location.search).has('overlay');
const native=!!window.__TAURI_INTERNALS__;
const save=()=>{localStorage.setItem('ntl.nearby.v1',JSON.stringify(preferences));draw();};
function schedule(){if(!request)request=requestAnimationFrame(()=>{request=0;draw();});}
function draw(){
  if(!canvas||!host)return;const rect=canvas.getBoundingClientRect();if(!rect.width)return;
  const pixelRatio=Math.min(2,devicePixelRatio||1),w=rect.width,h=rect.height;
  canvas.width=Math.round(w*pixelRatio);canvas.height=Math.round(h*pixelRatio);const ctx=canvas.getContext('2d')!;ctx.scale(pixelRatio,pixelRatio);ctx.fillStyle='#0b1420';ctx.fillRect(0,0,w,h);
  host.style.background='#0a131e';host.style.opacity=String(preferences.opacity);
  const player=latest?.frame.player;if(!latest||!player||!latest.frame.active||latest.mapAgrees===false||Date.now()-lastFrameAt>5000){ctx.fillStyle='#cad5e4';ctx.font='13px sans-serif';ctx.textAlign='center';ctx.fillText('Waiting for a live player position',w/2,h/2);document.getElementById('nearby-summary')!.textContent='No current contacts on the selected map';return;}
  const radius=preferences.radius,scale=Math.min(w,h)/(radius*2),project=(p:{x:number;z:number})=>[w/2+(p.x-player.position.x)*scale,h/2-(p.z-player.position.z)*scale];
  const imageName=latest.context.mapId==='city'?'air_south_eastern_city_map.png':'map_4k.png';let image=images.get(imageName);
  if(!image){image=new Image();image.onload=schedule;image.src=new URL(imageName,document.baseURI).href;images.set(imageName,image);}
  if(image.complete&&image.naturalWidth){const[min,max]=BOUNDS[latest.context.mapId],span=max-min,cx=(player.position.x-min)/span*image.naturalWidth,cy=(max-player.position.z)/span*image.naturalHeight;
    const sw=w/scale/span*image.naturalWidth,sh=h/scale/span*image.naturalHeight;ctx.globalAlpha=.55;ctx.drawImage(image,cx-sw/2,cy-sh/2,sw,sh,0,0,w,h);ctx.globalAlpha=1;}
  ctx.strokeStyle='#97afcc55';ctx.lineWidth=1;for(const r of [radius/2,radius]){ctx.beginPath();ctx.arc(w/2,h/2,r*scale,0,Math.PI*2);ctx.stroke();}
  const freshTracks=latest.tracks.filter(t=>latest!.frame.at-t.at<3500);
  const observed=latest.tracks.length?freshTracks.map(t=>t.observation):latest.frame.objects;
  const manual=new Set(freshTracks.filter(t=>t.nuclearManual).map(t=>t.observation));
  const points=latest.frame.objects.filter(o=>o.kind==='aiming-point'||o.kind==='point-of-interest');
  for(const point of points){const[x,y]=project(point.position);ctx.strokeStyle=point.kind==='aiming-point'?'#ffe14e':'#ff5262';ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(x,y,preferences.exclusionRadius*scale,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.lineWidth=2;ctx.strokeRect(x-5,y-5,10,10);ctx.lineWidth=1;}
  const nearby=observed.filter(o=>!o.player&&(o.kind??'vehicle')==='vehicle'&&distance(o.position,player.position)<=radius);
  for(const object of nearby){const[x,y]=project(object.position),aircraft=object.type==='aircraft';ctx.fillStyle=object.relation==='enemy'?'#ff4557':object.relation==='friendly'?'#69b8ff':'#c9cfd8';
    if(aircraft){ctx.save();ctx.translate(x,y);ctx.rotate((object.heading??0)*Math.PI/180);ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(5,6);ctx.lineTo(0,3);ctx.lineTo(-5,6);ctx.closePath();ctx.fill();ctx.restore();}else{ctx.beginPath();ctx.arc(x,y,2.5,0,Math.PI*2);ctx.fill();}
    if(object.nuclear){ctx.strokeStyle='#ffe14e';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.stroke();ctx.lineWidth=1;ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillStyle='#ffe14e';ctx.fillText(manual.has(object)?'NUKE · MANUAL':'NUCLEAR',x,y-16);}
  }
  const groups=nearbyGroups([...observed,...points],player.position,radius,preferences.exclusionRadius,preferences.minimum);
  for(const group of groups){const[x,y]=project(group.position);ctx.strokeStyle='#ff4557';ctx.beginPath();ctx.arc(x,y,11,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='bold 11px sans-serif';ctx.fillText(String(group.count),x,y+4);}
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(w/2,h/2,4,0,Math.PI*2);ctx.fill();ctx.textAlign='left';ctx.font='11px sans-serif';ctx.fillStyle='#dae5f5';ctx.fillText(`N ↑  ·  ${Math.round(radius/1000)} km`,10,18);
  const nuclear=nearby.filter(o=>o.nuclear&&o.relation==='enemy').length;
  const label=document.getElementById('nearby-summary');if(label)label.textContent=`${nuclear?`${nuclear} nuclear aircraft · `:''}${groups.length} enemy vehicle groups · marked areas excluded`;
}
function createHost(floating:boolean){
  if(host)return;host=document.createElement(floating?'aside':'main');host.id='nearby-map';host.className=floating?'nearby-floating':'nearby-overlay';
  host.innerHTML=`<header id="nearby-drag"><strong>NEARBY</strong><button id="nearby-close" aria-label="Close nearby map">×</button></header><canvas aria-label="Nearby player, aircraft and vehicle groups"></canvas><p id="nearby-summary">Nearby contacts only · no hidden game data</p><details><summary>View settings</summary><label>Radius <select id="nearby-radius"><option value="10000">10 km</option><option value="20000">20 km</option><option value="40000">40 km</option><option value="80000">80 km</option></select></label><label>Ignore groups near your marks <select id="nearby-exclusion"><option value="500">500 m</option><option value="1000">1 km</option><option value="2000">2 km</option><option value="4000">4 km</option></select></label><label>Group size <input id="nearby-minimum" type="number" min="2" max="30"></label><label>Opacity <input id="nearby-opacity" type="range" min="0.35" max="1" step="0.05"></label>${native&&overlay?'<button id="nearby-click-through">Make click-through</button><small>Reopen from the main window to restore controls.</small>':''}</details>`;
  document.body.appendChild(host);canvas=host.querySelector('canvas');
  const control=(id:string)=>document.getElementById(id) as HTMLInputElement;
  for(const [id,key]of [['nearby-radius','radius'],['nearby-exclusion','exclusionRadius'],['nearby-minimum','minimum'],['nearby-opacity','opacity']] as const){control(id).value=String(preferences[key]);control(id).onchange=()=>{const value=Number(control(id).value);if(Number.isFinite(value)){preferences[key]=value;save();if(overlay)void emit('ntl:nearby-settings',preferences);}};}
  document.getElementById('nearby-close')!.onclick=()=>{if(overlay){void invoke('close_overlay');void emit('ntl:overlay-closed');}else{observer?.disconnect();observer=null;host!.remove();host=null;canvas=null;}};
  if(overlay){document.getElementById('nearby-drag')!.onpointerdown=async event=>{if((event.target as HTMLElement).closest('button'))return;const {getCurrentWindow}=await import('@tauri-apps/api/window');void getCurrentWindow().startDragging();};document.getElementById('nearby-click-through')!.onclick=()=>void emit('ntl:overlay-click-through-request');}
  else {const bar=document.getElementById('nearby-drag')!;bar.onpointerdown=event=>{if((event.target as HTMLElement).closest('button'))return;const bounds=host!.getBoundingClientRect(),dx=event.clientX-bounds.left,dy=event.clientY-bounds.top;bar.setPointerCapture(event.pointerId);bar.onpointermove=e=>{host!.style.right='auto';host!.style.left=`${Math.max(0,Math.min(innerWidth-bounds.width,e.clientX-dx))}px`;host!.style.top=`${Math.max(0,Math.min(innerHeight-40,e.clientY-dy))}px`;};bar.onpointerup=()=>{bar.onpointermove=null;};};}
  observer=new ResizeObserver(schedule);observer.observe(host);schedule();
}
export async function startOverlay(){document.body.replaceChildren();document.body.className='nearby-window';createHost(false);await listen<NearbyFrame>('ntl:overlay-frame',event=>{latest=event.payload;lastFrameAt=Date.now();if(latest.nearbyPreferences)preferences=latest.nearbyPreferences;schedule();});await emit('ntl:overlay-request-ready');setInterval(schedule,1000);}
if(!overlay){
  window.addEventListener('ntl:frame',event=>{latest=(event as CustomEvent<NearbyFrame>).detail;lastFrameAt=Date.now();if(host)schedule();if(native&&overlayOpen&&Date.now()-lastSend>=250){lastSend=Date.now();void emit('ntl:overlay-frame',{...latest,nearbyPreferences:preferences});}});
  window.addEventListener('ntl:overlay-request',async()=>{if(native){try{await invoke('open_overlay');overlayOpen=true;if(latest)await emit('ntl:overlay-frame',{...latest,nearbyPreferences:preferences});}catch{createHost(true);}}else createHost(true);});
  if(native){void listen('ntl:overlay-request-ready',()=>{overlayOpen=true;if(latest)void emit('ntl:overlay-frame',{...latest,nearbyPreferences:preferences});});void listen('ntl:overlay-closed',()=>overlayOpen=false);void listen('ntl:overlay-click-through-request',()=>void invoke('configure_overlay',{clickThrough:true}));void listen<NearbyPreferences>('ntl:nearby-settings',event=>{preferences=event.payload;save();});}
}
