import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import { useCurrentCampaign } from '../../campaigns/CurrentCampaignContext'
import type { RollBreakdownItem } from '../../../shared/types'
import { fullRollKind, type FullRollKind } from '../utils/critical'
import { playCriticalSound, playFumbleSound } from '../utils/wolfSounds'
import './CritWolf.css'

// ────────────────────────────────────────────────────────
// Lobos do crítico (Altherium). Quando alguém da mesa tira o valor máximo
// em TODOS os dados de uma rolagem, a carinha do lobo branco aparece no
// meio da tela e sorri por 2,5 s. Quando TODOS os dados caem em 1 (falha
// crítica), aparece o lobo preto, que vai de sério a furioso. Vale pra
// todos que estão na campanha, com som (gerado na hora — wolfSounds.ts)
// (a rolagem chega em tempo real; rolagem oculta só chega pra quem pode
// vê-la). Espera os dados "pararem de quicar" no aviso da rolagem.
// ────────────────────────────────────────────────────────

const SHOW_MS  = 2500
/** Mesmo tempo do "quique" dos dados no aviso de resultado (DiceFab). */
const DELAY_MS = 600

type RollRow = {
  id: string
  campaign_id: string
  die_type: string | null
  result: number | null
  individual_results: number[] | null
  roll_breakdown: RollBreakdownItem[] | null
}

