import { db } from '../db.js'
import { getSave, getTable, getClubRow, getSquad, addNews, saveLineup, getTactics, getFixture } from './world.js'
import { simulateFixture, buildMatchState, tickMatch, applyResult } from './sim.js'
import {
  addDays, seasonWindow, generateSeasonFixtures, maybeAdvanceCup, CUP_BY_COUNTRY,
  COMPETITION_NAMES, firstSaturdayOnOrAfter,
} from './fixtures.js'
import { aiTransferTick, generateIncomingOffers, aiRenewals, isWindowOpen, marketValue, wageExpectation } from './transfers.js'
import { youthIntake, generateYouthPlayer } from './youth.js'
import { autoLineup, POSITION_GROUP } from './positions.js'
import { PAIR_TIER2, LEAGUES } from './data.js'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const DOW = (d) => new Date(d + 'T00:00:00Z').getUTCDay()
const dayNum = (d) => Number(d.slice(8, 10))

function setDate(saveId, date) {
  db.prepare('UPDATE saves SET date=?, updated_at=? WHERE id=?').run(date, new Date().toISOString(), saveId)
}

function fixtureInfo(saveId, f) {
  if (!f) return null
  const home = getClubRow(saveId, f.home_id)
  const away = getClubRow(saveId, f.away_id)
  return {
    id: f.id, competition: f.competition, competitionName: COMPETITION_NAMES[f.competition] || f.competition,
    date: f.date, round: f.round, homeId: f.home_id, awayId: f.away_id,
    homeName: home?.name, awayName: away?.name, homeShort: home?.short, awayShort: away?.short,
    homeColor: home?.color1, awayColor: away?.color1,
  }
}

export function nextUserFixture(saveId) {
  const save = getSave(saveId)
  return db.prepare(`SELECT * FROM fixtures WHERE save_id=? AND season=? AND played=0 AND (home_id=? OR away_id=?) ORDER BY date ASC LIMIT 1`)
    .get(saveId, save.season, save.club_id, save.club_id)
}

function processDate(saveId, date, save) {
  const fixtures = db.prepare('SELECT * FROM fixtures WHERE save_id=? AND date=? AND played=0 ORDER BY id').all(saveId, date)
  if (!fixtures.length) return { fixtures: [] }
  const userFx = fixtures.find((f) => f.home_id === save.club_id || f.away_id === save.club_id)
  if (userFx) return { pending: userFx, fixtures }
  const comps = new Set(fixtures.map((f) => f.competition))
  const tx = db.transaction(() => {
    for (const f of fixtures) {
      try { simulateFixture(saveId, f) } catch (e) { console.error('sim failed', f.id, e.message) }
    }
  })
  tx()
  for (const comp of comps) {
    if (comp.startsWith('cup-') || ['ucl', 'uel', 'uecl'].includes(comp)) maybeAdvanceCup(db, saveId, comp)
  }
  return { fixtures }
}

const FOCUS_KEYS = {
  Pace: ['acceleration', 'sprint_speed', 'pace'],
  Shooting: ['finishing', 'shot_power', 'long_shots', 'positioning'],
  Passing: ['short_passing', 'long_passing', 'vision', 'crossing'],
  Dribbling: ['ball_control', 'dribbling', 'agility', 'balance'],
  Defending: ['defending', 'interceptions', 'standing_tackle', 'sliding_tackle', 'awareness'],
  Physical: ['strength', 'stamina', 'jumping', 'physicality'],
  Goalkeeping: ['gk_diving', 'gk_handling', 'gk_kicking', 'gk_positioning', 'gk_reflexes'],
  Balanced: [],
}

