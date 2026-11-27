import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, clearSaveId, getSaveId, setSaveId } from './api.js'

const Ctx = createContext(null)

export function GameProvider({ children }) {
  const [saveId, setSaveIdState] = useState(() => getSaveId())
  const [game, setGame] = useState(null)
  const [loading, setLoading] = useState(!!getSaveId())
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  const notify = useCallback((message, tone = 'info') => {
    setToast({ message, tone, id: Date.now() })
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4200)
    return () => clearTimeout(t)
  }, [toast])

  const refresh = useCallback(async () => {
    if (!saveId) { setGame(null); setLoading(false); return null }
    try {
      const g = await api.get('/game')
      setGame(g)
      setError(null)
      return g
    } catch (e) {
      if (e.status === 401) {
        clearSaveId()
        setSaveIdState(null)
        setGame(null)
      } else {
        setError(e.message)
      }
      return null
    } finally {
      setLoading(false)
    }
  }, [saveId])

  useEffect(() => { refresh() }, [refresh])

  const selectSave = useCallback((id) => {
    setSaveId(id)
    setSaveIdState(id)
    setLoading(true)
    setGame(null)
  }, [])

  const leaveCareer = useCallback(() => {
    clearSaveId()
    setSaveIdState(null)
    setGame(null)
  }, [])

  const advance = useCallback(async (mode = 'next-match', days = 1) => {
    const res = await api.post('/advance', { mode, days })
    await refresh()
    return res
  }, [refresh])

  const value = useMemo(() => ({
    saveId, game, loading, error, toast, notify, refresh, selectSave, leaveCareer, advance,
    setGame,
  }), [saveId, game, loading, error, toast, notify, refresh, selectSave, leaveCareer, advance])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useGame() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useGame must be used inside GameProvider')
  return ctx
}
