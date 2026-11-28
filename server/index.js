import express from 'express'
import http from 'node:http'
import crypto from 'node:crypto'
import { db, nowIso } from './db.js'
import {
  createSave, deleteSaveData, getSave, getClub, getClubRow, getSquad, getPlayer, getPlayerRow, getTable,
  getClubFixtures, getFixture, getNews, getTactics, saveTactics, getLineup, saveLineup,
  addNews, playerOut, clubOut, getPlayerStats, SEASON,
} from './engine/world.js'
import { advance, simulateUserFixture, nextUserFixture, rolloverSeason } from './engine/advance.js'
import { startLiveMatch, tickLiveMatch, publicState, makeSub, simulateFixture, tickMatch, applyResult } from './engine/sim.js'
import { evaluateTransferOffer, evaluateContractOffer, releasePlayer, promoteYouth, resolveOffer, marketValue, isWindowOpen, contractYearsLeft, generateIncomingOffers, wageExpectation } from './engine/transfers.js'
import { FORMATIONS, SQUAD_ROLES, formationSlots, POSITION_LABEL, POSITION_GROUP, autoLineup } from './engine/positions.js'
import { TOP_LEAGUES, SECOND_LEAGUES, SEED_CLUBS, LEAGUES, PAIR_TIER2 } from './engine/data.js'
import { COMPETITION_NAMES, CUP_BY_COUNTRY } from './engine/fixtures.js'

const app = express()
app.use(express.json({ limit: '2mb' }))

function parseCookies(header = '') {
  const out = {}
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim())
  }
  return out
}

app.use((req, res, next) => {
  const cookies = parseCookies(req.headers.cookie)
  let uid = cookies.ufm_uid
  if (!uid) {
    uid = crypto.randomUUID()
    res.setHeader('Set-Cookie', `ufm_uid=${uid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`)
  }
  req.userId = uid
  try { db.prepare('INSERT OR IGNORE INTO users (id, created_at) VALUES (?,?)').run(uid, nowIso()) } catch {}
  next()
})

const api = express.Router()

api.get('/health', (req, res) => {
  const players = db.prepare('SELECT COUNT(*) c FROM players').get().c
  res.json({ ok: true, players, time: nowIso() })
})

api.get('/bootstrap', (req, res) => {
  const saves = db.prepare('SELECT * FROM saves WHERE user_id=? ORDER BY slot').all(req.userId)
  res.json({
    leagues: TOP_LEAGUES.map((l) => ({
      ...l,
      clubs: SEED_CLUBS.filter((c) => c.leagueId === l.id)
        .sort((a, b) => b.reputation - a.reputation || a.name.localeCompare(b.name))
        .map((c) => ({ id: c.id, name: c.name, short: c.short, color1: c.color1, color2: c.color2, reputation: c.reputation, stadium: c.stadium, capacity: c.capacity, country: c.country })),
    })),
    saves: saves.map((s) => {
      const club = getClubRow(s.id, s.club_id)
      return { id: s.id, name: s.name, slot: s.slot, managerName: s.manager_name, season: s.season, date: s.date, club: club ? clubOut(club) : null }
    }),
    meta: { source: 'EA SPORTS FC 27 player dataset', players: db.prepare('SELECT COUNT(DISTINCT id) c FROM players').get().c, clubs: SEED_CLUBS.length, leagues: TOP_LEAGUES.length },
  })
})

api.get('/saves', (req, res) => {
  const saves = db.prepare('SELECT * FROM saves WHERE user_id=? ORDER BY slot').all(req.userId)
  res.json(saves.map((s) => {
    const club = getClubRow(s.id, s.club_id)
    return { id: s.id, name: s.name, slot: s.slot, managerName: s.manager_name, season: s.season, date: s.date, club: club ? clubOut(club) : null }
  }))
})

api.post('/career', (req, res) => {
  const { clubId, managerName, slot = 1, name } = req.body || {}
  if (!clubId || !managerName) return res.status(400).json({ error: 'Club and manager name are required' })
  const saveId = createSave({ userId: req.userId, clubId, managerName: managerName.trim().slice(0, 40), slot: Number(slot) || 1, name })
  res.json({ saveId })
})

api.delete('/saves/:id', (req, res) => {
  const s = db.prepare('SELECT id FROM saves WHERE id=? AND user_id=?').get(req.params.id, req.userId)
  if (!s) return res.status(404).json({ error: 'Not found' })
  deleteSaveData(s.id)
  res.json({ ok: true })
})

function withSave(handler) {
  return (req, res) => {
    const saveId = req.header('x-save-id') || req.query.saveId
    const save = saveId ? db.prepare('SELECT * FROM saves WHERE id=? AND user_id=?').get(saveId, req.userId) : null
    if (!save) return res.status(401).json({ error: 'No active career' })
    try { handler(req, res, save) } catch (e) { console.error(e); res.status(500).json({ error: e.message }) }
  }
}

function clubFixturesDto(saveId, clubId, opts) {
  return getClubFixtures(saveId, clubId, opts).map((f) => {
    const home = f.home_id === clubId
    return {
      id: f.id, competition: f.competition, competitionName: COMPETITION_NAMES[f.competition] || f.competition,
      round: f.round, matchday: f.matchday, date: f.date, played: !!f.played,
      homeId: f.home_id, awayId: f.away_id, homeName: f.home_name, awayName: f.away_name,
      homeShort: f.home_short, awayShort: f.away_short,
      homeGoals: f.home_goals, awayGoals: f.away_goals,
      isHome: home, opponent: home ? f.away_name : f.home_name, opponentShort: home ? f.away_short : f.home_short,
      opponentId: home ? f.away_id : f.home_id,
      opponentColor1: home ? f.away_color : f.home_color, opponentColor2: home ? f.away_color2 : f.home_color2,
      homeColor: f.home_color, awayColor: f.away_color,
      result: f.played ? (f.home_goals === f.away_goals ? 'D' : (f.home_goals > f.away_goals) === home ? 'W' : 'L') : null,
    }
  })
}

