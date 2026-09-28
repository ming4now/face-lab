import * as THREE from 'three';
import {shapeMotion,deformShapePoint} from './shape-motion.js';

export class Shapes3D{
  constructor(scene){this.root=new THREE.Group();this.root.position.y=.18;scene.add(this.root);this.objects=new Map();}
  get(kind){
    if(this.objects.has(kind))return this.objects.get(kind);
    const crystal=kind==='crystal';
    const geometry=crystal?new THREE.IcosahedronGeometry(1.04,1):new THREE.TorusKnotGeometry(.8,.25,112,12,2,3);
    const material=new THREE.MeshStandardMaterial({color:crystal?0xbafa8b:0xc2a0ff,roughness:crystal?.38:.32,metalness:crystal?.15:.22,flatShading:crystal});
    const mesh=new THREE.Mesh(geometry,material);
    const wire=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:crystal?0xedffcc:0xe1d4ff,wireframe:true,transparent:true,opacity:crystal?.12:.035}));
    mesh.add(wire);mesh.visible=false;this.root.add(mesh);
    const entry={mesh,base:Float32Array.from(geometry.attributes.position.array)};this.objects.set(kind,entry);return entry;
  }
  render(state,options){
    this.root.visible=true;const active=this.get(options.kind),m=shapeMotion(state,options);
    for(const item of this.objects.values())item.mesh.visible=item===active;
    this.root.rotation.set(m.pitch*1.25,m.yaw*1.35,m.roll);
    const {mesh,base}=active,position=mesh.geometry.attributes.position;
    for(let i=0;i<base.length;i+=3){const p=deformShapePoint(base[i],base[i+1],base[i+2],m);position.setXYZ(i/3,p.x,p.y,p.z);}
    position.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();
  }
  dispose(){for(const {mesh} of this.objects.values()){mesh.geometry.dispose();mesh.material.dispose();mesh.children[0].material.dispose();}this.root.removeFromParent();this.objects.clear();}
}
