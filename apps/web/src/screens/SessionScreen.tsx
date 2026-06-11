import { useEffect, useState } from 'react'
import { Heart, ArrowRight, Copy, Check } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useSession } from '../lib/session'

interface Props {
  // Advance into the game (intro screen).
  onReady: () => void
}

type Mode = 'choose' | 'create' | 'created' | 'join'

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,.07)',
  border: '1px solid rgba(255,255,255,.14)',
  borderRadius: 18,
  padding: '20px 18px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(0,0,0,.22)',
  border: '1px solid rgba(255,255,255,.22)',
  borderRadius: 12,
  color: '#FFF1E6',
  fontSize: 16,
  padding: '13px 15px',
  outline: 'none',
  fontFamily: 'var(--font-body)',
}

const primaryBtn: React.CSSProperties = {
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  background: 'linear-gradient(90deg,#FFB23E,#FF5E7E)',
  color: '#3B1020',
  fontWeight: 700,
  fontSize: 16,
  padding: '15px 0',
  borderRadius: 99,
  boxShadow: '0 16px 34px -12px rgba(255,94,126,.6)',
}

const ghostBtn: React.CSSProperties = {
  cursor: 'pointer',
  textAlign: 'center',
  color: '#FFC9D6',
  fontWeight: 600,
  fontSize: 14,
  padding: '12px 0',
}

