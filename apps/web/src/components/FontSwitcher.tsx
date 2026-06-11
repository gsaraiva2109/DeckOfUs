// Dev-only font A/B switcher. Overrides CSS variables live (every screen reads
// those vars), persists choices in localStorage, restores on mount. Mounted
// behind import.meta.env.DEV in App.tsx — delete this file + its import once the
// fonts are chosen.
//
// Two independent sections:
//   1. Global pairing  -> --font-display / --font-body
//   2. Level-name testers (independent):
//        splash (CardStack intro)  -> --font-level-splash / --level-splash-style
//        label  (LevelScreen card) -> --font-level-label  / --level-label-style
import { useEffect, useState } from 'react'

interface Pairing {
  name: string
  display: string
  body: string
}

const PAIRINGS: Pairing[] = [
  { name: 'Fraunces + Inter', display: "'Fraunces', serif", body: "'Inter', system-ui, sans-serif" },
  { name: 'Playfair + Manrope', display: "'Playfair Display', serif", body: "'Manrope', system-ui, sans-serif" },
  { name: 'Cormorant + Nunito', display: "'Cormorant Garamond', serif", body: "'Nunito Sans', system-ui, sans-serif" },
  { name: 'Original', display: "'Instrument Serif', serif", body: "'Plus Jakarta Sans', system-ui, sans-serif" },
]

// Font catalogue for the level-name testers, grouped for <optgroup>.
const FONT_GROUPS: { group: string; fonts: { label: string; css: string }[] }[] = [
  {
    group: 'Elegant serifs',
    fonts: [
      { label: 'Fraunces', css: "'Fraunces', serif" },
      { label: 'Cormorant Garamond', css: "'Cormorant Garamond', serif" },
      { label: 'EB Garamond', css: "'EB Garamond', serif" },
      { label: 'Playfair Display', css: "'Playfair Display', serif" },
      { label: 'DM Serif Display', css: "'DM Serif Display', serif" },
    ],
  },
  {
    group: 'Display / decorative',
    fonts: [
      { label: 'Abril Fatface', css: "'Abril Fatface', serif" },
      { label: 'Yeseva One', css: "'Yeseva One', serif" },
      { label: 'Bodoni Moda', css: "'Bodoni Moda', serif" },
      { label: 'Italiana', css: "'Italiana', serif" },
    ],
  },
  {
    group: 'Script / handwritten',
    fonts: [
      { label: 'Dancing Script', css: "'Dancing Script', cursive" },
      { label: 'Parisienne', css: "'Parisienne', cursive" },
      { label: 'Great Vibes', css: "'Great Vibes', cursive" },
      { label: 'Sacramento', css: "'Sacramento', cursive" },
    ],
  },
  {
    group: 'Modern sans',
    fonts: [
      { label: 'Inter', css: "'Inter', sans-serif" },
      { label: 'Manrope', css: "'Manrope', sans-serif" },
      { label: 'Poppins', css: "'Poppins', sans-serif" },
      { label: 'Outfit', css: "'Outfit', sans-serif" },
      { label: 'Space Grotesk', css: "'Space Grotesk', sans-serif" },
    ],
  },
]

const PAIR_KEY = 'dou-font'
const LEVELS_KEY = 'dou-font-levels'

const FRAUNCES = "'Fraunces', serif"

interface LevelCfg {
  splashFont: string
  splashItalic: boolean
  labelFont: string
  labelItalic: boolean
}

const DEFAULT_LEVELS: LevelCfg = {
  splashFont: FRAUNCES,
  splashItalic: false,
  labelFont: "'Bodoni Moda', serif",
  labelItalic: true,
}

function applyPairing(p: Pairing) {
  const root = document.documentElement
  root.style.setProperty('--font-display', p.display)
  root.style.setProperty('--font-body', p.body)
}

function applyLevels(c: LevelCfg) {
  const root = document.documentElement
  root.style.setProperty('--font-level-splash', c.splashFont)
  root.style.setProperty('--level-splash-style', c.splashItalic ? 'italic' : 'normal')
  root.style.setProperty('--font-level-label', c.labelFont)
  root.style.setProperty('--level-label-style', c.labelItalic ? 'italic' : 'normal')
}

