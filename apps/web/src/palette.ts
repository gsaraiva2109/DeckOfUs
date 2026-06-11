import type { PaletteEntry } from './types'

export const PALETTE: Record<number, PaletteEntry> = {
  1: {
    grad: 'linear-gradient(155deg,#FFD9A0,#FF9E5E 55%,#FF7E6B)',
    accent: '#FF5E7E',
    stageBg: '#2A0F18',
    ambient: 'radial-gradient(120% 80% at 50% 20%,#5E2A1E,#1A0410)',
    levelText: '#FFE9D6',
  },
  2: {
    grad: 'linear-gradient(155deg,#FF93A8,#E84393 55%,#BE2C76)',
    accent: '#FF8FB0',
    stageBg: '#2A0A1E',
    ambient: 'radial-gradient(120% 80% at 50% 20%,#6E1840,#170310)',
    levelText: '#FFD9E6',
  },
  3: {
    grad: 'linear-gradient(155deg,#9E1E5C,#641336 60%,#33112A)',
    accent: '#FF4D6D',
    stageBg: '#190512',
    ambient: 'radial-gradient(120% 80% at 50% 30%,#3A0A22,#0A0208)',
    levelText: '#FFD0DC',
  },
}
