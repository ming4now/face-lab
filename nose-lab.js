import {NoseTracker} from './nose-tracker.js';
import {NOSE_AUS,meanScores} from './nose-model-core.js';

export class NoseLab{
  constructor({mount,video,getContext}){
    this.mount=mount;this.enabled=false;this.failed=false;mount.hidden=true;
    this.video=video;this.getContext=getContext;this.generation=0;this.active=false;this.loading=false;this.current=null;this.peaks=[null,null,null];this.baseline=null;this.capture=null;this.lastResult=0;this.lastPaint=0;this.times=[];this.durations=[];
    mount.innerHTML=`<div class="divider"></div><div class="settings-heading"><h2>鼻部模型实验</h2><span>OpenGraphAU</span></div>
      <p class="nose-help">由上方「识别模型」统一控制。与基础跟踪并行运行，切回 MediaPipe 即可停止鼻部模型。</p>
      <button class="secondary" id="nose-retry" type="button" hidden>重试鼻部模型</button>
      <p class="nose-help" id="nose-lab-status" role="status" aria-live="polite">开启摄像头并保持正脸后，将自动加载鼻部模型。</p>
      <div class="nose-experiment-readings" aria-label="OpenGraphAU 鼻部动作得分"><span>动作</span><span>原始值</span><span>比放松</span>
      ${NOSE_AUS.map(au=>`<span>${au.label}<small>${au.id}</small></span><output id="nose-au-${au.id}">—</output><output id="nose-delta-${au.id}">—</output>`).join('')}</div>
      <p class="nose-help">动作得分范围 0–1，不代表鼻孔尺寸或动画强度。原始值未经校准或放大，暂不用于驱动角色。</p>
      <div class="nose-lab-actions"><button class="secondary" id="nose-baseline" type="button" disabled>记录放松基线（2 秒）</button><button class="secondary" id="nose-clear" type="button" disabled>清除基线</button></div>
      <p class="nose-help" id="nose-baseline-status">先记录放松，再交替放松、皱鼻；单次升高不足以说明有效。</p>
      <p class="nose-lab-metrics" id="nose-lab-metrics">鼻部频率 — · 推理 —</p>
      <details><summary>峰值与测试说明</summary><p class="nose-help" id="nose-lab-peaks">本次峰值：—</p><p class="nose-help">鼻部识别上限为 5 次/秒，实际速度取决于设备。转头、遮挡和光线变化也可能影响得分；请对比多次动作。停止摄像头会结束实验并清除本次基线。</p></details>`;
    this.$=id=>mount.querySelector('#'+id);
    this.$('nose-retry').onclick=()=>{this.failed=false;this.lastPaint=-Infinity;this.paint(performance.now());};
    this.$('nose-baseline').onclick=()=>{
      if(!this.current||!this.active||this.capture)return;
      this.capture={start:performance.now(),samples:[]};
      this.$('nose-baseline-status').textContent='正在采集，请放松表情，保持正脸和光线稳定…';
    };
    this.$('nose-clear').onclick=()=>{this.baseline=null;this.capture=null;this.$('nose-baseline-status').textContent='已清除放松基线，可重新记录。';};
  }
  status(message){this.$('nose-lab-status').textContent=message;}
  setEnabled(enabled){
    if(typeof enabled!=='boolean')throw new Error('识别方案参数无效');
    if(this.enabled===enabled)return;
    this.enabled=enabled;this.mount.hidden=!enabled;
    if(!enabled)this.stop('已切回 MediaPipe 基础跟踪。');
    else{this.failed=false;this.lastPaint=-Infinity;this.paint(performance.now());}
  }
  fail(message){this.stop('');this.failed=true;this.status(message);this.lastPaint=-Infinity;this.render(performance.now());}
  async start(){
    if(!this.enabled||this.active||this.loading||this.failed||!this.getContext().ready||document.hidden)return;
    if(!this.getContext().fresh||!this.lastRegion){this.status('请先开启摄像头，让整张脸清晰出现在画面中。');return;}
    this.stop('');const ticket=this.generation;this.loading=true;this.status('正在加载 OpenGraphAU 鼻部模型…');
    const runner=new NoseTracker(this.video,{
      onProgress:message=>{if(ticket===this.generation)this.status(message);},
      onFatal:message=>{if(ticket===this.generation)this.fail(message);},
      onResult:result=>{if(ticket===this.generation)this.receiveNose(result);}
    });this.runner=runner;
    try{const engine=await runner.start();if(ticket!==this.generation)return;this.engine=engine;this.loading=false;this.active=true;this.status('鼻部实验已开启。先记录放松基线，再尝试皱鼻和收缩鼻孔。');}
    catch(error){if(ticket===this.generation)this.fail(error.message);}
  }
  stop(message='鼻部实验已停止。'){
    this.generation++;this.runner?.stop();this.runner=null;this.active=false;this.loading=false;this.current=null;this.peaks=[null,null,null];this.baseline=null;this.capture=null;this.engine='';this.lastResult=0;this.times=[];this.durations=[];
    this.failed=false;this.lastRegion=null;
    this.$('nose-baseline-status').textContent='先记录放松，再交替放松、皱鼻；单次升高不足以说明有效。';if(message)this.status(message);
    this.lastPaint=-Infinity;this.render(performance.now());
  }
  receiveFace(result,now){
    this.lastRegion=result.found?result.faceRegion:null;
    this.runner?.updateRegion(result.found?result.faceRegion:null,now);
    if(!result.found||!result.faceRegion)this.invalidate();
  }
  invalidate(){
    this.current=null;this.lastResult=0;this.runner?.updateRegion(null);
    if(this.capture){this.capture=null;this.$('nose-baseline-status').textContent='采集中断：请保持整张脸可见后重新记录。';}
  }
  receiveNose(result){
    const now=performance.now();this.current=result.nose;this.lastResult=now;this.times.push(now);this.durations.push(result.inferenceMs);if(this.durations.length>10)this.durations.shift();
    this.current.forEach((v,i)=>this.peaks[i]=Math.max(this.peaks[i]??0,v));
    if(this.capture){
      this.capture.samples.push([...this.current]);
      if(now-this.capture.start>=2000){
        try{this.baseline=meanScores(this.capture.samples);this.$('nose-baseline-status').textContent=`已记录 ${this.capture.samples.length} 帧放松基线，仅本次实验有效。`;}
        catch(error){this.$('nose-baseline-status').textContent=error.message;}
        this.capture=null;
      }
    }
  }
  paint(now){
    const context=this.getContext();
    if(this.enabled&&!this.active&&!this.loading&&!this.failed&&context.ready&&context.fresh&&this.lastRegion&&!document.hidden)void this.start();
    if(this.active){
      if(!this.getContext().fresh||document.hidden){this.invalidate();}
      else this.runner.sample(now);
      if(this.lastResult&&now-this.lastResult>1800)this.invalidate();
    }
    this.render(now);
  }
  render(now){
    if(now-this.lastPaint<150)return;this.lastPaint=now;
    this.$('nose-retry').hidden=!this.failed;
    this.$('nose-baseline').disabled=!this.active||!this.current||!!this.capture;
    this.$('nose-clear').disabled=!this.baseline&&!this.capture;
    for(const [i,au] of NOSE_AUS.entries()){
      this.$('nose-au-'+au.id).textContent=this.current?this.current[i].toFixed(4):'—';
      const delta=this.current&&this.baseline?this.current[i]-this.baseline[i]:null;
      this.$('nose-delta-'+au.id).textContent=delta===null?'—':(delta>=0?'+':'')+delta.toFixed(4);
    }
    this.times=this.times.filter(t=>now-t<2000);
    const hz=(this.times.length/2).toFixed(1),ms=this.durations.length?(this.durations.reduce((a,b)=>a+b,0)/this.durations.length).toFixed(0):'—';
    this.$('nose-lab-metrics').textContent=this.active?`${this.engine} · ${hz} 次/秒 · ${ms} 毫秒/次`:'鼻部频率 — · 推理 —';
    this.$('nose-lab-peaks').textContent='本次峰值：'+NOSE_AUS.map((au,i)=>`${au.id} ${this.peaks[i]?.toFixed(4)??'—'}`).join(' / ');
    if(this.active&&(!this.getContext().fresh||!this.runner.region))this.status('等待清晰、完整的正脸画面…');
    else if(this.active&&this.current)this.status('正在输出鼻部动作得分，可与上方原模型的皱鼻数值对比。');
    else if(this.enabled&&!this.active&&!this.loading&&!this.failed){
      const context=this.getContext();
      this.status(context.mode==='demo'?'演示动作不会加载模型。开启摄像头后将自动使用所选方案。':context.ready?'等待完整正脸，随后自动加载鼻部模型…':'开启摄像头并保持正脸后，将自动加载鼻部模型。');
    }
  }
}
