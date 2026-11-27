import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { CalendarDays, Crown, Trophy, ChevronRight, ListFilter, Goal, Shield } from 'lucide-react'
import { api } from '../api.js'
import { useGame } from '../store.jsx'
import ClubBadge from '../components/ClubBadge.jsx'
import { Btn, Chip, Empty, FormPills, Panel, Pos, SectionHead, Select, Spinner, Tabs, TableWrap, Ovr } from '../components/ui.jsx'
import { dateShort, ordinal, money } from '../lib/format.js'
import { flagEmoji } from '../lib/nations.js'

const NOT_STARTED = 'Competition Fixtures and Stats will be released later'

const ZONE = (pos, size) => {
  if (pos <= 4) return 'bg-[#3d7bff]/70'
  if (pos <= 6) return 'bg-emerald-400/70'
  if (pos <= 7) return 'bg-cyan-400/60'
  if (pos > size - 3) return 'bg-rose-500/70'
  return 'bg-white/10'
}

export default function Competitions() {
  const { game } = useGame()
  const navigate = useNavigate()
  const [comp, setComp] = useState(game?.league?.id || 'premier-league')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('table')

  useEffect(() => {
    setLoading(true)
    api.get(`/competitions?comp=${comp}`).then((d) => { setData(d); setView(d.isLeague ? 'table' : 'bracket') }).catch(() => {}).finally(() => setLoading(false))
  }, [comp])

  const rounds = useMemo(() => {
    const map = {}
    for (const f of data?.fixtures || []) {
      const key = f.round || 'Fixture'
      ;(map[key] ||= []).push(f)
    }
    return map
  }, [data])

  if (!data && loading) return <Spinner label="Loading competitions" />
  if (!data) return <Panel><Empty icon={Trophy} title="Competitions unavailable" text="Could not load competition data. Try again in a moment." /></Panel>

  const comps = data.competitions || []
  const leagues = comps.filter((c) => c.kind === 'league' && c.tier === 1)
  const cups = comps.filter((c) => c.kind === 'cup')
  const europe = comps.filter((c) => c.kind === 'europe')
  const size = data.table?.length || 20
  const userClubId = game?.club?.id

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="kicker mb-1.5">Competitions</div>
          <h1 className="display text-[34px] leading-none sm:text-[40px]">{comps.find((c) => c.id === comp)?.name || 'Competitions'}</h1>
        </div>
        <Select className="!w-auto min-w-[240px]" value={comp} onChange={(e) => setComp(e.target.value)}>
          <optgroup label="Leagues">{leagues.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
          <optgroup label="Domestic cups">{cups.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
          <optgroup label="Europe">{europe.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
        </Select>
      </div>

      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {[...leagues, ...cups.slice(0, 2), ...europe.slice(0, 1)].map((c) => (
          <button key={c.id} onClick={() => setComp(c.id)}
            className={clsx('whitespace-nowrap rounded-xl border px-3 py-1.5 text-[11.5px] font-semibold transition',
              comp === c.id ? 'border-electric/50 bg-electric/12 text-white' : 'border-white/[0.07] bg-white/[0.02] text-white/40 hover:text-white/70')}>
            {c.name}
          </button>
        ))}
      </div>

      {data.isLeague ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_330px]">
          <div className="space-y-4">
            <Panel className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-white/40" />
                  <span className="text-[13px] font-semibold">League table</span>
                  <Chip>{data.fixtures.filter((f) => f.played).length} played</Chip>
                </div>
                <div className="flex items-center gap-2 text-[9.5px] text-white/30">
                  <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#3d7bff]" /> UCL</span>
                  <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> UEL</span>
                  <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Relegation</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>#</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th><th>Form</th></tr></thead>
                  <tbody>
                    {data.table.map((r) => (
                      <tr key={r.clubId} className={r.clubId === userClubId ? '!bg-electric/10' : ''} onClick={() => navigate('/players?club=')}>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className={clsx('h-4 w-1 rounded-full', ZONE(r.position, size))} />
                            <span className="w-4 text-[11px] text-white/45">{r.position}</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <ClubBadge club={{ short: r.short, color1: r.color1, color2: r.color2 }} size={18} />
                            <span className={clsx('max-w-[160px] truncate text-[12.5px]', r.clubId === userClubId ? 'font-semibold text-white' : 'text-white/80')}>{r.name}</span>
                          </div>
                        </td>
                        <td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td><td>{r.gf}</td><td>{r.ga}</td>
                        <td className={r.gd > 0 ? 'text-emerald-300' : r.gd < 0 ? 'text-rose-300' : ''}>{r.gd > 0 ? '+' : ''}{r.gd}</td>
                        <td className="font-bold text-white">{r.pts}</td>
                        <td><FormPills form={r.form} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                <div className="flex items-center gap-2"><CalendarDays size={14} className="text-white/40" /><span className="text-[13px] font-semibold">Fixtures & results</span></div>
                <Tabs size="sm" tabs={[{ key: 'all', label: 'All' }, { key: 'results', label: 'Results' }, { key: 'upcoming', label: 'Upcoming' }]} value={view} onChange={setView} />
              </div>
              {!data.fixtures.length && <div className="px-4 py-8 text-center text-[12px] text-white/40">{NOT_STARTED}</div>}
              <TableWrap maxH="max-h-[420px]">
                <table className={clsx('data-table', !data.fixtures.length && 'hidden')}>
                  <thead><tr><th>Date</th><th>Round</th><th>Home</th><th></th><th>Away</th><th></th></tr></thead>
                  <tbody>
                    {data.fixtures
                      .filter((f) => view === 'all' || (view === 'results' ? f.played : !f.played))
                      .map((f) => (
                        <tr key={f.id}>
                          <td className="text-white/40">{dateShort(f.date)}</td>
                          <td className="text-white/35">{f.round}</td>
                          <td className={clsx('text-right', f.home_id === userClubId && 'font-semibold text-white')}>{f.home_name}</td>
                          <td className="!px-2 text-center">
                            {f.played ? <span className="display text-[14px] text-white/85">{f.home_goals} – {f.away_goals}</span> : <span className="text-[10px] text-white/25">vs</span>}
                          </td>
                          <td className={clsx(f.away_id === userClubId && 'font-semibold text-white')}>{f.away_name}</td>
                          <td className="text-right text-[10px] text-white/25">{f.played ? '' : f.date.slice(5)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </TableWrap>
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel className="p-5">
              <SectionHead kicker="Golden boot" title="Top scorers" />
              <div className="mt-3 space-y-1">
                {data.topScorers.map((s, i) => (
                  <button key={s.player_id} onClick={() => navigate(`/players/${s.player_id}`)} className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left hover:bg-white/[0.04]">
                    <span className="w-4 text-[10px] text-white/25">{i + 1}</span>
                    <span className="text-[13px]">{flagEmoji(s.nationality)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11.5px] text-white/80">{s.name}</div>
                      <div className="truncate text-[9.5px] text-white/30">{s.club_name}</div>
                    </div>
                    <span className="display text-[15px] text-white/80">{s.goals}</span>
                    <span className="w-7 text-right text-[10px] text-white/35">{s.assists}a</span>
                  </button>
                ))}
                {!data.topScorers.length && <Empty icon={Goal} title="No goals yet" text={data.fixtures.some((f) => f.played) ? 'Goalscorers appear once matches are played.' : NOT_STARTED} />}
              </div>
            </Panel>
            <Panel className="p-5">
              <SectionHead kicker="Honours" title="Past winners" />
              <div className="mt-3 space-y-1.5">
                {data.history.length === 0 && <Empty icon={Crown} title="No history yet" text="Winners appear at the end of each season." />}
                {data.history.map((h) => (
                  <div key={h.id} className="flex items-center gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-2">
                    <Trophy size={12} className="text-amber-300/70" />
                    <span className="text-[11px] text-white/35">{h.season}/{String(h.season + 1).slice(2)}</span>
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-white/75">{h.winner_name}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(rounds).map(([round, fixtures]) => (
            <Panel key={round} className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
                <span className="display text-[17px]">{roundLabel(round)}</span>
                <Chip>{fixtures.filter((f) => f.played).length}/{fixtures.length} played</Chip>
              </div>
              <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
                {fixtures.map((f) => (
                  <div key={f.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="mb-1.5 flex items-center justify-between text-[9.5px] text-white/30">
                      <span>{dateShort(f.date)}</span>
                      {f.played && <span className="text-emerald-300/70">FT</span>}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <ClubBadge club={{ short: f.home_short, color1: '#2a3550' }} size={16} />
                        <span className={clsx('min-w-0 flex-1 truncate text-[11.5px]', f.played && f.home_goals > f.away_goals ? 'font-semibold text-white' : 'text-white/60')}>{f.home_name}</span>
                        {f.played && <span className="display text-[14px] text-white/85">{f.home_goals}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <ClubBadge club={{ short: f.away_short, color1: '#2a3550' }} size={16} />
                        <span className={clsx('min-w-0 flex-1 truncate text-[11.5px]', f.played && f.away_goals > f.home_goals ? 'font-semibold text-white' : 'text-white/60')}>{f.away_name}</span>
                        {f.played && <span className="display text-[14px] text-white/85">{f.away_goals}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          ))}
          {!data.fixtures.length && <Panel><Empty icon={Trophy} title="Fixtures and stats coming soon" text={NOT_STARTED} /></Panel>}
          <Panel className="p-5">
            <SectionHead kicker="Honours" title="Past winners" />
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {data.history.map((h) => (
                <div key={h.id} className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-2">
                  <Trophy size={12} className="text-amber-300/70" />
                  <span className="text-[11px] text-white/35">{h.season}/{String(h.season + 1).slice(2)}</span>
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-white/75">{h.winner_name}</span>
                </div>
              ))}
              {!data.history.length && <div className="text-[11px] text-white/30">No winners recorded yet.</div>}
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}

function roundLabel(r) {
  const map = { R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarter-final', SF: 'Semi-final', F: 'Final' }
  return map[r] || r
}
