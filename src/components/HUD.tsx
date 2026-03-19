'use client';
import { GameEngine } from '@/lib/engine';

interface Props { engine: GameEngine; }

export default function HUD({ engine }: Props) {
  const total = engine.playerTotalMass();
  const lb = engine.leaderboard();
  const myRank = lb.findIndex(e => e.me) + 1;
  const lvl = engine.currentLevel();
  const xpIn = engine.xpIntoLevel();
  const xpNeeded = engine.xpForLevel(lvl);
  const pct = xpNeeded > 0 ? (xpIn / xpNeeded) * 100 : 0;

  return (
    <div style={{ position:'fixed',inset:0,pointerEvents:'none',zIndex:20 }}>
      {/* Top pill */}
      <div style={{ position:'absolute',top:0,left:0,right:0,display:'flex',justifyContent:'center',padding:12 }}>
        <div style={{
          display:'flex',alignItems:'center',gap:16,
          background:'rgba(7,8,15,.8)',border:'1px solid rgba(255,255,255,0.08)',
          borderRadius:99,padding:'7px 22px',backdropFilter:'blur(16px)',
        }}>
          {([['Mass',Math.floor(total),'#00ffd0'],['Rank',`#${myRank}`,'#00ffd0'],['Cells',engine.player?.cells.length??0,'#00ffd0'],['XP',engine.save.xp,'#fbbf24']] as const).map(([lbl,val,col],i)=>(
            <div key={lbl} style={{display:'flex',alignItems:'center',gap:i>0?16:0}}>
              {i>0&&<div style={{width:1,height:26,background:'rgba(255,255,255,0.08)'}}/>}
              <div style={{textAlign:'center'}}>
                <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:16,fontWeight:700,color:col,lineHeight:1}}>{val}</div>
                <div style={{fontSize:7,letterSpacing:2,color:'rgba(255,255,255,0.35)',marginTop:1,textTransform:'uppercase'}}>{lbl}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Map name */}
      <div style={{ position:'absolute',top:70,left:'50%',transform:'translateX(-50%)',fontSize:9,letterSpacing:4,color:'rgba(255,255,255,.25)',textTransform:'uppercase',pointerEvents:'none' }}>
        {engine.activeMap.name}
      </div>

      {/* Leaderboard */}
      <div style={{
        position:'absolute',top:12,right:12,
        background:'rgba(7,8,15,.85)',border:'1px solid rgba(255,255,255,0.08)',
        borderRadius:16,padding:'12px 14px',minWidth:170,backdropFilter:'blur(16px)',
      }}>
        <div style={{fontSize:8,letterSpacing:3,color:'#fbbf24',marginBottom:9,textTransform:'uppercase'}}>⚡ Leaderboard</div>
        {lb.slice(0,10).map((e,i)=>(
          <div key={i} style={{display:'flex',gap:5,alignItems:'center',padding:'2px 0',borderBottom:'1px solid rgba(255,255,255,.03)',fontSize:9}}>
            <span style={{color:'rgba(255,255,255,0.35)',width:14,flexShrink:0,fontSize:8}}>{i===0?'👑':i===1?'🥈':i===2?'🥉':i+1}</span>
            <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:e.me?'#00ffd0':'rgba(255,255,255,0.85)',fontWeight:e.me?700:400}}>{e.name}</span>
            <span style={{color:'rgba(255,255,255,0.35)',fontSize:8}}>{Math.floor(e.mass)}</span>
          </div>
        ))}
      </div>

      {/* Controls hint */}
      <div style={{
        position:'absolute',bottom:12,left:12,
        background:'rgba(7,8,15,.7)',border:'1px solid rgba(255,255,255,0.08)',
        borderRadius:10,padding:'8px 12px',fontSize:8,color:'rgba(255,255,255,0.35)',
        lineHeight:2,backdropFilter:'blur(12px)',
      }}>
        <span style={{color:'rgba(255,255,255,.6)'}}>MOUSE</span> — move<br/>
        <span style={{color:'rgba(255,255,255,.6)'}}>SPACE</span> — split<br/>
        <span style={{color:'rgba(255,255,255,.6)'}}>W</span> — eject mass<br/>
        <span style={{color:'rgba(255,255,255,.6)'}}>Q</span> — force merge
      </div>

      {/* XP bar bottom */}
      <div style={{ position:'absolute',bottom:0,left:0,right:0,height:3,background:'rgba(255,255,255,.04)' }}>
        <div style={{ height:'100%',background:'linear-gradient(90deg,#7c3aed,#00ffd0)',width:`${pct}%`,transition:'width .4s' }}/>
      </div>
    </div>
  );
}