export default function FontSwitcher() {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<string>(PAIRINGS[0].name)
  const [levels, setLevels] = useState<LevelCfg>(DEFAULT_LEVELS)

  // Restore saved choices on mount.
  useEffect(() => {
    const savedPair = localStorage.getItem(PAIR_KEY)
    const p = PAIRINGS.find((x) => x.name === savedPair)
    if (p) {
      applyPairing(p)
      setActive(p.name)
    }
    const rawLevels = localStorage.getItem(LEVELS_KEY)
    if (rawLevels) {
      try {
        const c = { ...DEFAULT_LEVELS, ...(JSON.parse(rawLevels) as Partial<LevelCfg>) }
        applyLevels(c)
        setLevels(c)
      } catch {
        /* ignore malformed */
      }
    }
  }, [])

  function pickPairing(p: Pairing) {
    applyPairing(p)
    setActive(p.name)
    localStorage.setItem(PAIR_KEY, p.name)
  }

  function updateLevels(next: LevelCfg) {
    applyLevels(next)
    setLevels(next)
    localStorage.setItem(LEVELS_KEY, JSON.stringify(next))
  }

  const panel: React.CSSProperties = {
    marginBottom: 8,
    background: 'rgba(20,4,12,.94)',
    border: '1px solid rgba(255,255,255,.18)',
    borderRadius: 12,
    padding: 10,
    boxShadow: '0 12px 30px -10px rgba(0,0,0,.6)',
    backdropFilter: 'blur(8px)',
    width: 232,
    maxHeight: '70vh',
    overflowY: 'auto',
  }
  const heading: React.CSSProperties = {
    fontSize: 11,
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,.5)',
    margin: '6px 2px 6px',
    fontWeight: 700,
  }
  const selectStyle: React.CSSProperties = {
    width: '100%',
    background: '#2A0E1B',
    color: '#FFF1E6',
    border: '1px solid rgba(255,255,255,.18)',
    borderRadius: 8,
    padding: '7px 8px',
    fontSize: 12,
    marginTop: 4,
  }

  function levelRow(
    title: string,
    font: string,
    italic: boolean,
    onFont: (css: string) => void,
    onItalic: (v: boolean) => void,
  ) {
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#FFF1E6', fontWeight: 600 }}>{title}</span>
          <button
            onClick={() => onItalic(!italic)}
            style={{
              cursor: 'pointer',
              border: '1px solid rgba(255,255,255,.22)',
              borderRadius: 7,
              padding: '4px 9px',
              fontSize: 11,
              fontStyle: 'italic',
              fontWeight: 600,
              color: italic ? '#1A0410' : '#FFF1E6',
              background: italic ? '#FFB23E' : 'transparent',
            }}
          >
            italic {italic ? 'on' : 'off'}
          </button>
        </div>
        <select value={font} onChange={(e) => onFont(e.target.value)} style={selectStyle}>
          {FONT_GROUPS.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.fonts.map((f) => (
                <option key={f.label} value={f.css}>
                  {f.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 9999, fontFamily: 'system-ui, sans-serif' }}>
      {open && (
        <div style={panel}>
          <div style={heading}>Global pairing</div>
          {PAIRINGS.map((p) => (
            <button
              key={p.name}
              onClick={() => pickPairing(p)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                cursor: 'pointer',
                border: 'none',
                borderRadius: 8,
                padding: '9px 11px',
                marginBottom: 2,
                fontSize: 13,
                fontWeight: active === p.name ? 700 : 500,
                color: active === p.name ? '#1A0410' : '#FFF1E6',
                background: active === p.name ? '#FFB23E' : 'transparent',
              }}
            >
              {p.name}
            </button>
          ))}

          <div style={{ ...heading, marginTop: 12 }}>Level names</div>
          {levelRow(
            'Splash (intro)',
            levels.splashFont,
            levels.splashItalic,
            (css) => updateLevels({ ...levels, splashFont: css }),
            (v) => updateLevels({ ...levels, splashItalic: v }),
          )}
          {levelRow(
            'Label (card)',
            levels.labelFont,
            levels.labelItalic,
            (css) => updateLevels({ ...levels, labelFont: css }),
            (v) => updateLevels({ ...levels, labelItalic: v }),
          )}
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Font switcher (dev)"
        style={{
          cursor: 'pointer',
          border: '1px solid rgba(255,255,255,.18)',
          borderRadius: 99,
          padding: '9px 14px',
          fontSize: 13,
          fontWeight: 600,
          color: '#FFF1E6',
          background: 'rgba(20,4,12,.92)',
          boxShadow: '0 10px 24px -10px rgba(0,0,0,.6)',
        }}
      >
        Aa · {active}
      </button>
    </div>
  )
}
