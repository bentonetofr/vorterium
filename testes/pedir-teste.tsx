// ────────────────────────────────────────────────────────
// Teste do botão "Pedir teste" do mestre (só no `npm run dev`; fora do build):
// /testes/pedir-teste.html. Sem banco: a lista de pedidos abertos fica vazia.
// ────────────────────────────────────────────────────────
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import '../src/features/sheets/dnd/components/DndSheet.css'
import { DndCheckRequestCard } from '../src/features/sheets/dnd/rolls/DndCheckRequestCard'

createRoot(document.getElementById('root')!).render(
  <div style={{ padding: 24, maxWidth: 900 }}>
    <DndCheckRequestCard campaignId="c" players={[{ userId: 'a', name: 'Zé Capivara' }, { userId: 'b', name: 'Lyra' }, { userId: 'c', name: 'Grum' }]} />
    <p style={{ color: '#aaa' }}>(aqui embaixo ficam as fichas)</p>
  </div>,
)
