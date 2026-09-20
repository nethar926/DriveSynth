import type {EnginePatch} from '../audio';
export function SoundCharacter({patch,onChange}:{patch:EnginePatch;onChange:(p:EnginePatch)=>void}) {
 const jet=patch.kind==='aerospace',ion=patch.kind==='scifi';
 if(!jet&&!ion)return null;
 const key=jet?'jetSimulation':'tieSignature';
 return <section className="sound-character"><label>{jet?'Jet simulation':'Twin-Ion signature sound'}<input aria-label={jet?'Jet simulation':'Twin-Ion signature sound'} type="checkbox" checked={patch.params[key]!==0} onChange={e=>onChange({...patch,params:{...patch.params,[key]:e.target.checked?1:0}})}/></label><p className="forge-control-hint">{jet?'Off: engine whir only. On: thrust blends in 300 RPM above idle, then hot afterburner noise at high RPM and throttle. Lifting off returns to the whir.':'Original procedural TIE-style howl and rush, enabled by default. Switch off for the quieter twin-engine core.'}</p></section>;
}
