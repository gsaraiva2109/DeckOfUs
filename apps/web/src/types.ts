export interface CardConfig {
  tipo: 'pros_dois' | 'trocada' | 'voce_prefere' | 'mini_desafio'
  texto?: string
  a?: string
  b?: string
  de?: 'pessoa' | 'voce'
  para?: 'pessoa' | 'voce'
}

export interface NivelTransicao {
  titulo: string
  frase: string
}

export interface Nivel {
  id: number
  nome: string
  subtitulo?: string
  tom?: string
  transicao: NivelTransicao
  cartas: CardConfig[]
}

export interface ModoOusadoAtivacao {
  titulo: string
  kicker: string
  frase: string
}

export interface ModoOusado {
  ativacao: ModoOusadoAtivacao
  cartas: CardConfig[]
}

export interface DeckConfig {
  pessoa: string
  voce: string
  intro: {
    kicker: string
    titulo: string
    subtitulo: string
    botao: string
  }
  niveis: Nivel[]
  modo_ousado: ModoOusado
  final: {
    titulo: string
    frase?: string  // legacy / override; phrase is generated dynamically from card/level counts
    botao: string
  }
  audio?: {
    virar_carta: boolean
    mudar_nivel: boolean
    modo_ousado: boolean
  }
}

export interface PaletteEntry {
  grad: string
  accent: string
  stageBg: string
  ambient: string
  levelText: string
}
