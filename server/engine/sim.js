import { db } from '../db.js'
import { getClubRow, getSquad, getTactics, getLineup, saveLineup, addNews, getSave, playerOut } from './world.js'
import { formationSlots, positionPenalty, POSITION_GROUP, autoLineup, availablePlayers, effectiveRating } from './positions.js'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const rand = (a = 0, b = 1) => a + Math.random() * (b - a)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

function avg(arr, fb = 65) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : fb
}

function teamStrength(players, slots, tactics) {
  const g = { GK: [], DEF: [], MID: [], ATT: [] }
  let chem = 0
  for (const p of players) {
    const slot = slots[p.slot]
    if (!slot) continue
    const pen = positionPenalty(p.position, slot.pos)
    chem += pen
    const eff = effectiveRating(p, slot.pos)
    g[POSITION_GROUP[slot.pos]].push(eff)
  }
  const m = (tactics.mentality ?? 3) - 3
  const pr = (tactics.pressing ?? 3) - 3
  const line = (tactics.defLine ?? 3) - 3
  const tempo = (tactics.tempo ?? 3) - 3
  let gk = avg(g.GK, 65)
  let def = avg(g.DEF, 65)
  let mid = avg(g.MID, 65)
  let att = avg(g.ATT, 65)
  att += m * 1.7 + tempo * 0.7
  def -= m * 1.4 - line * 0.45
  mid += pr * 1.0 + tempo * 0.35
  def -= pr * 0.35
  if (tactics.buildup === 'Short Passing') mid += 1.3
  if (tactics.buildup === 'Direct') { att += 1.1; mid -= 0.7 }
  if (tactics.buildup === 'Counter Attack') { att += 0.7; def += 0.8; mid -= 0.5 }
  if (tactics.chanceCreation === 'Through Balls') att += 1.2
  if (tactics.chanceCreation === 'Wing Play') { att += 0.5; mid += 0.5 }
  if (tactics.chanceCreation === 'Possession') mid += 1.1
  const chemistry = clamp(1 - chem / 500, 0.9, 1.03)
  return { gk, def: def * chemistry, mid: mid * chemistry, att: att * chemistry, chem }
}

function attackScore(t) { return t.att * 0.58 + t.mid * 0.42 }
function defenceScore(t) { return t.def * 0.62 + t.gk * 0.2 + t.mid * 0.18 }

function scoreWeight(p) {
  const a = p.attrs || {}
  const base = (a.finishing || 60) * 0.5 + (a.positioning || 60) * 0.35 + (a.shot_power || 60) * 0.15
  const g = POSITION_GROUP[p.position]
  const mult = g === 'ATT' ? 2.2 : g === 'MID' ? 1.1 : g === 'DEF' ? 0.12 : 0.02
  return base * mult
}
function assistWeight(p) {
  const a = p.attrs || {}
  const base = (a.vision || 60) * 0.45 + (a.short_passing || 60) * 0.35 + (a.crossing || 60) * 0.2
  const g = POSITION_GROUP[p.position]
  const mult = g === 'ATT' ? 1.1 : g === 'MID' ? 1.35 : g === 'DEF' ? 0.55 : 0.05
  return base * mult
}

function weightedPick(players, weightFn) {
  const total = players.reduce((s, p) => s + Math.max(1, weightFn(p)), 0)
  let r = Math.random() * total
  for (const p of players) {
    r -= Math.max(1, weightFn(p))
    if (r <= 0) return p
  }
  return players[players.length - 1]
}

