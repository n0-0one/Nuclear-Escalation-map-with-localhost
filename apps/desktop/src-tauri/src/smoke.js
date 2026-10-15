// Production smoke mode only; triggered by an explicit CLI flag. No devtools or HTTP backend.
(async()=>{
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const started=performance.now();
  try{
    for(let i=0;i<200&&!(window.ntlApp&&window.ntlMap?.ready);i++)await delay(100);
    if(!window.ntlMap?.ready||!window.ntlApp)throw new Error('Bundled frontend failed to initialize');
    const readyMs=performance.now()-started;
    // Prevent a live map change from racing the independent static-map checks.
    document.querySelector('#auto-map').checked=false;
    window.ntlMap.setContext('city','city_mirror','rank-40-50');
    if(window.ntlMap.context().variant!=='city_mirror')throw new Error('City mirror failed');
    window.ntlMap.setContext('archipelago','standard','rank-0-26');
    const unit=document.querySelector('[data-set="DESTROYED"]');unit.click();
    const marked=Object.values(window.ntlApp.snapshot().unitStates).some(v=>v.status==='DESTROYED');
    if(!marked)throw new Error('Component control failed');
    document.querySelector('#undo-status').click();
    const native=await window.__TAURI_INTERNALS__.invoke('telemetry_snapshot');
    const data=await window.__TAURI_INTERNALS__.invoke('datamine_bootstrap');
    if(!document.querySelector('#data-update-status'))throw new Error('Data update controls are missing');
    const loadedLock=await (await fetch('datamine-lock.json')).json();
    if(data.revision!==loadedLock.accepted_commit)throw new Error('The frontend did not load the verified native data revision');
    if(data.data){
      const specs=await(await fetch('unit_specs.json')).json();
      if(JSON.stringify(specs)!==JSON.stringify(data.data['unit_specs.json']))throw new Error('Downloaded unit data was not applied');
      const name=Object.keys(specs)[0];if(JSON.stringify(window.ntlMap.specs(name))!==JSON.stringify(specs[name]))throw new Error('The map engine did not initialize from the downloaded data');
    }
    if(document.querySelector('#connect-button').textContent==='Disconnect')document.querySelector('#connect-button').click();
    const api=window.__TAURI_INTERNALS__;let overlayReport;
    await api.invoke('plugin:event|listen',{event:'ntl:overlay-smoke-result',target:{kind:'Any'},handler:api.transformCallback(event=>{overlayReport=event.payload;})});
    document.querySelector('#open-nearby').click();
    const player={position:{x:0,z:0},player:true,type:'aircraft',icon:'Player',relation:'friendly',kind:'vehicle'};
    const contacts=Array.from({length:5},(_,i)=>({position:{x:3100+i*10,z:3100},player:false,type:'ground_model',icon:'MediumTank',relation:'enemy',kind:'vehicle'}));
    for(let i=0;i<100&&!overlayReport;i++){
      const at=Date.now();
      window.dispatchEvent(new CustomEvent('ntl:frame',{detail:{frame:{at,active:true,connected:true,player,objects:[player,...contacts],errors:{}},context:window.ntlMap.context(),tracks:contacts.map((observation,id)=>({id,observation,at})),mode:'smoke',mapAgrees:true}}));
      await delay(150);
    }
    if(!overlayReport?.success)throw new Error('Native overlay checks failed: '+JSON.stringify(overlayReport));
    await api.invoke('configure_overlay',{clickThrough:true});
    await api.invoke('close_overlay');
    await api.invoke('open_overlay');
    await api.invoke('configure_overlay',{clickThrough:false});
    const images=Array.from(document.querySelectorAll('.leaflet-image-layer'));
    for(let i=0;i<100&&!images.some(img=>img.complete&&img.naturalWidth>0);i++)await delay(100);
    const loadedImage=images.some(img=>img.complete&&img.naturalWidth>0);
    if(!loadedImage)throw new Error('Bundled map image unavailable');
    await window.__TAURI_INTERNALS__.invoke('native_smoke_complete',{report:{success:true,origin:location.origin,url:location.href,readyMs:Math.round(readyMs),loadedImage,context:window.ntlMap.context(),dataUpdate:{source:data.source,revision:data.revision,frontendRevisionMatches:true},componentAction:marked,overlay:overlayReport,overlayRecoveryCommands:true,nativeTelemetry:{hasMapInfo:!!native.mapInfo,objects:Array.isArray(native.objects)?native.objects.length:0,errors:native.errors},frontend:window.ntlApp.snapshot()}});
  }catch(error){await window.__TAURI_INTERNALS__.invoke('native_smoke_complete',{report:{success:false,error:String(error),url:location.href}});}
})();
