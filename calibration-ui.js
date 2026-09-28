import {Avatar2D} from './avatar2d.js';
import {CALIBRATION_STEPS,CalibrationTake,analyzeCalibration,applyCalibration,readCalibration,persistCalibration} from './calibration.js';

const template=`
<section class="calibration-panel" aria-labelledby="calibration-heading">
  <div class="settings-heading"><h2 id="calibration-heading">表情校准</h2><span>5 个小动作</span></div>
  <p id="calibration-status" class="calibration-status" role="status"></p>
  <div class="calibration-buttons"><button id="calibration-start" type="button" class="secondary">开始校准</button><button id="calibration-reset" type="button" class="secondary" hidden>恢复默认</button></div>
  <label id="calibration-toggle-row" class="switch-row" hidden><span>使用校准</span><input id="calibration-enabled" type="checkbox" role="switch"></label>
  <p class="calibration-privacy">仅在此浏览器保存校准数值，不保存图像。演示动作不参与校准。</p>
</section>
<dialog id="calibration-dialog" aria-labelledby="calibration-title">
  <div class="calibration-dialog-body">
    <header class="calibration-header"><div><p class="calibration-eyebrow">PERSONAL CALIBRATION</p><h2 id="calibration-title">表情校准</h2></div><span id="calibration-step-count"></span></header>
    <ol id="calibration-steps" class="calibration-steps" aria-label="校准步骤"></ol>
    <div class="calibration-views"><div><video id="calibration-video" autoplay playsinline muted></video><span>你的摄像头</span></div><div><canvas id="calibration-avatar" aria-label="手指涂鸦即时预览"></canvas><span>手指涂鸦 · 即时预览</span></div></div>
    <h3 id="calibration-step-title"></h3><p id="calibration-instruction"></p>
    <div class="calibration-progress-row"><span id="calibration-message" role="status" aria-live="polite"></span><strong id="calibration-countdown" aria-hidden="true"></strong></div>
    <progress id="calibration-progress" max="1" value="0" aria-label="当前步骤采集进度"></progress>
    <p id="calibration-detail" class="calibration-detail"></p>
  </div>
  <div class="calibration-actions"><button id="calibration-cancel" type="button" class="secondary">取消</button><button id="calibration-skip" type="button" class="secondary" hidden>跳过此项</button><button id="calibration-record" type="button" class="primary">开始记录</button></div>
</dialog>`;