function positionRow(saveId, save) {
  const club = getClubRow(saveId, save.club_id)
  if (!club) return null
  const table = getTable(saveId, club.league_id, save.season)
  const row = table.find((r) => r.clubId === club.id)
  return { table, row }
}

api.get('/game', withSave((req, res, save) => {
  const club = getClubRow(save.id, save.club_id)
  const { table, row } = positionRow(save.id, save)
  const all = getClubFixtures(save.id, save.club_id, { season: save.season })
  const played = all.filter((f) => f.played)
  const upcoming = all.filter((f) => !f.played)
  const today = all.find((f) => !f.played && f.date === save.date)
  const squad = getSquad(save.id, save.club_id)
  const wageBill = squad.reduce((s, p) => s + p.wage, 0)
  const morale = Math.round(squad.reduce((s, p) => s + p.morale, 0) / Math.max(1, squad.length))
  const injuries = squad.filter((p) => p.injuredUntil)
  const stats = db.prepare(`SELECT s.*, p.name, p.position FROM stats s JOIN players p ON p.save_id=s.save_id AND p.id=s.player_id
    WHERE s.save_id=? AND s.season=? AND p.club_id=? ORDER BY s.goals DESC, s.assists DESC LIMIT 5`).all(save.id, save.season, save.club_id)
  const recentTransfers = db.prepare(`SELECT * FROM transfers WHERE save_id=? AND (from_club=? OR to_club=?) ORDER BY id DESC LIMIT 6`).all(save.id, save.club_id, save.club_id)
  const news = getNews(save.id, save.club_id, 12)
  const leagueName = COMPETITION_NAMES[club.league_id] || club.league_id
  const next = upcoming[0]
  let nextMatch = next ? clubFixturesDto(save.id, save.club_id, { season: save.season, played: 0, limit: 1 })[0] : null
  if (nextMatch) {
    const opp = getClubRow(save.id, nextMatch.opponentId)
    if (opp) {
      nextMatch = {
        ...nextMatch,
        opponentPosition: (getTable(save.id, opp.league_id, save.season) || []).find((r) => r.clubId === opp.id)?.position || null,
        opponentLeague: COMPETITION_NAMES[opp.league_id] || opp.league_id,
        opponentReputation: opp.reputation,
      }
    }
  }
  res.json({
    save: { id: save.id, managerName: save.manager_name, season: save.season, date: save.date, seasonStart: save.season_start, seasonEnd: save.season_end, slot: save.slot, name: save.name },
    club: clubOut(club),
    league: { id: club.league_id, name: leagueName, tier: club.tier, table },
    position: row,
    squadSize: squad.length,
    squadMorale: morale,
    wageBill,
    injuries: injuries.map((p) => ({ id: p.id, name: p.name, position: p.position, type: p.injuryType, until: p.injuredUntil, ovr: p.ovr })),
    recentResults: clubFixturesDto(save.id, save.club_id, { season: save.season, played: 1 }).slice(-6).reverse(),
    upcoming: clubFixturesDto(save.id, save.club_id, { season: save.season, played: 0, limit: 6 }),
    nextMatch,
    news,
    topPlayers: stats.map((s) => ({ playerId: s.player_id, name: s.name, position: s.position, goals: s.goals, assists: s.assists, apps: s.apps, rating: s.apps ? Math.round((s.rating_sum / s.apps) * 10) / 10 : 0 })),
    transferActivity: recentTransfers,
    pendingMatch: today ? clubFixturesDto(save.id, save.club_id, { season: save.season, played: 0 }).find((f) => f.id === today.id) : null,
    windowOpen: isWindowOpen(save.date),
    boardConfidence: club.board_confidence,
    objectives: club.objective,
    trophies: db.prepare('SELECT * FROM trophies WHERE save_id=? AND club_id=? ORDER BY season DESC').all(save.id, save.club_id),
  })
}))

api.post('/advance', withSave((req, res, save) => {
  const { mode = 'next-match', days = 1 } = req.body || {}
  const result = advance(save.id, { mode, days })
  res.json(result)
}))

api.post('/simulate-match', withSave((req, res, save) => {
  const { fixtureId } = req.body || {}
  const f = getFixture(save.id, fixtureId)
  if (!f) return res.status(404).json({ error: 'Fixture not found' })
  if (f.home_id !== save.club_id && f.away_id !== save.club_id) return res.status(403).json({ error: 'Not your fixture' })
  const r = simulateUserFixture(save.id, fixtureId)
  const updated = getFixture(save.id, fixtureId)
  res.json({ ...r, fixture: updated })
}))

