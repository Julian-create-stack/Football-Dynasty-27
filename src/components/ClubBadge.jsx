import React, { useId } from 'react'
import clsx from 'clsx'

export function initialsOf(name = '') {
  const parts = name.replace(/[^A-Za-zÀ-ÿ\s'-]/g, '').split(/\s+/).filter(Boolean)
  if (!parts.length) return '??'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function luminance(hex = '#000000') {
  const h = hex.replace('#', '')
  if (h.length < 6) return 0
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export default function ClubBadge({ club, size = 40, className, glow = false }) {
  const uid = useId().replace(/[:]/g, '')
  const c1 = club?.color1 || '#3d7bff'
  const c2 = club?.color2 || '#8b5cf6'
  const short = club?.short || club?.name || '??'
  const label = short.length <= 4 ? short.toUpperCase() : initialsOf(short)
  const ink = luminance(c1) > 0.62 ? '#0a0f1c' : '#ffffff'
  const fontSize = label.length >= 4 ? 14 : label.length === 3 ? 17 : 19
  return (
    <div className={clsx('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size * 1.12, filter: glow ? 'drop-shadow(0 6px 16px rgba(0,0,0,.55))' : undefined }}>
      <svg viewBox="0 0 64 72" width={size} height={size * 1.12}>
        <defs>
          <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c1} />
            <stop offset="100%" stopColor={c2} />
          </linearGradient>
          <linearGradient id={`sh-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,.34)" />
            <stop offset="55%" stopColor="rgba(255,255,255,.04)" />
            <stop offset="100%" stopColor="rgba(0,0,0,.28)" />
          </linearGradient>
        </defs>
        <path d="M32 1.5 L61 11 V36 C61 53 48.5 64.5 32 70.5 C15.5 64.5 3 53 3 36 V11 Z" fill={`url(#bg-${uid})`} stroke="rgba(255,255,255,.42)" strokeWidth="1.6" />
        <path d="M32 1.5 L61 11 V36 C61 53 48.5 64.5 32 70.5 C15.5 64.5 3 53 3 36 V11 Z" fill={`url(#sh-${uid})`} />
        <path d="M32 7 L55 14.5 V35.5 C55 49 45 58.5 32 63.5 C19 58.5 9 49 9 35.5 V14.5 Z" fill="rgba(0,0,0,.14)" stroke="rgba(255,255,255,.28)" strokeWidth="1" />
        <text x="32" y="41" textAnchor="middle" fontSize={fontSize} fontWeight="800" fill={ink}
          fontFamily="Barlow Condensed, Inter, sans-serif" letterSpacing="0.5">{label}</text>
      </svg>
    </div>
  )
}
