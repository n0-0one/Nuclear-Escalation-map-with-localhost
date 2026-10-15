// Injected only by the explicit --smoke-test CLI mode. Uses synthetic contacts.
(async()=>{
  const api=window.__TAURI_INTERNALS__,delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const report={success:false};
  try{
    for(let i=0;i<150&&!document.querySelector('#nearby-map canvas');i++)await delay(100);
    if(!document.querySelector('#nearby-map canvas'))throw new Error('Overlay view did not initialize');
    for(let i=0;i<150&&!document.querySelector('#nearby-summary')?.textContent.includes('1 enemy vehicle groups');i++)await delay(100);
    report.summary=document.querySelector('#nearby-summary')?.textContent;
    report.noIndependentMap=!window.ntlApp&&!window.ntlMap&&!document.querySelector('#map');
    report.canvasPainted=document.querySelector('canvas').width>0;
    report.telemetryDenied=false;try{await api.invoke('telemetry_snapshot');}catch{report.telemetryDenied=true;}
    report.configureDenied=false;try{await api.invoke('configure_overlay',{clickThrough:true});}catch{report.configureDenied=true;}
    report.success=report.summary?.includes('1 enemy vehicle groups')&&report.noIndependentMap&&report.canvasPainted&&report.telemetryDenied&&report.configureDenied;
  }catch(error){report.error=String(error);}
  await api.invoke('plugin:event|emit',{event:'ntl:overlay-smoke-result',payload:report});
})();