api.get('/squad', withSave((req, res, save) => {
  const squad = getSquad(save.id, save.club_id)
  const youth = getSquad(save.id, save.club_id, { youth: true })
  const tactics = getTactics(save.id, save.club_id)
  const lineup = getLineup(save.id, save.club_id)
  const club = getClubRow(save.id, save.club_id)
  const stats = db.prepare('SELECT * FROM stats WHERE save_id=? AND season=?').all(save.id, save.season)
  const statsMap = Object.fromEntries(stats.map((s) => [s.player_id, s]))
  const enrich = (p) => {
    const s = statsMap[p.id]
    return { ...p, stats: s ? { apps: s.apps, goals: s.goals, assists: s.assists, minutes: s.minutes, rating: s.apps ? Math.round((s.rating_sum / s.apps) * 10) / 10 : 0 } : { apps: 0, goals: 0, assists: 0, minutes: 0, rating: 0 } }
  }
  res.json({
    squad: squad.map(enrich),
    youth: youth.map(enrich),
    tactics,
    lineup,
    formations: Object.entries(FORMATIONS).map(([k, v]) => ({ key: k, label: v.label, style: v.style, slots: v.slots })),
    roles: SQUAD_ROLES,
    club: clubOut(club),
    wageBill: squad.reduce((s, p) => s + p.wage, 0),
    trainingOptions: ['Balanced', 'Pace', 'Shooting', 'Passing', 'Dribbling', 'Defending', 'Physical', 'Goalkeeping'],
    positionOptions: ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'CF', 'ST'],
  })
}))

api.post('/squad/lineup', withSave((req, res, save) => {
  const { starters, bench } = req.body || {}
  if (!Array.isArray(starters) || starters.length !== 11) return res.status(400).json({ error: 'Starting XI must have 11 players' })
  const squad = getSquad(save.id, save.club_id)
  const ids = new Set(squad.map((p) => p.id))
  const all = [...starters.map((s) => s.playerId), ...(bench || [])]
  if (all.some((id) => !ids.has(id))) return res.status(400).json({ error: 'Player not in squad' })
  if (new Set(all).size !== all.length) return res.status(400).json({ error: 'Duplicate player selected' })
  saveLineup(save.id, save.club_id, starters.map((s) => ({ playerId: s.playerId, slot: s.slot })), bench || [])
  res.json({ ok: true, lineup: getLineup(save.id, save.club_id) })
}))

api.post('/squad/auto', withSave((req, res, save) => {
  const squad = getSquad(save.id, save.club_id)
  const t = getTactics(save.id, save.club_id)
  const lu = autoLineup(squad, t.formation)
  saveLineup(save.id, save.club_id, lu.starters, lu.bench)
  res.json({ ok: true, lineup: getLineup(save.id, save.club_id) })
}))

api.post('/squad/tactics', withSave((req, res, save) => {
  const t = req.body || {}
  const current = getTactics(save.id, save.club_id)
  const next = { ...current, ...t }
  if (!FORMATIONS[next.formation]) return res.status(400).json({ error: 'Unknown formation' })
  saveTactics(save.id, save.club_id, next)
  res.json({ ok: true, tactics: getTactics(save.id, save.club_id) })
}))

api.post('/squad/training', withSave((req, res, save) => {
  const { playerId, focus, intensity } = req.body || {}
  const p = getPlayerRow(save.id, playerId)
  if (!p || p.club_id !== save.club_id) return res.status(404).json({ error: 'Player not found' })
  if (focus) db.prepare('UPDATE players SET training_focus=? WHERE save_id=? AND id=?').run(focus, save.id, playerId)
  if (intensity) db.prepare('UPDATE players SET training_intensity=? WHERE save_id=? AND id=?').run(intensity, save.id, playerId)
  res.json({ ok: true })
}))

api.post('/squad/contract', withSave((req, res, save) => {
  const { playerId, wage, years, role, releaseClause } = req.body || {}
  const p = getPlayerRow(save.id, playerId)
  if (!p || p.club_id !== save.club_id) return res.status(404).json({ error: 'Player not found' })
  const result = evaluateContractOffer(save.id, { playerId, wage: Number(wage), years: Number(years), role: role || p.squad_role, releaseClause: releaseClause ? Number(releaseClause) : null })
  res.json(result)
}))

api.post('/squad/release', withSave((req, res, save) => {
  const { playerId } = req.body || {}
  const p = getPlayerRow(save.id, playerId)
  if (!p || p.club_id !== save.club_id) return res.status(404).json({ error: 'Player not found' })
  releasePlayer(save.id, playerId)
  res.json({ ok: true })
}))

api.post('/squad/promote', withSave((req, res, save) => {
  const { playerId } = req.body || {}
  const p = getPlayerRow(save.id, playerId)
  if (!p || p.club_id !== save.club_id) return res.status(404).json({ error: 'Player not found' })
  promoteYouth(save.id, playerId)
  res.json({ ok: true })
}))

api.post('/squad/number', withSave((req, res, save) => {
  const { playerId, number } = req.body || {}
  const p = getPlayerRow(save.id, playerId)
  if (!p || p.club_id !== save.club_id) return res.status(404).json({ error: 'Player not found' })
  const n = Number(number)
  if (!n || n < 1 || n > 99) return res.status(400).json({ error: 'Invalid number' })
  db.prepare('UPDATE players SET squad_number=? WHERE save_id=? AND club_id=? AND squad_number=?').run(999, save.id, save.club_id, n)
  db.prepare('UPDATE players SET squad_number=? WHERE save_id=? AND id=?').run(n, save.id, playerId)
  res.json({ ok: true })
}))

api.post('/squad/transfer-list', withSave((req, res, save) => {
  const { playerId, listed } = req.body || {}
  const p = getPlayerRow(save.id, playerId)
  if (!p || p.club_id !== save.club_id) return res.status(404).json({ error: 'Player not found' })
  db.prepare('UPDATE players SET transfer_listed=? WHERE save_id=? AND id=?').run(listed ? 1 : 0, save.id, playerId)
  res.json({ ok: true })
}))