function developPlayers(saveId, date, multiplier = 1) {
  const rows = db.prepare(`SELECT p.id,p.age,p.ovr,p.pot,p.attrs,p.training_focus,p.training_intensity,p.injured_until,p.club_id,
    c.training_facilities,c.reputation,c.tier FROM players p JOIN clubs c ON c.save_id=p.save_id AND c.id=p.club_id WHERE p.save_id=?`).all(saveId)
  const stats = db.prepare('SELECT player_id, apps FROM stats WHERE save_id=? AND season=?').all(saveId, getSave(saveId).season)
  const appsMap = new Map(stats.map((s) => [s.player_id, s.apps]))
  const upd = db.prepare('UPDATE players SET ovr=?, attrs=?, position=?, alt=?, injured_until=?, injury_type=? WHERE save_id=? AND id=?')
  const updPos = db.prepare('UPDATE players SET ovr=?, attrs=?, position=?, alt=? WHERE save_id=? AND id=?')
  const updPlain = db.prepare('UPDATE players SET ovr=?, attrs=? WHERE save_id=? AND id=?')
  const updInjury = db.prepare('UPDATE players SET ovr=?, attrs=?, injured_until=?, injury_type=? WHERE save_id=? AND id=?')
  const tx = db.transaction(() => {
    for (const p of rows) {
      if (p.injured_until && p.injured_until > date) continue
      const attrs = JSON.parse(p.attrs)
      let ovr = p.ovr
      let position = null
      let alt = null
      const age = p.age
      const intensity = p.training_intensity === 'Intense' ? 1.3 : p.training_intensity === 'Light' ? 0.7 : 1
      const fac = (p.training_facilities || 6) / 7
      const room = Math.max(0, p.pot - ovr)
      const apps = appsMap.get(p.id) || 0
      const playFactor = apps >= 8 ? 1.12 : apps >= 3 ? 1.0 : 0.82
      const base = age <= 17 ? 0.10 : age <= 19 ? 0.085 : age <= 21 ? 0.07 : age <= 23 ? 0.05 : age <= 25 ? 0.032 : age <= 27 ? 0.018 : age <= 29 ? 0.007 : 0
      const chance = base * intensity * fac * playFactor * Math.min(1, room / 10) * multiplier
      if (room > 0 && Math.random() < chance) {
        ovr += 1
        const focus = (p.training_focus || 'Balanced').replace('Position:', '')
        const keys = FOCUS_KEYS[focus] || []
        if (keys.length) {
          const k = keys[Math.floor(Math.random() * keys.length)]
          attrs[k] = Math.min(99, (attrs[k] || 50) + 1)
        } else {
          const all = Object.keys(attrs)
          const k = all[Math.floor(Math.random() * all.length)]
          attrs[k] = Math.min(99, (attrs[k] || 50) + 1)
        }
        if (ovr >= 80) {
          const k = ['reactions', 'composure', 'positioning'][Math.floor(Math.random() * 3)]
          attrs[k] = Math.min(99, (attrs[k] || 50) + 1)
        }
      }
      if (age >= 29 && Math.random() < (age - 28) * 0.006 * multiplier) {
        ovr = Math.max(40, ovr - 1)
        for (const k of ['pace', 'acceleration', 'sprint_speed']) attrs[k] = Math.max(35, (attrs[k] || 60) - (age >= 32 ? 2 : 1))
      }
      if ((p.training_focus || '').startsWith('Position:') && Math.random() < 0.04 * multiplier) {
        const target = p.training_focus.split(':')[1]
        const valid = ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'CF', 'ST']
        if (valid.includes(target) && target !== (p.position || '')) {
          position = target
          alt = p.position
        }
      }
      if (p.training_intensity === 'Intense' && Math.random() < 0.006 * multiplier) {
        const days = 7 + Math.floor(Math.random() * 21)
        const d = new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10)
        if (position) upd.run(ovr, JSON.stringify(attrs), position, alt, d, 'Training injury', saveId, p.id)
        else updInjury.run(ovr, JSON.stringify(attrs), d, 'Training injury', saveId, p.id)
        continue
      }
      if (position) {
        updPos.run(ovr, JSON.stringify(attrs), position, alt, saveId, p.id)
      } else if (ovr !== p.ovr) {
        updPlain.run(ovr, JSON.stringify(attrs), saveId, p.id)
      }
    }
  })
  tx()
}

