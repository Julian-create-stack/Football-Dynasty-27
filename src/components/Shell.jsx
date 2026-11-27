import React, { useState } from 'react'
import { NavLink, Outlet, useNavigate, Navigate, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import {
  LayoutDashboard, Shield, Users, Telescope, ArrowLeftRight, Trophy, CalendarDays, Building2,
  Sparkles, Wallet, ChevronRight, Loader2, LogOut, CalendarPlus, CircleDot,
} from 'lucide-react'
import { useGame } from '../store.jsx'
import { money, dateLong, ordinal } from '../lib/format.js'
import ClubBadge from './ClubBadge.jsx'
import { Spinner } from './ui.jsx'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/squad', label: 'Squad & Tactics', icon: Shield },
  { to: '/players', label: 'Players', icon: Users },
  { to: '/scouting', label: 'Scouting', icon: Telescope },
  { to: '/transfers', label: 'Transfers', icon: ArrowLeftRight },
  { to: '/competitions', label: 'Competitions', icon: Trophy },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/club', label: 'Club', icon: Building2 },
]

export default function Shell() {
  const { game, loading, advance, notify, leaveCareer, saveId } = useGame()
  const navigate = useNavigate()
  const location = useLocation()
  const [busy, setBusy] = useState(false)

  if (!saveId) return <Navigate to="/" replace />
  if (loading && !game) return <div className="min-h-screen"><Spinner label="Loading your career" /></div>
  if (!game) return <Navigate to="/" replace />

  const { club, save, league, position } = game
  const seasonLabel = `${save.season}/${String(save.season + 1).slice(2)}`

  async function doAdvance(mode) {
    if (busy) return
    setBusy(true)
    try {
      const res = await advance(mode)
      if (res?.pending) {
        notify(res.matchday ? 'Matchday — your side is in action.' : 'Your next match is ready.', 'info')
        navigate(`/match/${res.pending.id}`)
      } else if (res?.rolledOver) {
        notify(`New season: ${res.season}/${String(res.season + 1).slice(2)}`, 'success')
        navigate('/dashboard')
      } else {
        notify(`Advanced to ${dateLong(res.date)}`, 'success')
      }
    } catch (e) {
      notify(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative z-10 min-h-screen">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[236px] flex-col border-r border-white/[0.07] bg-[#060a13]/85 backdrop-blur-xl lg:flex">
        <div className="flex items-center gap-3 px-5 pb-5 pt-6">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#3d7bff] to-[#8b5cf6] shadow-glow">
            <span className="display text-[17px] leading-none text-white">UFM</span>
          </div>
          <div>
            <div className="display text-[17px] leading-none tracking-wide">Ultimate</div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.3em] text-white/35">FC 27 Career</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => clsx('nav-link', isActive && 'active')}>
              <Icon size={17} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mx-3 mb-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3">
          <div className="flex items-center gap-2.5">
            <ClubBadge club={club} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-semibold text-white/90">{club.short}</div>
              <div className="truncate text-[10.5px] text-white/35">{league.name}</div>
            </div>
            {position?.position && <div className="display text-[18px] text-white/70">{ordinal(position.position)}</div>}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2.5">
            <div className="min-w-0">
              <div className="kicker !text-[8.5px]">Manager</div>
              <div className="truncate text-[11.5px] text-white/70">{save.managerName}</div>
            </div>
            <button onClick={() => { leaveCareer(); navigate('/') }} title="Career menu"
              className="rounded-lg p-1.5 text-white/30 transition hover:bg-white/10 hover:text-white/80">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#060a13]/80 backdrop-blur-xl lg:pl-[236px]">
        <div className="flex h-[68px] items-center gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3 lg:hidden">
            <ClubBadge club={club} size={30} />
          </div>
          <div className="hidden min-w-0 sm:block">
            <div className="flex items-center gap-2">
              <ClubBadge club={club} size={26} className="hidden lg:flex" />
              <span className="display truncate text-[19px] leading-none">{club.name}</span>
              {position?.position && (
                <span className="chip !py-0.5 !text-[10px]">{ordinal(position.position)} · {position.pts} pts</span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-white/40">
              <span>{save.managerName}</span>
              <span className="opacity-40">·</span>
              <span>{seasonLabel}</span>
              <span className="opacity-40">·</span>
              <span>{dateLong(save.date)}</span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 md:flex">
              <Wallet size={14} className="text-white/40" />
              <div className="leading-tight">
                <div className="text-[9px] uppercase tracking-[0.14em] text-white/35">Transfer budget</div>
                <div className="text-[12.5px] font-semibold text-white/85">{money(club.transferBudget)}</div>
              </div>
            </div>
            {game.windowOpen && (
              <span className="hidden items-center gap-1.5 rounded-lg border border-lime/25 bg-lime/10 px-2.5 py-1.5 text-[10.5px] font-semibold text-[#d6ff8f] sm:flex">
                <CircleDot size={11} className="animate-pulse" /> Window open
              </span>
            )}
            <button onClick={() => doAdvance('day')} disabled={busy} title="Advance one day"
              className="btn !rounded-xl !px-2.5 !py-2.5 hidden sm:inline-flex">
              <CalendarPlus size={15} />
            </button>
            <button onClick={() => doAdvance('next-match')} disabled={busy}
              className="btn btn-primary !rounded-xl !px-4 !py-2.5 sm:!px-5">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              <span className="hidden sm:inline">Advance</span>
              <ChevronRight size={14} className="opacity-70" />
            </button>
          </div>
        </div>
      </header>

      <main className="min-h-[calc(100vh-68px)] px-4 pb-24 pt-5 sm:px-6 sm:pt-6 lg:pb-10 lg:pl-[260px]">
        <div key={location.pathname} className="mx-auto max-w-[1480px] animate-fade">
          <Outlet />
        </div>
      </main>

      {/* Mobile nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[#060a13]/95 backdrop-blur-xl lg:hidden">
        <div className="no-scrollbar flex overflow-x-auto px-1 py-1.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) => clsx('flex min-w-[64px] flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[9px] font-medium',
                isActive ? 'text-white' : 'text-white/35')}>
              <Icon size={17} />
              <span className="truncate">{label.split(' ')[0]}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
