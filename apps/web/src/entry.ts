// Overlay windows load only the nearby view and receive frames from the main window.
// They do not initialize another world map or another telemetry poller.
async function boot(){if(new URLSearchParams(location.search).has('overlay')){
  const {startOverlay}=await import('./nearby-map');startOverlay();
}else{
  await new Promise<void>((resolve,reject)=>{
    const script=document.createElement('script');script.src=new URL('legacy.js',document.baseURI).href;
    script.onload=()=>resolve();script.onerror=()=>reject(new Error('The bundled map engine could not be loaded.'));
    document.body.appendChild(script);
  });
  await import('./main');
}}
void boot().catch(error=>{const message=document.createElement('p');message.textContent=`Unable to start the map: ${String(error)}`;document.body.appendChild(message);});
