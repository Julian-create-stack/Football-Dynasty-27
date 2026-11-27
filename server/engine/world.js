import crypto from 'node:crypto'
import { db, nowIso } from '../db.js'
import { SEED, SEED_CLUBS, LEAGUES, clubById, leagueById } from './data.js'
import { autoLineup, fillSlots, FORMATIONS, SQUAD_ROLES, formationSlots, effectiveRating, positionPenalty, availablePlayers } from './positions.js'
import { generateSeasonFixtures, seasonWindow } from './fixtures.js'

const SEASON = 2026

export function playerOut(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    first: row.first,
    last: row.last,
    nationality: row.nationality,
    position: row.position,
    alt: row.alt || '',
    age: row.age,
    ovr: row.ovr,
    pot: row.pot,
    clubId: row.club_id,
    clubName: row.club_name || clubById[row.club_id]?.name || null,
    wage: row.wage,
    value: row.value,
    contractStart: row.contract_start,
    contractEnd: row.contract_end,
    foot: row.foot,
    height: row.height,
    weight: row.weight,
    playstyles: row.playstyles ? row.playstyles.split(',').map((s) => s.trim()).filter(Boolean) : [],
    attrs: row.attrs ? JSON.parse(row.attrs) : {},
    morale: row.morale,
    fitness: row.fitness,
    form: row.form,
    squadNumber: row.squad_number,
    squadRole: row.squad_role,
    releaseClause: row.release_clause,
    isYouth: !!row.is_youth,
    trainingFocus: row.training_focus,
    injuredUntil: row.injured_until,
    injuryType: row.injury_type,
    suspension: row.suspension || 0,
    loanFrom: row.loan_from,
    transferListed: !!row.transfer_listed,
    generated: !!row.generated,
  }
}

export function clubOut(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    short: row.short,
    stadium: row.stadium,
    capacity: row.capacity,
    color1: row.color1,
    color2: row.color2,
    reputation: row.reputation,
    founded: row.founded,
    leagueId: row.league_id,
    leagueName: leagueById[row.league_id]?.name || row.league_id,
    country: row.country,
    tier: row.tier,
    balance: row.balance,
    transferBudget: row.transfer_budget,
    wageBudget: row.wage_budget,
    boardConfidence: row.board_confidence,
    facilities: row.facilities,
    youthFacilities: row.youth_facilities,
    trainingFacilities: row.training_facilities,
    scouting: row.scouting,
    objective: row.objective,
  }
}

export function getSave(saveId) {
  return db.prepare('SELECT * FROM saves WHERE id=?').get(saveId)
}
export function getClubRow(saveId, clubId) {
  return db.prepare('SELECT * FROM clubs WHERE save_id=? AND id=?').get(saveId, clubId)
}
export function getClub(saveId, clubId) {
  return clubOut(getClubRow(saveId, clubId))
}
export function getPlayerRow(saveId, playerId) {
  return db.prepare(`SELECT p.*, c.name as club_name FROM players p LEFT JOIN clubs c ON c.save_id=p.save_id AND c.id=p.club_id
    WHERE p.save_id=? AND p.id=?`).get(saveId, playerId)
}
export function getPlayer(saveId, playerId) {
  return playerOut(getPlayerRow(saveId, playerId))
}

export function getSquadRows(saveId, clubId, { youth = false } = {}) {
  return db.prepare(`SELECT * FROM players WHERE save_id=? AND club_id=? AND is_youth=? ORDER BY ovr DESC`)
    .all(saveId, clubId, youth ? 1 : 0)
}
export function getSquad(saveId, clubId, opts) {
  return getSquadRows(saveId, clubId, opts).map(playerOut)
}

function budgetFor(rep, tier) {
  const base = { 10: 240e6, 9: 150e6, 8: 85e6, 7: 48e6, 6: 26e6, 5: 14e6, 4: 7e6, 3: 3.5e6 }[rep] || 4e6
  return Math.round(base * (tier === 2 ? 0.16 : 1))
}

function objectiveFor(club, leagueClubs) {
  const sorted = [...leagueClubs].sort((a, b) => b.reputation - a.reputation)
  const idx = sorted.findIndex((c) => c.id === club.id)
  const n = sorted.length
  if (idx === 0 || idx === 1) return 'Win the league title'
  if (idx <= 3) return 'Qualify for the Champions League'
  if (idx <= Math.floor(n * 0.5)) return 'Finish in the top half'
  if (idx >= n - 4) return 'Avoid relegation'
  return 'Finish in the top ten'
}

