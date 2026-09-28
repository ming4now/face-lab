import {clamp} from './core.js';
import {createHeadProjection} from './head-projection.js';
import {drawShape2D} from './shapes2d.js';

export class Avatar2D{
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.width=0;this.height=0;this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();}
  resize(){const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;this.width=r.width;this.height=r.height;this.dpr=Math.min(devicePixelRatio||1,1.5);this.canvas.width=Math.round(r.width*this.dpr);this.canvas.height=Math.round(r.height*this.dpr);}
  draw(state,{kind='blob',gain=1,mirror=true}={}){
    const c=this.ctx,w=this.width,h=this.height;if(!w||!h)return;
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,w,h);
    if(kind==='jelly'||kind==='polygon'){drawShape2D(c,w,h,state,{kind,gain,mirror});return;}
    const b=state.blend,v=k=>clamp((b[k]??0)*gain),smile=(v('mouthSmileLeft')+v('mouthSmileRight'))/2,open=v('jawOpen'),pucker=v('mouthPucker'),brow=Math.max(v('browInnerUp'),v('browOuterUpLeft'),v('browOuterUpRight')),frown=(v('mouthFrownLeft')+v('mouthFrownRight'))/2;
    const view=createHeadProjection(state.pose,mirror),frog=kind==='frog',surface=frog?{radiusX:132,radiusY:125,depth:92}:{radiusX:125,radiusY:140,depth:96};
    const at=(frame,draw)=>{if(frame.opacity<=0)return;c.save();c.globalAlpha*=frame.opacity;c.transform(frame.a,frame.b,frame.c,frame.d,frame.x,frame.y);draw();c.restore();};
    const s=Math.min(w/340,h/420);
    c.save();c.translate(w/2,h*.48);c.scale(s,s);
    c.fillStyle='#0c1a1e55';c.beginPath();c.ellipse(0,136,98,12,0,0,Math.PI*2);c.fill();
    const bodyScaleX=Math.hypot(Math.cos(view.yaw),.72*Math.sin(view.yaw)),bodyScaleY=Math.hypot(Math.cos(view.pitch),.74*Math.sin(view.pitch));
    const bodyTransform=()=>{c.rotate(-view.sign*view.roll);c.scale(view.sign*bodyScaleX,bodyScaleY);};
    const jawDrop=open*60*Math.max(0,Math.sin(view.pitch));
    const bodyPath=()=>{c.beginPath();if(frog)c.ellipse(0,8+jawDrop/2,125,98+jawDrop/2,0,0,Math.PI*2);else{c.moveTo(-100,65+jawDrop);c.bezierCurveTo(-141,-55,-84,-139,0,-132);c.bezierCurveTo(102,-133,144,-25,108,66+jawDrop);c.bezierCurveTo(76,111+jawDrop,-61,114+jawDrop,-100,65+jawDrop);c.closePath();}};
    c.save();bodyTransform();bodyPath();
    const light=c.createLinearGradient(-110,-100,120,110);light.addColorStop(0,frog?'#88deb4':'#d2ff88');light.addColorStop(1,frog?'#50b48f':'#acd95e');c.fillStyle=light;c.fill();
    if(!frog){c.fillStyle='#dfffaa';c.beginPath();c.ellipse(-44,-81,28,12,-.5,0,Math.PI*2);c.fill();}c.restore();
    const eyeY=frog?-64:-23,eyeX=frog?64:42;
    const eyes=['Left','Right'].map(side=>({side,frame:view.feature((side==='Left'?1:-1)*eyeX,eyeY,surface)})).sort((a,b)=>a.frame.depth-b.frame.depth);
    if(frog){
      const root=c.getTransform();c.save();bodyTransform();bodyPath();c.clip();c.setTransform(root);
      at(view.feature(0,56,surface),()=>{c.fillStyle='#b5efb7';c.beginPath();c.ellipse(0,0,74,39,0,0,Math.PI*2);c.fill();});c.restore();
      for(const {frame} of eyes)at(frame,()=>{c.fillStyle='#88deb4';c.beginPath();c.ellipse(0,0,43,46,0,0,Math.PI*2);c.fill();});
    }
    // Each feature follows a tangent on the curved face; far-side features
    // compress and disappear as the head turns.
    for(const {side,frame} of eyes)at(frame,()=>{
      const blink=v('eyeBlink'+side),wide=v('eyeWide'+side),eyeH=Math.max(1.8,(frog?23:17)*(1-blink)+wide*9);
      c.fillStyle=frog?'#edf8d5':'#23382a';c.beginPath();c.ellipse(0,0,frog?24:12,eyeH,0,0,Math.PI*2);c.fill();
      if(frog&&blink<.9){c.save();c.beginPath();c.ellipse(0,0,24,eyeH,0,0,Math.PI*2);c.clip();c.fillStyle='#193d34';c.beginPath();c.ellipse(0,1,9,Math.min(13,eyeH),0,0,Math.PI*2);c.fill();c.restore();}
      if(!frog&&blink<.8){c.fillStyle='#f1ffe0';c.beginPath();c.ellipse(-3,-5,3,4*(1-blink),0,0,Math.PI*2);c.fill();}
      c.strokeStyle=frog?'#306b4f':'#4b7935';c.lineWidth=5;c.lineCap='round';const ey=brow*17,down=v('browDown'+side)*10;c.beginPath();c.moveTo(-14,-30-ey);c.quadraticCurveTo(0,-36-ey+down,14,-30-ey+down);c.stroke();
    });
    const root=c.getTransform();c.save();bodyTransform();bodyPath();c.clip();c.setTransform(root);
    c.fillStyle=frog?'#3aa78c':'#89c65b';
    for(const x of [-71,71])at(view.feature(x,frog?-14:17,surface),()=>{c.beginPath();c.ellipse(0,0,17+smile*3,8,0,0,Math.PI*2);c.fill();});
    const mouthY=frog?35:40,mouthW=(frog?37:25)+smile*19-pucker*18,mouthH=3+open*49+pucker*8;
    at(view.feature(0,mouthY,surface),()=>{
      c.lineCap='round';c.lineJoin='round';
      if(open>.08||pucker>.3){c.fillStyle='#27342a';c.beginPath();c.ellipse(0,0,Math.max(7,mouthW),mouthH,0,0,Math.PI*2);c.fill();c.save();c.beginPath();c.ellipse(0,0,Math.max(7,mouthW),mouthH,0,0,Math.PI*2);c.clip();c.fillStyle='#ef997c';c.beginPath();c.ellipse(0,mouthH*.83,mouthW*.72,mouthH*.4,0,0,Math.PI*2);c.fill();c.fillStyle='#fffae0';c.fillRect(-mouthW*.65,-mouthH,mouthW*1.3,Math.min(12,mouthH*.3));c.restore();}
      else{c.strokeStyle='#263d2d';c.lineWidth=7;c.beginPath();c.moveTo(-mouthW,-smile*5+frown*5);c.quadraticCurveTo(0,12+smile*17-frown*22,mouthW,-smile*5+frown*5);c.stroke();}
    });
    c.restore();c.restore();
  }
}
