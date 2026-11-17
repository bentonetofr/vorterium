import { useCallback, useEffect, useRef, useState } from 'react'
import type { DhSheetData } from '../model/types'
import { saveDhSheet, subscribeToDhSheet, type DhSheet } from './dhSheetService'

// ────────────────────────────────────────────────────────
// Estado da ficha aberta: mudanças locais salvam sozinhas (depois de 700 ms sem mexer), mudanças de outro lugar
// (o mestre editando, outra aba) chegam pelo tempo real e entram se não há nada seu esperando para salvar.
// ────────────────────────────────────────────────────────

export type DhSaveStatus = 'ok' | 'salvando' | 'erro'

const SAVE_DELAY_MS = 700

export function useDhSheet(sheet: DhSheet) {
  const [data, setData] = useState<DhSheetData>(sheet.data)
  const [status, setStatus] = useState<DhSaveStatus>('ok')
  const [error, setError] = useState<string | null>(null)
  const dataRef = useRef(data)
  const dirty = useRef(false)
  const lastSaved = useRef(JSON.stringify(sheet.data))
  const timer = useRef<number | null>(null)
  const sheetId = sheet.id

  dataRef.current = data

  const flush = useCallback(async () => {
    if (!dirty.current) return
    const snapshot = dataRef.current
    const json = JSON.stringify(snapshot)
    setStatus('salvando')
    try {
      await saveDhSheet(sheetId, snapshot)
      lastSaved.current = json
      // se mexeram de novo durante o salvamento, continua sujo
      if (JSON.stringify(dataRef.current) === json) dirty.current = false
      setError(null)
      setStatus(dirty.current ? 'salvando' : 'ok')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar a ficha.')
      setStatus('erro')
    }
  }, [sheetId])

  const update = useCallback((fn: (d: DhSheetData) => DhSheetData) => {
    setData((prev) => {
      const next = fn(prev)
      if (next === prev) return prev
      dirty.current = true
      return next
    })
  }, [])

  // salva depois de um tempo parado
  useEffect(() => {
    if (!dirty.current) return
    setStatus('salvando')
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { void flush() }, SAVE_DELAY_MS)
    return () => { if (timer.current) window.clearTimeout(timer.current) }
  }, [data, flush])

  // mudanças vindas de fora (tempo real)
  useEffect(() => subscribeToDhSheet(sheetId, (s) => {
    const json = JSON.stringify(s.data)
    if (json === lastSaved.current || dirty.current) return
    lastSaved.current = json
    dataRef.current = s.data
    setData(s.data)
  }), [sheetId])

  // ao sair da ficha, grava o que faltava
  useEffect(() => () => { if (dirty.current) void saveDhSheet(sheetId, dataRef.current).catch(() => {}) }, [sheetId])

  return { data, update, status, error, flush }
}
