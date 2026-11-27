import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import {
  ArrowUpDown, ChevronDown, ClipboardList, Dumbbell, HeartPulse, Info, Loader2, RefreshCw,
  Shield, Sparkles, Star, UserPlus, Users, X, Wand2, FileSignature, Eye, BadgeCheck, Repeat,
} from 'lucide-react'
import { api } from '../api.js'
import { useGame } from '../store.jsx'
import ClubBadge from '../components/ClubBadge.jsx'
import { Btn, Chip, Empty, Field, Input, Meter, Modal, Ovr, Panel, Pos, SectionHead, Select, Spinner, Stat, Tabs, TableWrap, AttrBar } from '../components/ui.jsx'
import { money, wage, dateShort, ovrTone, posTone, ordinal } from '../lib/format.js'
import { flagEmoji } from '../lib/nations.js'

const GROUPS = { GK: 'GK', CB: 'DEF', LB: 'DEF', RB: 'DEF', LWB: 'DEF', RWB: 'DEF', CDM: 'MID', CM: 'MID', CAM: 'MID', LM: 'MID', RM: 'MID', LW: 'ATT', RW: 'ATT', CF: 'ATT', ST: 'ATT' }
function pen(a, b) { if (!a || !b) return 16; if (a === b) return 0; return GROUPS[a] === GROUPS[b] ? 8 : 16 }

const COLUMNS = [
  { key: 'name', label: 'Player', align: 'left' },
  { key: 'age', label: 'Age' },
  { key: 'position', label: 'Pos' },
  { key: 'ovr', label: 'OVR' },
  { key: 'pot', label: 'POT' },
  { key: 'value', label: 'Value' },
  { key: 'wage', label: 'Wage' },
  { key: 'contractEnd', label: 'Contract' },
  { key: 'fitness', label: 'Fitness' },
  { key: 'morale', label: 'Morale' },
  { key: 'apps', label: 'Apps' },
  { key: 'goals', label: 'Goals' },
]

