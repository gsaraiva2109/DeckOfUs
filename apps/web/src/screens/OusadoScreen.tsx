import { Heart } from 'lucide-react'
import type { DeckConfig } from '../types'
import { useSession } from '../lib/session'

interface Props {
  cfg: DeckConfig
}

export default function OusadoScreen({ cfg }: Props) {
  const ous = cfg.modo_ousado?.ativacao
  const { hasSession, presence } = useSession()
  const connected = presence.count >= 2
  const presenceLabel = !hasSession
    ? 'modo ousado liberado'
    : connected
    ? 'conectado nos 2 dispositivos'
    : 'aguardando o outro dispositivo…'

  return (
    <div style={{
      position:'absolute', inset:0,
      background:'radial-gradient(120% 80% at 50% 42%,#3A0A1E 0%,#1A0410 60%,#0A0208 100%)',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding:'34px 30px', textAlign:'center',
      animation:'dou-screen .6s ease forwards',
    }}>
      <div style={{ position:'absolute', width:340, height:340, borderRadius:'50%', background:'radial-gradient(circle,rgba(255,51,95,.5),transparent 62%)', animation:'dou-glow 1.4s ease-in-out infinite' }}></div>

      <div style={{ position:'relative', color:'#FF335F', filter:'drop-shadow(0 0 26px rgba(255,51,95,.7))', animation:'dou-heartbeat 1.3s ease-in-out infinite' }}>
        <Heart size={70} fill="#FF335F" />
      </div>

      <div style={{ position:'relative', fontWeight:600, fontSize:11, letterSpacing:'.3em', textTransform:'uppercase', color:'#FF7E9D', marginTop:28, animation:'dou-rise .7s ease .2s forwards' }}>
        {ous.kicker}
      </div>
      <div style={{ position:'relative', fontFamily:'var(--font-display)', fontStyle:'italic', fontSize:42, lineHeight:1.0, color:'#fff', margin:'8px 0 0', animation:'dou-pop .8s ease .3s forwards' }}>
        {ous.titulo}
      </div>
      <p style={{ position:'relative', fontSize:14, lineHeight:1.55, color:'#E7A9B8', margin:'18px 0 0', maxWidth:300, animation:'dou-rise .7s ease .4s forwards' }}>
        {ous.frase}
      </p>
      <div style={{ position:'relative', marginTop:26, display:'flex', alignItems:'center', gap:8, color:'#C98699', fontSize:11, animation:'dou-rise .7s ease .55s forwards' }}>
        <span style={{ width:7, height:7, borderRadius:'50%', background: connected || !hasSession ? '#3DDC84' : '#FF335F', animation:'dou-glow 1s ease-in-out infinite', flexShrink:0 }}></span>
        {presenceLabel}
      </div>
    </div>
  )
}
