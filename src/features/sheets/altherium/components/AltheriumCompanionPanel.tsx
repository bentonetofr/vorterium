import { useRef, useState, type ChangeEvent } from 'react'
import { AvatarCropEditor } from '../../../users/components/AvatarCropEditor'
import { Presence } from '../../../../shared/components/Presence'
import { alertDialog, ask } from '../../../../shared/components/dialogs'
import { ALTHERIUM_PORTRAIT_MAX_BYTES, ALTHERIUM_PORTRAIT_TYPES } from '../services/altheriumSheetService'
import {
  attackText, command, damageText, die, griefLoss, heal, learnedCount, longRest, newAbilityId, newWolf,
  NO_COMPANION, recall, STATE_LABEL, stabilize, wound, woundsMax, wolfAbilities, type Companion, type CompanionAbility, type CompanionState,
} from '../utils/altheriumCompanion'
import { Pips } from './AltheriumPlayKit'
import './AltheriumCompanion.css'

/** A pata (símbolo do companheiro): usada no retrato vazio e na bolinha do cabeçalho. */
export function PawIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="10" r="1.8" /><circle cx="10" cy="6" r="1.8" /><circle cx="14" cy="6" r="1.8" /><circle cx="18" cy="10" r="1.8" />
      <path d="M12 12c-3 0-5.5 3-5.5 5.2 0 1.6 1.5 2.3 3 2.3 1 0 1.6-.4 2.5-.4s1.5.4 2.5.4c1.5 0 3-.7 3-2.3C17.5 15 15 12 12 12z" />
    </svg>
  )
}

/** O lapizinho: abre a edição do pedaço ao lado; vira um "pronto" (✓) enquanto edita. */
function Pencil({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" className={`alth-pet__pencil${on ? ' is-on' : ''}`} onClick={onClick} title={on ? 'Pronto' : label} aria-label={on ? 'Concluir a edição' : label} aria-pressed={on}>
      {on ? (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" /><path d="m14.5 7.5 3 3" /></svg>
      )}
    </button>
  )
}

const STATE_ORDER: CompanionState[] = ['protegido', 'exposto', 'caido', 'morto']

interface Props {
  sheetId: string
  companion: Companion
  onChange: (next: Companion) => void
  /** Jogador dono ou mestre editando; falso = só leitura. */
  canEdit: boolean
  /** A morte do companheiro tira Equilíbrio do dono. */
  onEquilibriumLoss: (n: number) => void
  uploadPhoto: (file: File) => Promise<string>
  removePhoto: () => Promise<void>
}

