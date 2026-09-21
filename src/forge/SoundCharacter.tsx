import type {EnginePatch,EngineParams} from '../audio';
export function SoundCharacter({patch,onChange}:{patch:EnginePatch;onChange:(p:EnginePatch)=>void}) {
 const jet=patch.kind==='aerospace',ion=patch.kind==='scifi',p=patch.params;
 const set=(key:keyof EngineParams,value:number)=>onChange({...patch,params:{...p,[key]:value}});
 const toggle=(key:keyof EngineParams,label:string,fallback=1)=><label>{label}<input aria-label={label} type="checkbox" checked={Number(p[key]??fallback)!==0} onChange={e=>set(key,e.target.checked?1:0)}/></label>;
 const slider=(key:keyof EngineParams,label:string,fallback:number,min=0,max=1,step=.01)=><label className="character-slider"><span>{label}<output>{Number(p[key]??fallback).toFixed(2)}</output></span><input aria-label={label} type="range" value={Number(p[key]??fallback)} min={min} max={max} step={step} onChange={e=>set(key,Number(e.target.value))}/></label>;
 return <section className="sound-character">
 {toggle('lifecycleSounds','Startup and shutdown sounds')}{slider('lifecycleLevel','Startup / shutdown level',.55)}
 {jet&&<>{toggle('jetSimulation','Jet simulation')}<p className="forge-control-hint">Whir at idle and on lift-off. Thrust blends in 300 RPM above idle; afterburner opens at high throttle and RPM.</p></>}
 {ion&&<>{toggle('tieSignature','Engine roar')}<label>Roar character<select aria-label="Roar character" value={Number(p.roarVariant??1)} onChange={e=>set('roarVariant',Number(e.target.value))}><option value={0}>Low bellow · reference 1</option><option value={1}>Rising howl · reference 2</option><option value={2}>Broad scream · reference 3</option></select></label>
 <div className="character-knobs">{slider('roarLevel','Roar level',.65)}{slider('roarPitch','Roar pitch',1,.5,1.8)}{slider('roarThroat','Throat resonance',.6)}{slider('roarRasp','Roar grit',.3)}{slider('roarPulse','Roar flutter',.4)}{slider('roarAttack','Roar attack · seconds',.22,.03,1)}{slider('roarRelease','Roar release · seconds',.65,.08,2)}</div>
 {toggle('interiorNoise','Interior hum',0)}{slider('interiorLevel','Interior level',.3)}{toggle('targetingNoise','Targeting noise',0)}{slider('targetingLevel','Targeting level',.25)}{toggle('gearingNoise','Gearing noise')}{slider('gearingLevel','Gearing level',.4)}{slider('blasterLevel','Blaster level',.55)}
 <p className="forge-control-hint">Synthesized from oscillators, noise and moving resonances using your references. Play/pause fires blasters only when this browser receives the media event. The on-screen Blasters button always provides a control.</p></>}
 </section>;
}
