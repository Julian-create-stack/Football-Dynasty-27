import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import {
  Building2, Trophy, Wallet, Users, ArrowUpRight, ArrowDownRight, Sparkles, MapPin, Target,
  TrendingUp, GraduationCap, Shield, Loader2, ArrowUpCircle, Trash2, Star,
} from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid } from 'recharts'
import { api } from '../api.js'
import { useGame } from '../store.jsx'
import ClubBadge from '../components/ClubBadge.jsx'
import { Btn, Chip, Empty, Gauge, Meter, Ovr, Panel, Pos, SectionHead, Spinner, Stat, Tabs, TableWrap } from '../components/ui.jsx'
import { money, wage, dateShort, ordinal, ovrTone } from '../lib/format.js'
import { flagEmoji } from '../lib/nations.js'

const INCOME_COLORS = ['#3d7bff', '#8b5cf6', '#22d3ee', '#b6ff3d', '#f59e0b']
const EXPENSE_COLORS = ['#f43f5e', '#fb7185', '#f59e0b', '#a78bfa', '#64748b']

export default function Club() {
  const { game, notify } = useGame()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')
  const [busy, setBusy] = useState(null)

  const load = async () => {
    try { setData(await api.get('/club')) } catch (e) { notify(e.message, 'error') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  if (loading && !data) return <Spinner label="Loading club" />
  if (!data) return null
  const { club, board, stadium, facilities, finances, income, expense, trophies, history, youth, wageBill, squadSize, youthSize } = data

  async function act(path, playerId, msg) {
    setBusy(playerId)
    try { await api.post(path, { playerId }); notify(msg, 'success'); await load() } catch (e) { notify(e.message, 'error') } finally { setBusy(null) }
  }

  const incomeTotal = income.reduce((s, i) => s + i.t, 0)
  const expenseTotal = Math.abs(expense.reduce((s, i) => s + i.t, 0))

  return (
    <div className="space-y-4">
      <Panel className="relative overflow-hidden p-0">
        <div className="pointer-events-none absolute inset-0 opacity-80"
          style={{ background: `radial-gradient(80% 130% at 8% 0%, ${club.color1}2e, transparent 55%), radial-gradient(60% 120% at 95% 10%, ${club.color2}22, transparent 55%)` }} />
        <div className="relative flex flex-wrap items-center gap-5 p-5 sm:p-6">
          <ClubBadge club={club} size={76} glow />
          <div className="min-w-0 flex-1">
            <div className="kicker mb-1">{board.leagueName} · {club.country}</div>
            <h1 className="display text-[36px] leading-none sm:text-[44px]">{club.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/45">
              <span className="flex items-center gap-1"><MapPin size={11} /> {stadium.name} · {stadium.capacity.toLocaleString()}</span>
              <span className="flex items-center gap-1"><Star size={11} className="text-amber-300" /> Reputation {club.reputation}/10</span>
              <span className="flex items-center gap-1"><Target size={11} /> {board.position ? ordinal(board.position) : '—'} in {board.leagueName}</span>
              <span>Founded {club.founded}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Gauge value={board.confidence} label="Board" tone="#5b8cff" size={84} />
            <div className="hidden sm:block">
              <div className="kicker mb-1">Objective</div>
              <div className="max-w-[180px] text-[12px] text-white/70">{board.objective}</div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Club balance" value={money(club.balance)} tone={club.balance < 0 ? 'text-rose-300' : 'text-white'} />
        <Stat label="Transfer budget" value={money(club.transferBudget)} tone="text-[#9fc0ff]" />
        <Stat label="Wage bill" value={money(wageBill)} sub={`Budget ${money(club.wageBudget)}`} />
        <Stat label="Squad" value={squadSize} sub={`${youthSize} academy players`} />
      </div>

      <Tabs tabs={[{ key: 'overview', label: 'Overview' }, { key: 'finances', label: 'Finances' }, { key: 'youth', label: 'Youth academy' }, { key: 'history', label: 'History' }]} value={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="grid gap-4 xl:grid-cols-3">
          <Panel className="p-5 xl:col-span-2">
            <SectionHead kicker="Infrastructure" title="Facilities" />
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {[['Training', facilities.training], ['Youth', facilities.youth], ['Scouting', facilities.scouting]].map(([l, v]) => (
                <div key={l} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-[0.12em] text-white/40">{l}</span>
                    <span className="display text-[18px] text-white/80">{v}<span className="text-[11px] text-white/30">/10</span></span>
                  </div>
                  <Meter className="mt-2" value={v * 10} tone={v >= 8 ? 'lime' : v >= 6 ? 'electric' : 'amber'} height="h-2" />
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="kicker mb-2">Stadium</div>
                <div className="display text-[20px] leading-none">{stadium.name}</div>
                <div className="mt-1 text-[11px] text-white/40">{stadium.capacity.toLocaleString()} seats</div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="kicker mb-2">Board confidence</div>
                <Meter value={board.confidence} tone={board.confidence >= 70 ? 'lime' : board.confidence >= 45 ? 'amber' : 'rose'} right={`${board.confidence}%`} height="h-2" />
                <div className="mt-2 text-[11px] text-white/40">{board.confidence >= 80 ? 'The board is delighted with your work.' : board.confidence >= 55 ? 'The board is broadly satisfied.' : 'The board expects improvement.'}</div>
              </div>
            </div>
          </Panel>
          <Panel className="p-5">
            <SectionHead kicker="Honours" title="Trophy cabinet" action={<Chip tone="amber">{trophies.length}</Chip>} />
            <div className="mt-4 space-y-1.5">
              {trophies.length === 0 && <Empty icon={Trophy} title="Empty cabinet" text="Win a competition to fill it." />}
              {trophies.map((t) => (
                <div key={t.id} className="flex items-center gap-2.5 rounded-lg border border-amber-400/15 bg-amber-500/[0.06] px-2.5 py-2">
                  <Trophy size={13} className="text-amber-300" />
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-white/75">{t.competition}</span>
                  <span className="text-[10.5px] text-white/40">{t.season}/{String(t.season + 1).slice(2)}</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel className="p-5 xl:col-span-3">
            <SectionHead kicker="Recent business" title="Latest transactions" action={<Btn size="sm" onClick={() => setTab('finances')}>All finances</Btn>} />
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {finances.slice(0, 9).map((f) => (
                <div key={f.id} className="flex items-center gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-2">
                  <div className={clsx('rounded-lg p-1.5', f.amount >= 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300')}>
                    {f.amount >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] text-white/70">{f.description}</div>
                    <div className="text-[9px] text-white/30">{f.type} · {dateShort(f.date)}</div>
                  </div>
                  <span className={clsx('text-[11px] font-semibold', f.amount >= 0 ? 'text-emerald-300' : 'text-rose-300')}>{money(f.amount)}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {tab === 'finances' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel className="p-5">
            <SectionHead kicker="Revenue" title="Income" action={<Chip tone="emerald">{money(incomeTotal)}</Chip>} />
            <div className="mt-4 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={income.map((i, idx) => ({ name: i.type, value: i.t, fill: INCOME_COLORS[idx % INCOME_COLORS.length] }))} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid stroke="rgba(255,255,255,.05)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: 'rgba(255,255,255,.3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => money(v)} />
                  <YAxis type="category" dataKey="name" width={92} tick={{ fill: 'rgba(255,255,255,.5)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#0b1220', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, fontSize: 12 }} formatter={(v) => money(v)} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>{income.map((_, i) => <Cell key={i} fill={INCOME_COLORS[i % INCOME_COLORS.length]} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel className="p-5">
            <SectionHead kicker="Costs" title="Expenditure" action={<Chip tone="rose">{money(expenseTotal)}</Chip>} />
            <div className="mt-4 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expense.map((i, idx) => ({ name: i.type, value: Math.abs(i.t), fill: EXPENSE_COLORS[idx % EXPENSE_COLORS.length] }))} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid stroke="rgba(255,255,255,.05)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: 'rgba(255,255,255,.3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => money(v)} />
                  <YAxis type="category" dataKey="name" width={92} tick={{ fill: 'rgba(255,255,255,.5)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#0b1220', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, fontSize: 12 }} formatter={(v) => money(v)} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>{expense.map((_, i) => <Cell key={i} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel className="overflow-hidden xl:col-span-2">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <span className="text-[13px] font-semibold">Ledger</span>
              <Chip>{finances.length} entries</Chip>
            </div>
            <TableWrap maxH="max-h-[380px]">
              <table className="data-table">
                <thead><tr><th>Date</th><th>Type</th><th>Description</th><th className="text-right">Amount</th></tr></thead>
                <tbody>
                  {finances.map((f) => (
                    <tr key={f.id}>
                      <td className="text-white/40">{dateShort(f.date)}</td>
                      <td><Chip>{f.type}</Chip></td>
                      <td className="text-white/70">{f.description}</td>
                      <td className={clsx('text-right font-semibold', f.amount >= 0 ? 'text-emerald-300' : 'text-rose-300')}>{money(f.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Panel>
        </div>
      )}

      {tab === 'youth' && (
        <div className="space-y-4">
          <Panel className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="kicker mb-1">Academy</div>
              <div className="text-[12.5px] text-white/55">New prospects arrive every March. Youth development depends on facilities, coaching and playing time.</div>
            </div>
            <Chip tone="violet"><GraduationCap size={11} /> Youth facilities {facilities.youth}/10</Chip>
          </Panel>
          <Panel className="overflow-hidden">
            <TableWrap maxH="max-h-[calc(100vh-330px)]">
              <table className="data-table">
                <thead><tr><th>Player</th><th>Age</th><th>Pos</th><th>OVR</th><th>POT</th><th>Value</th><th>Contract</th><th></th></tr></thead>
                <tbody>
                  {youth.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span>{flagEmoji(p.nationality)}</span>
                          <span className="text-[12.5px] text-white/85">{p.name}</span>
                        </div>
                      </td>
                      <td>{p.age}</td>
                      <td><Pos pos={p.position} /></td>
                      <td><span className={clsx('display text-[16px]', ovrTone(p.ovr))}>{p.ovr}</span></td>
                      <td className="text-[#c9b6ff]">{p.pot}</td>
                      <td className="text-white/55">{money(p.value)}</td>
                      <td className="text-white/40">{p.contractEnd}</td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          <Btn size="sm" icon={busy === p.id ? Loader2 : ArrowUpCircle} disabled={busy === p.id} onClick={() => act('/squad/promote', p.id, `${p.name} promoted to the senior squad`)}>Promote</Btn>
                          <Btn size="sm" icon={Trash2} disabled={busy === p.id} onClick={() => act('/squad/release', p.id, `${p.name} released`)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!youth.length && <Empty icon={GraduationCap} title="No academy players" text="Your next youth intake arrives in March." />}
            </TableWrap>
          </Panel>
        </div>
      )}

      {tab === 'history' && (
        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <Panel className="overflow-hidden">
            <div className="border-b border-white/[0.06] px-4 py-3"><span className="text-[13px] font-semibold">Season history</span></div>
            <TableWrap maxH="max-h-[460px]">
              <table className="data-table">
                <thead><tr><th>Season</th><th>Competition</th><th>Winner</th><th>Your finish</th><th>Points</th></tr></thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td>{h.season}/{String(h.season + 1).slice(2)}</td>
                      <td className="text-white/55">{h.competition}</td>
                      <td className="text-white/80">{h.winner_name}</td>
                      <td>{h.user_position ? ordinal(h.user_position) : '—'}</td>
                      <td className="text-white/50">{h.user_points ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!history.length && <Empty icon={TrendingUp} title="No completed seasons" text="History is written at the end of each season." />}
            </TableWrap>
          </Panel>
          <Panel className="p-5">
            <SectionHead kicker="Identity" title="Club profile" />
            <div className="mt-4 space-y-2.5 text-[12px]">
              {[
                ['Stadium', stadium.name],
                ['Capacity', stadium.capacity.toLocaleString()],
                ['Founded', club.founded],
                ['Country', club.country],
                ['Reputation', `${club.reputation}/10`],
                ['Training facilities', `${facilities.training}/10`],
                ['Youth facilities', `${facilities.youth}/10`],
                ['Scouting network', `${facilities.scouting}/10`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-white/[0.05] pb-2 last:border-0">
                  <span className="text-white/40">{k}</span>
                  <span className="font-medium text-white/80">{v}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}