export function CritWolf() {
  const { campaign } = useCurrentCampaign()
  const [shown, setShown] = useState<{ key: number; kind: FullRollKind } | null>(null)
  const timers = useRef<number[]>([])
  const campaignId = campaign?.system === 'altherium' ? campaign.id : null

  useEffect(() => {
    if (!campaignId) return
    const channel = supabase
      .channel(`crit-wolf:${campaignId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dice_rolls', filter: `campaign_id=eq.${campaignId}` },
        (payload) => {
          const kind = fullRollKind(payload.new as RollRow)
          if (!kind) return
          const show = window.setTimeout(() => {
            const key = Date.now()
            setShown({ key, kind })
            if (kind === 'critical') playCriticalSound()
            else playFumbleSound()
            const hide = window.setTimeout(() => setShown((cur) => (cur?.key === key ? null : cur)), SHOW_MS)
            timers.current.push(hide)
          }, DELAY_MS)
          timers.current.push(show)
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
      timers.current.forEach((t) => window.clearTimeout(t))
      timers.current = []
      setShown(null)
    }
  }, [campaignId])

  if (!shown) return null
  const label = shown.kind === 'critical' ? 'Crítico!' : 'Falha crítica!'
  return (
    <div key={shown.key} className={`crit-wolf crit-wolf--${shown.kind}`} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {shown.kind === 'critical' ? <WolfFace /> : <ShadowWolfFace />}
      <span className="crit-wolf__label" aria-hidden="true">{label}</span>
    </div>
  )
}

/** A cara do lobo de Altherium: pelo branco, mancha cinza no olho, olhos
 *  azuis e a cicatriz rosa. Os olhos fecham num ^^ e a boca abre num sorriso. */
function WolfFace() {
  return (
    <svg className="crit-wolf__face" viewBox="0 0 240 240" aria-hidden="true">
      <defs>
        <radialGradient id="crit-wolf-glow">
          <stop offset="0%" stopColor="#ffe08a" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#ffd76a" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#ffd76a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle className="crit-wolf__glow" cx="120" cy="124" r="110" fill="url(#crit-wolf-glow)" />

      {/* Brilhinhos */}
      <g className="crit-wolf__sparkles">
        <path className="crit-wolf__spark crit-wolf__spark--1" d="M34 72 l5 13 13 5 -13 5 -5 13 -5 -13 -13 -5 13 -5z" />
        <path className="crit-wolf__spark crit-wolf__spark--2" d="M206 60 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z" />
        <path className="crit-wolf__spark crit-wolf__spark--3" d="M212 168 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4z" />
        <path className="crit-wolf__spark crit-wolf__spark--4" d="M26 168 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" />
      </g>

      <g className="crit-wolf__head">
        {/* Orelhas (atrás da cabeça) */}
        <g className="crit-wolf__ear crit-wolf__ear--l">
          <path d="M66 86 L62 20 L108 60 Z" className="crit-wolf__fur" />
          <path d="M72 72 L70 34 L96 58 Z" className="crit-wolf__ear-in" />
        </g>
        <g className="crit-wolf__ear crit-wolf__ear--r">
          <path d="M174 86 L178 20 L132 60 Z" className="crit-wolf__fur" />
          <path d="M168 72 L170 34 L144 58 Z" className="crit-wolf__ear-in" />
        </g>

        {/* Cabeça peluda */}
        <path
          className="crit-wolf__fur"
          d="M120 50 C150 50 168 62 176 80 L188 84 L181 94 L196 102 L184 110 L198 124 L183 128 L192 142 L175 144 L180 159 L161 158
             C151 173 137 182 120 184 C103 182 89 173 79 158 L60 159 L65 144 L48 142 L57 128 L42 124 L56 110 L44 102 L59 94 L52 84 L64 80
             C72 62 90 50 120 50 Z"
        />
        {/* Tufos na testa */}
        <path className="crit-wolf__line" d="M112 58 L116 68 M126 57 L123 68 M104 64 L110 72 M136 63 L130 72" />
        {/* Mancha cinza no olho (lado esquerdo da tela) */}
        <path className="crit-wolf__patch" d="M76 104 C84 92 104 92 112 104 L114 134 C106 148 92 152 84 146 C78 136 74 118 76 104 Z" />
        {/* Focinho claro */}
        <ellipse cx="120" cy="150" rx="27" ry="24" className="crit-wolf__muzzle" />

        {/* Sobrancelhas: bravas → animadas */}
        <path className="crit-wolf__brow" d="M84 98 L108 104 M156 98 L132 104" />

        {/* Olhos abertos (azuis) */}
        <g className="crit-wolf__eyes-open">
          <path className="crit-wolf__eye" d="M86 114 Q97 105 110 112 Q99 121 86 114 Z" />
          <path className="crit-wolf__eye" d="M154 114 Q143 105 130 112 Q141 121 154 114 Z" />
          <circle cx="99" cy="112" r="2.4" className="crit-wolf__shine" />
          <circle cx="141" cy="112" r="2.4" className="crit-wolf__shine" />
        </g>
        {/* Olhos felizes ^^ */}
        <g className="crit-wolf__eyes-happy">
          <path className="crit-wolf__line crit-wolf__line--thick" d="M86 116 Q98 102 110 116" />
          <path className="crit-wolf__line crit-wolf__line--thick" d="M130 116 Q142 102 154 116" />
        </g>

        {/* Cicatriz rosa (lado direito da tela) */}
        <path className="crit-wolf__scar" d="M152 80 L147 90 L153 99 L146 109 L152 119 L144 129 L148 139" />
        <path className="crit-wolf__scar crit-wolf__scar--thin" d="M130 138 L137 131 M133 143 L140 136" />

        {/* Bochechas coradas */}
        <ellipse cx="86" cy="136" rx="9" ry="4.5" className="crit-wolf__blush" />
        <ellipse cx="154" cy="136" rx="9" ry="4.5" className="crit-wolf__blush" />

        {/* Nariz */}
        <path className="crit-wolf__nose" d="M106 140 Q120 133 134 140 Q132 153 120 157 Q108 153 106 140 Z" />
        <ellipse cx="116" cy="140" rx="4" ry="1.8" className="crit-wolf__shine" />

        {/* Boca: fechada → sorriso aberto com língua */}
        <path className="crit-wolf__mouth-closed crit-wolf__line" d="M104 163 Q112 170 120 161 Q128 170 136 163" />
        <g className="crit-wolf__mouth-open">
          <path className="crit-wolf__mouth" d="M100 160 Q120 164 140 160 Q136 186 120 189 Q104 186 100 160 Z" />
          <path className="crit-wolf__tongue" d="M109 177 Q120 170 131 177 Q129 190 120 192 Q111 190 109 177 Z" />
        </g>
      </g>
    </svg>
  )
}

/** O lobo preto (Sköll): pelo negro e eriçado, olhos vermelhos brilhando e
 *  orelhas com o interior avermelhado. Começa sério; as sobrancelhas
 *  descem, os olhos se estreitam e brilham mais, o focinho enruga, as
 *  orelhas deitam pra trás e ele arreganha os dentes, tremendo de raiva. */
function ShadowWolfFace() {
  return (
    <svg className="crit-wolf__face" viewBox="0 0 240 240" aria-hidden="true">
      <defs>
        <radialGradient id="fail-wolf-aura">
          <stop offset="0%" stopColor="#ff2a2a" stopOpacity="0.5" />
          <stop offset="55%" stopColor="#b3121b" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#b3121b" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="fail-wolf-eye-glow">
          <stop offset="0%" stopColor="#ff5a4a" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ff1a1a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle className="fail-wolf__aura" cx="120" cy="124" r="112" fill="url(#fail-wolf-aura)" />

      <g className="fail-wolf__head">
        {/* Orelhas (atrás da cabeça): deitam pra trás na raiva */}
        <g className="fail-wolf__ear fail-wolf__ear--l">
          <path d="M64 92 L48 24 L104 64 Z" className="fail-wolf__fur" />
          <path d="M68 80 L58 40 L92 64 Z" className="fail-wolf__ear-in" />
        </g>
        <g className="fail-wolf__ear fail-wolf__ear--r">
          <path d="M176 92 L192 24 L136 64 Z" className="fail-wolf__fur" />
          <path d="M172 80 L182 40 L148 64 Z" className="fail-wolf__ear-in" />
        </g>

        {/* Cabeça eriçada */}
        <path
          className="fail-wolf__fur"
          d="M120 54 C148 52 170 64 180 82 L197 79 L187 93 L205 99 L189 109 L207 121 L189 128 L201 144 L181 144 L187 161 L164 158
             C154 176 138 186 120 188 C102 186 86 176 76 158 L53 161 L59 144 L39 144 L51 128 L33 121 L51 109 L35 99 L53 93 L43 79 L60 82
             C70 64 92 52 120 54 Z"
        />
        {/* Tufos do pelo */}
        <path className="fail-wolf__streak" d="M110 60 L115 72 M130 59 L126 72 M98 66 L106 76 M142 66 L134 76 M62 118 L74 122 M178 118 L166 122 M60 132 L72 134 M180 132 L168 134" />
        {/* Focinho */}
        <ellipse cx="120" cy="152" rx="28" ry="24" className="fail-wolf__muzzle" />

        {/* Brilho dos olhos */}
        <g className="fail-wolf__eye-glow">
          <circle cx="96" cy="114" r="17" fill="url(#fail-wolf-eye-glow)" />
          <circle cx="144" cy="114" r="17" fill="url(#fail-wolf-eye-glow)" />
        </g>
        {/* Olhos vermelhos: se estreitam na raiva */}
        <g className="fail-wolf__eyes">
          <path className="fail-wolf__eye" d="M84 114 Q96 106 108 112 Q97 120 84 114 Z" />
          <path className="fail-wolf__eye" d="M156 114 Q144 106 132 112 Q143 120 156 114 Z" />
          <circle cx="97" cy="113" r="2.2" className="fail-wolf__pupil" />
          <circle cx="143" cy="113" r="2.2" className="fail-wolf__pupil" />
        </g>

        {/* Sobrancelhas: sérias → furiosas */}
        <path className="fail-wolf__brow fail-wolf__brow--calm" d="M80 102 L108 106 M160 102 L132 106" />
        <path className="fail-wolf__brow fail-wolf__brow--angry" d="M78 96 L110 111 M162 96 L130 111" />

        {/* Rugas do focinho (só na raiva) */}
        <path className="fail-wolf__wrinkles" d="M106 126 Q113 121 120 126 Q127 121 134 126 M102 133 Q109 128 116 133 M124 133 Q131 128 138 133" />

        {/* Nariz */}
        <path className="fail-wolf__nose" d="M107 141 Q120 134 133 141 Q131 152 120 156 Q109 152 107 141 Z" />
        <ellipse cx="116" cy="141" rx="4" ry="1.6" className="fail-wolf__nose-shine" />

        {/* Boca: fechada → rosnado com as presas à mostra */}
        <path className="fail-wolf__mouth-closed" d="M104 167 Q120 162 136 167" />
        <g className="fail-wolf__snarl">
          <path className="fail-wolf__mouth" d="M97 160 Q120 149 143 160 Q141 189 120 193 Q99 189 97 160 Z" />
          <path className="fail-wolf__tongue" d="M109 184 Q120 177 131 184 Q127 191 120 192 Q113 191 109 184 Z" />
          <path className="fail-wolf__gums" d="M97 160 Q120 149 143 160 L141 167 Q120 157 99 167 Z" />
          <path className="fail-wolf__teeth" d="M102 164 L106 179 L110 162 Z M130 162 L134 179 L138 164 Z M112 161 L114 168 L116 160 Z M118 160 L120 167 L122 160 Z M124 160 L126 168 L128 161 Z" />
          <path className="fail-wolf__teeth" d="M106 189 L109 178 L112 190 Z M128 190 L131 178 L134 189 Z M114 191 L116 185 L118 191 Z M122 191 L124 185 L126 191 Z" />
        </g>
      </g>
    </svg>
  )
}
