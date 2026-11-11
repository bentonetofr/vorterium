// ────────────────────────────────────────────────────────
// Prévia da Lore (só no `npm run dev`): /testes/lore.html
//   ?vista=jogador (padrão) | mestre     ?sistema=altherium (padrão) | dnd5e     ?largura=420
// Banco e storage falsos na memória, com uma sessão falsa do usuário "user-1".
// ────────────────────────────────────────────────────────
import { seedFakeDb } from './_ficha-viva-db'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import '../src/shared/theme/motion.css'
import '../src/shared/theme/refine.css'
import '../src/features/sheets/components/SheetPanel.css'
import '../src/features/sheets/altherium/components/AltheriumSheet.css'

const params = new URLSearchParams(location.search)
if (!params.has('storage')) {
  params.set('storage', '1')
  history.replaceState(null, '', `${location.pathname}?${params}`)
}

// Sessão falsa guardada antes de o cliente do Supabase ler o armazenamento.
const ref = new URL(import.meta.env.VITE_SUPABASE_URL as string).hostname.split('.')[0]
const user = { id: 'user-1', aud: 'authenticated', role: 'authenticated', email: 'jogador@teste.dev', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({
  access_token: 'fake', refresh_token: 'fake', token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, user,
}))

const now = Date.now()
const ago = (min: number) => new Date(now - min * 60000).toISOString()
const sistema = (params.get('sistema') ?? 'altherium') as 'altherium' | 'dnd5e'
const table = sistema === 'altherium' ? 'altherium_character_sheets' : 'dnd_character_sheets'
const mk = (id: string, name: string, player: string, uid: string) => ({
  id, campaign_id: 'camp-1', user_id: uid, character_name: name, player_name: player, portrait_url: null, is_npc: false, created_at: ago(5000),
  profiles: { id: uid, display_name: player, email: `${uid}@x.dev`, avatar_url: null },
})
const STORY = 'Gutris nasceu em uma noite sem lua, nas encostas de Saltmore, quando o vento carregava o cheiro de ferro e de sangue velho.\n\nSua mãe era ferreira; seu pai, um caçador que nunca voltou da última trilha. Aprendeu cedo que o martelo e a lança têm a mesma fome.\n\nHoje caminha com a certeza de que a morte o escolheu por um motivo, e pretende descobrir qual.'

seedFakeDb({
  [table]: [mk('sheet-1', 'Gutris, O Nascido da Morte', 'Betinha', 'user-1'), mk('sheet-2', 'Mira Corvo', 'Lucas', 'user-2'), mk('sheet-3', 'Thorn', 'Ana', 'user-3'), mk('sheet-4', 'Selene', 'Rui', 'user-4')],
  character_lores: [
    { id: 'l1', campaign_id: 'camp-1', sheet_id: 'sheet-1', system: sistema, user_id: 'user-1', body: STORY, created_at: ago(900), updated_at: ago(20) },
    { id: 'l2', campaign_id: 'camp-1', sheet_id: 'sheet-2', system: sistema, user_id: 'user-2', body: 'Mira cresceu entre ladrões nas docas, aprendendo a ler nomes e a esquecer rostos.', created_at: ago(300), updated_at: ago(5) },
    { id: 'l3', campaign_id: 'camp-1', sheet_id: 'sheet-3', system: sistema, user_id: 'user-3', body: '', created_at: ago(300), updated_at: ago(2000) },
  ],
  character_lore_files: [
    { id: 'f1', campaign_id: 'camp-1', sheet_id: 'sheet-1', user_id: 'user-1', name: 'Gutris - historia completa.pdf', path: 'camp-1/user-1/a-historia.pdf', mime: 'application/pdf', size_bytes: 482113, created_at: ago(60) },
    { id: 'f2', campaign_id: 'camp-1', sheet_id: 'sheet-1', user_id: 'user-1', name: 'notas.txt', path: 'camp-1/user-1/b-notas.txt', mime: 'text/plain', size_bytes: 1830, created_at: ago(45) },
    { id: 'f3', campaign_id: 'camp-1', sheet_id: 'sheet-4', user_id: 'user-4', name: 'Selene.docx', path: 'camp-1/user-4/c-selene.docx', mime: null, size_bytes: 23500, created_at: ago(8) },
  ],
})

;(async () => {
  const { AuthProvider } = await import('../src/features/auth/AuthProvider')
  const { LoreEditor } = await import('../src/features/lore/LoreEditor')
  const { LoresPanel } = await import('../src/features/lore/LoresPanel')
  const { DialogHost } = await import('../src/shared/components/dialogs')
  const { supabase } = await import('../src/shared/lib/supabase')
  // arquivo de exemplo no storage falso
  await supabase.storage.from('character-lores').upload('camp-1/user-1/b-notas.txt', new Blob(['Anotações soltas do Gutris:\n- o martelo da mãe\n- a trilha do pai\n- o sonho com o lobo branco'], { type: 'text/plain' }))
  const width = Number(params.get('largura')) || undefined
  const vista = params.get('vista') ?? 'jogador'
  const campaign = { id: 'camp-1', system: sistema, role: 'master' } as never
  createRoot(document.getElementById('root')!).render(
    <AuthProvider>
      <DialogHost />
      <div style={{ padding: 16, width: '100%', maxWidth: width ?? 1100, margin: '0 auto' }}>
        {vista === 'mestre'
          ? <LoresPanel campaign={campaign} />
          : <LoreEditor campaignId="camp-1" sheetId="sheet-1" ownerId="user-1" system={sistema} characterName="Gutris, O Nascido da Morte" quill={sistema === 'altherium'} />}
      </div>
    </AuthProvider>,
  )
})()
