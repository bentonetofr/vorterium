import { useEffect, useRef } from 'react'
import type { TorreView } from './torreService'
import type { Floor, TorrePanel } from './torreNet'
import {
  spriteAstrario, spriteEspelhos, spriteManivela, spriteMapa, spritePenduloBaixo, spritePenduloCima, spriteTelescopio,
} from './game/art'

// ────────────────────────────────────────────────────────
// A janela de um objeto: aparece no centro da tela, o fundo desfoca e o
// boneco fica parado. Fecha com Esc, ✕ ou clicando fora. O pêndulo e o
// Astrário existem nos dois andares: a janela mostra o lado de quem abriu.
// Quem assiste (e o mestre) vê a mesma janela, só olhando.
//
// Marco 1: as janelas ainda estão vazias (só o objeto e o que se vê
// nele). Os enigmas chegam no marco 2.
// ────────────────────────────────────────────────────────

const TITLES: Record<TorrePanel, string> = {
  telescopio: 'O Telescópio',
  mapa:       'O Mapa Estelar',
  espelhos:   'Os Espelhos',
  manivela:   'A Manivela',
  pendulo:    'O Pêndulo',
  astrario:   'O Astrário',
}

const TEXTS: Record<TorrePanel, Record<Floor, string>> = {
  telescopio: { cima: 'Um telescópio de bronze apontado pra fresta da cúpula. O céu está cheio de estrelas apagadas — só três brilham.', baixo: '' },
  mapa:       { cima: 'Um mapa do céu, redondo, preso num cavalete. Quatro buracos vazios onde deveriam estar estrelas.', baixo: '' },
  espelhos:   { cima: '', baixo: 'Quatro espelhos em hastes de ferro. Um feixe de luz entra pela fresta da parede e bate no primeiro.' },
  manivela:   { cima: '', baixo: 'Uma manivela de ferro. As engrenagens sobem pela parede até a cúpula, lá em cima.' },
  pendulo:    {
    cima:  'A haste do pêndulo desce do teto e atravessa a grade. Lá embaixo, o peso balança.',
    baixo: 'O peso do pêndulo balança sobre um mostrador de bronze. O fio sobe e some pela grade do teto.',
  },
  astrario:   {
    cima:  'Um disco de bronze no alto de uma coluna que atravessa o chão. Seis pontos em roda, todos apagados.',
    baixo: 'A outra face do mesmo disco: a coluna vem do andar de cima. Seis pontos em roda, todos apagados.',
  },
}

function spriteOf(id: TorrePanel, floor: Floor): HTMLCanvasElement {
  switch (id) {
    case 'telescopio': return spriteTelescopio()
    case 'mapa':       return spriteMapa()
    case 'espelhos':   return spriteEspelhos()
    case 'manivela':   return spriteManivela()
    case 'pendulo':    return floor === 'cima' ? spritePenduloCima() : spritePenduloBaixo()
    case 'astrario':   return spriteAstrario(floor)
  }
}

/** O objeto ampliado (inteiro, sem suavizar). */
function ObjectArt({ id, floor }: { id: TorrePanel; floor: Floor }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const s = spriteOf(id, floor)
    const k = Math.max(2, Math.min(6, Math.floor(260 / Math.max(s.width, s.height * 0.8))))
    c.width = s.width * k
    c.height = s.height * k
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(s, 0, 0, c.width, c.height)
  }, [id, floor])
  return <canvas ref={ref} className="lb-panel__art tor-panel__art" aria-hidden="true" />
}

export function PuzzlePanel({ id, floor, onClose, watching }: { id: TorrePanel; floor: Floor; view: TorreView; onClose: () => void; watching?: string | null }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="lb-panel-wrap" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <section className="lb-panel lb-frame" role="dialog" aria-label={TITLES[id]}>
        <button type="button" className="lb-x" onClick={onClose} aria-label="Fechar">✕</button>
        {watching && <p className="lb-panel__watch">Assistindo {watching}</p>}
        <h2 className="lb-panel__title">{TITLES[id]}</h2>
        <ObjectArt id={id} floor={floor} />
        <p className="lb-panel__text">{TEXTS[id][floor]}</p>
        <p className="lb-panel__soon">Os enigmas chegam no próximo marco.</p>
      </section>
    </div>
  )
}