export function initialEuropeEntrants(clubs) {
  const tiers = clubs.filter((c) => c.tier === 1)
  const per = {}
  for (const c of tiers) (per[c.leagueId] ||= []).push(c)
  for (const k of Object.keys(per)) per[k].sort((a, b) => b.reputation - a.reputation)
  const ucl = []
  const uel = []
  const uecl = []
  for (const k of Object.keys(per)) {
    ucl.push(...per[k].slice(0, 3))
    uel.push(...per[k].slice(3, 6))
    uecl.push(...per[k].slice(6, 9))
  }
  const extra = tiers.sort((a, b) => b.reputation - a.reputation)
  for (const c of extra) {
    if (ucl.length < 16 && !ucl.find((x) => x.id === c.id)) ucl.push(c)
  }
  for (const c of extra) {
    if (uel.length < 16 && !uel.find((x) => x.id === c.id) && !ucl.find((x) => x.id === c.id)) uel.push(c)
  }
  for (const c of extra) {
    if (uecl.length < 16 && ![...uel, ...ucl].find((x) => x.id === c.id) && !uecl.find((x) => x.id === c.id)) uecl.push(c)
  }
  return { ucl: ucl.slice(0, 16), uel: uel.slice(0, 16), uecl: uecl.slice(0, 16) }
}

const SAVE_TABLES = ['clubs', 'players', 'stats', 'fixtures', 'live_matches', 'transfers', 'news', 'shortlist', 'scout_reports', 'tactics', 'lineups', 'finances', 'season_history', 'trophies', 'negotiations', 'offers', 'injury_history', 'player_history']

export function deleteSaveData(saveId) {
  const tx = db.transaction(() => {
    for (const t of SAVE_TABLES) {
      try { db.prepare(`DELETE FROM ${t} WHERE save_id=?`).run(saveId) } catch {}
    }
    db.prepare('DELETE FROM saves WHERE id=?').run(saveId)
  })
  tx()
}

