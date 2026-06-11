import type { DeckConfig } from '../types'

interface Props {
  cfg: DeckConfig
  onStart: () => void
}

const PT_LEVELS: Record<number, string> = {
  1: 'um nível',
  2: 'dois níveis',
  3: 'três níveis',
  4: 'quatro níveis',
  5: 'cinco níveis',
}

export default function IntroScreen({ cfg, onStart }: Props) {
  const { kicker, titulo, subtitulo, botao } = cfg.intro

  // visible levels = total minus the secret one (last level)
  const visibleLevels = Math.max(1, cfg.niveis.length - 1)
  const levelStr = PT_LEVELS[visibleLevels] ?? `${visibleLevels} níveis`
  const dynamicSub = `${levelStr.charAt(0).toUpperCase() + levelStr.slice(1)} de conversa, do leve ao profundo. ${subtitulo}`

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(200deg,#2B0E1B 0%,#7A1535 60%,#BE2C76 100%)',
      display: 'flex', flexDirection: 'column',
      animation: 'dou-screen .6s ease forwards',
    }}>
      <span style={{ position:'absolute',left:'14%',top:'12%',color:'#fff',fontSize:16,opacity:.5,animation:'dou-floaty 5s ease-in-out infinite' }}>✦</span>
      <span style={{ position:'absolute',left:'82%',top:'22%',color:'#fff',fontSize:12,opacity:.45,animation:'dou-floaty 6.5s ease-in-out infinite .8s' }}>✦</span>

      {/* floating deck */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
        <div style={{ position:'relative', width:190, height:270, animation:'dou-floaty 5.5s ease-in-out infinite' }}>
          <div style={{ position:'absolute', inset:0, borderRadius:24, background:'linear-gradient(155deg,#9E1E5C,#33112A)', transform:'rotate(-13deg) translateY(8px)', boxShadow:'0 18px 34px -16px #000' }}></div>
          <div style={{ position:'absolute', inset:0, borderRadius:24, background:'linear-gradient(155deg,#FF93A8,#E84393)', transform:'rotate(-3deg) translateY(2px)', boxShadow:'0 18px 34px -16px rgba(0,0,0,.5)' }}></div>
          <div style={{ position:'absolute', inset:0, borderRadius:24, background:'linear-gradient(155deg,#FFD9A0,#FF7E6B)', transform:'rotate(7deg)', boxShadow:'0 22px 42px -14px rgba(0,0,0,.55)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontSize:52, color:'#fff' }}>✷</span>
          </div>
        </div>
      </div>

      {/* copy + cta */}
      <div style={{ padding:'0 34px 56px', textAlign:'center' }}>
        <div style={{ opacity:0, fontWeight:600, fontSize:11, letterSpacing:'.24em', textTransform:'uppercase', color:'#FFB7C8', animation:'dou-rise .7s ease forwards' }}>
          {kicker}
        </div>
        <h1 style={{ opacity:0, fontFamily:'var(--font-body)', fontWeight:800, fontSize:46, lineHeight:.98, margin:'10px 0 0', color:'#FFF1E6', letterSpacing:'-.025em', animation:'dou-rise .7s ease .1s forwards' }}>
          {titulo}
        </h1>
        <p style={{ opacity:0, fontSize:15, lineHeight:1.55, color:'#FFC9D6', margin:'14px 0 26px', animation:'dou-rise .7s ease .2s forwards' }}>
          {dynamicSub}
        </p>
        <div
          onClick={onStart}
          className="btn-press"
          style={{ opacity:0, cursor:'pointer', background:'linear-gradient(90deg,#FFB23E,#FF5E7E)', color:'#3B1020', fontWeight:700, fontSize:17, padding:'17px 0', borderRadius:99, boxShadow:'0 16px 34px -12px rgba(255,94,126,.7)', animation:'dou-rise .7s ease .3s forwards' }}
        >
          {botao}
        </div>
      </div>
    </div>
  )
}
