import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import {
  ArrowLeft, Play, Pause, FastForward, SkipForward, CircleDot, Loader2, ChevronDown, Users,
  ArrowLeftRight, Shield, Activity, Zap, Target, AlertTriangle, RotateCcw,
} from 'lucide-react'
import { api } from '../api.js'
import { useGame } from '../store.jsx'
import ClubBadge from '../components/ClubBadge.jsx'
import { Btn, Chip, Field, Panel, Select, Spinner, Tabs, Meter } from '../components/ui.jsx'
import { dateLong, ratingTone } from '../lib/format.js'

const EVENT_STYLE = {
  goal: { icon: CircleDot, tone: 'text-[#c8ff4d]', bg: 'border-lime/40 bg-lime/[0.07]' },
  shot: { icon: Target, tone: 'text-white/40', bg: 'border-white/5 bg-white/[0.015]' },
  save: { icon: Shield, tone: 'text-[#9fc0ff]', bg: 'border-white/5 bg-white/[0.015]' },
  yellow: { icon: AlertTriangle, tone: 'text-amber-300', bg: 'border-amber-400/20 bg-amber-500/[0.05]' },
  red: { icon: AlertTriangle, tone: 'text-rose-300', bg: 'border-rose-400/30 bg-rose-500/[0.08]' },
  foul: { icon: Activity, tone: 'text-white/25', bg: 'border-white/5 bg-white/[0.01]' },
  injury: { icon: Activity, tone: 'text-rose-300', bg: 'border-rose-400/20 bg-rose-500/[0.05]' },
  sub: { icon: ArrowLeftRight, tone: 'text-[#c9b6ff]', bg: 'border-white/5 bg-white/[0.015]' },
  kickoff: { icon: Play, tone: 'text-white/40', bg: 'border-white/5 bg-white/[0.015]' },
  ht: { icon: Pause, tone: 'text-white/60', bg: 'border-white/10 bg-white/[0.03]' },
  ft: { icon: Zap, tone: 'text-white', bg: 'border-electric/30 bg-electric/[0.08]' },
}