export default function SessionScreen({ onReady }: Props) {
  const session = useSession()
  const [mode, setMode] = useState<Mode>('choose')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ code: string; joinUrl: string; qrDataUrl: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // Prefill the join code from ?join=CODE and jump straight to the guest UI.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const join = params.get('join')
    if (join) {
      setCode(join.toUpperCase())
      setMode('join')
    }
  }, [])

  async function handleCreate() {
    if (!secret.trim()) {
      setError('Defina uma senha secreta.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await api.createSession(secret.trim())
      session.setSession({
        sessionId: res.sessionId,
        code: res.code,
        role: 'organizer',
        token: res.organizerToken,
      })
      setCreated({ code: res.code, joinUrl: res.joinUrl, qrDataUrl: res.qrDataUrl })
      setMode('created')
    } catch (e) {
      setError(e instanceof ApiError && e.status === 0
        ? 'Não consegui falar com o servidor. Você pode jogar sozinho.'
        : 'Não deu pra criar a sessão agora.')
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin() {
    const c = code.trim().toUpperCase()
    if (c.length < 4) {
      setError('Digite o código da sessão.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await api.joinSession(c)
      session.setSession({
        sessionId: res.sessionId,
        code: c,
        role: 'guest',
        token: res.participantToken,
        ousadoActive: res.ousadoActive,
      })
      onReady()
    } catch (e) {
      setError(e instanceof ApiError && e.status === 404
        ? 'Código não encontrado. Confere com quem criou.'
        : e instanceof ApiError && e.status === 0
        ? 'Servidor fora do ar. Você pode jogar sozinho.'
        : 'Não deu pra entrar na sessão.')
    } finally {
      setBusy(false)
    }
  }

  function copyJoinUrl() {
    if (!created) return
    navigator.clipboard?.writeText(created.joinUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }).catch(() => {})
  }

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(200deg,#2B0E1B 0%,#7A1535 60%,#BE2C76 100%)',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      padding: '34px 30px', overflowY: 'auto',
      animation: 'dou-screen .6s ease forwards',
    }}>
      <span style={{ position:'absolute',left:'14%',top:'10%',color:'#fff',fontSize:16,opacity:.4,animation:'dou-floaty 5s ease-in-out infinite' }}>✦</span>
      <span style={{ position:'absolute',left:'82%',top:'16%',color:'#fff',fontSize:12,opacity:.4,animation:'dou-floaty 6.5s ease-in-out infinite .8s' }}>✦</span>

      <div style={{ textAlign: 'center', marginBottom: 26 }}>
        <div style={{ color: '#FF8FB0', filter: 'drop-shadow(0 0 16px rgba(255,51,95,.5))', display: 'inline-flex' }}>
          <Heart size={34} fill="#FF335F" color="#FF335F" />
        </div>
        <h1 style={{ fontFamily:'var(--font-body)', fontWeight:800, fontSize:34, lineHeight:1, margin:'12px 0 6px', color:'#FFF1E6', letterSpacing:'-.02em' }}>
          DeckOfUs
        </h1>
        <p style={{ fontSize:14, lineHeight:1.5, color:'#FFC9D6', margin:0 }}>
          Um deck, dois celulares, vocês dois.
        </p>
      </div>

      {error && (
        <div style={{ background:'rgba(255,51,95,.16)', border:'1px solid rgba(255,143,176,.4)', borderRadius:12, color:'#FFD9E6', fontSize:13, padding:'11px 14px', marginBottom:16, textAlign:'center' }}>
          {error}
        </div>
      )}

      {mode === 'choose' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div onClick={() => { setMode('create'); setError(null) }} className="btn-press" style={{ ...card, cursor: 'pointer' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#FFF1E6' }}>Criar sessão</div>
            <div style={{ fontSize: 13, color: '#E7A9B8', marginTop: 4 }}>Você organiza e guarda a senha secreta.</div>
          </div>
          <div onClick={() => { setMode('join'); setError(null) }} className="btn-press" style={{ ...card, cursor: 'pointer' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#FFF1E6' }}>Entrar com código</div>
            <div style={{ fontSize: 13, color: '#E7A9B8', marginTop: 4 }}>Recebeu um convite? Entre aqui.</div>
          </div>
          <div onClick={onReady} style={{ ...ghostBtn, marginTop: 6 }}>Jogar sozinho</div>
        </div>
      )}

      {mode === 'create' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ fontSize: 13, color: '#FFC9D6', fontWeight: 600 }}>Senha secreta do organizador</label>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="só você sabe…"
            style={inputStyle}
            autoFocus
          />
          <p style={{ fontSize: 12, color: '#C98699', lineHeight: 1.5, margin: 0 }}>
            Mais tarde, segurar o coração secreto + essa senha libera o modo ousado nos dois celulares.
          </p>
          <div onClick={busy ? undefined : handleCreate} className="btn-press" style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Criando…' : <>Criar <ArrowRight size={18} /></>}
          </div>
          <div onClick={() => { setMode('choose'); setError(null) }} style={ghostBtn}>Voltar</div>
        </div>
      )}

      {mode === 'created' && created && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
          <p style={{ fontSize: 14, color: '#FFC9D6', textAlign: 'center', margin: 0 }}>
            Peça pra outra pessoa apontar a câmera ou usar o código:
          </p>
          <div style={{ background: '#fff', padding: 12, borderRadius: 16, boxShadow: '0 14px 30px -12px rgba(0,0,0,.4)' }}>
            <img src={created.qrDataUrl} alt="QR code da sessão" width={180} height={180} style={{ display: 'block', borderRadius: 8 }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#C98699', letterSpacing: '.2em', textTransform: 'uppercase' }}>código</div>
            <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 40, letterSpacing: '.12em', color: '#FFF1E6', lineHeight: 1.1 }}>
              {created.code}
            </div>
          </div>
          <div onClick={copyJoinUrl} className="btn-press" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, color: '#FFC9D6', fontSize: 13, fontWeight: 600 }}>
            {copied ? <><Check size={15} /> link copiado</> : <><Copy size={15} /> copiar link de convite</>}
          </div>
          <div onClick={onReady} className="btn-press" style={{ ...primaryBtn, width: '100%' }}>
            Começar <ArrowRight size={18} />
          </div>
        </div>
      )}

      {mode === 'join' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ fontSize: 13, color: '#FFC9D6', fontWeight: 600 }}>Código da sessão</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="EX: 4F2K9A"
            maxLength={8}
            style={{ ...inputStyle, letterSpacing: '.18em', textAlign: 'center', fontSize: 22, fontFamily: 'var(--font-display)' }}
            autoFocus
          />
          <div onClick={busy ? undefined : handleJoin} className="btn-press" style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Entrando…' : <>Entrar <ArrowRight size={18} /></>}
          </div>
          <div onClick={() => { setMode('choose'); setError(null) }} style={ghostBtn}>Voltar</div>
        </div>
      )}
    </div>
  )
}
