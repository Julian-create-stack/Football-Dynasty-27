export function money(n) {
  if (n == null || Number.isNaN(n)) return '—'
  const v = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (v >= 1e9) return `${sign}£${(v / 1e9).toFixed(2)}b`
  if (v >= 1e6) return `${sign}£${(v / 1e6).toFixed(v >= 1e7 ? 1 : 2)}m`
  if (v >= 1e3) return `${sign}£${Math.round(v / 1e3)}k`
  return `${sign}£${Math.round(v)}`
}

export function wage(n) {
  if (n == null) return '—'
  if (n >= 1000) return `£${Math.round(n / 1000)}k/w`
  return `£${n}/w`
}

export function fullMoney(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n)
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function d(iso) { return new Date(iso + 'T00:00:00Z') }

export function dateShort(iso) {
  if (!iso) return '—'
  const dt = d(iso)
  return `${DAYS[dt.getUTCDay()]} ${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}`
}

export function dateMed(iso) {
  if (!iso) return '—'
  const dt = d(iso)
  return `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`
}

export function dateLong(iso) {
  if (!iso) return '—'
  const dt = d(iso)
  return `${DAYS[dt.getUTCDay()]} ${dt.getUTCDate()} ${MONTHS_FULL[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`
}

export function monthLabel(ym) {
  const [y, m] = ym.split('-')
  return `${MONTHS_FULL[Number(m) - 1]} ${y}`
}

export function daysBetween(a, b) {
  return Math.round((d(b) - d(a)) / 86400000)
}

export function ageLabel(age) { return `${age}` }

export function ovrTone(ovr) {
  if (ovr >= 87) return 'text-[#d9c7ff]'
  if (ovr >= 83) return 'text-[#9fd0ff]'
  if (ovr >= 78) return 'text-[#8ef0c0]'
  if (ovr >= 72) return 'text-[#e8ecf6]'
  return 'text-white/55'
}

export function ovrBg(ovr) {
  if (ovr >= 87) return 'from-[#b18cff] to-[#6d4dff]'
  if (ovr >= 83) return 'from-[#5b9dff] to-[#3d7bff]'
  if (ovr >= 78) return 'from-[#58e6a8] to-[#12a06a]'
  if (ovr >= 72) return 'from-[#9aa7c7] to-[#5f6b88]'
  return 'from-[#6b7280] to-[#3f4658]'
}

const POS_TONE = {
  GK: 'bg-amber-400/15 text-amber-300 border-amber-400/25',
  CB: 'bg-sky-400/15 text-sky-300 border-sky-400/25',
  LB: 'bg-sky-400/15 text-sky-300 border-sky-400/25',
  RB: 'bg-sky-400/15 text-sky-300 border-sky-400/25',
  LWB: 'bg-sky-400/15 text-sky-300 border-sky-400/25',
  RWB: 'bg-sky-400/15 text-sky-300 border-sky-400/25',
  CDM: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/25',
  CM: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/25',
  CAM: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/25',
  LM: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/25',
  RM: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/25',
  LW: 'bg-rose-400/15 text-rose-300 border-rose-400/25',
  RW: 'bg-rose-400/15 text-rose-300 border-rose-400/25',
  CF: 'bg-rose-400/15 text-rose-300 border-rose-400/25',
  ST: 'bg-rose-400/15 text-rose-300 border-rose-400/25',
}

export function posTone(pos) { return POS_TONE[pos] || 'bg-white/8 text-white/70 border-white/15' }

export function resultTone(r) {
  return r === 'W' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
    : r === 'L' ? 'bg-rose-500/20 text-rose-300 border-rose-400/30'
      : 'bg-white/10 text-white/60 border-white/15'
}

export function pct(a, b) { return b ? Math.round((a / b) * 100) : 0 }

export function initials(name = '') {
  const parts = name.replace(/[^A-Za-zÀ-ÿ\s'-]/g, '').split(/\s+/).filter(Boolean)
  if (!parts.length) return '??'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function ratingTone(r) {
  if (r >= 8) return 'text-emerald-300'
  if (r >= 7) return 'text-lime-300'
  if (r >= 6.5) return 'text-white/85'
  if (r >= 6) return 'text-amber-300'
  return 'text-rose-300'
}
