import { LEAGUES, PAIR_TIER2, clubById } from './data.js'

const DAY = 86400000

export function iso(d) {
  return d.toISOString().slice(0, 10)
}
export function parse(isoStr) {
  return new Date(isoStr + 'T00:00:00Z')
}
export function addDays(isoStr, n) {
  return iso(new Date(parse(isoStr).getTime() + n * DAY))
}
export function dayOfWeek(isoStr) {
  return parse(isoStr).getUTCDay()
}
export function firstSaturdayOnOrAfter(isoStr) {
  let d = parse(isoStr)
  while (d.getUTCDay() !== 6) d = new Date(d.getTime() + DAY)
  return iso(d)
}
export function nextWeekdayOnOrAfter(isoStr, wd) {
  let d = parse(isoStr)
  while (d.getUTCDay() !== wd) d = new Date(d.getTime() + DAY)
  return iso(d)
}

export function seasonWindow(startYear) {
  const start = firstSaturdayOnOrAfter(`${startYear}-08-12`)
  const end = `${startYear + 1}-05-23`
  return { start, end, seasonEnd: `${startYear + 1}-06-30`, nextStart: `${startYear + 1}-07-01` }
}

function leagueDates(start, end, rounds, breakWeeks) {
  const dates = []
  const breaks = new Set(breakWeeks)
  let d = parse(start)
  const endD = parse(end)
  while (d <= endD) {
    const s = iso(d)
    if (d.getUTCDay() === 6 && !breaks.has(s)) dates.push(s)
    d = new Date(d.getTime() + DAY)
  }
  // add midweek (Thursday) rounds if the league needs more matchdays
  if (dates.length < rounds) {
    const extra = []
    d = parse(start)
    while (d <= endD) {
      const s = iso(d)
      if (d.getUTCDay() === 4) extra.push(s)
      d = new Date(d.getTime() + DAY)
    }
    for (const s of extra) {
      if (dates.length >= rounds) break
      if (!dates.includes(s)) dates.push(s)
    }
    dates.sort()
  }
  return dates.slice(0, rounds)
}

export function roundRobin(teams) {
  const list = [...teams]
  if (list.length % 2) list.push(null)
  const n = list.length
  const rounds = []
  for (let r = 0; r < n - 1; r++) {
    const pairs = []
    for (let i = 0; i < n / 2; i++) {
      const a = list[i]
      const b = list[n - 1 - i]
      if (a && b) pairs.push(r % 2 === 0 ? [a, b] : [b, a])
    }
    rounds.push(pairs)
    const fixed = list[0]
    const rest = list.slice(1)
    rest.unshift(rest.pop())
    list.splice(0, list.length, fixed, ...rest)
  }
  return rounds
}

export function doubleRoundRobin(teams) {
  const first = roundRobin(teams)
  const second = first.map((round) => round.map(([h, a]) => [a, h]))
  return [...first, ...second]
}

export const CUP_ROUNDS = ['R32', 'R16', 'QF', 'SF', 'F']
export const EURO_ROUNDS = ['R16', 'QF', 'SF', 'F']

export const COMPETITION_NAMES = {
  'premier-league': 'Premier League', 'la-liga': 'LaLiga', bundesliga: 'Bundesliga',
  'serie-a': 'Serie A', 'ligue-1': 'Ligue 1', championship: 'EFL Championship',
  'la-liga-2': 'LaLiga Hypermotion', 'bundesliga-2': '2. Bundesliga', 'serie-b': 'Serie B', 'ligue-2': 'Ligue 2',
  ucl: 'UEFA Champions League', uel: 'UEFA Europa League', uecl: 'UEFA Conference League',
  'cup-eng': 'FA Cup', 'cup-esp': 'Copa del Rey', 'cup-ger': 'DFB-Pokal',
  'cup-ita': 'Coppa Italia', 'cup-fra': 'Coupe de France',
}

export const CUP_BY_COUNTRY = { England: 'cup-eng', Spain: 'cup-esp', Germany: 'cup-ger', Italy: 'cup-ita', France: 'cup-fra' }

export function domesticCupRoundDate(start, roundIdx) {
  const offsets = [32, 74, 116, 179, 242]
  return addDays(start, offsets[roundIdx] ?? 242)
}
export function euroRoundDate(start, roundIdx) {
  const offsets = [45, 101, 192, 255]
  return addDays(start, offsets[roundIdx] ?? 255)
}