function playerQuery(save, params, { forScouting = false } = {}) {
  const season = save.season
  const where = ['p.save_id=?', 'p.is_youth=0']
  const args = [save.id]
  const { league, club, position, nationality, q, ageMin, ageMax, ovrMin, ovrMax, potMin, potMax, valueMin, valueMax, sort = 'ovr', dir = 'desc', page = 1, pageSize = 40, transferListed, freeAgents, expiring } = params
  if (league && league !== 'all') { where.push('c.league_id=?'); args.push(league) }
  if (club) { where.push('p.club_id=?'); args.push(club) }
  if (position && position !== 'all') {
    if (position === 'GK' || position === 'DEF' || position === 'MID' || position === 'ATT') {
      const groups = { GK: ['GK'], DEF: ['CB', 'LB', 'RB', 'LWB', 'RWB'], MID: ['CDM', 'CM', 'CAM', 'LM', 'RM'], ATT: ['LW', 'RW', 'CF', 'ST'] }
      const list = groups[position]
      where.push(`p.position IN (${list.map(() => '?').join(',')})`); args.push(...list)
    } else { where.push('p.position=?'); args.push(position) }
  }
  if (nationality && nationality !== 'all') { where.push('p.nationality=?'); args.push(nationality) }
  if (q) { where.push('p.name LIKE ?'); args.push(`%${q}%`) }
  if (ageMin) { where.push('p.age>=?'); args.push(Number(ageMin)) }
  if (ageMax) { where.push('p.age<=?'); args.push(Number(ageMax)) }
  if (ovrMin) { where.push('p.ovr>=?'); args.push(Number(ovrMin)) }
  if (ovrMax) { where.push('p.ovr<=?'); args.push(Number(ovrMax)) }
  if (potMin) { where.push('p.pot>=?'); args.push(Number(potMin)) }
  if (potMax) { where.push('p.pot<=?'); args.push(Number(potMax)) }
  if (valueMin) { where.push('p.value>=?'); args.push(Number(valueMin)) }
  if (valueMax) { where.push('p.value<=?'); args.push(Number(valueMax)) }
  if (transferListed) where.push('p.transfer_listed=1')
  if (freeAgents) where.push('p.club_id IS NULL')
  if (expiring) { where.push('p.contract_end<=?'); args.push(season + 1) }
  const sortMap = {
    ovr: 'p.ovr', pot: 'p.pot', value: 'p.value', wage: 'p.wage', age: 'p.age', name: 'p.name',
    apps: 'COALESCE(s.apps,0)', goals: 'COALESCE(s.goals,0)', assists: 'COALESCE(s.assists,0)',
    rating: 'CASE WHEN COALESCE(s.apps,0)>0 THEN s.rating_sum*1.0/s.apps ELSE 0 END',
  }
  const order = sortMap[sort] || 'p.ovr'
  const direction = dir === 'asc' ? 'ASC' : 'DESC'
  const limit = Math.min(100, Number(pageSize) || 40)
  const offset = (Math.max(1, Number(page)) - 1) * limit
  const base = `FROM players p JOIN clubs c ON c.save_id=p.save_id AND c.id=p.club_id
    LEFT JOIN stats s ON s.save_id=p.save_id AND s.player_id=p.id AND s.season=?
    WHERE ${where.join(' AND ')}`
  const countArgs = [season, ...args]
  const total = db.prepare(`SELECT COUNT(*) c ${base}`).get(...countArgs).c
  const rows = db.prepare(`SELECT p.*, c.name as club_name, c.league_id as league_id, c.short as club_short, c.reputation as club_rep,
    COALESCE(s.apps,0) as apps, COALESCE(s.goals,0) as goals, COALESCE(s.assists,0) as assists,
    COALESCE(s.minutes,0) as minutes, CASE WHEN COALESCE(s.apps,0)>0 THEN s.rating_sum*1.0/s.apps ELSE 0 END as avg_rating
    ${base} ORDER BY ${order} ${direction}, p.name ASC LIMIT ? OFFSET ?`).all(season, ...args, limit, offset)
  return {
    total, page: Number(page), pageSize: limit,
    players: rows.map((r) => ({
      ...playerOut(r),
      clubName: r.club_name, clubShort: r.club_short, leagueId: r.league_id,
      apps: r.apps, goals: r.goals, assists: r.assists, minutes: r.minutes,
      avgRating: r.apps ? Math.round(r.avg_rating * 10) / 10 : 0,
      askingPrice: forScouting ? null : Math.round(marketValue(r.ovr, r.age, r.pot, Math.max(0, r.contract_end - save.season)) * (r.club_id === save.club_id ? 0 : 1.25) / 1e5) * 1e5,
    })),
  }
}

api.get('/players', withSave((req, res, save) => {
  res.json(playerQuery(save, req.query))
}))

