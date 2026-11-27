import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowUpDown, ChevronLeft, ChevronRight, Filter, Search, Star, Users, X } from 'lucide-react'
import { api } from '../api.js'
import { useGame } from '../store.jsx'
import { Btn, Chip, Field, Input, Panel, Pos, Select, Spinner, Ovr, TableWrap, Empty } from '../components/ui.jsx'
import { money, wage, ovrTone, ratingTone, ordinal } from '../lib/format.js'
import { flagEmoji, NATIONS } from '../lib/nations.js'
import ClubBadge from '../components/ClubBadge.jsx'

const LEAGUES = [
  { id: 'all', label: 'All leagues' },
  { id: 'premier-league', label: 'Premier League' },
  { id: 'la-liga', label: 'LaLiga' },
  { id: 'bundesliga', label: 'Bundesliga' },
  { id: 'serie-a', label: 'Serie A' },
  { id: 'ligue-1', label: 'Ligue 1' },
]
const POSITIONS = ['all', 'GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'CF', 'ST']
const SORTS = [
  { key: 'ovr', label: 'OVR' }, { key: 'pot', label: 'POT' }, { key: 'value', label: 'Value' },
  { key: 'age', label: 'Age' }, { key: 'apps', label: 'Apps' }, { key: 'goals', label: 'Goals' },
  { key: 'assists', label: 'Assists' }, { key: 'rating', label: 'Rating' }, { key: 'wage', label: 'Wage' },
]

export default function Players() {
  const navigate = useNavigate()
  const { notify, game } = useGame()
  const [league, setLeague] = useState('all')
  const [q, setQ] = useState('')
  const [pos, setPos] = useState('all')
  const [ageMin, setAgeMin] = useState('')
  const [ageMax, setAgeMax] = useState('')
  const [ovrMin, setOvrMin] = useState('')
  const [potMin, setPotMin] = useState('')
  const [valueMax, setValueMax] = useState('')
  const [club, setClub] = useState('')
  const [nationality, setNationality] = useState('all')
  const [sort, setSort] = useState({ key: 'ovr', dir: 'desc' })
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [clubs, setClubs] = useState([])
  const [showFilters, setShowFilters] = useState(true)
  const [shortlist, setShortlist] = useState([])

  useEffect(() => {
    api.get('/bootstrap').then((b) => setClubs(b.leagues.flatMap((l) => l.clubs.map((c) => ({ ...c, leagueId: l.id }))))).catch(() => {})
    api.get('/scouting/shortlist').then((s) => setShortlist(s.map((p) => p.id))).catch(() => {})
  }, [])

  const params = useMemo(() => {
    const p = new URLSearchParams()
    p.set('league', league)
    if (q.trim()) p.set('q', q.trim())
    if (pos !== 'all') p.set('position', pos)
    if (ageMin) p.set('ageMin', ageMin)
    if (ageMax) p.set('ageMax', ageMax)
    if (ovrMin) p.set('ovrMin', ovrMin)
    if (potMin) p.set('potMin', potMin)
    if (valueMax) p.set('valueMax', Number(valueMax) * 1e6)
    if (club) p.set('club', club)
    if (nationality !== 'all') p.set('nationality', nationality)
    p.set('sort', sort.key)
    p.set('dir', sort.dir)
    p.set('page', page)
    p.set('pageSize', '40')
    return p.toString()
  }, [league, q, pos, ageMin, ageMax, ovrMin, potMin, valueMax, club, nationality, sort, page])

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      api.get(`/players?${params}`).then(setData).catch((e) => notify(e.message, 'error')).finally(() => setLoading(false))
    }, 180)
    return () => clearTimeout(t)
  }, [params])

  useEffect(() => { setPage(1); setClub('') }, [league])

  const toggleSort = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))
  const toggleShortlist = async (id) => {
    try {
      const r = await api.post('/scouting/shortlist', { playerId: id })
      setShortlist((s) => r.shortlisted ? [...s, id] : s.filter((x) => x !== id))
      notify(r.shortlisted ? 'Added to shortlist' : 'Removed from shortlist', 'success')
    } catch (e) { notify(e.message, 'error') }
  }

  const reset = () => {
    setQ(''); setPos('all'); setAgeMin(''); setAgeMax(''); setOvrMin(''); setPotMin(''); setValueMax(''); setClub(''); setNationality('all')
    setLeague('all'); setPage(1)
  }

  const clubOptions = clubs.filter((c) => league === 'all' || c.leagueId === league).sort((a, b) => a.name.localeCompare(b.name))
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="kicker mb-1.5">Global database</div>
          <h1 className="display text-[34px] leading-none sm:text-[40px]">Players</h1>
          <p className="mt-1.5 text-[12px] text-white/40">
            {data ? `${data.total.toLocaleString()} players` : 'Every player'} across the five major European leagues.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Chip tone="electric"><Users size={11} /> EA SPORTS FC 27</Chip>
          <Btn size="sm" icon={Filter} onClick={() => setShowFilters((v) => !v)}>{showFilters ? 'Hide filters' : 'Filters'}</Btn>
        </div>
      </div>

      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {LEAGUES.map((l) => (
          <button key={l.id} onClick={() => setLeague(l.id)}
            className={clsx('whitespace-nowrap rounded-xl border px-3.5 py-2 text-[12px] font-semibold transition',
              league === l.id ? 'border-electric/50 bg-electric/12 text-white' : 'border-white/[0.07] bg-white/[0.02] text-white/45 hover:text-white/75')}>
            {l.label}
          </button>
        ))}
      </div>

      {showFilters && (
        <Panel className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <Field label="Search" className="sm:col-span-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <Input className="!pl-9" placeholder="Player name…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
              </div>
            </Field>
            <Field label="Position">
              <Select value={pos} onChange={(e) => { setPos(e.target.value); setPage(1) }}>{POSITIONS.map((p) => <option key={p} value={p}>{p === 'all' ? 'All positions' : p}</option>)}</Select>
            </Field>
            <Field label="Club">
              <Select value={club} onChange={(e) => { setClub(e.target.value); setPage(1) }}>
                <option value="">All clubs</option>
                {clubOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Nationality">
              <Select value={nationality} onChange={(e) => { setNationality(e.target.value); setPage(1) }}>
                <option value="all">All nationalities</option>
                {NATIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </Field>
            <Field label="Sort by">
              <Select value={sort.key} onChange={(e) => setSort({ key: e.target.value, dir: sort.dir })}>
                {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </Select>
            </Field>
            <Field label="Age range">
              <div className="flex items-center gap-1.5">
                <Input type="number" placeholder="Min" value={ageMin} onChange={(e) => { setAgeMin(e.target.value); setPage(1) }} />
                <span className="text-white/25">–</span>
                <Input type="number" placeholder="Max" value={ageMax} onChange={(e) => { setAgeMax(e.target.value); setPage(1) }} />
              </div>
            </Field>
            <Field label="Min OVR"><Input type="number" placeholder="e.g. 80" value={ovrMin} onChange={(e) => { setOvrMin(e.target.value); setPage(1) }} /></Field>
            <Field label="Min potential"><Input type="number" placeholder="e.g. 85" value={potMin} onChange={(e) => { setPotMin(e.target.value); setPage(1) }} /></Field>
            <Field label="Max value (£m)"><Input type="number" placeholder="e.g. 50" value={valueMax} onChange={(e) => { setValueMax(e.target.value); setPage(1) }} /></Field>
            <div className="flex items-end">
              <Btn size="sm" icon={X} onClick={reset} className="w-full">Reset</Btn>
            </div>
          </div>
        </Panel>
      )}

      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
          <div className="flex items-center gap-2 text-[11.5px] text-white/45">
            {loading ? 'Searching…' : <>{data?.total.toLocaleString()} results · page {data?.page} of {totalPages}</>}
          </div>
          <div className="flex items-center gap-1">
            <Btn size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft size={13} /></Btn>
            <Btn size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight size={13} /></Btn>
          </div>
        </div>
        {loading && !data ? <Spinner label="Loading players" /> : (
          <TableWrap maxH="max-h-[calc(100vh-330px)]">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Player</th><th>Club</th><th>Age</th><th>Nat</th><th>Pos</th>
                  {SORTS.slice(0, 3).map((s) => <th key={s.key} onClick={() => toggleSort(s.key)}><span className="inline-flex cursor-pointer items-center gap-1">{s.label} <ArrowUpDown size={9} className={sort.key === s.key ? 'text-[#9fc0ff]' : 'opacity-30'} /></span></th>)}
                  <th>Wage</th>
                  {['apps', 'goals', 'assists', 'rating'].map((k) => {
                    const s = SORTS.find((x) => x.key === k)
                    return <th key={k} onClick={() => toggleSort(k)}><span className="inline-flex cursor-pointer items-center gap-1">{s.label} <ArrowUpDown size={9} className={sort.key === k ? 'text-[#9fc0ff]' : 'opacity-30'} /></span></th>
                  })}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data?.players.map((p) => (
                  <tr key={p.id} onClick={() => navigate(`/players/${p.id}`)}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px]">{flagEmoji(p.nationality)}</span>
                        <span className="max-w-[190px] truncate text-[13px] font-medium text-white/90">{p.name}</span>
                        {p.clubId === game?.club?.id && <span className="rounded bg-lime/15 px-1 py-0.5 text-[8px] font-bold text-[#d6ff8f]">YOURS</span>}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <ClubBadge club={{ short: p.clubShort || p.clubName, color1: p.clubColor1 }} size={16} />
                        <span className="max-w-[130px] truncate text-[11.5px] text-white/55">{p.clubName || 'Free agent'}</span>
                      </div>
                    </td>
                    <td>{p.age}</td>
                    <td><span className="text-[10.5px] text-white/45">{p.nationality}</span></td>
                    <td><Pos pos={p.position} /></td>
                    <td><span className={clsx('display text-[17px]', ovrTone(p.ovr))}>{p.ovr}</span></td>
                    <td><span className="text-[12px] text-white/45">{p.pot}</span></td>
                    <td className="font-medium">{money(p.value)}</td>
                    <td className="text-white/55">{wage(p.wage)}</td>
                    <td className="text-white/55">{p.apps}</td>
                    <td className="font-medium">{p.goals}</td>
                    <td className="text-white/55">{p.assists}</td>
                    <td><span className={clsx('text-[12px] font-semibold', ratingTone(p.avgRating))}>{p.avgRating || '—'}</span></td>
                    <td onClick={(e) => { e.stopPropagation(); toggleShortlist(p.id) }}>
                      <Star size={14} className={shortlist.includes(p.id) ? 'fill-amber-300 text-amber-300' : 'text-white/20 hover:text-white/50'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data && data.players.length === 0 && <Empty icon={Search} title="No players found" text="Try adjusting your filters." />}
          </TableWrap>
        )}
      </Panel>
    </div>
  )
}
