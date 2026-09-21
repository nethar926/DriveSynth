export function parseDestination(digits:string):Date|null {
 if(!/^\d{12}$/.test(digits))return null;
 const month=Number(digits.slice(0,2)),day=Number(digits.slice(2,4)),year=Number(digits.slice(4,8)),hour=Number(digits.slice(8,10)),minute=Number(digits.slice(10,12));
 if(year<1||month<1||month>12||day<1||hour>23||minute>59)return null;
 const d=new Date(0);d.setFullYear(year,month-1,day);d.setHours(hour,minute,0,0);
 return d.getFullYear()===year&&d.getMonth()===month-1&&d.getDate()===day?d:null;
}
export const crosses88=(previousMps:number,currentMps:number)=>previousMps<88*.44704&&currentMps>=88*.44704;