export default function Match() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { refresh, notify, game } = useGame()
  const [fixture, setFixture] = useState(null)
  const [state, setState] = useState(null)
  const [played, setPlayed] = useState(false)
  const [playedEvents, setPlayedEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(2)
  const [tab, setTab] = useState('commentary')
  const [selectedOut, setSelectedOut] = useState(null)
  const [busy, setBusy] = useState(false)
  const [finished, setFinished] = useState(false)
  const feedRef = useRef(null)
  const lock = useRef(false)

  useEffect(() => {
    api.get(`/match/${id}`).then((d) => {
      setFixture(d.fixture)
      if (d.played) { setPlayed(true); setPlayedEvents(d.events || []); setFinished(true) }
      else { setState(d.state); setFinished(d.state.finished) }
    }).catch((e) => notify(e.message, 'error')).finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!playing) return
    const t = setInterval(async () => {
      if (lock.current) return
      lock.current = true
      try {
        const r = await api.post(`/match/${id}/tick`, { minutes: speed })
        setState(r.state)
        if (r.finished) { setPlaying(false); setFinished(true); refresh() }
      } catch (e) { setPlaying(false); notify(e.message, 'error') }
      finally { lock.current = false }
    }, 850)
    return () => clearInterval(t)
  }, [playing, speed, id])

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [state?.events?.length])

  if (loading) return <Spinner label="Preparing the match" />
  if (!fixture) return null

  const home = state?.home
  const away = state?.away
  const minute = state?.minute ?? 90
  const homeScore = state ? state.home.score : fixture.home_goals
  const awayScore = state ? state.away.score : fixture.away_goals
  const events = state ? state.events : playedEvents
  const userSide = fixture.home_id === game?.club?.id ? 'home' : 'away'
  const me = state?.[userSide]

  async function kickoff() {
    setBusy(true)
    try {
      const r = await api.post(`/match/${id}/tick`, { minutes: 1 })
      setState(r.state)
      setPlaying(true)
    } catch (e) { notify(e.message, 'error') } finally { setBusy(false) }
  }

  async function skip() {
    setBusy(true); setPlaying(false)
    try {
      const r = await api.post(`/match/${id}/sim`)
      setState(r.state); setFinished(true); await refresh()
    } catch (e) { notify(e.message, 'error') } finally { setBusy(false) }
  }

  async function makeSub(inId) {
    if (!selectedOut) { notify('Select the player coming off first', 'info'); return }
    setBusy(true)
    try {
      const r = await api.post(`/match/${id}/sub`, { outId: selectedOut, inId })
      if (r.ok) { setState(r.state); setSelectedOut(null) } else notify(r.message, 'error')
    } catch (e) { notify(e.message, 'error') } finally { setBusy(false) }
  }

  async function changeMentality(v) {
    try {
      const r = await api.post(`/match/${id}/tactics`, { mentality: v })
      setState(r.state)
    } catch (e) { notify(e.message, 'error') }
  }

  async function changeFormation(f) {
    try {
      const r = await api.post(`/match/${id}/tactics`, { formation: f })
      setState(r.state)
    } catch (e) { notify(e.message, 'error') }
  }

  const stats = state ? [
    ['Possession', state.home.stats.poss, state.away.stats.poss, '%'],
    ['Shots', state.home.stats.shots, state.away.stats.shots, ''],
    ['On target', state.home.stats.sot, state.away.stats.sot, ''],
    ['Expected goals', state.home.stats.xg.toFixed(2), state.away.stats.xg.toFixed(2), ''],
    ['Fouls', state.home.stats.fouls, state.away.stats.fouls, ''],
    ['Yellow cards', state.home.stats.yellow, state.away.stats.yellow, ''],
  ] : []

  const resultLabel = homeScore > awayScore ? `${fixture.home_short} win` : homeScore < awayScore ? `${fixture.away_short} win` : 'Honours even'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1.5 text-[11.5px] text-white/40 hover:text-white/80">
          <ArrowLeft size={13} /> Dashboard
        </button>
        <Chip tone="electric">{fixture.competition?.toUpperCase()} · {dateLong(fixture.date)}</Chip>
      </div>

      <Panel className="relative overflow-hidden p-0">
        <div className="pointer-events-none absolute inset-0 opacity-90"
          style={{ background: `radial-gradient(60% 130% at 0% 0%, ${fixture.home_color}33, transparent 55%), radial-gradient(60% 130% at 100% 0%, ${fixture.away_color}33, transparent 55%)` }} />
        <div className="relative px-4 py-6 sm:px-8">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-8">
            <div className="flex flex-col items-center text-center">
              <ClubBadge club={{ short: fixture.home_short, color1: fixture.home_color }} size={62} glow />
              <div className="display mt-2 text-[17px] leading-none sm:text-[22px]">{fixture.home_short}</div>
            </div>
            <div className="text-center">
              <div className="display text-[52px] leading-none tracking-tight sm:text-[64px]">
                {homeScore} <span className="text-white/25">–</span> {awayScore}
              </div>
              <div className={clsx('mt-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]',
                finished ? 'text-white/45' : 'text-[#c8ff4d]')}>
                {!finished && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#c8ff4d]" />}
                {finished ? 'Full time' : minute === 0 ? 'Pre-match' : `${minute}'`}
              </div>
            </div>
            <div className="flex flex-col items-center text-center">
              <ClubBadge club={{ short: fixture.away_short, color1: fixture.away_color }} size={62} glow />
              <div className="display mt-2 text-[17px] leading-none sm:text-[22px]">{fixture.away_short}</div>
            </div>
          </div>

          {finished && (
            <div className="mt-5 text-center">
              <div className="display text-[22px] text-white/85">{resultLabel}</div>
              <div className="mt-3 flex justify-center gap-2">
                <Btn variant="primary" onClick={() => navigate('/dashboard')}>Return to dashboard</Btn>
                <Btn onClick={() => navigate('/squad')}>View squad</Btn>
              </div>
            </div>
          )}
        </div>
      </Panel>

      {!finished && (
        <Panel className="flex flex-wrap items-center gap-2 p-3">
          {minute === 0 ? (
            <Btn variant="primary" icon={Play} onClick={kickoff} disabled={busy}>Kick off</Btn>
          ) : (
            <>
              <Btn variant="primary" icon={playing ? Pause : Play} onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause' : 'Play'}</Btn>
              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/25 p-0.5">
                {[1, 2, 4].map((s) => (
                  <button key={s} onClick={() => setSpeed(s)} className={clsx('rounded px-2 py-1 text-[10.5px] font-semibold', speed === s ? 'bg-white/10 text-white' : 'text-white/35')}>{s}×</button>
                ))}
              </div>
            </>
          )}
          <Btn icon={FastForward} onClick={skip} disabled={busy}>Simulate to full time</Btn>
          <div className="ml-auto flex items-center gap-2 text-[10.5px] text-white/35">
            <Users size={12} /> Subs used {me?.subsUsed ?? 0}/5
          </div>
        </Panel>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Panel className="overflow-hidden">
          <Tabs className="m-3" tabs={[{ key: 'commentary', label: 'Commentary' }, { key: 'stats', label: 'Match stats' }]} value={tab} onChange={setTab} />
          {tab === 'commentary' ? (
            <div ref={feedRef} className="scroll-thin max-h-[430px] min-h-[300px] space-y-1.5 overflow-y-auto px-3 pb-4">
              {events.length === 0 && <div className="py-10 text-center text-[12px] text-white/30">Awaiting kick-off…</div>}
              {events.map((e, i) => {
                const st = EVENT_STYLE[e.type] || EVENT_STYLE.shot
                const Icon = st.icon
                return (
                  <div key={i} className={clsx('flex items-start gap-2.5 rounded-lg border px-2.5 py-2', st.bg)}>
                    <span className="mt-0.5 w-7 shrink-0 text-right text-[10px] font-semibold text-white/30">{e.minute}'</span>
                    <Icon size={12} className={clsx('mt-0.5 shrink-0', st.tone)} />
                    <div className="min-w-0 flex-1">
                      <div className={clsx('text-[11.5px] leading-snug', e.type === 'goal' || e.type === 'red' ? 'font-semibold text-white' : 'text-white/65')}>{e.text}</div>
                      {e.club && <div className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-white/20">{e.club === 'home' ? fixture.home_short : fixture.away_short}</div>}
                    </div>
                    {e.type === 'goal' && <span className="display shrink-0 text-[15px] text-white/80">{e.score?.[0]}–{e.score?.[1]}</span>}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {stats.map(([label, h, a, suffix]) => {
                const hn = typeof h === 'number' ? h : Number(h)
                const an = typeof a === 'number' ? a : Number(a)
                const total = hn + an || 1
                return (
                  <div key={label}>
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="w-10 font-semibold text-white/80">{h}{suffix}</span>
                      <span className="text-[10px] uppercase tracking-[0.14em] text-white/30">{label}</span>
                      <span className="w-10 text-right font-semibold text-white/80">{a}{suffix}</span>
                    </div>
                    <div className="flex h-1.5 gap-1 overflow-hidden rounded-full">
                      <div className="rounded-full bg-gradient-to-r from-[#3d7bff] to-[#7c9dff]" style={{ width: `${(hn / total) * 100}%` }} />
                      <div className="rounded-full bg-gradient-to-r from-[#a78bfa] to-[#8b5cf6]" style={{ width: `${(an / total) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          {!finished && me && (
            <Panel className="p-4">
              <div className="kicker mb-2">Tactics</div>
              <div className="space-y-3">
                <div>
                  <div className="mb-1 flex items-center justify-between text-[10.5px]"><span className="text-white/40">Mentality</span><span className="text-white/75">{['Very defensive', 'Defensive', 'Balanced', 'Attacking', 'Very attacking'][(me.tactics.mentality || 3) - 1]}</span></div>
                  <input type="range" min={1} max={5} value={me.tactics.mentality || 3} onChange={(e) => changeMentality(Number(e.target.value))} className="range w-full" />
                </div>
                <Field label="Formation">
                  <Select value={me.formation} onChange={(e) => changeFormation(e.target.value)}>
                    {['4-3-3', '4-2-3-1', '4-4-2', '3-5-2', '5-3-2', '4-1-2-1-2'].map((f) => <option key={f}>{f}</option>)}
                  </Select>
                </Field>
              </div>
            </Panel>
          )}

          {me && (
            <Panel className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
                <span className="text-[12px] font-semibold">Substitutions</span>
                <span className="text-[10px] text-white/30">{selectedOut ? 'Now pick a substitute' : 'Tap a player to take off'}</span>
              </div>
              <div className="scroll-thin max-h-[260px] overflow-y-auto p-2">
                {me.starters.map((p) => (
                  <button key={p.id} onClick={() => !finished && setSelectedOut(p.id)}
                    className={clsx('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition',
                      selectedOut === p.id ? 'bg-rose-500/15 ring-1 ring-rose-400/40' : 'hover:bg-white/[0.04]')}>
                    <span className="w-6 text-[10px] text-white/25">{p.number}</span>
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-white/75">{p.name}</span>
                    <span className="text-[9.5px] text-white/30">{p.position}</span>
                    <span className="text-[10px] text-white/35">{p.fitness}%</span>
                    <span className={clsx('w-7 text-right text-[11px] font-semibold', ratingTone(p.rating))}>{p.rating?.toFixed(1)}</span>
                  </button>
                ))}
                <div className="my-1 border-t border-white/[0.06]" />
                {me.bench.map((p) => (
                  <button key={p.id} onClick={() => !finished && makeSub(p.id)}
                    className={clsx('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition',
                      selectedOut ? 'hover:bg-lime/10' : 'opacity-70')}>
                    <span className="w-6 text-[10px] text-white/25">{p.number}</span>
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-white/65">{p.name}</span>
                    <span className="text-[9.5px] text-white/30">{p.position}</span>
                    <span className="text-[10px] text-white/35">{p.fitness}%</span>
                    <span className="text-[10px] text-[#9fc0ff]">on</span>
                  </button>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>

      {state && (
        <div className="grid gap-4 lg:grid-cols-2">
          {['home', 'away'].map((side) => {
            const s = state[side]
            const isMe = s.clubId === game?.club?.id
            return (
              <Panel key={side} className={clsx('overflow-hidden', isMe && 'ring-1 ring-electric/30')}>
                <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <ClubBadge club={{ short: s.short, color1: s.color1, color2: s.color2 }} size={20} />
                    <span className="text-[12px] font-semibold">{s.name}</span>
                    {isMe && <Chip tone="electric">You</Chip>}
                  </div>
                  <span className="text-[10px] text-white/30">{s.formation}</span>
                </div>
                <div className="scroll-thin max-h-[300px] overflow-y-auto p-2">
                  {s.starters.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1">
                      <span className="w-6 text-[10px] text-white/25">{p.number}</span>
                      <span className="w-7 text-[9px] text-white/35">{p.position}</span>
                      <span className="min-w-0 flex-1 truncate text-[11px] text-white/70">{p.name}</span>
                      <span className={clsx('text-[11px] font-semibold', ratingTone(p.rating))}>{p.rating?.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            )
          })}
        </div>
      )}
    </div>
  )
}