function loadTeam(saveId, clubId, { persist = false } = {}) {
  const club = getClubRow(saveId, clubId)
  if (!club) return null
  const squad = getSquad(saveId, clubId)
  const tactics = getTactics(saveId, clubId)
  const slots = formationSlots(tactics.formation)
  const byId = new Map(squad.map((p) => [p.id, p]))
  let lineup = persist ? ensure(saveId, clubId, squad, tactics, slots) : getLineup(saveId, clubId)
  const avail = availablePlayers(squad)
  let starters = lineup.starters
    .map((s) => ({ ...s, player: byId.get(s.playerId) }))
    .filter((s) => s.player && !s.player.injuredUntil && s.player.suspension <= 0)
  if (starters.length < 11) {
    const auto = autoLineup(avail.length >= 11 ? avail : squad, tactics.formation)
    starters = auto.starters.map((s) => ({ ...s, player: byId.get(s.playerId) })).filter((s) => s.player)
  }
  // dedupe
  const seen = new Set()
  starters = starters.filter((s) => {
    if (seen.has(s.playerId)) return false
    seen.add(s.playerId)
    return true
  })
  while (starters.length < 11) {
    const cand = avail.find((p) => !seen.has(p.id))
    if (!cand) break
    seen.add(cand.id)
    starters.push({ playerId: cand.id, slot: starters.length, player: cand })
  }
  const benchIds = lineup.bench.filter((pid) => !seen.has(pid))
  const bench = benchIds.map((pid) => byId.get(pid)).filter((p) => p && !p.injuredUntil && p.suspension <= 0)
  if (!persist) {
    // AI managers rotate tired players instead of running the same XI into the ground.
    const pool = squad.filter((p) => !p.injuredUntil && p.suspension <= 0)
    for (let i = 0; i < starters.length; i++) {
      const st = starters[i]
      const p = st.player
      if (!p || (p.fitness ?? 100) >= 84) continue
      const slotPos = slots[st.slot]?.pos
      let best = null
      let bestScore = effectiveRating(p, slotPos)
      for (const c of pool) {
        if (seen.has(c.id)) continue
        const sc = effectiveRating(c, slotPos)
        if (sc > bestScore + 1.0) { bestScore = sc; best = c }
      }
      if (best) {
        seen.delete(p.id)
        seen.add(best.id)
        starters[i] = { playerId: best.id, slot: st.slot, player: best }
      }
    }
  }
  return { club, squad, byId, tactics, slots, starters, bench, subsUsed: 0 }
}

function ensure(saveId, clubId, squad, tactics, slots) {
  const lineup = getLineup(saveId, clubId)
  const byId = new Map(squad.map((p) => [p.id, p]))
  const invalid = lineup.starters.length !== 11 || lineup.starters.some((s) => {
    const p = byId.get(s.playerId)
    return !p || p.injuredUntil || p.suspension > 0
  })
  if (!invalid) return lineup
  const auto = autoLineup(squad, tactics.formation)
  saveLineup(saveId, clubId, auto.starters, auto.bench)
  return auto
}

function mkSide(team, side) {
  return {
    side,
    clubId: team.club.id,
    name: team.club.name,
    short: team.club.short,
    color1: team.club.color1,
    color2: team.club.color2,
    reputation: team.club.reputation,
    tactics: team.tactics,
    formation: team.tactics.formation,
    starters: team.starters.map((s) => ({ playerId: s.playerId, slot: s.slot })),
    bench: team.bench.map((p) => p.id),
    squad: Object.fromEntries(team.squad.map((p) => [p.id, p])),
    subsUsed: 0,
    score: 0,
    stats: { shots: 0, sot: 0, corners: 0, fouls: 0, yellow: 0, red: 0, xg: 0, poss: 50 },
    ratings: {},
    played: {},
  }
}

