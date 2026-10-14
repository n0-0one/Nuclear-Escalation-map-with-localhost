import type {WorldPoint,MapId,Status} from './types';
import {BOUNDS,distance} from './coordinates';
export interface Threat {position:WorldPoint;range:number;status:Status;team:number;}
export interface RouteRequest {points:WorldPoint[];mapId:MapId;threats:Threat[];avoidUnknown:boolean;avoidActive:boolean;enemyTeam:number;}
export interface RouteResult {points:WorldPoint[];distance:number;exposure:number;resolution:number;}
// Bounded flight-planning grid. Penalties estimate exposure, not terrain LOS or guaranteed safety.
export function planRoute(request:RouteRequest):RouteResult {
  const {points,mapId}=request, [min,max]=BOUNDS[mapId],size=96,step=(max-min)/(size-1);
  if(points.length<2||points.length>12||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.z)||p.x<min||p.x>max||p.z<min||p.z>max)) throw new Error('Choose 2–12 waypoints inside the map');
  const threats=request.threats.filter(t=>t.range>0&&t.status!=='DESTROYED'&&(!request.enemyTeam||t.team===request.enemyTeam)&&
    (['UNKNOWN','POSSIBLY_DESTROYED','RESPAWNING'].includes(t.status)?request.avoidUnknown:request.avoidActive));
  const point=(id:number):WorldPoint=>({x:min+(id%size)*step,z:min+Math.floor(id/size)*step});
  const id=(p:WorldPoint)=>Math.round((p.z-min)/step)*size+Math.round((p.x-min)/step);
  const penalties=new Float64Array(size*size);
  for(let i=0;i<penalties.length;i++)for(const t of threats)if(distance(point(i),t.position)<t.range+step)penalties[i]+=12;
  const result:WorldPoint[]=[points[0]];
  for(let segment=1;segment<points.length;segment++){
    const start=id(points[segment-1]),goal=id(points[segment]);
    const costs=new Float64Array(size*size).fill(Infinity),prev=new Int32Array(size*size).fill(-1),closed=new Uint8Array(size*size);
    const heap:{id:number;score:number}[]=[];
    function push(item:{id:number;score:number}){heap.push(item);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p].score<=item.score)break;heap[i]=heap[p];i=p;}heap[i]=item;}
    function pop(){const first=heap[0],last=heap.pop()!;if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].score<heap[c].score)c++;if(heap[c].score>=last.score)break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;}
    costs[start]=0;push({id:start,score:0});
    while(heap.length){const current=pop().id;if(closed[current])continue;if(current===goal)break;closed[current]=1;
      const x=current%size,z=Math.floor(current/size);
      for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
        if((!dx&&!dz)||x+dx<0||x+dx>=size||z+dz<0||z+dz>=size)continue;
        const next=(z+dz)*size+x+dx,cost=costs[current]+Math.hypot(dx,dz)*step*(1+(penalties[next]+penalties[current])/2);
        if(cost<costs[next]){costs[next]=cost;prev[next]=current;push({id:next,score:cost+distance(point(next),point(goal))});}
      }
    }
    const path:number[]=[];let cursor=goal;while(cursor!==start&&cursor>=0){path.push(cursor);cursor=prev[cursor];}
    for(const n of path.reverse())result.push(point(n));result.push(points[segment]);
  }
  let length=0,exposure=0;
  for(let i=1;i<result.length;i++){const d=distance(result[i-1],result[i]);length+=d;const p={x:(result[i-1].x+result[i].x)/2,z:(result[i-1].z+result[i].z)/2};if(threats.some(t=>distance(p,t.position)<t.range))exposure+=d;}
  return {points:result,distance:length,exposure,resolution:step};
}
