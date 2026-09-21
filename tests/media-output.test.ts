import test from 'node:test';import assert from 'node:assert/strict';import {MediaOutput} from '../src/audio/MediaOutput.ts';
test('media routing avoids duplicate output and restores direct sound when disabled',async()=>{
 const original=(globalThis as any).Audio;let plays=0,pauses=0,stops=0;
 (globalThis as any).Audio=class {srcObject:any;setAttribute(){} async play(){plays++;}pause(){pauses++;}};
 try{const destination={},stream={stream:{getTracks:()=>[{stop:()=>stops++}]},disconnect(){}};const ctx={destination,createMediaStreamDestination:()=>stream};const connections=new Set<any>([destination]);const node={context:ctx,connect:(n:any)=>connections.add(n),disconnect:(n:any)=>{if(!connections.delete(n))throw Error('not connected');}};
 const route=new MediaOutput(ctx as any);route.attach(node as any);await route.enable();await route.enable();assert.deepEqual([...connections],[stream]);route.disable();assert.deepEqual([...connections],[destination]);route.dispose();assert.equal(stops,1);assert.equal(plays,2);assert.ok(pauses>=1);
 }finally{(globalThis as any).Audio=original;}
});
