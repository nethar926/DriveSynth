export type VehicleMediaAction = 'play'|'pause'|'nexttrack'|'previoustrack';
export function mediaCommand(action:VehicleMediaAction, running:boolean, manual:boolean, pauseShifts:boolean, blasters=false):'start'|'stop'|'up'|'down'|'blaster'|'none' {
 if(running&&blasters&&(action==='play'||action==='pause'))return 'blaster';
 if(action==='play') return running?'none':'start';
 if(!running) return 'none';
 if(action==='pause') return manual&&pauseShifts?'up':'stop';
 if(!manual) return 'none';
 return action==='nexttrack'?'up':'down';
}