export class CalibrationController{
  constructor({mount,getContext,onChange=()=>{},storage,now=()=>performance.now()}){
    mount.innerHTML=template;this.el=id=>mount.querySelector('#'+id);this.getContext=getContext;this.onChange=onChange;this.now=now;
    try{this.storage=storage??window.localStorage;}catch{this.storage=null;}
    this.profile=readCalibration(this.storage);this.phase='closed';this.notice='';this.timer=null;
    this.dialog=this.el('calibration-dialog');this.video=this.el('calibration-video');this.preview=new Avatar2D(this.el('calibration-avatar'));
    this.el('calibration-start').onclick=()=>this.open();this.el('calibration-reset').onclick=()=>this.reset();
    this.el('calibration-enabled').onchange=e=>{if(!this.profile)return;this.profile.enabled=e.target.checked;const saved=persistCalibration(this.storage,this.profile);this.notice=saved?'': '本次已切换；浏览器不允许保存此设置。';this.sync();this.onChange();};
    this.el('calibration-record').onclick=()=>this.phase==='preview'?this.save():this.capture();
    this.el('calibration-skip').onclick=()=>this.skip();this.el('calibration-cancel').onclick=()=>this.cancel();
    this.dialog.addEventListener('cancel',e=>{e.preventDefault();this.cancel();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&['countdown','collecting'].includes(this.phase))this.fail('页面进入后台，当前步骤未保存，请重新记录。');});
    this.sync();
  }
  get active(){return this.phase!=='closed';}
  matches(profile){const ctx=this.getContext();return !profile?.cameraId||!ctx.cameraId||profile.cameraId===ctx.cameraId;}
  currentProfile(){
    const context=this.getContext();if(!context.ready)return null;
    if(this.phase==='preview'&&this.matches(this.draft))return this.draft;
    return this.profile?.enabled&&this.matches(this.profile)?this.profile:null;
  }
  apply(state){return applyCalibration(state,this.currentProfile());}
  sync(){
    const ctx=this.getContext(),p=this.profile;this.el('calibration-start').disabled=!ctx.ready;
    this.el('calibration-start').textContent=p?'重新校准':'开始校准';this.el('calibration-reset').hidden=!p;this.el('calibration-toggle-row').hidden=!p;
    this.el('calibration-enabled').checked=!!p?.enabled;
    let text='开启摄像头并跟踪到人脸后，按引导记录自己的表情幅度。';
    if(p){const when=new Date(p.createdAt).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});text=`${p.enabled?'校准已启用':'校准已暂停'} · ${when}。`;
      if(ctx.ready&&!this.matches(p))text='当前摄像头与上次不同，暂不应用旧校准，请重新校准。';
      else if(!ctx.ready)text+='开启摄像头后生效。';
    }
    this.el('calibration-status').textContent=p&&ctx.ready&&!this.matches(p)?text:this.notice||text;
  }
  open(){
    if(this.active)return;
    const ctx=this.getContext();if(!ctx.ready||!ctx.found||!ctx.fresh){this.notice='请先开启摄像头，让浏览器清晰地跟踪到你的人脸。';this.sync();return;}
    this.notice='';this.step=0;this.draft=null;this.skipped=[];this.cameraId=ctx.cameraId??'';this.phase='ready';this.message='准备好后点击“开始记录”，将有 1.5 秒准备时间。';
    this.video.srcObject=ctx.stream??null;this.video.style.transform=ctx.mirror?'scaleX(-1)':'none';this.video.play().catch(()=>{});
    this.dialog.showModal();this.preview.resize();this.render();this.el('calibration-record').focus();
  }
  capture(){
    if(this.phase!=='ready')return;
    const ctx=this.getContext();if(!ctx.ready||!ctx.found||!ctx.fresh){this.fail('暂时没有清晰的人脸，请回到镜头前再试。');return;}
    this.phase='countdown';this.until=this.now()+1500;this.message='请准备当前动作…';this.take=null;this.render();this.timer=setInterval(()=>this.tick(),100);this.tick();
  }
  tick(){
    const now=this.now();
    if(this.phase==='countdown'){
      this.el('calibration-countdown').textContent=String(Math.max(1,Math.ceil((this.until-now)/1000)));
      if(now>=this.until){this.phase='collecting';this.take=new CalibrationTake(CALIBRATION_STEPS[this.step],now);this.message='正在记录，请保持当前动作。';this.render();}
    }
    if(this.phase==='collecting'){
      this.el('calibration-countdown').textContent=`${Math.max(0,(this.take.end-now)/1000).toFixed(1)} 秒`;
      this.el('calibration-progress').value=Math.min(1,(now-this.take.start)/this.take.step.duration);
      if(now>=this.take.end){clearInterval(this.timer);this.timer=null;const result=analyzeCalibration(this.take,this.draft,this.cameraId);
        if(result.error){this.fail(result.error);return;}this.draft=result.profile;this.advance('上一步已记录。');
      }
    }
  }
  receive(result,time=this.now()){
    if(this.phase==='collecting'){
      this.take.add(result,time);
      const message=result.found?'正在记录，请保持当前动作。':'未检测到人脸。请回到镜头前，本步可能需要重试。';
      if(message!==this.message){this.message=message;this.el('calibration-message').textContent=message;}
    }
  }
  fail(message){clearInterval(this.timer);this.timer=null;this.take=null;this.phase='ready';this.message=message;this.retry=true;this.render();}
  advance(prefix=''){
    this.take=null;this.retry=false;this.step++;
    if(this.step>=CALIBRATION_STEPS.length){this.phase='preview';this.message='现在眨眼、张嘴，看看是否自然。满意后保存。';this.onChange();}
    else{this.phase='ready';this.message=prefix+'准备好下一个动作后，点击“开始记录”。';}
    this.render();this.el('calibration-record').focus();
  }
  skip(){if(this.phase!=='ready'||this.step===0)return;this.skipped.push(CALIBRATION_STEPS[this.step].title);this.advance('此项保留默认幅度。');}
  render(){
    const preview=this.phase==='preview',step=CALIBRATION_STEPS[Math.min(this.step,CALIBRATION_STEPS.length-1)],busy=['collecting','countdown'].includes(this.phase);
    this.el('calibration-step-count').textContent=preview?'完成':`${this.step+1} / ${CALIBRATION_STEPS.length}`;
    this.el('calibration-steps').replaceChildren(...CALIBRATION_STEPS.map((s,i)=>{const li=document.createElement('li');li.textContent=s.title;li.className=i<this.step?'done':i===this.step?'current':'';if(i===this.step)li.setAttribute('aria-current','step');return li;}));
    this.el('calibration-step-title').textContent=preview?'试试你的校准效果':step.title;
    this.el('calibration-instruction').textContent=preview?'预览已应用新的校准。保存后会用于所有角色；取消则保留原设置。':step.hint;
    this.el('calibration-message').textContent=this.message;this.el('calibration-countdown').textContent='';this.el('calibration-progress').value=preview?1:0;
    this.el('calibration-detail').textContent=preview?(this.skipped.length?`已跳过：${this.skipped.join('、')}，这些动作保持默认幅度。`:'表情范围和头部正中位置已记录。只保存参数，不保存图像。'):'请保持头部不动。记录不理想时可以重试；自然表情这一步不能跳过。';
    const record=this.el('calibration-record');record.disabled=busy;record.textContent=preview?'保存校准':busy?'记录中…':this.retry?'重试本步':'开始记录';
    this.el('calibration-skip').hidden=preview||this.step===0;this.el('calibration-skip').disabled=busy;
  }
  paint(state,options){if(this.active)this.preview.draw(state,{...options,kind:'finger'});}
  close(){clearInterval(this.timer);this.timer=null;this.phase='closed';this.take=null;this.draft=null;this.retry=false;this.video.pause();this.video.srcObject=null;if(this.dialog.open)this.dialog.close();}
  cancel(message='本次校准未保存，原设置保持不变。'){if(!this.active)return;this.close();this.notice=message;this.sync();this.onChange();}
  save(){
    if(this.phase!=='preview'||!this.draft)return;
    this.profile=this.draft;this.profile.enabled=true;this.profile.createdAt=Date.now();const saved=persistCalibration(this.storage,this.profile);
    this.close();this.notice=saved?'校准已保存并启用。可以关闭“使用校准”对比原始效果。':'校准已在本次运行生效，但浏览器不允许本地保存，重新打开后需再次校准。';this.sync();this.onChange();
  }
  reset(){this.profile=null;const saved=persistCalibration(this.storage,null);this.notice=saved?'已清除个人校准，恢复原始识别映射。':'本次已恢复默认，但浏览器未允许清除本机记录。';this.sync();this.onChange();}
}
