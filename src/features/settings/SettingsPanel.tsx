import { useId, useRef, useState } from 'react'
import { ModalOverlay } from '../../shared/components/ModalOverlay'
import { useTheme } from '../../shared/theme/ThemeProvider'
import { playDiceRattle } from '../dice3d/sound'
import { SOUND_CHANNELS, TEXT_SCALES, resetSettings, soundVolume, updateSettings, useSettings, type SoundChannel, type TextScale } from './settingsStore'
import './Settings.css'

// ────────────────────────────────────────────────────────
// Configurações do site (abre pela engrenagem, no lugar do antigo botão de
// modo claro/escuro): volume de cada tipo de som, aparência e acessibilidade.
// Tudo vale na hora e fica guardado neste navegador.
// ────────────────────────────────────────────────────────

type Tab = 'sons' | 'aparencia' | 'acessibilidade'
const TABS: { id: Tab; label: string }[] = [
  { id: 'sons', label: 'Sons' },
  { id: 'aparencia', label: 'Aparência' },
  { id: 'acessibilidade', label: 'Acessibilidade' },
]

const SCALE_LABEL: Record<TextScale, string> = { 90: 'Pequeno', 100: 'Normal', 115: 'Grande', 130: 'Muito grande' }

/** Toca uma amostra do tipo de som, já no volume escolhido. */
function playSample(channel: SoundChannel): void {
  if (soundVolume(channel) === 0) return
  if (channel === 'dice') { playDiceRattle(); return }
  if (channel === 'game') {
    void import('../livro/game/sound').then((m) => m.sfx('bell')).catch(() => {})
    return
  }
  try {
    const audio = new Audio(channel === 'chat' ? '/win-notify.mp3' : '/notify.mp3')
    audio.volume = 0.6 * soundVolume(channel)
    void audio.play().catch(() => {})
  } catch { /* sem Audio API */ }
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4z" />
      {muted
        ? <><path d="m16 9 5 6" /><path d="m21 9-5 6" /></>
        : <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></>}
    </svg>
  )
}

function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  const id = useId()
  return (
    <div className="cfg-row">
      <label className="cfg-row__text" htmlFor={id}>
        <span className="cfg-row__label">{label}</span>
        {hint && <span className="cfg-row__hint">{hint}</span>}
      </label>
      <button id={id} type="button" role="switch" aria-checked={checked} className="cfg-switch" onClick={() => onChange(!checked)}>
        <span className="cfg-switch__knob" />
      </button>
    </div>
  )
}