export function AltheriumCompanionPanel({ companion: c, onChange, canEdit, onEquilibriumLoss, uploadPhoto, removePhoto }: Props) {
  const [draft, setDraft] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [pickError, setPickError] = useState<string | null>(null)
  /** O que está aberto pra editar: 'main' (nome, espécie, números), 'notes' ou o id de uma habilidade. */
  const [editing, setEditing] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const toggle = (id: string) => setEditing((cur) => (cur === id ? null : id))

  if (!c.has) {
    return (
      <section className="alth-card alth-pet-empty">
        <div className="alth-card__header"><h4 className="alth-card__title">Companheiro</h4></div>
        <span className="alth-pet__ghost"><PawIcon /></span>
        <p>Um lobo criado desde filhote, um corvo treinado, um urso domado. O companheiro não tem turno próprio: age quando você gasta a Ação Bônus pra Comandar. Cada personagem tem só um.</p>
        {canEdit && (
          <div className="alth-pet__row">
            <button type="button" className="btn btn-primary" onClick={() => onChange(newWolf())}>Adicionar lobo (modelo do livro)</button>
            <button type="button" className="btn btn-ghost" onClick={() => { onChange({ ...NO_COMPANION, has: true, species: '', abilities: [], damage: '1d6', attack_bonus: 0 }); setEditing('main') }}>Outro animal, em branco</button>
          </div>
        )}
      </section>
    )
  }

  const max = woundsMax(c)
  const learned = learnedCount(c)
  const set = (patch: Partial<Companion>) => onChange({ ...c, ...patch })
  const num = (v: string, min: number, maxV: number, fallback: number) => {
    const n = Math.trunc(Number(v))
    return Number.isFinite(n) ? Math.max(min, Math.min(maxV, n)) : fallback
  }

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPickError(null)
    if (!ALTHERIUM_PORTRAIT_TYPES.includes(file.type as (typeof ALTHERIUM_PORTRAIT_TYPES)[number])) { setPickError('Escolha uma imagem JPG, PNG ou WebP.'); return }
    if (file.size > ALTHERIUM_PORTRAIT_MAX_BYTES) { setPickError('A foto deve ter no máximo 2 MB.'); return }
    setDraft(file)
  }

  async function savePhoto(file: File) {
    setBusy(true)
    try {
      set({ photo_url: await uploadPhoto(file) })
      setDraft(null)
    } catch (err) {
      setDraft(null)
      void alertDialog(err instanceof Error ? err.message : 'Não deu pra enviar a foto.')
    } finally { setBusy(false) }
  }

  async function dropPhoto() {
    setBusy(true)
    try { await removePhoto(); set({ photo_url: null }) } catch (err) { void alertDialog(err instanceof Error ? err.message : 'Não deu pra remover a foto.') } finally { setBusy(false) }
  }

  function patchAbility(id: string, patch: Partial<CompanionAbility>) {
    set({ abilities: c.abilities.map((a) => (a.id === id ? { ...a, ...patch } : a)) })
  }

  function addAbility() {
    const id = newAbilityId()
    set({ abilities: [...c.abilities, { id, name: '', description: '', usage: '', learned: true, used: false }] })
    setEditing(id)
  }

  function addFromWolf() {
    const have = new Set(c.abilities.map((a) => a.name.trim().toLowerCase()))
    const extra = wolfAbilities().filter((a) => !have.has(a.name.toLowerCase())).map((a) => ({ ...a, learned: false }))
    if (extra.length) set({ abilities: [...c.abilities, ...extra] })
  }

  function kill() {
    ask({
      title: 'O companheiro morreu', tone: 'danger', confirmLabel: 'Confirmar',
      message: `${c.name || 'O companheiro'} morre. Você perde 2d6 de Equilíbrio na hora e fica com −1 dado em Vontade até o próximo Descanso Longo.`,
    }, () => {
      const loss = griefLoss()
      onChange(die(c))
      onEquilibriumLoss(loss)
      void alertDialog(`${c.name || 'O companheiro'} morreu. Você perdeu ${loss} de Equilíbrio e fica com −1 dado em Vontade até o próximo Descanso Longo.`)
    })
  }

  function remove() {
    ask({ title: 'Remover companheiro', tone: 'danger', confirmLabel: 'Remover', message: 'Remover o companheiro e tudo o que está na ficha dele? Isso não é a morte (não tira Equilíbrio).' }, () => {
      if (c.photo_url) void removePhoto().catch(() => { /* a foto só fica órfã no armazenamento */ })
      setEditing(null)
      onChange({ ...NO_COMPANION, abilities: [] })
    })
  }

  const dis = !canEdit
  const editMain = canEdit && editing === 'main'
  const editNotes = canEdit && editing === 'notes'

  return (
    <div className="alth-tab-panel alth-ficha alth-pet">
      <div className="alth-ficha__main">
        <section className="alth-card">
          <div className="alth-card__header alth-pet__head">
            <h4 className="alth-card__title">Companheiro</h4>
            {canEdit && <Pencil on={editMain} onClick={() => toggle('main')} label="Editar nome, espécie e números" />}
          </div>
          <div className="alth-pet__top">
            <div className="alth-pet__photo-wrap">
              <label className={`alth-pet__photo${dis ? ' is-ro' : ''}`}>
                {c.photo_url ? <img src={c.photo_url} alt="" /> : <PawIcon />}
                {!dis && <span className="alth-pet__photo-over">Trocar foto</span>}
                {!dis && <input ref={fileRef} type="file" hidden accept={ALTHERIUM_PORTRAIT_TYPES.join(',')} disabled={busy} onChange={pick} aria-label="Foto do companheiro" />}
              </label>
              {c.photo_url && !dis && (
                <button type="button" className="alth-hero__portrait-remove" onClick={() => void dropPhoto()} disabled={busy} aria-label="Remover foto do companheiro">×</button>
              )}
              {pickError && <p className="alth-hero__portrait-error" role="alert">{pickError}</p>}
            </div>
            <div className="alth-pet__ident">
              {editMain ? (
                <>
                  <input className="alth-hero__name" placeholder="Nome do companheiro" maxLength={60} value={c.name} onChange={(e) => set({ name: e.target.value })} aria-label="Nome do companheiro" />
                  <div className="alth-pet__row">
                    <label className="alth-pet__field"><span>Espécie</span><input className="alth-pet__in" maxLength={40} value={c.species} onChange={(e) => set({ species: e.target.value })} placeholder="Lobo, corvo, urso..." /></label>
                    <label className="alth-pet__field alth-pet__field--xs"><span>Feridas até cair</span>
                      <input type="number" className="alth-pet__in" min={1} max={20} placeholder="Padrão 2" value={c.wounds_max ?? ''} onChange={(e) => set({ wounds_max: e.target.value === '' ? null : num(e.target.value, 1, 20, max) })} />
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <h3 className={`alth-pet__name${c.name ? '' : ' is-empty'}`}>{c.name || 'Sem nome'}</h3>
                  <p className="alth-pet__hint alth-pet__hint--first">{c.species || 'Animal'} · aguenta {max} {max === 1 ? 'ferida' : 'feridas'}</p>
                </>
              )}
            </div>
          </div>

          <div className="alth-pet__states" role="group" aria-label="Estado do companheiro">
            {STATE_ORDER.map((s) => (
              <button key={s} type="button" disabled={dis} className={`alth-pet__state alth-pet__state--${s}${c.state === s ? ' is-on' : ''}`} onClick={() => set({ state: s, stable: s === 'caido' ? c.stable : false })}>{STATE_LABEL[s]}</button>
            ))}
          </div>
          <p className="alth-pet__hint">
            {c.state === 'protegido' && 'Protegido, junto de você: não pode ser atacado.'}
            {c.state === 'exposto' && 'Exposto até o início do seu próximo turno: os inimigos podem atacá-lo.'}
            {c.state === 'caido' && (c.stable ? 'Caído e estabilizado: fora de perigo.' : 'Caído: estabilize até o fim do seu próximo turno (Medicina + Estratégia) ou ele morre.')}
            {c.state === 'morto' && 'Morto. Mude o estado se quiser reverter.'}
          </p>

          <div className="alth-pet__wounds">
            <span className="alth-pet__label">Feridas</span>
            <Pips value={Math.min(c.wounds, max)} max={max} tone="danger" label="Feridas do companheiro" onChange={dis ? undefined : (n) => set({ wounds: n })} />
            <span className="alth-pet__hint">{c.wounds} de {max}{c.wounds >= max ? ' · caiu' : ''}</span>
          </div>

          {editMain ? (
            <div className="alth-pet__stats">
              <label className="alth-pet__stat"><small>Defesa fixa</small>
                <input type="number" className="alth-pet__in" min={0} max={40} value={c.defense} onChange={(e) => set({ defense: num(e.target.value, 0, 40, c.defense) })} />
              </label>
              <div className="alth-pet__stat"><small>Ataque · {attackText(c)}</small>
                <div className="alth-pet__pair">
                  <input type="number" className="alth-pet__in" min={1} max={10} value={c.attack_dice} onChange={(e) => set({ attack_dice: num(e.target.value, 1, 10, c.attack_dice) })} aria-label="Dados de ataque (d10, o maior vale)" />
                  <span>d10 +</span>
                  <input type="number" className="alth-pet__in" min={-10} max={20} value={c.attack_bonus} onChange={(e) => set({ attack_bonus: num(e.target.value, -10, 20, c.attack_bonus) })} aria-label="Bônus de ataque" />
                </div>
              </div>
              <div className="alth-pet__stat alth-pet__stat--wide"><small>Dano · {damageText(c)}{c.damage_name ? `, ${c.damage_name}` : ''}</small>
                <div className="alth-pet__pair">
                  <input className="alth-pet__in" maxLength={20} value={c.damage} onChange={(e) => set({ damage: e.target.value })} aria-label="Dano" />
                  <input className="alth-pet__in alth-pet__in--xs" maxLength={8} value={c.damage_type} onChange={(e) => set({ damage_type: e.target.value })} aria-label="Tipo de dano" placeholder="P" />
                  <input className="alth-pet__in" maxLength={30} value={c.damage_name} onChange={(e) => set({ damage_name: e.target.value })} aria-label="Nome do golpe" placeholder="mordida" />
                </div>
              </div>
            </div>
          ) : (
            <div className="alth-pet__tiles">
              <div className="alth-pet__tile"><b>{c.defense}</b><small>Defesa</small></div>
              <div className="alth-pet__tile"><b>{attackText(c)}</b><small>Ataque</small></div>
              <div className="alth-pet__tile"><b>{damageText(c)}</b><small>Dano{c.damage_name ? ` · ${c.damage_name}` : ''}</small></div>
            </div>
          )}
          <div className="alth-pet__acts">
            <button type="button" className="btn btn-primary" disabled={dis || c.state !== 'protegido'} onClick={() => onChange(command(c))} title="Gasta sua Ação Bônus. Ele fica Exposto até o início do seu próximo turno.">Comandar</button>
            <button type="button" className="btn btn-ghost" disabled={dis || c.state !== 'exposto'} onClick={() => onChange(recall(c))}>Recolher (início do turno)</button>
            <button type="button" className="btn btn-ghost" disabled={dis || c.state === 'morto'} onClick={() => onChange(wound(c))} title="O ataque do inimigo superou a Defesa: 1 ferida">Ferir −1</button>
            <button type="button" className="btn btn-ghost" disabled={dis || c.state === 'morto'} onClick={() => onChange(wound(c, 2))} title="Crítico: 2 feridas">Crítico −2</button>
            <button type="button" className="btn btn-ghost" disabled={dis || c.state === 'morto' || c.wounds === 0} onClick={() => onChange(heal(c))} title="Bandagem ou qualquer cura remove 1 ferida">Curar +1</button>
          </div>
        </section>

        <section className="alth-card">
          <div className="alth-card__header"><h4 className="alth-card__title">Perigo</h4></div>
          <div className="alth-pet__list">
            <div className="alth-pet__item">
              <div><strong>Fome</strong><small>No Descanso Longo o companheiro come 1 Ração. Sem comer, não recupera feridas.</small></div>
              <label className="alth-pet__check"><input type="checkbox" checked={c.fed} disabled={dis} onChange={(e) => set({ fed: e.target.checked })} /> Comeu</label>
            </div>
            <div className="alth-pet__item">
              <div><strong>Caído</strong><small>Estabilizar: Medicina + Estratégia, até o fim do próximo turno do dono.</small></div>
              <button type="button" className="btn btn-ghost" disabled={dis || c.state !== 'caido' || c.stable} onClick={() => onChange(stabilize(c))}>Estabilizou</button>
            </div>
            <div className="alth-pet__item">
              <div><strong>Perda</strong><small>Se morrer: o dono perde 2d6 de Equilíbrio e fica com −1 dado em Vontade até o Descanso Longo.</small>{c.grief && <em className="alth-pet__grief">Luto ativo: −1 dado em Vontade</em>}</div>
              <button type="button" className="btn btn-ghost alth-pet__danger" disabled={dis || c.state === 'morto'} onClick={kill}>Morreu</button>
            </div>
            <div className="alth-pet__item">
              <div><strong>Descanso Longo</strong><small>Cura todas as feridas se comeu a Ração, e acaba o luto.</small></div>
              <button type="button" className="btn btn-ghost" disabled={dis} onClick={() => onChange(longRest(c))}>Descansar</button>
            </div>
          </div>
        </section>
      </div>

      <div className="alth-ficha__side">
        <section className="alth-card">
          <div className="alth-card__header"><h4 className="alth-card__title">Habilidades ({learned})</h4></div>
          <p className="alth-pet__hint alth-pet__hint--first">Marque as que o companheiro já tem; o resto fica guardado aqui.</p>
          <div className="alth-pet__list" style={{ marginTop: 10 }}>
            {c.abilities.map((a) => {
              const open = canEdit && editing === a.id
              return (
                <div key={a.id} className={`alth-pet__ability${a.learned ? '' : ' is-off'}`}>
                  {open ? (
                    <>
                      <div className="alth-pet__ability-head">
                        <input className="alth-pet__in alth-pet__in--name" maxLength={60} value={a.name} onChange={(e) => patchAbility(a.id, { name: e.target.value })} placeholder="Nome" aria-label="Nome da habilidade" />
                        <input className="alth-pet__in alth-pet__in--use" maxLength={40} value={a.usage} onChange={(e) => patchAbility(a.id, { usage: e.target.value })} placeholder="Passiva, Usar, Usar · 1x por cena" aria-label="Quando usa" />
                        <button type="button" className="alth-pet__x" aria-label={`Apagar ${a.name || 'habilidade'}`} onClick={() => { setEditing(null); set({ abilities: c.abilities.filter((x) => x.id !== a.id) }) }}>×</button>
                        <Pencil on onClick={() => toggle(a.id)} label="Editar habilidade" />
                      </div>
                      <textarea className="alth-pet__in alth-pet__text" rows={3} maxLength={400} value={a.description} onChange={(e) => patchAbility(a.id, { description: e.target.value })} placeholder="O que ela faz" aria-label="Descrição da habilidade" />
                    </>
                  ) : (
                    <>
                      <div className="alth-pet__ability-head">
                        <label className="alth-pet__check" title="O companheiro tem esta habilidade"><input type="checkbox" checked={a.learned} disabled={dis} onChange={(e) => patchAbility(a.id, { learned: e.target.checked })} /></label>
                        <strong className="alth-pet__ability-name">{a.name || 'Sem nome'}</strong>
                        {a.usage && <span className="alth-pet__pill">{a.usage}</span>}
                        {/por cena/i.test(a.usage) && <button type="button" className={`alth-pet__chip${a.used ? ' is-used' : ''}`} disabled={dis} onClick={() => patchAbility(a.id, { used: !a.used })}>{a.used ? 'Usada' : 'Livre'}</button>}
                        <span className="alth-pet__grow" />
                        {canEdit && <Pencil on={false} onClick={() => toggle(a.id)} label={`Editar ${a.name || 'habilidade'}`} />}
                      </div>
                      {a.description && <p className="alth-pet__ability-text">{a.description}</p>}
                    </>
                  )}
                </div>
              )
            })}
            {c.abilities.length === 0 && <p className="alth-pet__hint">Nenhuma habilidade ainda.</p>}
          </div>
          {!dis && (
            <div className="alth-pet__row" style={{ marginTop: 10 }}>
              <button type="button" className="btn btn-ghost" onClick={addAbility}>+ Habilidade</button>
              <button type="button" className="btn btn-ghost" onClick={addFromWolf}>+ As do lobo</button>
            </div>
          )}
        </section>
        <section className="alth-card">
          <div className="alth-card__header alth-pet__head">
            <h4 className="alth-card__title">Anotações do bicho</h4>
            {canEdit && <Pencil on={editNotes} onClick={() => toggle('notes')} label="Editar anotações" />}
          </div>
          {editNotes ? (
            <textarea className="alth-pet__in alth-pet__text" rows={4} maxLength={600} value={c.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Temperamento, truques, como vocês se conheceram..." aria-label="Anotações do companheiro" />
          ) : (
            <p className={`alth-pet__ability-text${c.notes ? '' : ' is-empty'}`}>{c.notes || 'Temperamento, truques, como vocês se conheceram...'}</p>
          )}
          {!dis && <div style={{ marginTop: 10 }}><button type="button" className="btn btn-ghost alth-pet__danger" onClick={remove}>Remover companheiro</button></div>}
        </section>
      </div>

      <Presence show={!!draft} exitMs={220}>
        {() => draft && (
          <AvatarCropEditor
            file={draft} saving={busy} onCancel={() => setDraft(null)} onSave={savePhoto}
            title="Ajustar foto do companheiro" description="Escolha o enquadramento que aparece na aba e na bolinha do retrato."
            confirmLabel="Usar esta foto"
          />
        )}
      </Presence>
    </div>
  )
}