api.get('/players/:id', withSave((req, res, save) => {
  const p = getPlayerRow(save.id, req.params.id)
  if (!p) return res.status(404).json({ error: 'Player not found' })
  const club = p.club_id ? getClubRow(save.id, p.club_id) : null
  const current = getPlayerStats(save.id, p.id, save.season)
  const career = db.prepare('SELECT SUM(apps) apps, SUM(goals) goals, SUM(assists) assists, SUM(minutes) minutes, SUM(rating_sum) rs, SUM(apps) a FROM stats WHERE save_id=? AND player_id=?').get(save.id, p.id)
  const transfers = db.prepare('SELECT * FROM transfers WHERE save_id=? AND player_id=? ORDER BY id DESC').all(save.id, p.id)
  const injuries = db.prepare('SELECT * FROM injury_history WHERE save_id=? AND player_id=? ORDER BY date DESC LIMIT 12').all(save.id, p.id)
  const development = db.prepare('SELECT * FROM player_history WHERE save_id=? AND player_id=? ORDER BY season ASC').all(save.id, p.id)
  const seasons = db.prepare('SELECT * FROM stats WHERE save_id=? AND player_id=? ORDER BY season DESC').all(save.id, p.id)
  res.json({
    player: { ...playerOut(p), clubName: club?.name || 'Free Agent', leagueId: club?.league_id || null, clubColor1: club?.color1, clubColor2: club?.color2 },
    club: club ? clubOut(club) : null,
    currentSeason: current ? { ...current, rating: current.apps ? Math.round((current.rating_sum / current.apps) * 10) / 10 : 0 } : null,
    career: { apps: career.apps || 0, goals: career.goals || 0, assists: career.assists || 0, minutes: career.minutes || 0, rating: career.apps ? Math.round((career.rs / career.apps) * 10) / 10 : 0 },
    seasons, transfers, injuries, development,
    askingPrice: club && club.id !== save.club_id ? Math.round(marketValue(p.ovr, p.age, p.pot, Math.max(0, p.contract_end - save.season)) * 1.25 / 1e5) * 1e5 : null,
    wageExpectation: Math.round(wageExpectation(p, getClubRow(save.id, save.club_id))),
    squadRole: p.squad_role,
  })
}))

api.get('/scouting', withSave((req, res, save) => {
  const result = playerQuery(save, req.query, { forScouting: true })
  const shortlist = db.prepare('SELECT player_id FROM shortlist WHERE save_id=?').all(save.id).map((r) => r.player_id)
  const reports = db.prepare('SELECT player_id, accuracy, created_at FROM scout_reports WHERE save_id=?').all(save.id)
  res.json({ ...result, shortlist, reports, scoutingQuality: getClubRow(save.id, save.club_id).scouting })
}))

api.post('/scouting/shortlist', withSave((req, res, save) => {
  const { playerId } = req.body || {}
  const existing = db.prepare('SELECT player_id FROM shortlist WHERE save_id=? AND player_id=?').get(save.id, playerId)
  if (existing) db.prepare('DELETE FROM shortlist WHERE save_id=? AND player_id=?').run(save.id, playerId)
  else db.prepare('INSERT INTO shortlist (save_id,player_id,added_at) VALUES (?,?,?)').run(save.id, playerId, save.date)
  res.json({ ok: true, shortlisted: !existing })
}))

api.get('/scouting/shortlist', withSave((req, res, save) => {
  const rows = db.prepare(`SELECT p.*, c.name as club_name, c.league_id as league_id, c.short as club_short, c.color1, c.color2
    FROM shortlist sl JOIN players p ON p.save_id=sl.save_id AND p.id=sl.player_id
    LEFT JOIN clubs c ON c.save_id=p.save_id AND c.id=p.club_id WHERE sl.save_id=? ORDER BY sl.added_at DESC`).all(save.id)
  const reports = db.prepare('SELECT * FROM scout_reports WHERE save_id=?').all(save.id)
  const reportMap = Object.fromEntries(reports.map((r) => [r.player_id, r]))
  res.json(rows.map((r) => ({ ...playerOut(r), clubName: r.club_name, leagueId: r.league_id, clubShort: r.club_short, color1: r.color1, color2: r.color2, report: reportMap[r.player_id] ? JSON.parse(reportMap[r.player_id].report) : null })))
}))

const KEY_ATTRS = {
  GK: ['gk_reflexes', 'gk_handling', 'gk_positioning', 'gk_diving', 'gk_kicking'],
  CB: ['defending', 'awareness', 'standing_tackle', 'heading', 'strength'],
  LB: ['pace', 'defending', 'stamina', 'crossing', 'standing_tackle'],
  RB: ['pace', 'defending', 'stamina', 'crossing', 'standing_tackle'],
  LWB: ['pace', 'stamina', 'crossing', 'defending', 'dribbling'],
  RWB: ['pace', 'stamina', 'crossing', 'defending', 'dribbling'],
  CDM: ['interceptions', 'standing_tackle', 'short_passing', 'stamina', 'strength'],
  CM: ['short_passing', 'vision', 'ball_control', 'stamina', 'long_passing'],
  CAM: ['vision', 'short_passing', 'ball_control', 'dribbling', 'finishing'],
  LM: ['pace', 'dribbling', 'crossing', 'stamina', 'ball_control'],
  RM: ['pace', 'dribbling', 'crossing', 'stamina', 'ball_control'],
  LW: ['pace', 'dribbling', 'acceleration', 'crossing', 'finishing'],
  RW: ['pace', 'dribbling', 'acceleration', 'crossing', 'finishing'],
  CF: ['finishing', 'positioning', 'reactions', 'ball_control', 'shot_power'],
  ST: ['finishing', 'positioning', 'shot_power', 'reactions', 'heading'],
}
const ATTR_LABEL = {
  pace: 'Pace', shooting: 'Shooting', passing: 'Passing', dribbling: 'Dribbling', defending: 'Defending', physicality: 'Physicality',
  finishing: 'Finishing', shot_power: 'Shot Power', long_shots: 'Long Shots', positioning: 'Positioning', volleys: 'Volleys',
  penalties: 'Penalties', short_passing: 'Short Passing', long_passing: 'Long Passing', vision: 'Vision', crossing: 'Crossing',
  curve: 'Curve', fk_accuracy: 'Free Kicks', ball_control: 'Ball Control', agility: 'Agility', balance: 'Balance',
  reactions: 'Reactions', composure: 'Composure', acceleration: 'Acceleration', sprint_speed: 'Sprint Speed',
  stamina: 'Stamina', strength: 'Strength', jumping: 'Jumping', aggression: 'Aggression', interceptions: 'Interceptions',
  awareness: 'Awareness', standing_tackle: 'Standing Tackle', sliding_tackle: 'Sliding Tackle', heading: 'Heading',
  gk_diving: 'GK Diving', gk_handling: 'GK Handling', gk_kicking: 'GK Kicking', gk_positioning: 'GK Positioning', gk_reflexes: 'GK Reflexes',
}

