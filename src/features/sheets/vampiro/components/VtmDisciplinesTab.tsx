import { useState } from 'react'
import { Select } from '../../../../shared/components/Select'
import { VTM_DISCIPLINES, getClan, type VtmDiscipline } from '../constants/vampiro'
import { VTM_BOOKS, VTM_DISCIPLINE_INFO, VTM_MAIN_BOOKS, type VtmBook, type VtmPower } from '../constants/vtmPowers'
import { VTM_RITE_RULES, type VtmRite, type VtmRiteKind } from '../constants/vtmRituals'
import {
  brokenPowers, catalogPowers, catalogRites, checkPower, checkRite, creationDisciplineCheck, discDots,
  disciplineCost, isClanDiscipline, powersOf, ritesOf, sheetDisciplines,
} from '../utils/vtmProgress'
import { Dots } from './VtmControls'
import type { VtmForm, VtmUpdate } from './vtmForm'

// ────────────────────────────────────────────────────────
// Aba Disciplinas: as do clã já aparecem (com 0 pontos, prontas pra
// preencher), as de fora do clã entram pelo "Adicionar". Cada ponto libera
// um poder daquele nível ou abaixo; o seletor mostra todos os poderes do
// nível, e os que ainda não dá pra pegar dizem por quê (amálgama, poder
// exigido). Feitiçaria tem rituais, Oblívio tem cerimônias e Alquimia tem
// fórmulas.
// ────────────────────────────────────────────────────────

const RITE_OF: Partial<Record<VtmDiscipline, VtmRiteKind>> = { feiticaria: 'ritual', oblivio: 'cerimonia', alquimia: 'formula' }

function BookTag({ books }: { books: VtmBook[] }) {
  const main = books.some((b) => VTM_MAIN_BOOKS.has(b))
  return (
    <span className={`vtm-book${main ? '' : ' vtm-book--sup'}`} title={books.map((b) => VTM_BOOKS[b]).join(', ')}>
      {VTM_BOOKS[books[0]]}{books.length > 1 ? ` +${books.length - 1}` : ''}
    </span>
  )
}

export function VtmDisciplinesTab({ form, update }: { form: VtmForm; update: VtmUpdate }) {
  const [adding, setAdding] = useState('')
  const clan = getClan(form.clan)
  const thin = form.generation >= 14
  const shown = sheetDisciplines(form)
  const extra = (Object.keys(VTM_DISCIPLINES) as VtmDiscipline[])
    .filter((d) => !shown.includes(d) && (d !== 'alquimia' || thin))
  const creation = creationDisciplineCheck(form)
  const broken = brokenPowers(form)

  function setDots(d: VtmDiscipline, v: number) {
    update((p) => ({ ...p, disciplines: { ...p.disciplines, [d]: v } }))
  }

  return (
    <div className="vtm-tab-panel anim-tab-panel">
      <section className="vtm-card">
        <div className="vtm-card__header">
          <h4 className="vtm-card__title">Disciplinas</h4>
          {!thin && (
            <span className={`vtm-badge${creation ? '' : ' vtm-badge--ok'}`} title="Na criação: 2 pontos numa disciplina do clã, 1 noutra, mais 1 do tipo de predador">
              {creation ? 'criação: 2 + 1 do clã' : '✓ distribuição da criação'}
            </span>
          )}
        </div>
        <p className="vtm-muted vtm-lead">
          {thin
            ? 'Sangue-ralo não tem disciplinas de clã. Com o Mérito Alquimista de Sangue-Ralo, aprende Alquimia (custa como do clã).'
            : clan
              ? `${clan.label}: ${clan.disciplines.length ? clan.disciplines.map((d) => VTM_DISCIPLINES[d]).join(', ') : 'nenhuma fixa (custam ×6 de XP)'}. Cada ponto libera um poder daquele nível ou abaixo.`
              : 'Escolha o clã no alto da ficha: as disciplinas dele aparecem aqui.'}
        </p>
        {creation && <p className="vtm-warn">{creation}</p>}
        {broken.length > 0 && (
          <p className="vtm-warn">
            Poderes que não valem mais (faltam pontos ou o amálgama): {broken.map((p) => p.name).join(', ')}.
          </p>
        )}
        {extra.length > 0 && (
          <div className="vtm-add-row">
            <Select
              options={[{ value: '', label: 'Adicionar disciplina…' }, ...extra.map((d) => ({
                value: d, label: `${VTM_DISCIPLINES[d]}${isClanDiscipline(form, d) ? '' : ' · fora do clã'}`,
              }))]}
              value={adding}
              onChange={(v) => { if (v) setDots(v as VtmDiscipline, Math.max(1, discDots(form, v))); setAdding('') }}
              aria-label="Adicionar disciplina"
            />
          </div>
        )}
      </section>

      {shown.length === 0 && <p className="vtm-muted">Nenhuma disciplina ainda.</p>}
      {shown.map((d) => <DisciplineCard key={d} disc={d} form={form} update={update} onDots={(v) => setDots(d, v)} />)}
    </div>
  )
}

