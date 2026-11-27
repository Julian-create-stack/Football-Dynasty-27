import React, { useEffect } from 'react'
import clsx from 'clsx'
import { X, Loader2, ChevronRight } from 'lucide-react'
import { ovrBg, ovrTone, posTone } from '../lib/format.js'

export function Panel({ className, children, flat = false, ...rest }) {
  return <div className={clsx(flat ? 'panel-flat' : 'panel', className)} {...rest}>{children}</div>
}

export function Btn({ variant = 'ghost', size = 'md', icon: Icon, className, children, ...rest }) {
  return (
    <button
      className={clsx('btn', variant === 'primary' && 'btn-primary', variant === 'lime' && 'btn-lime',
        size === 'sm' && '!px-3 !py-1.5 !text-xs !rounded-lg', size === 'lg' && '!px-6 !py-3 !text-sm !rounded-xl',
        className)}
      {...rest}
    >
      {Icon && <Icon size={size === 'sm' ? 13 : 15} strokeWidth={2.2} />}
      {children}
    </button>
  )
}

export function Chip({ children, tone = 'default', className }) {
  const tones = {
    default: '',
    electric: '!bg-electric/15 !text-[#9fc0ff] !border-electric/30',
    violet: '!bg-violet/15 !text-[#c9b6ff] !border-violet/30',
    lime: '!bg-lime/10 !text-[#d6ff8f] !border-lime/25',
    rose: '!bg-rose-500/15 !text-rose-300 !border-rose-400/25',
    emerald: '!bg-emerald-500/15 !text-emerald-300 !border-emerald-400/25',
    amber: '!bg-amber-500/15 !text-amber-300 !border-amber-400/25',
  }
  return <span className={clsx('chip', tones[tone], className)}>{children}</span>
}

export function SectionHead({ kicker, title, action, className }) {
  return (
    <div className={clsx('flex items-end justify-between gap-4', className)}>
      <div>
        {kicker && <div className="kicker mb-1.5">{kicker}</div>}
        <h2 className="display text-[26px] leading-none">{title}</h2>
      </div>
      {action}
    </div>
  )
}

export function Stat({ label, value, sub, tone, className }) {
  return (
    <div className={clsx('rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3', className)}>
      <div className="kicker !text-[9.5px]">{label}</div>
      <div className={clsx('display mt-1.5 text-[26px] leading-none', tone)}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-white/40">{sub}</div>}
    </div>
  )
}

export function Meter({ value, max = 100, tone = 'electric', label, right, className, height = 'h-1.5' }) {
  const p = Math.max(0, Math.min(100, (value / max) * 100))
  const tones = {
    electric: 'from-[#3d7bff] to-[#7c9dff]',
    violet: 'from-[#8b5cf6] to-[#c4b5fd]',
    lime: 'from-[#7ee787] to-[#c8ff4d]',
    amber: 'from-[#f59e0b] to-[#fcd34d]',
    rose: 'from-[#f43f5e] to-[#fb7185]',
    cyan: 'from-[#22d3ee] to-[#67e8f9]',
  }
  return (
    <div className={className}>
      {(label || right) && (
        <div className="mb-1.5 flex items-center justify-between text-[11px]">
          <span className="text-white/45">{label}</span>
          <span className="font-semibold text-white/80">{right ?? `${Math.round(p)}%`}</span>
        </div>
      )}
      <div className={clsx('w-full overflow-hidden rounded-full bg-white/[0.07]', height)}>
        <div className={clsx('h-full rounded-full bg-gradient-to-r transition-all duration-700', tones[tone])} style={{ width: `${p}%` }} />
      </div>
    </div>
  )
}

export function Gauge({ value, label, tone = '#5b8cff', size = 92 }) {
  const p = Math.max(0, Math.min(100, value))
  const r = (size - 12) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.08)" strokeWidth="7" fill="none" />
          <circle cx={size / 2} cy={size / 2} r={r} stroke={tone} strokeWidth="7" fill="none" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c - (c * p) / 100} style={{ transition: 'stroke-dashoffset .9s ease', filter: `drop-shadow(0 0 6px ${tone}88)` }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="display text-[22px] leading-none">{Math.round(p)}</span>
          <span className="text-[8px] uppercase tracking-[0.18em] text-white/35">/100</span>
        </div>
      </div>
      {label && <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/40">{label}</div>}
    </div>
  )
}

export function Tabs({ tabs, value, onChange, className, size = 'md' }) {
  return (
    <div className={clsx('no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-black/25 p-1', className)}>
      {tabs.map((t) => {
        const key = typeof t === 'string' ? t : t.key
        const label = typeof t === 'string' ? t : t.label
        const active = value === key
        return (
          <button key={key} onClick={() => onChange(key)}
            className={clsx('rounded-lg px-3.5 font-semibold transition-all whitespace-nowrap',
              size === 'sm' ? 'py-1.5 text-[11.5px]' : 'py-2 text-[12.5px]',
              active ? 'bg-white/[0.10] text-white shadow-sm' : 'text-white/45 hover:text-white/80')}>
            {label}
          </button>
        )
      })}
    </div>
  )
}