function processWeekly(saveId, date, save) {
  const clubs = db.prepare('SELECT * FROM clubs WHERE save_id=?').all(saveId)
  const wages = db.prepare('SELECT club_id, SUM(wage) as total FROM players WHERE save_id=? AND club_id IS NOT NULL GROUP BY club_id').all(saveId)
  const wageMap = new Map(wages.map((w) => [w.club_id, w.total]))
  const upd = db.prepare('UPDATE clubs SET balance = balance + ? WHERE save_id=? AND id=?')
  const tx = db.transaction(() => {
    for (const c of clubs) {
      const wageBill = wageMap.get(c.id) || 0
      const sponsor = Math.round(Math.pow(c.reputation, 2) * 60000 * (c.tier === 1 ? 1 : 0.32))
      upd.run(sponsor - wageBill, saveId, c.id)
    }
  })
  tx()
  const user = clubs.find((c) => c.id === save.club_id)
  if (user && user.balance < 0) {
    db.prepare('UPDATE clubs SET board_confidence=MAX(5, board_confidence-2) WHERE save_id=? AND id=?').run(saveId, user.id)
    const existing = db.prepare("SELECT id FROM news WHERE save_id=? AND type='finance' AND date=?").get(saveId, date)
    if (!existing) addNews(saveId, { date, type: 'finance', clubId: user.id, title: 'Financial warning', body: 'The club is operating at a loss. The board expects the wage bill to be brought under control.' })
  }
  developPlayers(saveId, date, 1)
  if (isWindowOpen(date)) {
    const deals = aiTransferTick(saveId, 14)
    generateIncomingOffers(saveId)
    if (deals > 0 && Math.random() < 0.35) {
      addNews(saveId, { date, type: 'transfer', clubId: null, title: 'Transfer activity across Europe', body: `${deals} deals were completed today as clubs strengthen their squads.` })
    }
  }
}

function processDaily(saveId, date, save) {
  db.prepare('UPDATE players SET injured_until=NULL, injury_type=NULL WHERE save_id=? AND injured_until IS NOT NULL AND injured_until<=?').run(saveId, date)
  db.prepare(`UPDATE players SET fitness=MIN(100, fitness + CASE training_intensity WHEN 'Intense' THEN 4 WHEN 'Light' THEN 7 ELSE 6 END) WHERE save_id=? AND club_id IS NOT NULL`).run(saveId)
  db.prepare(`UPDATE players SET morale = morale + CASE WHEN morale<68 THEN 1 WHEN morale>84 THEN -1 ELSE 0 END WHERE save_id=? AND club_id IS NOT NULL`).run(saveId)
  if (DOW(date) === 1) processWeekly(saveId, date, save)
  if (dayNum(date) === 1) {
    const clubs = db.prepare('SELECT * FROM clubs WHERE save_id=?').all(saveId)
    const tx = db.transaction(() => {
      for (const c of clubs) {
        const income = Math.round(Math.pow(c.reputation, 2) * 90000 * (c.tier === 1 ? 1 : 0.3))
        db.prepare('UPDATE clubs SET balance = balance + ? WHERE save_id=? AND id=?').run(income, saveId, c.id)
        db.prepare('INSERT INTO finances (save_id,club_id,date,season,type,description,amount) VALUES (?,?,?,?,?,?,?)')
          .run(saveId, c.id, date, save.season, 'Commercial', 'Monthly commercial income', income)
      }
    })
    tx()
  }
  if (date === `${save.season + 1}-03-01`) {
    const existing = db.prepare("SELECT id FROM news WHERE save_id=? AND type='youth' AND date=?").get(saveId, date)
    if (!existing) youthIntake(saveId, save.season, date)
  }
  const windowOpen = date === `${save.season}-07-01` || date === `${save.season + 1}-01-01`
  if (windowOpen) {
    aiTransferTick(saveId, 90)
    addNews(saveId, { date, type: 'transfer', clubId: save.club_id, title: 'Transfer window open', body: 'The transfer window is now open. Clubs across Europe are ready to do business.' })
  }
  if (date === `${save.season + 1}-01-01`) {
    const expiring = db.prepare('SELECT name, contract_end FROM players WHERE save_id=? AND club_id=? AND is_youth=0 AND contract_end<=? ORDER BY ovr DESC').all(saveId, save.club_id, save.season + 1)
    if (expiring.length) {
      addNews(saveId, { date, type: 'contract', clubId: save.club_id, title: `${expiring.length} contracts expiring`, body: `${expiring.slice(0, 5).map((p) => p.name).join(', ')}${expiring.length > 5 ? ' and others' : ''} will be out of contract at the end of the season. Open contract talks from the squad page.` })
    }
  }
  if (date === `${save.season}-09-01` || date === `${save.season + 1}-01-31`) {
    addNews(saveId, { date, type: 'transfer', clubId: save.club_id, title: 'Transfer window closes', body: 'The transfer window has closed until the next registration period.' })
  }
}

