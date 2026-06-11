import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Timer } from 'lucide-react'
import type { CardConfig, PaletteEntry } from '../types'

const TYPE_LABELS: Record<string, string> = {
  pros_dois: 'Pros dois',
  trocada: 'Trocada ⇄',
  voce_prefere: 'Você prefere',
  mini_desafio: 'Mini-desafio',
}

interface Props {
  card: CardConfig
  pal: PaletteEntry
  levelName: string
  flipped: boolean
  P: string
  V: string
  onFlip: () => void
  onNext: () => void
}

export default function CardStack({ card, pal, levelName, flipped, P, V, onFlip, onNext }: Props) {
  const startRef = useRef({ x: 0, y: 0 })
  const dragRef = useRef({ active: false, dx: 0, dy: 0 })
  const cardWrapRef = useRef<HTMLDivElement>(null)
  const [swipeHint, setSwipeHint] = useState(0)

  const tipo = card?.tipo || ''
  let trocadaLabel = ''
  if (tipo === 'trocada') {
    const asker = card.de === 'voce' ? V : P
    const askee = card.para === 'voce' ? V : P
    trocadaLabel = `${asker}, pergunta para ${askee}:`
  }

  function onDown(e: React.PointerEvent) {
    startRef.current = { x: e.clientX, y: e.clientY }
    dragRef.current = { active: true, dx: 0, dy: 0 }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch (_) {}
    if (cardWrapRef.current) {
      cardWrapRef.current.style.transition = 'none'
      cardWrapRef.current.style.transform = 'translate(0px,0px) rotate(0deg)'
    }
  }

  function onMove(e: React.PointerEvent) {
    if (!dragRef.current.active) return
    const dx = e.clientX - startRef.current.x
    const dy = e.clientY - startRef.current.y
    dragRef.current = { active: true, dx, dy }
    if (cardWrapRef.current) {
      cardWrapRef.current.style.transform = `translate(${dx}px,${dy * 0.45}px) rotate(${dx * 0.04}deg)`
    }
    const progress = Math.min(1, Math.abs(dx) / 110)
    setSwipeHint(dx > 0 ? progress : -progress)
  }

  function onUp() {
    if (!dragRef.current.active) return
    const { dx, dy } = dragRef.current
    const moved = Math.hypot(dx, dy)
    dragRef.current = { active: false, dx: 0, dy: 0 }
    setSwipeHint(0)

    if (Math.abs(dx) > 110) {
      if (cardWrapRef.current) {
        cardWrapRef.current.style.transition = 'transform .4s cubic-bezier(.22,.9,.24,1)'
        cardWrapRef.current.style.transform = `translate(${dx > 0 ? 500 : -500}px,40px) rotate(${dx > 0 ? 20 : -20}deg)`
      }
      setTimeout(onNext, 350)
    } else if (moved < 8) {
      onFlip()
      if (cardWrapRef.current) {
        cardWrapRef.current.style.transition = 'transform .55s cubic-bezier(.22,.9,.24,1)'
        cardWrapRef.current.style.transform = 'translate(0px,0px) rotate(0deg)'
      }
    } else {
      if (cardWrapRef.current) {
        cardWrapRef.current.style.transition = 'transform .55s cubic-bezier(.22,.9,.24,1)'
        cardWrapRef.current.style.transform = 'translate(0px,0px) rotate(0deg)'
      }
    }
  }

  const chipStyle: React.CSSProperties = {
    fontWeight: 700, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase',
    color: '#fff', background: pal.accent, padding: '4px 11px', borderRadius: 99,
  }

  const faceBase: React.CSSProperties = {
    position: 'absolute', inset: 0, borderRadius: 26,
    backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 26px 50px -22px rgba(0,0,0,.55)',
  }

  const hintOpacity = Math.abs(swipeHint)
  const hintLabel = swipeHint > 0.15 ? '→ próxima' : swipeHint < -0.15 ? '← próxima' : ''

  return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <motion.div
        initial={{ opacity: 0, y: 54, scale: 0.86, rotate: -5 }}
        animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26, mass: 0.9 }}
        style={{ position:'relative', width:'min(80vw,318px)', height:'min(60dvh,452px)', touchAction:'none', userSelect:'none' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        {/* ghost cards */}
        <div style={{ position:'absolute', inset:0, transform:'translateY(22px) scale(.9)', background:'rgba(255,255,255,.28)', borderRadius:26 }}></div>
        <div style={{ position:'absolute', inset:0, transform:'translateY(11px) scale(.95)', background:'rgba(255,255,255,.5)', borderRadius:26 }}></div>

        {/* swipe direction overlay */}
        {hintLabel && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 20,
            borderRadius: 26, pointerEvents: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: swipeHint > 0
              ? `rgba(255,94,126,${hintOpacity * 0.18})`
              : `rgba(190,44,118,${hintOpacity * 0.18})`,
          }}>
            <span style={{ fontWeight:800, fontSize:15, letterSpacing:'.14em', textTransform:'uppercase', color:'#fff', opacity:hintOpacity, textShadow:'0 2px 10px rgba(0,0,0,.4)' }}>
              {hintLabel}
            </span>
          </div>
        )}

        {/* main card */}
        <div style={{ position:'absolute', inset:0, perspective:1400 }}>
          <div ref={cardWrapRef} style={{ width:'100%', height:'100%', position:'relative', cursor:'grab', touchAction:'none' }}>
            <div style={{
              width: '100%', height: '100%', position: 'relative',
              transformStyle: 'preserve-3d',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              transition: 'transform .6s cubic-bezier(.4,.1,.2,1)',
            }}>
              {/* FRONT */}
              <div style={{ ...faceBase, background: pal.grad, alignItems:'center', justifyContent:'center', padding:24, textAlign:'center' }}>
                <div style={{ width:64, height:64, borderRadius:'50%', border:'1.5px solid rgba(255,255,255,.55)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontStyle:'normal', fontSize:28, lineHeight:1, color:'#fff' }}>✷</div>
                <div style={{ fontFamily:'var(--font-level-splash)', fontStyle:'var(--level-splash-style)', fontSize:30, color:'#fff', marginTop:18 }}>{levelName}</div>
                <div style={{ fontSize:11, letterSpacing:'.18em', textTransform:'uppercase', color:'rgba(255,255,255,.85)', marginTop:12, animation:'dou-hint 2s ease-in-out infinite' }}>toque para virar</div>
              </div>

              {/* BACK */}
              <div style={{ ...faceBase, background:'#FFF7EE', transform:'rotateY(180deg)', border:`1.5px solid ${pal.accent}`, justifyContent:'space-between', padding:'22px 22px 20px', textAlign:'left' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={chipStyle}>{TYPE_LABELS[tipo] ?? ''}</span>
                  <span style={{ fontSize:10, letterSpacing:'.16em', textTransform:'uppercase', color:'#C0A48F' }}>{levelName}</span>
                </div>

                <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center' }}>
                  {tipo === 'pros_dois' && (
                    <div style={{ fontFamily:"'Cormorant Garamond', serif", fontStyle:'normal', fontSize:29, lineHeight:1.16, color:'#3B1020' }}>{card.texto}</div>
                  )}
                  {tipo === 'trocada' && (
                    <div>
                      <div style={{ fontWeight:600, fontSize:13, color:pal.accent, marginBottom:8 }}>{trocadaLabel}</div>
                      <div style={{ fontFamily:"'Cormorant Garamond', serif", fontStyle:'normal', fontSize:27, lineHeight:1.16, color:'#3B1020' }}>{card.texto}</div>
                    </div>
                  )}
                  {tipo === 'voce_prefere' && (
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      <div style={{ background:'linear-gradient(150deg,#FFE7C2,#FF9E5E)', borderRadius:16, padding:16, textAlign:'center', fontFamily:"'Cormorant Garamond', serif", fontStyle:'normal', fontSize:21, color:'#5A2A10', lineHeight:1.15 }}>{card.a}</div>
                      <div style={{ textAlign:'center', fontWeight:800, fontSize:13, color:'#B0552F', margin:'-4px 0' }}>ou</div>
                      <div style={{ background:'linear-gradient(150deg,#FF93A8,#E84393)', borderRadius:16, padding:16, textAlign:'center', fontFamily:"'Cormorant Garamond', serif", fontStyle:'normal', fontSize:21, color:'#fff', lineHeight:1.15 }}>{card.b}</div>
                    </div>
                  )}
                  {tipo === 'mini_desafio' && (
                    <div style={{ textAlign:'center' }}>
                      <div style={{ display:'flex', justifyContent:'center', marginBottom:10 }}>
                        <Timer size={30} color={pal.accent} />
                      </div>
                      <div style={{ fontFamily:"'Cormorant Garamond', serif", fontStyle:'normal', fontSize:26, lineHeight:1.18, color:'#3B1020' }}>{card.texto}</div>
                    </div>
                  )}
                </div>

                <div style={{ display:'flex', alignItems:'center', gap:6, color:'#C0A48F', fontSize:11, letterSpacing:'.06em', textTransform:'uppercase' }}>
                  <ArrowRight size={13} style={{ animation:'dou-hint 1.6s ease-in-out infinite', flexShrink:0 }} />
                  arraste para a próxima
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