export function Modal({ open, onClose, title, kicker, children, wide = false, footer }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade" onClick={onClose} />
      <div className={clsx('panel relative z-10 w-full overflow-hidden rounded-b-none sm:rounded-2xl animate-rise',
        wide ? 'max-w-4xl' : 'max-w-lg')} style={{ maxHeight: '92vh' }}>
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-4">
          <div>
            {kicker && <div className="kicker mb-1">{kicker}</div>}
            <h3 className="display text-[22px] leading-none">{title}</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/45 hover:bg-white/10 hover:text-white"><X size={17} /></button>
        </div>
        <div className="scroll-thin overflow-y-auto px-5 py-4" style={{ maxHeight: 'calc(92vh - 150px)' }}>{children}</div>
        {footer && <div className="border-t border-white/[0.07] px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, hint, children, className }) {
  return (
    <label className={clsx('block', className)}>
      {label && <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">{label}</div>}
      {children}
      {hint && <div className="mt-1 text-[11px] text-white/35">{hint}</div>}
    </label>
  )
}

export function Input({ className, ...props }) {
  return <input className={clsx('input', className)} {...props} />
}

export function Select({ className, children, ...props }) {
  return <select className={clsx('input', className)} {...props}>{children}</select>
}

export function Textarea({ className, ...props }) {
  return <textarea className={clsx('input', className)} {...props} />
}

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-20 text-white/45">
      <Loader2 size={18} className="animate-spin" />
      <span className="text-sm">{label}…</span>
    </div>
  )
}

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {Icon && <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-white/40"><Icon size={22} /></div>}
      <div className="display text-[20px] text-white/80">{title}</div>
      {text && <div className="mt-1 max-w-sm text-[12.5px] text-white/40">{text}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Ovr({ ovr, size = 'md', className }) {
  const sizes = { sm: 'h-7 w-7 text-[13px]', md: 'h-9 w-9 text-[15px]', lg: 'h-12 w-12 text-[20px]', xl: 'h-16 w-16 text-[26px]' }
  return (
    <span className={clsx('inline-flex items-center justify-center rounded-lg bg-gradient-to-br font-display font-bold text-white shadow-lg', ovrBg(ovr), sizes[size], className)}>
      {ovr}
    </span>
  )
}

export function Pos({ pos, className }) {
  return <span className={clsx('inline-flex min-w-[34px] items-center justify-center rounded-md border px-1.5 py-0.5 text-[10.5px] font-bold tracking-wide', posTone(pos), className)}>{pos}</span>
}

export function FormPills({ form = [], className }) {
  return (
    <div className={clsx('flex gap-1', className)}>
      {form.map((r, i) => (
        <span key={i} className={clsx('flex h-5 w-5 items-center justify-center rounded text-[9.5px] font-bold',
          r === 'W' ? 'bg-emerald-500/25 text-emerald-300' : r === 'L' ? 'bg-rose-500/25 text-rose-300' : 'bg-white/10 text-white/55')}>{r}</span>
      ))}
    </div>
  )
}

export function Toast({ toast }) {
  if (!toast) return null
  const tone = toast.tone === 'error' ? 'border-rose-400/40 bg-rose-950/80 text-rose-100'
    : toast.tone === 'success' ? 'border-emerald-400/40 bg-emerald-950/80 text-emerald-100'
      : 'border-electric/40 bg-[#0b1428]/95 text-white'
  return (
    <div className={clsx('fixed bottom-5 left-1/2 z-[100] -translate-x-1/2 rounded-xl border px-4 py-2.5 text-[12.5px] font-medium shadow-2xl backdrop-blur animate-rise', tone)}>
      {toast.message}
    </div>
  )
}

export function LinkRow({ icon: Icon, title, sub, onClick, right }) {
  return (
    <button onClick={onClick} className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-white/[0.045]">
      {Icon && <div className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-white/55 group-hover:text-white/80"><Icon size={14} /></div>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-medium text-white/85">{title}</div>
        {sub && <div className="truncate text-[11px] text-white/35">{sub}</div>}
      </div>
      {right || <ChevronRight size={14} className="text-white/25 group-hover:text-white/50" />}
    </button>
  )
}

export function SectionLabel({ children, className }) {
  return <div className={clsx('kicker', className)}>{children}</div>
}

export function TableWrap({ children, className, maxH = 'max-h-[520px]' }) {
  return <div className={clsx('scroll-thin overflow-auto rounded-xl', maxH, className)}>{children}</div>
}

export function AttrBar({ label, value, tone = 'electric' }) {
  return <Meter label={label} value={value} tone={value >= 85 ? 'lime' : value >= 75 ? 'electric' : value >= 65 ? 'cyan' : 'amber'} right={value} />
}