function Volume({ id, label, hint, value, muted, dim, onValue, onMute, onTest }: {
  id: string; label: string; hint?: string; value: number; muted: boolean; dim?: boolean
  onValue: (v: number) => void; onMute: () => void; onTest?: () => void
}) {
  const shown = muted ? 0 : value
  return (
    <div className="cfg-vol" data-dim={dim || undefined}>
      <div className="cfg-vol__top">
        <label className="cfg-row__text" htmlFor={id}>
          <span className="cfg-row__label">{label}</span>
          {hint && <span className="cfg-row__hint">{hint}</span>}
        </label>
        <output className="cfg-vol__pct" htmlFor={id}>{muted ? 'Mudo' : `${value}%`}</output>
      </div>
      <div className="cfg-vol__line">
        <button type="button" className="cfg-iconbtn" aria-pressed={muted} aria-label={muted ? `Ativar o som: ${label}` : `Deixar mudo: ${label}`} title={muted ? 'Ativar o som' : 'Deixar mudo'} onClick={onMute}>
          <SpeakerIcon muted={muted || value === 0} />
        </button>
        <input
          id={id}
          type="range"
          className="cfg-range"
          min={0}
          max={100}
          step={5}
          value={shown}
          style={{ ['--fill' as string]: `${shown}%` }}
          onChange={(e) => onValue(Number(e.target.value))}
          // soltar o controle toca uma amostra, para ouvir o volume escolhido
          onPointerUp={onTest}
          onKeyUp={(e) => { if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') onTest?.() }}
        />
        {onTest && <button type="button" className="cfg-test" onClick={onTest}>Testar</button>}
      </div>
    </div>
  )
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const s = useSettings()
  const { theme, setTheme } = useTheme()
  const [tab, setTab] = useState<Tab>('sons')
  const titleId = useId()
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  function onTabKey(e: React.KeyboardEvent) {
    const i = TABS.findIndex((t) => t.id === tab)
    const next = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : -1
    if (next < 0) return
    e.preventDefault()
    setTab(TABS[next].id)
    tabRefs.current[TABS[next].id]?.focus()
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="cfg" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="cfg__head">
          <h4 id={titleId} className="cfg__title">Configurações</h4>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </header>

        <div className="cfg__tabs" role="tablist" aria-label="Seções das configurações" onKeyDown={onTabKey}>
          {TABS.map((t) => (
            <button
              key={t.id}
              ref={(el) => { tabRefs.current[t.id] = el }}
              type="button"
              role="tab"
              id={`cfg-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`cfg-pane-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              className="cfg__tab"
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="cfg__body" role="tabpanel" id={`cfg-pane-${tab}`} aria-labelledby={`cfg-tab-${tab}`} key={tab}>
          {tab === 'sons' && (
            <>
              <Switch checked={s.muteAll} onChange={(v) => updateSettings({ muteAll: v })} label="Silenciar tudo" hint="Deixa o site inteiro sem som, sem mexer nos volumes abaixo." />
              <Volume
                id="cfg-master"
                label="Volume geral"
                hint="Vale para todos os sons do site."
                value={s.master}
                muted={s.muteAll}
                onValue={(v) => updateSettings({ master: v })}
                onMute={() => updateSettings({ muteAll: !s.muteAll })}
              />
              <div className="cfg__sep" role="separator" />
              {SOUND_CHANNELS.map((c) => (
                <Volume
                  key={c.id}
                  id={`cfg-vol-${c.id}`}
                  label={c.label}
                  hint={c.hint}
                  value={s.volume[c.id]}
                  muted={s.mute[c.id]}
                  dim={s.muteAll}
                  onValue={(v) => updateSettings((o) => ({ ...o, volume: { ...o.volume, [c.id]: v }, mute: { ...o.mute, [c.id]: false } }))}
                  onMute={() => updateSettings((o) => ({ ...o, mute: { ...o.mute, [c.id]: !o.mute[c.id] } }))}
                  onTest={() => playSample(c.id)}
                />
              ))}
            </>
          )}

          {tab === 'aparencia' && (
            <>
              <div className="cfg-block">
                <span className="cfg-row__label" id="cfg-theme-l">Modo do site</span>
                <div className="cfg-seg" role="radiogroup" aria-labelledby="cfg-theme-l">
                  {([['dark', '☾ Escuro'], ['light', '☀ Claro']] as const).map(([v, label]) => (
                    <button key={v} type="button" role="radio" aria-checked={theme === v} className="cfg-seg__btn" onClick={() => setTheme(v)}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="cfg-block">
                <span className="cfg-row__label" id="cfg-scale-l">Tamanho do texto</span>
                <div className="cfg-seg" role="radiogroup" aria-labelledby="cfg-scale-l">
                  {TEXT_SCALES.map((v) => (
                    <button key={v} type="button" role="radio" aria-checked={s.textScale === v} className="cfg-seg__btn" onClick={() => updateSettings({ textScale: v })}>{SCALE_LABEL[v]}</button>
                  ))}
                </div>
                <p className="cfg-sample">
                  Aa — o texto do site muda de tamanho aqui e em todas as telas.
                </p>
              </div>
            </>
          )}

          {tab === 'acessibilidade' && (
            <>
              <Switch checked={s.reduceMotion} onChange={(v) => updateSettings({ reduceMotion: v })} label="Reduzir animações" hint="Tira movimentos, transições e balanços da interface. Os dados continuam rolando." />
              <Switch checked={s.highContrast} onChange={(v) => updateSettings({ highContrast: v })} label="Alto contraste" hint="Textos e bordas mais fortes, para ler com menos esforço." />
              <Switch checked={s.roomyText} onChange={(v) => updateSettings({ roomyText: v })} label="Mais espaço no texto" hint="Aumenta o espaço entre letras, palavras e linhas." />
              <Switch checked={s.strongFocus} onChange={(v) => updateSettings({ strongFocus: v })} label="Destacar a seleção do teclado" hint="Um contorno bem visível no botão ou campo em que você está com Tab." />
              <Switch checked={s.noEffects} onChange={(v) => updateSettings({ noEffects: v })} label="Sem partículas e brilhos de clique" hint="Desliga as faíscas do fundo e o anel que aparece ao clicar." />
            </>
          )}
        </div>

        <footer className="cfg__foot">
          <button type="button" className="btn btn-ghost cfg__reset" onClick={resetSettings}>Restaurar padrões</button>
          <button type="button" className="btn btn-primary" onClick={onClose}>Pronto</button>
        </footer>
      </div>
    </ModalOverlay>
  )
}