export function advance(saveId, { mode = 'next-match', days = 1 } = {}) {
  const save = getSave(saveId)
  if (!save) throw new Error('Save not found')
  let date = save.date
  let steps = 0
  const limit = mode === 'day' ? 1 : mode === 'days' ? Math.max(1, days) : 420
  const starting = date
  while (steps < limit) {
    if (date >= save.season_end) {
      const r = rolloverSeason(saveId)
      return { date: r.date, season: r.season, rolledOver: true, days: steps, pending: null }
    }
    const res = processDate(saveId, date, save)
    if (res.pending) {
      setDate(saveId, date)
      return { date, season: save.season, pending: fixtureInfo(saveId, res.pending), days: steps, matchday: true }
    }
    processDaily(saveId, date, save)
    if (mode === 'day') {
      const next = addDays(date, 1)
      setDate(saveId, next)
      const pending = db.prepare('SELECT * FROM fixtures WHERE save_id=? AND date=? AND played=0 AND (home_id=? OR away_id=?)').get(saveId, next, save.club_id, save.club_id)
      return { date: next, season: save.season, days: 1, pending: pending ? fixtureInfo(saveId, pending) : null }
    }
    date = addDays(date, 1)
    steps++
    setDate(saveId, date)
  }
  const pending = db.prepare('SELECT * FROM fixtures WHERE save_id=? AND date=? AND played=0 AND (home_id=? OR away_id=?)').get(saveId, date, save.club_id, save.club_id)
  return { date, season: save.season, days: steps, pending: pending ? fixtureInfo(saveId, pending) : null }
}

export function simulateUserFixture(saveId, fixtureId) {
  const f = getFixture(saveId, fixtureId)
  if (!f || f.played) return { ok: false }
  simulateFixture(saveId, f, { persist: true })
  return { ok: true }
}

function maintainSquads(saveId, season, date, userClubId) {
  const clubs = db.prepare('SELECT * FROM clubs WHERE save_id=?').all(saveId)
  const free = db.prepare('SELECT * FROM players WHERE save_id=? AND club_id IS NULL AND is_youth=0 ORDER BY ovr DESC').all(saveId)
  const used = new Set()
  const MIN = { GK: 2, DEF: 6, MID: 5, ATT: 3 }
  const upd = db.prepare('UPDATE players SET club_id=?, wage=?, contract_start=?, contract_end=?, squad_role=? WHERE save_id=? AND id=?')
  const addTransfer = db.prepare('INSERT INTO transfers (save_id,player_id,player_name,from_club,to_club,fee,wage,type,date,season) VALUES (?,?,?,NULL,?,0,?,?,?,?)')
  for (const c of clubs) {
    const isUser = c.id === userClubId
    const seniors = db.prepare('SELECT id, position FROM players WHERE save_id=? AND club_id=? AND is_youth=0').all(saveId, c.id)
    const groups = { GK: [], DEF: [], MID: [], ATT: [] }
    for (const p of seniors) (groups[POSITION_GROUP[p.position]] ||= []).push(p)
    let total = seniors.length
    let added = 0
    const sign = (p) => {
      used.add(p.id)
      upd.run(c.id, wageExpectation(p, c), date, season + 2, 'Squad Player', saveId, p.id)
      addTransfer.run(saveId, p.id, p.name, c.id, p.wage, 'free', date, season)
      total++
      added++
    }
    if (!isUser) {
      for (const g of ['GK', 'DEF', 'MID', 'ATT']) {
        let need = MIN[g] - groups[g].length
        while (need > 0) {
          const idx = free.findIndex((p) => !used.has(p.id) && POSITION_GROUP[p.position] === g)
          if (idx < 0) break
          sign(free[idx])
          need--
        }
      }
    }
    const floorTotal = isUser ? 15 : 19
    while (total < floorTotal) {
      const idx = free.findIndex((p) => !used.has(p.id))
      if (idx < 0) break
      sign(free[idx])
    }
    if (total < floorTotal) {
      const y = generateYouthPlayer(saveId, c, season, date)
      db.prepare('UPDATE players SET is_youth=0, squad_role=? WHERE save_id=? AND id=?').run('Prospect', saveId, y.id)
      total++
      added++
    }
    if (added > 0 && isUser) {
      addNews(saveId, { date, type: 'transfer', clubId: c.id, title: 'Board signs replacements', body: `The board has added ${added} players to the squad to ensure the club can field a competitive team.` })
    }
  }
}

