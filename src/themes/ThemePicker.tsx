import {useState, type CSSProperties} from 'react';
import {FAMILIES,THEMES,themeForId,type ThemeFamily} from './catalog';
export function ThemePicker({selected,onSelect}:{selected:string;onSelect:(id:string)=>void}) {
 const [family,setFamily]=useState<ThemeFamily>(()=>themeForId(selected).family);
 const [group,setGroup]=useState('All');
 const groups=[...new Set(THEMES.filter(t=>t.family===family).map(t=>t.group))];
 return <div className="theme-picker">
  <div className="theme-tabs" aria-label="Theme families">{FAMILIES.map(f=><button key={f} aria-pressed={family===f} onClick={()=>{setFamily(f);setGroup('All');}}>{f}</button>)}</div>
  <div className="theme-subtabs" aria-label="Theme subcategories">{['All',...groups].map(g=><button key={g} aria-pressed={group===g} onClick={()=>setGroup(g)}>{g}</button>)}</div>
  <div className="theme-card-grid">{THEMES.filter(t=>t.family===family&&(group==='All'||t.group===group)).map(t=><button className="theme-card" key={t.id} aria-pressed={selected===t.id} onClick={()=>onSelect(t.id)} style={{'--skin-accent':t.accent,'--skin-secondary':t.secondary} as CSSProperties}>
   <span className={`theme-thumbnail thumb-${t.layout}`} aria-hidden="true"><i/><b>{t.layout==='space'?'◇':t.layout==='jet'?'+':'68'}</b><i/></span>
   <span className="theme-card-title">{t.name}<span>{selected===t.id?'✓':'↗'}</span></span><small>{t.group} · {t.feature}</small><p>{t.description}</p>
  </button>)}</div>
 </div>;
}