api.post('/scouting/report', withSave((req, res, save) => {
  const { playerId } = req.body || {}
  const p = getPlayerRow(save.id, playerId)
  if (!p) return res.status(404).json({ error: 'Player not found' })
  const club = getClubRow(save.id, save.club_id)
  const attrs = JSON.parse(p.attrs || '{}')
  const keys = KEY_ATTRS[p.position] || KEY_ATTRS.CM
  const ranked = keys.map((k) => ({ key: k, label: ATTR_LABEL[k] || k, value: attrs[k] || 0 })).sort((a, b) => b.value - a.value)
  const strengths = ranked.slice(0, 3)
  const weaknesses = ranked.slice(-2).reverse()
  const accuracy = Math.max(30, Math.min(95, club.scouting * 9 + (p.club_id === club.id ? 15 : 0)))
  const spread = Math.round((100 - accuracy) / 9)
  const ovrRange = [Math.max(1, p.ovr - spread), Math.min(99, p.ovr + spread)]
  const potRange = [Math.max(ovrRange[0], p.pot - spread), Math.min(99, p.pot + spread)]
  const value = marketValue(p.ovr, p.age, p.pot, Math.max(0, p.contract_end - save.season))
  const tactics = getTactics(save.id, save.club_id)
  const slots = formationSlots(tactics.formation)
  let bestFit = { score: 0, pos: p.position }
  for (const s of slots) {
    const pen = Math.abs((POSITION_GROUP[p.position] || 'MID') === (POSITION_GROUP[s.pos] || 'MID') ? 0 : 10) + (p.position === s.pos ? 0 : 4)
    const score = p.ovr - pen
    if (score > bestFit.score) bestFit = { score, pos: s.pos }
  }
  const suitability = Math.max(20, Math.min(99, Math.round(100 - (p.ovr - bestFit.score) * 4)))
  const style = p.playstyles?.length ? p.playstyles.slice(0, 3).join(', ') : ranked[0].label + ' focused'
  const report = {
    generatedAt: save.date,
    accuracy,
    summary: `${p.name} is a ${p.age}-year-old ${POSITION_LABEL[p.position] || p.position} currently at ${p.club_id ? getClubRow(save.id, p.club_id)?.name : 'free agency'}. Our scouts rate his current ability in the ${ovrRange[0]}-${ovrRange[1]} range with potential to reach ${potRange[0]}-${potRange[1]}.`,
    currentAbility: ovrRange,
    potential: potRange,
    value: [Math.round((value * (1 - (100 - accuracy) / 220)) / 1e5) * 1e5, Math.round((value * (1 + (100 - accuracy) / 220)) / 1e5) * 1e5],
    contract: { end: p.contract_end, wage: p.wage, yearsLeft: Math.max(0, p.contract_end - save.season), clause: p.release_clause },
    style,
    strengths: strengths.map((s) => ({ label: s.label, value: accuracy >= 75 ? s.value : `${Math.max(1, s.value - spread)}-${Math.min(99, s.value + spread)}` })),
    weaknesses: weaknesses.map((s) => ({ label: s.label, value: accuracy >= 75 ? s.value : `${Math.max(1, s.value - spread)}-${Math.min(99, s.value + spread)}` })),
    suitability: { score: suitability, position: bestFit.pos, text: suitability >= 80 ? `Excellent fit for your ${tactics.formation}.` : suitability >= 65 ? `Good fit for your ${tactics.formation}.` : `Would need to adapt to your ${tactics.formation}.` },
  }
  db.prepare('INSERT OR REPLACE INTO scout_reports (save_id,player_id,created_at,accuracy,report) VALUES (?,?,?,?,?)')
    .run(save.id, playerId, save.date, accuracy, JSON.stringify(report))
  res.json({ report })
}))

