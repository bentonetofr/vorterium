import { DiceShowcase } from '../src/features/dice3d/DiceShowcase'
import { COLLECTION_SKINS } from '../src/features/dice3d/skins'
const host = document.getElementById('host')!
const solo = new URLSearchParams(location.search).get('solo')
if (solo) { host.style.gridTemplateColumns = '1fr'; host.style.minHeight = '0' }
const items = COLLECTION_SKINS.filter((s) => !solo || s.id === solo).map((s) => {
  const c = document.createElement('div'); c.className = 'c'; if (solo) c.style.height = '430px'
  const p = document.createElement('div'); p.className = 'p'; if (solo) p.style.height = '400px'
  const t = document.createElement('div'); t.className = 't'; t.textContent = `${s.name} · ${s.tier}`
  c.append(p, t); host.append(c)
  return { id: s.id, el: p }
})
const sc = new DiceShowcase(host)
const t0 = performance.now()
await sc.show(items)
;(window as unknown as { __ms: number }).__ms = Math.round(performance.now() - t0)