function europeFromTables(tables) {
  const tier1 = LEAGUES.filter((l) => l.tier === 1).map((l) => l.id)
  const ucl = []
  const uel = []
  const uecl = []
  for (const lid of tier1) {
    const t = tables[lid] || []
    ucl.push(...t.slice(0, 3))
    uel.push(...t.slice(3, 6))
    uecl.push(...t.slice(6, 9))
  }
  const all = tier1.flatMap((lid) => (tables[lid] || []).map((r) => ({ ...r, league: lid })))
  const extraUcl = all.filter((r) => !ucl.find((x) => x.clubId === r.clubId)).sort((a, b) => b.pts - a.pts || b.gd - a.gd)[0]
  if (extraUcl) ucl.push(extraUcl)
  const extraUel = all.filter((r) => !ucl.find((x) => x.clubId === r.clubId) && !uel.find((x) => x.clubId === r.clubId)).sort((a, b) => b.pts - a.pts || b.gd - a.gd)[0]
  if (extraUel) uel.push(extraUel)
  const extraUecl = all.filter((r) => !ucl.find((x) => x.clubId === r.clubId) && !uel.find((x) => x.clubId === r.clubId) && !uecl.find((x) => x.clubId === r.clubId)).sort((a, b) => b.pts - a.pts || b.gd - a.gd)[0]
  if (extraUecl) uecl.push(extraUecl)
  return { ucl: ucl.slice(0, 16), uel: uel.slice(0, 16), uecl: uecl.slice(0, 16) }
}

function cupWinner(saveId, comp, season) {
  const f = db.prepare("SELECT * FROM fixtures WHERE save_id=? AND competition=? AND season=? AND round='F' AND played=1").get(saveId, comp, season)
  if (!f) return null
  return f.home_goals >= f.away_goals ? f.home_id : f.away_id
}