export function buildMatchState(saveId, fixture, { persist = false } = {}) {
  const userClubId = getSave(saveId)?.club_id
  const home = loadTeam(saveId, fixture.home_id, { persist: persist && fixture.home_id === userClubId })
  const away = loadTeam(saveId, fixture.away_id, { persist: persist && fixture.away_id === userClubId })
  if (!home || !away) throw new Error('Missing team')
  const h = mkSide(home, 'home')
  const a = mkSide(away, 'away')
  for (const p of [...home.starters.map((s) => s.player), ...home.bench]) h.ratings[p.id] = 6.3
  for (const p of [...away.starters.map((s) => s.player), ...away.bench]) a.ratings[p.id] = 6.3
  const state = {
    fixtureId: fixture.id,
    competition: fixture.competition,
    season: fixture.season,
    minute: 0,
    home: h,
    away: a,
    events: [],
    injuries: [],
    finished: false,
    neutral: !!fixture.neutral,
  }
  const sh = teamStrength(home.starters.map((s) => s.player).map((p, i) => ({ ...p, slot: home.starters[i].slot })), home.slots, h.tactics)
  const sa = teamStrength(away.starters.map((s) => s.player).map((p, i) => ({ ...p, slot: away.starters[i].slot })), away.slots, a.tactics)
  const poss = clamp(50 + (sh.mid - sa.mid) * 1.35 + ((h.tactics.tempo || 3) - (a.tactics.tempo || 3)) * 1.5, 30, 70)
  h.stats.poss = Math.round(poss)
  a.stats.poss = 100 - Math.round(poss)
  state.events.push({ minute: 0, type: 'kickoff', club: null, text: `Kick-off at ${fixture.stadium || 'the stadium'}: ${h.name} vs ${a.name}.` })
  return state
}

function sidePlayers(state, side) {
  const s = state[side]
  return s.starters.map((st) => ({ ...s.squad[st.playerId], slot: st.slot })).filter((p) => p && p.id)
}

function currentStrength(state, side) {
  const s = state[side]
  const slots = formationSlots(s.tactics.formation)
  return teamStrength(sidePlayers(state, side), slots, s.tactics)
}

function addRating(state, side, playerId, delta) {
  const s = state[side]
  if (s.ratings[playerId] == null) return
  s.ratings[playerId] = clamp(s.ratings[playerId] + delta, 3.5, 10)
}

function event(state, minute, type, club, text, extra = {}) {
  const e = { minute, type, club, text, ...extra }
  state.events.push(e)
  return e
}

function scorerCandidates(state, side) {
  return sidePlayers(state, side).filter((p) => p.position !== 'GK')
}

function doGoal(state, minute, side) {
  const s = state[side]
  const opp = side === 'home' ? 'away' : 'home'
  const cands = scorerCandidates(state, side)
  if (!cands.length) return
  const scorer = weightedPick(cands, scoreWeight)
  const assistPool = cands.filter((p) => p.id !== scorer.id)
  const assister = assistPool.length && Math.random() < 0.72 ? weightedPick(assistPool, assistWeight) : null
  s.score++
  s.stats.shots++
  s.stats.sot++
  s.stats.xg = Math.round((s.stats.xg + rand(0.12, 0.55)) * 100) / 100
  addRating(state, side, scorer.id, 1.15)
  if (assister) addRating(state, side, assister.id, 0.7)
  for (const p of sidePlayers(state, opp)) {
    if (p.position === 'GK') addRating(state, opp, p.id, -0.22)
    else if (POSITION_GROUP[p.position] === 'DEF') addRating(state, opp, p.id, -0.14)
  }
  event(state, minute, 'goal', side, `GOAL! ${scorer.name} scores for ${s.name}${assister ? `, assisted by ${assister.name}` : ''}.`, {
    playerId: scorer.id, playerName: scorer.name, assistId: assister?.id, assistName: assister?.name,
    score: [state.home.score, state.away.score],
  })
}

function doShot(state, minute, side, onTarget) {
  const s = state[side]
  const cands = scorerCandidates(state, side)
  if (!cands.length) return
  const shooter = weightedPick(cands, scoreWeight)
  s.stats.shots++
  s.stats.xg = Math.round((s.stats.xg + rand(0.03, 0.22)) * 100) / 100
  if (onTarget) {
    s.stats.sot++
    const gk = sidePlayers(state, side === 'home' ? 'away' : 'home').find((p) => p.position === 'GK')
    if (gk) addRating(state, side === 'home' ? 'away' : 'home', gk.id, 0.14)
    event(state, minute, 'save', side, `${shooter.name} tests the keeper${gk ? `, ${gk.name} saves` : ''}.`, { playerId: shooter.id, playerName: shooter.name })
  } else {
    event(state, minute, 'shot', side, `${shooter.name} fires off target for ${s.name}.`, { playerId: shooter.id, playerName: shooter.name })
  }
}

