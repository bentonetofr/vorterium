// Teste do cartão de conquista (só no `npm run dev`): /testes/conquista.html?skin=magma
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import { Presence } from '../src/shared/components/Presence'
import { UnlockCard } from '../src/features/collection/UnlockCard'
import { achievementForSkin } from '../src/features/collection/achievements'
import { COLLECTION_SKINS } from '../src/features/dice3d/skins'
import { CollectionProgress, LockedSkins } from '../src/features/collection/LockedSkins'
import '../src/features/sheets/dnd/rolls/DndDiceWindow.css'

function App() {
  const first = new URLSearchParams(location.search).get('skin') ?? 'vortice'
  const [skin, setSkin] = useState(first)
  const [open, setOpen] = useState(true)
  const a = achievementForSkin(skin)!
  return (
    <div style={{ minHeight: '100vh', padding: 12, color: '#eee' }}>
      <select value={skin} onChange={(e) => { setSkin(e.target.value); setOpen(false); setTimeout(() => setOpen(true), 400) }}>
        {COLLECTION_SKINS.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.tier}</option>)}
      </select>
      <button onClick={() => { setOpen(false); setTimeout(() => setOpen(true), 400) }}>de novo</button>
      <div className="ddw" style={{ marginTop: 330, maxWidth: 760 }}>
        <CollectionProgress unlocked={new Set(['osso', 'magma', 'ferro'])} loaded />
        <ul className="ddw-skins"><LockedSkins unlocked={new Set(['osso', 'magma', 'ferro'])} loaded /></ul>
      </div>
      <div className="uc-wrap">
        <Presence show={open} exitMs={260}>{() => <UnlockCard key={skin} event={{ skin, achievement: a.id, title: a.title, at: 0 }} onClose={() => setOpen(false)} />}</Presence>
      </div>
    </div>
  )
}
createRoot(document.getElementById('root')!).render(<App />)
