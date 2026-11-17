import { useMemo, useState } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import { ARMORS } from '../catalog/armor'
import { RANGE_INFO, TRAIT_INFO } from '../catalog/rules'
import { WEAPONS } from '../catalog/weapons'
import { armorToSlot, weaponToSlot } from '../model/gear'
import type { DhArmorSlot, DhDamageType, DhRange, DhTier, DhWeaponSlot, DhWeaponTrait } from '../model/types'
import { emptyWeaponSlot } from '../model/defaults'

// ────────────────────────────────────────────────────────
// Escolher arma ou armadura do Livro Básico (por patamar, com busca) ou inventar a sua.
// ────────────────────────────────────────────────────────

const DMG_LABEL: Record<DhDamageType, string> = { fis: 'fís', mag: 'mág', ambos: 'fís/mág' }

interface WeaponProps {
  kind: 'weapon'
  slot: 'primary' | 'secondary' | 'any'
  tier: DhTier
  onPick: (w: DhWeaponSlot) => void
  onClose: () => void
}
interface ArmorProps {
  kind: 'armor'
  tier: DhTier
  onPick: (a: DhArmorSlot | null) => void
  onClose: () => void
}

export function DhGearPicker(props: WeaponProps | ArmorProps) {
  const [tier, setTier] = useState<number>(props.tier)
  const [q, setQ] = useState('')
  const [custom, setCustom] = useState(false)
  const query = q.trim().toLowerCase()

  const weapons = useMemo(() => {
    if (props.kind !== 'weapon') return []
    return WEAPONS.filter((w) => (props.slot === 'any' || w.slot === props.slot) && (tier === 0 || w.tier === tier) && (!query || w.name.toLowerCase().includes(query)))
  }, [props, tier, query])
  const armors = useMemo(() => {
    if (props.kind !== 'armor') return []
    return ARMORS.filter((a) => (tier === 0 || a.tier === tier) && (!query || a.name.toLowerCase().includes(query)))
  }, [props, tier, query])

  return (
    <ModalOverlay onClose={props.onClose}>
      <div className="dh-dialog dh-picker" role="dialog" aria-modal="true" aria-label={props.kind === 'weapon' ? 'Escolher arma' : 'Escolher armadura'}>
        <header className="dh-dialog__head">
          <h3>{props.kind === 'weapon' ? 'Escolher arma' : 'Escolher armadura'}</h3>
          <button type="button" className="modal-close" onClick={props.onClose} aria-label="Fechar">×</button>
        </header>

        {!custom ? (
          <>
            <div className="dh-picker__bar">
              <span className="dh-seg" role="group" aria-label="Patamar">
                {[1, 2, 3, 4].map((t) => <button key={t} type="button" className={tier === t ? 'is-on' : ''} onClick={() => setTier(t)}>P{t}</button>)}
                <button type="button" className={tier === 0 ? 'is-on' : ''} onClick={() => setTier(0)}>Todos</button>
              </span>
              <input type="search" placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
            </div>
            <ul className="dh-picker__list">
              {props.kind === 'weapon' && weapons.map((w) => (
                <li key={w.id}>
                  <button type="button" onClick={() => { props.onPick(weaponToSlot(w)); props.onClose() }}>
                    <strong>{w.name}</strong>
                    <span>{w.trait === 'conjuracao' ? 'Conjuração' : TRAIT_INFO[w.trait].label} · {RANGE_INFO[w.range].short} · {w.dice} {DMG_LABEL[w.damageType]} · {w.hands === 2 ? 'Duas mãos' : 'Uma mão'}</span>
                    {w.featureName && <em>{w.featureName}: {w.feature}</em>}
                  </button>
                </li>
              ))}
              {props.kind === 'armor' && armors.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => { props.onPick(armorToSlot(a)); props.onClose() }}>
                    <strong>{a.name}</strong>
                    <span>Limiares {a.major}/{a.severe} · Armadura {a.score}</span>
                    {a.featureName && <em>{a.featureName}: {a.feature}</em>}
                  </button>
                </li>
              ))}
              {(props.kind === 'weapon' ? weapons : armors).length === 0 && <li className="dh-picker__empty">Nada encontrado.</li>}
            </ul>
            <footer className="dh-dialog__foot">
              {props.kind === 'armor' && <button type="button" className="btn" onClick={() => { props.onPick(null); props.onClose() }}>Sem armadura</button>}
              <button type="button" className="btn" onClick={() => setCustom(true)}>Criar {props.kind === 'weapon' ? 'arma' : 'armadura'} própria</button>
            </footer>
          </>
        ) : props.kind === 'weapon' ? (
          <CustomWeapon onSave={(w) => { props.onPick(w); props.onClose() }} onBack={() => setCustom(false)} />
        ) : (
          <CustomArmor onSave={(a) => { props.onPick(a); props.onClose() }} onBack={() => setCustom(false)} />
        )}
      </div>
    </ModalOverlay>
  )
}

