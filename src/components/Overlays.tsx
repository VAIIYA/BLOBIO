'use client';

export interface ToastItem { id: number; msg: string; color?: string; }
export interface XPPopItem { id: number; x: number; y: number; amount: number; }
export interface BannerItem { id: number; type: 'levelup'; level: number; }
export interface UnlockItem { id: number; skinName: string; skinId: number; }

interface Props {
  toasts: ToastItem[];
  xpPops: XPPopItem[];
  banners: BannerItem[];
  unlocks: UnlockItem[];
}

export default function Overlays({ toasts, xpPops, banners, unlocks }: Props) {
  return (
    <>
      {xpPops.map(p => (
        <div key={p.id} style={{
          position:'fixed',left:p.x,top:p.y,pointerEvents:'none',
          fontFamily:"'Unbounded',sans-serif",fontSize:12,fontWeight:700,
          color:'#00ffd0',textShadow:'0 0 16px rgba(0,255,208,.5)',zIndex:60,
          animation:'xpFloat 1s ease forwards',
        }}>+{p.amount} XP</div>
      ))}

      {banners.map(b => (
        <div key={b.id} style={{
          position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',
          zIndex:70,pointerEvents:'none',textAlign:'center',
          animation:'lvlAnim 2.5s ease forwards',
        }}>
          <h2 style={{
            fontFamily:"'Unbounded',sans-serif",fontSize:'clamp(28px,5vw,46px)',fontWeight:900,
            background:'linear-gradient(135deg,#fbbf24,#fff,#00ffd0)',
            WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',
            filter:'drop-shadow(0 0 30px rgba(251,191,36,.5))',
          }}>LEVEL {b.level}!</h2>
          <p style={{fontSize:11,color:'rgba(255,255,255,0.35)',marginTop:5,letterSpacing:3}}>Keep devouring</p>
        </div>
      ))}

      {unlocks.map(u => (
        <div key={u.id} style={{
          position:'fixed',top:80,left:'50%',transform:'translateX(-50%)',zIndex:70,
          pointerEvents:'none',background:'rgba(7,8,15,.95)',
          border:'1px solid rgba(0,255,208,.3)',borderRadius:14,padding:'12px 20px',
          display:'flex',alignItems:'center',gap:12,
          animation:'unlockSlide 3s ease forwards',
        }}>
          <div style={{fontSize:26}}>🎨</div>
          <div>
            <div style={{fontSize:8,letterSpacing:2,color:'#fbbf24',textTransform:'uppercase'}}>🔓 Skin Unlocked!</div>
            <div style={{fontSize:13,fontWeight:700,color:'#fff'}}>{u.skinName}</div>
          </div>
        </div>
      ))}

      <div style={{position:'fixed',bottom:70,left:'50%',transform:'translateX(-50%)',zIndex:80,display:'flex',flexDirection:'column',gap:6,pointerEvents:'none'}}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background:'rgba(13,15,28,.97)',border:`1px solid ${t.color||'rgba(255,255,255,0.08)'}`,
            borderRadius:10,padding:'9px 18px',fontSize:11,color:'#fff',
            backdropFilter:'blur(16px)',animation:'toastIn .3s ease',whiteSpace:'nowrap',
          }} dangerouslySetInnerHTML={{__html:t.msg}}/>
        ))}
      </div>

      <style>{`
        @keyframes xpFloat{0%{opacity:1;transform:translateY(0)scale(1);}100%{opacity:0;transform:translateY(-50px)scale(.8);}}
        @keyframes lvlAnim{0%{opacity:0;transform:translate(-50%,-50%)scale(.5);}15%{opacity:1;transform:translate(-50%,-50%)scale(1.05);}20%{transform:translate(-50%,-50%)scale(1);}80%{opacity:1;}100%{opacity:0;transform:translate(-50%,-60%);}}
        @keyframes unlockSlide{0%{opacity:0;transform:translateX(-50%)translateY(-20px);}10%{opacity:1;transform:translateX(-50%)translateY(0);}80%{opacity:1;}100%{opacity:0;}}
        @keyframes toastIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
      `}</style>
    </>
  );
}
