import {clamp} from './core.js';
import {createHeadProjection} from './head-projection.js';

// Expression controls stay independent: a wink must not close both eyes, and
// eyeWide must not reopen an eye while eyeBlink is fully engaged.
export function fingerExpression(blend={},gain=1){
  const v=key=>clamp((blend[key]??0)*clamp(gain,0,2));
  const eye=side=>({blink:v('eyeBlink'+side),height:Math.max(.7,(8.5+v('eyeWide'+side)*5)*(1-v('eyeBlink'+side))),brow:Math.max(v('browInnerUp'),v('browOuterUp'+side)),down:v('browDown'+side),lookX:(v('eyeLookOut'+side)-v('eyeLookIn'+side))*(side==='Left'?1:-1)*3,lookY:(v('eyeLookDown'+side)-v('eyeLookUp'+side))*2});
  const open=v('jawOpen'),pucker=v('mouthPucker'),smile=(v('mouthSmileLeft')+v('mouthSmileRight'))/2;
  return {left:eye('Left'),right:eye('Right'),open,pucker,smile,frown:(v('mouthFrownLeft')+v('mouthFrownRight'))/2,
    smileLeft:v('mouthSmileLeft'),smileRight:v('mouthSmileRight'),mouthWidth:20+smile*10-pucker*12,mouthHeight:1.5+open*24+pucker*5+v('mouthFunnel')*3,nose:Math.max(v('noseSneerLeft'),v('noseSneerRight'))};
}

