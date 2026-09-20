import test from 'node:test';
import assert from 'node:assert/strict';
import {mediaCommand} from '../src/forge/mediaActions.ts';
test('media pause shifts only for an active manual gearbox with the option enabled',()=>{
 assert.equal(mediaCommand('pause',true,true,true),'up');
 assert.equal(mediaCommand('pause',true,true,false),'stop');
 assert.equal(mediaCommand('pause',true,false,true),'stop');
 assert.equal(mediaCommand('pause',false,true,true),'none');
});
test('track controls shift manual gears and leave automatic transmission alone',()=>{
 assert.equal(mediaCommand('nexttrack',true,true,true),'up');
 assert.equal(mediaCommand('previoustrack',true,true,true),'down');
 for(const action of ['nexttrack','previoustrack'] as const){
  assert.equal(mediaCommand(action,true,false,true),'none');
  assert.equal(mediaCommand(action,false,true,true),'none');
 }
});
test('play starts a stopped engine without shifting a running engine',()=>{
 assert.equal(mediaCommand('play',false,true,true),'start');
 assert.equal(mediaCommand('play',true,true,true),'none');
});