function shuffle(arr, seed = 1) {
  const a = [...arr]
  let s = seed
  const rnd = () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Seeded bracket: strongest vs weakest.
export function seedBracket(clubs, seed = 7) {
  const sorted = [...clubs]
  const n = sorted.length
  const order = []
  for (let i = 0; i < n / 2; i++) {
    order.push(sorted[i], sorted[n - 1 - i])
  }
  return shuffle(order, seed)
}

export function generateSeasonFixtures(db, saveId, season, startYear, clubs, opts = {}) {
  const window = seasonWindow(startYear)
  const insert = db.prepare(`INSERT INTO fixtures
    (save_id, season, competition, round, matchday, date, home_id, away_id, played, neutral, bracket)
    VALUES (?,?,?,?,?,?,?,?,0,?,?)`)

  const breakWeeks = []
  for (const w of [3, 8, 13, 30]) breakWeeks.push(addDays(window.start, w * 7))

  const byLeague = {}
  for (const c of clubs) {
    ;(byLeague[c.league_id] ||= []).push(c)
  }

  const all = []
  for (const league of LEAGUES) {
    const teams = (byLeague[league.id] || []).map((c) => c.id)
    if (teams.length < 4) continue
    const rounds = doubleRoundRobin(teams)
    const dates = leagueDates(window.start, window.end, rounds.length, breakWeeks)
    rounds.forEach((round, ri) => {
      const date = dates[ri] || window.end
      round.forEach(([home, away]) => {
        all.push([saveId, season, league.id, `MD${ri + 1}`, ri + 1, date, home, away, 0, null])
      })
    })
  }

  // Domestic cups: 32 clubs per country (top tier + second tier by reputation)
  for (const [country, comp] of Object.entries(CUP_BY_COUNTRY)) {
    const pool = clubs.filter((c) => c.country === country).sort((a, b) => b.reputation - a.reputation).slice(0, 32)
    if (pool.length < 16) continue
    const bracket = seedBracket(pool, 11)
    for (let i = 0; i < bracket.length; i += 2) {
      const a = bracket[i]
      const b = bracket[i + 1]
      if (!a || !b) continue
      all.push([saveId, season, comp, 'R32', 1, domesticCupRoundDate(window.start, 0), a.id, b.id, 0, i / 2])
    }
  }

  // European competitions
  const europe = opts.europe
  if (europe) {
    for (const comp of ['ucl', 'uel', 'uecl']) {
      // Entrants arrive either as club rows or as bare club ids.
      const entrants = (europe[comp] || []).map((c) => (c && typeof c === 'object' ? c.id : c)).filter(Boolean)
      if (entrants.length < 16) continue
      const bracket = seedBracket(entrants.slice(0, 16), comp === 'ucl' ? 3 : comp === 'uel' ? 5 : 9)
      for (let i = 0; i < bracket.length; i += 2) {
        const a = bracket[i]
        const b = bracket[i + 1]
        if (!a || !b) continue
        all.push([saveId, season, comp, 'R16', 1, euroRoundDate(window.start, 0), a, b, 0, i / 2])
      }
    }
  }

  const tx = db.transaction(() => {
    for (const row of all) insert.run(...row)
  })
  tx()
  return { fixtures: all.length, window }
}

export function maybeAdvanceCup(db, saveId, competition) {
  const fixtures = db.prepare(`SELECT * FROM fixtures WHERE save_id=? AND competition=? ORDER BY bracket`).all(saveId, competition)
  if (!fixtures.length) return
  const rounds = competition.startsWith('cup-') ? CUP_ROUNDS : EURO_ROUNDS
  const byRound = {}
  for (const f of fixtures) (byRound[f.round] ||= []).push(f)
  const current = rounds.find((r) => byRound[r] && byRound[r].some((f) => !f.played))
  if (!current) return
  const roundFixtures = byRound[current]
  if (roundFixtures.some((f) => !f.played)) return
  const idx = rounds.indexOf(current)
  if (idx === rounds.length - 1) return
  const next = rounds[idx + 1]
  if (byRound[next]?.length) return
  const save = db.prepare('SELECT * FROM saves WHERE id=?').get(saveId)
  const seasonStartYear = Number(save.season_start.slice(0, 4))
  const start = seasonWindow(seasonStartYear).start
  const date = competition.startsWith('cup-') ? domesticCupRoundDate(start, idx + 1) : euroRoundDate(start, idx + 1)
  const winners = roundFixtures
    .sort((a, b) => a.bracket - b.bracket)
    .map((f) => {
      if (f.home_goals > f.away_goals) return f.home_id
      if (f.away_goals > f.home_goals) return f.away_id
      return f.home_id
    })
  const insert = db.prepare(`INSERT INTO fixtures
    (save_id, season, competition, round, matchday, date, home_id, away_id, played, neutral, bracket)
    VALUES (?,?,?,?,?,?,?,?,0,?,?)`)
  const tx = db.transaction(() => {
    for (let i = 0; i < winners.length; i += 2) {
      if (!winners[i] || !winners[i + 1]) continue
      insert.run(saveId, save.season, competition, next, idx + 2, date, winners[i], winners[i + 1], next === 'F' ? 1 : 0, i / 2)
    }
  })
  tx()
}

export function clubName(id) {
  return clubById[id]?.name || id
}

export function leaguePair(leagueId) {
  return PAIR_TIER2[leagueId] || null
}
