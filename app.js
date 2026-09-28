import {neutral,smoothState,demoState,expressionValues,cameraConstraints,cameraError,clamp,formatNoseScore,formatNosePercent} from './core.js';
import {Avatar2D} from './avatar2d.js';
import {Tracker} from './tracker.js';
import {isShape,isThreeDimensional} from './shape-motion.js';
import {CalibrationController} from './calibration-ui.js';
import {NoseLab} from './nose-lab.js';
const $=id=>document.getElementById(id),video=$('camera'),canvas=$('avatar-2d'),avatar2d=new Avatar2D(canvas);
const names={jelly:'软糖团',polygon:'折纸多边形',crystal:'呼吸晶体',knot:'扭结环',finger:'手指涂鸦',blob:'布丁精灵',frog:'呆呆蛙',face:'三维人脸'},labels=['张嘴','微笑','抬眉','左眼闭合','右眼闭合','嘟嘴','左侧皱鼻','右侧皱鼻'];
const hints={jelly:'二维软体 · 用表情揉动一团软糖',polygon:'二维多边形 · 用表情拉伸、折动轮廓',crystal:'三维多面体 · 张嘴膨胀，转头观察不同切面',knot:'三维扭结 · 用表情挤压、拉伸一条闭合曲线',finger:'画在指尖的小表情 · 眨眼、张嘴、抬眉，跟着你动'};
const bars=labels.map(label=>{const row=document.createElement('div');row.className='expression-line';row.innerHTML=`<span class="expression-label">${label}</span><div class="expression-track"><div class="expression-fill"></div></div><span class="expression-number">—</span>`;$('expression-list').append(row);return {fill:row.querySelector('.expression-fill'),number:row.querySelector('.expression-number')};});
let mode='idle',phase='idle',kind='finger',generation=0,avatarGeneration=0,stream=null,tracker=null,avatar3d=null,avatar3dPromise=null;
let raw=neutral(),target=neutral(),display=neutral(),gain=1.3,smoothing=.35,mirror=true,found=false;
let noseCurrent=[null,null],nosePeak=[null,null];
let startedAt=0,lastFrame=performance.now(),lastMetrics=lastFrame,lastMeter=0,lastPaint=0,renderCount=0,resultCount=0,samples=[],engineName='',lastResultAt=0;
const placeholder='<span class="camera-icon" aria-hidden="true">◎</span><p>接上摄像头，准备见面</p><small>开始后可选择内置或外接设备</small>';
const calibration=new CalibrationController({mount:$('calibration-mount'),getContext:()=>({ready:mode==='camera'&&phase==='running',found,fresh:lastResultAt>0&&performance.now()-lastResultAt<800,cameraId:stream?.getVideoTracks()[0]?.getSettings()?.deviceId??'',stream,mirror}),onChange:()=>{if(mode==='camera')target=found?calibration.apply(raw):neutral();}});
const noseLab=new NoseLab({mount:$('nose-lab-mount'),video,getContext:()=>({fresh:mode==='camera'&&phase==='running'&&found&&lastResultAt>0&&performance.now()-lastResultAt<600})});
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);$('status').setAttribute('role',error?'alert':'status');}
function resetMetrics(){lastMetrics=performance.now();resultCount=0;renderCount=0;samples=[];$('metric-track').textContent='—';$('metric-infer').textContent='—';$('metric-render').textContent='—';$('metric-time').textContent='00:00';}
function updateNoseDiagnostics(){
  const live=mode==='camera'&&phase==='running'&&found;
  for(const [i,side] of ['left','right'].entries()){
    $('nose-raw-'+side).textContent=live?formatNoseScore(noseCurrent[i]):'—';
    $('nose-peak-'+side).textContent=Number.isFinite(nosePeak[i])?formatNoseScore(nosePeak[i]):'—';
  }
  $('nose-status').textContent=mode==='demo'?'演示动作不包含皱鼻，请开启摄像头测试。':mode!=='camera'?'开启摄像头后，可检查模型的原始皱鼻输出。':!live?'等待清晰的人脸画面…':noseCurrent.some(value=>value===null)?'模型未提供完整的左右皱鼻值。':'已收到模型数值。请比较放松和皱鼻时的变化；微小波动也可能来自噪声。';
}
function updateUI(){
  const camera=mode==='camera';$('start').textContent=camera?(phase==='loading'?'取消启动':'停止摄像头'):'开启摄像头';$('start').classList.toggle('running',camera);
  $('demo').textContent=mode==='demo'?'结束演示动作':'先看演示动作';
  $('demo-controls').hidden=mode!=='demo';
  $('mode-badge').textContent=mode==='demo'?'演示 · 非真实跟踪':camera?(phase==='loading'?'正在启动':'实时跟踪'):'等待开始';
  $('mode-badge').className='badge'+(mode==='demo'?' demo':camera?' live':'');
  $('camera-placeholder').hidden=!!stream;$('tracking-status').hidden=!stream;
  $('metric-engine').textContent=mode==='demo'?'模拟动作 · 无模型推理':engineName?engineName+' · 本机识别':'尚未启动识别';video.style.transform=mirror?'scaleX(-1)':'none';
  calibration.sync();
}
function release(){
  noseLab.stop('先开启摄像头并保持正脸，再开启实验。');
  generation++;tracker?.stop();tracker=null;if(stream)for(const track of stream.getTracks()){track.onended=null;track.stop();}
  stream=null;video.pause();video.srcObject=null;found=false;raw=neutral();target=neutral();noseCurrent=[null,null];nosePeak=[null,null];engineName='';lastResultAt=0;$('camera-size').textContent='—';calibration.cancel('摄像头已停止，本次校准未保存。');
}
function stop(message='摄像头已关闭。可以切换设备后重新开始。'){release();mode='idle';phase='idle';$('camera-placeholder').innerHTML=placeholder;resetMetrics();updateUI();status(message);}
async function refreshDevices(){
  if(!navigator.mediaDevices?.enumerateDevices)return;
  try{const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput'),select=$('device'),previous=select.value;select.replaceChildren(new Option('默认摄像头',''));devices.forEach((d,i)=>select.add(new Option(d.label||`摄像头 ${i+1}`,d.deviceId)));if(devices.some(d=>d.deviceId===previous))select.value=previous;const actual=stream?.getVideoTracks()[0]?.getSettings()?.deviceId;if(actual&&devices.some(d=>d.deviceId===actual))select.value=actual;}catch{}
}
async function startCamera(){
  const selected=$('device').value,resolution=$('resolution').value;release();const ticket=generation;mode='camera';phase='loading';$('camera-placeholder').innerHTML=placeholder;resetMetrics();updateUI();status('正在请求摄像头权限…');
  try{
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('请在 localhost 或 HTTPS 地址中打开页面，浏览器才能使用摄像头。');
    const acquired=await navigator.mediaDevices.getUserMedia(cameraConstraints(selected,resolution));
    if(ticket!==generation){acquired.getTracks().forEach(t=>t.stop());return;}
    stream=acquired;video.srcObject=stream;video.muted=true;await video.play();if(ticket!==generation)return;
    for(const track of stream.getVideoTracks())track.onended=()=>{if(ticket===generation){stop();status('摄像头连接已断开。重新连接后点击开启。',true);}};
    $('camera-size').textContent=`${video.videoWidth} × ${video.videoHeight}`;updateUI();void refreshDevices();status('摄像头已连接，正在加载本地人脸模型…');
    const active=new Tracker(video,{
      onProgress:message=>{if(ticket===generation)status(message);},
      onFatal:message=>{if(ticket===generation){stop();status(message,true);}},
      onResult:result=>{if(ticket!==generation)return;found=result.found;raw={blend:result.blend,pose:result.pose};noseCurrent=found?(result.noseScores??[null,null]):[null,null];noseCurrent.forEach((value,i)=>{if(Number.isFinite(value))nosePeak[i]=Math.max(nosePeak[i]??0,value);});lastResultAt=performance.now();noseLab.receiveFace(result,lastResultAt);calibration.receive(result,lastResultAt);target=found?calibration.apply(raw):neutral();resultCount++;samples.push(result.inferenceMs);if(samples.length>30)samples.shift();$('tracking-status').textContent=found?'已跟踪到人脸':'请将脸移入画面';$('tracking-status').style.color=found?'var(--accent)':'#ffc977';}
    });
    tracker=active;tracker.rate=Number($('rate').value);const engine=await active.start();if(ticket!==generation)return;
    engineName=engine;startedAt=performance.now();phase='running';resetMetrics();updateUI();status('正在跟踪。可直接切换角色、设备或动作表现。');
  }catch(error){if(ticket!==generation)return;stop();status(cameraError(error),true);}
}
function setDemo(enabled){
  if(!enabled){stop('演示已结束。开启摄像头即可测试你自己的表情。');return;}
  release();mode='demo';phase='running';startedAt=performance.now();resetMetrics();updateUI();status('正在播放模拟动作，没有开启摄像头或运行识别模型。');$('camera-placeholder').innerHTML='<span class="camera-icon" aria-hidden="true">◡</span><p>演示动作播放中</p><small>开启摄像头后切换为真实跟踪</small>';
}
async function setAvatar(next){
  if(!Object.hasOwn(names,next))throw new Error('未知角色');const ticket=++avatarGeneration;kind=next;$('avatar-title').textContent=names[next];$('avatar-hint').textContent=hints[next]??'张嘴、眨眼、抬眉，看看它如何回应。';$('shape-guide').hidden=!isShape(next);
  document.querySelectorAll('[data-avatar]').forEach(button=>{const selected=button.dataset.avatar===next;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));});canvas.hidden=isThreeDimensional(kind);$('avatar-3d').hidden=!isThreeDimensional(kind);$('model-message').hidden=true;
  if(!isThreeDimensional(kind)){avatar2d.resize();return;}
  $('model-message').hidden=false;$('model-message').textContent=kind==='face'?'正在载入三维人脸…':'正在准备三维形状…';
  try{
    if(!avatar3dPromise)avatar3dPromise=import('./avatar3d.js').then(({Avatar3D})=>new Avatar3D($('avatar-3d'))).catch(error=>{avatar3dPromise=null;throw error;});
    avatar3d=await avatar3dPromise;if(next==='face')await avatar3d.load();
    if(ticket!==avatarGeneration)return;$('model-message').hidden=true;avatar3d.resize();
  }catch(error){if(ticket===avatarGeneration){$('model-message').hidden=false;$('model-message').textContent='三维显示加载失败，可切换二维形状后重试。'+error.message;}throw error;}
}
$('start').addEventListener('click',()=>{if(mode==='camera')stop();else void startCamera();});$('demo').addEventListener('click',()=>setDemo(mode!=='demo'));
document.querySelectorAll('[data-avatar]').forEach(button=>button.addEventListener('click',()=>void setAvatar(button.dataset.avatar).catch(()=>{})));
$('demo-action').addEventListener('change',()=>{if(mode==='demo')startedAt=performance.now();});
for(const id of ['device','resolution'])$(id).addEventListener('change',()=>{if(mode==='camera')void startCamera();});
$('rate').addEventListener('change',()=>{if(tracker)tracker.rate=Number($('rate').value);});
$('gain').addEventListener('input',event=>{gain=Number(event.target.value);$('gain-value').textContent=gain.toFixed(1)+'×';});
$('smoothing').addEventListener('input',event=>{smoothing=Number(event.target.value);$('smoothing-value').textContent=smoothing===0?'关闭':smoothing<.3?'轻微':smoothing<.6?'适中':'较强';});
$('mirror').addEventListener('change',event=>{mirror=event.target.checked;updateUI();});navigator.mediaDevices?.addEventListener('devicechange',refreshDevices);void refreshDevices();window.addEventListener('pagehide',()=>release());
function paint(now){
  noseLab.paint(now);
  const dt=now-lastFrame;lastFrame=now;if(mode==='demo')target=demoState((now-startedAt)/1000,$('demo-action').value);
  if(mode==='camera'&&phase==='running'&&lastResultAt&&now-lastResultAt>800){target=neutral();found=false;$('tracking-status').textContent='等待新的摄像头画面…';}
  smoothState(display,target,dt,smoothing);
  calibration.paint(display,{gain,mirror});
  if(mode!=='idle'||now-lastPaint>80){const options={kind,gain,mirror};if(isThreeDimensional(kind))avatar3d?.render(display,options);else avatar2d.draw(display,options);lastPaint=now;if(mode!=='idle'&&(!isThreeDimensional(kind)||avatar3d))renderCount++;}
  if(now-lastMeter>100){expressionValues(display.blend).forEach((value,i)=>{if(i>=6)value=mode==='camera'&&found?noseCurrent[i-6]:null;bars[i].fill.style.width=(clamp(value)*100).toFixed(1)+'%';bars[i].number.textContent=mode==='idle'?'—':i>=6?formatNosePercent(value):Math.round(clamp(value)*100);});updateNoseDiagnostics();lastMeter=now;}
  if(now-lastMetrics>=1000){const duration=(now-lastMetrics)/1000;if(mode!=='idle'){$('metric-render').textContent=String(Math.round(renderCount/duration));if(mode==='camera'&&phase==='running'){$('metric-track').textContent=(resultCount/duration).toFixed(1);$('metric-infer').textContent=samples.length?(samples.reduce((a,b)=>a+b,0)/samples.length).toFixed(1):'—';}if(phase==='running'){const seconds=Math.floor((now-startedAt)/1000);$('metric-time').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}}renderCount=0;resultCount=0;lastMetrics=now;}
  requestAnimationFrame(paint);
}
requestAnimationFrame(paint);
if(document.modelContext?.registerTool){
  const lifecycle=new AbortController();const register=tool=>{try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
  register({name:'read_face_lab_status',description:'Read current character, input mode and visible metrics. Does not activate the camera.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({mode,phase,avatar:kind,faceDetected:found,engine:engineName,trackingHz:$('metric-track').textContent,inferenceMs:$('metric-infer').textContent,renderFps:$('metric-render').textContent,status:$('status').textContent})});
  register({name:'set_face_lab_avatar',description:'Switch the displayed character or abstract shape without accessing the camera.',inputSchema:{type:'object',properties:{avatar:{type:'string',enum:Object.keys(names)}},required:['avatar'],additionalProperties:false},execute:async input=>{if(!input||!Object.hasOwn(names,input.avatar)||Object.keys(input).some(k=>k!=='avatar'))throw Error('Unknown avatar');await setAvatar(input.avatar);return {avatar:kind};}});
  register({name:'set_face_lab_demo',description:'Start or stop labeled simulated face movements. Starting demo releases any active camera.',inputSchema:{type:'object',properties:{enabled:{type:'boolean'}},required:['enabled'],additionalProperties:false},execute:input=>{if(!input||typeof input.enabled!=='boolean'||Object.keys(input).some(k=>k!=='enabled'))throw Error('enabled must be boolean');setDemo(input.enabled);return {mode};}});
  window.addEventListener('pagehide',()=>lifecycle.abort());
}
