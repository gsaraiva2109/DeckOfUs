import { useRef, useState } from 'react'
import { Heart, X } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useSession } from '../lib/session'

interface Props {
  onEnd: () => void
  // Solo fallback: no live session, so activate ousado locally.
  onActivateOusadoLocal: () => void
}

const HOLD_DURATION = 900
const CIRCUMFERENCE = 119

export default function GateScreen({ onEnd, onActivateOusadoLocal }: Props) {
  const session = useSession()
  const [hold, setHold] = useState(0)
  const [prompting, setPrompting] = useState(false)
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef(0)

  function onHoldComplete() {
    if (session.hasSession) {
      // Multiplayer: ask for the organizer secret, then let the server decide.
      setPrompting(true)
      setSecret('')
      setMsg(null)
    } else {
      // Solo: no backend, activate directly.
      onActivateOusadoLocal()
    }
  }

  function holdStart(e: React.PointerEvent) {
    if (prompting) return
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch (_) {}
    startRef.current = Date.now()
    timerRef.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - startRef.current) / HOLD_DURATION)
      setHold(p)
      if (p >= 1) {
        clearInterval(timerRef.current!)
        timerRef.current = null
        onHoldComplete()
      }
    }, 40)
  }

  function holdEnd() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setHold(prev => (prev < 1 ? 0 : prev))
  }

  async function submitSecret() {
    if (!secret.trim() || !session.sessionId || !session.token) return
    setBusy(true)
    setMsg(null)
    try {
      await api.activateOusado(session.sessionId, secret.trim(), session.token)
      // Success: do nothing locally — the WS `ousado_activated` event drives
      // the transition on both devices. Just close the prompt.
      setPrompting(false)
      setHold(0)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setMsg('senha incorreta')
      } else if (e instanceof ApiError && e.status === 423) {
        setMsg('tente novamente em alguns minutos')
      } else {
        setMsg('algo deu errado, tente de novo')
      }
      setShake(true)
      setSecret('')
      setTimeout(() => setShake(false), 450)
    } finally {
      setBusy(false)
    }
  }

  function cancelPrompt() {
    setPrompting(false)
    setHold(0)
    setSecret('')
    setMsg(null)
  }

  const heartColor = hold > 0 ? '#FF335F' : 'rgba(255,255,255,.35)'
  const heartScale = (1 + hold * 0.5).toFixed(2)
  const holdDash = (CIRCUMFERENCE * (1 - hold)).toFixed(1)

  return (
    <div style={{
      position:'absolute', inset:0,
      background:'linear-gradient(170deg,#FF93A8,#E84393 60%,#BE2C76)',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding:'34px 30px', textAlign:'center',
      animation:'dou-screen .5s ease forwards',
    }}>
      <div style={{ fontWeight:600, fontSize:11, letterSpacing:'.24em', textTransform:'uppercase', color:'#7A1535', animation:'dou-rise .7s ease forwards' }}>
        Fim do Nível 2
      </div>
      <div style={{ fontFamily:"'Instrument Serif',serif", fontStyle:'italic', fontSize:40, lineHeight:1.05, color:'#fff', margin:'12px 0 0', animation:'dou-rise .7s ease .1s forwards' }}>
        Até aqui já foi<br/>bem fundo.
      </div>
      <p style={{ fontSize:15, lineHeight:1.55, color:'#FFE0EA', margin:'16px 0 30px', maxWidth:300, animation:'dou-rise .7s ease .2s forwards' }}>
        Vocês podem fechar por aqui com leveza — ou seguir só mais um pouquinho.
      </p>
      <div
        onClick={onEnd}
        className="btn-press"
        style={{ opacity:0, cursor:'pointer', background:'#fff', color:'#E84393', fontWeight:700, fontSize:16, padding:'15px 44px', borderRadius:99, boxShadow:'0 14px 30px -12px rgba(0,0,0,.3)', animation:'dou-rise .7s ease .3s forwards' }}
      >
        Encerrar por aqui
      </div>

      {/* secret heart hotspot */}
      <div
        style={{ position:'absolute', bottom:18, right:18, width:46, height:46, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', touchAction:'none' }}
        onPointerDown={holdStart}
        onPointerUp={holdEnd}
        onPointerLeave={holdEnd}
      >
        <svg width="46" height="46" viewBox="0 0 46 46" style={{ position:'absolute', transform:'rotate(-90deg)' }}>
          <circle
            cx="23" cy="23" r="19"
            fill="none"
            stroke="rgba(255,255,255,.5)"
            strokeWidth="2.5"
            strokeDasharray="119"
            strokeDashoffset={holdDash}
            style={{ transition:'stroke-dashoffset .08s linear' }}
          />
        </svg>
        <Heart
          size={15}
          fill={hold > 0 ? '#FF335F' : 'transparent'}
          color={heartColor}
          style={{ transform:`scale(${heartScale})`, transition:'transform .1s ease, color .15s ease' }}
        />
      </div>

      {/* organizer secret prompt (multiplayer only) */}
      {prompting && (
        <div style={{
          position:'absolute', inset:0, background:'rgba(20,4,12,.78)', backdropFilter:'blur(4px)',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          padding:'34px 30px', animation:'dou-screen .25s ease forwards', zIndex:20,
        }}>
          <div style={{
            width:'100%', maxWidth:320,
            background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,143,176,.3)', borderRadius:18,
            padding:'24px 22px', position:'relative',
            transform: shake ? undefined : 'none',
            animation: shake ? 'dou-shake .45s ease' : undefined,
          }}>
            <div onClick={cancelPrompt} style={{ position:'absolute', top:12, right:12, cursor:'pointer', color:'rgba(255,255,255,.5)' }}>
              <X size={18} />
            </div>
            <div style={{ display:'inline-flex', color:'#FF335F', marginBottom:10 }}>
              <Heart size={26} fill="#FF335F" color="#FF335F" />
            </div>
            <div style={{ fontFamily:"'Instrument Serif',serif", fontStyle:'italic', fontSize:24, color:'#FFF1E6', lineHeight:1.1 }}>
              senha do organizador
            </div>
            <p style={{ fontSize:12.5, color:'#E7A9B8', margin:'8px 0 16px', lineHeight:1.5 }}>
              Só quem criou a sessão sabe. Acertando, o modo ousado liga nos dois celulares.
            </p>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitSecret() }}
              placeholder="senha…"
              autoFocus
              style={{
                width:'100%', background:'rgba(0,0,0,.25)', border:'1px solid rgba(255,255,255,.22)',
                borderRadius:12, color:'#FFF1E6', fontSize:16, padding:'13px 15px', outline:'none',
                fontFamily:"'Plus Jakarta Sans',sans-serif",
              }}
            />
            {msg && (
              <div style={{ color:'#FF8FB0', fontSize:13, marginTop:10, fontWeight:600 }}>{msg}</div>
            )}
            <div
              onClick={busy ? undefined : submitSecret}
              className="btn-press"
              style={{
                marginTop:16, cursor:'pointer', textAlign:'center',
                background:'linear-gradient(90deg,#FFB23E,#FF5E7E)', color:'#3B1020',
                fontWeight:700, fontSize:15, padding:'13px 0', borderRadius:99, opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? 'verificando…' : 'liberar'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
