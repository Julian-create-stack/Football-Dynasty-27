import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Binoculars, FileSearch, Filter, Loader2, Search, Star, Target, Telescope, Trash2, TrendingUp, Users, X } from 'lucide-react'
import { api } from '../api.js'
import { useGame } from '../store.jsx'
import ClubBadge from '../components/ClubBadge.jsx'
import { Btn, Chip, Empty, Field, Gauge, Input, Modal, Ovr, Panel, Pos, SectionHead, Select, Spinner, TableWrap } from '../components/ui.jsx'
import { money, wage, ovrTone, dateMed } from '../lib/format.js'
import { flagEmoji, NATIONS } from '../lib/nations.js'

const LEAGUES = [
  ['all', 'All leagues'], ['premier-league', 'Premier League'], ['la-liga', 'LaLiga'],
  ['bundesliga', 'Bundesliga'], ['serie-a', 'Serie A'], ['ligue-1', 'Ligue 1'],
]
const POSITIONS = ['all', 'GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST']

export default function Scouting() {
  const navigate = useNavigate()
  const { notify, game } = useGame()
  const [league, setLeague] = useState('all')
  const [pos, setPos] = useState('all')
  const [q, setQ] = useState('')
  const [ageMax, setAgeMax] = useState('')
  const [ovrMin, setOvrMin] = useState('')
  const [potMin, setPotMin] = useState('')
  const [valueMax, setValueMax] = useState('')
  const [nationality, setNationality] = useState('all')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState(null)
  const [reportBusy, setReportBusy] = useState(null)
  const [shortlistData, setShortlistData] = useState([])

  const params = useMemo(() => {
    const p = new URLSearchParams()
    p.set('league', league); p.set('position', pos); p.set('pageSize', '60')
    if (q.trim()) p.set('q', q.trim())
    if (ageMax) p.set('ageMax', ageMax)
    if (ovrMin) p.set('ovrMin', ovrMin)
    if (potMin) p.set('potMin', potMin)
    if (valueMax) p.set('valueMax', Number(valueMax) * 1e6)
    if (nationality !== 'all') p.set('nationality', nationality)
    p.set('sort', 'pot'); p.set('dir', 'desc')
    return p.toString()
  }, [league, pos, q, ageMax, ovrMin, potMin, valueMax, nationality])

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      api.get(`/scouting?${params}`).then(setData).catch((e) => notify(e.message, 'error')).finally(() => setLoading(false))
    }, 200)
    return () => clearTimeout(t)
  }, [params])

  const loadShortlist = () => api.get('/scouting/shortlist').then(setShortlistData).catch(() => {})
  useEffect(() => { loadShortlist() }, [])

  const toggle = async (playerId) => {
    try {
      const r = await api.post('/scouting/shortlist', { playerId })
      notify(r.shortlisted ? 'Added to shortlist' : 'Removed from shortlist', 'success')
      loadShortlist()
      if (data) setData({ ...data, shortlist: r.shortlisted ? [...data.shortlist, playerId] : data.shortlist.filter((x) => x !== playerId) })
    } catch (e) { notify(e.message, 'error') }
  }

  const buildReport = async (playerId) => {
    setReportBusy(playerId)
    try {
      const r = await api.post('/scouting/report', { playerId })
      setReport({ ...r.report, player: data?.players.find((p) => p.id === playerId) || shortlistData.find((p) => p.id === playerId) })
      loadShortlist()
    } catch (e) { notify(e.message, 'error') } finally { setReportBusy(null) }
  }

  const shortlist = data?.shortlist || []
  const reports = Object.fromEntries((data?.reports || []).map((r) => [r.player_id, r]))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="kicker mb-1.5">Recruitment</div>
          <h1 className="display text-[34px] leading-none sm:text-[40px]">Scouting</h1>
          <p className="mt-1.5 text-[12px] text-white/40">Find the next signing. Reports are built from real FC 27 attributes and contract data.</p>
        </div>
        <div className="flex items-center gap-2">
          <Chip tone="electric"><Telescope size={11} /> Scouting quality {data?.scoutingQuality ?? '—'}/10</Chip>
          <Chip><Star size={11} /> {shortlist.length} shortlisted</Chip>
        </div>
      </div>

      <Panel className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <Field label="Search" className="xl:col-span-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <Input className="!pl-9" placeholder="Player name…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </Field>
          <Field label="League">
            <Select value={league} onChange={(e) => setLeague(e.target.value)}>{LEAGUES.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</Select>
          </Field>
          <Field label="Position">
            <Select value={pos} onChange={(e) => setPos(e.target.value)}>{POSITIONS.map((p) => <option key={p} value={p}>{p === 'all' ? 'All' : p}</option>)}</Select>
          </Field>
          <Field label="Max age"><Input type="number" placeholder="Any" value={ageMax} onChange={(e) => setAgeMax(e.target.value)} /></Field>
          <Field label="Min OVR"><Input type="number" placeholder="Any" value={ovrMin} onChange={(e) => setOvrMin(e.target.value)} /></Field>
          <Field label="Min potential"><Input type="number" placeholder="Any" value={potMin} onChange={(e) => setPotMin(e.target.value)} /></Field>
          <Field label="Max value (£m)"><Input type="number" placeholder="Any" value={valueMax} onChange={(e) => setValueMax(e.target.value)} /></Field>
          <Field label="Nationality">
            <Select value={nationality} onChange={(e) => setNationality(e.target.value)}>
              <option value="all">All</option>
              {NATIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </Field>
          <div className="flex items-end">
            <Btn size="sm" icon={X} className="w-full" onClick={() => { setQ(''); setLeague('all'); setPos('all'); setAgeMax(''); setOvrMin(''); setPotMin(''); setValueMax(''); setNationality('all') }}>Reset</Btn>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
            <span className="text-[12px] text-white/50">{loading ? 'Scanning…' : `${data?.total ?? 0} prospects found`}</span>
            <span className="text-[10.5px] text-white/30">Sorted by potential</span>
          </div>
          {loading && !data ? <Spinner label="Scouting" /> : (
            <TableWrap maxH="max-h-[calc(100vh-330px)]">
              <table className="data-table">
                <thead><tr><th>Player</th><th>Club</th><th>Age</th><th>Pos</th><th>OVR</th><th>POT</th><th>Value</th><th>Wage</th><th>Report</th><th></th></tr></thead>
                <tbody>
                  {data?.players.map((p) => (
                    <tr key={p.id} onClick={() => navigate(`/players/${p.id}`)}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="text-[14px]">{flagEmoji(p.nationality)}</span>
                          <span className="max-w-[170px] truncate text-[12.5px] text-white/90">{p.name}</span>
                        </div>
                      </td>
                      <td><span className="max-w-[120px] truncate text-[11.5px] text-white/50">{p.clubName || 'Free agent'}</span></td>
                      <td>{p.age}</td>
                      <td><Pos pos={p.position} /></td>
                      <td><span className={clsx('display text-[16px]', ovrTone(p.ovr))}>{p.ovr}</span></td>
                      <td><span className="text-[12px] font-medium text-[#c9b6ff]">{p.pot}</span></td>
                      <td className="text-white/60">{money(p.value)}</td>
                      <td className="text-white/40">{wage(p.wage)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <Btn size="sm" icon={reportBusy === p.id ? Loader2 : FileSearch} disabled={reportBusy === p.id} onClick={() => buildReport(p.id)}>
                          {reports[p.id] ? 'Update' : 'Scout'}
                        </Btn>
                      </td>
                      <td onClick={(e) => { e.stopPropagation(); toggle(p.id) }}>
                        <Star size={14} className={shortlist.includes(p.id) ? 'fill-amber-300 text-amber-300' : 'text-white/20 hover:text-white/60'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data && !data.players.length && <Empty icon={Binoculars} title="No prospects" text="Broaden your search filters." />}
            </TableWrap>
          )}
        </Panel>

        <Panel className="flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <SectionHead kicker="Watchlist" title="Shortlist" />
            <Chip>{shortlistData.length}</Chip>
          </div>
          <div className="scroll-thin max-h-[calc(100vh-260px)] space-y-1.5 overflow-y-auto p-3">
            {shortlistData.length === 0 && <Empty icon={Star} title="Shortlist empty" text="Star players to track them here." />}
            {shortlistData.map((p) => {
              const rep = reports[p.id]
              return (
                <div key={p.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <div className="flex items-center gap-2">
                    <Ovr ovr={p.ovr} size="sm" />
                    <button onClick={() => navigate(`/players/${p.id}`)} className="min-w-0 flex-1 text-left">
                      <div className="truncate text-[12px] font-medium text-white/85">{p.name}</div>
                      <div className="truncate text-[10px] text-white/35">{p.clubName || 'Free agent'} · {p.position} · {p.age}</div>
                    </button>
                    <button onClick={() => toggle(p.id)} className="rounded p-1 text-white/20 hover:text-rose-300"><Trash2 size={12} /></button>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <Btn size="sm" className="flex-1 !py-1 !text-[10.5px]" icon={FileSearch} onClick={() => buildReport(p.id)}>{rep ? 'View report' : 'Scout player'}</Btn>
                    <span className="text-[10px] text-white/35">{money(p.value)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
      </div>

      <Modal open={!!report} onClose={() => setReport(null)} wide kicker="Scouting report" title={report?.player?.name || 'Report'}>
        {report && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
              <div>
                <div className="kicker mb-1">Scout confidence</div>
                <div className="text-[13px] text-white/80">{report.accuracy}% accurate · {report.generatedAt}</div>
              </div>
              <Chip tone={report.accuracy >= 80 ? 'emerald' : report.accuracy >= 60 ? 'amber' : 'rose'}>
                {report.accuracy >= 80 ? 'High confidence' : report.accuracy >= 60 ? 'Moderate confidence' : 'Limited information'}
              </Chip>
            </div>
            <p className="text-[12.5px] leading-relaxed text-white/60">{report.summary}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5"><div className="kicker !text-[8.5px]">Current ability</div><div className="mt-1 text-[15px] font-semibold">{report.currentAbility[0]}–{report.currentAbility[1]}</div></div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5"><div className="kicker !text-[8.5px]">Potential</div><div className="mt-1 text-[15px] font-semibold text-[#c9b6ff]">{report.potential[0]}–{report.potential[1]}</div></div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5"><div className="kicker !text-[8.5px]">Expected value</div><div className="mt-1 text-[15px] font-semibold">{money(report.value[0])}–{money(report.value[1])}</div></div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5"><div className="kicker !text-[8.5px]">Contract</div><div className="mt-1 text-[15px] font-semibold">{report.contract.end}</div><div className="text-[9.5px] text-white/30">{wage(report.contract.wage)}</div></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div>
                <div className="kicker mb-2">Strengths</div>
                <div className="flex flex-wrap gap-1.5">
                  {report.strengths.map((s) => <Chip key={s.label} tone="emerald">{s.label} {s.value}</Chip>)}
                </div>
                <div className="kicker mb-2 mt-3">Weaknesses</div>
                <div className="flex flex-wrap gap-1.5">
                  {report.weaknesses.map((s) => <Chip key={s.label} tone="rose">{s.label} {s.value}</Chip>)}
                </div>
                <div className="kicker mb-2 mt-3">Playing style</div>
                <div className="text-[12px] text-white/60">{report.style}</div>
              </div>
              <div className="flex flex-col items-center justify-center">
                <Gauge value={report.suitability.score} label="Tactical fit" tone="#b6ff3d" size={104} />
                <div className="mt-1 max-w-[150px] text-center text-[10.5px] text-white/40">{report.suitability.text}</div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
