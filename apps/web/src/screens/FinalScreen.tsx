import { useRef, useState } from 'react'
import { RotateCcw, Share2, Camera, Heart, Loader2 } from 'lucide-react'
import type { DeckConfig } from '../types'
import { useSession } from '../lib/session'
import { uploadPhoto } from '../lib/api'

interface Props {
  cfg: DeckConfig
  finalPhase: number
  levelsPlayed: number
  totalCards: number
  onReplay: () => void
}

const PT_ORDINALS: Record<number, string> = {
  1: 'Um nível',
  2: 'Dois níveis',
  3: 'Três níveis',
  4: 'Quatro níveis',
  5: 'Cinco níveis',
}

function cardCountDesc(n: number): string {
  if (n < 10) return `${n} perguntas`
  if (n < 20) return 'uma dezena de perguntas'
  if (n < 100) return 'dezenas de perguntas'
  return 'centenas de perguntas'
}

export default function FinalScreen({ cfg, finalPhase, levelsPlayed, totalCards, onReplay }: Props) {
  const { titulo, botao } = cfg.final
  const levelStr = PT_ORDINALS[levelsPlayed] ?? `${levelsPlayed} níveis`
  const frase = `${levelStr}, ${cardCountDesc(totalCards)}, e pelo menos uma careta ridícula.`
  const isA = finalPhase === 2
  const isB = finalPhase === 3

  const session = useSession()
  const fileRef = useRef<HTMLInputElement>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [toast, setToast] = useState<string | null>(null)

  // The active photo url: prefer an uploaded/remote url (ours or the other
  // device's via photo_added → session.photos), fall back to the local preview.
  const remoteUrl = session.photos.length > 0 ? session.photos[session.photos.length - 1] : null
  const photoSrc = remoteUrl ?? localPreview
  const shareUrl = remoteUrl

  function showToast(t: string) {
    setToast(t)
    setTimeout(() => setToast(null), 1800)
  }

  function tapPolaroid() {
    if (uploading) return
    fileRef.current?.click()
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Immediate local preview.
    const url = URL.createObjectURL(file)
    setLocalPreview(url)

    // No live session → keep it local (solo play), no upload.
    if (!session.hasSession || !session.sessionId || !session.token) return

    setUploading(true)
    setProgress(0)
    try {
      const res = await uploadPhoto(session.sessionId, file, session.token, setProgress)
      session.addPhoto(res.url) // swap to the stored url; also dedupes with photo_added
    } catch (_) {
      showToast('não consegui enviar a foto')
    } finally {
      setUploading(false)
    }
  }

  async function onShare() {
    if (!shareUrl) return
    if (navigator.share) {
      try {
        await navigator.share({ title: 'DeckOfUs', text: 'nós, hoje', url: shareUrl })
      } catch (_) {
        /* user dismissed */
      }
    } else if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl)
        showToast('link copiado')
      } catch (_) {
        showToast('não consegui copiar')
      }
    }
  }

  const shareEnabled = !!shareUrl

  return (
    <div style={{ position:'absolute', inset:0, animation:'dou-screen .6s ease forwards' }}>
      {isA && (
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(175deg,#FFE7C2,#FF9E84 55%,#E84393)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'34px 30px', textAlign:'center' }}>
          <span style={{ position:'absolute', left:'18%', top:'18%', fontSize:15, color:'#fff', animation:'dou-drift 3.2s ease-in infinite' }}>✦</span>
          <span style={{ position:'absolute', left:'74%', top:'26%', fontSize:13, color:'#FFB23E', animation:'dou-drift 3.6s ease-in infinite .6s' }}>✦</span>
          <span style={{ position:'absolute', left:'58%', top:'14%', fontSize:13, color:'#fff', animation:'dou-drift 3s ease-in infinite 1.1s' }}>✦</span>
          <span style={{ position:'absolute', left:'30%', top:'22%', fontSize:12, color:'#fff', animation:'dou-drift 3.4s ease-in infinite 1.6s' }}>✦</span>

          <div style={{ display:'flex', alignItems:'flex-end', gap:8, animation:'dou-floaty 4s ease-in-out infinite' }}>
            <div style={{ width:58, height:58, borderRadius:'50%', background:'#FF5E7E', boxShadow:'0 8px 18px -6px rgba(180,40,80,.5)' }}></div>
            <Heart size={32} fill="#FFB23E" color="#FFB23E" style={{ marginBottom:8 }} />
            <div style={{ width:58, height:58, borderRadius:'50%', background:'#7A1535', boxShadow:'0 8px 18px -6px rgba(80,10,40,.5)' }}></div>
          </div>
          <h3 style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:400, fontSize:48, lineHeight:1.0, color:'#3B1020', margin:'28px 0 0' }}>{titulo}</h3>
          <p style={{ fontSize:15, lineHeight:1.55, color:'#5A1A30', margin:'14px 0 28px', maxWidth:310 }}>{frase}</p>
          <div
            onClick={onReplay}
            className="btn-press"
            style={{ cursor:'pointer', display:'inline-flex', alignItems:'center', gap:10, background:'#3B1020', color:'#FFF1E6', fontWeight:600, fontSize:16, padding:'15px 34px', borderRadius:99, boxShadow:'0 14px 30px -12px rgba(59,16,32,.6)' }}
          >
            <RotateCcw size={18} /> {botao}
          </div>
        </div>
      )}

      {isB && (
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg,#2B0E1B,#7A1535 70%,#BE2C76)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'30px 30px', textAlign:'center' }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFile}
            style={{ display:'none' }}
          />
          <div
            onClick={tapPolaroid}
            className="btn-press"
            style={{ cursor:'pointer', background:'#FFF7EE', borderRadius:12, padding:'13px 13px 18px', transform:'rotate(-4deg)', boxShadow:'0 22px 40px -18px rgba(0,0,0,.6)', animation:'dou-floaty 5s ease-in-out infinite', width:190 }}
          >
            <div style={{ position:'relative', height:158, borderRadius:7, overflow:'hidden', background:'linear-gradient(160deg,#FFD9A0,#FF7E6B 60%,#E84393)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {photoSrc ? (
                <img src={photoSrc} alt="nossa foto" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              ) : (
                <Camera size={42} color="rgba(255,255,255,.85)" />
              )}
              {uploading && (
                <div style={{ position:'absolute', inset:0, background:'rgba(20,4,12,.5)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6, color:'#fff' }}>
                  <Loader2 size={26} style={{ animation:'dou-spin 1s linear infinite' }} />
                  <span style={{ fontSize:12, fontWeight:600 }}>{progress}%</span>
                </div>
              )}
            </div>
            <div style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontSize:20, color:'#3B1020', marginTop:11 }}>
              {photoSrc ? 'nós, hoje' : 'toque pra tirar'}
            </div>
          </div>
          <h3 style={{ fontFamily:'var(--font-body)', fontWeight:800, fontSize:30, lineHeight:1.05, color:'#FFF1E6', margin:'30px 0 0', letterSpacing:'-.01em' }}>{titulo}</h3>
          <p style={{ fontSize:14, lineHeight:1.55, color:'#FFC9D6', margin:'12px 0 24px', maxWidth:310 }}>{frase}</p>
          <div style={{ display:'flex', gap:12, width:'100%', maxWidth:330 }}>
            <div
              onClick={onReplay}
              className="btn-press"
              style={{ flex:1, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'linear-gradient(90deg,#FFB23E,#FF5E7E)', color:'#3B1020', fontWeight:700, fontSize:14, padding:'14px 0', borderRadius:99 }}
            >
              <RotateCcw size={16} /> {botao}
            </div>
            <div
              onClick={shareEnabled ? onShare : undefined}
              className={shareEnabled ? 'btn-press' : undefined}
              style={{ flex:1, cursor: shareEnabled ? 'pointer' : 'default', display:'flex', alignItems:'center', justifyContent:'center', gap:8, border:'1.5px solid rgba(255,255,255,.4)', color:'#FFF1E6', fontWeight:600, fontSize:14, padding:'14px 0', borderRadius:99, opacity: shareEnabled ? 1 : 0.45 }}
            >
              <Share2 size={15} /> Compartilhar
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position:'absolute', bottom:26, left:'50%', transform:'translateX(-50%)', background:'rgba(20,4,12,.9)', color:'#FFF1E6', fontSize:13, fontWeight:600, padding:'10px 18px', borderRadius:99, boxShadow:'0 10px 24px -8px rgba(0,0,0,.5)', zIndex:30, animation:'dou-rise .3s ease forwards' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
