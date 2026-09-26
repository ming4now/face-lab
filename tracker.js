export class Tracker{
  constructor(video,callbacks){this.video=video;this.callbacks=callbacks;this.rate=30;this.closed=false;this.busy=false;this.lastVideoTime=-1;this.lastSent=-Infinity;}
  async start(){
    this.worker=new Worker(new URL('./tracker.worker.js',import.meta.url),{type:'module'});
    const ready=new Promise((resolve,reject)=>{this.resolveReady=resolve;this.rejectReady=reject;});
    this.initTimer=setTimeout(()=>this.fail('模型初始化超时。请检查页面资源是否加载完整，再重试。'),60000);
    this.worker.onerror=event=>{event.preventDefault();this.fail('识别线程启动失败：'+(event.message||'浏览器不支持或资源未加载'));};
    this.worker.onmessage=({data})=>{
      if(this.closed)return;
      if(data.type==='ready'){clearTimeout(this.initTimer);this.isReady=true;this.resolveReady(data.engine);this.pump();}
      if(data.type==='progress')this.callbacks.onProgress(data.message);
      if(data.type==='error')this.fail(data.message);
      if(data.type==='result'){clearTimeout(this.frameTimer);this.busy=false;this.callbacks.onResult(data);}
    };
    this.worker.postMessage({type:'init'});return ready;
  }
  pump(){
    if(this.closed)return;this.frame=requestAnimationFrame(()=>this.pump());const now=performance.now();
    if(document.hidden||this.busy||!this.isReady||this.video.readyState<2||this.video.paused||this.video.currentTime===this.lastVideoTime||now-this.lastSent<1000/this.rate)return;
    this.lastVideoTime=this.video.currentTime;this.lastSent=now;this.busy=true;
    createImageBitmap(this.video).then(bitmap=>{
      if(this.closed){bitmap.close();return;}
      this.frameTimer=setTimeout(()=>this.fail('识别没有及时返回，已停止摄像头。请重试或降低清晰度。'),12000);
      try{this.worker.postMessage({type:'frame',bitmap,timestamp:now},[bitmap]);}catch(error){bitmap.close();this.fail(error.message);}
    }).catch(error=>this.fail('无法读取摄像头画面：'+error.message));
  }
  fail(message){if(this.closed)return;const wasReady=this.isReady;if(!wasReady)this.rejectReady(new Error(message));this.stop();if(wasReady)this.callbacks.onFatal(message);}
  stop(){if(this.closed)return;this.closed=true;cancelAnimationFrame(this.frame);clearTimeout(this.initTimer);clearTimeout(this.frameTimer);this.worker?.terminate();if(!this.isReady)this.rejectReady?.(new DOMException('已取消启动','AbortError'));}
}
