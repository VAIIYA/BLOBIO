'use client';
import { useState } from 'react';
import { SaveData } from '@/lib/persistence';
import { SKINS, CATEGORIES } from '@/lib/skins';
import SkinCanvas from './SkinCanvas';

interface Props { save: SaveData; onBack: () => void; onSelect: (id: number) => void; }

export default function SkinScreen({ save, onBack, onSelect }: Props) {
  const [activeCat, setActiveCat] = useState('All');

  const filtered = SKINS.filter(s => activeCat === 'All' || s.category === activeCat);

  return (
    <div style={{ position:'fixed',inset:0,display:'flex',flexDirection:'column',background:'#07080f',zIndex:50 }}>
      {/* Header */}
      <div style={{ display:'flex',alignItems:'center',gap:14,padding:'18px 22px 14px',borderBottom:'1px solid rgba(255,255,255,0.08)',flexShrink:0 }}>
        <button onClick={onBack} style={{
          background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,0.08)',
          borderRadius:10,padding:'7px 13px',color:'#fff',fontFamily:"'Space Mono',monospace",
          fontSize:11,cursor:'pointer',
        }}>← Back</button>
        <span style={{fontFamily:"'Unbounded',sans-serif",fontSize:15,fontWeight:700}}>Skin Collection</span>
        <span style={{marginLeft:'auto',fontSize:10,color:'#00ffd0'}}>{save.xp} XP total</span>
      </div>

      {/* Category pills */}
      <div style={{ display:'flex',gap:7,padding:'12px 22px',borderBottom:'1px solid rgba(255,255,255,0.08)',overflowX:'auto',flexShrink:0 }}>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={()=>setActiveCat(cat)} style={{
            background:activeCat===cat?'#00ffd0':'rgba(255,255,255,.05)',
            border:`1px solid ${activeCat===cat?'#00ffd0':'rgba(255,255,255,0.08)'}`,
            borderRadius:99,padding:'5px 13px',fontSize:10,cursor:'pointer',whiteSpace:'nowrap',
            color:activeCat===cat?'#000':'rgba(255,255,255,0.35)',fontWeight:activeCat===cat?700:400,
            fontFamily:"'Space Mono',monospace",
          }}>{cat}</button>
        ))}
      </div>

      {/* Grid */}
      <div style={{ flex:1,overflowY:'auto',padding:'14px 14px 32px' }}>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(96px,1fr))',gap:10 }}>
          {filtered.map(skin => {
            const unlocked = save.unlockedSkins.includes(skin.id);
            const selected = save.selectedSkin === skin.id;
            return (
              <div key={skin.id} onClick={()=>unlocked&&onSelect(skin.id)}
                style={{
                  borderRadius:14,border:`2px solid ${selected?'#00ffd0':'rgba(255,255,255,0.08)'}`,
                  padding:'10px 7px',cursor:unlocked?'pointer':'not-allowed',textAlign:'center',
                  position:'relative',background:selected?'rgba(0,255,208,.07)':'rgba(255,255,255,.02)',
                  opacity:unlocked?1:0.45,transition:'all .2s',
                  boxShadow:selected?'0 0 18px rgba(0,255,208,.15)':'none',
                }}>
                {!unlocked && <div style={{position:'absolute',top:5,right:5,fontSize:11}}>🔒</div>}
                {selected && <div style={{position:'absolute',top:5,left:5,background:'#00ffd0',color:'#000',fontSize:6,fontWeight:700,padding:'2px 4px',borderRadius:99,letterSpacing:1}}>EQ</div>}
                <SkinCanvas skinId={skin.id} size={60} style={{margin:'0 auto 7px',display:'block'}}/>
                <div style={{fontSize:8,fontWeight:700,color:'rgba(255,255,255,0.85)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{skin.name}</div>
                <div style={{fontSize:7,color:'rgba(255,255,255,0.35)',marginTop:2}}>{unlocked?'✓ owned':`${skin.xpRequired} XP`}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