function doCard(state, minute, side) {
  const s = state[side]
  const cands = sidePlayers(state, side).filter((p) => p.position !== 'GK')
  if (!cands.length) return
  const p = weightedPick(cands, (x) => 100 - (x.attrs?.composure ?? 60) + (x.attrs?.aggression ?? 60) * 0.4)
  s.stats.fouls++
  const red = Math.random() < 0.012
  if (red) {
    s.stats.red++
    addRating(state, side, p.id, -1.1)
    s.starters = s.starters.filter((st) => st.playerId !== p.id)
    event(state, minute, 'red', side, `RED CARD! ${p.name} is sent off for ${s.name}.`, { playerId: p.id, playerName: p.name })
  } else if (Math.random() < 0.19) {
    s.stats.yellow++
    addRating(state, side, p.id, -0.25)
    event(state, minute, 'yellow', side, `Yellow card for ${p.name} (${s.name}).`, { playerId: p.id, playerName: p.name })
  } else {
    event(state, minute, 'foul', side, `Foul by ${p.name}.`, { playerId: p.id, playerName: p.name })
  }
}

function doInjury(state, minute, side) {
  const s = state[side]
  const cands = sidePlayers(state, side).filter((p) => p.position !== 'GK')
  if (!cands.length) return
  const p = weightedPick(cands, (x) => 40 + (100 - (x.fitness ?? 100)) * 4)
  const weeks = Math.random() < 0.6 ? 1 : Math.random() < 0.8 ? 3 : 6
  if (s.squad[p.id]) s.squad[p.id].__injury = { weeks }
  state.injuries.push({ playerId: p.id, clubId: s.clubId, name: p.name, weeks })
  addRating(state, side, p.id, -0.3)
  event(state, minute, 'injury', side, `${p.name} pulls up injured and cannot continue.`, { playerId: p.id, playerName: p.name })
  if (s.bench.length && s.subsUsed < 5) {
    const sub = s.bench.shift()
    const slot = s.starters.find((st) => st.playerId === p.id)?.slot ?? 0
    s.starters = s.starters.filter((st) => st.playerId !== p.id)
    s.starters.push({ playerId: sub.id, slot })
    s.ratings[sub.id] = 6.2
    s.subsUsed++
    s.played[sub.id] = true
    event(state, minute, 'sub', side, `${sub.name} replaces ${p.name}.`, { playerId: sub.id, playerName: sub.name })
  }
}

function aiSubs(state, minute, side) {
  const s = state[side]
  if (s.subsUsed >= 5 || !s.bench.length || minute < 55) return
  const losing = s.score < (side === 'home' ? state.away.score : state.home.score)
  const wantSub = (losing && minute > 62) || minute > 74 || Math.random() < 0.03
  if (!wantSub) return
  const starters = sidePlayers(state, side)
  const tired = starters.filter((p) => (p.fitness ?? 100) < 78 || (p.position !== 'GK' && Math.random() < 0.15))
  const outP = tired.length ? pick(tired) : null
  const sub = s.bench.shift()
  if (!sub) return
  const slot = outP ? s.starters.find((st) => st.playerId === outP.id)?.slot ?? 0 : s.starters.find((st) => s.squad[st.playerId]?.position === 'GK')?.slot ?? 0
  if (outP) s.starters = s.starters.filter((st) => st.playerId !== outP.id)
  s.starters.push({ playerId: sub.id, slot })
  s.ratings[sub.id] = 6.2
  s.played[sub.id] = true
  s.subsUsed++
  if (outP) s.played[outP.id] = true
  event(state, minute, 'sub', side, `${sub.name} comes on for ${outP ? outP.name : s.name}.`, { playerId: sub.id, playerName: sub.name })
}

