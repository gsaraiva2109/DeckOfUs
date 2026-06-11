import { Volume2, VolumeX } from 'lucide-react'
import CardStack from './CardStack'
import type { DeckConfig, CardConfig, PaletteEntry, Nivel } from '../types'

interface Props {
  cfg: DeckConfig
  pal: PaletteEntry
  level: Nivel
  card: CardConfig
  cardKey: number
  flipped: boolean
  muted: boolean
  onFlip: () => void
  onNext: () => void
  onToggleMute: () => void
}

export default function LevelScreen({ cfg, pal, level, card, cardKey, flipped, muted, onFlip, onNext, onToggleMute }: Props) {
  const P = cfg.pessoa
  const V = cfg.voce

  return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', animation:'dou-screen .5s ease forwards' }}>
      {/* top bar */}
      <div style={{ padding:'26px 26px 6px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
          <span style={{ width:9, height:9, borderRadius:'50%', background:pal.accent, boxShadow:`0 0 12px ${pal.accent}`, flexShrink:0 }}></span>
          <span style={{ fontFamily:"'Instrument Serif',serif", fontStyle:'italic', fontSize:24, color:pal.levelText }}>{level.nome}</span>
        </div>
        <div
          onClick={onToggleMute}
          style={{ cursor:'pointer', width:38, height:38, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,.14)', color:pal.levelText }}
        >
          {muted
            ? <VolumeX size={16} />
            : <Volume2 size={16} />
          }
        </div>
      </div>

      <CardStack
        key={cardKey}
        card={card}
        pal={pal}
        levelName={level.nome}
        flipped={flipped}
        P={P}
        V={V}
        onFlip={onFlip}
        onNext={onNext}
      />

      {/* bottom controls */}
      <div style={{ padding:'0 26px 38px', display:'flex', alignItems:'center', justifyContent:'center', gap:14 }}>
        <div
          onClick={onFlip}
          className="btn-press"
          style={{ cursor:'pointer', fontWeight:600, fontSize:14, color:pal.levelText, border:'1.5px solid rgba(255,255,255,.3)', padding:'12px 22px', borderRadius:99 }}
        >
          Virar
        </div>
        <div
          onClick={onNext}
          className="btn-press"
          style={{ cursor:'pointer', fontWeight:700, fontSize:14, color:'#3B1020', background:'#fff', padding:'13px 26px', borderRadius:99, boxShadow:'0 12px 26px -12px rgba(0,0,0,.4)', display:'flex', alignItems:'center', gap:6 }}
        >
          Próxima
        </div>
      </div>
    </div>
  )
}
