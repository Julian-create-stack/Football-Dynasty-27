import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import {
  ArrowRight, ArrowLeftRight, Activity, CalendarDays, Wallet, Users, Trophy, Building2, FileText,
  ChevronRight, Loader2, Play, Sparkles, ShieldAlert, Newspaper, Target, HeartPulse,
} from 'lucide-react'
import { useGame } from '../store.jsx'
import ClubBadge from '../components/ClubBadge.jsx'
import { Btn, Chip, Empty, FormPills, Gauge, Meter, Panel, SectionHead, Stat, TableWrap, Ovr, Pos } from '../components/ui.jsx'
import { money, wage, dateLong, dateShort, ordinal, resultTone, ratingTone } from '../lib/format.js'

const NEWS_ICON = {
  result: Trophy, injury: Activity, transfer: ArrowLeftRight, finance: Wallet, youth: Users,
  season: CalendarDays, contract: FileText, board: Building2, club: ShieldAlert, world: Newspaper, general: Newspaper,
}

export default function Dashboard() {
  const { game, advance, notify } = useGame()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  if (!game) return null
  const { club, save, league, position, nextMatch, pendingMatch, recentResults, upcoming, news, injuries, topPlayers, transferActivity, squadMorale, boardConfidence, wageBill, squadSize, trophies, windowOpen } = game

  async function goToMatch() {
    if (pendingMatch) { navigate(`/match/${pendingMatch.id}`); return }
    setBusy(true)
    try {
      const res = await advance('next-match')
      if (res.pending) navigate(`/match/${res.pending.id}`)
      else if (res.rolledOver) notify(`New season: ${res.season}/${String(res.season + 1).slice(2)}`, 'success')
      else notify(`Advanced to ${dateLong(res.date)}`, 'success')
    } catch (e) { notify(e.message, 'error') } finally { setBusy(false) }
  }

  const table = position?.table || []
  const userRow = position?.row
  const mini = table.slice(0, 5)
  const showUser = userRow && userRow.position > 5

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="kicker mb-1.5">Season {save.season}/{String(save.season + 1).slice(2)} · {dateLong(save.date)}</div>
          <h1 className="display text-[34px] leading-none sm:text-[40px]">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {save.managerName.split(' ')[0]}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Chip tone={windowOpen ? 'lime' : 'default'}>{windowOpen ? 'Transfer window open' : 'Window closed'}</Chip>
          <Chip tone="electric"><Trophy size={11} /> {league.name}</Chip>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Next match */}
        <Panel className="relative col-span-12 overflow-hidden p-0 xl:col-span-8">
          <div className="pointer-events-none absolute inset-0 opacity-70"
            style={{ background: `radial-gradient(80% 120% at 8% 0%, ${club.color1}33, transparent 55%), radial-gradient(70% 120% at 95% 20%, ${club.color2}22, transparent 55%)` }} />
          <div className="pointer-events-none absolute -left-10 top-1/2 -translate-y-1/2 opacity-[0.06]"><ClubBadge club={club} size={280} /></div>
          <div className="relative p-5 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-md bg-black/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/70 backdrop-blur">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lime" /> Next match
                </span>
                <Chip>{nextMatch?.competitionName || 'Season complete'}</Chip>
              </div>
              {nextMatch && <div className="text-[11.5px] text-white/45">{dateLong(nextMatch.date)} · {nextMatch.isHome ? 'Home' : 'Away'}</div>}
            </div>

            {nextMatch ? (
              <>
                <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-6">
                  <div className="flex flex-col items-center text-center">
                    <ClubBadge club={club} size={64} glow />
                    <div className="display mt-2 text-[18px] leading-none sm:text-[22px]">{club.short}</div>
                    <div className="mt-1 text-[10.5px] uppercase tracking-[0.14em] text-white/35">
                      {userRow ? `${ordinal(userRow.position)} · ${userRow.pts} pts` : '—'}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="display text-[34px] leading-none text-white/25 sm:text-[44px]">VS</div>
                    <div className="mt-2 text-[9.5px] font-semibold uppercase tracking-[0.2em] text-white/30">
                      {nextMatch.isHome ? 'Home' : 'Away'}
                    </div>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <ClubBadge club={{ short: nextMatch.opponentShort, color1: nextMatch.opponentColor1, color2: nextMatch.opponentColor2 }} size={64} glow />
                    <div className="display mt-2 line-clamp-2 text-[18px] leading-none sm:text-[22px]">{nextMatch.opponentShort}</div>
                    <div className="mt-1 text-[10.5px] uppercase tracking-[0.14em] text-white/35">
                      {nextMatch.opponentPosition ? `${ordinal(nextMatch.opponentPosition)} · ${nextMatch.opponentLeague}` : nextMatch.opponentLeague || '—'}
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
                  <Btn variant="primary" size="lg" onClick={goToMatch} disabled={busy}>
                    {busy ? <Loader2 size={16} className="animate-spin" /> : pendingMatch ? <Play size={16} /> : <Sparkles size={16} />}
                    {pendingMatch ? 'Kick off' : 'Advance to match'}
                  </Btn>
                  <Btn size="lg" icon={ArrowRight} onClick={() => navigate('/squad')}>Prepare squad</Btn>
                </div>
              </>
            ) : (
              <div className="py-8 text-center">
                <div className="display text-[26px] text-white/80">Season complete</div>
                <div className="mt-1 text-[12.5px] text-white/40">Advance to process the end of season and start the new campaign.</div>
                <Btn variant="primary" className="mt-4" onClick={goToMatch} disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Advance</Btn>
              </div>
            )}
          </div>
        </Panel>

        {/* League position */}
        <Panel className="col-span-12 p-5 xl:col-span-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="kicker">League position</div>
              <div className="mt-1 flex items-end gap-3">
                <div className="display text-[52px] leading-none">{userRow ? ordinal(userRow.position) : '—'}</div>
                <div className="pb-1.5">
                  <div className="text-[12px] text-white/55">{userRow?.pts ?? 0} pts</div>
                  <div className="text-[10.5px] text-white/30">{userRow ? `${userRow.w}W ${userRow.d}D ${userRow.l}L` : 'No matches'}</div>
                </div>
              </div>
            </div>
            {userRow && <FormPills form={userRow.form} />}
          </div>
          <div className="mt-4 space-y-0.5">
            {mini.map((r) => (
              <div key={r.clubId} className={clsx('flex items-center gap-2 rounded-lg px-2 py-1.5', r.clubId === club.id && 'bg-electric/10')}>
                <span className="w-4 text-[10px] text-white/30">{r.position}</span>
                <ClubBadge club={{ short: r.short, color1: r.color1, color2: r.color2 }} size={16} />
                <span className="min-w-0 flex-1 truncate text-[11.5px] text-white/75">{r.short}</span>
                <span className="text-[11px] font-semibold text-white/55">{r.pts}</span>
              </div>
            ))}
            {showUser && (
              <>
                <div className="py-0.5 text-center text-[10px] text-white/20">···</div>
                <div className="flex items-center gap-2 rounded-lg bg-electric/10 px-2 py-1.5">
                  <span className="w-4 text-[10px] text-white/40">{userRow.position}</span>
                  <ClubBadge club={club} size={16} />
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-white">{club.short}</span>
                  <span className="text-[11px] font-semibold text-white/80">{userRow.pts}</span>
                </div>
              </>
            )}
          </div>
          <Btn size="sm" className="mt-3 w-full" onClick={() => navigate('/competitions')}>Full table <ChevronRight size={13} /></Btn>
        </Panel>

        {/* Recent results */}
        <Panel className="col-span-12 p-5 md:col-span-6 xl:col-span-4">
          <SectionHead kicker="Form guide" title="Recent results" action={<Btn size="sm" onClick={() => navigate('/calendar')}>All</Btn>} />
          <div className="mt-4 space-y-1.5">
            {recentResults.length === 0 && <Empty title="No matches yet" text="Your season starts soon." icon={CalendarDays} />}
            {recentResults.map((f) => (
              <div key={f.id} className="flex items-center gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-2">
                <span className={clsx('flex h-5 w-5 items-center justify-center rounded text-[9.5px] font-bold', resultTone(f.result))}>{f.result}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] text-white/80">{f.isHome ? 'vs' : '@'} {f.opponentShort}</div>
                  <div className="text-[9.5px] uppercase tracking-[0.1em] text-white/25">{f.competitionName}</div>
                </div>
                <div className="display text-[15px] text-white/70">{f.isHome ? `${f.homeGoals}–${f.awayGoals}` : `${f.awayGoals}–${f.homeGoals}`}</div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Upcoming */}
        <Panel className="col-span-12 p-5 md:col-span-6 xl:col-span-4">
          <SectionHead kicker="What's next" title="Upcoming fixtures" action={<Btn size="sm" onClick={() => navigate('/calendar')}>Calendar</Btn>} />
          <div className="mt-4 space-y-1.5">
            {upcoming.length === 0 && <Empty title="No fixtures" text="The calendar is clear." icon={CalendarDays} />}
            {upcoming.slice(0, 5).map((f) => (
              <div key={f.id} className="flex items-center gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-2">
                <div className="w-11 shrink-0 text-center">
                  <div className="display text-[13px] leading-none text-white/70">{dateShort(f.date).split(' ')[0]}</div>
                  <div className="text-[9px] text-white/30">{dateShort(f.date).split(' ').slice(1).join(' ')}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] text-white/80">{f.isHome ? 'vs' : '@'} {f.opponentShort}</div>
                  <div className="text-[9.5px] uppercase tracking-[0.1em] text-white/25">{f.competitionName}</div>
                </div>
                <span className={clsx('rounded px-1.5 py-0.5 text-[9px] font-bold', f.isHome ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/8 text-white/45')}>{f.isHome ? 'H' : 'A'}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Club status */}
        <Panel className="col-span-12 p-5 md:col-span-6 xl:col-span-4">
          <SectionHead kicker="Club status" title="Board & squad" />
          <div className="mt-4 flex items-center justify-around">
            <Gauge value={boardConfidence} label="Board" tone="#5b8cff" />
            <Gauge value={squadMorale} label="Morale" tone="#b6ff3d" />
          </div>
          <div className="mt-4 space-y-3">
            <Meter label="Wage bill" value={wageBill} max={Math.max(wageBill, club.wageBudget)} tone="violet" right={`${wage(wageBill)} / ${money(club.wageBudget)}`} />
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Squad" value={squadSize} />
              <Stat label="Injured" value={injuries.length} tone={injuries.length ? 'text-rose-300' : undefined} />
              <Stat label="Budget" value={money(club.transferBudget)} />
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
            <Target size={13} className="mt-0.5 shrink-0 text-[#9fc0ff]" />
            <div>
              <div className="text-[9px] uppercase tracking-[0.14em] text-white/30">Board objective</div>
              <div className="text-[11.5px] text-white/70">{club.objective || 'Establish the club'}</div>
            </div>
          </div>
        </Panel>

        {/* Injuries */}
        <Panel className="col-span-12 p-5 md:col-span-6 xl:col-span-4">
          <SectionHead kicker="Treatment room" title="Injuries" action={<Chip tone={injuries.length ? 'rose' : 'emerald'}>{injuries.length} out</Chip>} />
          <div className="mt-4 space-y-1.5">
            {injuries.length === 0 && <Empty icon={HeartPulse} title="Everyone fit" text="No injury concerns in the squad." />}
            {injuries.map((p) => (
              <div key={p.id} className="flex items-center gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-2">
                <Ovr ovr={p.ovr} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] text-white/80">{p.name}</div>
                  <div className="text-[9.5px] text-white/30">{p.type}</div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-[0.1em] text-white/25">Return</div>
                  <div className="text-[10.5px] text-white/55">{dateShort(p.until)}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Top performers */}
        <Panel className="col-span-12 p-5 md:col-span-6 xl:col-span-4">
          <SectionHead kicker="Season leaders" title="Top performers" action={<Btn size="sm" onClick={() => navigate('/squad')}>Squad</Btn>} />
          <div className="mt-4 space-y-1">
            {topPlayers.length === 0 && <Empty icon={Users} title="No stats yet" text="Numbers appear after your first match." />}
            {topPlayers.map((p, i) => (
              <button key={p.playerId} onClick={() => navigate(`/players/${p.playerId}`)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.04]">
                <span className="w-4 text-[10px] font-bold text-white/25">{i + 1}</span>
                <Pos pos={p.position} />
                <span className="min-w-0 flex-1 truncate text-[12px] text-white/80">{p.name}</span>
                <span className="text-[10.5px] text-white/40">{p.apps} apps</span>
                <span className="w-7 text-right text-[11.5px] font-bold text-white/80">{p.goals}<span className="text-[9px] font-normal text-white/30">G</span></span>
                <span className="w-7 text-right text-[11.5px] text-white/60">{p.assists}<span className="text-[9px] font-normal text-white/30">A</span></span>
                <span className={clsx('w-8 text-right text-[11px] font-semibold', ratingTone(p.rating))}>{p.rating || '—'}</span>
              </button>
            ))}
          </div>
        </Panel>

        {/* News */}
        <Panel className="col-span-12 p-5 xl:col-span-8">
          <SectionHead kicker="Around the club" title="Latest news" action={<Chip>{news.length} stories</Chip>} />
          <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
            {news.length === 0 && <Empty icon={Newspaper} title="No news" text="Updates will appear here." />}
            {news.map((n) => {
              const Icon = NEWS_ICON[n.type] || Newspaper
              return (
                <div key={n.id} className="flex gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5">
                  <div className="mt-0.5 rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-white/45"><Icon size={13} /></div>
                  <div className="min-w-0">
                    <div className="text-[11.5px] font-semibold leading-snug text-white/85">{n.title}</div>
                    <div className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug text-white/35">{n.body}</div>
                    <div className="mt-1 text-[9px] uppercase tracking-[0.12em] text-white/20">{dateShort(n.date)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>

        {/* Transfers */}
        <Panel className="col-span-12 p-5 xl:col-span-4">
          <SectionHead kicker="Market" title="Transfer activity" action={<Btn size="sm" onClick={() => navigate('/transfers')}>Open</Btn>} />
          <div className="mt-4 space-y-1.5">
            {transferActivity.length === 0 && <Empty icon={ArrowLeftRight} title="No deals yet" text="The market is quiet." />}
            {transferActivity.map((t) => (
              <div key={t.id} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11.5px] text-white/80">{t.player_name}</span>
                  <span className={clsx('text-[10px] font-semibold', t.to_club === club.id ? 'text-emerald-300' : 'text-rose-300')}>
                    {t.to_club === club.id ? 'IN' : 'OUT'}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between text-[9.5px] text-white/30">
                  <span>{t.type}</span><span>{t.fee ? money(t.fee) : 'Free'}</span>
                </div>
              </div>
            ))}
          </div>
          {trophies?.length > 0 && (
            <div className="mt-4 border-t border-white/[0.06] pt-3">
              <div className="kicker mb-2">Trophy cabinet</div>
              <div className="flex flex-wrap gap-1.5">
                {trophies.slice(0, 8).map((t, i) => <Chip key={i} tone="amber"><Trophy size={10} /> {t.competition} {t.season}</Chip>)}
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
