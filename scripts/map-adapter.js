// Explicit boundary around the preserved upstream engine. Live changes never call renderMapData.
window.ntlMap = {
    map, L,
    get ready() { return globalSiteData.length > 0; },
    context() { return { mapId: currentMapId, variant: currentMapVariant, scenario: selectedPresetId() }; },
    sites() { return globalSiteData; },
    variants() { return globalMapVariants; },
    definitions: MAP_DEFINITIONS,
    presets() { return globalPresetData.presets; },
    mission() { return globalMissionLogic; },
    roads() { return globalRoadDataByMap[currentMapId] || []; },
    convoyRoutes() {
        return [
            ...(globalMissionLogic?.likely_convoy_links || []).map(link => ({ key: convoyRouteKey(link), points: globalConvoyRoutes.get(convoyRouteKey(link))?.worldPoints || [link.from, link.to], link, kind: 'Resource convoy' })),
            ...(globalMissionLogic?.likely_armored_links || []).map(link => ({ key: armoredRouteKey(link), points: globalArmoredRoutes.get(armoredRouteKey(link))?.worldPoints || [link.from, link.to], link, kind: 'Armored column' }))
        ].filter(route => route.points.every(p => Array.isArray(p) && p.length >= 3));
    },
    specs(name) { return globalUnitSpecs[String(name).toLowerCase()] || {}; },
    category: operationalCategory,
    displayName,
    lifecycle: lifecycleForUnit,
    worldToLatLng,
    latLngToWorld: mapLatLngToWorld,
    terrain: terrainHeightAtMapPoint,
    setContext(mapId, variant, scenario) {
        if (mapId && mapId !== currentMapId && MAP_DEFINITIONS[mapId]) {
            currentMapId = mapId;
            saveUiState({ map: mapId });
            clearPlanningTools(); refreshMapArtwork(); populateMapSelector(); rebuildGroupedLayerControl();
        }
        if (scenario && globalPresetData.presets.some(p => p.id === scenario)) {
            document.getElementById('scenario-options').value = scenario;
            saveUiState({ scenario });
        }
        activateMapVariant(variant || activeMapDefinition().defaultVariant);
    },
    focus(siteName) {
        const found = overviewMarkers.find(item => item.entry.site.name === siteName || item.entry.siteNames.includes(siteName));
        if (found) focusOverviewSite(found.entry, found.marker);
        else { const site = globalSiteData.find(s => s.name === siteName); if (site) map.setView(worldToLatLng(site.world_pos[0], site.world_pos[2]), 1); }
    },
    markUnit(id, status) {
        const marker = ntlUnitMarkers.get(id);
        if (!marker) return;
        const apply = () => {
            const el = marker.getElement();
            if (el) { el.dataset.ntlStatus = status; el.classList.toggle('ntl-destroyed', status === 'DESTROYED'); el.classList.toggle('ntl-damaged', status === 'DAMAGED'); }
        };
        if (marker._ntlApply) marker.off('add', marker._ntlApply);
        marker._ntlApply = apply; marker.on('add', apply); apply();
    },
    markSite(name, status) {
        const item = overviewMarkers.find(x => x.entry.site.name === name);
        if (!item) return;
        const apply = () => { const el = item.marker.getElement(); if (el) { el.dataset.ntlStatus = status; el.classList.toggle('ntl-destroyed', status === 'DESTROYED'); el.classList.toggle('ntl-damaged', status === 'DAMAGED'); } };
        if (item.marker._ntlApply) item.marker.off('add', item.marker._ntlApply); item.marker._ntlApply = apply; item.marker.on('add', apply); apply();
    }
};
