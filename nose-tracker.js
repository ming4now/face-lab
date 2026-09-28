import {cropGeometry} from './nose-model-core.js';

// Independent from MediaPipe: a slow or failed AU inference never blocks its queue.
export class NoseTracker{
  constructor(video,callbacks){this.video=video;this.callbacks=callbacks;this.closed=false;this.busy=false;this.ready=false;this.token=0;this.lastSent=-Infinity;this.lastVideoTime=-1;this.region=null;this.regionTime=0;}
  async start(){
    this.worker=new Worker(new URL('./nose-model.worker.js',import.meta.url),{type:'module'});
    const ready=new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject;});
    this.initTimer=setTimeout(()=>this.fail('鼻部模型加载超时，请检查网络后重试。'),180000);
    this.worker.onerror=event=>{event.preventDefault();this.fail('鼻部线程启动失败：'+(event.message||'浏览器不支持'));};
    this.worker.onmessage=({data})=>{
      if(this.closed)return;
      if(data.type==='progress')this.callbacks.onProgress?.(data.message);
      if(data.type==='error')this.fail(data.message);
      if(data.type==='ready'){clearTimeout(this.initTimer);this.ready=true;this.resolve(data.engine);}
      if(data.type==='result'){
        clearTimeout(this.frameTimer);this.busy=false;
        if(data.token===this.token&&this.region&&performance.now()-this.regionTime<600&&!document.hidden)this.callbacks.onResult?.(data);
      }
    };
    this.worker.postMessage({type:'init'});return ready;
  }
  updateRegion(region,now=performance.now()){
    if(!region){if(this.region)this.token++;this.region=null;return;}
    this.region=region;this.regionTime=now;
  }
  sample(now=performance.now()){
    const v=this.video;
    if(this.closed||!this.ready||this.busy||!this.region||now-this.regionTime>600||document.hidden||v.readyState<2||v.paused||v.currentTime===this.lastVideoTime||now-this.lastSent<200)return;
    const geometry=cropGeometry(this.region,v.videoWidth,v.videoHeight);if(!geometry)return;
    this.busy=true;this.lastSent=now;this.lastVideoTime=v.currentTime;
    const token=this.token;
    if(!this.canvas){this.canvas=document.createElement('canvas');this.canvas.width=this.canvas.height=256;this.ctx=this.canvas.getContext('2d');}
    const c=this.ctx,{cx,cy,side,angle}=geometry;
    try{
      c.setTransform(1,0,0,1,0,0);c.fillStyle='#808080';c.fillRect(0,0,256,256);
      c.translate(128,128);c.scale(256/side,256/side);c.rotate(-angle);c.translate(-cx,-cy);c.drawImage(v,0,0);c.setTransform(1,0,0,1,0,0);
    }catch(error){this.fail('鼻部画面读取失败：'+error.message);return;}
    createImageBitmap(this.canvas,16,16,224,224).then(bitmap=>{
      if(this.closed||token!==this.token){bitmap.close();this.busy=false;return;}
      this.frameTimer=setTimeout(()=>this.fail('鼻部识别超时，已停止实验；原有跟踪仍可使用。'),15000);
      try{this.worker.postMessage({type:'frame',bitmap,token,timestamp:now},[bitmap]);}
      catch(error){bitmap.close();this.fail(error.message);}
    }).catch(error=>this.fail('无法读取鼻部测试画面：'+error.message));
  }
  fail(message){if(this.closed)return;const wasReady=this.ready;if(!wasReady)this.reject?.(new Error(message));this.stop();if(wasReady)this.callbacks.onFatal?.(message);}
  stop(){if(this.closed)return;this.closed=true;this.token++;clearTimeout(this.initTimer);clearTimeout(this.frameTimer);this.worker?.terminate();if(!this.ready)this.reject?.(new DOMException('已取消鼻部模型加载','AbortError'));}
}
