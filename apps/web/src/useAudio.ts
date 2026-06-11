import { useRef } from 'react'

export function useAudio(muted: boolean) {
  const acRef = useRef<AudioContext | null>(null)

  function tone(freq: number, dur: number, vol = 0.05) {
    if (muted) return
    try {
      if (!acRef.current) acRef.current = new AudioContext()
      const ac = acRef.current
      if (ac.state === 'suspended') ac.resume()
      const o = ac.createOscillator()
      const g = ac.createGain()
      o.type = 'sine'
      o.frequency.value = freq
      o.connect(g)
      g.connect(ac.destination)
      const t = ac.currentTime
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.start(t)
      o.stop(t + dur + 0.02)
    } catch (_) {}
  }

  return {
    sfxFlip: () => tone(540, 0.19, 0.05),
    sfxNext: () => tone(360, 0.16, 0.045),
    sfxLevel: () => { tone(330, 0.3, 0.05); setTimeout(() => tone(495, 0.4, 0.05), 120) },
    sfxOusado: () => { tone(180, 0.5, 0.06); setTimeout(() => tone(120, 0.6, 0.05), 260) },
  }
}
