export function position(x:number,z:number){const finite=(v:number)=>Number.isFinite(v)?Math.max(-1,Math.min(1,v)):0;return {x:finite(x)*1.8,z:finite(z)*2};}
export function setPosition(panner:PannerNode,x:number,z:number,time:number){const p=position(x,z);panner.positionX.setTargetAtTime(p.x,time,.045);panner.positionY.setTargetAtTime(0,time,.045);panner.positionZ.setTargetAtTime(p.z,time,.045);}
export function spatialPanner(ctx:BaseAudioContext){const p=ctx.createPanner();p.panningModel='HRTF';p.distanceModel='inverse';p.refDistance=3;p.maxDistance=20;p.rolloffFactor=.2;return p;}
