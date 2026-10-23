import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useFeatureAccess } from '../control/siteFeatures'
import { ModalOverlay } from '../../shared/components/ModalOverlay'
import { Presence } from '../../shared/components/Presence'
import { BETINHA_FEATURE, BETINHA_SKIN, getSkin } from '../dice3d/skins'
import { setMyDiceSkin } from '../dice3d/diceSkinService'
import type { DiceShowcase } from '../dice3d/DiceShowcase'
import { PATCH_CLOSED_EVENT, alreadySeen as patchSeen } from './PatchNotice'
import './BetaGift.css'

// ────────────────────────────────────────────────────────
// O presente dos betas do D&D: na primeira vez que uma das contas liberadas
// (site_feature_access, recurso dado-betinha) entra no site depois do
// update, uma janela no centro agradece por testarem o D&D e mostra o Dado de
// Betinha Tester girando devagar numa vitrine, com o mascote do lado. Espera o
// aviso do patch fechar (os dois não abrem juntos). Fica marcado por conta
// neste aparelho; o dado continua na aba "Meus dados" do cartão de dados.
// ────────────────────────────────────────────────────────

const seenKey = (userId: string) => `vorterium:betinha-visto:${userId}`

function alreadySeen(userId: string): boolean {
  try { return localStorage.getItem(seenKey(userId)) === '1' } catch { return false }
}

function markSeen(userId: string): void {
  try { localStorage.setItem(seenKey(userId), '1') } catch { /* sem armazenamento: só volta a aparecer */ }
}

const CONFETTI = Array.from({ length: 14 }, (_, i) => i)

export function BetaGiftCard({ onClose }: { onClose: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const pedestalRef = useRef<HTMLDivElement>(null)
  const showcase = useRef<DiceShowcase | null>(null)
  const [simple, setSimple] = useState(false)
  const [equip, setEquip] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const skin = getSkin(BETINHA_SKIN)

  // a vitrine: o d20 de resina girando devagar sobre o pedestal (o 3D baixa na hora, num pedaço separado)
  useEffect(() => {
    let alive = true
    let made: DiceShowcase | null = null
    void Promise.all([import('../dice3d/DiceStage'), import('../dice3d/DiceShowcase')]).then(([stageMod, showMod]) => {
      if (!alive || !hostRef.current || !pedestalRef.current) return
      if (!stageMod.diceStageSupported()) { setSimple(true); return }
      try {
        made = new showMod.DiceShowcase(hostRef.current)
        showcase.current = made
        void made.show([{ id: BETINHA_SKIN, el: pedestalRef.current }])
      } catch { setSimple(true) }
    }).catch(() => { if (alive) setSimple(true) })
    return () => { alive = false; showcase.current = null; made?.dispose() }
  }, [])

  async function equipNow() {
    setEquip('saving')
    try { await setMyDiceSkin(BETINHA_SKIN); setEquip('done') } catch { setEquip('error') }
  }

  return (
    <div className="beta" role="dialog" aria-modal="true" aria-labelledby="beta-title">
      <button type="button" className="beta__close" onClick={onClose} aria-label="Fechar">×</button>
      <div className="beta__confetti" aria-hidden="true">
        {CONFETTI.map((i) => <i key={i} style={{ ['--i' as string]: i }} />)}
      </div>

      <span className="beta__badge">Betinha tester · D&amp;D</span>
      <h2 id="beta-title" className="beta__title">Parabéns!</h2>
      <p className="beta__lead">
        Obrigado por ser <strong>betinha tester</strong> do sistema de D&amp;D do Vorterium! Você testou tudo antes de todo mundo,
        e cada coisa que achou deixou a mesa melhor. Como agradecimento, este dado é só seu:
      </p>

      <div className="beta__show" ref={hostRef}>
        <div className="beta__mascot">
          <span className="beta__bubble">Você é demais!</span>
          <img src="/cavaleiro-loading.png" alt="" draggable={false} />
        </div>
        <div className="beta__case">
          <span className="beta__light" aria-hidden="true" />
          <div className="beta__pedestal" ref={pedestalRef}
            onMouseEnter={() => showcase.current?.setHover(BETINHA_SKIN)} onMouseLeave={() => showcase.current?.setHover(null)}>
            {simple && <span className="beta__swatch" style={{ background: `radial-gradient(circle at 35% 30%, #ffffff, ${skin.bodyEdge} 80%)` }}>20</span>}
          </div>
          <span className="beta__base" aria-hidden="true" />
          <span className="beta__glass" aria-hidden="true" />
        </div>
      </div>

      <div className="beta__plate">
        <strong>{skin.name}</strong>
        <span>Resina transparente com um nerd de brinquedo dentro · exclusivo dos betas</span>
      </div>

      <footer className="beta__foot">
        {equip === 'done'
          ? <p className="beta__ok" role="status">Pronto! Suas próximas rolagens já saem com ele.</p>
          : equip === 'error'
            ? <p className="beta__err" role="alert">Não deu para trocar agora. Escolha ele depois em "Meus dados", no cartão de dados.</p>
            : <p className="beta__hint">Ele também fica na aba "Meus dados" do cartão de dados.</p>}
        <div className="beta__actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{equip === 'done' ? 'Fechar' : 'Depois'}</button>
          {equip !== 'done' && (
            <button type="button" className="btn btn-primary beta__use" onClick={() => void equipNow()} disabled={equip === 'saving'}>
              {equip === 'saving' ? 'Trocando...' : 'Usar este dado'}
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}

/** Fica montado na área logada; abre sozinho uma vez por conta liberada (neste aparelho), depois do aviso do patch. */
export function BetaGiftNotice() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const allowed = useFeatureAccess().has(BETINHA_FEATURE)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!userId || !allowed || alreadySeen(userId)) return
    let timer = 0
    const tryOpen = () => {
      if (!patchSeen(userId)) return
      window.clearTimeout(timer)
      // um respiro para a tela (ou o aviso do patch) sair antes
      timer = window.setTimeout(() => setOpen(true), 900)
    }
    tryOpen()
    window.addEventListener(PATCH_CLOSED_EVENT, tryOpen)
    return () => { window.clearTimeout(timer); window.removeEventListener(PATCH_CLOSED_EVENT, tryOpen) }
  }, [userId, allowed])

  const close = useCallback(() => {
    if (userId) markSeen(userId)
    setOpen(false)
  }, [userId])

  if (!userId) return null
  return (
    <Presence show={open} exitMs={200}>
      {() => (
        <ModalOverlay onClose={close}>
          <BetaGiftCard onClose={close} />
        </ModalOverlay>
      )}
    </Presence>
  )
}