function CustomWeapon({ onSave, onBack }: { onSave: (w: DhWeaponSlot) => void; onBack: () => void }) {
  const [w, setW] = useState<DhWeaponSlot>({ ...emptyWeaponSlot(), trait: 'strength', range: 'melee', dice: 'd8', hands: 1 })
  return (
    <form className="dh-form" onSubmit={(e) => { e.preventDefault(); if (w.name.trim()) onSave({ ...w, name: w.name.trim() }) }}>
      <label>Nome<input value={w.name} maxLength={120} onChange={(e) => setW({ ...w, name: e.target.value })} autoFocus /></label>
      <label>Atributo
        <select value={w.trait} onChange={(e) => setW({ ...w, trait: e.target.value as DhWeaponTrait })}>
          {Object.entries(TRAIT_INFO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          <option value="conjuracao">Conjuração</option>
        </select>
      </label>
      <label>Alcance
        <select value={w.range} onChange={(e) => setW({ ...w, range: e.target.value as DhRange })}>
          {Object.entries(RANGE_INFO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </label>
      <label>Dado de dano (ex.: d8+3)<input value={w.dice} maxLength={12} onChange={(e) => setW({ ...w, dice: e.target.value })} /></label>
      <label>Tipo
        <select value={w.damageType} onChange={(e) => setW({ ...w, damageType: e.target.value as DhDamageType })}>
          <option value="fis">Físico</option><option value="mag">Mágico</option><option value="ambos">Físico ou mágico</option>
        </select>
      </label>
      <label>Mãos
        <select value={w.hands} onChange={(e) => setW({ ...w, hands: Number(e.target.value) as 1 | 2 })}><option value={1}>Uma</option><option value={2}>Duas</option></select>
      </label>
      <label className="dh-form__wide">Característica<textarea rows={2} value={w.feature} maxLength={600} onChange={(e) => setW({ ...w, feature: e.target.value })} /></label>
      <footer className="dh-dialog__foot">
        <button type="button" className="btn" onClick={onBack}>Voltar</button>
        <button type="submit" className="btn btn-primary" disabled={!w.name.trim()}>Usar esta arma</button>
      </footer>
    </form>
  )
}

function CustomArmor({ onSave, onBack }: { onSave: (a: DhArmorSlot) => void; onBack: () => void }) {
  const [a, setA] = useState<DhArmorSlot>({ catalogId: null, name: '', major: 6, severe: 13, score: 3, feature: '', mods: {} })
  const num = (v: string) => Number(v) || 0
  return (
    <form className="dh-form" onSubmit={(e) => { e.preventDefault(); if (a.name.trim()) onSave({ ...a, name: a.name.trim() }) }}>
      <label>Nome<input value={a.name} maxLength={120} onChange={(e) => setA({ ...a, name: e.target.value })} autoFocus /></label>
      <label>Limiar maior (base)<input type="number" value={a.major} onChange={(e) => setA({ ...a, major: num(e.target.value) })} /></label>
      <label>Limiar grave (base)<input type="number" value={a.severe} onChange={(e) => setA({ ...a, severe: num(e.target.value) })} /></label>
      <label>Armadura (base)<input type="number" value={a.score} min={0} max={12} onChange={(e) => setA({ ...a, score: num(e.target.value) })} /></label>
      <label>Bônus de Evasão<input type="number" value={a.mods.evasion ?? 0} onChange={(e) => setA({ ...a, mods: { ...a.mods, evasion: num(e.target.value) } })} /></label>
      <label className="dh-form__wide">Característica<textarea rows={2} value={a.feature} maxLength={600} onChange={(e) => setA({ ...a, feature: e.target.value })} /></label>
      <footer className="dh-dialog__foot">
        <button type="button" className="btn" onClick={onBack}>Voltar</button>
        <button type="submit" className="btn btn-primary" disabled={!a.name.trim()}>Usar esta armadura</button>
      </footer>
    </form>
  )
}
