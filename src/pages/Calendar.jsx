import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Flag, Sparkles, Wallet, ArrowLeftRight, Users, Trophy } from 'lucide-react'
import { api } from '../api.js'
import { useGame } from '../store.jsx'
import ClubBadge from '../components/ClubBadge.jsx'
import { Btn, Chip, Panel, SectionHead, Spinner, Empty } from '../components/ui.jsx'
import { dateShort, dateLong, monthLabel, daysBetween, ordinal } from '../lib/format.js'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

const KEY_ICON = { window: ArrowLeftRight, youth: Users, season: Trophy, contract: Wallet }

export default function Calendar() {
  const { game, advance, notify } = useGame()
  const navigate = useNavigate()
  const [month, setMonth] = useState(game?.save?.date?.slice(0, 7) || '2026-07')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(game?.save?.date || null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get(`/calendar?month=${month}`).then((d) => {
      setData(d)
      if (!d.fixtures.some((f) => f.date === selected)) setSelected(d.fixtures[0]?.date || `${month}-01`)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [month])

  const userClubId = game?.club?.id
  const byDate = useMemo(() => {
    const m = {}
    for (const f of data?.fixtures || []) (m[f.date] ||= []).push(f)
    return m
  }, [data])

  const days = useMemo(() => {
    if (!data) return []
    const [y, m] = month.split('-').map(Number)
    const first = new Date(Date.UTC(y, m - 1, 1))
    const startOffset = (first.getUTCDay() + 6) % 7
    const total = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const arr = []
    for (let i = 0; i < startOffset; i++) arr.push(null)
    for (let d = 1; d <= total; d++) arr.push(`${month}-${String(d).padStart(2, '0')}`)
    return arr
  }, [month, data])

  const selectedFixtures = byDate[selected] || []
  const today = game?.save?.date

  async function advanceNext() {
    setBusy(true)
    try {
      const res = await advance('next-match')
      if (res.pending) navigate(`/match/${res.pending.id}`)
      else { notify(`Advanced to ${dateLong(res.date)}`, 'success'); setMonth(res.date.slice(0, 7)); setSelected(res.date) }
    } catch (e) { notify(e.message, 'error') } finally { setBusy(false) }
  }

  const next = game?.nextMatch

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="kicker mb-1.5">Schedule</div>
          <h1 className="display text-[34px] leading-none sm:text-[40px]">Calendar</h1>
        </div>
        <div className="flex items-center gap-2">
          <Btn size="sm" icon={ChevronLeft} onClick={() => setMonth(shiftMonth(month, -1))} />
          <span className="display min-w-[150px] text-center text-[17px]">{monthLabel(month)}</span>
          <Btn size="sm" icon={ChevronRight} onClick={() => setMonth(shiftMonth(month, 1))} />
          <Btn size="sm" onClick={() => { setMonth(today.slice(0, 7)); setSelected(today) }}>Today</Btn>
        </div>
      </div>

      {next && (
        <Panel className="flex flex-wrap items-center gap-3 p-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2"><CalendarDays size={17} className="text-white/50" /></div>
          <div className="min-w-0 flex-1">
            <div className="kicker">Next match · in {Math.max(0, daysBetween(today, next.date))} days</div>
            <div className="mt-0.5 text-[13px] text-white/80">{next.isHome ? 'vs' : 'away at'} {next.opponent} · {dateLong(next.date)} · {next.competitionName}</div>
          </div>
          <Btn variant="primary" size="sm" icon={Sparkles} onClick={advanceNext} disabled={busy}>Advance</Btn>
        </Panel>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_330px]">
        <Panel className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-white/[0.06]">
            {DOW.map((d) => <div key={d} className="px-2 py-2 text-center text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white/30">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              if (!d) return <div key={`e${i}`} className="min-h-[86px] border-b border-r border-white/[0.04] bg-black/10" />
              const fixtures = byDate[d] || []
              const userFx = fixtures.filter((f) => f.home_id === userClubId || f.away_id === userClubId)
              const isToday = d === today
              const isSel = d === selected
              return (
                <button key={d} onClick={() => setSelected(d)}
                  className={clsx('relative min-h-[86px] border-b border-r border-white/[0.04] p-1.5 text-left transition',
                    isSel ? 'bg-electric/10' : 'hover:bg-white/[0.03]')}>
                  <div className={clsx('flex h-5 w-5 items-center justify-center rounded text-[10.5px] font-semibold',
                    isToday ? 'bg-electric text-white' : 'text-white/40')}>{Number(d.slice(8))}</div>
                  <div className="mt-1 space-y-0.5">
                    {userFx.map((f) => {
                      const home = f.home_id === userClubId
                      return (
                        <div key={f.id} className={clsx('truncate rounded px-1 py-0.5 text-[8.5px] font-semibold',
                          f.played ? (f.home_goals === f.away_goals ? 'bg-white/10 text-white/55' : (f.home_goals > f.away_goals) === home ? 'bg-emerald-500/20 text-emerald-200' : 'bg-rose-500/20 text-rose-200')
                            : 'bg-electric/20 text-[#cfe0ff]')}>
                          {f.played ? `${f.home_goals}-${f.away_goals} ` : (home ? 'v ' : '@ ')}{home ? f.away_short : f.home_short}
                        </div>
                      )
                    })}
                    {!userFx.length && fixtures.length > 0 && <div className="text-[8px] text-white/20">{fixtures.length} matches</div>}
                  </div>
                </button>
              )
            })}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel className="p-5">
            <SectionHead kicker={selected ? dateShort(selected) : 'Select a day'} title="Fixtures" />
            <div className="mt-3 space-y-1.5">
              {selectedFixtures.length === 0 && <Empty icon={CalendarDays} title="Nothing scheduled" text="No matches on this day." />}
              {selectedFixtures.map((f) => {
                const mine = f.home_id === userClubId || f.away_id === userClubId
                return (
                  <div key={f.id} className={clsx('rounded-lg border px-2.5 py-2', mine ? 'border-electric/40 bg-electric/10' : 'border-white/[0.05] bg-white/[0.02]')}>
                    <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.1em] text-white/30">
                      <span>{f.competitionName || f.competition}</span>
                      {f.played && <span>FT</span>}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={clsx('min-w-0 flex-1 truncate text-[11px]', f.home_id === userClubId ? 'font-semibold text-white' : 'text-white/65')}>{f.home_short}</span>
                      <span className="display text-[12px] text-white/70">{f.played ? `${f.home_goals}-${f.away_goals}` : 'vs'}</span>
                      <span className={clsx('min-w-0 flex-1 truncate text-right text-[11px]', f.away_id === userClubId ? 'font-semibold text-white' : 'text-white/65')}>{f.away_short}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>

          <Panel className="p-5">
            <SectionHead kicker="Diary" title="Key dates" />
            <div className="mt-3 space-y-1.5">
              {(data?.keyDates || []).length === 0 && <Empty icon={Flag} title="No key dates" text="Nothing marked this month." />}
              {data?.keyDates?.map((k, i) => {
                const Icon = KEY_ICON[k.type] || Clock
                return (
                  <div key={i} className="flex items-center gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-2">
                    <Icon size={12} className="text-white/35" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] text-white/70">{k.label}</div>
                      <div className="text-[9px] text-white/30">{dateShort(k.date)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