export function drawFinger(c,w,h,state,{gain=1,mirror=true}={}){
  const e=fingerExpression(state.blend,gain),pose=state.pose;
  const view=createHeadProjection({...pose,roll:0},false),sign=mirror?-1:1;
  const size=Math.min(w/305,h/390),ink='#332b2a';
  const skin=(left=-60,right=65)=>{const g=c.createLinearGradient(left,0,right,0);g.addColorStop(0,'#c88162');g.addColorStop(.23,'#f3b68c');g.addColorStop(.48,'#ffd4a7');g.addColorStop(.76,'#efac83');g.addColorStop(1,'#b96f57');return g;};
  const fillSkin=(path,color=skin())=>{path();c.fillStyle=color;c.fill();c.strokeStyle='#a66d574d';c.lineWidth=1.3;c.stroke();};
  const finger=()=>{c.beginPath();c.moveTo(-46,80);c.bezierCurveTo(-46,24,-52,-76,-47,-117);c.bezierCurveTo(-44,-166,39,-174,48,-122);c.bezierCurveTo(53,-81,44,26,49,83);c.closePath();};
  const at=(x,y,draw)=>{const f=view.feature(x,y,{radiusX:55,radiusY:94,depth:45});if(f.opacity<=0)return;c.save();c.globalAlpha*=f.opacity;c.transform(f.a,f.b,f.c,f.d,f.x,f.y-69);draw();c.restore();};
  c.save();c.translate(w/2,h*.46);c.scale(size,size);
  c.fillStyle='#08171a66';c.beginPath();c.ellipse(5,163,84,10,0,0,Math.PI*2);c.fill();
  c.translate(sign*view.yaw*13,view.pitch*7);c.rotate(-sign*clamp(pose.roll,-.7,.7)*.8);c.scale(sign,1);

  // Palm, raised index finger, and three folded fingers make this read as a
  // tiny hand puppet rather than an isolated capsule.
  fillSkin(()=>{c.beginPath();c.moveTo(-56,48);c.bezierCurveTo(-88,72,-75,129,-49,146);c.lineTo(-39,161);c.quadraticCurveTo(0,173,49,156);c.bezierCurveTo(62,143,92,126,86,92);c.lineTo(67,47);c.closePath();});
  fillSkin(finger);
  c.save();finger();c.clip();
  const glow=c.createLinearGradient(0,-157,0,52);glow.addColorStop(0,'#fff3d252');glow.addColorStop(.55,'#fff1d300');glow.addColorStop(1,'#b2674925');c.fillStyle=glow;c.fillRect(-55,-160,110,245);
  c.lineCap='round';c.strokeStyle='#ac705a42';c.lineWidth=1.25;
  for(const [y,width] of [[12,31],[18,22],[58,33],[65,23]]){c.beginPath();c.moveTo(-width,y);c.quadraticCurveTo(2,y+7,width-5,y+1);c.stroke();}
  // Fine curved strokes suggest the fingertip's skin, without a fixed face.
  c.strokeStyle='#b0785840';c.lineWidth=.8;
  for(let i=0;i<3;i++){c.beginPath();c.ellipse(-4,-129,20+i*6,10+i*4,-.15,Math.PI*1.05,Math.PI*1.87);c.stroke();}

  // All marker features are projected onto the same curved fingertip surface.
  for(const x of [-33,33])at(x,12,()=>{c.fillStyle='#d87e6b44';c.beginPath();c.ellipse(0,0,9+e.smile*2,5,0,0,Math.PI*2);c.fill();c.strokeStyle='#b768585c';c.lineWidth=1.1;for(const dx of [-3,1,5]){c.beginPath();c.moveTo(dx-1,-2);c.lineTo(dx+1,2);c.stroke();}});
  for(const [x,eye] of [[22,e.left],[-22,e.right]]){
    at(x,-20,()=>{
      c.lineWidth=2.4;c.strokeStyle=ink;c.lineCap='round';
      if(eye.height<2){c.beginPath();c.moveTo(-8,-1);c.quadraticCurveTo(0,4,8,-1);c.stroke();c.beginPath();c.moveTo(6,1);c.lineTo(9,3);c.stroke();}
      else{
        c.beginPath();c.ellipse(0,0,7.8,eye.height,-.06,0,Math.PI*2);c.fillStyle='#fff4de';c.fill();c.stroke();
        c.save();c.clip();c.fillStyle=ink;c.beginPath();c.ellipse(eye.lookX,eye.lookY,3.7,Math.max(2,eye.height*.69),0,0,Math.PI*2);c.fill();c.restore();
      }
    });
    at(x,-42-eye.brow*11+eye.down*5,()=>{c.strokeStyle=ink;c.lineWidth=2.8;c.lineCap='round';c.beginPath();c.moveTo(-9,2);c.quadraticCurveTo(-1,-4+eye.down*7,9,-1+eye.down*4);c.stroke();});
  }
  at(0,1,()=>{c.strokeStyle='#674333';c.lineWidth=1.7;c.lineCap='round';c.beginPath();c.moveTo(-1,-3-e.nose*2);c.lineTo(-3,3);c.quadraticCurveTo(1,6,4,2);c.stroke();});
  at(0,31,()=>{
    const mw=e.mouthWidth,mh=e.mouthHeight;c.strokeStyle=ink;c.lineCap='round';c.lineJoin='round';c.lineWidth=2.8;
    if(e.open>.06||e.pucker>.25){
      c.beginPath();c.moveTo(-mw,-2);c.bezierCurveTo(-mw,-mh*.7,mw*.88,-mh*.8,mw,-1);c.bezierCurveTo(mw,mh*1.15,-mw*.9,mh*1.15,-mw,-2);c.closePath();c.fillStyle=ink;c.fill();c.stroke();
      c.save();c.clip();c.fillStyle='#fff4de';c.beginPath();c.moveTo(-mw*.85,-mh);c.lineTo(mw*.85,-mh);c.lineTo(mw*.7,-mh*.12);c.quadraticCurveTo(0,mh*.06,-mw*.72,-mh*.12);c.closePath();c.fill();
      c.fillStyle='#e99491';c.beginPath();c.ellipse(1,mh*.79,mw*.68,mh*.3,0,0,Math.PI*2);c.fill();c.strokeStyle='#ba65714f';c.lineWidth=1;c.beginPath();c.moveTo(1,mh*.55);c.lineTo(1,mh*.84);c.stroke();c.restore();
    }else{
      c.beginPath();c.moveTo(-mw,-e.smileRight*7+e.frown*4);c.bezierCurveTo(-mw*.38,9+e.smile*7-e.frown*19,mw*.5,10+e.smile*7-e.frown*19,mw,-e.smileLeft*7+e.frown*4);c.stroke();
      if(e.smile>.3){c.lineWidth=1.6;for(const x of [-mw,mw]){c.beginPath();c.moveTo(x-2,-5);c.lineTo(x+2,-1);c.stroke();}}
    }
  });
  c.restore();

  // Folded fingers overlap the palm below the face, with visible joint creases.
  for(const [x,y,width,height] of [[54,73,23,39],[78,86,20,33],[93,102,15,25]]){
    c.save();c.translate(x,y);c.rotate(-.12);
    fillSkin(()=>{c.beginPath();c.roundRect(-width,-height,width*1.8,height*1.9,[width*.9,width*.9,width*.65,width*.65]);},skin(-width,width));
    c.strokeStyle='#a5675066';c.lineWidth=1.2;c.lineCap='round';c.beginPath();c.moveTo(-width*.65,-2);c.quadraticCurveTo(0,4,width*.6,0);c.stroke();c.beginPath();c.moveTo(-width*.5,5);c.quadraticCurveTo(0,9,width*.4,6);c.stroke();c.restore();
  }
  c.save();c.translate(-48,102);c.rotate(-.58);
  fillSkin(()=>{c.beginPath();c.moveTo(-21,28);c.lineTo(-23,-25);c.bezierCurveTo(-22,-49,17,-53,22,-24);c.lineTo(26,25);c.quadraticCurveTo(4,46,-21,28);},skin(-27,25));
  c.strokeStyle='#b3765a70';c.lineWidth=1.2;c.beginPath();c.moveTo(-12,4);c.quadraticCurveTo(0,9,14,4);c.stroke();c.restore();
  c.restore();
}
