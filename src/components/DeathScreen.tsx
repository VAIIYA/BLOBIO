'use client';
import { useEffect, useState } from 'react';
import { SaveData, currentLevel, xpIntoLevel, xpForLevel } from '@/lib/persistence';
import SkinCanvas from './SkinCanvas';
import { SKINS } from '@/lib/skins';

interface Stats { peakMass: number; elapsed: number; kills: number; sessionXP: number; }

interface Props {
  stats: Stats;
  save: SaveData;
  prevUnlockedCount: number;
  onRespawn: () => void;
  onMenu: () => void;
}

export default function DeathScreen({ stats, save, prevUnlockedCount, onRespawn, onMenu }: Props) {
  const [xpBarWidth, setXpBarWidth] = useState(0);
  const lvl = currentLevel(save.xp);
  const xpIn = xpIntoLevel(save.xp);
  const xpNeeded = xpForLevel(lvl);

  useEffect(() => {
    const t = setTimeout(() => setXpBarWidth(xpNeeded > 0 ? (xpIn / xpNeeded) * 100 : 0), 400);
    return () => clearTimeout(t);
  }, []);

  const newUnlock = save.unlockedSkins.length > prevUnlockedCount
    ? SKINS[save.unlockedSkins[save.unlockedSkins.length - 1]]
    : null;

  return (
    <div style={{
      position:'fixed',inset:0,background:'rgba(0,0,0,.88)',backdropFilter:'blur(20px)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,
    }}>
      <div style={{
        background:'rgba(7,8,15,.95)',border:'1px solid rgba(255,255,255,0.08)',
        borderRadius:22,padding:'36px 32px',width:'min(420px,92vw)',textAlign:'center',
      }}>
        <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:'clamp(32px,6vw,52px)',fontWeight:900,color:'#ff2d55',letterSpacing:-2,marginBottom:2}}>DEVOURED</div>
        <div style={{fontSize:10,letterSpacing:4,color:'rgba(255,255,255,0.35)',marginBottom:22,textTransform:'uppercase'}}>You have been consumed</div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:18}}>
          {[['Peak Mass',Math.floor(stats.peakMass)],['Survived',`${stats.elapsed}s`],['Kills',stats.kills]].map(([lbl,val])=>(
            <div key={lbl as string} style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,padding:'12px 6px'}}>
              <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:18,fontWeight:700,color:'#fff'}}>{val}</div>
              <div style={{fontSize:8,letterSpacing:2,color:'rgba(255,255,255,0.35)',marginTop:3,textTransform:'uppercase'}}>{lbl}</div>
            </div>
          ))}
        </div>

        {/* XP earned */}
        <div style={{background:'rgba(0,255,208,.06)',border:'1px solid rgba(0,255,208,.2)',borderRadius:12,padding:14,marginBottom:18}}>
          <div style={{fontSize:9,letterSpacing:3,color:'#00ffd0',textTransform:'uppercase',marginBottom:4}}>XP Earned This Round</div>
          <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:26,fontWeight:900,color:'#00ffd0'}}>+{stats.sessionXP}</div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:8,color:'rgba(255,255,255,0.35)',marginTop:8,marginBottom:3}}>
            <span>0</span><span>LVL {lvl}</span><span>{xpNeeded}</span>
          </div>
          <div style={{height:5,background:'rgba(255,255,255,.06)',borderRadius:99,overflow:'hidden'}}>
            <div style={{height:'100%',background:'linear-gradient(90deg,#7c3aed,#00ffd0)',borderRadius:99,width:`${xpBarWidth}%`,transition:'width 1s cubic-bezier(.22,1,.36,1)'}}/>
          </div>
        </div>

        {/* Unlock */}
        {newUnlock && (
          <div style={{background:'rgba(251,191,36,.07)',border:'1px solid rgba(251,191,36,.25)',borderRadius:10,padding:'10px 14px',marginBottom:14,display:'flex',alignItems:'center',gap:10}}>
            <SkinCanvas skinId={newUnlock.id} size={40}/>
            <div>
              <div style={{fontSize:8,letterSpacing:2,color:'#fbbf24',textTransform:'uppercase'}}>🔓 Unlocked!</div>
              <div style={{fontSize:12,fontWeight:700,color:'#fff'}}>{newUnlock.name}</div>
            </div>
          </div>
        )}

        <div style={{display:'flex',gap:8}}>
          <button onClick={onRespawn} style={{
            flex:1,background:'#ff2d55',border:'none',borderRadius:12,padding:14,
            color:'#fff',fontFamily:"'Unbounded',sans-serif",fontSize:13,fontWeight:700,
            cursor:'pointer',
          }}
            onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.transform='translateY(-2px)';(e.currentTarget as HTMLButtonElement).style.boxShadow='0 8px 28px rgba(255,45,85,.35)';}}
            onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.transform='';(e.currentTarget as HTMLButtonElement).style.boxShadow='';}}
          >↩ Respawn</button>
          <button onClick={onMenu} style={{
            background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,0.08)',
            borderRadius:12,padding:'14px 18px',color:'rgba(255,255,255,0.35)',
            fontFamily:"'Space Mono',monospace",fontSize:11,cursor:'pointer',
          }}>Menu</button>
        </div>
      </div>
    </div>
  );
}
