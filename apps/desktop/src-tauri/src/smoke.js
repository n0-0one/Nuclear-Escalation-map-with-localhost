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
    const images=Array.from(document.querySelectorAll('.leaflet-image-layer'));
    for(let i=0;i<100&&!images.some(img=>img.complete&&img.naturalWidth>0);i++)await delay(100);
    const loadedImage=images.some(img=>img.complete&&img.naturalWidth>0);
    if(!loadedImage)throw new Error('Bundled map image unavailable');
    await window.__TAURI_INTERNALS__.invoke('native_smoke_complete',{report:{success:true,origin:location.origin,url:location.href,readyMs:Math.round(readyMs),loadedImage,context:window.ntlMap.context(),componentAction:marked,nativeTelemetry:{hasMapInfo:!!native.mapInfo,objects:Array.isArray(native.objects)?native.objects.length:0,errors:native.errors},frontend:window.ntlApp.snapshot()}});
  }catch(error){await window.__TAURI_INTERNALS__.invoke('native_smoke_complete',{report:{success:false,error:String(error),url:location.href}});}
})();
