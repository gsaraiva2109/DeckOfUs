import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PALETTE } from './palette'
import { useAudio } from './useAudio'
import { useSession } from './lib/session'
import SessionScreen from './screens/SessionScreen'
import IntroScreen from './screens/IntroScreen'
import LevelScreen from './screens/LevelScreen'
import TransitionScreen from './screens/TransitionScreen'
import GateScreen from './screens/GateScreen'
import OusadoScreen from './screens/OusadoScreen'
import FinalScreen from './screens/FinalScreen'
import type { DeckConfig, CardConfig } from './types'

// Mock config — safe to commit. Real names/questions live in public/deck-config.json (gitignored).
const DEFAULT_CFG: DeckConfig = {
  pessoa: 'Pessoa A',
  voce: 'Pessoa B',
  intro: { kicker: 'um jogo para dois', titulo: 'DeckOfUs', subtitulo: 'Sem pressa, sem placar — só vocês dois.', botao: 'Começar' },
  niveis: [
    { id:1, nome:'Aquecimento', transicao:{ titulo:'Aquecimento', frase:'Sem pressa. Comecem por aqui.' }, cartas:[
      { tipo:'pros_dois', texto:'Qual foi o melhor momento do seu dia hoje?' },
      { tipo:'pros_dois', texto:'Que cheiro te leva direto de volta pra sua infância?' },
      { tipo:'voce_prefere', a:'domingo na cama', b:'domingo na rua' },
      { tipo:'mini_desafio', texto:'Façam a mesma careta ao mesmo tempo.' },
      { tipo:'pros_dois', texto:'Qual música você ouviria pra sempre sem enjoar?' },
    ]},
    { id:2, nome:'Imersão', transicao:{ titulo:'Imersão', frase:'A conversa começa a ficar mais profunda. Respira fundo.' }, cartas:[
      { tipo:'pros_dois', texto:'O que você quer da vida nos próximos cinco anos?' },
      { tipo:'trocada', de:'pessoa', para:'voce', texto:'Que sonho você ainda não contou pra ninguém?' },
      { tipo:'voce_prefere', a:'viajar sem nenhum plano', b:'ter cada detalhe combinado' },
      { tipo:'pros_dois', texto:'O que faz você confiar em alguém?' },
      { tipo:'mini_desafio', texto:'Descubram algo em comum em 30 segundos.' },
    ]},
    { id:3, nome:'Conexão', transicao:{ titulo:'Conexão', frase:'Agora é só vocês dois. De verdade.' }, cartas:[
      { tipo:'pros_dois', texto:'O que te faz se sentir realmente seguro com alguém?' },
      { tipo:'trocada', de:'voce', para:'pessoa', texto:'O que te atraiu em mim primeiro?' },
      { tipo:'pros_dois', texto:'Qual foi a última vez que você se sentiu verdadeiramente visto?' },
    ]},
  ],
  modo_ousado: {
    ativacao: { titulo:'ativado', kicker:'Modo ousado', frase:'Algumas cartas mais ousadas entram no baralho, diluídas com as normais.' },
    cartas: [
      { tipo:'pros_dois', texto:'Qual foi a última vez que você fez algo espontâneo?' },
      { tipo:'trocada', de:'pessoa', para:'voce', texto:'O que você está pensando agora e não falou ainda?' },
      { tipo:'pros_dois', texto:'O que te deixa mais nervoso num encontro?' },
    ],
  },
  final: { titulo:'Vocês foram longe', frase:'Dois níveis, dezenas de perguntas, e pelo menos uma careta ridícula. Nada mal pra um primeiro deck.', botao:'Jogar de novo' },
}

type Screen = 'session' | 'intro' | 'level' | 'transition' | 'gate' | 'ousado' | 'final'

const screenVariants = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: [0.22, 0.9, 0.24, 1] } },
  exit:    { opacity: 0, scale: 1.02, transition: { duration: 0.22, ease: 'easeIn' } },
}

