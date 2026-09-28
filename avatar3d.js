import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {clamp} from './core.js';
import {Shapes3D} from './shapes3d.js';
export class Avatar3D{
  constructor(container){
    this.container=container;this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));this.renderer.setClearColor(0,0);container.appendChild(this.renderer.domElement);
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(35,1,.01,100);this.camera.position.set(0,0,6.4);this.root=new THREE.Group();this.scene.add(this.root);
    this.scene.add(new THREE.HemisphereLight(0xe8ffff,0x374344,3));const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(-3,4,6);this.scene.add(key);const rim=new THREE.DirectionalLight(0xc8fa78,2);rim.position.set(3,1,-2);this.scene.add(rim);
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);this.meshes=[];this.shapes=new Shapes3D(this.scene);this.shapes.root.visible=false;this.activeKind='face';
  }
  load(){if(!this.loading)this.loading=this.loadModel().catch(error=>{this.loading=null;throw error;});return this.loading;}
  async loadModel(){
    const ktx=new KTX2Loader().setTranscoderPath(new URL('./vendor/three/addons/libs/basis/',import.meta.url).href).detectSupport(this.renderer);
    try{
      const gltf=await new GLTFLoader().setKTX2Loader(ktx).setMeshoptDecoder(MeshoptDecoder).loadAsync(new URL('./models/facecap.glb',import.meta.url).href);
      const model=gltf.scene;
      model.traverse(obj=>{if(obj.isMesh){if(obj.morphTargetDictionary)this.meshes.push(obj);const n=obj.name.toLowerCase();obj.material=new THREE.MeshStandardMaterial({color:n.includes('mesh_3')?0xf9f5e9:n.includes('eye')?0xcedfd4:0x9ecdc0,roughness:.55,metalness:.05});}});
      model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
      const scale=2.9/Math.max(size.x,size.y,size.z);model.scale.multiplyScalar(scale);model.position.sub(center.multiplyScalar(scale));this.root.add(model);this.resize();
    }finally{ktx.dispose();}
  }
  dispose(){this.observer.disconnect();this.shapes.dispose();this.renderer.dispose();this.renderer.domElement.remove();}
  resize(){const {width,height}=this.container.getBoundingClientRect();if(!width||!height)return;this.renderer.setSize(width,height);this.camera.aspect=width/height;this.camera.position.z=this.activeKind==='face'?6.4:8.2/Math.min(1,this.camera.aspect/.85);this.camera.updateProjectionMatrix();}
  render(state,{gain=1,mirror=true,kind='face'}={}){
    if(this.activeKind!==kind){this.activeKind=kind;this.resize();}
    this.container.style.transform=mirror?'scaleX(-1)':'none';this.root.visible=kind==='face';this.shapes.root.visible=kind!=='face';
    if(kind==='face'){
      this.root.rotation.set(state.pose.pitch,state.pose.yaw,state.pose.roll);
      for(const mesh of this.meshes)for(const [name,index] of Object.entries(mesh.morphTargetDictionary)){
        const plain=name.replace('blendShape1.','').replace(/_L$/,'Left').replace(/_R$/,'Right');mesh.morphTargetInfluences[index]=clamp((state.blend[plain]??0)*gain);
      }
    }else{
      this.shapes.render(state,{gain,mirror,kind});
    }
    this.renderer.render(this.scene,this.camera);
  }
}
