import {planRoute} from '../../../packages/core/route';
self.onmessage=event=>{try{self.postMessage({id:event.data.id,result:planRoute(event.data.request)});}catch(error){self.postMessage({id:event.data.id,error:String(error)});}};
