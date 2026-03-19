'use client';
import { useEffect, useRef } from 'react';
import { SaveData, xpForLevel, currentLevel, xpIntoLevel } from '@/lib/persistence';
import { MAPS } from '@/lib/maps';
import SkinCanvas from './SkinCanvas';
import { SKINS } from '@/lib/skins';

interface Props {
  save: SaveData;
  onPlay: (name: string) => void;
  onOpenSkins: () => void;
  onSelectMap: (id: number) => void;
}

export default function MenuScreen({ save, onPlay, onOpenSkins, onSelectMap }: Props) {
  const nameRef = useRef<HTMLInputElement>(null);
  const lvl = currentLevel(save.xp);
  const xpIn = xpIntoLevel(save.xp);
  const xpNeeded = xpForLevel(lvl);
  const pct = xpNeeded > 0 ? (xpIn / xpNeeded) * 100 : 0;

  function handlePlay() {
    const name = nameRef.current?.value.trim() || 'Blob';
    onPlay(name);
  }

  return (
    <div style={{
      position:'fixed',inset:0,display:'flex',flexDirection:'column',alignItems:'center',
      justifyContent:'center',zIndex:50,
      background:'radial-gradient(ellipse 80% 60% at 50% 30%,rgba(0,255,208,0.07),transparent 70%),#07080f'
    }}>
      {/* animated bg blobs */}
      <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none'}}>
        {['#00ffd0','#7c3aed','#ff2d55','#fbbf24','#3b82f6'].map((col,i)=>(
          <span key={i} style={{
            position:'absolute',borderRadius:'50%',filter:'blur(60px)',
            width:180+i*20,height:180+i*20,background:col,
            top:`${15+i*14}%`,left:`${10+i*18}%`,opacity:0.15,
            animation:`blobFloat ${6+i*2}s ease-in-out infinite alternate`,
            animationDelay:`-${i*1.5}s`
          }}/>
        ))}
      </div>

      <style>{`
        @keyframes blobFloat{from{transform:translate(0,0)scale(1);}to{transform:translate(20px,-30px)scale(1.08);}}
      `}</style>

      <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:'clamp(44px,8vw,80px)',fontWeight:900,letterSpacing:'-3px',
        background:'linear-gradient(135deg,#fff 30%,#00ffd0)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>
        BLOB<span style={{WebkitTextFillColor:'#00ffd0'}}>.</span>IO
      </div>
      <div style={{fontSize:10,letterSpacing:6,color:'rgba(255,255,255,0.35)',textTransform:'uppercase',marginTop:4,marginBottom:24}}>
        Devour Everything · Become Everything
      </div>

      <div style={{
        background:'rgba(13,15,28,0.85)',border:'1px solid rgba(255,255,255,0.08)',
        borderRadius:24,padding:28,width:'min(460px,94vw)',backdropFilter:'blur(20px)',
      }}>
        {/* XP bar */}
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
          <span style={{fontFamily:"'Unbounded',sans-serif",fontSize:12,fontWeight:700,color:'#00ffd0'}}>LVL {lvl}</span>
          <span style={{fontSize:9,letterSpacing:3,color:'rgba(255,255,255,0.35)',textTransform:'uppercase'}}>PROGRESSION</span>
        </div>
        <div style={{height:7,background:'rgba(255,255,255,0.06)',borderRadius:99,overflow:'hidden',marginBottom:4}}>
          <div style={{height:'100%',borderRadius:99,background:'linear-gradient(90deg,#7c3aed,#00ffd0)',width:`${pct}%`,transition:'width .6s'}}/>
        </div>
        <div style={{fontSize:9,color:'rgba(255,255,255,0.35)',textAlign:'right',marginBottom:14}}>{xpIn} / {xpNeeded} XP</div>

        {/* Name input */}
        <label style={{fontSize:9,letterSpacing:3,color:'rgba(255,255,255,0.35)',textTransform:'uppercase',marginBottom:6,display:'block'}}>Your Name</label>
        <input ref={nameRef} maxLength={16} placeholder="Enter blob name..."
          onKeyDown={e=>e.key==='Enter'&&handlePlay()}
          style={{
            background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',
            borderRadius:12,padding:'11px 16px',color:'#fff',fontFamily:"'Space Mono',monospace",
            fontSize:14,outline:'none',width:'100%',marginBottom:16,
          }}
          onFocus={e=>{e.target.style.borderColor='#00ffd0';e.target.style.boxShadow='0 0 0 3px rgba(0,255,208,0.1)';}}
          onBlur={e=>{e.target.style.borderColor='rgba(255,255,255,0.08)';e.target.style.boxShadow='none';}}
        />

        {/* Skin preview */}
        <label style={{fontSize:9,letterSpacing:3,color:'rgba(255,255,255,0.35)',textTransform:'uppercase',marginBottom:6,display:'block'}}>Active Skin</label>
        <div onClick={onOpenSkins} style={{
          display:'flex',alignItems:'center',gap:12,marginBottom:16,cursor:'pointer',
          padding:'10px 12px',borderRadius:14,border:'1px solid rgba(255,255,255,0.08)',
          transition:'all .2s',
        }}
          onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.borderColor='rgba(0,255,208,.3)';(e.currentTarget as HTMLDivElement).style.background='rgba(0,255,208,.03)';}}
          onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.borderColor='rgba(255,255,255,0.08)';(e.currentTarget as HTMLDivElement).style.background='transparent';}}
        >
          <SkinCanvas skinId={save.selectedSkin} size={46}/>
          <div style={{flex:1}}>
            <div style={{fontSize:12,fontWeight:700,color:'#fff'}}>{SKINS[save.selectedSkin]?.name}</div>
            <div style={{fontSize:9,color:'rgba(255,255,255,0.35)',letterSpacing:2,textTransform:'uppercase',marginTop:2}}>{SKINS[save.selectedSkin]?.category}</div>
          </div>
          <span style={{color:'rgba(255,255,255,0.35)',fontSize:18}}>›</span>
        </div>

        {/* Map grid */}
        <label style={{fontSize:9,letterSpacing:3,color:'rgba(255,255,255,0.35)',textTransform:'uppercase',marginBottom:8,display:'block'}}>Select Map</label>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:16}}>
          {MAPS.map(map=>{
            const unlocked = save.unlockedMaps.includes(map.id);
            const active = save.selectedMap === map.id;
            return (
              <div key={map.id} onClick={()=>unlocked&&onSelectMap(map.id)}
                style={{
                  border:`2px solid ${active?'#00ffd0':'rgba(255,255,255,0.08)'}`,
                  borderRadius:12,padding:'10px 6px',cursor:unlocked?'pointer':'not-allowed',
                  textAlign:'center',position:'relative',
                  background:active?'rgba(0,255,208,.07)':'transparent',
                  opacity:unlocked?1:0.45,transition:'all .2s',
                }}>
                <span style={{fontSize:22,display:'block',marginBottom:4}}>{map.emoji}</span>
                <div style={{fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.85)'}}>{map.name}</div>
                <div style={{fontSize:7,color:'rgba(255,255,255,0.35)',marginTop:2}}>{map.xpReq===0?'Starter':`${map.xpReq} XP`}</div>
                {!unlocked&&<span style={{position:'absolute',top:4,right:4,fontSize:10}}>🔒</span>}
              </div>
            );
          })}
        </div>

        {/* Play button */}
        <button onClick={handlePlay} style={{
          width:'100%',background:'#00ffd0',border:'none',borderRadius:14,padding:16,
          color:'#000',fontFamily:"'Unbounded',sans-serif",fontSize:15,fontWeight:900,
          cursor:'pointer',letterSpacing:1,textTransform:'uppercase',marginBottom:14,
          position:'relative',overflow:'hidden',
        }}
          onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.transform='translateY(-2px)';(e.currentTarget as HTMLButtonElement).style.boxShadow='0 12px 40px rgba(0,255,208,.35)';}}
          onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.transform='';(e.currentTarget as HTMLButtonElement).style.boxShadow='';}}
        >▶ &nbsp;PLAY</button>

        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
          {[['Games',save.games],['Best Mass',Math.floor(save.bestMass)],['Skins',save.unlockedSkins.length]].map(([lbl,val])=>(
            <div key={lbl as string} style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,padding:'10px 6px',textAlign:'center'}}>
              <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:14,fontWeight:700,color:'#fff'}}>{val}</div>
              <div style={{fontSize:8,letterSpacing:2,color:'rgba(255,255,255,0.35)',marginTop:3,textTransform:'uppercase'}}>{lbl}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