export default function App() {
  const session = useSession()
  const [cfg, setCfg] = useState<DeckConfig>(DEFAULT_CFG)
  const [screen, setScreen] = useState<Screen>('session')
  const [levelIdx, setLevelIdx] = useState(0)
  const [cardIdx, setCardIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [muted, setMuted] = useState(false)
  const [transTo, setTransTo] = useState(2)
  const [finalPhase, setFinalPhase] = useState(2)
  const [ousadoOn, setOusadoOn] = useState(false)
  const ousadoFiredRef = useRef(false)

  const audio = useAudio(muted)

  useEffect(() => {
    fetch('./deck-config.json')
      .then(r => r.ok ? r.json() : null)
      .then((j: DeckConfig | null) => { if (j && j.niveis) setCfg(j) })
      .catch(() => {})
  }, [])

  // Ousado is driven by the realtime event so BOTH devices react together.
  // The choreography (ousado screen → 3200ms → level-3 transition) runs once,
  // wherever the user currently is. Guard against duplicate fires.
  function runOusadoChoreography() {
    if (ousadoFiredRef.current) return
    ousadoFiredRef.current = true
    audio.sfxOusado()
    setOusadoOn(true)
    setScreen('ousado')
    setTimeout(() => {
      audio.sfxLevel()
      setTransTo(3)
      setScreen('transition')
    }, 3200)
  }

  useEffect(() => {
    const off = session.onOusadoEvent(() => runOusadoChoreography())
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  // keyboard: Space=flip, →/↓=next
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (screen !== 'level') return
      if (e.code === 'Space') { e.preventDefault(); flip() }
      if (e.code === 'ArrowRight' || e.code === 'ArrowDown') advance()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, cardIdx, levelIdx, flipped, ousadoOn])

  function levelCards(idx: number): CardConfig[] {
    const lv = cfg.niveis[idx] ?? cfg.niveis[0]
    if (idx === 2 && ousadoOn) {
      const base = lv.cartas
      const bold = cfg.modo_ousado?.cartas ?? []
      const mix: CardConfig[] = []
      const max = Math.max(base.length, bold.length)
      for (let i = 0; i < max; i++) {
        if (base[i]) mix.push(base[i])
        if (bold[i]) mix.push(bold[i])
      }
      return mix
    }
    return lv.cartas
  }

  const curLevel = cfg.niveis[levelIdx] ?? cfg.niveis[0]
  const cards = levelCards(levelIdx)
  const curCard = cards[cardIdx % cards.length] ?? cards[0]
  const pal = PALETTE[curLevel.id] ?? PALETTE[1]

  function start() {
    audio.sfxNext()
    setScreen('level')
    setLevelIdx(0)
    setCardIdx(0)
    setFlipped(false)
  }

  function advance() {
    const c = levelCards(levelIdx)
    const last = cardIdx >= c.length - 1
    if (!last) {
      audio.sfxNext()
      setCardIdx(n => n + 1)
      setFlipped(false)
      return
    }
    if (levelIdx === 0) {
      audio.sfxLevel()
      setTransTo(2)
      setScreen('transition')
    } else if (levelIdx === 1) {
      setScreen('gate')
    } else {
      setScreen('final')
      setFinalPhase(3)
    }
  }

  function flip() {
    audio.sfxFlip()
    setFlipped(f => !f)
  }

  function enterLevel() {
    setLevelIdx(transTo - 1)
    setCardIdx(0)
    setFlipped(false)
    setScreen('level')
  }

  function endAtTwo() {
    setScreen('final')
    setFinalPhase(2)
  }

  // Solo fallback: with no live session there's no WS event to drive ousado,
  // so the gate triggers the choreography locally. In multiplayer the gate hits
  // the API instead and the WS `ousado_activated` event runs the choreography.
  function activateOusadoLocal() {
    runOusadoChoreography()
  }

  function replay() {
    setScreen('intro')
    setLevelIdx(0)
    setCardIdx(0)
    setFlipped(false)
    setOusadoOn(false)
    ousadoFiredRef.current = false
    setFinalPhase(2)
  }

  const transInfo = (cfg.niveis[transTo - 1] ?? {}).transicao ?? { titulo: '', frase: '' }

  // count actual cards played across completed levels
  function computeTotalCards(phase: number): number {
    let total = 0
    for (let i = 0; i < phase; i++) total += cfg.niveis[i]?.cartas.length ?? 0
    if (ousadoOn && phase >= 3) total += cfg.modo_ousado?.cartas.length ?? 0
    return total
  }

  return (
    <div style={{ width:'100%', height:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:pal.ambient, transition:'background 1.1s ease', overflow:'hidden' }}>
      <div style={{ position:'relative', width:'100%', maxWidth:440, height:'100dvh', maxHeight:940, overflow:'hidden', background:pal.stageBg, transition:'background 1.1s ease', boxShadow:'0 40px 90px -30px rgba(0,0,0,.6)' }}>

        <AnimatePresence mode="wait">
          {screen === 'session' && (
            <motion.div key="session" variants={screenVariants} initial="initial" animate="animate" exit="exit" style={{ position:'absolute', inset:0 }}>
              <SessionScreen onReady={() => setScreen('intro')} />
            </motion.div>
          )}

          {screen === 'intro' && (
            <motion.div key="intro" variants={screenVariants} initial="initial" animate="animate" exit="exit" style={{ position:'absolute', inset:0 }}>
              <IntroScreen cfg={cfg} onStart={start} />
            </motion.div>
          )}

          {screen === 'level' && (
            <motion.div key="level" variants={screenVariants} initial="initial" animate="animate" exit="exit" style={{ position:'absolute', inset:0 }}>
              {/* level progress dots */}
              <div style={{ position:'absolute', top:10, left:'50%', transform:'translateX(-50%)', display:'flex', gap:7, zIndex:10, pointerEvents:'none' }}>
                {cfg.niveis.map((lv, i) => (
                  <span key={lv.id} style={{ width: i === levelIdx ? 20 : 7, height:7, borderRadius:99, background: i === levelIdx ? pal.accent : 'rgba(255,255,255,.25)', transition:'width .4s ease, background .4s ease' }}></span>
                ))}
              </div>
              <LevelScreen
                cfg={cfg}
                pal={pal}
                level={curLevel}
                card={curCard}
                cardKey={cardIdx}
                flipped={flipped}
                muted={muted}
                onFlip={flip}
                onNext={advance}
                onToggleMute={() => setMuted(m => !m)}
              />
            </motion.div>
          )}

          {screen === 'transition' && (
            <motion.div key="transition" variants={screenVariants} initial="initial" animate="animate" exit="exit" style={{ position:'absolute', inset:0 }}>
              <TransitionScreen transTo={transTo} transTitle={transInfo.titulo} transPhrase={transInfo.frase} onEnter={enterLevel} />
            </motion.div>
          )}

          {screen === 'gate' && (
            <motion.div key="gate" variants={screenVariants} initial="initial" animate="animate" exit="exit" style={{ position:'absolute', inset:0 }}>
              <GateScreen onEnd={endAtTwo} onActivateOusadoLocal={activateOusadoLocal} />
            </motion.div>
          )}

          {screen === 'ousado' && (
            <motion.div key="ousado" variants={screenVariants} initial="initial" animate="animate" exit="exit" style={{ position:'absolute', inset:0 }}>
              <OusadoScreen cfg={cfg} />
            </motion.div>
          )}

          {screen === 'final' && (
            <motion.div key="final" variants={screenVariants} initial="initial" animate="animate" exit="exit" style={{ position:'absolute', inset:0 }}>
              <FinalScreen
                cfg={cfg}
                finalPhase={finalPhase}
                levelsPlayed={finalPhase}
                totalCards={computeTotalCards(finalPhase)}
                onReplay={replay}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
