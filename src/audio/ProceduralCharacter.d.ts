import type {DrivingInput,EngineParams,EngineKind} from './types';
export class ProceduralCharacter {
 constructor(context:AudioContext,destination:AudioNode);
 configure(params:Partial<EngineParams>,kind:EngineKind):void;
 start():void;update(input:DrivingInput):void;stop(immediate?:boolean):void;cue(type:string):void;dispose():void;
}
