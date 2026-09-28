// OpenGraphAU's official hybrid_prediction_infolist order, not ARKit coefficients.
export const NOSE_AUS=[{id:'AU9',label:'皱鼻',index:6},{id:'AU38',label:'鼻孔扩张',index:25},{id:'AU39',label:'鼻孔收缩',index:26}];
export const INPUT_SIZE=224;
export function noseAUScores(scores){
  if(scores?.length!==41)throw new Error('鼻部模型输出维度不符');
  const values=NOSE_AUS.map(({index})=>scores[index]);
  if(values.some(v=>!Number.isFinite(v)||v<0||v>1.00001))throw new Error('鼻部模型返回了无效数值');
  return values.map(v=>Math.min(1,v));
}
export function rgbaToTensor(rgba){
  const count=INPUT_SIZE*INPUT_SIZE;
  if(rgba.length!==count*4)throw new Error('模型需要 224 × 224 图像');
  const data=new Float32Array(count*3),means=[.485,.456,.406],stds=[.229,.224,.225];
  for(let c=0;c<3;c++)for(let i=0;i<count;i++)data[c*count+i]=(rgba[i*4+c]/255-means[c])/stds[c];
  return data;
}
export function faceRegion(landmarks){
  if(!landmarks?.length)return null;
  const pts=landmarks.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
  if(pts.length<100)return null;
  const left=Math.min(...pts.map(p=>p.x)),right=Math.max(...pts.map(p=>p.x));
  const top=Math.min(...pts.map(p=>p.y)),bottom=Math.max(...pts.map(p=>p.y));
  if(right-left<.04||bottom-top<.04||left<0||top<0||right>1||bottom>1)return null;
  const a=landmarks[33],b=landmarks[263];
  if(!a||!b||![a.x,a.y,b.x,b.y].every(Number.isFinite))return null;
  return {left,right,top,bottom,eyeDx:b.x-a.x,eyeDy:b.y-a.y};
}
export function cropGeometry(region,width,height){
  if(!region||!(width>0&&height>0))return null;
  const {left,right,top,bottom,eyeDx,eyeDy}=region;
  if(![left,right,top,bottom,eyeDx,eyeDy].every(Number.isFinite)||right<=left||bottom<=top)return null;
  // A padded square face crop, then the upstream 256 -> 224 center crop.
  const side=Math.max((right-left)*width,(bottom-top)*height)*1.2;
  return {cx:(left+right)/2*width,cy:(top+bottom)/2*height,side,angle:Math.atan2(eyeDy*height,eyeDx*width)};
}
export function meanScores(samples){
  if(samples.length<5)throw new Error('有效样本不足，请保持正脸后重试');
  return [0,1,2].map(i=>samples.reduce((sum,s)=>sum+s[i],0)/samples.length);
}
