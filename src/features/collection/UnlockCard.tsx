import { useEffect, useRef, useState } from 'react'
import { usePresenceState } from '../../shared/components/Presence'
import { getSkin, type Tier } from '../dice3d/skins'
import { setMyDiceSkin } from '../dice3d/diceSkinService'
import type { DiceShowcase } from '../dice3d/DiceShowcase'
import { playUnlockSound } from './unlockSound'
import { didOf } from './achievements'
import type { UnlockEvent } from './collectionService'
import './UnlockCard.css'

// ────────────────────────────────────────────────────────
// O cartão suspenso da conquista: cai do alto da tela com o dado novo girando num pedestal de luz, raios, chuva de faíscas,
// o nome da raridade e os parabéns. A conquista é secreta: o cartão só mostra o nome dela, nunca como se ganha.
// ────────────────────────────────────────────────────────

export const TIER_LABEL: Record<Tier, string> = { comum: 'Comum', incomum: 'Incomum', rara: 'Rara', epica: 'Épica', lendaria: 'Lendária' }
/** Cor principal e cor funda de cada raridade. */
export const TIER_COLOR: Record<Tier, [string, string]> = {
  comum: ['#d9c9a3', '#7a6a48'], incomum: ['#5fe0a8', '#1f7a56'], rara: ['#5ab4ff', '#1f5fa8'], epica: ['#c284ff', '#6a2ab0'], lendaria: ['#ffc23a', '#b8620c'],
}

const SPARKS = Array.from({ length: 30 }, (_, i) => i)
const STARS = Array.from({ length: 10 }, (_, i) => i)
/** Quanto o cartão fica na tela se ninguém fechar (ms). */
const STAY_MS = 20000

export function UnlockCard({ event, onClose }: { event: UnlockEvent; onClose: () => void }) {
  const presence = usePresenceState()
  const skin = getSkin(event.skin)
  const tier: Tier = skin.tier ?? 'comum'
  const [c1, c2] = TIER_COLOR[tier]
  const hostRef = useRef<HTMLDivElement>(null)
  const pedestalRef = useRef<HTMLDivElement>(null)
  const showcase = useRef<DiceShowcase | null>(null)
  const [simple, setSimple] = useState(false)
  const [equip, setEquip] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')

  // o dado girando (o 3D baixa na hora, num pedaço separado) e o som de entrada
  useEffect(() => {
    playUnlockSound(tier)
    let alive = true
    let made: DiceShowcase | null = null
    void Promise.all([import('../dice3d/DiceStage'), import('../dice3d/DiceShowcase')]).then(([stageMod, showMod]) => {
      if (!alive || !hostRef.current || !pedestalRef.current) return
      if (!stageMod.diceStageSupported()) { setSimple(true); return }
      try {
        made = new showMod.DiceShowcase(hostRef.current)
        showcase.current = made
        void made.show([{ id: skin.id, el: pedestalRef.current }])
      } catch { setSimple(true) }
    }).catch(() => { if (alive) setSimple(true) })
    return () => { alive = false; showcase.current = null; made?.dispose() }
  }, [skin.id, tier])

  // some sozinho depois de um tempo
  useEffect(() => {
    const t = window.setTimeout(onClose, STAY_MS)
    return () => window.clearTimeout(t)
  }, [onClose])

  async function equipNow() {
    setEquip('saving')
    try { await setMyDiceSkin(skin.id); setEquip('done') } catch { setEquip('error') }
  }

  return (
    <div className={`uc uc--${tier}`} data-state={presence} role="alertdialog" aria-live="polite" aria-label={`Conquista desbloqueada: ${event.title}`}
      style={{ ['--tc' as string]: c1, ['--tc2' as string]: c2 }}>
      <button type="button" className="uc__close" onClick={onClose} aria-label="Fechar">×</button>
      <span className="uc__shine" aria-hidden="true" />

      <div className="uc__show" ref={hostRef}>
        <span className="uc__rays" aria-hidden="true" />
        <div className="uc__burst" aria-hidden="true">
          {SPARKS.map((i) => <i key={i} style={{ ['--a' as string]: `${i * 12 + (i % 3) * 4}deg`, ['--d' as string]: `${90 + (i % 5) * 26}px`, ['--s' as string]: `${5 + (i % 4) * 2}px`, ['--t' as string]: `${(i % 6) * 40}ms` }} />)}
        </div>
        <div className="uc__stars" aria-hidden="true">
          {STARS.map((i) => <b key={i} style={{ ['--i' as string]: i }}>✦</b>)}
        </div>
        <div className="uc__pedestal" ref={pedestalRef}
          onMouseEnter={() => showcase.current?.setHover(skin.id)} onMouseLeave={() => showcase.current?.setHover(null)}>
          {simple && <span className="uc__swatch" style={{ background: `radial-gradient(circle at 35% 30%, ${skin.body}, ${skin.bodyEdge} 80%)`, borderColor: skin.trim, color: skin.ink }}>20</span>}
        </div>
        <span className="uc__base" aria-hidden="true" />
      </div>

      <div className="uc__text">
        <span className="uc__tier">{TIER_LABEL[tier]}</span>
        <h2 className="uc__title">Parabéns!</h2>
        <p className="uc__sub">Conquista desbloqueada</p>
        <p className="uc__name">{event.title}</p>
        {didOf(event.achievement) && <p className="uc__did"><span aria-hidden="true">✓</span> {didOf(event.achievement)}</p>}
        <p className="uc__gift">Você ganhou o dado <strong>{skin.name}</strong></p>
      </div>

      <footer className="uc__foot">
        {equip === 'done'
          ? <p className="uc__ok" role="status">Pronto! Suas próximas rolagens já saem com ele.</p>
          : equip === 'error'
            ? <p className="uc__err" role="alert">Não deu para trocar agora. Escolha ele depois em "Meus dados", no cartão de dados.</p>
            : <p className="uc__hint">Ele fica guardado na sua coleção, em "Meus dados".</p>}
        <div className="uc__actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{equip === 'done' ? 'Fechar' : 'Depois'}</button>
          {equip !== 'done' && (
            <button type="button" className="btn btn-primary uc__use" onClick={() => void equipNow()} disabled={equip === 'saving'}>
              {equip === 'saving' ? 'Trocando...' : 'Usar agora'}
            </button>
          )}
        </div>
      </footer>
      <span className="uc__timer" aria-hidden="true" style={{ animationDuration: `${STAY_MS}ms` }} />
    </div>
  )
}
