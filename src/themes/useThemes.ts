import { useCallback, useState } from 'react';
import type { EnginePatch } from '../audio';
import { DEFAULT_THEME, themeForId } from './catalog';
export interface Combination { id: string; name: string; skinId: string; sound: EnginePatch; }
const THEME_KEY = 'drivesynth.theme.v2';
const PAIRS_KEY = 'drivesynth.combinations.v1';
export function useThemes() {
  const [skinId,setSkin] = useState(()=>{try{return themeForId(localStorage.getItem(THEME_KEY) ?? DEFAULT_THEME).id;}catch{return DEFAULT_THEME;}});
  const [combinations,setCombinations] = useState<Combination[]>(()=>{try {const data=JSON.parse(localStorage.getItem(PAIRS_KEY)??'[]');return Array.isArray(data)?data.filter(x=>x && typeof x.id==='string' && typeof x.name==='string' && x.sound?.params && typeof x.skinId==='string'):[];}catch{return [];}});
  const [storageError,setStorageError]=useState('');
  const selectSkin = useCallback((id:string)=>{const next=themeForId(id).id;setSkin(next);try{localStorage.setItem(THEME_KEY,next);setStorageError('');}catch{setStorageError('This browser could not save your theme.');}},[]);
  const saveCombination = (name:string,sound:EnginePatch) => {
    const id=crypto.randomUUID();
    const next=[...combinations,{id,name:name.trim()||`${themeForId(skinId).name} + ${sound.name}`,skinId,sound:{...structuredClone(sound),id:`user-combination-${id}`}}];
    setCombinations(next);try{localStorage.setItem(PAIRS_KEY,JSON.stringify(next));setStorageError('');}catch{setStorageError('Combination is available this session, but storage is full or blocked.');}
  };
  const removeCombination=(id:string)=>{const next=combinations.filter(c=>c.id!==id);setCombinations(next);try{localStorage.setItem(PAIRS_KEY,JSON.stringify(next));setStorageError('');}catch{setStorageError('Could not save this deletion.');}};
  return {skinId,selectSkin,combinations,saveCombination,removeCombination,storageError};
}
