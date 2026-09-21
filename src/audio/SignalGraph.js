/** Live, acyclic Web Audio routing. Parameter edits retain running sources. */
export function validateGraph(desc){
 const ids=new Set(desc.map(n=>n.id));if(ids.size!==desc.length)throw Error('Node IDs must be unique.');
 const visiting=new Set(),done=new Set();
 const visit=id=>{if(visiting.has(id))throw Error('Feedback loops are not supported.');if(done.has(id))return;visiting.add(id);const n=desc.find(n=>n.id===id);for(const edge of n.outs){if(!ids.has(edge.to))throw Error('Choose an existing destination.');visit(edge.to);}visiting.delete(id);done.add(id);};desc.forEach(n=>visit(n.id));
}
export class SignalGraph {
 constructor(ctx,input,output){this.ctx=ctx;this.input=input;this.output=output;this.nodes=new Map();this.signature='';this.running=false;this.bus=ctx.createGain();this.bus.gain.value=0;this.bus.connect(output);}
 configure(desc){
 validateGraph(desc);
 const signature=JSON.stringify(desc.map(n=>[n.id,n.type,n.outs]));
 if(signature!==this.signature){this.clear();this.signature=signature;
 for(const d of desc){let node,source;const gain=this.ctx.createGain();gain.gain.value=1;
 if(d.type==='EngineInput'){node=this.ctx.createGain();this.input.connect(node);}
 else if(d.type==='Osc'){node=source=this.ctx.createOscillator();source.start();}
 else if(d.type==='Noise'){node=source=this.ctx.createBufferSource();const b=this.ctx.createBuffer(1,this.ctx.sampleRate,this.ctx.sampleRate);const data=b.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;source.buffer=b;source.loop=true;source.start();}
 else if(d.type==='Filter'){node=this.ctx.createBiquadFilter();node.type='lowpass';}
 else node=this.ctx.createGain();
 node.connect(gain);this.nodes.set(d.id,{node,gain,source,type:d.type});
 }
 for(const d of desc){const item=this.nodes.get(d.id);for(const edge of d.outs)item.gain.connect(this.nodes.get(edge.to).node);if(d.type==='Output')item.gain.connect(this.bus);}
 }
 for(const d of desc){const item=this.nodes.get(d.id),p=d.params,number=(key,fallback,min,max)=>{const v=Number(p[key]??fallback);return Math.max(min,Math.min(max,Number.isFinite(v)?v:fallback));};
 if(d.type==='Osc'){item.node.frequency.setTargetAtTime(number('frequency',120,20,16000),this.ctx.currentTime,.025);item.node.detune.setTargetAtTime(number('detune',0,-1200,1200),this.ctx.currentTime,.025);item.node.type=['sine','triangle','sawtooth','square'].includes(p.wave)?p.wave:'sine';}
 if(d.type==='Filter'){item.node.frequency.setTargetAtTime(number('frequency',3000,40,18000),this.ctx.currentTime,.025);item.node.Q.setTargetAtTime(number('Q',.7,.1,12),this.ctx.currentTime,.025);}
 item.gain.gain.setTargetAtTime(number('gain',d.type==='Osc'||d.type==='Noise'?.08:1,0,1),this.ctx.currentTime,.025);
 }
 }
 start(){this.running=true;this.bus.gain.cancelScheduledValues(this.ctx.currentTime);this.bus.gain.setTargetAtTime(1,this.ctx.currentTime,.02);}
 stop(tail=0){this.running=false;for(const {gain,source} of this.nodes.values())if(source)gain.gain.setTargetAtTime(0,this.ctx.currentTime,.01);this.bus.gain.setTargetAtTime(0,this.ctx.currentTime+tail,.02);}
 clear(){for(const {node,gain,source,type} of this.nodes.values()){if(type==='EngineInput')try{this.input.disconnect(node);}catch{}if(source)try{source.stop();}catch{}node.disconnect();gain.disconnect();}this.nodes.clear();}
 dispose(){this.clear();this.bus.disconnect();}
}
