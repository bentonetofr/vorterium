// ────────────────────────────────────────────────────────
// Teste dos dados 3D (só no `npm run dev`; fora do build): /testes/dados.html
// Rola cada tipo de dado na bandeja, mistura, o d20 do painel e a vantagem,
// em qualquer conjunto. O valor sorteado aparece embaixo para conferir com a
// face de cima de cada dado.
// ────────────────────────────────────────────────────────
import { DiceStage, diceStageSupported, type StageDie } from '../src/features/dice3d/DiceStage'
import { facesCount, type DieKind } from '../src/features/dice3d/polyhedra'
import { DICE_SKINS } from '../src/features/dice3d/skins'
import { setDiceSoundMuted } from '../src/features/dice3d/sound'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const out = $('out')
const skinSel = $<HTMLSelectElement>('skin')
for (const s of DICE_SKINS) skinSel.add(new Option(s.name, s.id))
$<HTMLInputElement>('mute').addEventListener('change', (e) => setDiceSoundMuted((e.target as HTMLInputElement).checked))

if (!diceStageSupported()) out.textContent = 'Sem WebGL (ou "reduzir movimento" ligado): a ficha usaria o modo simples.'

const tray = new DiceStage($('tray'), 'tray')
const stage = new DiceStage($('stage'), 'stage')
;(window as unknown as { __dados: unknown }).__dados = { tray, stage }

function roll(kind: DieKind): number {
  const n = facesCount(kind)
  const r = 1 + Math.floor(Math.random() * n)
  if (kind === 'd100') return (r - 1) * 10
  return r
}

async function throwOn(target: DiceStage, dice: StageDie[]) {
  out.textContent = `rolando: ${dice.map((d) => `${d.kind}=${d.value}${d.dim ? ' (descartado)' : ''}`).join('  ')}`
  const t0 = performance.now()
  await target.roll(dice, { skin: skinSel.value })
  const shown = target.readFaces()
  const want = dice.map((d) => (d.kind === 'd100' ? (d.value === 0 ? '00' : String(d.value)) : d.kind === 'd10' ? String(d.value % 10) : String(d.value)))
  const ok = shown.every((x, i) => x === want[i])
  out.textContent += `\nparou em ${Math.round(performance.now() - t0)} ms\nfaces: ${shown.join('  ')}  ${ok ? '✓ batem com o sorteio' : '✗ NÃO BATEM'}`
}

const KINDS: DieKind[] = ['d4', 'd6', 'd8', 'd10', 'd100', 'd12', 'd20']
for (const k of KINDS) {
  const b = document.createElement('button')
  b.textContent = k === 'd100' ? 'd%' : k
  b.onclick = () => {
    const qty = Math.max(1, Math.min(20, Number($<HTMLInputElement>('qty').value) || 1))
    void throwOn(tray, Array.from({ length: qty }, () => ({ kind: k, value: roll(k) })))
  }
  $('kinds').appendChild(b)
}
$('mix').onclick = () => void throwOn(tray, KINDS.map((k) => ({ kind: k, value: roll(k) })))
$('d20').onclick = () => void throwOn(stage, [{ kind: 'd20', value: roll('d20') }])
$('adv').onclick = () => {
  const a = roll('d20'), b = roll('d20')
  void throwOn(stage, [{ kind: 'd20', value: a, dim: a < b }, { kind: 'd20', value: b, dim: b <= a }])
}