export function tickMatch(state, minutes = 1) {
  if (state.finished) return state
  const target = Math.min(90, state.minute + minutes)
  for (let m = state.minute + 1; m <= target; m++) {
    state.minute = m
    if (m === 45) {
      event(state, 45, 'ht', null, `Half-time: ${state.home.name} ${state.home.score} - ${state.away.score} ${state.away.name}.`)
      continue
    }
    if (m === 90) break
    const sh = currentStrength(state, 'home')
    const sa = currentStrength(state, 'away')
    const homeAdv = state.neutral ? 0 : 1.0
    const atkH = attackScore(sh) + homeAdv
    const atkA = attackScore(sa)
    const defH = defenceScore(sh) + homeAdv * 0.6
    const defA = defenceScore(sa)
    const lamH = clamp(1.34 * Math.exp((atkH - defA) / 22.0) * 1.03, 0.14, 4.2)
    const lamA = clamp(1.30 * Math.exp((atkA - defH) / 22.0) * 0.96, 0.12, 4.0)

    // fatigue accumulates through the match
    const fatH = 1 + (m > 60 ? (m - 60) / 170 : 0)
    const pGoalH = (lamH / 90) * fatH
    const pGoalA = (lamA / 90) * fatH
    const r = Math.random()
    if (r < pGoalH) doGoal(state, m, 'home')
    else if (r < pGoalH + pGoalA) doGoal(state, m, 'away')
    else {
      const shotH = (lamH * 6.2) / 90
      const shotA = (lamA * 6.2) / 90
      const s = Math.random()
      if (s < shotH) doShot(state, m, 'home', Math.random() < 0.42)
      else if (s < shotH + shotA) doShot(state, m, 'away', Math.random() < 0.42)
      else if (Math.random() < 0.14) {
        const side = Math.random() < 0.5 ? 'home' : 'away'
        doCard(state, m, side)
      } else if (Math.random() < 0.005) {
        doInjury(state, m, Math.random() < 0.5 ? 'home' : 'away')
      } else if (Math.random() < 0.05) {
        aiSubs(state, m, Math.random() < 0.5 ? 'home' : 'away')
      }
    }
    if (m === 45) {
      event(state, 45, 'ht', null, `Half-time: ${state.home.name} ${state.home.score} - ${state.away.score} ${state.away.name}.`)
    }
  }
  if (target >= 90) {
    state.finished = true
    event(state, 90, 'ft', null, `Full-time: ${state.home.name} ${state.home.score} - ${state.away.score} ${state.away.name}.`)
  }
  return state
}

export function publicState(state, { reveal = true } = {}) {
  const side = (s) => ({
    clubId: s.clubId, name: s.name, short: s.short, color1: s.color1, color2: s.color2,
    score: s.score, formation: s.tactics.formation, subsUsed: s.subsUsed,
    stats: s.stats,
    tactics: s.tactics,
    starters: s.starters.map((st) => {
      const p = s.squad[st.playerId]
      return p ? { id: p.id, name: p.name, position: p.position, slot: st.slot, ovr: p.ovr, fitness: p.fitness, rating: Math.round((s.ratings[p.id] || 6.2) * 10) / 10, number: p.squadNumber } : null
    }).filter(Boolean),
    bench: s.bench.map((id) => {
      const p = s.squad[id]
      return p ? { id: p.id, name: p.name, position: p.position, ovr: p.ovr, fitness: p.fitness, number: p.squadNumber } : null
    }).filter(Boolean),
  })
  return {
    fixtureId: state.fixtureId,
    competition: state.competition,
    minute: state.minute,
    finished: state.finished,
    home: side(state.home),
    away: side(state.away),
    events: reveal ? state.events : state.events.filter((e) => ['goal', 'ht', 'ft', 'red'].includes(e.type)),
  }
}

