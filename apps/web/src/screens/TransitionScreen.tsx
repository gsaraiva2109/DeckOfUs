interface Props {
  transTo: number
  transTitle: string
  transPhrase: string
  onEnter: () => void
}

export default function TransitionScreen({ transTo, transTitle, transPhrase, onEnter }: Props) {
  const isA = transTo === 2
  const isB = transTo === 3

  return (
    <div onClick={onEnter} style={{ position:'absolute', inset:0, cursor:'pointer', animation:'dou-screen .4s ease forwards' }}>
      {isA && (
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(165deg,#E84393,#BE2C76 60%,#7A1535)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ position:'absolute', width:300, height:300, borderRadius:'50%', border:'2px solid rgba(255,255,255,.4)', animation:'dou-ring 3s ease-out infinite' }}></div>
          <div style={{ position:'absolute', width:300, height:300, borderRadius:'50%', border:'2px solid rgba(255,255,255,.4)', animation:'dou-ring 3s ease-out 1s infinite' }}></div>
          <div style={{ position:'absolute', width:300, height:300, borderRadius:'50%', border:'2px solid rgba(255,255,255,.4)', animation:'dou-ring 3s ease-out 2s infinite' }}></div>
          <div style={{ position:'relative', textAlign:'center', padding:'0 36px' }}>
            <div style={{ fontWeight:600, fontSize:11, letterSpacing:'.28em', textTransform:'uppercase', color:'#FFD9E2', animation:'dou-rise .7s ease forwards' }}>Nível 2</div>
            <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontSize:62, lineHeight:.95, color:'#fff', margin:'8px 0 0', textShadow:'0 4px 24px rgba(120,20,60,.5)', animation:'dou-pop .8s ease .1s forwards' }}>{transTitle}</div>
            <p style={{ fontSize:15, lineHeight:1.5, color:'#FFE0EA', margin:'18px 0 0', animation:'dou-rise .7s ease .3s forwards' }}>{transPhrase}</p>
            <div style={{ marginTop:30, fontSize:11, letterSpacing:'.18em', textTransform:'uppercase', color:'rgba(255,255,255,.6)', animation:'dou-rise .7s ease .5s forwards' }}>toque para continuar</div>
          </div>
        </div>
      )}

      {isB && (
        <div style={{ position:'absolute', inset:0, overflow:'hidden', background:'linear-gradient(180deg,#9E1E5C 0%,#5E1233 55%,#33112A 100%)' }}>
          <div style={{ position:'absolute', inset:0, zIndex:1, background:'linear-gradient(180deg,#FF93A8,#E84393 60%,#BE2C76)', animation:'dou-curtain 1.5s cubic-bezier(.7,0,.2,1) .2s forwards' }}></div>
          <div style={{ position:'absolute', inset:0, zIndex:2, display:'flex', alignItems:'center', justifyContent:'center', color:'#FFE3D2' }}>
            <div style={{ position:'absolute', fontFamily:'var(--font-display)', fontStyle:'italic', fontSize:230, lineHeight:.8, color:'rgba(255,255,255,.1)', animation:'dou-bignum 1s ease 1s forwards' }}>3</div>
            <div style={{ position:'relative', textAlign:'center', padding:'0 36px', animation:'dou-rise .8s ease 1.1s forwards' }}>
              <div style={{ fontWeight:600, fontSize:11, letterSpacing:'.28em', textTransform:'uppercase', color:'#FFD9E2' }}>Último nível</div>
              <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontSize:58, lineHeight:.95, color:'#fff', margin:'8px 0 0', textShadow:'0 3px 18px rgba(80,10,40,.6)' }}>{transTitle}</div>
              <p style={{ fontSize:15, lineHeight:1.5, color:'#FFE0EA', margin:'16px 0 0' }}>{transPhrase}</p>
              <div style={{ marginTop:28, fontSize:11, letterSpacing:'.18em', textTransform:'uppercase', color:'rgba(255,255,255,.6)' }}>toque para continuar</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
