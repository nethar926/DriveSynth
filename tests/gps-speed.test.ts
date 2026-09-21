import test from 'node:test';import assert from 'node:assert/strict';
import {speedFromFix,type Fix} from '../src/hooks/gpsSpeed.ts';
const base:Fix={latitude:0,longitude:0,accuracy:4,timestamp:1000,speed:null};
test('GPS preserves native speed including zero',()=>{assert.deepEqual(speedFromFix({...base,speed:0},null),{speed:0,estimated:false});assert.equal(speedFromFix({...base,speed:12},null).speed,12);});
test('GPS estimates speed from two timestamped fixes when native speed is null',()=>{const result=speedFromFix({...base,latitude:.0001,timestamp:2000},base);assert.ok(result.speed!>11&&result.speed!<11.2);assert.equal(result.estimated,true);});
test('GPS rejects weak, stale and impossible fixes and suppresses stationary wander',()=>{assert.equal(speedFromFix(base,null).speed,null);assert.equal(speedFromFix({...base,timestamp:2000,accuracy:100},base).speed,null);assert.equal(speedFromFix({...base,timestamp:20000},base).speed,null);assert.equal(speedFromFix({...base,latitude:1,timestamp:2000},base).speed,null);assert.equal(speedFromFix({...base,latitude:.000001,timestamp:2000},base).speed,0);});
