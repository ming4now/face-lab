import * as ort from './vendor/onnxruntime/ort.webgpu.min.mjs';
import {rgbaToTensor,noseAUScores,INPUT_SIZE} from './nose-model-core.js';

let session,engine;
const canvas=new OffscreenCanvas(INPUT_SIZE,INPUT_SIZE),ctx=canvas.getContext('2d',{willReadFrequently:true});
ort.env.wasm.wasmPaths=new URL('./vendor/onnxruntime/',import.meta.url).href;
ort.env.wasm.numThreads=1; // GitHub Pages does not provide cross-origin isolation.
ort.env.wasm.proxy=false;

async function loadModel(){
  const response=await fetch(new URL('./models/opengraphau/resnet18-stage1.onnx',import.meta.url));
  if(!response.ok)throw new Error('模型下载失败（'+response.status+'）');
  const total=Number(response.headers.get('content-length'))||0;
  if(!response.body)return new Uint8Array(await response.arrayBuffer());
  const reader=response.body.getReader(),chunks=[];let size=0,lastUpdate=0;
  while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);size+=value.length;
    if(performance.now()-lastUpdate>200){lastUpdate=performance.now();self.postMessage({type:'progress',message:`正在下载鼻部模型：${(size/1e6).toFixed(1)}${total?' / '+(total/1e6).toFixed(1):''} MB`});}}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
async function run(data){
  const input=new ort.Tensor('float32',data,[1,3,INPUT_SIZE,INPUT_SIZE]);
  let outputs;
  try{outputs=await session.run({face:input});const scores=Array.from(outputs.scores.data);noseAUScores(scores);return scores;}
  finally{input.dispose();if(outputs)for(const tensor of Object.values(outputs))tensor.dispose();}
}
self.onmessage=async({data})=>{
  try{
    if(data.type==='init'){
      const model=await loadModel();
      self.postMessage({type:'progress',message:'正在准备鼻部模型，首次运行需要预热…'});
      const options={graphOptimizationLevel:'all',executionProviders:['wasm']};
      // WebGPU may delegate unsupported graph operations to WASM.
      if(!data.forceWasm&&navigator.gpu){
        try{session=await ort.InferenceSession.create(model,{...options,executionProviders:['webgpu','wasm']});await run(new Float32Array(3*INPUT_SIZE*INPUT_SIZE));engine='WebGPU 优先 / 可回退 CPU';}
        catch{await session?.release().catch(()=>{});session=null;self.postMessage({type:'progress',message:'GPU 路径不可用，正在尝试 CPU / WASM…'});}
      }
      if(!session){session=await ort.InferenceSession.create(model,options);await run(new Float32Array(3*INPUT_SIZE*INPUT_SIZE));engine='CPU / WASM';}
      self.postMessage({type:'ready',engine});
    }else if(data.type==='frame'){
      if(!session)throw new Error('鼻部模型尚未就绪');
      ctx.drawImage(data.bitmap,0,0,INPUT_SIZE,INPUT_SIZE);
      const start=performance.now(),tensor=rgbaToTensor(ctx.getImageData(0,0,INPUT_SIZE,INPUT_SIZE).data);
      const inferenceStart=performance.now(),scores=await run(tensor);
      self.postMessage({type:'result',scores,nose:noseAUScores(scores),inferenceMs:performance.now()-inferenceStart,totalMs:performance.now()-start,token:data.token,timestamp:data.timestamp});
    }
  }catch(error){self.postMessage({type:'error',message:'鼻部实验失败：'+(error?.message||String(error))});}
  finally{data.bitmap?.close();}
};
