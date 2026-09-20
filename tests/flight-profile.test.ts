import test from 'node:test';
import assert from 'node:assert/strict';
import {flightProfile,idleWander} from '../src/forge/flightProfile.ts';
test('jet transitions from idle to thrust to afterburner and releases on lift',()=>{
 assert.equal(flightProfile(650,650,10000,0).thrust,0);
 assert.equal(flightProfile(950,650,10000,.8).thrust,0);
 assert.ok(flightProfile(3000,650,10000,.7).thrust>0);
 assert.equal(flightProfile(3000,650,10000,.7).afterburner,0);
 assert.ok(flightProfile(9500,650,10000,1).afterburner>.9);
 assert.equal(flightProfile(9500,650,10000,0).afterburner,0);
 assert.equal(flightProfile(9500,650,10000,1,true).thrust,0);
 const off=flightProfile(9500,650,10000,1,false,false);
 assert.equal(off.thrust+off.afterburner,0);assert.ok(off.spool>0);
});
test('idle wander obeys off/intensity and fades under acceleration',()=>{
 assert.equal(idleWander(1,650,650,0,0),0);
 assert.notEqual(idleWander(1,650,650,0,.5),0);
 assert.equal(idleWander(1,650,650,1,1),0);
 assert.equal(idleWander(1,2000,650,0,1),0);
 for(let t=0;t<30;t+=.03)assert.ok(Math.abs(idleWander(t,650,650,0,1))<=650*.065);
});
