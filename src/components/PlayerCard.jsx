import React from 'react'
import clsx from 'clsx'

export function PlayerCard({ player, club, size = 'md', className, onClick }) {
  if (!player) return null
  const c1 = club?.color1 || '#1b2a4a'
  const c2 = club?.color2 || '#3d7bff'
  const a = player.attrs || {}
  const facets = [
    ['PAC', a.pace], ['SHO', a.shooting], ['PAS', a.passing], ['DRI', a.dribbling], ['DEF', a.defending], ['PHY', a.physicality],
  ]
  const dims = size === 'hero'
    ? { w: 'w-full max-w-[330px]', pad: 'p-5', ovr: 'text-[64px]', pos: 'text-[15px]', name: 'text-[24px]' }
    : size === 'sm'
      ? { w: 'w-full', pad: 'p-3', ovr: 'text-[34px]', pos: 'text-[11px]', name: 'text-[14px]' }
      : { w: 'w-full', pad: 'p-4', ovr: 'text-[46px]', pos: 'text-[13px]', name: 'text-[18px]' }
  return (
    <div onClick={onClick}
      className={clsx('group relative overflow-hidden rounded-2xl border border-white/15 text-white shadow-card', dims.w, onClick && 'cursor-pointer transition-transform duration-300 hover:-translate-y-1', className)}
      style={{ background: `linear-gradient(152deg, ${c1} 0%, ${c2} 120%)` }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 80% -10%, rgba(255,255,255,.35), transparent 55%)' }} />
      <div className="absolute inset-0 opacity-[0.16]" style={{
        backgroundImage: 'repeating-linear-gradient(115deg, rgba(255,255,255,.5) 0 1px, transparent 1px 16px)',
        maskImage: 'radial-gradient(80% 70% at 70% 20%, black, transparent 75%)',
      }} />
      <div className="absolute -right-6 -top-4 select-none font-display text-[120px] font-bold leading-none text-white/10">
        {player.ovr}
      </div>
      <div className={clsx('relative', dims.pad)}>
        <div className="flex items-start justify-between">
          <div>
            <div className={clsx('display leading-none drop-shadow', dims.ovr)}>{player.ovr}</div>
            <div className={clsx('mt-0.5 font-bold uppercase tracking-[0.18em] text-white/85', dims.pos)}>{player.position}</div>
          </div>
          <div className="text-right">
            <div className="rounded-md bg-black/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70 backdrop-blur">
              {player.pot ? `POT ${player.pot}` : ''}
            </div>
            {player.squadNumber != null && <div className="mt-1.5 text-[10px] font-bold text-white/50">#{player.squadNumber}</div>}
          </div>
        </div>
        <div className="mt-4 border-t border-white/25 pt-2.5">
          <div className={clsx('display truncate leading-none', dims.name)}>{player.name}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-white/65">
            <span>{player.nationality}</span>
            {player.age ? <><span className="opacity-40">·</span><span>{player.age} yrs</span></> : null}
          </div>
        </div>
        {size !== 'sm' && (
          <div className="mt-4 grid grid-cols-6 gap-1 border-t border-white/20 pt-2.5">
            {facets.map(([k, v]) => (
              <div key={k} className="text-center">
                <div className="text-[12px] font-bold leading-none">{v ?? '—'}</div>
                <div className="mt-0.5 text-[8px] uppercase tracking-[0.1em] text-white/55">{k}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export { luminance, initialsOf } from './ClubBadge.jsx'