export function applyResult(saveId, fixture, state) {
  const season = fixture.season
  const save = getSave(saveId)
  const date = save.date
  const homeScore = state.home.score
  const awayScore = state.away.score
  const poss = state.home.stats.poss
  const stats = { home: state.home.stats, away: state.away.stats, possession: [poss, 100 - poss] }
  db.prepare('UPDATE fixtures SET played=1, home_goals=?, away_goals=?, events=?, stats=?, attendance=? WHERE save_id=? AND id=?')
    .run(homeScore, awayScore, JSON.stringify(state.events), JSON.stringify(stats), state.attendance || 0, saveId, fixture.id)

  const upsert = db.prepare(`INSERT INTO stats (save_id,player_id,season,apps,starts,goals,assists,minutes,rating_sum,yellow,red,clean_sheets)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(save_id,player_id,season) DO UPDATE SET
      apps=apps+excluded.apps, starts=starts+excluded.starts, goals=goals+excluded.goals, assists=assists+excluded.assists,
      minutes=minutes+excluded.minutes, rating_sum=rating_sum+excluded.rating_sum, yellow=yellow+excluded.yellow,
      red=red+excluded.red, clean_sheets=clean_sheets+excluded.clean_sheets`)
  const updatePlayer = db.prepare('UPDATE players SET fitness=?, morale=?, form=?, injured_until=?, injury_type=?, suspension=? WHERE save_id=? AND id=?')
  const goalMap = {}
  const assistMap = {}
  const cardMap = {}
  for (const e of state.events) {
    if (e.type === 'goal' && e.playerId) goalMap[e.playerId] = (goalMap[e.playerId] || 0) + 1
    if (e.type === 'goal' && e.assistId) assistMap[e.assistId] = (assistMap[e.assistId] || 0) + 1
    if (e.type === 'yellow' && e.playerId) cardMap[e.playerId] = { y: (cardMap[e.playerId]?.y || 0) + 1, r: cardMap[e.playerId]?.r || 0 }
    if (e.type === 'red' && e.playerId) cardMap[e.playerId] = { y: cardMap[e.playerId]?.y || 0, r: 1 }
  }
  const userClub = save.club_id
  const injuredList = []
  for (const side of ['home', 'away']) {
    const s = state[side]
    const isHome = side === 'home'
    const gf = isHome ? homeScore : awayScore
    const ga = isHome ? awayScore : homeScore
    const result = gf > ga ? 1 : gf < ga ? -1 : 0
    const concededZero = ga === 0
    for (const st of s.starters) {
      const p = s.squad[st.playerId]
      if (!p) continue
      const rating = clamp((s.ratings[p.id] || 6.2) + (result > 0 ? 0.18 : result < 0 ? -0.12 : 0), 3.5, 10)
      const minutes = st.__minutes ?? 90
      const cs = concededZero && minutes >= 60 && ['GK', 'DEF'].includes(POSITION_GROUP[p.position]) ? 1 : 0
      upsert.run(saveId, p.id, season, 1, 1, goalMap[p.id] || 0, assistMap[p.id] || 0, minutes,
        Math.round(rating * 10) / 10, cardMap[p.id]?.y || 0, cardMap[p.id]?.r || 0, cs)
      const fatigue = 4 + (s.tactics.pressing ?? 3) * 0.9 + (s.tactics.tempo ?? 3) * 0.6 + rand(-1, 2)
      const newFit = clamp(Math.round((p.fitness ?? 100) - fatigue), 18, 100)
      const moraleDelta = result > 0 ? 2 : result < 0 ? -2 : 0
      const newMorale = clamp(Math.round((p.morale ?? 75) + moraleDelta + (rating - 6.8) * 1.2), 25, 95)
      const newForm = clamp((p.form ?? 0) * 0.8 + (rating - 6.9) * 0.5, -1.5, 1.5)
      let injuredUntil = p.injuredUntil || null
      let injuryType = p.injuryType || null
      if (p.__injury) {
        const days = p.__injury.weeks * 7 + Math.floor(rand(0, 6))
        const d = new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000)
        injuredUntil = d.toISOString().slice(0, 10)
        injuryType = p.__injury.weeks >= 4 ? 'Long-term injury' : p.__injury.weeks >= 2 ? 'Muscle injury' : 'Knock'
        injuredList.push({ clubId: s.clubId, playerId: p.id, name: p.name, until: injuredUntil, type: injuryType })
        db.prepare('INSERT INTO injury_history (save_id,player_id,date,type,days) VALUES (?,?,?,?,?)')
          .run(saveId, p.id, date, injuryType, days)
      }
      const susp = cardMap[p.id]?.r ? 1 + (Math.random() < 0.35 ? 1 : 0) : Math.max(0, (p.suspension || 0) - (p.suspension > 0 ? 1 : 0))
      updatePlayer.run(newFit, newMorale, Math.round(newForm * 100) / 100, injuredUntil, injuryType, susp, saveId, p.id)
    }
    for (const pid of Object.keys(s.played)) {
      if (s.starters.some((st) => st.playerId === Number(pid))) continue
      const p = s.squad[pid]
      if (!p) continue
      const rating = s.ratings[p.id] || 6.2
      upsert.run(saveId, p.id, season, 1, 0, goalMap[p.id] || 0, assistMap[p.id] || 0, 25, Math.round(rating * 10) / 10,
        cardMap[p.id]?.y || 0, cardMap[p.id]?.r || 0, 0)
      updatePlayer.run(clamp(Math.round((p.fitness ?? 100) - 4), 20, 100), clamp(Math.round((p.morale ?? 75) + (result > 0 ? 2 : -1)), 25, 95),
        Math.round(clamp((p.form ?? 0) * 0.9 + (rating - 6.8) * 0.35, -1.5, 1.5) * 100) / 100, p.injuredUntil || null, p.injuryType || null, p.suspension || 0, saveId, p.id)
    }
    // suspensions tick down for players who were already suspended
    db.prepare('UPDATE players SET suspension = MAX(0, suspension - 1) WHERE save_id=? AND club_id=? AND suspension>0 AND id NOT IN (SELECT player_id FROM lineups WHERE save_id=? AND club_id=? AND slot<20)')
      .run(saveId, s.clubId, saveId, s.clubId)
  }

  // finances + attendance
  const homeClub = getClubRow(saveId, fixture.home_id)
  const fill = clamp(0.68 + homeClub.reputation * 0.028 + rand(-0.05, 0.06), 0.45, 0.99)
  const attendance = Math.round(homeClub.capacity * fill)
  const ticket = 22 + homeClub.reputation * 4
  const gate = Math.round(attendance * ticket)
  db.prepare('UPDATE fixtures SET attendance=? WHERE save_id=? AND id=?').run(attendance, saveId, fixture.id)
  db.prepare('UPDATE clubs SET balance = balance + ? WHERE save_id=? AND id=?').run(gate, saveId, fixture.home_id)
  db.prepare('INSERT INTO finances (save_id,club_id,date,season,type,description,amount) VALUES (?,?,?,?,?,?,?)')
    .run(saveId, fixture.home_id, date, season, 'Matchday', `Gate receipts vs ${state.away.short}`, gate)

  // board confidence for user's club
  if (userClub === fixture.home_id || userClub === fixture.away_id) {
    const isHome = userClub === fixture.home_id
    const gf = isHome ? homeScore : awayScore
    const ga = isHome ? awayScore : homeScore
    const delta = gf > ga ? 2 : gf < ga ? -2 : 0
    db.prepare('UPDATE clubs SET board_confidence = MAX(5, MIN(100, board_confidence + ?)) WHERE save_id=? AND id=?').run(delta, saveId, userClub)
    const user = getClubRow(saveId, userClub)
    const opp = getClubRow(saveId, isHome ? fixture.away_id : fixture.home_id)
    addNews(saveId, {
      date, type: 'result', clubId: userClub,
      title: `${user.short} ${gf}-${ga} ${opp.short}`,
      body: `${user.name} ${gf > ga ? 'beat' : gf < ga ? 'lost to' : 'drew with'} ${opp.name} ${gf}-${ga} in the ${fixture.competition}.`,
    })
  }
  for (const inj of state.injuries || []) {
    const days = inj.weeks * 7 + Math.floor(rand(0, 6))
    const until = new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10)
    const type = inj.weeks >= 4 ? 'Long-term injury' : inj.weeks >= 2 ? 'Muscle injury' : 'Knock'
    db.prepare('UPDATE players SET injured_until=?, injury_type=? WHERE save_id=? AND id=?').run(until, type, saveId, inj.playerId)
    db.prepare('INSERT INTO injury_history (save_id,player_id,date,type,days) VALUES (?,?,?,?,?)').run(saveId, inj.playerId, date, type, days)
    if (inj.clubId === userClub) {
      addNews(saveId, { date, type: 'injury', clubId: userClub, title: `${inj.name} injured`, body: `${inj.name} has suffered a ${type.toLowerCase()} and is expected to be out until ${until}.` })
    }
  }
  for (const inj of injuredList) {
    if (inj.clubId === userClub) {
      addNews(saveId, { date, type: 'injury', clubId: userClub, title: `${inj.name} injured`, body: `${inj.name} has suffered a ${inj.type.toLowerCase()} and is expected to be out until ${inj.until}.` })
    }
  }
  state.attendance = attendance
  return { homeScore, awayScore }
}