api.get('/transfers', withSave((req, res, save) => {
  const club = getClubRow(save.id, save.club_id)
  const windowOpen = isWindowOpen(save.date)
  const market = db.prepare(`SELECT p.*, c.name as club_name, c.short as club_short, c.league_id, c.color1, c.color2
    FROM players p LEFT JOIN clubs c ON c.save_id=p.save_id AND c.id=p.club_id
    WHERE p.save_id=? AND p.is_youth=0 AND p.club_id!=? AND (p.transfer_listed=1 OR p.club_id IS NULL OR p.contract_end<=?)
    ORDER BY p.ovr DESC LIMIT 40`).all(save.id, save.club_id, save.season + 1)
  const offers = db.prepare(`SELECT o.*, p.name as player_name, p.position, p.ovr, p.age, c.name as from_name, c.short as from_short
    FROM offers o JOIN players p ON p.save_id=o.save_id AND p.id=o.player_id LEFT JOIN clubs c ON c.save_id=o.save_id AND c.id=o.from_club
    WHERE o.save_id=? AND o.status='pending' ORDER BY o.id DESC`).all(save.id)
  const history = db.prepare(`SELECT t.*, fc.name as from_name, tc.name as to_name FROM transfers t
    LEFT JOIN clubs fc ON fc.save_id=t.save_id AND fc.id=t.from_club LEFT JOIN clubs tc ON tc.save_id=t.save_id AND tc.id=t.to_club
    WHERE t.save_id=? ORDER BY t.id DESC LIMIT 40`).all(save.id)
  res.json({
    windowOpen, budget: club.transfer_budget, balance: club.balance,
    wageBudget: club.wage_budget, wageBill: getSquad(save.id, save.club_id).reduce((s, p) => s + p.wage, 0),
    market: market.map((r) => ({ ...playerOut(r), clubName: r.club_name || 'Free Agent', clubShort: r.club_short, leagueId: r.league_id, color1: r.color1, color2: r.color2, askingPrice: r.club_id ? Math.round(marketValue(r.ovr, r.age, r.pot, Math.max(0, r.contract_end - save.season)) * 1.25 / 1e5) * 1e5 : 0 })),
    offers, history,
    listed: getSquad(save.id, save.club_id).filter((p) => p.transferListed),
  })
}))

api.post('/transfers/offer', withSave((req, res, save) => {
  const { playerId, fee, wage, years, role, includePlayerId } = req.body || {}
  const p = getPlayerRow(save.id, playerId)
  if (!p) return res.status(404).json({ error: 'Player not found' })
  if (p.club_id === save.club_id) return res.status(400).json({ error: 'Player is already at your club' })
  const result = evaluateTransferOffer(save.id, { playerId: Number(playerId), fee: Number(fee) || 0, wage: Number(wage) || 0, years: Number(years) || 3, role: role || 'First Team', includePlayerId: includePlayerId ? Number(includePlayerId) : null })
  res.json(result)
}))

api.post('/transfers/offer/resolve', withSave((req, res, save) => {
  const { offerId, accept } = req.body || {}
  res.json(resolveOffer(save.id, Number(offerId), !!accept))
}))

api.get('/competitions', withSave((req, res, save) => {
  const club = getClubRow(save.id, save.club_id)
  const comp = req.query.comp || club.league_id
  const competitions = [
    ...LEAGUES.map((l) => ({ id: l.id, name: COMPETITION_NAMES[l.id], country: l.country, tier: l.tier, kind: 'league' })),
    ...Object.entries(CUP_BY_COUNTRY).map(([c, id]) => ({ id, name: COMPETITION_NAMES[id], country: c, kind: 'cup' })),
    { id: 'ucl', name: COMPETITION_NAMES.ucl, country: 'Europe', kind: 'europe' },
    { id: 'uel', name: COMPETITION_NAMES.uel, country: 'Europe', kind: 'europe' },
    { id: 'uecl', name: COMPETITION_NAMES.uecl, country: 'Europe', kind: 'europe' },
  ]
  const isLeague = LEAGUES.some((l) => l.id === comp)
  const table = isLeague ? getTable(save.id, comp, save.season) : null
  const fixtures = db.prepare(`SELECT f.*, h.name as home_name, h.short as home_short, a.name as away_name, a.short as away_short
    FROM fixtures f JOIN clubs h ON h.save_id=f.save_id AND h.id=f.home_id JOIN clubs a ON a.save_id=f.save_id AND a.id=f.away_id
    WHERE f.save_id=? AND f.competition=? AND f.season=? ORDER BY f.date, f.id`).all(save.id, comp, save.season)
  const topScorers = isLeague ? db.prepare(`SELECT s.*, p.name, p.position, p.nationality, c.name as club_name, c.short as club_short
    FROM stats s JOIN players p ON p.save_id=s.save_id AND p.id=s.player_id JOIN clubs c ON c.save_id=p.save_id AND c.id=p.club_id
    WHERE s.save_id=? AND s.season=? AND c.league_id=? ORDER BY s.goals DESC, s.assists DESC LIMIT 12`).all(save.id, save.season, comp) : []
  const history = db.prepare('SELECT * FROM season_history WHERE save_id=? AND competition=? ORDER BY season DESC').all(save.id, comp)
  res.json({
    selected: comp, isLeague, competitions, table, fixtures, topScorers, history,
    winners: history.map((h) => ({ season: h.season, winner: h.winner_name })),
  })
}))

api.get('/calendar', withSave((req, res, save) => {
  const month = req.query.month || save.date.slice(0, 7)
  const fixtures = db.prepare(`SELECT f.*, h.name as home_name, h.short as home_short, a.name as away_name, a.short as away_short
    FROM fixtures f JOIN clubs h ON h.save_id=f.save_id AND h.id=f.home_id JOIN clubs a ON a.save_id=f.save_id AND a.id=f.away_id
    WHERE f.save_id=? AND f.season=? AND f.date LIKE ? ORDER BY f.date, f.id`).all(save.id, save.season, `${month}%`)
  const club = getClubRow(save.id, save.club_id)
  const squad = getSquad(save.id, save.club_id)
  const keyDates = [
    { date: `${save.season}-07-01`, label: 'Transfer window opens', type: 'window' },
    { date: `${save.season}-09-01`, label: 'Transfer window closes', type: 'window' },
    { date: `${save.season + 1}-01-01`, label: 'Winter transfer window opens', type: 'window' },
    { date: `${save.season + 1}-01-31`, label: 'Winter transfer window closes', type: 'window' },
    { date: `${save.season + 1}-03-01`, label: 'Youth intake', type: 'youth' },
    { date: save.season_end, label: 'Season ends', type: 'season' },
    ...squad.filter((p) => p.contractEnd <= save.season + 1).slice(0, 8).map((p) => ({ date: save.season_end, label: `${p.name} contract expires`, type: 'contract' })),
  ].filter((k) => k.date.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date))
  res.json({ month, fixtures, keyDates, date: save.date, club: clubOut(club) })
}))

