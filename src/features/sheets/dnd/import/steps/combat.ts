import { hitDieOf } from '../../catalog'
import { deriveDraft, type Ctx } from '../ctx'
import { parseInt0 } from '../text'
import type { DraftClass } from '../types'

// ────────────────────────────────────────────────────────
// Etapa 9: pontos de vida (o máximo do PDF contra o que o sistema calcula
// pelo dado de vida e pela Constituição), dados de vida gastos, salvaguardas
// contra a morte, exaustão, inspiração e PV temporários.
// ────────────────────────────────────────────────────────

/** Em que posição de `hp_rolls` está o nível de classe `classLevel` (o nível 1 do personagem não rola). */
const rollIndex = (isInitial: boolean, classLevel: number) => classLevel - (isInitial ? 2 : 1)

interface LevelSlot { classIdx: number; index: number; die: number }

function rollableLevels(classes: readonly DraftClass[]): LevelSlot[] {
  const out: LevelSlot[] = []
  const order = [...classes.keys()].sort((a, b) => Number(classes[b].is_initial) - Number(classes[a].is_initial))
  for (const ci of order) {
    const row = classes[ci]
    const die = hitDieOf(row.class_key)
    if (!die) continue
    for (let l = 1; l <= row.level; l++) {
      if (row.is_initial && l === 1) continue
      out.push({ classIdx: ci, index: rollIndex(row.is_initial, l), die })
    }
  }
  return out
}

/** Acha as rolagens de PV por nível que fazem o máximo do sistema dar `target` (ou null se não dá). */
export function rollsForMaxHp(c: Ctx, target: number): DraftClass[] | null {
  const base = c.draft.classes
  const slots = rollableLevels(base)
  if (slots.length === 0) return null
  const rolls = slots.map((s) => Math.floor(s.die / 2) + 1)
  const build = (): DraftClass[] => {
    const out = base.map((r) => ({ ...r, hp_rolls: [] as number[] }))
    slots.forEach((s, i) => { out[s.classIdx].hp_rolls[s.index] = rolls[i] })
    return out
  }
  const maxWith = () => deriveDraft(c.existing, { ...c.draft, classes: build() }).derived.hpMax
  let cur = maxWith()
  for (let guard = 0; guard < 800 && cur != null && cur !== target; guard++) {
    const dir = target > cur ? 1 : -1
    // sobe ou desce o nível que ainda tem folga, em rodízio (as rolagens ficam o mais parecidas possível)
    const order = rolls.map((r, i) => ({ r, i })).filter(({ r, i }) => (dir > 0 ? r < slots[i].die : r > 1)).sort((a, b) => (dir > 0 ? a.r - b.r : b.r - a.r) || a.i - b.i)
    if (order.length === 0) return null
    rolls[order[0].i] += dir
    cur = maxWith()
  }
  return cur === target ? build() : null
}

function combat(c: Ctx): void {
  const f = c.draft.form
  const r = c.read.combat
  f.inspiration = c.read.inspiration
  f.death_save_successes = Math.min(3, r.deathSuccesses)
  f.death_save_failures = Math.min(3, r.deathFailures)
  const ex = parseInt0(r.exhaustion)
  f.exhaustion = ex != null ? Math.max(0, Math.min(6, ex)) : 0
  const temp = parseInt0(r.hpTemp)
  f.hp_temp = temp != null && temp > 0 ? Math.min(temp, 9999) : 0

  // PV máximo
  const pdfMax = parseInt0(r.hpMax)
  const sys = c.derive().derived.hpMax
  if (pdfMax != null && pdfMax > 0) {
    if (sys == null) { f.hp_max = Math.min(pdfMax, 9999); c.note(`PV máximo: ${pdfMax} (sem classe com dado de vida, vale o do PDF)`) }
    else if (sys !== pdfMax) {
      const solved = rollsForMaxHp(c, pdfMax)
      const pick = c.askChoice({
        id: 'hp', section: 'Pontos de vida', kind: 'choice',
        title: `PV máximo: o PDF diz ${pdfMax} e o sistema calcula ${sys}`,
        body: `O sistema soma o dado de vida de cada nível (a média, ou o valor rolado) e o modificador de Constituição. Como quer guardar os ${pdfMax} PV do PDF?`,
        options: [
          ...(solved ? [{ value: 'rolls', label: `Ajustar o PV rolado de cada nível para dar ${pdfMax}`, hint: 'Mantém o cálculo automático do sistema, com as rolagens de cada nível registradas.' }] : []),
          { value: 'manual', label: `Usar ${pdfMax} como valor manual`, hint: 'A ficha mostra MANUAL no PV máximo e não recalcula sozinha ao subir de nível.' },
          { value: 'average', label: `Usar o cálculo do sistema (${sys})`, hint: 'Pela média do dado de vida.' },
        ],
        recommended: solved ? 'rolls' : 'manual',
      })
      if (pick === 'rolls' && solved) { c.draft.classes = solved; c.note(`PV máximo ${pdfMax}: rolagens de PV por nível ajustadas`) }
      else if (pick === 'manual') { c.draft.overrides.push({ field_key: 'hp_max', manual_value: String(pdfMax), reason: 'Importado do PDF' }); f.hp_max = pdfMax; c.note(`PV máximo ${pdfMax} guardado como valor manual`) }
    }
  }
  const max = c.derive().derived.hpMax ?? f.hp_max
  f.hp_max = max
  const cur = parseInt0(r.hpCurrent)
  f.hp_current = cur == null ? max : Math.max(0, Math.min(max, cur))
  if (cur != null && cur > max) c.note(`PV atuais: o PDF diz ${cur}, mais que o máximo (${max}); ficou ${max}.`)

  // dados de vida: gastos = total - restantes
  const dice = c.derive().derived.hitDice
  const used: Record<string, number> = {}
  for (const [dieText, totalNum] of Object.entries(dice)) {
    const die = Number(dieText)
    const row = r.hitDice.find((h) => parseInt0(h.die.replace(/^d/i, '')) === die)
    if (!row) continue
    const left = parseInt0(row.left)
    if (left == null) continue
    const pdfTotal = parseInt0(row.total)
    let remaining = Math.max(0, Math.min(totalNum, left))
    if (pdfTotal != null && pdfTotal !== totalNum) {
      remaining = c.askNumber({
        id: `hitdice:${die}`, section: 'Pontos de vida', kind: 'number',
        title: `Quantos dados de vida d${die} ainda restam?`,
        body: `No PDF o total é ${pdfTotal} e restam ${row.left}, mas pelo nível o personagem tem ${totalNum} d${die}.`,
        min: 0, max: totalNum, defaultValue: Math.min(totalNum, left), unit: `de ${totalNum}`,
      })
    }
    if (totalNum - remaining > 0) used[String(die)] = totalNum - remaining
  }
  f.hit_dice_used = used
}

export const COMBAT_STEPS = [combat]
