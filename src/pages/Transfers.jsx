import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import {
  ArrowLeftRight, Check, Clock, Loader2, Search, Wallet, X, AlertTriangle, ArrowDownLeft, ArrowUpRight, Handshake,
} from 'lucide-react'
import { api } from '../api.js'
import { useGame } from '../store.jsx'
import ClubBadge from '../components/ClubBadge.jsx'
import { Btn, Chip, Empty, Field, Input, Meter, Modal, Ovr, Panel, Pos, SectionHead, Select, Spinner, Stat, TableWrap, Tabs } from '../components/ui.jsx'
import { money, wage, dateShort, ovrTone } from '../lib/format.js'
import { flagEmoji } from '../lib/nations.js'

export default function Transfers() {
  const { notify, game, refresh } = useGame()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('market')
  const [bidTarget, setBidTarget] = useState(null)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)

  const load = async () => {
    try { setData(await api.get('/transfers')) } catch (e) { notify(e.message, 'error') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!search.trim()) { setSearchResults(null); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await api.get(`/players?q=${encodeURIComponent(search.trim())}&pageSize=40`)
        setSearchResults(r.players)
      } catch (e) { notify(e.message, 'error') } finally { setSearching(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [search])

  if (loading && !data) return <Spinner label="Loading transfer market" />
  if (!data) return null

  const rows = searchResults || data.market

  async function resolveOffer(offerId, accept) {
    try {
      const r = await api.post('/transfers/offer/resolve', { offerId, accept })
      notify(accept ? 'Offer accepted — player sold' : 'Offer rejected', accept ? 'success' : 'info')
      await load(); await refresh()
    } catch (e) { notify(e.message, 'error') }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="kicker mb-1.5">Recruitment</div>
          <h1 className="display text-[34px] leading-none sm:text-[40px]">Transfers</h1>
        </div>
        <Chip tone={data.windowOpen ? 'lime' : 'default'}>
          <Clock size={11} /> {data.windowOpen ? 'Window open' : 'Window closed'}
        </Chip>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Transfer budget" value={money(data.budget)} tone="text-[#9fc0ff]" sub={`Balance ${money(data.balance)}`} />
        <Stat label="Wage budget" value={money(data.wageBudget)} sub={`Current ${money(data.wageBill)}`} />
        <Stat label="Pending offers" value={data.offers.length} tone={data.offers.length ? 'text-amber-300' : undefined} />
        <Stat label="Deals completed" value={data.history.length} />
      </div>

      <Tabs tabs={[{ key: 'market', label: 'Market' }, { key: 'offers', label: `Offers${data.offers.length ? ` (${data.offers.length})` : ''}` }, { key: 'listed', label: 'My listed' }, { key: 'history', label: 'History' }]} value={tab} onChange={setTab} />

      {tab === 'market' && (
        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-4 py-3">
            <div className="relative min-w-[220px] flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <Input className="!pl-9" placeholder="Search any player in world football…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="text-[10.5px] text-white/30">
              {searching ? 'Searching…' : searchResults ? `${searchResults.length} results` : `${data.market.length} available players`}
            </div>
          </div>
          <TableWrap maxH="max-h-[calc(100vh-360px)]">
            <table className="data-table">
              <thead><tr><th>Player</th><th>Club</th><th>Age</th><th>Pos</th><th>OVR</th><th>POT</th><th>Value</th><th>Asking</th><th>Wage</th><th>Contract</th><th></th></tr></thead>
              <tbody>
                {rows.map((p) => {
                  const own = p.clubId === game?.club?.id
                  return (
                    <tr key={p.id} onClick={() => navigate(`/players/${p.id}`)}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="text-[14px]">{flagEmoji(p.nationality)}</span>
                          <span className="max-w-[170px] truncate text-[12.5px] text-white/90">{p.name}</span>
                          {!p.clubId && <Chip tone="emerald">Free</Chip>}
                          {p.transferListed && <Chip tone="amber">Listed</Chip>}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <ClubBadge club={{ short: p.clubShort || p.clubName, color1: p.color1 }} size={16} />
                          <span className="max-w-[120px] truncate text-[11.5px] text-white/50">{p.clubName || 'Free agent'}</span>
                        </div>
                      </td>
                      <td>{p.age}</td>
                      <td><Pos pos={p.position} /></td>
                      <td><span className={clsx('display text-[16px]', ovrTone(p.ovr))}>{p.ovr}</span></td>
                      <td className="text-[12px] text-[#c9b6ff]">{p.pot}</td>
                      <td className="text-white/60">{money(p.value)}</td>
                      <td className="font-medium">{p.clubId ? money(p.askingPrice) : 'Free'}</td>
                      <td className="text-white/40">{wage(p.wage)}</td>
                      <td className={clsx(p.contractEnd <= (game?.save?.season || 2026) + 1 ? 'text-amber-300' : 'text-white/45')}>{p.contractEnd}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {!own && <Btn size="sm" variant="primary" disabled={!data.windowOpen} onClick={() => setBidTarget(p)}>Bid</Btn>}
                        {own && <Chip>Yours</Chip>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!rows.length && <Empty icon={Search} title="No players" text="Try another search." />}
          </TableWrap>
          {!data.windowOpen && (
            <div className="flex items-center gap-2 border-t border-amber-400/20 bg-amber-500/[0.06] px-4 py-2.5 text-[11px] text-amber-200/80">
              <AlertTriangle size={13} /> The transfer window is closed. Offers can be prepared but deals cannot be completed.
            </div>
          )}
        </Panel>
      )}

      {tab === 'offers' && (
        <Panel className="overflow-hidden">
          <div className="border-b border-white/[0.06] px-4 py-3"><span className="text-[13px] font-semibold">Incoming offers</span></div>
          <div className="space-y-2 p-3">
            {data.offers.length === 0 && <Empty icon={Handshake} title="No offers" text="Clubs will approach your players during transfer windows." />}
            {data.offers.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                <Ovr ovr={o.ovr} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-white/85">{o.player_name}</div>
                  <div className="text-[10.5px] text-white/35">{o.position} · {o.age} yrs · offer from {o.from_name}</div>
                </div>
                <div className="text-right">
                  <div className="kicker !text-[8.5px]">Fee</div>
                  <div className="text-[14px] font-semibold text-white/85">{money(o.fee)}</div>
                </div>
                <div className="flex gap-1.5">
                  <Btn size="sm" variant="primary" icon={Check} onClick={() => resolveOffer(o.id, true)}>Accept</Btn>
                  <Btn size="sm" icon={X} onClick={() => resolveOffer(o.id, false)}>Reject</Btn>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {tab === 'listed' && (
        <Panel className="overflow-hidden">
          <div className="border-b border-white/[0.06] px-4 py-3"><span className="text-[13px] font-semibold">Players on the transfer list</span></div>
          <div className="space-y-2 p-3">
            {data.listed.length === 0 && <Empty icon={ArrowLeftRight} title="Nobody listed" text="List players from the squad page to invite offers." />}
            {data.listed.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                <Ovr ovr={p.ovr} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-white/85">{p.name}</div>
                  <div className="text-[10.5px] text-white/35">{p.position} · {money(p.value)} · {wage(p.wage)}</div>
                </div>
                <Btn size="sm" onClick={async () => { await api.post('/squad/transfer-list', { playerId: p.id, listed: false }); await load(); notify('Removed from list', 'success') }}>Unlist</Btn>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {tab === 'history' && (
        <Panel className="overflow-hidden">
          <div className="border-b border-white/[0.06] px-4 py-3"><span className="text-[13px] font-semibold">Transfer history</span></div>
          <TableWrap maxH="max-h-[calc(100vh-330px)]">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Player</th><th>From</th><th>To</th><th>Type</th><th>Fee</th><th>Wage</th></tr></thead>
              <tbody>
                {data.history.map((t) => (
                  <tr key={t.id}>
                    <td className="text-white/45">{dateShort(t.date)}</td>
                    <td className="text-white/85">{t.player_name}</td>
                    <td className="text-white/45">{t.from_name || 'Free agent'}</td>
                    <td className="text-white/45">{t.to_name || '—'}</td>
                    <td><Chip>{t.type}</Chip></td>
                    <td className="font-medium">{t.fee ? money(t.fee) : 'Free'}</td>
                    <td className="text-white/45">{wage(t.wage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.history.length && <Empty icon={ArrowLeftRight} title="No transfers yet" text="Deals will appear here." />}
          </TableWrap>
        </Panel>
      )}

      <BidModal target={bidTarget} onClose={() => setBidTarget(null)} notify={notify} reload={load} budget={data.budget} windowOpen={data.windowOpen} />
    </div>
  )
}

function BidModal({ target, onClose, notify, reload, budget, windowOpen }) {
  const [feeM, setFeeM] = useState(0)
  const [wageK, setWageK] = useState(0)
  const [years, setYears] = useState(3)
  const [role, setRole] = useState('First Team')
  const [swapId, setSwapId] = useState('')
  const [squad, setSquad] = useState([])
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!target) return
    setFeeM(target.clubId ? Math.round((target.askingPrice || target.value) / 1e6) : 0)
    setWageK(Math.round((target.wage || 20000) / 1000))
    setYears(3); setRole('First Team'); setSwapId(''); setResult(null)
    api.get('/squad').then((d) => setSquad(d.squad)).catch(() => {})
  }, [target])

  if (!target) return null

  async function submit() {
    setBusy(true); setResult(null)
    try {
      const r = await api.post('/transfers/offer', {
        playerId: target.id, fee: Number(feeM) * 1e6, wage: Number(wageK) * 1000, years, role,
        includePlayerId: swapId ? Number(swapId) : null,
      })
      setResult(r)
      if (r.accepted) { notify(r.message, 'success'); await reload(); onClose() }
      else if (r.counter) { if (r.counter.fee != null) setFeeM(Math.round(r.counter.fee / 1e6)); if (r.counter.wage) setWageK(Math.round(r.counter.wage / 1000)) }
    } catch (e) { notify(e.message, 'error') } finally { setBusy(false) }
  }

  return (
    <Modal open={!!target} onClose={onClose} wide kicker={target.clubName || 'Free agent'} title={`Bid for ${target.name}`}
      footer={<Btn variant="primary" className="w-full" disabled={busy || !windowOpen} onClick={submit}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Handshake size={14} />} {windowOpen ? 'Submit offer' : 'Window closed'}
      </Btn>}>
      <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
        <Ovr ovr={target.ovr} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold">{target.name}</div>
          <div className="text-[11px] text-white/40">{target.position} · {target.age} yrs · {target.clubName || 'Free agent'} · POT {target.pot}</div>
        </div>
        <div className="text-right text-[11px] text-white/45">
          <div>Value {money(target.value)}</div>
          <div>Asking {target.clubId ? money(target.askingPrice) : 'Free'}</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label="Transfer fee (£m)"><Input type="number" value={feeM} min={0} onChange={(e) => setFeeM(e.target.value)} disabled={!target.clubId} /></Field>
        <Field label="Weekly wage (£k)"><Input type="number" value={wageK} min={1} onChange={(e) => setWageK(e.target.value)} /></Field>
        <Field label="Contract length"><Select value={years} onChange={(e) => setYears(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>{y} years</option>)}</Select></Field>
        <Field label="Squad role"><Select value={role} onChange={(e) => setRole(e.target.value)}>{['Star Player', 'Important Player', 'First Team', 'Rotation', 'Squad Player', 'Prospect'].map((r) => <option key={r}>{r}</option>)}</Select></Field>
        {target.clubId && (
          <Field label="Include player in swap (optional)" className="col-span-2">
            <Select value={swapId} onChange={(e) => setSwapId(e.target.value)}>
              <option value="">No player included</option>
              {squad.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.position} · {p.ovr} OVR · {money(p.value)}</option>)}
            </Select>
          </Field>
        )}
      </div>
      <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] text-white/45">
        Budget: <span className="text-white/80">{money(budget)}</span>. The selling club will respond to your valuation; the player will then consider wages, role and ambition.
      </div>
      {result && !result.accepted && <div className="mt-3 rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-200">{result.message}</div>}
    </Modal>
  )
}
