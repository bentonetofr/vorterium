import { defineConfig } from 'vitest/config'

// Testes só do motor de regras de D&D (src/features/sheets/dnd/rules): lógica
// pura, sem React nem Supabase, onde um erro silencioso estraga uma mesa.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