export default function Squad() {
  const { game, notify } = useGame()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('squad')
  const [selected, setSelected] = useState(null)

  const load = async () => {
    try {
      const d = await api.get('/squad')
      setData(d)
    } catch (e) { notify(e.message, 'error') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  if (loading && !data) return <Spinner label="Loading squad" />
  if (!data) return null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="kicker mb-1.5">Squad & Tactics</div>
          <h1 className="display text-[34px] leading-none sm:text-[40px]">The dressing room</h1>
        </div>
        <Tabs tabs={[{ key: 'squad', label: 'Squad' }, { key: 'tactics', label: 'Tactics' }, { key: 'training', label: 'Training' }]} value={tab} onChange={setTab} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Squad size" value={data.squad.length} sub={`${data.youth.length} academy`} />
        <Stat label="Average age" value={(data.squad.reduce((s, p) => s + p.age, 0) / Math.max(1, data.squad.length)).toFixed(1)} />
        <Stat label="Average OVR" value={Math.round(data.squad.reduce((s, p) => s + p.ovr, 0) / Math.max(1, data.squad.length))} />
        <Stat label="Weekly wage" value={money(data.wageBill)} sub={`Budget ${money(data.club.wageBudget)}`} />
        <Stat label="Transfer budget" value={money(data.club.transferBudget)} tone="text-[#9fc0ff]" />
      </div>

      {tab === 'squad' && <SquadTable data={data} onSelect={setSelected} reload={load} />}
      {tab === 'tactics' && <TacticsTab data={data} reload={load} notify={notify} />}
      {tab === 'training' && <TrainingTab data={data} reload={load} notify={notify} onSelect={setSelected} />}

      <PlayerModal player={selected} data={data} onClose={() => setSelected(null)} reload={load} notify={notify} season={game?.save?.season} />
    </div>
  )
}

function SquadTable({ data, onSelect, reload }) {
  const [sort, setSort] = useState({ key: 'ovr', dir: 'desc' })
  const starters = new Set(data.lineup.starters.map((s) => s.playerId))
  const rows = useMemo(() => {
    const arr = [...data.squad]
    arr.sort((a, b) => {
      const k = sort.key
      const av = k === 'apps' ? a.stats.apps : k === 'goals' ? a.stats.goals : a[k]
      const bv = k === 'apps' ? b.stats.apps : k === 'goals' ? b.stats.goals : b[k]
      if (typeof av === 'string') return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sort.dir === 'asc' ? av - bv : bv - av
    })
    return arr
  }, [data.squad, sort])
  const toggle = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))

  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <Shield size={15} className="text-white/40" />
          <span className="text-[13px] font-semibold">Senior squad</span>
          <Chip>{data.squad.length} players</Chip>
        </div>
        <div className="flex items-center gap-2 text-[10.5px] text-white/35">
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-lime" /> In XI</span>
          <span className="ml-2">Click a player for actions</span>
        </div>
      </div>
      <TableWrap maxH="max-h-[calc(100vh-330px)]">
        <table className="data-table">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className={clsx(c.align === 'left' && 'text-left')} onClick={() => toggle(c.key)}>
                  <span className="inline-flex cursor-pointer items-center gap-1 select-none hover:text-white/70">
                    {c.label} <ArrowUpDown size={9} className={sort.key === c.key ? 'text-[#9fc0ff]' : 'opacity-30'} />
                  </span>
                </th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const expiring = p.contractEnd <= (data.club.season || 2026) + 1
              return (
                <tr key={p.id} onClick={() => onSelect(p)}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 text-right text-[10.5px] text-white/25">{p.squadNumber}</span>
                      <span className="text-[15px] leading-none">{flagEmoji(p.nationality)}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="max-w-[170px] truncate text-[13px] font-medium text-white/90">{p.name}</span>
                          {starters.has(p.id) && <span className="rounded bg-lime/15 px-1 py-0.5 text-[8px] font-bold text-[#d6ff8f]">XI</span>}
                          {p.transferListed && <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[8px] font-bold text-amber-300">LISTED</span>}
                        </div>
                        <div className="text-[9.5px] uppercase tracking-[0.1em] text-white/25">{p.squadRole}</div>
                      </div>
                    </div>
                  </td>
                  <td>{p.age}</td>
                  <td><Pos pos={p.position} /></td>
                  <td><span className={clsx('display text-[17px]', ovrTone(p.ovr))}>{p.ovr}</span></td>
                  <td><span className="text-[12px] text-white/45">{p.pot}</span></td>
                  <td className="font-medium">{money(p.value)}</td>
                  <td className="text-white/60">{wage(p.wage)}</td>
                  <td>
                    <span className={clsx('text-[11.5px]', expiring ? 'text-amber-300' : 'text-white/55')}>{p.contractEnd}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-white/10">
                        <div className={clsx('h-full rounded-full', p.fitness >= 90 ? 'bg-emerald-400' : p.fitness >= 75 ? 'bg-amber-400' : 'bg-rose-400')} style={{ width: `${p.fitness}%` }} />
                      </div>
                      <span className="text-[10px] text-white/35">{p.fitness}</span>
                    </div>
                  </td>
                  <td>
                    <span className={clsx('text-[11.5px] font-medium', p.morale >= 80 ? 'text-emerald-300' : p.morale >= 60 ? 'text-white/60' : 'text-rose-300')}>{p.morale}</span>
                  </td>
                  <td className="text-white/55">{p.stats.apps}</td>
                  <td className="font-medium">{p.stats.goals}</td>
                  <td><ChevronDown size={13} className="-rotate-90 text-white/20" /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </TableWrap>
    </Panel>
  )
}