export function createSave({ userId, clubId, managerName, slot = 1, name }) {
  const seedClub = SEED_CLUBS.find((c) => c.id === clubId)
  if (!seedClub) throw new Error('Unknown club')
  const id = crypto.randomUUID()
  const window = seasonWindow(SEASON)
  const preSeason = `${SEASON}-07-01`
  const now = nowIso()
  const existing = db.prepare('SELECT id FROM saves WHERE user_id=? AND slot=?').get(userId, slot)
  if (existing) deleteSaveData(existing.id)

  db.prepare(`INSERT INTO saves (id,user_id,slot,name,manager_name,club_id,season,date,created_at,updated_at,season_start,season_end)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, userId, slot, name || `${seedClub.short} Career`, managerName, clubId, SEASON, preSeason, now, now, window.start, window.seasonEnd)

  const clubRows = []
  for (const c of SEED_CLUBS) {
    const tb = budgetFor(c.reputation, c.tier)
    const fac = Math.max(3, Math.min(10, c.reputation - 2))
    clubRows.push({
      ...c,
      league_id: c.leagueId,
      transfer_budget: Math.round(tb * (0.85 + Math.random() * 0.3)),
      balance: Math.round(tb * 1.5 + 20e6),
      board_confidence: 70,
      facilities: fac,
      training_facilities: Math.max(3, Math.min(10, fac + (Math.random() < 0.3 ? 1 : 0))),
      youth_facilities: Math.max(3, Math.min(10, fac - (Math.random() < 0.3 ? 1 : 0))),
      scouting: Math.max(3, Math.min(10, fac)),
    })
  }

  const insClub = db.prepare(`INSERT INTO clubs (save_id,id,name,short,stadium,capacity,color1,color2,reputation,founded,league_id,country,tier,balance,transfer_budget,wage_budget,board_confidence,facilities,youth_facilities,training_facilities,scouting,objective)
    VALUES (@save_id,@id,@name,@short,@stadium,@capacity,@color1,@color2,@reputation,@founded,@league_id,@country,@tier,@balance,@transfer_budget,0,@board_confidence,@facilities,@youth_facilities,@training_facilities,@scouting,@objective)`)
  const insPlayer = db.prepare(`INSERT INTO players (save_id,id,name,first,last,nationality,position,alt,age,ovr,pot,club_id,wage,value,contract_start,contract_end,foot,height,weight,playstyles,attrs,morale,fitness,form,squad_number,squad_role,release_clause,is_youth,training_focus,generated)
    VALUES (@save_id,@id,@name,@first,@last,@nationality,@position,@alt,@age,@ovr,@pot,@club_id,@wage,@value,@contract_start,@contract_end,@foot,@height,@weight,@playstyles,@attrs,75,100,0,@squad_number,@squad_role,@release_clause,0,@training_focus,@generated)`)
  const insTactic = db.prepare(`INSERT INTO tactics (save_id,club_id,formation,mentality,pressing,def_line,buildup,chance_creation,width,tempo,set_pieces,instructions)
    VALUES (?,?,?,3,3,3,'Balanced','Balanced',3,3,?, '{}')`)
  const insLine = db.prepare('INSERT INTO lineups (save_id,club_id,player_id,slot) VALUES (?,?,?,?)')
  const insFin = db.prepare('INSERT INTO finances (save_id,club_id,date,season,type,description,amount) VALUES (?,?,?,?,?,?,?)')

  const seedByClub = {}
  for (const p of SEED.players) (seedByClub[p.clubId] ||= []).push(p)

  const tx = db.transaction(() => {
    const leagueClubs = {}
    for (const c of clubRows) (leagueClubs[c.leagueId] ||= []).push(c)
    for (const c of clubRows) {
      const obj = objectiveFor(c, leagueClubs[c.leagueId] || [])
      insClub.run({
        save_id: id, id: c.id, name: c.name, short: c.short, stadium: c.stadium, capacity: c.capacity,
        color1: c.color1, color2: c.color2, reputation: c.reputation, founded: c.founded,
        league_id: c.leagueId, country: c.country, tier: c.tier,
        balance: c.balance, transfer_budget: c.transfer_budget, board_confidence: c.board_confidence,
        facilities: c.facilities, youth_facilities: c.youth_facilities, training_facilities: c.training_facilities,
        scouting: c.scouting, objective: obj,
      })
      insTactic.run(id, c.id, c.reputation >= 8 ? '4-3-3' : c.reputation >= 6 ? '4-2-3-1' : '4-4-2', '{}')
    }
    for (const [clubIdKey, list] of Object.entries(seedByClub)) {
      const sorted = [...list].sort((a, b) => b.ovr - a.ovr)
      const squadWage = list.reduce((s, p) => s + p.wage, 0)
      db.prepare('UPDATE clubs SET wage_budget=? WHERE save_id=? AND id=?').run(Math.round(squadWage * 1.35), id, clubIdKey)
      sorted.forEach((p, idx) => {
        const role = idx < 2 ? 'Star Player' : idx < 5 ? 'Important Player' : idx < 11 ? 'First Team' : idx < 18 ? 'Rotation' : idx < 24 ? 'Squad Player' : 'Prospect'
        const release = Math.random() < 0.14 ? Math.round(p.value * (1.6 + Math.random() * 0.8)) : null
        insPlayer.run({
          save_id: id, id: p.id, name: p.name, first: p.first, last: p.last, nationality: p.nationality,
          position: p.position, alt: p.alt, age: p.age, ovr: p.ovr, pot: p.pot, club_id: p.clubId,
          wage: p.wage, value: p.value, contract_start: '2026-07-01', contract_end: p.contractEnd,
          foot: p.foot, height: p.height, weight: p.weight, playstyles: p.playstyles,
          attrs: JSON.stringify(p.attrs), squad_number: p.squadNumber, squad_role: role,
          release_clause: release, training_focus: p.age <= 23 ? 'Balanced' : 'Balanced',
          generated: p.generated || 0,
        })
      })
    }
    // initial lineups for every club
    for (const c of clubRows) {
      const squad = (seedByClub[c.id] || []).map((p) => ({ id: p.id, position: p.position, ovr: p.ovr, fitness: 100, morale: 75, form: 0 }))
      const lu = autoLineup(squad, c.reputation >= 8 ? '4-3-3' : c.reputation >= 6 ? '4-2-3-1' : '4-4-2')
      lu.starters.forEach((s) => insLine.run(id, c.id, s.playerId, s.slot))
      lu.bench.forEach((pid, i) => insLine.run(id, c.id, pid, 20 + i))
    }
    insFin.run(id, clubId, preSeason, SEASON, 'Balance', 'Opening club balance', clubRows.find((c) => c.id === clubId).balance)
  })
  tx()

  const entrants = initialEuropeEntrants(clubRows)
  generateSeasonFixtures(db, id, SEASON, SEASON, clubRows, {
    europe: {
      ucl: entrants.ucl.map((c) => c.id),
      uel: entrants.uel.map((c) => c.id),
      uecl: entrants.uecl.map((c) => c.id),
    },
  })

  addNews(id, {
    date: preSeason, type: 'club', clubId,
    title: `${managerName} appointed at ${seedClub.name}`,
    body: `The board has confirmed ${managerName} as the new manager. The objective for the season is: ${objectiveFor(seedClub, clubRows.filter((c) => c.leagueId === seedClub.leagueId))}.`,
  })
  addNews(id, {
    date: preSeason, type: 'world', clubId: null,
    title: 'The 2026/27 season begins',
    body: 'Pre-season is under way across Europe. The transfer window is open until 1 September.',
  })
  return id
}

export function addNews(saveId, { date, type = 'general', title, body, clubId = null }) {
  db.prepare('INSERT INTO news (save_id,date,type,title,body,club_id) VALUES (?,?,?,?,?,?)')
    .run(saveId, date, type, title, body, clubId)
}

export function getNews(saveId, clubId, limit = 20) {
  return db.prepare(`SELECT * FROM news WHERE save_id=? AND (club_id IS NULL OR club_id=?) ORDER BY id DESC LIMIT ?`)
    .all(saveId, clubId, limit)
}

export function getTactics(saveId, clubId) {
  let row = db.prepare('SELECT * FROM tactics WHERE save_id=? AND club_id=?').get(saveId, clubId)
  if (!row) {
    db.prepare(`INSERT INTO tactics (save_id,club_id,formation,mentality,pressing,def_line,buildup,chance_creation,width,tempo,set_pieces,instructions)
      VALUES (?,?,'4-3-3',3,3,3,'Balanced','Balanced',3,3,'{}','{}')`).run(saveId, clubId)
    row = db.prepare('SELECT * FROM tactics WHERE save_id=? AND club_id=?').get(saveId, clubId)
  }
  return {
    formation: row.formation, mentality: row.mentality, pressing: row.pressing, defLine: row.def_line,
    buildup: row.buildup, chanceCreation: row.chance_creation, width: row.width, tempo: row.tempo,
    setPieces: safeJson(row.set_pieces), instructions: safeJson(row.instructions),
  }
}

function safeJson(s) {
  try { return JSON.parse(s || '{}') } catch { return {} }
}

export function saveTactics(saveId, clubId, t) {
  db.prepare(`UPDATE tactics SET formation=?, mentality=?, pressing=?, def_line=?, buildup=?, chance_creation=?, width=?, tempo=?, set_pieces=?, instructions=?
    WHERE save_id=? AND club_id=?`).run(
    t.formation, t.mentality, t.pressing, t.defLine, t.buildup, t.chanceCreation, t.width, t.tempo,
    JSON.stringify(t.setPieces || {}), JSON.stringify(t.instructions || {}), saveId, clubId
  )
}

export function getLineup(saveId, clubId) {
  const rows = db.prepare('SELECT player_id, slot FROM lineups WHERE save_id=? AND club_id=? ORDER BY slot').all(saveId, clubId)
  return {
    starters: rows.filter((r) => r.slot < 20).map((r) => ({ playerId: r.player_id, slot: r.slot })),
    bench: rows.filter((r) => r.slot >= 20).map((r) => r.player_id),
  }
}

export function saveLineup(saveId, clubId, starters, bench) {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM lineups WHERE save_id=? AND club_id=?').run(saveId, clubId)
    const ins = db.prepare('INSERT INTO lineups (save_id,club_id,player_id,slot) VALUES (?,?,?,?)')
    starters.forEach((s) => ins.run(saveId, clubId, s.playerId, s.slot))
    bench.forEach((pid, i) => ins.run(saveId, clubId, pid, 20 + i))
  })
  tx()
}

export function repairLineup(saveId, clubId) {
  const squad = getSquad(saveId, clubId)
  const tactics = getTactics(saveId, clubId)
  const slots = formationSlots(tactics.formation).map((slot, index) => ({ ...slot, index }))
  const map = new Map(squad.map((p) => [p.id, p]))
  const avail = availablePlayers(squad)
  if (avail.length < 11) return getLineup(saveId, clubId)
  const lineup = getLineup(saveId, clubId)
  const used = new Set()
  const starters = []
  for (let i = 0; i < slots.length; i++) {
    const current = lineup.starters.find((s) => s.slot === i)
    const p = current ? map.get(current.playerId) : null
    if (p && avail.includes(p) && !used.has(p.id)) {
      starters.push({ playerId: p.id, slot: i })
      used.add(p.id)
    }
  }
  const missing = slots.filter((s) => !starters.some((x) => x.slot === s.index))
  const filled = fillSlots(avail, missing, used)
  for (const f of filled) { starters.push(f); used.add(f.playerId) }
  starters.sort((a, b) => a.slot - b.slot)
  const bench = lineup.bench.filter((pid) => {
    const p = map.get(pid)
    return p && avail.includes(p) && !used.has(p.id)
  })
  for (const p of [...avail].sort((a, b) => b.ovr - a.ovr)) {
    if (bench.length >= 9) break
    if (used.has(p.id) || bench.includes(p.id)) continue
    bench.push(p.id)
  }
  saveLineup(saveId, clubId, starters, bench)
  return { starters, bench }
}

export function ensureLineup(saveId, clubId) {
  const squad = getSquad(saveId, clubId)
  const lineup = getLineup(saveId, clubId)
  if (lineup.starters.length !== 11) return repairLineup(saveId, clubId)
  const map = new Map(squad.map((p) => [p.id, p]))
  const invalid = lineup.starters.some((s) => {
    const p = map.get(s.playerId)
    return !p || p.injuredUntil || p.suspension > 0
  })
  if (invalid) return repairLineup(saveId, clubId)
  return lineup
}

export function getTable(saveId, competition, season) {
  const clubs = db.prepare('SELECT * FROM clubs WHERE save_id=? AND league_id=?').all(saveId, competition)
  const rows = db.prepare(`SELECT home_id, away_id, home_goals, away_goals FROM fixtures WHERE save_id=? AND competition=? AND season=? AND played=1`)
    .all(saveId, competition, season)
  const table = new Map()
  for (const c of clubs) table.set(c.id, { clubId: c.id, name: c.name, short: c.short, color1: c.color1, color2: c.color2, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] })
  for (const f of rows) {
    const h = table.get(f.home_id)
    const a = table.get(f.away_id)
    if (!h || !a) continue
    h.p++; a.p++
    h.gf += f.home_goals; h.ga += f.away_goals
    a.gf += f.away_goals; a.ga += f.home_goals
    if (f.home_goals > f.away_goals) { h.w++; h.pts += 3; a.l++; h.form.push('W'); a.form.push('L') }
    else if (f.home_goals < f.away_goals) { a.w++; a.pts += 3; h.l++; a.form.push('W'); h.form.push('L') }
    else { h.d++; a.d++; h.pts++; a.pts++; h.form.push('D'); a.form.push('D') }
  }
  return [...table.values()]
    .map((r) => ({ ...r, gd: r.gf - r.ga, form: r.form.slice(-5) }))
    .sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.name.localeCompare(y.name))
    .map((r, i) => ({ ...r, position: i + 1 }))
}

export function getClubFixtures(saveId, clubId, { season, limit = 20, played, from } = {}) {
  let sql = `SELECT f.*, h.name as home_name, h.short as home_short, h.color1 as home_color, h.color2 as home_color2,
    a.name as away_name, a.short as away_short, a.color1 as away_color, a.color2 as away_color2
    FROM fixtures f JOIN clubs h ON h.save_id=f.save_id AND h.id=f.home_id JOIN clubs a ON a.save_id=f.save_id AND a.id=f.away_id
    WHERE f.save_id=? AND (f.home_id=? OR f.away_id=?)`
  const params = [saveId, clubId, clubId]
  if (season) { sql += ' AND f.season=?'; params.push(season) }
  if (played === 1) sql += ' AND f.played=1'
  if (played === 0) sql += ' AND f.played=0'
  if (from) { sql += ' AND f.date>=?'; params.push(from) }
  sql += ' ORDER BY f.date ASC, f.id ASC'
  if (limit) { sql += ' LIMIT ?'; params.push(limit) }
  return db.prepare(sql).all(...params)
}

export function getFixture(saveId, fixtureId) {
  return db.prepare(`SELECT f.*, h.name as home_name, h.short as home_short, h.color1 as home_color, h.color2 as home_color2,
    a.name as away_name, a.short as away_short, a.color1 as away_color, a.color2 as away_color2
    FROM fixtures f JOIN clubs h ON h.save_id=f.save_id AND h.id=f.home_id JOIN clubs a ON a.save_id=f.save_id AND a.id=f.away_id
    WHERE f.save_id=? AND f.id=?`).get(saveId, fixtureId)
}

export function getPlayerStats(saveId, playerId, season) {
  return db.prepare('SELECT * FROM stats WHERE save_id=? AND player_id=? AND season=?').get(saveId, playerId, season) || null
}

export function seasonStats(saveId, season) {
  return db.prepare(`SELECT s.*, p.name, p.position, p.club_id, p.nationality FROM stats s JOIN players p ON p.save_id=s.save_id AND p.id=s.player_id
    WHERE s.save_id=? AND s.season=?`).all(saveId, season)
}

export function currentSeason(saveId) {
  return getSave(saveId)?.season ?? SEASON
}

export const DEFAULT_FORMATION = '4-3-3'
export { FORMATIONS, SQUAD_ROLES, SEASON }
