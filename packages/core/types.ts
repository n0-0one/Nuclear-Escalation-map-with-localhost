export type MapId = 'archipelago' | 'city';
export type WorldPoint = { x: number; z: number };
export type Source = 'TELEMETRY' | 'INFERRED' | 'MANUAL' | 'SIMULATED';
export type Confidence = 'confirmed' | 'inferred' | 'unknown' | 'manual';
export const STATUSES = ['UNKNOWN','CONFIRMED_ACTIVE','REPORTED_ACTIVE','DAMAGED','DESTROYED','POSSIBLY_DESTROYED','RESPAWNING','RESTORED'] as const;
export type Status = typeof STATUSES[number];
export interface UnitRecord {
  id: string; siteId: string; name: string; label: string; role: string; category: string; team: number;
  position: WorldPoint | null; approximate: boolean; range: number; detectionRange: number; radarIcon: string;
  restoreSeconds: number | null; restoreKind: string; restoreSource: string;
}
export interface UnitState { status: Status; source: Source; at: number; lastSeen: number | null; expectedAt: number | null; }
export interface TimelineEvent { id: number; at: number; category: string; text: string; source: Source; objectId?: string; confidence: Confidence; }
export interface RawFrame { at: number; mapInfo: unknown; objects: unknown; state?: unknown; indicators?: unknown; errors?: Record<string,string>; simulated?: boolean; }
export interface MapInfo { valid: boolean; map_min: [number,number]; map_max: [number,number]; map_generation?: number; }
export interface Observation { position: WorldPoint; icon: string; type: string; color: string; heading: number | null; player: boolean; }
export interface NormalizedFrame { at: number; connected: boolean; active: boolean | null; info: MapInfo | null; player: Observation | null; objects: Observation[]; unsupported: boolean; errors: Record<string,string>; source: Source; }
export interface Context { mapId: MapId; variant: string; scenario: string; }
export interface SiteData { name: string; team: number; world_pos: number[]; runways?: {start:number[];end:number[]}[]; category?: string; runtime_relocated?: boolean; units_by_era?: Record<string,any[]>; buildings_by_era?: Record<string,any[]>; [key:string]: any; }