export function rolloverSeason(saveId) {
  const save = getSave(saveId)
  const season = save.season
  const date = save.season_end
  const leagueIds = [...new Set(db.prepare('SELECT league_id FROM clubs WHERE save_id=?').all(saveId).map((r) => r.league_id))]
  const tables = {}
  for (const lid of leagueIds) tables[lid] = getTable(saveId, lid, season)
  const finalPos = {}
  for (const lid of leagueIds) for (const r of tables[lid] || []) finalPos[r.clubId] = { position: r.position, pts: r.pts, league: lid, size: tables[lid].length }

  const insHist = db.prepare('INSERT INTO season_history (save_id,season,competition,winner_club_id,winner_name,user_club_id,user_position,user_points) VALUES (?,?,?,?,?,?,?,?)')
  const insTrophy = db.prepare('INSERT INTO trophies (save_id,club_id,competition,season) VALUES (?,?,?,?)')
  for (const lid of leagueIds) {
    const winner = tables[lid]?.[0]
    if (!winner) continue
    insHist.run(saveId, season, lid, winner.clubId, winner.name, save.club_id, finalPos[save.club_id]?.position || null, finalPos[save.club_id]?.pts || null)
    insTrophy.run(saveId, winner.clubId, lid, season)
  }
  for (const comp of [...Object.values(CUP_BY_COUNTRY), 'ucl', 'uel', 'uecl']) {
    const w = cupWinner(saveId, comp, season)
    if (!w) continue
    const club = getClubRow(saveId, w)
    insHist.run(saveId, season, comp, w, club?.name, save.club_id, finalPos[save.club_id]?.position || null, finalPos[save.club_id]?.pts || null)
    insTrophy.run(saveId, w, comp, season)
  }

  // promotion and relegation
  const userRelegated = []
  const userPromoted = []
  for (const [t1, t2] of Object.entries(PAIR_TIER2)) {
    const tt1 = tables[t1] || []
    const tt2 = tables[t2] || []
    if (tt1.length < 4 || tt2.length < 4) continue
    const n = tt1.length >= 20 ? 3 : 2
    const relegated = tt1.slice(-n)
    const promoted = tt2.slice(0, n)
    for (const r of relegated) {
      db.prepare('UPDATE clubs SET league_id=?, tier=2 WHERE save_id=? AND id=?').run(t2, saveId, r.clubId)
      if (r.clubId === save.club_id) userRelegated.push(COMPETITION_NAMES[t1])
    }
    for (const p of promoted) {
      db.prepare('UPDATE clubs SET league_id=?, tier=1 WHERE save_id=? AND id=?').run(t1, saveId, p.clubId)
      if (p.clubId === save.club_id) userPromoted.push(COMPETITION_NAMES[t1])
    }
  }

  // renewals for AI clubs, then expire contracts
  aiRenewals(saveId, season, date)
  db.prepare(`UPDATE players SET club_id=NULL, squad_role='Free Agent', contract_end=? WHERE save_id=? AND contract_end<=? AND is_youth=0 AND club_id IS NOT NULL AND club_id!=?`)
    .run(season + 1, saveId, season + 1, save.club_id)

  db.prepare('UPDATE players SET age=age+1 WHERE save_id=?').run(saveId)

  // AI youth graduation
  const youth = db.prepare('SELECT p.*, c.reputation, c.id as cid FROM players p JOIN clubs c ON c.save_id=p.save_id AND c.id=p.club_id WHERE p.save_id=? AND p.is_youth=1').all(saveId)
  for (const p of youth) {
    if (p.club_id === save.club_id) continue
    if (p.age >= 19) {
      if (p.ovr >= 56 + p.reputation * 2.6) db.prepare('UPDATE players SET is_youth=0, squad_role=? WHERE save_id=? AND id=?').run('Prospect', saveId, p.id)
      else db.prepare('UPDATE players SET club_id=NULL, is_youth=0, squad_role=? WHERE save_id=? AND id=?').run('Free Agent', saveId, p.id)
    }
  }

  maintainSquads(saveId, season, date, save.club_id)
  developPlayers(saveId, date, 6)

  // values
  const allPlayers = db.prepare('SELECT id,ovr,age,pot,contract_end FROM players WHERE save_id=?').all(saveId)
  const updVal = db.prepare('UPDATE players SET value=? WHERE save_id=? AND id=?')
  const tv = db.transaction(() => {
    for (const p of allPlayers) {
      updVal.run(marketValue(p.ovr, p.age, p.pot, Math.max(0, (p.contract_end || season + 1) - (season + 1))), saveId, p.id)
    }
  })
  tv()

  // season snapshots for player development history
  const snapshot = db.prepare('INSERT OR REPLACE INTO player_history (save_id,player_id,season,ovr,pot,club_id,value) VALUES (?,?,?,?,?,?,?)')
  const snapTx = db.transaction(() => {
    for (const p of db.prepare('SELECT id,ovr,pot,club_id,value FROM players WHERE save_id=?').all(saveId)) {
      snapshot.run(saveId, p.id, season, p.ovr, p.pot, p.club_id, p.value)
    }
  })
  snapTx()

  // prize money and budgets
  const clubs = db.prepare('SELECT * FROM clubs WHERE save_id=?').all(saveId)
  const updBudget = db.prepare('UPDATE clubs SET balance=?, transfer_budget=?, wage_budget=?, board_confidence=?, objective=? WHERE save_id=? AND id=?')
  const txb = db.transaction(() => {
    for (const c of clubs) {
      const fp = finalPos[c.id]
      const pos = fp?.position || 10
      const size = fp?.size || 20
      const tier1 = fp?.league ? !PAIR_TIER2[fp.league] === false : c.tier === 1
      const isTop = fp?.league ? Object.keys(PAIR_TIER2).includes(fp.league) : c.tier === 1
      const prize = Math.round((size - pos + 1) * (isTop ? 1.4e6 + c.reputation * 0.35e6 : 0.18e6 + c.reputation * 0.04e6))
      const balance = c.balance + prize
      const budget = Math.max(isTop ? 4e6 : 1e6, Math.round(balance * 0.4))
      const wageBill = db.prepare('SELECT SUM(wage) as t FROM players WHERE save_id=? AND club_id=?').get(saveId, c.id).t || 0
      const leagueClubs = clubs.filter((x) => x.league_id === c.league_id).sort((a, b) => b.reputation - a.reputation)
      const idx = leagueClubs.findIndex((x) => x.id === c.id)
      const obj = idx <= 1 ? 'Win the league title' : idx <= 3 ? 'Qualify for the Champions League' : idx <= Math.floor(leagueClubs.length * 0.5) ? 'Finish in the top half' : idx >= leagueClubs.length - 4 ? 'Avoid relegation' : 'Finish in the top ten'
      updBudget.run(balance, budget, Math.round(wageBill * 1.35), clamp(c.board_confidence, 20, 90), obj, saveId, c.id)
      db.prepare('INSERT INTO finances (save_id,club_id,date,season,type,description,amount) VALUES (?,?,?,?,?,?,?)')
        .run(saveId, c.id, date, season, 'Prize Money', 'End of season prize money', prize)
    }
  })
  txb()

  // reset condition
  db.prepare('UPDATE players SET fitness=100, morale=75, form=0, injured_until=NULL, injury_type=NULL, suspension=0 WHERE save_id=?').run(saveId)

  const newSeason = season + 1
  const window = seasonWindow(newSeason)
  const preSeason = `${newSeason}-07-01`
  const entrants = europeFromTables(tables)
  const freshClubs = db.prepare('SELECT * FROM clubs WHERE save_id=?').all(saveId)
  generateSeasonFixtures(db, saveId, newSeason, newSeason, freshClubs, {
    europe: { ucl: entrants.ucl.map((r) => r.clubId), uel: entrants.uel.map((r) => r.clubId), uecl: entrants.uecl.map((r) => r.clubId) },
  })

  // fresh lineups
  db.prepare('DELETE FROM lineups WHERE save_id=?').run(saveId)
  const insLine = db.prepare('INSERT INTO lineups (save_id,club_id,player_id,slot) VALUES (?,?,?,?)')
  const tl = db.transaction(() => {
    for (const c of freshClubs) {
      const squad = db.prepare('SELECT id,position,ovr,fitness,morale,form FROM players WHERE save_id=? AND club_id=? AND is_youth=0').all(saveId, c.id)
      const t = getTactics(saveId, c.id)
      const lu = autoLineup(squad, t.formation)
      lu.starters.forEach((s) => insLine.run(saveId, c.id, s.playerId, s.slot))
      lu.bench.forEach((pid, i) => insLine.run(saveId, c.id, pid, 20 + i))
    }
  })
  tl()

  db.prepare('UPDATE saves SET season=?, date=?, season_start=?, season_end=?, updated_at=? WHERE id=?')
    .run(newSeason, preSeason, window.start, window.seasonEnd, new Date().toISOString(), saveId)

  const user = getClubRow(saveId, save.club_id)
  addNews(saveId, {
    date: preSeason, type: 'season', clubId: save.club_id,
    title: `Season ${newSeason}/${String(newSeason + 1).slice(2)} begins`,
    body: `Pre-season is under way. ${user?.name} will compete in the ${COMPETITION_NAMES[user?.league_id] || 'league'} this season.`,
  })
  if (userRelegated.length) addNews(saveId, { date: preSeason, type: 'board', clubId: save.club_id, title: 'Relegated', body: `${user?.name} were relegated from the ${userRelegated[0]}. The board expects an immediate promotion challenge.` })
  if (userPromoted.length) addNews(saveId, { date: preSeason, type: 'board', clubId: save.club_id, title: 'Promoted', body: `${user?.name} have been promoted to the ${userPromoted[0]}.` })

  return { season: newSeason, date: preSeason }
}
