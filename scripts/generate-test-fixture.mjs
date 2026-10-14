// Public test data uses static mission geometry and a synthetic player, never a captured battle.
import {readFileSync,writeFileSync} from 'node:fs';
const sites=JSON.parse(readFileSync('apps/web/public/map_data.json','utf8'));
const normalized=p=>[(p[0]+131072)/262144,1-(p[2]+131072)/262144];
const objects=sites.flatMap(s=>(s.runways||[]).map(r=>{const [sx,sy]=normalized(r.start),[ex,ey]=normalized(r.end);return {type:'airfield',icon:'none',color:'#174DFF',sx,sy,ex,ey};}));
objects.push({type:'aircraft',icon:'Player',color:'#174DFF',x:.4,y:.6,dx:1,dy:0});
writeFileSync('tests/fixtures/schema-fixture.json',JSON.stringify({provenance:'SYNTHETIC regression fixture with public mission runway geometry; field names verified against local API',mapInfo:{valid:true,map_min:[-131072,-131072],map_max:[131072,131072],map_generation:1},state:{valid:true},indicators:{valid:true,army:'air'},objects},null,2));
