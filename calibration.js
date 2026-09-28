import {clamp,neutral} from './core.js';

export const CALIBRATION_KEY='face-lab.calibration.v1';
export const CALIBRATION_STEPS=[
  {id:'neutral',title:'自然放松',hint:'正对镜头，正常睁眼，嘴巴轻闭，头部保持不动。',duration:3000,keys:[]},
  {id:'mouth',title:'张大嘴巴',hint:'舒服地张大嘴并保持，不用刻意用力。',duration:2400,keys:['jawOpen']},
  {id:'eyes',title:'轻轻闭眼',hint:'开始记录后，双眼轻闭约 2 秒，再睁开。左右眼分别记录。',duration:3000,keys:['eyeBlinkLeft','eyeBlinkRight']},
  {id:'smile',title:'自然微笑',hint:'做一个明显而舒服的微笑，并保持。',duration:2400,keys:['mouthSmileLeft','mouthSmileRight']},
  {id:'brows',title:'抬起眉毛',hint:'抬起眉毛并保持，尽量不要跟着抬头。',duration:2400,keys:['browInnerUp','browOuterUpLeft','browOuterUpRight']}
];
export const CALIBRATION_CHANNELS=CALIBRATION_STEPS.flatMap(step=>step.keys);
const limits={pitch:.65,yaw:.85,roll:.65};
const quantile=(values,q)=>{
  const sorted=[...values].sort((a,b)=>a-b),position=(sorted.length-1)*q,low=Math.floor(position);
  return sorted[low]+(sorted[Math.min(low+1,sorted.length-1)]-sorted[low])*(position-low);
};

// Only numeric parameters are persisted. Frames and landmark arrays are never
// retained here, and unsupported expression channels pass through unchanged.
export function validCalibration(profile){
  if(!profile||profile.version!==1||!Number.isFinite(profile.createdAt)||profile.createdAt<=0||typeof profile.enabled!=='boolean'||typeof profile.cameraId!=='string'||profile.cameraId.length>1024)return false;
  if(!Array.isArray(profile.completed)||!profile.completed.every(id=>CALIBRATION_STEPS.slice(1).some(step=>step.id===id)))return false;
  for(const key of CALIBRATION_CHANNELS){
    const channel=profile.channels?.[key];
    if(!channel||!['base','dead','high'].every(k=>Number.isFinite(channel[k])))return false;
    if(channel.base<0||channel.base>.8||channel.dead<0||channel.dead>.06||channel.high>1||channel.high-channel.base-channel.dead<.12-1e-8)return false;
  }
  return Object.entries(limits).every(([key,limit])=>Number.isFinite(profile.pose?.[key])&&Math.abs(profile.pose[key])<=limit);
}

export class CalibrationTake{
  constructor(step,start){this.step=step;this.start=start;this.end=start+step.duration;this.samples=[];this.total=0;this.lastTime=-Infinity;}
  add(result,time){
    if(!Number.isFinite(time)||time<this.start||time>this.end||time<=this.lastTime)return;
    this.lastTime=time;this.total++;
    if(!result.found||!CALIBRATION_CHANNELS.every(k=>Number.isFinite(result.blend?.[k]))||!Object.keys(limits).every(k=>Number.isFinite(result.pose?.[k])))return;
    if(this.samples.length>=360)return;
    this.samples.push({time,blend:Object.fromEntries(CALIBRATION_CHANNELS.map(k=>[k,clamp(result.blend[k])])),pose:Object.fromEntries(Object.entries(limits).map(([k,limit])=>[k,clamp(result.pose[k],-limit,limit)]))});
  }
  qualityError(){
    const s=this.samples;
    if(s.length<12)return '有效画面太少。请保持光线充足、面部清晰，再记录一次。';
    if(s.length/Math.max(1,this.total)<.8||s[0].time-this.start>500||this.end-s.at(-1).time>500||s.some((x,i)=>i>0&&x.time-s[i-1].time>650))return '记录期间人脸丢失或画面中断，请正对镜头重试。';
    if(Object.keys(limits).some(k=>quantile(s.map(x=>x.pose[k]),.9)-quantile(s.map(x=>x.pose[k]),.1)>.22))return '头部移动较大。请保持头部不动，只做当前表情。';
    return '';
  }
}

export function analyzeCalibration(take,draft,cameraId='',createdAt=Date.now()){
  const error=take.qualityError();if(error)return {error};
  const values=key=>take.samples.map(s=>s.blend[key]);
  if(take.step.id==='neutral'){
    if(quantile(values('jawOpen'),.5)>.3||['eyeBlinkLeft','eyeBlinkRight'].some(k=>quantile(values(k),.5)>.45))return {error:'请正常睁眼、嘴巴轻闭，再记录自然表情。'};
    const channels={};
    for(const key of CALIBRATION_CHANNELS){
      const list=values(key),base=quantile(list,.5),mad=quantile(list.map(x=>Math.abs(x-base)),.5);
      if(base>.65||mad>.045)return {error:'自然表情变化较大。请放松面部，稍作休息后重试。'};
      channels[key]={base,dead:clamp(mad*3,.006,.05),high:1};
    }
    const profile={version:1,createdAt,enabled:true,cameraId,channels,pose:Object.fromEntries(Object.keys(limits).map(k=>[k,quantile(take.samples.map(s=>s.pose[k]),.5)])),completed:[]};
    return {profile};
  }
  if(!validCalibration(draft))return {error:'请先记录自然表情。'};
  const profile=structuredClone(draft),usable=[];
  for(const key of take.step.keys){
    const high=quantile(values(key),.85),{base,dead}=profile.channels[key];
    if(high-base-dead>=.12){profile.channels[key].high=high;usable.push(key);}
  }
  // Both eyelids need usable ranges to preserve independent blinks. Brows can
  // naturally activate different channels, so any one raised-brow signal works.
  const required=take.step.id==='eyes'?2:1;
  if(usable.length<required)return {error:take.step.id==='eyes'?'双眼闭合的变化不够明显。请轻闭双眼并保持约 2 秒后重试。':'这个动作的变化不够明显。请稍微加大幅度后重试，或跳过此项。'};
  profile.completed=[...new Set([...profile.completed,take.step.id])];
  return {profile};
}

export function applyCalibration(state,profile){
  if(!profile)return state;
  const result={blend:{...state.blend},pose:{...state.pose}};
  for(const key of CALIBRATION_CHANNELS){const {base,dead,high}=profile.channels[key];result.blend[key]=clamp(((state.blend[key]??0)-base-dead)/(high-base-dead));}
  for(const [key,limit] of Object.entries(limits))result.pose[key]=clamp(state.pose[key]-profile.pose[key],-limit,limit);
  return result;
}

export function readCalibration(storage){
  try{const profile=JSON.parse(storage.getItem(CALIBRATION_KEY));return validCalibration(profile)?profile:null;}catch{return null;}
}
export function persistCalibration(storage,profile){
  try{if(profile)storage.setItem(CALIBRATION_KEY,JSON.stringify(profile));else storage.removeItem(CALIBRATION_KEY);return true;}catch{return false;}
}

export function calibratedTarget(result,profile){return result.found?applyCalibration(result,profile):neutral();}
