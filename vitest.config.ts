import { defineConfig } from 'vitest/config'

// Testes de lógica pura, sem React nem Supabase, onde um erro silencioso estraga
// uma mesa: o motor de regras de D&D (src/features/sheets/dnd/rules) e a rede do
// Vortable (src/features/vortable/net: mestre + 5 jogadores numa rede de mentira).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
