import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import {
  ArrowRight, Check, Loader2, Play, Plus, Shield, Star, Trash2, Trophy, Users, Globe2, Sparkles,
} from 'lucide-react'
import { api } from '../api.js'
import { useGame } from '../store.jsx'
import ClubBadge from '../components/ClubBadge.jsx'
import { Btn, Chip, Field, Input, Panel, Spinner } from '../components/ui.jsx'
import { money } from '../lib/format.js'

function Stars({ rep }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={9} className={clsx(i <= Math.round(rep / 2) ? 'fill-amber-300 text-amber-300' : 'text-white/15')} />
      ))}
    </div>
  )
}

export default function Start() {
  const navigate = useNavigate()
  const { selectSave } = useGame()
  const [boot, setBoot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [leagueId, setLeagueId] = useState(null)
  const [clubId, setClubId] = useState(null)
  const [manager, setManager] = useState('')
  const [slot, setSlot] = useState(1)
  const [starting, setStarting] = useState(false)
  const [mode, setMode] = useState('new')
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    api.get('/bootstrap').then((b) => {
      if (!alive) return
      setBoot(b)
      setLeagueId(b.leagues[0]?.id)
      if (b.saves.length) setMode('continue')
      const used = new Set(b.saves.map((s) => s.slot))
      setSlot([1, 2, 3].find((n) => !used.has(n)) || 1)
    }).catch((e) => setError(e.message)).finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  const league = useMemo(() => boot?.leagues.find((l) => l.id === leagueId), [boot, leagueId])
  const club = useMemo(() => league?.clubs.find((c) => c.id === clubId) || null, [league, clubId])

  async function begin() {
    if (!club || !manager.trim()) return
    setStarting(true)
    setError(null)
    try {
      const res = await api.post('/career', { clubId: club.id, managerName: manager.trim(), slot })
      selectSave(res.saveId)
      navigate('/dashboard')
    } catch (e) {
      setError(e.message)
      setStarting(false)
    }
  }

  async function removeSave(id) {
    try {
      await api.del(`/saves/${id}`)
      const b = await api.get('/bootstrap')
      setBoot(b)
      if (!b.saves.length) setMode('new')
    } catch (e) { setError(e.message) }
  }

  if (loading) return <div className="min-h-screen"><Spinner label="Loading the football world" /></div>
  if (!boot) return <div className="min-h-screen p-10 text-white/60">{error || 'Unable to load'}</div>

  return (
    <div className="relative z-10 min-h-screen overflow-hidden">
      {/* cinematic background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-18%] h-[520px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(61,123,255,.28),transparent_65%)] blur-2xl" />
        <div className="absolute bottom-[-20%] right-[-10%] h-[620px] w-[720px] rounded-full bg-[radial-gradient(ellipse,rgba(139,92,246,.20),transparent_65%)] blur-2xl" />
        <svg viewBox="0 0 1440 900" className="absolute inset-0 h-full w-full opacity-[0.22]" preserveAspectRatio="xMidYMax slice">
          <defs>
            <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9fc0ff" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#9fc0ff" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="pitchGlow">
              <stop offset="0%" stopColor="#3d7bff" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#3d7bff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="720" cy="920" rx="760" ry="300" fill="url(#pitchGlow)" />
          <path d="M-100 780 Q720 560 1540 780 L1540 900 L-100 900 Z" fill="#0a1120" opacity="0.9" />
          <path d="M-100 780 Q720 560 1540 780" stroke="#5b8cff" strokeOpacity="0.25" fill="none" />
          <path d="M60 700 Q720 500 1380 700" stroke="#8b5cf6" strokeOpacity="0.18" fill="none" />
          <path d="M-60 820 Q720 620 1500 820" stroke="#ffffff" strokeOpacity="0.07" fill="none" />
          <g opacity="0.5">
            <path d="M180 0 L300 0 L120 640 L0 640 Z" fill="url(#beam)" opacity="0.35" />
            <path d="M1180 0 L1300 0 L1400 640 L1280 640 Z" fill="url(#beam)" opacity="0.28" />
          </g>
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={i} x1={120 + i * 300} y1="900" x2={430 + i * 190} y2="560" stroke="#ffffff" strokeOpacity="0.035" />
          ))}
        </svg>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,13,.2),rgba(5,7,13,.75)_60%,#05070d)]" />
      </div>

      <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-6 sm:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#3d7bff] to-[#8b5cf6] shadow-glow">
              <span className="display text-[18px] leading-none text-white">UFM</span>
            </div>
            <div>
              <div className="display text-[19px] leading-none tracking-wide">Ultimate Football Manager</div>
              <div className="mt-1 text-[9.5px] font-semibold uppercase tracking-[0.3em] text-white/35">FC 27 · Career Mode</div>
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Chip tone="electric"><Globe2 size={11} /> 5 leagues</Chip>
            <Chip><Shield size={11} /> {boot.meta.clubs} clubs</Chip>
            <Chip><Users size={11} /> {boot.meta.players.toLocaleString()} players</Chip>
          </div>
        </div>

        <div className="mt-10 grid items-start gap-10 lg:mt-14 lg:grid-cols-[1.02fr_0.98fr] xl:gap-16">
          {/* hero */}
          <div className="animate-rise">
            <div className="kicker mb-4 flex items-center gap-2 text-[#9fc0ff]">
              <span className="h-px w-8 bg-[#9fc0ff]/50" /> The world's game. Your club.
            </div>
            <h1 className="display text-[64px] leading-[0.86] sm:text-[86px] xl:text-[104px]">
              <span className="block text-white/95">Ultimate</span>
              <span className="block bg-gradient-to-r from-[#7ea6ff] via-[#a78bfa] to-[#d9c7ff] bg-clip-text text-transparent glow-text">Football</span>
              <span className="block text-white/95">Manager</span>
            </h1>
            <p className="mt-6 max-w-[520px] text-[14.5px] leading-relaxed text-white/50">
              Take control of a real club. Build the squad, master the market and chase silverware across
              Europe's five major leagues. Every rating, every player, every transfer — <span className="text-white/80">EA SPORTS FC 27</span>.
            </p>

            <div className="mt-8 grid max-w-[560px] grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['5', 'Major leagues'],
                ['198', 'Real clubs'],
                ['5,447', 'FC 27 players'],
                ['∞', 'Seasons'],
              ].map(([v, l]) => (
                <div key={l} className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
                  <div className="display text-[24px] leading-none text-white/90">{v}</div>
                  <div className="mt-1 text-[9.5px] uppercase tracking-[0.14em] text-white/35">{l}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/30">
              <span>Premier League</span><span className="h-1 w-1 rounded-full bg-white/20" />
              <span>LaLiga</span><span className="h-1 w-1 rounded-full bg-white/20" />
              <span>Bundesliga</span><span className="h-1 w-1 rounded-full bg-white/20" />
              <span>Serie A</span><span className="h-1 w-1 rounded-full bg-white/20" />
              <span>Ligue 1</span>
            </div>

            <div className="mt-10 hidden items-center gap-2 text-[11px] text-white/25 lg:flex">
              <Sparkles size={12} /> Ratings sourced from the EA SPORTS FC 27 player database, with current club moves applied.
            </div>
          </div>

          {/* career panel */}
          <Panel className="relative overflow-hidden p-5 sm:p-6">
            {club && (
              <div className="pointer-events-none absolute -right-16 -top-16 opacity-[0.07]">
                <ClubBadge club={club} size={260} />
              </div>
            )}
            <div className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <div className="kicker mb-1.5">Career</div>
                  <h2 className="display text-[28px] leading-none">{mode === 'continue' ? 'Your careers' : 'Start your career'}</h2>
                </div>
                {boot.saves.length > 0 && (
                  <div className="flex rounded-lg border border-white/10 bg-black/25 p-0.5">
                    <button onClick={() => setMode('continue')} className={clsx('rounded-md px-2.5 py-1 text-[11px] font-semibold', mode === 'continue' ? 'bg-white/10 text-white' : 'text-white/40')}>Continue</button>
                    <button onClick={() => setMode('new')} className={clsx('rounded-md px-2.5 py-1 text-[11px] font-semibold', mode === 'new' ? 'bg-white/10 text-white' : 'text-white/40')}>New</button>
                  </div>
                )}
              </div>

              {error && <div className="mt-4 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200">{error}</div>}

              {mode === 'continue' ? (
                <div className="mt-5 space-y-2.5">
                  {boot.saves.map((s) => (
                    <div key={s.id} className="group flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 transition hover:border-electric/40">
                      <ClubBadge club={s.club} size={38} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-semibold">{s.club?.name}</div>
                        <div className="truncate text-[11px] text-white/40">{s.managerName} · {s.season}/{String(s.season + 1).slice(2)} · Slot {s.slot}</div>
                      </div>
                      <Btn size="sm" variant="primary" icon={Play} onClick={() => { selectSave(s.id); navigate('/dashboard') }}>Resume</Btn>
                      <button onClick={() => removeSave(s.id)} className="rounded-lg p-1.5 text-white/20 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  <button onClick={() => setMode('new')} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-3 text-[12px] font-semibold text-white/40 transition hover:border-electric/40 hover:text-white/70">
                    <Plus size={14} /> Start a new career
                  </button>
                </div>
              ) : (
                <div className="mt-5">
                  <div className="no-scrollbar flex gap-1 overflow-x-auto pb-1">
                    {boot.leagues.map((l) => (
                      <button key={l.id} onClick={() => { setLeagueId(l.id); setClubId(null) }}
                        className={clsx('whitespace-nowrap rounded-lg px-3 py-1.5 text-[11.5px] font-semibold transition',
                          leagueId === l.id ? 'bg-white/[0.10] text-white' : 'text-white/40 hover:text-white/70')}>
                        {l.name}
                      </button>
                    ))}
                  </div>

                  <div className="scroll-thin mt-3 grid max-h-[236px] grid-cols-2 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-3">
                    {league?.clubs.map((c) => (
                      <button key={c.id} onClick={() => setClubId(c.id)}
                        className={clsx('flex items-center gap-2 rounded-lg border px-2 py-2 text-left transition',
                          clubId === c.id ? 'border-electric/60 bg-electric/10' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/20')}>
                        <ClubBadge club={c} size={24} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11.5px] font-semibold text-white/85">{c.short}</div>
                          <Stars rep={c.reputation} />
                        </div>
                        {clubId === c.id && <Check size={13} className="text-[#9fc0ff]" />}
                      </button>
                    ))}
                  </div>

                  {club ? (
                    <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/20 p-3.5">
                      <div className="flex items-center gap-3">
                        <ClubBadge club={club} size={44} />
                        <div className="min-w-0 flex-1">
                          <div className="display truncate text-[20px] leading-none">{club.name}</div>
                          <div className="mt-1 text-[11px] text-white/40">{club.stadium} · {club.capacity.toLocaleString()} capacity</div>
                        </div>
                        <Stars rep={club.reputation} />
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3 text-center">
                        <div><div className="text-[9px] uppercase tracking-[0.12em] text-white/30">Country</div><div className="mt-0.5 text-[11.5px] text-white/75">{club.country}</div></div>
                        <div><div className="text-[9px] uppercase tracking-[0.12em] text-white/30">Stadium</div><div className="mt-0.5 truncate text-[11.5px] text-white/75">{club.stadium.split(' ').slice(0, 2).join(' ')}</div></div>
                        <div><div className="text-[9px] uppercase tracking-[0.12em] text-white/30">Reputation</div><div className="mt-0.5 text-[11.5px] text-white/75">{club.reputation}/10</div></div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-white/12 py-6 text-center text-[12px] text-white/35">
                      Choose a club from the {league?.name}
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-[1fr_auto] gap-3">
                    <Field label="Manager name">
                      <Input value={manager} onChange={(e) => setManager(e.target.value)} placeholder="e.g. Alex Morgan" maxLength={40} />
                    </Field>
                    <Field label="Save slot">
                      <div className="flex gap-1.5">
                        {[1, 2, 3].map((n) => {
                          const used = boot.saves.find((s) => s.slot === n)
                          return (
                            <button key={n} onClick={() => setSlot(n)} title={used ? 'Overwrites existing save' : `Slot ${n}`}
                              className={clsx('h-[42px] w-10 rounded-xl border text-[12px] font-bold transition',
                                slot === n ? 'border-electric/60 bg-electric/15 text-white' : 'border-white/10 bg-white/[0.03] text-white/40 hover:text-white/70')}>
                              {n}
                            </button>
                          )
                        })}
                      </div>
                    </Field>
                  </div>

                  <Btn variant="primary" size="lg" className="mt-4 w-full" disabled={!club || !manager.trim() || starting} onClick={begin}>
                    {starting ? <Loader2 size={16} className="animate-spin" /> : <Trophy size={16} />}
                    {starting ? 'Building your world…' : 'Begin career'}
                  </Btn>
                  <div className="mt-2 text-center text-[10px] text-white/25">
                    {boot.meta.players.toLocaleString()} players loaded · {boot.meta.clubs} clubs · {boot.meta.leagues} leagues
                  </div>
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
