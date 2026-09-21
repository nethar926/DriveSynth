// Original procedural synthesis, calibrated from spectral/envelope measurements.
// No reference recording or extracted waveform is included.
const clip=(x,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:a));
export class ProceduralCharacter {
 constructor(ctx,destination){
  this.ctx=ctx;this.nodes=[];this.sources=[];this.shots=new Set();this.active=false;this.lastCue=-10;this.previousOverrun=false;
  this.master=this.node(ctx.createGain());this.master.gain.value=.65;
  this.limiter=this.node(ctx.createDynamicsCompressor());this.limiter.threshold.value=-15;this.limiter.knee.value=8;this.limiter.ratio.value=16;this.limiter.attack.value=.003;this.limiter.release.value=.16;
  this.master.connect(this.limiter);this.limiter.connect(destination);
  this.noise=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const data=this.noise.getChannelData(0);let brown=0;
  for(let i=0;i<data.length;i++){brown=(brown+(Math.random()*2-1)*.08)/1.015;data[i]=brown*2;}
  const noise=this.node(ctx.createBufferSource());noise.buffer=this.noise;noise.loop=true;noise.start();this.sources.push(noise);
  this.roar=this.node(ctx.createGain());this.roar.gain.value=0;this.roar.connect(this.master);
  this.formants=[205,436,1066].map((f,i)=>{const filter=this.node(ctx.createBiquadFilter());filter.type='bandpass';filter.frequency.value=f;filter.Q.value=2+i;const gain=this.node(ctx.createGain());gain.gain.value=[1.4,.95,.45][i];noise.connect(filter);filter.connect(gain);gain.connect(this.roar);return filter;});
  this.grit=this.node(ctx.createGain());this.grit.gain.value=.05;this.grit.connect(this.roar);
  this.voice=this.osc('sawtooth',102,this.grit);this.voice2=this.osc('triangle',107,this.grit);
  const fm=this.node(ctx.createGain());fm.gain.value=18;this.osc('sine',71,fm);fm.connect(this.voice.frequency);
  this.pulseDepth=this.node(ctx.createGain());this.pulseDepth.gain.value=0;this.pulse=this.osc('sine',4,this.pulseDepth);this.pulseDepth.connect(this.roar.gain);
  this.interior=this.node(ctx.createGain());this.interior.gain.value=0;this.interior.connect(this.master);
  [54,108,129].forEach((f,i)=>{const gain=this.node(ctx.createGain());gain.gain.value=[.7,.12,.08][i];gain.connect(this.interior);this.osc('sine',f,gain);});
  this.target=this.node(ctx.createGain());this.target.gain.value=0;this.target.connect(this.master);
  [1260,1502,2099].forEach((f,i)=>{const gain=this.node(ctx.createGain());gain.gain.value=[.45,.3,.08][i];gain.connect(this.target);this.osc('sine',f,gain);});
  this.targetPulse=this.node(ctx.createGain());this.targetPulse.gain.value=0;this.osc('square',3.6,this.targetPulse);this.targetPulse.connect(this.target.gain);
 }
 node(n){this.nodes.push(n);return n;}
 osc(type,f,destination){const o=this.node(this.ctx.createOscillator());o.type=type;o.frequency.value=f;o.connect(destination);o.start();this.sources.push(o);return o;}
 smooth(p,v,time=.08){p.setTargetAtTime(v,this.ctx.currentTime,Math.max(.01,time));}
 configure(params={},kind='scifi'){this.params=params;this.kind=kind;this.smooth(this.master.gain,clip(params.masterGain??.65),.03);}
 start(){this.cancelShots();this.active=true;this.previousOverrun=false;if(this.params?.lifecycleSounds!==0)this.cue('startup');}
 update(d){
  const p=this.params??{},ion=this.active&&this.kind==='scifi';
  const rpm=clip(d.rpmNorm??d.speed??0),thr=clip(d.throttle??0),now=this.ctx.currentTime;
  const intensity=ion&&p.tieSignature!==0?clip(p.roarLevel??.65):0;
  const mode=Math.round(clip(p.roarVariant??1,0,2)),pitch=clip(p.roarPitch??1,.5,1.8);
  const throat=clip(p.roarThroat??.6),rasp=clip(p.roarRasp??.3),flutter=clip(p.roarPulse??.4);
  const opened=clip((rpm-.02)/.75),power=.12+opened*.64+thr*.32;
  const release=clip(p.roarRelease??.65,.08,2),attack=clip(p.roarAttack??.22,.03,1);
  const envelope=d.overrun?power*.42:power;
  this.smooth(this.roar.gain,intensity*envelope,d.overrun?release:attack);
  this.smooth(this.pulseDepth.gain,intensity*envelope*flutter*.24);
  this.smooth(this.pulse.frequency,2+flutter*9+thr*3);
  const shift=[.72,1,1.13][mode],sweep=pitch*shift*(.78+opened*.68+thr*.15)*(1+Math.sin(now*1.7)*.025*flutter);
  const anchors=[[205,404,1066],[436,598,1400],[420,721,1254]][mode];
  this.formants.forEach((f,i)=>{this.smooth(f.frequency,clip(anchors[i]*sweep,40,6500),attack);this.smooth(f.Q,1.3+throat*5+i*.35);});
  this.smooth(this.voice.frequency,102*pitch*(.7+opened*.85));this.smooth(this.voice2.frequency,107*pitch*(.7+opened*.85));this.smooth(this.grit.gain,.015+rasp*.17);
  this.smooth(this.interior.gain,ion&&p.interiorNoise===1?clip(p.interiorLevel??.3)*.24:0,.3);
  const target=ion&&p.targetingNoise===1?clip(p.targetingLevel??.25)*.075:0;
  this.smooth(this.target.gain,target,.1);this.smooth(this.targetPulse.gain,target*.65,.1);
  if(ion&&d.overrun&&!this.previousOverrun&&p.gearingNoise!==0)this.cue('gearing');
  this.previousOverrun=!!d.overrun;
 }
 stop(immediate=false){const was=this.active;this.active=false;this.update({});if(immediate)for(const n of [this.roar,this.pulseDepth,this.interior,this.target,this.targetPulse]){n.gain.cancelScheduledValues(this.ctx.currentTime);n.gain.setValueAtTime(0,this.ctx.currentTime);}this.cancelShots();if(was&&!immediate&&this.params?.lifecycleSounds!==0)this.cue('shutdown');}
 cue(type){
  const p=this.params??{},ctx=this.ctx,now=ctx.currentTime;
  if(type==='blaster'&&(!this.active||this.kind!=='scifi'||now-this.lastCue<.18))return;
  if(type==='gearing'&&(!this.active||this.kind!=='scifi'||p.gearingNoise===0))return;
  if(type==='blaster')this.lastCue=now;
  const duration=type==='startup'?2.18:type==='shutdown'?1.65:type==='gearing'?1.15:.32;
  const gain=ctx.createGain(),osc=ctx.createOscillator(),noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),mix=ctx.createGain();
  const shot={sources:[osc,noise],nodes:[osc,noise,filter,mix,gain]};this.shots.add(shot);
  const level=type==='gearing'?clip(p.gearingLevel??.4)*.32:type==='blaster'?clip(p.blasterLevel??.55)*.45:clip(p.lifecycleLevel??.55)*.32;
  gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(level,now+(type==='startup'?.45:.025));gain.gain.exponentialRampToValueAtTime(.0001,now+duration);gain.gain.setValueAtTime(0,now+duration+.01);gain.connect(this.master);
  osc.type=type==='blaster'?'sawtooth':'triangle';
  const base=this.kind==='scifi'?420:this.kind==='aerospace'?300:this.kind==='ice'?110:230;
  const from=type==='startup'?base*.22:type==='blaster'?1800:base;
  const to=type==='startup'?base:type==='blaster'?65:38;
  osc.frequency.setValueAtTime(from,now);osc.frequency.exponentialRampToValueAtTime(to,now+duration*.8);osc.connect(gain);
  noise.buffer=this.noise;noise.loop=true;filter.type='bandpass';filter.Q.value=type==='gearing'?2.8:1.2;
  filter.frequency.setValueAtTime(type==='startup'?120:850,now);filter.frequency.exponentialRampToValueAtTime(type==='startup'?900:75,now+duration);
  mix.gain.value=type==='blaster'?.15:.7;noise.connect(filter);filter.connect(mix);mix.connect(gain);
  let ended=0;const clean=()=>{if(++ended<2)return;for(const n of shot.nodes)try{n.disconnect();}catch{}this.shots.delete(shot);};osc.onended=clean;noise.onended=clean;
  osc.start(now);noise.start(now);osc.stop(now+duration+.03);noise.stop(now+duration+.03);
 }
 cancelShots(){for(const shot of this.shots){for(const s of shot.sources)try{s.stop();}catch{}for(const n of shot.nodes)try{n.disconnect();}catch{}}this.shots.clear();}
 dispose(){this.active=false;this.cancelShots();for(const s of this.sources)try{s.stop();}catch{}for(const n of this.nodes)try{n.disconnect();}catch{}this.sources=[];this.nodes=[];}
}
