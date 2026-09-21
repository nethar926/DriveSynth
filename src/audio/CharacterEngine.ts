import {SignalGraph} from './SignalGraph';
import type {EngineSynth,EnginePatch,EngineParams,DrivingInput,LockStage,SynthNodeDesc} from './types';
import {ProceduralCharacter} from './ProceduralCharacter';
const keys=['tieSignature','roarLevel','roarVariant','roarPitch','roarThroat','roarRasp','roarPulse','roarAttack','roarRelease','interiorNoise','interiorLevel','targetingNoise','targetingLevel','gearingNoise','gearingLevel','blasterLevel','lifecycleSounds','lifecycleLevel'] as const;
/** Keep the native engine core, with a single independently controlled procedural character bus. */
export class CharacterEngine implements EngineSynth {
 readonly context:AudioContext;readonly output:GainNode;
 private fx:ProceduralCharacter;private options:Partial<EngineParams>={};private disposed=false;
 private base:EngineSynth;private graph:SignalGraph;private dry:GainNode;private raw:GainNode;private graphDesc:SynthNodeDesc[]=[];private running=false;
 constructor(base:EngineSynth,patch:EnginePatch){this.base=base;this.context=base.context;this.output=this.context.createGain();this.output.gain.value=.65;base.output.disconnect();this.raw=this.context.createGain();this.dry=this.context.createGain();base.output.connect(this.raw);this.raw.connect(this.dry);this.dry.connect(this.output);this.graph=new SignalGraph(this.context,this.raw,this.output);this.output.connect(this.context.destination);this.fx=new ProceduralCharacter(this.context,this.raw);this.fromPatch(patch);}
 get id(){return this.base.id;}
 async start(){await this.base.start();if(!this.disposed){this.running=true;this.fx.start();if(this.graphActive()){this.graph.configure(this.graphDesc);this.graph.start();}}}
 stop(){this.running=false;const hidden=typeof document!=='undefined'&&document.visibilityState==='hidden';this.graph.stop(hidden?0:1.8);this.base.stop();this.fx.stop(hidden);}
 dispose(){this.disposed=true;this.base.dispose();this.fx.dispose();this.graph.dispose();this.raw.disconnect();this.dry.disconnect();this.output.disconnect();}
 setDriving(d:DrivingInput){this.base.setDriving(d);this.fx.update(d);}
 setParams(params:Partial<EngineParams>){for(const k of keys)if(params[k]!==undefined)this.options[k]=params[k];const next={...params};if(this.base.toPatch().kind==='scifi')next.tieSignature=0;this.base.setParams(next);this.configure();if(params.graphEnabled!==undefined)this.routeGraph();}
 getParams(){return {...this.base.getParams(),...this.options};}
 toPatch(){return {...this.base.toPatch(),graph:this.graphDesc.length?this.graphDesc:this.base.toPatch().graph,params:this.getParams() as EnginePatch["params"]};}
 fromPatch(p:EnginePatch){this.options={};for(const k of keys)if(p.params[k]!==undefined)this.options[k]=Number(p.params[k]);if(p.kind==='scifi'&&this.options.tieSignature===undefined)this.options.tieSignature=1;this.base.fromPatch(p.kind==='scifi'?{...p,params:{...p.params,tieSignature:0}}:p);this.configure();this.graphDesc=p.graph??[];this.routeGraph();}
 private configure(){this.fx.configure(this.getParams(),this.base.toPatch().kind);}
 private graphActive(){return this.getParams().graphEnabled===1&&this.graphDesc.some(n=>n.type==='Output');}
 private routeGraph(){const active=this.graphActive();if(active)this.graph.configure(this.graphDesc);this.dry.gain.setTargetAtTime(active?0:1,this.context.currentTime,.025);if(active&&this.running)this.graph.start();else this.graph.stop();}
 applyGraphToParams(graph:SynthNodeDesc[]){if(graph.some(n=>n.type==='Output')){this.graph.configure(graph);this.graphDesc=graph;this.base.setParams({graphEnabled:1});this.routeGraph();}else{this.base.applyGraphToParams?.(graph);this.configure();}}
 getHud(){return this.base.getHud();}getDiag(){return this.base.getDiag();}getLockStage(){return this.base.getLockStage();}
 setLockSfxEnabled(v:boolean){this.base.setLockSfxEnabled(v);}getLockSfxEnabled(){return this.base.getLockSfxEnabled();}
 setUpshiftSfxEnabled(v:boolean){this.base.setUpshiftSfxEnabled(v);}getUpshiftSfxEnabled(){return this.base.getUpshiftSfxEnabled();}
 get onLockStageChange(){return this.base.onLockStageChange;}set onLockStageChange(v:((s:LockStage)=>void)|undefined){this.base.onLockStageChange=v;}
 triggerUiCue(cue:string){if(cue==='blaster')this.fx.cue('blaster');else if((cue==='upshift'||cue==='downshift')&&this.base.toPatch().kind==='scifi')this.fx.cue('gearing');else this.base.triggerUiCue?.(cue);}
}
