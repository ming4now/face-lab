import {clamp} from './core.js';

// Match the 3D avatar's XYZ rotations, then mirror in screen space.
export function createHeadProjection(pose,mirror=true){
  const pitch=clamp(pose.pitch,-.8,.8),yaw=clamp(pose.yaw,-1.1,1.1),roll=clamp(pose.roll,-.8,.8),sign=mirror?-1:1;
  const sx=Math.sin(pitch),cx=Math.cos(pitch),sy=Math.sin(yaw),cy=Math.cos(yaw),sz=Math.sin(roll),cz=Math.cos(roll);
  const rotate=(x,y,z)=>{
    const rx=cz*x-sz*y,ry=sz*x+cz*y;
    const yx=cy*rx+sy*z,yz=-sy*rx+cy*z;
    return {x:yx,y:cx*ry-sx*yz,z:sx*ry+cx*yz};
  };
  const project=(x,y,z)=>{const p=rotate(x,-y,z);return {x:sign*p.x,y:-p.y,z:p.z};};
  const feature=(x,y,{radiusX=125,radiusY=130,depth=96}={})=>{
    const curved=Math.sqrt(Math.max(.08,1-(x/radiusX)**2-(y/radiusY)**2));
    const z=depth*curved,dx=-depth*x/(radiusX*radiusX*curved),dy=-depth*y/(radiusY*radiusY*curved);
    const origin=project(x,y,z),right=project(x+1,y,z+dx),down=project(x,y+1,z+dy);
    const facing=rotate(-dx,dy,1).z/Math.hypot(dx,dy,1);
    return {a:right.x-origin.x,b:right.y-origin.y,c:down.x-origin.x,d:down.y-origin.y,x:origin.x,y:origin.y,depth:origin.z,opacity:clamp((facing-.04)/.2)};
  };
  return {project,feature,pitch,yaw,roll,sign};
}