export function simulateFixture(saveId, fixture, { persist = false } = {}) {
  const state = buildMatchState(saveId, fixture, { persist })
  tickMatch(state, 90)
  applyResult(saveId, fixture, state)
  return state
}

export function startLiveMatch(saveId, fixture) {
  const existing = db.prepare('SELECT state FROM live_matches WHERE save_id=? AND fixture_id=?').get(saveId, fixture.id)
  if (existing) return JSON.parse(existing.state)
  const state = buildMatchState(saveId, fixture, { persist: true })
  db.prepare('INSERT OR REPLACE INTO live_matches (save_id,fixture_id,state) VALUES (?,?,?)').run(saveId, fixture.id, JSON.stringify(state))
  return state
}

export function saveLiveMatch(saveId, fixtureId, state) {
  db.prepare('INSERT OR REPLACE INTO live_matches (save_id,fixture_id,state) VALUES (?,?,?)').run(saveId, fixtureId, JSON.stringify(state))
}

export function tickLiveMatch(saveId, fixture, minutes) {
  const state = startLiveMatch(saveId, fixture)
  tickMatch(state, minutes)
  if (state.finished) {
    applyResult(saveId, fixture, state)
    db.prepare('DELETE FROM live_matches WHERE save_id=? AND fixture_id=?').run(saveId, fixture.id)
  } else {
    saveLiveMatch(saveId, fixture.id, state)
  }
  return state
}

export function makeSub(state, side, outId, inId) {
  const s = state[side]
  if (!s || s.subsUsed >= 5) return { ok: false, message: 'No substitutions remaining.' }
  const slot = s.starters.find((st) => st.playerId === Number(outId))
  if (!slot) return { ok: false, message: 'Player is not on the pitch.' }
  const idx = s.bench.indexOf(Number(inId))
  if (idx < 0) return { ok: false, message: 'Player is not on the bench.' }
  const sub = s.squad[inId]
  s.starters = s.starters.filter((st) => st.playerId !== Number(outId))
  s.starters.push({ playerId: Number(inId), slot: slot.slot })
  s.bench.splice(idx, 1)
  s.ratings[inId] = 6.2
  s.played[inId] = true
  s.played[outId] = true
  s.subsUsed++
  event(state, state.minute, 'sub', side, `${sub.name} replaces ${s.squad[outId]?.name}.`, { playerId: Number(inId), playerName: sub.name })
  return { ok: true }
}
