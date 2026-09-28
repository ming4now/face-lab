import {shapeMotion,deformShapePoint} from './shape-motion.js';

export function drawShape2D(c,w,h,state,options){
  const m=shapeMotion(state,options),polygon=options.kind==='polygon';
  const size=Math.min(w/4.7,h/5.5),count=polygon?7:96,points=[];
  const radii=[1.03,.82,1.1,.93,1.12,.86,.98];
  for(let i=0;i<count;i++){
    const angle=i/count*Math.PI*2-Math.PI/2;
    const radius=polygon?radii[i]:1+.13*Math.sin(angle*3+.5)+.07*Math.cos(angle*5-.4);
    const p=deformShapePoint(Math.cos(angle)*radius,Math.sin(angle)*radius,0,m);
    points.push({x:p.x*size,y:p.y*size});
  }
  const path=(scale=1)=>{
    c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x*scale,p.y*scale):c.moveTo(p.x*scale,p.y*scale));c.closePath();
  };
  c.save();c.translate(w/2,h*.43);
  c.fillStyle='#07151955';c.beginPath();c.ellipse(m.sign*m.yaw*12,size*1.8,size*(.9+m.open*.1),size*.09,0,0,Math.PI*2);c.fill();
  c.translate(m.sign*m.yaw*size*.3,m.pitch*size*.2);
  c.rotate(-m.sign*m.roll);
  c.transform(m.sign*(1-Math.abs(m.yaw)*.2),0,-m.sign*m.pitch*.16,1-Math.abs(m.pitch)*.14,0,0);
  c.save();c.translate(0,size*.065);path();c.fillStyle=polygon?'#6e4285':'#228f7e';c.fill();c.restore();
  const fill=c.createLinearGradient(-size,-size,size,size*1.1);
  fill.addColorStop(0,polygon?'#ffe1a7':'#dcff94');fill.addColorStop(.5,polygon?'#e5a1e2':'#87e6b2');fill.addColorStop(1,polygon?'#8b83ee':'#3cbba6');
  path();c.fillStyle=fill;c.fill();c.lineWidth=1.5;c.strokeStyle='#f0ffe86b';c.stroke();
  if(polygon){
    const center={x:m.asymmetry*size*.14,y:-size*.12};
    points.forEach((p,i)=>{const next=points[(i+1)%points.length];c.beginPath();c.moveTo(center.x,center.y);c.lineTo(p.x,p.y);c.lineTo(next.x,next.y);c.closePath();c.fillStyle=['#ffffff24','#28175120','#ffffff08','#fff7dd30','#32234925','#ffffff16','#5144771a'][i];c.fill();c.strokeStyle='#ffffff25';c.lineWidth=1;c.stroke();});
  }else{
    c.save();path();c.clip();
    for(const scale of [.73,.48]){c.save();c.translate(-size*.07,-size*.11);path(scale);c.strokeStyle='#efffdd50';c.lineWidth=1.3;c.stroke();c.restore();}
    const highlight=c.createRadialGradient(-size*.4,-size*.55,0,-size*.4,-size*.55,size*.95);highlight.addColorStop(0,'#ffffff44');highlight.addColorStop(1,'#ffffff00');c.fillStyle=highlight;c.fillRect(-size*2,-size*2,size*4,size*4);c.restore();
  }
  c.restore();
}