function Pitch({ data, onSlot, onBench, onAuto, saving }) {
  const { club, squad, formations, tactics, lineup } = data
  const formation = formations.find((f) => f.key === tactics.formation) || formations[0]
  const byId = useMemo(() => Object.fromEntries(squad.map((p) => [p.id, p])), [squad])
  const slotMap = Object.fromEntries(lineup.starters.map((s) => [s.slot, s.playerId]))
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="display text-[18px] leading-none">{formation.label}</span>
          <Chip tone="electric">{formation.style}</Chip>
        </div>
        <Btn size="sm" icon={Wand2} onClick={onAuto} disabled={saving}>Auto pick</Btn>
      </div>
      <div className="pitch relative mx-auto aspect-[3/4] w-full max-w-[520px] overflow-hidden rounded-2xl">
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/15" />
        <div className="absolute left-1/2 top-1/2 h-[22%] w-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
        <div className="absolute left-1/2 top-0 h-[14%] w-[52%] -translate-x-1/2 border-b border-x border-white/12" />
        <div className="absolute bottom-0 left-1/2 h-[14%] w-[52%] -translate-x-1/2 border-t border-x border-white/12" />
        <div className="absolute left-1/2 top-0 h-[6%] w-[24%] -translate-x-1/2 border-b border-x border-white/10" />
        <div className="absolute bottom-0 left-1/2 h-[6%] w-[24%] -translate-x-1/2 border-t border-x border-white/10" />
        {formation.slots.map((slot, i) => {
          const pid = slotMap[i]
          const p = byId[pid]
          return (
            <button key={i} onClick={() => onSlot(i, slot)}
              className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}>
              <span className="relative flex h-11 w-11 items-center justify-center rounded-full border-2 shadow-lg transition-transform group-hover:scale-110"
                style={{ borderColor: p ? club.color1 : 'rgba(255,255,255,.25)', background: p ? `linear-gradient(150deg, ${club.color1}, ${club.color2})` : 'rgba(0,0,0,.45)' }}>
                {p ? <span className="display text-[15px] text-white drop-shadow">{p.ovr}</span> : <span className="text-[13px] text-white/40">+</span>}
                {p && <span className="absolute -bottom-1 -right-1 rounded bg-black/80 px-1 text-[7.5px] font-bold uppercase tracking-wide text-white/80">{p.position}</span>}
              </span>
              <span className="mt-1 max-w-[84px] truncate rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-medium text-white/80 backdrop-blur">
                {p ? p.name.split(' ').slice(-1)[0] : slot.pos}
              </span>
              <span className="text-[7.5px] uppercase tracking-[0.12em] text-white/35">{slot.pos}</span>
            </button>
          )
        })}
      </div>
      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="kicker">Bench</span>
          <span className="text-[10px] text-white/30">{lineup.bench.length}/9</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {lineup.bench.map((id) => {
            const p = byId[id]
            if (!p) return null
            return (
              <button key={id} onClick={() => onBench(id)} className="group flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-left hover:border-rose-400/40">
                <span className="text-[11px]">{flagEmoji(p.nationality)}</span>
                <span className="max-w-[86px] truncate text-[10.5px] text-white/70">{p.name.split(' ').slice(-1)[0]}</span>
                <span className={clsx('text-[10px] font-bold', ovrTone(p.ovr))}>{p.ovr}</span>
                <X size={10} className="text-white/20 group-hover:text-rose-300" />
              </button>
            )
          })}
          {lineup.bench.length < 9 && (
            <button onClick={() => onBench(null)} className="flex items-center gap-1 rounded-lg border border-dashed border-white/15 px-2 py-1 text-[10.5px] text-white/35 hover:border-electric/40 hover:text-white/70">
              <UserPlus size={11} /> Add
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function TacticsTab({ data, reload, notify }) {
  const [tactics, setTactics] = useState(data.tactics)
  const [saving, setSaving] = useState(false)
  const [picker, setPicker] = useState(null) // {slot, slotPos} | {bench:true}
  const timer = useRef(null)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) { first.current = false; return }
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        await api.post('/squad/tactics', tactics)
        setSaving(false)
      } catch (e) { notify(e.message, 'error') }
    }, 450)
    return () => clearTimeout(timer.current)
  }, [tactics])

  const update = (patch) => { setSaving(true); setTactics((t) => ({ ...t, ...patch })) }

  async function changeFormation(f) {
    setSaving(true)
    try {
      await api.post('/squad/tactics', { ...tactics, formation: f })
      await api.post('/squad/auto')
      setTactics((t) => ({ ...t, formation: f }))
      await reload()
    } catch (e) { notify(e.message, 'error') } finally { setSaving(false) }
  }

  async function saveLineup(starters, bench) {
    setSaving(true)
    try {
      await api.post('/squad/lineup', { starters, bench })
      await reload()
    } catch (e) { notify(e.message, 'error') } finally { setSaving(false) }
  }

  const lineup = data.lineup
  const formation = data.formations.find((f) => f.key === tactics.formation) || data.formations[0]
  const byId = Object.fromEntries(data.squad.map((p) => [p.id, p]))

  function choose(playerId) {
    if (picker?.bench) {
      if (lineup.bench.includes(playerId)) return
      const bench = [...lineup.bench, playerId].slice(0, 9)
      const starters = lineup.starters.filter((s) => s.playerId !== playerId)
      saveLineup(starters, bench)
      setPicker(null)
      return
    }
    const slot = picker.slot
    const existing = lineup.starters.find((s) => s.slot === slot)
    const other = lineup.starters.find((s) => s.playerId === playerId)
    const starters = lineup.starters.map((s) => {
      if (s.slot === slot) return { playerId, slot }
      if (other && s.slot === other.slot) return { playerId: existing?.playerId, slot: s.slot }
      return s
    }).filter((s) => s.playerId != null)
    const bench = lineup.bench.filter((id) => id !== playerId && !starters.some((s) => s.playerId === id))
    saveLineup(starters, bench)
    setPicker(null)
  }

  const candidates = useMemo(() => {
    if (!picker) return []
    const pos = picker.slotPos || 'CM'
    return [...data.squad]
      .filter((p) => !p.injuredUntil && p.suspension <= 0)
      .sort((a, b) => (b.ovr - pen(b.position, pos)) - (a.ovr - pen(a.position, pos)))
  }, [picker, data.squad])

  return (
    <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
      <Panel className="p-5">
        <Pitch data={data} saving={saving}
          onSlot={(slot, s) => setPicker({ slot, slotPos: s.pos })}
          onBench={(id) => {
            if (id == null) setPicker({ bench: true })
            else saveLineup(lineup.starters, lineup.bench.filter((x) => x !== id))
          }}
          onAuto={async () => {
            setSaving(true)
            try { await api.post('/squad/auto'); await reload() } catch (e) { notify(e.message, 'error') } finally { setSaving(false) }
          }} />
      </Panel>

      <div className="space-y-4">
        <Panel className="p-5">
          <SectionHead kicker="Shape" title="Formation" />
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {data.formations.map((f) => (
              <button key={f.key} onClick={() => changeFormation(f.key)}
                className={clsx('rounded-lg border px-2 py-2 text-center transition',
                  tactics.formation === f.key ? 'border-electric/60 bg-electric/10 text-white' : 'border-white/[0.07] bg-white/[0.02] text-white/50 hover:text-white/80')}>
                <div className="display text-[15px] leading-none">{f.label}</div>
                <div className="mt-1 text-[8.5px] uppercase tracking-[0.1em] opacity-60">{f.style}</div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionHead kicker="Instructions" title="Match approach" />
          <div className="mt-4 space-y-4">
            <Slider label="Mentality" value={tactics.mentality} min={1} max={5} labels={['Very defensive', 'Defensive', 'Balanced', 'Attacking', 'Very attacking']} onChange={(v) => update({ mentality: v })} />
            <Slider label="Pressing intensity" value={tactics.pressing} min={1} max={5} labels={['Very low', 'Low', 'Standard', 'High', 'Very high']} onChange={(v) => update({ pressing: v })} />
            <Slider label="Defensive line" value={tactics.defLine} min={1} max={5} labels={['Very deep', 'Deep', 'Standard', 'High', 'Very high']} onChange={(v) => update({ defLine: v })} />
            <Slider label="Width" value={tactics.width} min={1} max={5} labels={['Very narrow', 'Narrow', 'Standard', 'Wide', 'Very wide']} onChange={(v) => update({ width: v })} />
            <Slider label="Tempo" value={tactics.tempo} min={1} max={5} labels={['Very slow', 'Slow', 'Standard', 'Fast', 'Very fast']} onChange={(v) => update({ tempo: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Build-up style">
                <Select value={tactics.buildup} onChange={(e) => update({ buildup: e.target.value })}>
                  {['Balanced', 'Short Passing', 'Direct', 'Counter Attack'].map((o) => <option key={o}>{o}</option>)}
                </Select>
              </Field>
              <Field label="Chance creation">
                <Select value={tactics.chanceCreation} onChange={(e) => update({ chanceCreation: e.target.value })}>
                  {['Balanced', 'Through Balls', 'Wing Play', 'Possession'].map((o) => <option key={o}>{o}</option>)}
                </Select>
              </Field>
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionHead kicker="Dead balls" title="Set pieces" />
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Field label="Corners">
              <Select value={tactics.setPieces?.corners || 'Far post'} onChange={(e) => update({ setPieces: { ...tactics.setPieces, corners: e.target.value } })}>
                {['Near post', 'Far post', 'Short', 'Deep'].map((o) => <option key={o}>{o}</option>)}
              </Select>
            </Field>
            <Field label="Free kicks">
              <Select value={tactics.setPieces?.freekicks || 'Direct'} onChange={(e) => update({ setPieces: { ...tactics.setPieces, freekicks: e.target.value } })}>
                {['Direct', 'Cross', 'Short'].map((o) => <option key={o}>{o}</option>)}
              </Select>
            </Field>
            <Field label="Penalties">
              <Select value={tactics.setPieces?.penalties || 'Best taker'} onChange={(e) => update({ setPieces: { ...tactics.setPieces, penalties: e.target.value } })}>
                {['Best taker', 'Designated'].map((o) => <option key={o}>{o}</option>)}
              </Select>
            </Field>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[10.5px] text-white/30">
            {saving ? <><Loader2 size={11} className="animate-spin" /> Saving tactics…</> : <><BadgeCheck size={11} className="text-emerald-400" /> Tactics saved automatically</>}
          </div>
        </Panel>
      </div>

      <Modal open={!!picker} onClose={() => setPicker(null)}
        title={picker?.bench ? 'Add to bench' : `Select ${picker?.slotPos || ''}`}
        kicker={picker?.bench ? 'Substitutes' : 'Starting XI'} wide>
        <div className="space-y-1">
          {candidates.map((p) => {
            const inXi = lineup.starters.some((s) => s.playerId === p.id)
            const onBench = lineup.bench.includes(p.id)
            return (
              <button key={p.id} onClick={() => choose(p.id)}
                className="flex w-full items-center gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-left transition hover:border-electric/40 hover:bg-electric/5">
                <Ovr ovr={p.ovr} size="sm" />
                <span className="text-[13px]">{flagEmoji(p.nationality)}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] text-white/85">{p.name}</div>
                  <div className="text-[10px] text-white/30">{p.position} · {p.age} yrs · {p.squadRole}</div>
                </div>
                {inXi && <Chip tone="lime">XI</Chip>}
                {onBench && <Chip>Bench</Chip>}
                <span className="text-[10px] text-white/30">{p.fitness}%</span>
              </button>
            )
          })}
        </div>
      </Modal>
    </div>
  )
}

function Slider({ label, value, min, max, labels, onChange }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">{label}</span>
        <span className="text-[11.5px] font-medium text-white/80">{labels[value - min]}</span>
      </div>
      <input type="range" min={min} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="range w-full" />
      <div className="mt-1 flex justify-between text-[8px] uppercase tracking-wider text-white/20">
        <span>{labels[0]}</span><span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  )
}

function TrainingTab({ data, reload, notify, onSelect }) {
  const [busy, setBusy] = useState(false)
  const setAll = async (focus, intensity) => {
    setBusy(true)
    try {
      await Promise.all(data.squad.map((p) => api.post('/squad/training', { playerId: p.id, focus, intensity })))
      await reload()
      notify('Training updated for the whole squad', 'success')
    } catch (e) { notify(e.message, 'error') } finally { setBusy(false) }
  }
  const setOne = async (playerId, patch) => {
    try { await api.post('/squad/training', { playerId, ...patch }); await reload() } catch (e) { notify(e.message, 'error') }
  }
  return (
    <div className="space-y-4">
      <Panel className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="kicker mb-1">Team schedule</div>
          <div className="text-[12.5px] text-white/55">Development depends on age, potential, facilities, playing time and focus.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {['Balanced', 'Attacking', 'Defending', 'Physical'].map((f) => (
            <Btn key={f} size="sm" disabled={busy} onClick={() => setAll(f, 'Normal')}>{f}</Btn>
          ))}
          <Btn size="sm" icon={HeartPulse} disabled={busy} onClick={() => setAll('Balanced', 'Light')}>Rest day</Btn>
        </div>
      </Panel>
      <Panel className="overflow-hidden">
        <TableWrap maxH="max-h-[calc(100vh-330px)]">
          <table className="data-table">
            <thead><tr><th>Player</th><th>Pos</th><th>Age</th><th>OVR / POT</th><th>Focus</th><th>Intensity</th><th>Fitness</th><th>Development</th></tr></thead>
            <tbody>
              {data.squad.map((p) => (
                <tr key={p.id} onClick={() => onSelect(p)}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span>{flagEmoji(p.nationality)}</span>
                      <span className="text-[12.5px] text-white/85">{p.name}</span>
                      {p.injuredUntil && <Chip tone="rose">Injured</Chip>}
                    </div>
                  </td>
                  <td><Pos pos={p.position} /></td>
                  <td>{p.age}</td>
                  <td><span className={clsx('display text-[16px]', ovrTone(p.ovr))}>{p.ovr}</span><span className="ml-1 text-[11px] text-white/35">/ {p.pot}</span></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <Select className="!w-[140px] !py-1.5 !text-[11px]" value={p.trainingFocus || 'Balanced'}
                      onChange={(e) => setOne(p.id, { focus: e.target.value })}>
                      {data.trainingOptions.map((o) => <option key={o}>{o}</option>)}
                      <optgroup label="Position training">
                        {data.positionOptions.filter((x) => x !== p.position).map((o) => <option key={`p-${o}`} value={`Position:${o}`}>Position: {o}</option>)}
                      </optgroup>
                    </Select>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <Select className="!w-[110px] !py-1.5 !text-[11px]" value={p.trainingIntensity || 'Normal'}
                      onChange={(e) => setOne(p.id, { intensity: e.target.value })}>
                      {['Light', 'Normal', 'Intense'].map((o) => <option key={o}>{o}</option>)}
                    </Select>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                        <div className={clsx('h-full', p.fitness >= 90 ? 'bg-emerald-400' : p.fitness >= 75 ? 'bg-amber-400' : 'bg-rose-400')} style={{ width: `${p.fitness}%` }} />
                      </div>
                      <span className="text-[10px] text-white/35">{p.fitness}</span>
                    </div>
                  </td>
                  <td>
                    <span className={clsx('text-[11px]', p.pot - p.ovr >= 8 ? 'text-emerald-300' : p.pot - p.ovr >= 3 ? 'text-[#9fc0ff]' : 'text-white/35')}>
                      {p.pot - p.ovr >= 8 ? 'High ceiling' : p.pot - p.ovr >= 3 ? 'Room to grow' : p.age >= 30 ? 'Veteran' : 'Near peak'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Panel>
    </div>
  )
}

function PlayerModal({ player, data, onClose, reload, notify, season }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState('contract')
  const [wageK, setWageK] = useState(0)
  const [years, setYears] = useState(3)
  const [role, setRole] = useState('First Team')
  const [clauseM, setClauseM] = useState('')
  const [number, setNumber] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!player) return
    setTab('contract')
    setWageK(Math.round(player.wage / 1000))
    setYears(Math.max(1, Math.min(5, (player.contractEnd || 2027) - (season || 2026))))
    setRole(player.squadRole || 'First Team')
    setClauseM(player.releaseClause ? Math.round(player.releaseClause / 1e6) : '')
    setNumber(String(player.squadNumber || ''))
    setResult(null)
  }, [player])

  if (!player) return null
  const expiring = player.contractEnd <= (season || 2026) + 1

  async function offerContract() {
    setBusy(true)
    setResult(null)
    try {
      const r = await api.post('/squad/contract', {
        playerId: player.id, wage: wageK * 1000, years, role,
        releaseClause: clauseM ? Number(clauseM) * 1e6 : null,
      })
      setResult(r)
      if (r.accepted) { notify(r.message, 'success'); await reload(); onClose() }
      else if (r.counter) setWageK(Math.round(r.counter.wage / 1000))
    } catch (e) { notify(e.message, 'error') } finally { setBusy(false) }
  }

  async function act(path, body, msg) {
    setBusy(true)
    try { await api.post(path, body); notify(msg, 'success'); await reload(); onClose() } catch (e) { notify(e.message, 'error') } finally { setBusy(false) }
  }

  return (
    <Modal open={!!player} onClose={onClose} wide kicker={`${player.position} · ${player.age} years · ${player.nationality}`}
      title={player.name}
      footer={<div className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] text-white/30">{player.squadRole} · {money(player.value)} value · {wage(player.wage)}</span>
        <Btn size="sm" icon={Eye} onClick={() => navigate(`/players/${player.id}`)}>Full profile</Btn>
      </div>}>
      <div className="grid gap-4 sm:grid-cols-[190px_1fr]">
        <div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="kicker">Overall</div>
                <div className={clsx('display text-[42px] leading-none', ovrTone(player.ovr))}>{player.ovr}</div>
              </div>
              <div className="text-right">
                <div className="kicker">Potential</div>
                <div className="display text-[24px] leading-none text-white/55">{player.pot}</div>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <Meter label="Fitness" value={player.fitness} tone={player.fitness >= 85 ? 'lime' : 'amber'} right={player.fitness} />
              <Meter label="Morale" value={player.morale} tone="violet" right={player.morale} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1.5 text-[10.5px]">
              <div className="rounded-lg bg-white/[0.03] px-2 py-1.5"><div className="text-white/30">Value</div><div className="text-white/80">{money(player.value)}</div></div>
              <div className="rounded-lg bg-white/[0.03] px-2 py-1.5"><div className="text-white/30">Wage</div><div className="text-white/80">{wage(player.wage)}</div></div>
              <div className="rounded-lg bg-white/[0.03] px-2 py-1.5"><div className="text-white/30">Contract</div><div className={clsx(expiring && 'text-amber-300')}>{player.contractEnd}</div></div>
              <div className="rounded-lg bg-white/[0.03] px-2 py-1.5"><div className="text-white/30">Number</div><div className="text-white/80">#{player.squadNumber}</div></div>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Btn size="sm" disabled={busy} icon={Repeat} onClick={() => act('/squad/transfer-list', { playerId: player.id, listed: !player.transferListed }, player.transferListed ? 'Removed from transfer list' : 'Added to transfer list')}>
              {player.transferListed ? 'Unlist' : 'List'}
            </Btn>
            <Btn size="sm" disabled={busy} icon={FileSignature} onClick={() => setTab('number')}>Number</Btn>
            <Btn size="sm" disabled={busy} icon={X} onClick={() => act('/squad/release', { playerId: player.id }, 'Player released')}>Release</Btn>
            <Btn size="sm" disabled={busy} icon={Dumbbell} onClick={() => setTab('training')}>Train</Btn>
          </div>
        </div>

        <div>
          <Tabs size="sm" tabs={[{ key: 'contract', label: 'New contract' }, { key: 'training', label: 'Training' }, { key: 'number', label: 'Squad number' }, { key: 'attributes', label: 'Attributes' }]} value={tab} onChange={setTab} />
          {tab === 'contract' && (
            <div className="mt-4">
              {expiring && <div className="mb-3 rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">Contract expires at the end of this season. Other clubs may approach him.</div>}
              <div className="grid grid-cols-3 gap-3">
                <Field label="Weekly wage (£k)"><Input type="number" value={wageK} onChange={(e) => setWageK(Number(e.target.value))} min={1} /></Field>
                <Field label="Length (years)">
                  <Select value={years} onChange={(e) => setYears(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>{y}</option>)}</Select>
                </Field>
                <Field label="Squad role">
                  <Select value={role} onChange={(e) => setRole(e.target.value)}>{data.roles.map((r) => <option key={r}>{r}</option>)}</Select>
                </Field>
              </div>
              <Field label="Release clause (£m, optional)" className="mt-3">
                <Input type="number" value={clauseM} onChange={(e) => setClauseM(e.target.value)} placeholder="No clause" min={0} />
              </Field>
              {result && !result.accepted && (
                <div className="mt-3 rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-200">{result.message}</div>
              )}
              <Btn variant="primary" className="mt-3 w-full" disabled={busy} onClick={offerContract}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <FileSignature size={14} />} Offer contract
              </Btn>
            </div>
          )}
          {tab === 'training' && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Training focus">
                <Select value={player.trainingFocus || 'Balanced'} onChange={(e) => act('/squad/training', { playerId: player.id, focus: e.target.value }, 'Training focus updated')}>
                  {data.trainingOptions.map((o) => <option key={o}>{o}</option>)}
                  <optgroup label="Position training">
                    {data.positionOptions.filter((x) => x !== player.position).map((o) => <option key={`p-${o}`} value={`Position:${o}`}>Position: {o}</option>)}
                  </optgroup>
                </Select>
              </Field>
              <Field label="Intensity">
                <Select value={player.trainingIntensity || 'Normal'} onChange={(e) => act('/squad/training', { playerId: player.id, intensity: e.target.value }, 'Training intensity updated')}>
                  {['Light', 'Normal', 'Intense'].map((o) => <option key={o}>{o}</option>)}
                </Select>
              </Field>
              <div className="sm:col-span-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] text-white/45">
                Intense training accelerates development but increases injury risk and fatigue. Light training aids recovery.
              </div>
            </div>
          )}
          {tab === 'number' && (
            <div className="mt-4">
              <Field label="Squad number">
                <Input type="number" min={1} max={99} value={number} onChange={(e) => setNumber(e.target.value)} />
              </Field>
              <Btn variant="primary" className="mt-3 w-full" disabled={busy}
                onClick={() => act('/squad/number', { playerId: player.id, number: Number(number) }, 'Squad number updated')}>Save number</Btn>
            </div>
          )}
          {tab === 'attributes' && (
            <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2">
              {Object.entries(player.attrs || {}).slice(0, 20).map(([k, v]) => (
                <AttrBar key={k} label={k.replace(/_/g, ' ')} value={v} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
