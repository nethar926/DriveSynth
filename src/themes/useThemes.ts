import {sanitizeCluster,defaultCluster,type ClusterWidget} from './clusterModel';
import type {FontChoice} from './FontPicker';
import { useCallback, useState } from 'react';
import type { EnginePatch } from '../audio';
import { DEFAULT_THEME, themeForId } from './catalog';
export interface Combination { id: string; name: string; skinId: string; atmosphereId?:string; sound: EnginePatch; }
const THEME_KEY = 'drivesynth.theme.v2';
const PAIRS_KEY = 'drivesynth.combinations.v1';
export function useThemes() {
  const [widgets,setWidgets]=useState<ClusterWidget[]>(()=>{try{return sanitizeCluster(JSON.parse(localStorage.getItem("revforge.cluster")??"null"));}catch{return defaultCluster;}});
  const saveWidgets=(next:ClusterWidget[])=>{setWidgets(next);try{localStorage.setItem("revforge.cluster",JSON.stringify(next));}catch{setStorageError("Cluster could not be saved.");}};
  const [fonts,setFonts]=useState<Record<string,FontChoice>>(()=>{try{return JSON.parse(localStorage.getItem("revforge.fonts")??"{}");}catch{return {};}});
  const setFont=(id:string,value:FontChoice)=>{const next={...fonts,[id]:value};setFonts(next);try{localStorage.setItem("revforge.fonts",JSON.stringify(next));}catch{setStorageError("Fonts could not be saved.");}};
  const [colors,setColors]=useState<Record<string,Record<string,string>>>(()=>{try{return JSON.parse(localStorage.getItem('revforge.colors')??'{}');}catch{return {};}});
  const saveColors=(next:Record<string,Record<string,string>>)=>{setColors(next);try{localStorage.setItem('revforge.colors',JSON.stringify(next));}catch{setStorageError('Color settings could not be saved.');}};
  const setColor=(id:string,key:string,value:string)=>{if(/^#[0-9a-f]{6}$/i.test(value))saveColors({...colors,[id]:{...colors[id],[key]:value}});};
  const resetColors=(id:string)=>{const next={...colors};delete next[id];saveColors(next);};

  const [skinId,setSkin] = useState(()=>{try{return themeForId(localStorage.getItem(THEME_KEY) ?? DEFAULT_THEME).id;}catch{return DEFAULT_THEME;}});
  const [atmosphereId,setAtmosphere]=useState(()=>{try{return themeForId(localStorage.getItem("revforge.atmosphere")??DEFAULT_THEME).id;}catch{return DEFAULT_THEME;}});
  const selectAtmosphere=useCallback((id:string)=>{const t=themeForId(id);if(t.family!=="RoadView")return;setAtmosphere(t.id);try{localStorage.setItem("revforge.atmosphere",t.id);}catch{/* session only */}},[]);
  const [combinations,setCombinations] = useState<Combination[]>(()=>{try {const data=JSON.parse(localStorage.getItem(PAIRS_KEY)??'[]');return Array.isArray(data)?data.filter(x=>x && typeof x.id==='string' && typeof x.name==='string' && x.sound?.params && typeof x.skinId==='string'):[];}catch{return [];}});
  const [storageError,setStorageError]=useState('');
  const selectSkin = useCallback((id:string)=>{const next=themeForId(id).id;setSkin(next);try{localStorage.setItem(THEME_KEY,next);setStorageError('');}catch{setStorageError('This browser could not save your theme.');}},[]);
  const saveCombination = (name:string,sound:EnginePatch) => {
    const id=crypto.randomUUID();
    const next=[...combinations,{id,name:name.trim()||`${themeForId(skinId).name} + ${sound.name}`,skinId,atmosphereId,sound:{...structuredClone(sound),id:`user-combination-${id}`}}];
    setCombinations(next);try{localStorage.setItem(PAIRS_KEY,JSON.stringify(next));setStorageError('');}catch{setStorageError('Combination is available this session, but storage is full or blocked.');}
  };
  const removeCombination=(id:string)=>{const next=combinations.filter(c=>c.id!==id);setCombinations(next);try{localStorage.setItem(PAIRS_KEY,JSON.stringify(next));setStorageError('');}catch{setStorageError('Could not save this deletion.');}};
  return {widgets,saveWidgets,fonts,setFont,colors,setColor,resetColors,skinId,selectSkin,atmosphereId,selectAtmosphere,combinations,saveCombination,removeCombination,storageError};
}
