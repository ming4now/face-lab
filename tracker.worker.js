import {FaceLandmarker,FilesetResolver} from './vendor/mediapipe/vision_bundle.mjs';
import {parseResult} from './core.js';
let tracker;
self.onmessage=async({data})=>{
  if(data.type==='init'){
    try{
      const files=await FilesetResolver.forVisionTasks(new URL('./vendor/mediapipe/wasm',import.meta.url).href,true);
      const options={baseOptions:{modelAssetPath:new URL('./models/face_landmarker.task',import.meta.url).href,delegate:'GPU'},runningMode:'VIDEO',numFaces:1,outputFaceBlendshapes:true,outputFacialTransformationMatrixes:true};
      let engine='GPU';
      try{tracker=await FaceLandmarker.createFromOptions(files,options);}catch{self.postMessage({type:'progress',message:'GPU 初始化未成功，正在尝试 CPU…'});options.baseOptions.delegate='CPU';engine='CPU';files.wasmLoaderPath+='?fallback=cpu';tracker=await FaceLandmarker.createFromOptions(files,options);}
      self.postMessage({type:'ready',engine});
    }catch(error){self.postMessage({type:'error',message:'人脸模型加载失败：'+error.message});}
  }else if(data.type==='frame'){
    try{
      if(!tracker)throw Error('模型尚未就绪');
      const start=performance.now();
      const result=tracker.detectForVideo(data.bitmap,data.timestamp);
      const inferenceMs=performance.now()-start;
      self.postMessage({type:'result',...parseResult(result),inferenceMs});
    }catch(error){self.postMessage({type:'error',message:'人脸识别中断：'+error.message});}
    finally{data.bitmap.close();}
  }
};