function DisciplineCard({ disc, form, update, onDots }: { disc: VtmDiscipline; form: VtmForm; update: VtmUpdate; onDots: (v: number) => void }) {
  const [picking, setPicking] = useState(false)
  const dots = discDots(form, disc)
  const inClan = isClanDiscipline(form, disc)
  const chosen = powersOf(form, disc)
  const info = VTM_DISCIPLINE_INFO[disc]
  const next = dots < 5 ? disciplineCost(form, disc, dots + 1) : null
  const riteKind = RITE_OF[disc]
  const hasPowers = disc !== 'alquimia'

  function togglePower(p: VtmPower) {
    update((prev) => ({
      ...prev,
      powers: prev.powers.includes(p.id) ? prev.powers.filter((x) => x !== p.id) : [...prev.powers, p.id],
    }))
  }

  return (
    <section className={`vtm-card vtm-disc${inClan ? ' vtm-disc--clan' : ''}`}>
      <div className="vtm-card__header">
        <h4 className="vtm-card__title">
          {VTM_DISCIPLINES[disc]}
          <span className={`vtm-tag${inClan ? ' vtm-tag--clan' : ''}`}>{inClan ? 'do clã' : 'fora do clã'}</span>
        </h4>
        <div className="vtm-disc__dots">
          <Dots value={dots} label={VTM_DISCIPLINES[disc]} onChange={onDots} />
          <span className="vtm-muted" title={next?.why}>{next ? `próximo: ${next.cost} XP` : 'máximo'}</span>
        </div>
      </div>
      <p className="vtm-muted vtm-lead">{info.summary} <span className="vtm-faint">· {info.type} · ameaça à Máscara: {info.masquerade}</span></p>

      {hasPowers && (
        <>
          <div className="vtm-subhead">
            <span className="vtm-label">Poderes</span>
            <span className={`vtm-counter${chosen.length > dots ? ' vtm-counter--over' : ''}`}>{chosen.length}/{dots}</span>
            {dots > 0 && (
              <button type="button" className="vtm-chip" onClick={() => setPicking((v) => !v)}>
                {picking ? 'Fechar' : '+ Escolher poder'}
              </button>
            )}
          </div>
          {chosen.length > dots && <p className="vtm-warn">Um poder por ponto: tem {chosen.length} poderes e {dots} pontos.</p>}
          {chosen.length === 0 && !picking && (
            <p className="vtm-muted">{dots ? 'Nenhum poder escolhido ainda.' : 'Ponha pontos pra liberar os poderes.'}</p>
          )}
          <ul className="vtm-powers">
            {chosen.map((p) => <PowerItem key={p.id} p={p} form={form} onRemove={() => togglePower(p)} />)}
          </ul>
          {picking && <PowerPicker disc={disc} form={form} onToggle={togglePower} />}
        </>
      )}

      {riteKind && <RiteSection kind={riteKind} form={form} update={update} />}
    </section>
  )
}

function PowerLine({ p }: { p: VtmPower }) {
  return (
    <span className="vtm-power__meta">
      {p.cost !== '—' && <span title="Custo">{p.cost}</span>}
      {p.pool !== '—' && <span title="Teste">🎲 {p.pool}</span>}
      {p.vs !== '—' && <span title="Resistência">vs {p.vs}</span>}
      {p.duration !== '—' && <span title="Duração">⏱ {p.duration}</span>}
    </span>
  )
}

function PowerItem({ p, form, onRemove }: { p: VtmPower; form: VtmForm; onRemove: () => void }) {
  const check = checkPower(form, p)
  return (
    <li className={`vtm-power${check.ok ? '' : ' vtm-power--broken'}`}>
      <div className="vtm-power__head">
        <span className="vtm-power__lvl">{'●'.repeat(p.level)}</span>
        <strong className="vtm-power__name">{p.name}</strong>
        <span className="vtm-faint">{p.en}</span>
        {p.amalgam && <span className="vtm-tag">amálgama: {VTM_DISCIPLINES[p.amalgam[0]]} {p.amalgam[1]}</span>}
        <BookTag books={p.books} />
        <button type="button" className="vtm-x" onClick={onRemove} aria-label={`Tirar ${p.name}`}>×</button>
      </div>
      <PowerLine p={p} />
      {p.summary && <p className="vtm-power__summary">{p.summary}</p>}
      {!check.ok && <p className="vtm-warn">{check.reason}</p>}
    </li>
  )
}

