// A recognition choice can combine models with different responsibilities.
// OpenGraphAU supplements nose diagnostics; MediaPipe still drives the avatar.
export const recognitionModels=Object.freeze([
  {id:'mediapipe',label:'MediaPipe · 基础跟踪',nose:false,description:'眼睛、嘴巴与转头跟踪。默认 30 次/秒，优先 GPU；免费，在本机识别。'},
  {id:'mediapipe-opengraphau',label:'MediaPipe + OpenGraphAU',nose:true,description:'基础跟踪 + 鼻部增强实验。鼻部上限 5 次/秒，首次额外下载约 73 MB；鼻部目前用于数值对比。'}
]);
export function recognitionModel(id){
  const model=recognitionModels.find(model=>model.id===id);
  if(!model)throw new Error('未知的识别模型');
  return model;
}
