import {clamp} from './core.js';

export const shapeKinds=['jelly','polygon','crystal','knot'];
export const isShape=kind=>shapeKinds.includes(kind);
export const isThreeDimensional=kind=>['face','crystal','knot'].includes(kind);

// The same expression controls deform every shape. There are no facial landmarks
// on the target, and no clock-driven motion: a still input produces a still shape.
export function shapeMotion(state,{gain=1,mirror=true}={}){
  const value=key=>clamp((state.blend?.[key]??0)*clamp(gain,0,2));
  const open=value('jawOpen'),smile=(value('mouthSmileLeft')+value('mouthSmileRight'))/2;
  const left=value('eyeBlinkLeft'),right=value('eyeBlinkRight'),blink=(left+right)/2;
  const brow=Math.max(value('browInnerUp'),value('browOuterUpLeft'),value('browOuterUpRight'));
  const pucker=value('mouthPucker');
  return {
    open,smile,blink,brow,pucker,asymmetry:left-right,
    scaleX:1+.22*open+.3*smile+.16*blink-.15*pucker,
    scaleY:1+.42*open-.42*blink-.1*smile+.08*brow,
    scaleZ:1+.18*open+.12*blink,
    pitch:clamp(state.pose?.pitch,-.7,.7),yaw:clamp(state.pose?.yaw,-.9,.9),roll:clamp(state.pose?.roll,-.7,.7),
    sign:mirror?-1:1
  };
}

export function deformShapePoint(x,y,z,m){
  const angle=Math.atan2(y,x);
  const edge=1+.1*m.brow*Math.cos(angle*5)-.1*m.pucker*Math.cos(angle*2);
  const twist=y*(m.smile*.2+m.asymmetry*.16+m.yaw*.16);
  const cs=Math.cos(twist),sn=Math.sin(twist);
  return {
    x:(x*cs-z*sn)*edge*m.scaleX+.1*m.asymmetry*y,
    y:y*edge*m.scaleY,
    z:(x*sn+z*cs)*edge*m.scaleZ
  };
}