function PowerPicker({ disc, form, onToggle }: { disc: VtmDiscipline; form: VtmForm; onToggle: (p: VtmPower) => void }) {
  const [all, setAll] = useState(false)
  const powers = catalogPowers(disc).filter((p) => all || p.books.some((b) => VTM_MAIN_BOOKS.has(b)))
  const levels = [1, 2, 3, 4, 5]
  return (
    <div className="vtm-picker">
      <label className="vtm-check">
        <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
        Mostrar também os poderes dos outros suplementos
      </label>
      {levels.map((lvl) => {
        const list = powers.filter((p) => p.level === lvl)
        if (!list.length) return null
        return (
          <div key={lvl} className="vtm-picker__level">
            <span className="vtm-label">Nível {lvl}</span>
            {list.map((p) => {
              const owned = form.powers.includes(p.id)
              const check = checkPower(form, p)
              return (
                <button
                  key={p.id} type="button" disabled={!owned && !check.ok} onClick={() => onToggle(p)}
                  className={`vtm-pick${owned ? ' is-on' : ''}`} title={check.reason ?? p.summary}
                >
                  <span className="vtm-pick__name">{owned ? '✓ ' : ''}{p.name} <span className="vtm-faint">{p.en}</span></span>
                  <span className="vtm-pick__info">
                    {p.summary || <span className="vtm-faint">Sem resumo ainda: veja o livro.</span>}
                  </span>
                  <PowerLine p={p} />
                  <span className="vtm-pick__foot">
                    {p.amalgam && <span className="vtm-tag">amálgama: {VTM_DISCIPLINES[p.amalgam[0]]} {p.amalgam[1]}</span>}
                    <BookTag books={p.books} />
                    {!owned && !check.ok && <span className="vtm-pick__why">{check.reason}</span>}
                  </span>
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function RiteSection({ kind, form, update }: { kind: VtmRiteKind; form: VtmForm; update: VtmUpdate }) {
  const [picking, setPicking] = useState(false)
  const [all, setAll] = useState(false)
  const rule = VTM_RITE_RULES[kind]
  const owned = ritesOf(form, kind)
  const dots = discDots(form, rule.disc)
  const free = kind === 'cerimonia' ? 0 : dots
  const catalog = catalogRites(kind).filter((r) => all || r.books.some((b) => VTM_MAIN_BOOKS.has(b)))

  function toggle(r: VtmRite) {
    update((p) => ({ ...p, rituals: p.rituals.includes(r.id) ? p.rituals.filter((x) => x !== r.id) : [...p.rituals, r.id] }))
  }

  return (
    <div className="vtm-rites">
      <div className="vtm-subhead">
        <span className="vtm-label">{rule.plural}</span>
        <span className="vtm-counter">{owned.length}{free ? ` · ${free} de graça na criação` : ''}</span>
        {dots > 0 && (
          <button type="button" className="vtm-chip" onClick={() => setPicking((v) => !v)}>
            {picking ? 'Fechar' : `+ ${rule.label}`}
          </button>
        )}
      </div>
      <p className="vtm-muted">{rule.rule}</p>
      {owned.length > 0 && (
        <ul className="vtm-rite-list">
          {owned.map((r) => {
            const check = checkRite(form, r)
            return (
              <li key={r.id} className={check.ok ? '' : 'vtm-power--broken'}>
                <span className="vtm-power__lvl">{'●'.repeat(r.level)}</span>
                <strong>{r.name}</strong> <span className="vtm-faint">{r.en}</span>
                <BookTag books={r.books} />
                {!check.ok && <span className="vtm-pick__why">{check.reason}</span>}
                <button type="button" className="vtm-x" onClick={() => toggle(r)} aria-label={`Tirar ${r.name}`}>×</button>
              </li>
            )
          })}
        </ul>
      )}
      {picking && (
        <div className="vtm-picker">
          <label className="vtm-check">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
            Mostrar também os dos outros suplementos
          </label>
          {[1, 2, 3, 4, 5].map((lvl) => {
            const list = catalog.filter((r) => r.level === lvl)
            if (!list.length) return null
            return (
              <div key={lvl} className="vtm-picker__level">
                <span className="vtm-label">Nível {lvl}</span>
                <div className="vtm-picker__chips">
                  {list.map((r) => {
                    const on = form.rituals.includes(r.id)
                    const check = checkRite(form, r)
                    return (
                      <button
                        key={r.id} type="button" disabled={!on && !check.ok} onClick={() => toggle(r)}
                        className={`vtm-pick vtm-pick--chip${on ? ' is-on' : ''}`}
                        title={`${r.en} · ${r.books.map((b) => VTM_BOOKS[b]).join(', ')}${check.reason ? ` · ${check.reason}` : ''}`}
                      >
                        {on ? '✓ ' : ''}{r.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
