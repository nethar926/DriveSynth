import type {SynthNodeDesc} from './types';
export function validateGraph(desc:SynthNodeDesc[]):void;
export class SignalGraph {constructor(ctx:AudioContext,input:AudioNode,output:AudioNode);configure(desc:SynthNodeDesc[]):void;start():void;stop(tail?:number):void;dispose():void;}
