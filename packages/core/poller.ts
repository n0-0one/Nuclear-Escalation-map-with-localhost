import type { RawFrame } from './types';
export type Provider=(signal:AbortSignal)=>Promise<RawFrame>;
export class Poller {
  private generation=0; private timer:ReturnType<typeof setTimeout>|undefined; private abort:AbortController|undefined;
  failures=0; interval=400; baseInterval=400;
  constructor(private receive:(frame:RawFrame)=>void){}
  setInterval(ms:number){this.baseInterval=Math.max(200,Math.min(2000,Math.round(Number.isFinite(ms)?ms:400)));if(!this.failures)this.interval=this.baseInterval;}
  start(provider:Provider){this.stop();const generation=this.generation;this.failures=0;
    const tick=async()=>{
      this.abort=new AbortController();
      try {const frame=await provider(this.abort.signal);if(generation!==this.generation)return;this.failures=frame.objects==null?this.failures+1:0;this.receive(frame);}
      catch(error){if(generation!==this.generation)return;this.failures++;this.receive({at:Date.now(),mapInfo:null,objects:null,errors:{transport:error instanceof Error?error.message:String(error)}});}
      if(generation!==this.generation)return;
      this.interval=this.failures?Math.min(8000,500*2**Math.min(4,this.failures)):this.baseInterval;
      this.timer=setTimeout(tick,this.interval);
    };void tick();
  }
  stop(){this.generation++;clearTimeout(this.timer);this.abort?.abort();}
}
