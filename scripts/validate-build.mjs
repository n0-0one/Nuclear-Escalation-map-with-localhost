import {existsSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
const root=process.argv.includes('--source')?'apps/web/public':'dist';
const required=['legacy.js','legacy.css','vendor/leaflet/leaflet.js','vendor/leaflet/leaflet.css','map_4k.png','air_south_eastern_city_map.png','presets.json','unit_specs.json','icon_templates.json','terrain_height_16bit.webp','terrain_meta.json','generated/southeastern_city_heightmap/southeastern_city_height_16bit.webp','generated/southeastern_city_heightmap/southeastern_city_height_meta.json','road_network.json','road_network_city.json','navmesh_city.json'];
for(const suffix of ['', '_mirror','_city','_city_mirror'])required.push(`map_data${suffix}.json`,`mission_logic${suffix}.json`);
for(const file of required)if(!existsSync(join(root,file)))throw new Error(`Missing ${file}`);
const presets=JSON.parse(readFileSync(join(root,'presets.json'),'utf8'));
let sites=0,units=0;
for(const suffix of ['', '_mirror','_city','_city_mirror']){
  const data=JSON.parse(readFileSync(join(root,`map_data${suffix}.json`),'utf8'));
  for(const site of data){if(!Array.isArray(site.world_pos)||!site.world_pos.every(Number.isFinite))throw new Error(`Invalid coordinate ${site.name}`);
    for(const p of presets.presets){if(!Array.isArray(site.units_by_era?.[p.id]))throw new Error(`Missing scenario ${p.id} at ${site.name}`);units+=site.units_by_era[p.id].length;}}
  sites+=data.length;
}
const legacy=readFileSync(join(root,'legacy.js'),'utf8');
if(/https:\/\/(majorlier\.github\.io|unpkg\.com|static\.encyclopedia)/.test(legacy))throw new Error('Remote runtime dependency');
if(root==='dist'){
  const html=readFileSync('dist/index.html','utf8');
  if(/(?:src|href)="\/(?!\/)/.test(html))throw new Error('Root absolute asset path breaks repository hosting');
}
function bytes(dir){return readdirSync(dir).reduce((n,f)=>{const p=join(dir,f);return n+(statSync(p).isDirectory()?bytes(p):statSync(p).size);},0);}
console.log(JSON.stringify({root,variants:4,scenarios:presets.presets.length,sites,unitRecordsAcrossScenarios:units,totalMB:Math.round(bytes(root)/1e6)},null,2));
