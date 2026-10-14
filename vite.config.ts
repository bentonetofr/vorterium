import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// O painel de preview do Claude escolhe uma porta livre e a passa em PORT
// (autoPort). Sem PORT, valem as portas padrão do Vite (5173 e 4173).
const port = Number(process.env.PORT) || undefined

export default defineConfig({
  plugins: [react()],
  server:  { port },
  preview: { port },
})
