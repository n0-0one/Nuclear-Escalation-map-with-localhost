import type { MapId, MapInfo, WorldPoint } from './types';
export const BOUNDS: Record<MapId, [number,number]> = { archipelago: [-131072,131072], city: [-65536,65536] };
export function worldToMap(point: WorldPoint, map: MapId): [number,number] {
  const [min,max]=BOUNDS[map]; return [(point.z-min)/(max-min)*4096,(point.x-min)/(max-min)*4096];
}
export function mapToWorld(lat: number,lng: number,map: MapId): WorldPoint {
  const [min,max]=BOUNDS[map]; return {x:min+lng/4096*(max-min),z:min+lat/4096*(max-min)};
}
// Telemetry y grows down from the image's top; upstream Leaflet latitude grows up.
export function telemetryToWorld(x:number,y:number,info:MapInfo): WorldPoint {
  return {x: info.map_min[0]+x*(info.map_max[0]-info.map_min[0]), z:info.map_max[1]-y*(info.map_max[1]-info.map_min[1])};
}
export const distance=(a:WorldPoint,b:WorldPoint)=>Math.hypot(a.x-b.x,a.z-b.z);
