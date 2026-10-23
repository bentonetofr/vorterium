// ────────────────────────────────────────────────────────
// Prévia do aviso de patch (só no `npm run dev`; fora do build):
// /testes/patch.html. Sem login: mostra o cartão direto, sem a marca de "visto".
// ────────────────────────────────────────────────────────
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import { PatchCard } from '../src/features/patch/PatchNotice'

createRoot(document.getElementById('root')!).render(
  <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', padding: 16 }}>
    <PatchCard onFinish={() => location.reload()} />
  </div>,
)
