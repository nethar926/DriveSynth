/** Fictional driving envelope. The 300 RPM onset is relative to idle. */
export function flightProfile(rpm:number,idle:number,redline:number,throttle:number,overrun=false,enabled=true) {
 const clamp=(x:number)=>Math.max(0,Math.min(1,x));
 const power=overrun?0:clamp((throttle-.06)/.94);
 const spool=clamp((rpm-idle)/Math.max(1,redline-idle));
 const thrust=enabled?clamp((rpm-idle-300)/Math.max(1,(redline-idle)*.55-300))*power:0;
 const afterburner=enabled?clamp((power-.78)/.22)*clamp((spool-.65)/.2):0;
 return {spool,thrust,afterburner};
}
export function idleWander(time:number,rpm:number,idle:number,throttle:number,amount:number) {
 const gate=Math.max(0,1-Math.max(0,rpm-idle)/350)*Math.max(0,1-throttle*8);
 return Math.max(0,Math.min(1,amount))*idle*.065*gate*(Math.sin(time*7.3)*.6+Math.sin(time*13.7)*.25+Math.sin(time*2.9)*.15);
}
