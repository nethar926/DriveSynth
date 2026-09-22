import {spatialPanner,setPosition} from './spatial.ts';
import type {EnginePatch,EngineSynth,DrivingInput,SoundLayer} from './types';
export class LayerMixer {
 private voices=new Map<string,{engine:EngineSynth;gain:GainNode;pan:PannerNode;filter:BiquadFilterNode;layer:SoundLayer;signature:string}>();
 private active=false; private disposed=false; private ctx:AudioContext; private destination:AudioNode; private factory:(p:EnginePatch)=>EngineSynth;
 constructor(ctx:AudioContext,destination:AudioNode,factory:(p:EnginePatch)=>EngineSynth){this.ctx=ctx;this.destination=destination;this.factory=factory;}
 configure(layers:SoundLayer[]){
  const selected=layers.slice(0,8),ids=new Set(selected.map(l=>l.id));
  for(const [id,v] of this.voices)if(!ids.has(id)){v.engine.dispose();v.gain.disconnect();v.pan.disconnect();v.filter.disconnect();this.voices.delete(id);}
  const solo=selected.some(l=>l.solo&&!l.muted);
  for(const layer of selected){
   let v=this.voices.get(layer.id);const signature=JSON.stringify(layer.patch);
   if(!v){const engine=this.factory({...layer.patch,layers:[],params:{...layer.patch.params,lifecycleSounds:0}}),gain=this.ctx.createGain(),pan=spatialPanner(this.ctx),filter=this.ctx.createBiquadFilter();gain.gain.value=0;filter.type='lowpass';engine.output.disconnect();engine.output.connect(filter);filter.connect(pan);pan.connect(gain);gain.connect(this.destination);v={engine,gain,pan,filter,layer,signature};this.voices.set(layer.id,v);if(this.active)void engine.start().then(()=>{if(this.disposed||!this.active)engine.stop();}).catch(()=>engine.stop());}
   else if(v.signature!==signature)v.engine.fromPatch({...layer.patch,layers:[],params:{...layer.patch.params,lifecycleSounds:0}});
   v.layer=layer;v.signature=signature;
   v.gain.gain.setTargetAtTime(this.active&&!layer.muted&&(!solo||layer.solo)?Math.max(0,Math.min(1,layer.level))*.45:0,this.ctx.currentTime,.04);
   setPosition(v.pan,layer.pan,layer.depth??0,this.ctx.currentTime);
   v.filter.frequency.setTargetAtTime(Math.max(80,Math.min(18000,layer.cutoff)),this.ctx.currentTime,.04);
  }
 }
 async start(){this.active=true;await Promise.all([...this.voices.values()].map(async v=>{await v.engine.start();if(!this.active||this.disposed)v.engine.stop();}));this.configure([...this.voices.values()].map(v=>v.layer));}
 update(d:DrivingInput){for(const v of this.voices.values()){const l=v.layer;const rpmNorm=Math.max(0,Math.min(1,d.rpmNorm??d.speed));v.engine.setDriving({...d,rpm:(d.rpm??(800+rpmNorm*7200))*Math.max(.25,Math.min(2,l.pitch)),rpmNorm:Math.min(1,rpmNorm*l.pitch),throttle:l.response==='steady'?.35:l.response==='rpm'?rpmNorm:d.throttle});}}
 stop(){this.active=false;for(const v of this.voices.values()){v.engine.stop();v.gain.gain.setTargetAtTime(0,this.ctx.currentTime,.03);}}
 dispose(){this.disposed=true;this.stop();for(const v of this.voices.values()){v.engine.dispose();v.gain.disconnect();v.pan.disconnect();v.filter.disconnect();}this.voices.clear();}
}
