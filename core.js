import {faceRegion} from './nose-model-core.js';
export const clamp=(x,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(x)?x:0));
export const blendKeys=['jawOpen','mouthSmileLeft','mouthSmileRight','eyeBlinkLeft','eyeBlinkRight','eyeWideLeft','eyeWideRight','browInnerUp','browOuterUpLeft','browOuterUpRight','browDownLeft','browDownRight','mouthPucker','mouthFunnel','mouthFrownLeft','mouthFrownRight','eyeLookInLeft','eyeLookInRight','eyeLookOutLeft','eyeLookOutRight','eyeLookUpLeft','eyeLookUpRight','eyeLookDownLeft','eyeLookDownRight','noseSneerLeft','noseSneerRight'];
export const neutral=()=>({blend:Object.fromEntries(blendKeys.map(k=>[k,0])),pose:{pitch:0,yaw:0,roll:0}});
// Keep missing model outputs distinct from a measured zero. These values bypass
// calibration, smoothing and avatar gain so weak model responses stay inspectable.
export function readNoseScores(categories=[]){return ['noseSneerLeft','noseSneerRight'].map(key=>{const value=categories.find(x=>x.categoryName===key)?.score;return Number.isFinite(value)&&value>=0&&value<=1?value:null;});}
export function formatNoseScore(value){return !Number.isFinite(value)?'未提供':value===0?'0':value<.0001?value.toExponential(2):value.toFixed(5);}
export function formatNosePercent(value){return !Number.isFinite(value)?'—':value>0&&value<.001?'<0.1':(value*100).toFixed(1);}
export function parseResult(result){
  if(!result.faceLandmarks?.length)return {found:false,...neutral(),noseScores:[null,null],faceRegion:null};
  const state=neutral();
  const categories=result.faceBlendshapes?.[0]?.categories??[];
  for(const x of categories)state.blend[x.categoryName]=clamp(x.score);
  const m=result.facialTransformationMatrixes?.[0]?.data;
  if(m?.length===16){state.pose.pitch=clamp(Math.asin(-clamp(m[9],-1,1)),-.65,.65);state.pose.yaw=clamp(Math.atan2(m[8],m[10]),-.85,.85);state.pose.roll=clamp(Math.atan2(m[1],m[5]),-.65,.65);}
  return {found:true,...state,noseScores:readNoseScores(categories),faceRegion:faceRegion(result.faceLandmarks[0])};
}
export function smoothState(current,target,dt,smoothing){
  const alpha=smoothing<=0?1:1-Math.exp(-clamp(dt,0,250)/(8+smoothing*140));
  for(const key of new Set([...Object.keys(current.blend),...Object.keys(target.blend)]))current.blend[key]=(current.blend[key]??0)+((target.blend[key]??0)-(current.blend[key]??0))*alpha;
  for(const key of ['yaw','pitch','roll'])current.pose[key]+=(target.pose[key]-current.pose[key])*alpha;
  return current;
}
export function expressionValues(b){return [b.jawOpen??0,((b.mouthSmileLeft??0)+(b.mouthSmileRight??0))/2,Math.max(b.browInnerUp??0,b.browOuterUpLeft??0,b.browOuterUpRight??0),b.eyeBlinkLeft??0,b.eyeBlinkRight??0,b.mouthPucker??0,b.noseSneerLeft??0,b.noseSneerRight??0];}
export function demoState(seconds,action='auto'){
  if(action!=='auto'){
    const s=neutral(),pulse=(1-Math.cos(seconds*Math.PI))/2;
    if(action==='open')s.blend.jawOpen=pulse*.85;
    if(action==='blink'){s.blend.eyeBlinkLeft=s.blend.eyeBlinkRight=pulse;}
    if(action==='smile')s.blend.mouthSmileLeft=s.blend.mouthSmileRight=pulse*.85;
    if(action==='head'){s.pose.yaw=Math.sin(seconds*1.2)*.65;s.pose.pitch=Math.sin(seconds*.8)*.35;s.pose.roll=Math.sin(seconds)*.35;}
    return s;
  }
  const s=neutral(),cycle=seconds%12;
  s.pose.yaw=Math.sin(seconds*.75)*.28;s.pose.roll=Math.sin(seconds*.8)*.1;s.pose.pitch=Math.sin(seconds*.45)*.08;
  s.blend.jawOpen=cycle<3?Math.pow(Math.max(0,Math.sin(cycle/3*Math.PI)),2)*.8:0;
  s.blend.mouthSmileLeft=s.blend.mouthSmileRight=cycle>=3&&cycle<6?Math.sin((cycle-3)/3*Math.PI)*.85:.08;
  s.blend.browInnerUp=cycle>=6&&cycle<8?Math.sin((cycle-6)/2*Math.PI)*.8:0;
  s.blend.eyeBlinkLeft=cycle>=8&&cycle<9?Math.sin((cycle-8)*Math.PI):0;
  s.blend.eyeBlinkRight=cycle>=9&&cycle<10?Math.sin((cycle-9)*Math.PI):0;
  s.blend.mouthPucker=cycle>=10?Math.sin((cycle-10)/2*Math.PI)*.75:0;
  return s;
}
export function cameraConstraints(deviceId,resolution){const height=Number(resolution);const width=Math.round(height*4/3);return {audio:false,video:{...(deviceId?{deviceId:{exact:deviceId}}:{facingMode:{ideal:'user'}}),width:{ideal:width},height:{ideal:height},frameRate:{ideal:30,max:30}}};}
export function cameraError(error){
  const messages={NotAllowedError:'未获得摄像头权限。请在地址栏的网站设置中允许摄像头，再试一次。',NotFoundError:'没有找到摄像头。请确认外接摄像头已连接，再点击开启。',NotReadableError:'摄像头无法读取，可能被会议或录屏软件占用。关闭占用后重试。',OverconstrainedError:'所选摄像头或参数不可用。请改选默认摄像头，或降低清晰度。',SecurityError:'浏览器禁止访问摄像头。请使用 localhost 或 HTTPS 地址打开页面。',AbortError:'摄像头启动被中断，请重新开启。'};
  return messages[error?.name]??error?.message??'启动失败，请重试。';
}
