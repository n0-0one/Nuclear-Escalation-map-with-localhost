"""One-time, reviewable source import. Does not contact upstream at application runtime."""
from pathlib import Path
import re, shutil, json
source = Path('upstream')
public = Path('apps/web/public')
public.mkdir(parents=True, exist_ok=True)
for p in source.iterdir():
    if p.name.startswith('.') or p.name in ('index.html', 'README.md', 'tools') or p.suffix == '.dds':
        continue
    if p.is_dir(): shutil.copytree(p, public / p.name, dirs_exist_ok=True)
    else: shutil.copy2(p, public / p.name)
html = (source / 'index.html').read_text(encoding='utf-8')
css = re.search(r'<style>(.*?)</style>', html, re.S).group(1)
js = re.search(r'<script>(.*?)</script>', html, re.S).group(1)
html = re.sub(r'<style>.*?</style>', '<link rel="stylesheet" href="./legacy.css">', html, flags=re.S)
html = re.sub(r'<script>.*?</script>', '<script type="module" src="./src/entry.ts"></script>', html, flags=re.S)
html = html.replace('https://unpkg.com/leaflet@1.9.4/dist/', './vendor/leaflet/')
html = html.replace('<title>Nuclear Thunder Interactive Map</title>', '<title>Nuclear Thunder Live</title>')
# No remote encyclopedia fallback; local portrait and role icons remain available.
js = js.replace('const candidates = [...modelArt, wikiArt].filter(Boolean);', 'const candidates = [...modelArt].filter(Boolean);')
js = js.replace('const WIKI_IMAGE_BASE = "https://static.encyclopedia.warthunder.com/images/";', 'const WIKI_IMAGE_BASE = "images/portraits/";')
js = js.replace('function renderMapData(selectedEra) {', 'function renderMapData(selectedEra) {\n        ntlUnitMarkers.clear();')
js = js.replace('units.forEach(unit => drawUnit(unit, site));', '''units.forEach((unit, index) => {
                unit.__ntlId = [currentMapVariant, selectedEra, site.name, "unit", unit.id || index].join("|");
                drawUnit(unit, site);
            });''')
js = js.replace('registerDetailLayer(site.name, marker);', '''registerDetailLayer(site.name, marker);
        if (unit.__ntlId) ntlUnitMarkers.set(unit.__ntlId, marker);''', 1)
js = js.replace('buildings.forEach(building => drawVehicleDepotBuilding(building, site));', '''buildings.forEach((building, index) => {
                building.__ntlId = [currentMapVariant, selectedEra, site.name, "building", building.id || index].join("|");
                drawVehicleDepotBuilding(building, site);
            });''')
building_start = js.index('function drawVehicleDepotBuilding(')
js = js[:building_start] + js[building_start:].replace('registerDetailLayer(site.name, marker);', 'registerDetailLayer(site.name, marker);\n        if (building.__ntlId) ntlUnitMarkers.set(building.__ntlId, marker);', 1)
js = js.replace('pinSiteDetails(site.name);', 'pinSiteDetails(site.name);\n            window.dispatchEvent(new CustomEvent("ntl:select", { detail: site.name }));')
js = js.replace('focusOverviewSite(entry, marker);', 'focusOverviewSite(entry, marker);\n            window.dispatchEvent(new CustomEvent("ntl:select", { detail: entry.site.name }));')
js = js.replace('if (threatCoverEnabled) renderThreatCover();\n    }\n\n    document.getElementById("team-swap")', 'if (threatCoverEnabled) renderThreatCover();\n        window.dispatchEvent(new Event("ntl:context"));\n    }\n\n    document.getElementById("team-swap")')
js = js.replace('return team === 1 ? "#e53e3e" : team === 2 ? "#4299e1" : "#a0aec0";', 'return ntlVisualTeam(team) === 1 ? "#ff4557" : ntlVisualTeam(team) === 2 ? "#69b8ff" : "#a0aec0";')
js = js.replace('return palette[team] || "#fdfcff";', 'return palette[ntlVisualTeam(team)] || "#a0aec0";')
js = js.replace('const side = team === 1 ? "enemy" : "ally";', 'const side = ntlVisualTeam(team) === 1 ? "enemy" : "ally";')
js = js.replace('const color = site.team === 1 ? "#fc8181" : site.team === 2 ? "#90cdf4" : "#cbd5e0";', 'const color = teamColor(site.team);')
js = 'const ntlUnitMarkers = new Map();\nlet ntlPlayerTeam = 0;\nfunction ntlVisualTeam(team) { return ntlPlayerTeam && (team === 1 || team === 2) ? (team === ntlPlayerTeam ? 2 : 1) : 0; }\n' + js + '\n' + Path('scripts/map-adapter.js').read_text(encoding='utf-8')
(public / 'legacy.css').write_text(css, encoding='utf-8', newline='\n')
(public / 'legacy.js').write_text(js, encoding='utf-8', newline='\n')
Path('apps/web/index.html').write_text(html, encoding='utf-8', newline='\n')
shutil.copy2(source / 'README.md', 'LICENSES/UPSTREAM-README.md')
assets = [str(p.relative_to(public)).replace('\\', '/') for p in public.rglob('*') if p.is_file()]
(public / 'asset-manifest.json').write_text(json.dumps(assets, indent=2), encoding='utf-8')
print(f'Imported {len(assets)} files.')
