import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import {
  ArrowLeft, ArrowLeftRight, Activity, CalendarDays, Check, FileSignature, HeartPulse, Loader2,
  MapPin, Shield, Star, TrendingUp, Trophy, Wallet, X, Users,
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { api } from '../api.js'
import { useGame } from '../store.jsx'
import ClubBadge from '../components/ClubBadge.jsx'
import { PlayerCard } from '../components/PlayerCard.jsx'
import { Btn, Chip, Field, Input, Meter, Modal, Ovr, Panel, Pos, SectionHead, Select, Spinner, Stat, Tabs, AttrBar, Empty } from '../components/ui.jsx'
import { money, wage, dateShort, dateMed, ovrTone, ratingTone, ordinal } from '../lib/format.js'
import { flagEmoji } from '../lib/nations.js'

const GROUPS = [
  ['Pace', ['acceleration', 'sprint_speed']],
  ['Shooting', ['finishing', 'shot_power', 'long_shots', 'volleys', 'penalties']],
  ['Passing', ['short_passing', 'long_passing', 'vision', 'crossing', 'curve', 'fk_accuracy']],
  ['Dribbling', ['ball_control', 'dribbling', 'agility', 'balance', 'reactions', 'composure']],
  ['Defending', ['interceptions', 'awareness', 'standing_tackle', 'sliding_tackle', 'heading']],
  ['Physical', ['stamina', 'strength', 'jumping', 'aggression']],
  ['Goalkeeping', ['gk_diving', 'gk_handling', 'gk_kicking', 'gk_positioning', 'gk_reflexes']],
]
const FACETS = [['PAC', 'pace'], ['SHO', 'shooting'], ['PAS', 'passing'], ['DRI', 'dribbling'], ['DEF', 'defending'], ['PHY', 'physicality']]

export default function PlayerProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { game, notify } = useGame()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')
  const [offerOpen, setOfferOpen] = useState(false)
  const [shortlisted, setShortlisted] = useState(false)

  const load = async () => {
    try {
      const d = await api.get(`/players/${id}`)
      setData(d)
      const sl = await api.get('/scouting/shortlist')
      setShortlisted(sl.some((p) => p.id === Number(id)))
    } catch (e) { notify(e.message, 'error') } finally { setLoading(false) }
  }
  useEffect(() => { setLoading(true); load() }, [id])

  if (loading && !data) return <Spinner label="Loading player" />
  if (!data) return null
  const { player, club, currentSeason, career, seasons, transfers, injuries, development } = data
  const isOwn = player.clubId === game?.club?.id
  const isFree = !player.clubId
  const a = player.attrs || {}
  const chartData = (development?.length ? development : [{ season: game?.save?.season, ovr: player.ovr, pot: player.pot }])
    .map((d) => ({ season: `${d.season}`, ovr: d.ovr, pot: d.pot }))

  async function toggleShortlist() {
    try {
      const r = await api.post('/scouting/shortlist', { playerId: player.id })
      setShortlisted(r.shortlisted)
      notify(r.shortlisted ? 'Added to shortlist' : 'Removed from shortlist', 'success')
    } catch (e) { notify(e.message, 'error') }
  }

  return (
    <div className="space-y-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-[11.5px] text-white/40 transition hover:text-white/80">
        <ArrowLeft size={13} /> Back
      </button>

      <Panel className="relative overflow-hidden p-0">
        <div className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: `radial-gradient(70% 120% at 85% 0%, ${club?.color1 || '#3d7bff'}33, transparent 55%)` }} />
        <div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[300px_1fr]">
          <div className="mx-auto w-full max-w-[300px]">
            <PlayerCard player={player} club={club} size="hero" />
          </div>
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[11.5px] text-white/45">
                  <span className="text-[16px]">{flagEmoji(player.nationality)}</span>
                  <span>{player.nationality}</span>
                  <span className="opacity-40">·</span>
                  <span>{player.age} years</span>
                  <span className="opacity-40">·</span>
                  <Pos pos={player.position} />
                  {player.alt && <span className="text-white/30">{player.alt}</span>}
                </div>
                <h1 className="display mt-1.5 text-[38px] leading-none sm:text-[46px]">{player.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {club ? (
                    <button onClick={() => navigate('/competitions')} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11.5px] text-white/70 hover:border-white/25">
                      <ClubBadge club={club} size={17} /> {club.name}
                    </button>
                  ) : <Chip tone="emerald">Free agent</Chip>}
                  <Chip>{player.squadRole}</Chip>
                  {player.injuredUntil && <Chip tone="rose"><HeartPulse size={10} /> Out until {dateShort(player.injuredUntil)}</Chip>}
                </div>
              </div>
              <div className="flex gap-2">
                <Btn size="sm" icon={Star} onClick={toggleShortlist} className={shortlisted ? '!border-amber-400/40 !bg-amber-500/10 !text-amber-200' : ''}>
                  {shortlisted ? 'Shortlisted' : 'Shortlist'}
                </Btn>
                {!isOwn && (
                  <Btn size="sm" variant="primary" icon={isFree ? Users : ArrowLeftRight} onClick={() => setOfferOpen(true)}>
                    {isFree ? 'Sign free agent' : 'Make offer'}
                  </Btn>
                )}
                {isOwn && <Btn size="sm" variant="primary" icon={FileSignature} onClick={() => navigate('/squad')}>Manage contract</Btn>}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
                <div className="kicker !text-[8.5px]">Overall</div>
                <div className={clsx('display mt-1 text-[28px] leading-none', ovrTone(player.ovr))}>{player.ovr}</div>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
                <div className="kicker !text-[8.5px]">Potential</div>
                <div className="display mt-1 text-[28px] leading-none text-white/60">{player.pot}</div>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
                <div className="kicker !text-[8.5px]">Market value</div>
                <div className="mt-1.5 text-[15px] font-semibold text-white/85">{money(player.value)}</div>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
                <div className="kicker !text-[8.5px]">Weekly wage</div>
                <div className="mt-1.5 text-[15px] font-semibold text-white/85">{wage(player.wage)}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {FACETS.map(([k, key]) => (
                <div key={key} className="rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5 text-center">
                  <div className="text-[16px] font-bold text-white/85">{a[key] ?? '—'}</div>
                  <div className="text-[8px] uppercase tracking-[0.14em] text-white/30">{k}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="This season" value={currentSeason?.apps ?? 0} sub="appearances" />
              <Stat label="Goals" value={currentSeason?.goals ?? 0} sub={`${currentSeason?.assists ?? 0} assists`} />
              <Stat label="Avg rating" value={currentSeason?.rating ?? '—'} tone={ratingTone(currentSeason?.rating)} sub="per match" />
              <Stat label="Contract" value={player.contractEnd} sub={player.releaseClause ? `Clause ${money(player.releaseClause)}` : 'No release clause'} />
            </div>
          </div>
        </div>
      </Panel>

      <Tabs tabs={[{ key: 'overview', label: 'Overview' }, { key: 'attributes', label: 'Attributes' }, { key: 'career', label: 'Career' }, { key: 'history', label: 'History' }]} value={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="grid gap-4 xl:grid-cols-3">
          <Panel className="p-5 xl:col-span-2">
            <SectionHead kicker="Development" title="Ability curve" action={<Chip tone="electric"><TrendingUp size={11} /> {player.pot - player.ovr > 0 ? `+${player.pot - player.ovr} potential` : 'At peak'}</Chip>} />
            <div className="mt-4 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
                  <XAxis dataKey="season" tick={{ fill: 'rgba(255,255,255,.35)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[40, 99]} tick={{ fill: 'rgba(255,255,255,.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#0b1220', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, fontSize: 12 }} />
                  <Line type="monotone" dataKey="pot" stroke="#8b5cf6" strokeDasharray="5 5" strokeWidth={2} dot={false} name="Potential" />
                  <Line type="monotone" dataKey="ovr" stroke="#5b8cff" strokeWidth={2.5} dot={{ r: 3, fill: '#5b8cff' }} name="Overall" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel className="p-5">
            <SectionHead kicker="Contract" title="Deal details" />
            <div className="mt-4 space-y-2.5 text-[12px]">
              {[
                ['Club', club?.name || 'Free agent'],
                ['Squad role', player.squadRole],
                ['Weekly wage', wage(player.wage)],
                ['Contract start', player.contractStart || '—'],
                ['Contract expiry', `${player.contractEnd}`],
                ['Release clause', player.releaseClause ? money(player.releaseClause) : 'None'],
                ['Market value', money(player.value)],
                ['Asking price', data.askingPrice ? money(data.askingPrice) : isOwn ? 'Not for sale' : 'Free'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-white/[0.05] pb-2 last:border-0">
                  <span className="text-white/40">{k}</span>
                  <span className="font-medium text-white/80">{v}</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel className="p-5 xl:col-span-2">
            <SectionHead kicker="Attribute profile" title="Strengths" />
            <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {Object.entries(a).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, v]) => (
                <AttrBar key={k} label={k.replace(/_/g, ' ')} value={v} />
              ))}
            </div>
          </Panel>
          <Panel className="p-5">
            <SectionHead kicker="Profile" title="Scout notes" />
            <div className="mt-4 space-y-3 text-[12px] leading-relaxed text-white/50">
              <p>{player.name} is a {player.age}-year-old {player.position} with an overall rating of {player.ovr} and potential of {player.pot}. {player.playstyles?.length ? `Signature traits: ${player.playstyles.slice(0, 4).join(', ')}.` : ''}</p>
              <div className="flex flex-wrap gap-1.5">
                {player.playstyles?.slice(0, 8).map((s) => <Chip key={s}>{s.replace(/\+$/, '')}</Chip>)}
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                <div className="kicker mb-1">Physical</div>
                <div className="text-white/60">{player.height ? `${player.height} cm` : '—'} · {player.weight ? `${player.weight} kg` : '—'} · {player.foot} foot</div>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {tab === 'attributes' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {GROUPS.filter(([g]) => g !== 'Goalkeeping' || player.position === 'GK').map(([group, keys]) => (
            <Panel key={group} className="p-5">
              <SectionHead kicker="Attributes" title={group} />
              <div className="mt-4 space-y-2.5">
                {keys.map((k) => <AttrBar key={k} label={k.replace(/_/g, ' ')} value={a[k] ?? 0} />)}
              </div>
            </Panel>
          ))}
        </div>
      )}

      {tab === 'career' && (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <Panel className="overflow-hidden">
            <div className="border-b border-white/[0.06] px-4 py-3"><span className="text-[13px] font-semibold">Season by season</span></div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Season</th><th>Apps</th><th>Starts</th><th>Goals</th><th>Assists</th><th>Minutes</th><th>Rating</th><th>Clean sheets</th></tr></thead>
                <tbody>
                  {seasons?.length ? seasons.map((s) => (
                    <tr key={s.season}>
                      <td>{s.season}/{String(s.season + 1).slice(2)}</td>
                      <td>{s.apps}</td><td>{s.starts}</td><td className="font-medium">{s.goals}</td><td>{s.assists}</td>
                      <td>{s.minutes}</td>
                      <td><span className={ratingTone(s.apps ? s.rating_sum / s.apps : 0)}>{s.apps ? (s.rating_sum / s.apps).toFixed(2) : '—'}</span></td>
                      <td>{s.clean_sheets}</td>
                    </tr>
                  )) : <tr><td colSpan={8} className="!py-8 text-center text-white/30">No appearances recorded yet</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-4 gap-2 border-t border-white/[0.06] p-4">
              <Stat label="Career apps" value={career.apps} />
              <Stat label="Goals" value={career.goals} />
              <Stat label="Assists" value={career.assists} />
              <Stat label="Avg rating" value={career.rating || '—'} />
            </div>
          </Panel>
          <Panel className="p-5">
            <SectionHead kicker="Milestones" title="Career totals" />
            <div className="mt-4 space-y-2.5 text-[12px]">
              <div className="flex justify-between border-b border-white/[0.05] pb-2"><span className="text-white/40">Minutes played</span><span className="text-white/80">{career.minutes.toLocaleString()}</span></div>
              <div className="flex justify-between border-b border-white/[0.05] pb-2"><span className="text-white/40">Goals per game</span><span className="text-white/80">{career.apps ? (career.goals / career.apps).toFixed(2) : '0.00'}</span></div>
              <div className="flex justify-between border-b border-white/[0.05] pb-2"><span className="text-white/40">Seasons</span><span className="text-white/80">{seasons?.length || 0}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Trophies</span><span className="text-white/80">—</span></div>
            </div>
          </Panel>
        </div>
      )}

      {tab === 'history' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel className="p-5">
            <SectionHead kicker="Transfers" title="Transfer history" />
            <div className="mt-3 space-y-1.5">
              {transfers?.length ? transfers.map((t) => (
                <div key={t.id} className="flex items-center gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-2">
                  <ArrowLeftRight size={13} className="text-white/30" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11.5px] text-white/80">{t.from_club || 'Free agent'} → {t.to_club}</div>
                    <div className="text-[9.5px] text-white/30">{dateMed(t.date)} · {t.type}</div>
                  </div>
                  <span className="text-[11px] font-medium text-white/60">{t.fee ? money(t.fee) : 'Free'}</span>
                </div>
              )) : <Empty icon={ArrowLeftRight} title="No transfers" text="No moves recorded in this save." />}
            </div>
          </Panel>
          <Panel className="p-5">
            <SectionHead kicker="Fitness" title="Injury history" />
            <div className="mt-3 space-y-1.5">
              {injuries?.length ? injuries.map((i) => (
                <div key={i.id} className="flex items-center gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-2">
                  <HeartPulse size={13} className="text-rose-300/70" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11.5px] text-white/80">{i.type}</div>
                    <div className="text-[9.5px] text-white/30">{dateMed(i.date)}</div>
                  </div>
                  <span className="text-[11px] text-white/50">{i.days} days</span>
                </div>
              )) : <Empty icon={HeartPulse} title="Clean bill of health" text="No injuries recorded in this save." />}
            </div>
          </Panel>
          <Panel className="p-5 lg:col-span-2">
            <SectionHead kicker="Development" title="Season snapshots" />
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {(development?.length ? development : [{ season: game?.save?.season, ovr: player.ovr, pot: player.pot }]).map((d) => (
                <div key={d.season} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <div className="kicker !text-[8.5px]">{d.season}/{String(d.season + 1).slice(2)}</div>
                  <div className="display mt-1 text-[20px] leading-none text-white/80">{d.ovr}</div>
                  <div className="text-[9.5px] text-white/30">POT {d.pot}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      <OfferModal open={offerOpen} onClose={() => setOfferOpen(false)} data={data} notify={notify} reload={load} isFree={isFree} />
    </div>
  )
}

function OfferModal({ open, onClose, data, notify, reload, isFree }) {
  const { game } = useGame()
  const { player } = data
  const [feeM, setFeeM] = useState(0)
  const [wageK, setWageK] = useState(Math.round((data.wageExpectation || player.wage) / 1000))
  const [years, setYears] = useState(3)
  const [role, setRole] = useState('First Team')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setFeeM(isFree ? 0 : Math.round((data.askingPrice || player.value) / 1e6))
    setWageK(Math.round((data.wageExpectation || player.wage) / 1000))
    setResult(null)
  }, [open])

  async function submit() {
    setBusy(true)
    setResult(null)
    try {
      const r = await api.post('/transfers/offer', {
        playerId: player.id, fee: Number(feeM) * 1e6, wage: Number(wageK) * 1000, years, role,
      })
      setResult(r)
      if (r.accepted) { notify(r.message, 'success'); await reload(); onClose() }
      else if (r.counter) { setFeeM(Math.round((r.counter.fee || feeM * 1e6) / 1e6)); setWageK(Math.round(r.counter.wage / 1000)) }
    } catch (e) { notify(e.message, 'error') } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} kicker={isFree ? 'Free agent' : `Transfer from ${data.club?.name}`} title={`Sign ${player.name}`}
      footer={<Btn variant="primary" className="w-full" disabled={busy} onClick={submit}>{busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowLeftRight size={14} />} Submit offer</Btn>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Transfer fee (£m)"><Input type="number" value={feeM} min={0} onChange={(e) => setFeeM(e.target.value)} disabled={isFree} /></Field>
        <Field label="Weekly wage (£k)"><Input type="number" value={wageK} min={1} onChange={(e) => setWageK(e.target.value)} /></Field>
        <Field label="Contract length">
          <Select value={years} onChange={(e) => setYears(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>{y} years</option>)}</Select>
        </Field>
        <Field label="Squad role">
          <Select value={role} onChange={(e) => setRole(e.target.value)}>{['Star Player', 'Important Player', 'First Team', 'Rotation', 'Squad Player', 'Prospect'].map((r) => <option key={r}>{r}</option>)}</Select>
        </Field>
      </div>
      <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] text-white/45">
        Your budget: <span className="text-white/80">{money(game?.club?.transferBudget)}</span>. The selling club values him around {money(data.askingPrice || player.value)}. Wage expectation: {wage(data.wageExpectation || player.wage)}.
      </div>
      {result && !result.accepted && (
        <div className="mt-3 rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-200">{result.message}</div>
      )}
    </Modal>
  )
}