api.get('/club', withSave((req, res, save) => {
  const club = getClubRow(save.id, save.club_id)
  const squad = getSquad(save.id, save.club_id)
  const youth = getSquad(save.id, save.club_id, { youth: true })
  const finances = db.prepare('SELECT * FROM finances WHERE save_id=? AND club_id=? ORDER BY id DESC LIMIT 40').all(save.id, save.club_id)
  const income = db.prepare("SELECT type, SUM(amount) t FROM finances WHERE save_id=? AND club_id=? AND amount>0 GROUP BY type").all(save.id, save.club_id)
  const expense = db.prepare("SELECT type, SUM(amount) t FROM finances WHERE save_id=? AND club_id=? AND amount<0 GROUP BY type").all(save.id, save.club_id)
  const trophies = db.prepare('SELECT * FROM trophies WHERE save_id=? AND club_id=? ORDER BY season DESC').all(save.id, save.club_id)
  const history = db.prepare('SELECT * FROM season_history WHERE save_id=? AND user_club_id=? ORDER BY season DESC').all(save.id, save.club_id)
  const { table, row } = positionRow(save.id, save)
  res.json({
    club: clubOut(club), squadSize: squad.length, youthSize: youth.length,
    wageBill: squad.reduce((s, p) => s + p.wage, 0), youth,
    finances, income, expense, trophies, history,
    board: { confidence: club.board_confidence, objective: club.objective, position: row?.position, leagueName: COMPETITION_NAMES[club.league_id] },
    stadium: { name: club.stadium, capacity: club.capacity },
    facilities: { training: club.training_facilities, youth: club.youth_facilities, scouting: club.scouting },
  })
}))

api.get('/match/:id', withSave((req, res, save) => {
  const f = getFixture(save.id, Number(req.params.id))
  if (!f) return res.status(404).json({ error: 'Fixture not found' })
  if (f.home_id !== save.club_id && f.away_id !== save.club_id) return res.status(403).json({ error: 'Not your fixture' })
  if (f.played) return res.json({ played: true, fixture: f, events: JSON.parse(f.events || '[]'), stats: JSON.parse(f.stats || '{}') })
  const state = startLiveMatch(save.id, f)
  res.json({ played: false, fixture: f, state: publicState(state) })
}))

api.post('/match/:id/tick', withSave((req, res, save) => {
  const f = getFixture(save.id, Number(req.params.id))
  if (!f || f.played) return res.status(400).json({ error: 'Match not available' })
  const { minutes = 1 } = req.body || {}
  const state = tickLiveMatch(save.id, f, Number(minutes) || 1)
  res.json({ state: publicState(state), finished: state.finished })
}))

api.post('/match/:id/sub', withSave((req, res, save) => {
  const f = getFixture(save.id, Number(req.params.id))
  if (!f || f.played) return res.status(400).json({ error: 'Match not available' })
  const state = startLiveMatch(save.id, f)
  const { outId, inId } = req.body || {}
  const side = f.home_id === save.club_id ? 'home' : 'away'
  const r = makeSub(state, side, outId, inId)
  if (r.ok) db.prepare('INSERT OR REPLACE INTO live_matches (save_id,fixture_id,state) VALUES (?,?,?)').run(save.id, f.id, JSON.stringify(state))
  res.json({ ...r, state: publicState(state) })
}))

api.post('/match/:id/tactics', withSave((req, res, save) => {
  const f = getFixture(save.id, Number(req.params.id))
  if (!f || f.played) return res.status(400).json({ error: 'Match not available' })
  const state = startLiveMatch(save.id, f)
  const side = f.home_id === save.club_id ? 'home' : 'away'
  const patch = req.body || {}
  state[side].tactics = { ...state[side].tactics, ...patch }
  state[side].tactics.formation = patch.formation || state[side].tactics.formation
  db.prepare('INSERT OR REPLACE INTO live_matches (save_id,fixture_id,state) VALUES (?,?,?)').run(save.id, f.id, JSON.stringify(state))
  res.json({ state: publicState(state) })
}))

api.post('/match/:id/sim', withSave((req, res, save) => {
  const f = getFixture(save.id, Number(req.params.id))
  if (!f || f.played) return res.status(400).json({ error: 'Match not available' })
  const state = tickLiveMatch(save.id, f, 90)
  res.json({ state: publicState(state), finished: true })
}))

app.use('/api', api)

const PORT = Number(process.env.PORT) || 3000
const server = http.createServer(app)

if (process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite')
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: { server } },
    appType: 'spa',
  })
  app.use(vite.middlewares)
} else {
  const path = await import('node:path')
  const fs = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
  const cwd = path.resolve(process.cwd(), 'dist')
  const dist = fs.existsSync(path.join(cwd, 'index.html')) ? cwd : here
  const index = path.join(dist, 'index.html')
  if (!fs.existsSync(index)) {
    throw new Error('Production frontend is missing. Run "npm run build" before "npm start".')
  }
  app.use(express.static(dist))
  app.get('*', (req, res) => res.sendFile(index))
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`ULTIMATE FOOTBALL MANAGER listening on http://0.0.0.0:${PORT}`)
})
