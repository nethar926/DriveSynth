export interface Fix {latitude:number;longitude:number;accuracy:number;timestamp:number;speed:number|null}
export function speedFromFix(fix:Fix, previous:Fix|null):{speed:number|null;estimated:boolean} {
 if(Number.isFinite(fix.speed)&&fix.speed!==null&&fix.speed>=0)return {speed:fix.speed,estimated:false};
 if(!previous||!Number.isFinite(fix.latitude)||!Number.isFinite(fix.longitude)||fix.accuracy>50||previous.accuracy>50)return {speed:null,estimated:true};
 const dt=(fix.timestamp-previous.timestamp)/1000;
 if(dt<.5||dt>15)return {speed:null,estimated:true};
 const rad=Math.PI/180,lat=(fix.latitude-previous.latitude)*rad,lon=(fix.longitude-previous.longitude)*rad;
 const a=Math.sin(lat/2)**2+Math.cos(fix.latitude*rad)*Math.cos(previous.latitude*rad)*Math.sin(lon/2)**2;
 const distance=6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));
 const speed=distance/dt;
 if(speed>100)return {speed:null,estimated:true};
 // A conservative uncertainty deadband suppresses stationary GPS wander.
 return {speed:distance<Math.max(2,(fix.accuracy+previous.accuracy)*.25)?0:speed,estimated:true};
}
