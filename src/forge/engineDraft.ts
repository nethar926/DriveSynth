import type {EnginePatch} from '../audio/types';
export const isCustomEngine=(patch:EnginePatch)=>patch.id.startsWith('user-');
export function editableEngine(patch:EnginePatch):EnginePatch {return isCustomEngine(patch)?structuredClone(patch):{...structuredClone(patch),id:`user-${crypto.randomUUID()}`,name:`${patch.name} Custom`,meta:{...patch.meta,author:'You'}};}
