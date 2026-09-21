import type {EngineParams,DrivingInput} from './types';
export class JetLayers {constructor(ctx:AudioContext,destination:AudioNode);configure(p:Partial<EngineParams>):void;start():void;update(d:DrivingInput):void;stop():void;dispose():void;}
