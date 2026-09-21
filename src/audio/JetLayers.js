// Separate rotating compressor tones and broadband exhaust, with rotor inertia.
export class JetLayers {
 constructor(ctx,destination){this.ctx=ctx;this.nodes=[];this.sources=[];this.running=false;this.spool=0;this.last=ctx.currentTime;
 this.output=this.node(ctx.createGain());this.output.gain.value=0;this.output.connect(destination);
 this.tonal=this.node(ctx.createGain());this.tonal.gain.value=0;this.tonal.connect(this.output);
 this.rotors=[1,1.007,2.01].map((ratio,i)=>{const o=this.node(ctx.createOscillator()),g=this.node(ctx.createGain());o.type='sine';g.gain.value=[.22,.15,.055][i];o.connect(g);g.connect(this.tonal);o.start();this.sources.push(o);return {o,ratio};});
 const noise=this.node(ctx.createBufferSource()),b=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate),d=b.getChannelData(0);let v=0;for(let i=0;i<d.length;i++){v=.88*v+.12*(Math.random()*2-1);d[i]=v;}noise.buffer=b;noise.loop=true;noise.start();this.sources.push(noise);
 this.exhaust=this.node(ctx.createGain());this.exhaust.gain.value=0;this.filter=this.node(ctx.createBiquadFilter());this.filter.type='lowpass';this.filter.frequency.value=1200;noise.connect(this.filter);this.filter.connect(this.exhaust);this.exhaust.connect(this.output);
 this.burn=this.node(ctx.createGain());this.burn.gain.value=0;const rumble=this.node(ctx.createOscillator());rumble.type='sine';rumble.frequency.value=46;rumble.connect(this.burn);this.burn.connect(this.output);rumble.start();this.sources.push(rumble);
 }
 node(n){this.nodes.push(n);return n;}
 configure(p){this.params=p;}
 start(){this.running=true;this.last=this.ctx.currentTime;}
 update(d){const p=this.params??{},t=this.ctx.currentTime,dt=Math.min(.1,Math.max(0,t-this.last));this.last=t;const norm=Math.max(0,Math.min(1,d.rpmNorm??0)),load=Math.max(0,Math.min(1,d.throttle??0));const inertia=.12+Number(p.jetInertia??.55)*1.6;this.spool+=(norm-this.spool)*(1-Math.exp(-dt/inertia));const smooth=(a,v)=>a.setTargetAtTime(v,t,.09);smooth(this.output.gain,this.running?Number(p.masterGain??.65):0);const pitch=Math.max(.3,Math.min(2,Number(p.jetSpoolPitch??1)));this.rotors.forEach(({o,ratio})=>smooth(o.frequency,(120+this.spool*1450)*pitch*ratio));smooth(this.tonal.gain,p.jetSpoolEnabled===0?0:Number(p.jetSpoolLevel??.75)*(.3+this.spool*.5));const thrust=p.jetSimulation===0||p.jetThrusterEnabled===0?0:Math.max(0,Math.min(1,((d.rpm??800)-Number(p.jetIdleRpm??800)-300)/3000))*load;const after=p.jetSimulation===0||p.jetAfterburnerEnabled===0?0:Math.max(0,(norm-.8)/.2)*Math.max(0,(load-.75)/.25);smooth(this.exhaust.gain,thrust*Number(p.jetThrusterLevel??.6)*(1+after)*.7);smooth(this.filter.frequency,250+Number(p.jetThrusterTone??.5)*2500+thrust*1400);smooth(this.burn.gain,after*Number(p.jetAfterburnerLevel??.5)*.18);}
 stop(){this.running=false;this.output.gain.setTargetAtTime(0,this.ctx.currentTime,.06);}
 dispose(){this.stop();for(const s of this.sources)try{s.stop();}catch{}for(const n of this.nodes)n.disconnect();this.sources=[];this.nodes=[];}
}
