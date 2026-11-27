import { db } from '../db.js'
import { getSave, getPlayerRow, getClubRow, getSquad, addNews, playerOut } from './world.js'
import { POSITION_GROUP, roleWeight } from './positions.js'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const rand = (a = 0, b = 1) => a + Math.random() * (b - a)

export const WAGE_TABLE = [[55, 3000], [60, 5000], [62, 7000], [64, 10000], [66, 14000], [68, 19000], [70, 26000], [72, 35000],
  [74, 48000], [76, 65000], [78, 85000], [80, 110000], [82, 135000], [84, 170000], [86, 210000], [88, 260000], [90, 330000], [92, 400000], [95, 500000]]

function interp(table, x) {
  if (x <= table[0][0]) return table[0][1]
  if (x >= table[table.length - 1][0]) return table[table.length - 1][1]
  for (let i = 0; i < table.length - 1; i++) {
    const [x0, y0] = table[i]
    const [x1, y1] = table[i + 1]
    if (x >= x0 && x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
  }
  return table[table.length - 1][1]
}

export const LEAGUE_FACTOR = {
  'premier-league': 1.15, 'la-liga': 1.0, bundesliga: 0.95, 'serie-a': 0.92, 'ligue-1': 0.85,
  championship: 0.34, 'la-liga-2': 0.22, 'bundesliga-2': 0.3, 'serie-b': 0.22, 'ligue-2': 0.2,
}

export function marketValue(ovr, age, pot, contractYears) {
  const ageMult = age <= 20 ? 1.65 : age <= 22 ? 1.5 : age <= 24 ? 1.35 : age <= 27 ? 1.15 : age <= 29 ? 0.95 : age <= 31 ? 0.7 : age <= 33 ? 0.45 : 0.25
  const potMult = 1 + Math.max(0, pot - ovr) * 0.011
  const contractMult = contractYears <= 1 ? 0.72 : contractYears === 2 ? 0.9 : 1.05
  const base = 1.15e6 * Math.pow(1.158, ovr - 60) * ageMult * potMult * contractMult
  return Math.max(120000, Math.round(base / 100000) * 100000)
}

export function wageExpectation(player, club) {
  const lg = LEAGUE_FACTOR[club?.league_id] || 0.9
  const repf = 0.8 + (club?.reputation || 5) * 0.04
  const base = interp(WAGE_TABLE, player.ovr) * lg * repf
  const roleMult = player.squad_role ? 0.85 + roleWeight(player.squad_role) * 0.35 : 1
  return Math.max(1500, Math.round((base * roleMult) / 500) * 500)
}

export function isWindowOpen(date) {
  const m = Number(date.slice(5, 7))
  const d = Number(date.slice(8, 10))
  if (m === 7 || m === 8) return true
  if (m === 9 && d <= 1) return true
  if (m === 1) return true
  return false
}

export function contractYearsLeft(player, season) {
  return Math.max(0, (player.contract_end || season) - season)
}

export function executeTransfer(saveId, playerId, toClubId, { fee = 0, wage, years = 3, type = 'transfer', date, season }) {
  const player = getPlayerRow(saveId, playerId)
  if (!player) return null
  const fromClub = player.club_id
  const toClub = getClubRow(saveId, toClubId)
  const newWage = wage || Math.round(wageExpectation({ ...player, ovr: player.ovr }, toClub))
  db.prepare('UPDATE players SET club_id=?, wage=?, contract_start=?, contract_end=?, is_youth=0, transfer_listed=0, squad_role=? WHERE save_id=? AND id=?')
    .run(toClubId, newWage, date, season + years, player.squad_role || 'Squad Player', saveId, playerId)
  if (fee > 0 && fromClub) {
    db.prepare('UPDATE clubs SET transfer_budget = transfer_budget + ?, balance = balance + ? WHERE save_id=? AND id=?').run(fee, fee, saveId, fromClub)
    db.prepare('UPDATE clubs SET transfer_budget = MAX(0, transfer_budget - ?), balance = balance - ? WHERE save_id=? AND id=?').run(fee, fee, saveId, toClubId)
    db.prepare('INSERT INTO finances (save_id,club_id,date,season,type,description,amount) VALUES (?,?,?,?,?,?,?)')
      .run(saveId, toClubId, date, season, 'Transfer', `Signed ${player.name} from ${fromClub}`, -fee)
    db.prepare('INSERT INTO finances (save_id,club_id,date,season,type,description,amount) VALUES (?,?,?,?,?,?,?)')
      .run(saveId, fromClub, date, season, 'Transfer', `Sold ${player.name} to ${toClub.name}`, fee)
  }
  db.prepare('INSERT INTO transfers (save_id,player_id,player_name,from_club,to_club,fee,wage,type,date,season) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(saveId, playerId, player.name, fromClub, toClubId, fee, newWage, type, date, season)
  // squad number for new club
  const used = new Set(db.prepare('SELECT squad_number FROM players WHERE save_id=? AND club_id=?').all(saveId, toClubId).map((r) => r.squad_number))
  let num = 2
  while (used.has(num)) num++
  db.prepare('UPDATE players SET squad_number=? WHERE save_id=? AND id=?').run(num, saveId, playerId)
  return { player, fromClub, toClub }
}

function playerWantsMove(player, toClub, wage, role) {
  const expected = wageExpectation(player, toClub)
  const wageScore = clamp(wage / expected, 0.5, 1.5)
  const roleScore = 0.75 + roleWeight(role || player.squad_role) * 0.5
  const ambition = toClub.reputation >= 8 ? 1.08 : toClub.reputation >= 6 ? 1.0 : 0.94
  const score = wageScore * roleScore * ambition
  return { score, expected, accepted: score >= 0.97 }
}

export function evaluateTransferOffer(saveId, { playerId, fee, wage, years, role, includePlayerId }) {
  const save = getSave(saveId)
  const player = getPlayerRow(saveId, playerId)
  if (!player) return { accepted: false, message: 'Player not found.' }
  const seller = getClubRow(saveId, player.club_id)
  const buyer = getClubRow(saveId, save.club_id)
  const yearsLeft = contractYearsLeft(player, save.season)
  const value = marketValue(player.ovr, player.age, player.pot, yearsLeft)
  const clause = player.release_clause
  let required = value
  if (player.squad_role === 'Star Player') required *= 1.55
  else if (player.squad_role === 'Important Player') required *= 1.3
  if (yearsLeft <= 1) required *= 0.8
  if (player.transfer_listed) required *= 0.85
  const swapPlayer = includePlayerId ? getPlayerRow(saveId, includePlayerId) : null
  const swapValue = swapPlayer ? marketValue(swapPlayer.ovr, swapPlayer.age, swapPlayer.pot, contractYearsLeft(swapPlayer, save.season)) * 0.9 : 0
  const total = (fee || 0) + swapValue
  const clauseMet = clause && fee >= clause
  if (total < required * 0.88 && !clauseMet) {
    return {
      accepted: false,
      message: `${seller.name} rejected the offer. They value ${player.name} at around £${Math.round(required / 1e6)}m.`,
      counter: { fee: Math.round(required / 1e5) * 1e5, wage: Math.round(wageExpectation(player, buyer)) },
      stage: 'club',
    }
  }
  if (player.club_id === buyer.id) return { accepted: false, message: 'Player is already at your club.' }
  const wants = playerWantsMove(player, buyer, wage || 0, role)
  if (!wants.accepted) {
    return {
      accepted: false,
      message: `${player.name} rejected the personal terms. He expects around £${Math.round(wants.expected / 1000)}k per week.`,
      counter: { fee: Math.round(Math.max(fee, required * 0.95) / 1e5) * 1e5, wage: Math.round(wants.expected / 500) * 500 },
      stage: 'player',
    }
  }
  if (fee > buyer.transfer_budget) {
    return { accepted: false, message: 'The fee exceeds your transfer budget.', stage: 'budget' }
  }
  const res = executeTransfer(saveId, playerId, buyer.id, {
    fee: Math.round(fee), wage: Math.round(wage), years: years || 3, type: 'transfer',
    date: save.date, season: save.season,
  })
  if (swapPlayer) {
    executeTransfer(saveId, swapPlayer.id, seller.id, { fee: 0, wage: swapPlayer.wage, years: 2, type: 'swap', date: save.date, season: save.season })
  }
  addNews(saveId, {
    date: save.date, type: 'transfer', clubId: buyer.id,
    title: `${player.name} signs for ${buyer.short}`,
    body: `${buyer.name} have completed the signing of ${player.name} from ${seller.name} for £${(fee / 1e6).toFixed(1)}m.`,
  })
  return { accepted: true, message: `${player.name} has joined ${buyer.name} for £${(fee / 1e6).toFixed(1)}m.`, transfer: res }
}

export function evaluateContractOffer(saveId, { playerId, wage, years, role, releaseClause }) {
  const save = getSave(saveId)
  const player = getPlayerRow(saveId, playerId)
  const club = getClubRow(saveId, player?.club_id)
  if (!player || !club) return { accepted: false, message: 'Player not found.' }
  const expected = wageExpectation(player, club)
  const roleMult = 0.9 + roleWeight(role) * 0.28
  const ambition = club.reputation >= 8 ? 1.04 : club.reputation >= 6 ? 1 : 0.96
  const ageDemand = player.age >= 31 ? 1.06 : player.age <= 23 ? 0.95 : 1
  const demand = expected * roleMult * ambition * ageDemand
  const lengthOk = years >= (player.age >= 31 ? 1 : 2)
  const wageOk = wage >= demand * 0.94
  const moraleBoost = (player.morale || 75) >= 80 ? 0.96 : 1
  if (!wageOk || !lengthOk) {
    return {
      accepted: false,
      message: `${player.name} rejected the offer. He is looking for around £${Math.round(demand / 1000)}k per week${player.age >= 31 ? ' on a shorter deal' : ''}.`,
      counter: { wage: Math.round((demand * moraleBoost) / 500) * 500, years: player.age >= 31 ? 2 : Math.max(2, years) },
    }
  }
  db.prepare('UPDATE players SET wage=?, contract_start=?, contract_end=?, squad_role=?, release_clause=?, morale=? WHERE save_id=? AND id=?')
    .run(Math.round(wage), save.date, save.season + years, role, releaseClause || null, clamp((player.morale || 75) + 6, 10, 100), saveId, playerId)
  addNews(saveId, {
    date: save.date, type: 'contract', clubId: club.id,
    title: `${player.name} signs new contract`,
    body: `${player.name} has committed to ${club.name} until ${save.season + years}, earning £${Math.round(wage / 1000)}k per week.`,
  })
  return { accepted: true, message: `${player.name} signed a new ${years}-year deal worth £${Math.round(wage / 1000)}k per week.` }
}

export function releasePlayer(saveId, playerId) {
  const save = getSave(saveId)
  const p = getPlayerRow(saveId, playerId)
  if (!p) return
  db.prepare('UPDATE players SET club_id=NULL, contract_end=?, squad_role=? WHERE save_id=? AND id=?').run(save.season, 'Free Agent', saveId, playerId)
  addNews(saveId, { date: save.date, type: 'transfer', clubId: save.club_id, title: `${p.name} released`, body: `${p.name} has left the club and is now a free agent.` })
}

export function promoteYouth(saveId, playerId) {
  const save = getSave(saveId)
  const p = getPlayerRow(saveId, playerId)
  if (!p) return
  db.prepare('UPDATE players SET is_youth=0, squad_role=? WHERE save_id=? AND id=?').run('Prospect', saveId, playerId)
  addNews(saveId, { date: save.date, type: 'youth', clubId: save.club_id, title: `${p.name} promoted`, body: `${p.name} has been promoted to the senior squad.` })
}

export function aiTransferTick(saveId, maxDeals = 8) {
  const save = getSave(saveId)
  if (!isWindowOpen(save.date)) return 0
  const clubs = db.prepare('SELECT * FROM clubs WHERE save_id=?').all(saveId)
  const userClub = save.club_id
  const freeAgents = db.prepare('SELECT * FROM players WHERE save_id=? AND club_id IS NULL ORDER BY ovr DESC LIMIT 60').all(saveId)
  const pool = db.prepare(`SELECT p.*, c.reputation as club_rep, c.league_id as club_league FROM players p JOIN clubs c ON c.save_id=p.save_id AND c.id=p.club_id
    WHERE p.save_id=? AND p.club_id IS NOT NULL AND p.is_youth=0 AND p.age<=31 AND p.ovr>=60 AND p.club_id!=?`).all(saveId, userClub)
  const squads = {}
  for (const c of clubs) squads[c.id] = []
  for (const p of db.prepare('SELECT club_id, id, position, ovr FROM players WHERE save_id=? AND is_youth=0 AND club_id IS NOT NULL').all(saveId)) {
    ;(squads[p.club_id] ||= []).push(p)
  }
  let deals = 0
  const usedFree = new Set()
  const shuffled = [...clubs].sort(() => Math.random() - 0.5)
  for (const club of shuffled) {
    if (deals >= maxDeals) break
    if (club.id === userClub) continue
    const squad = squads[club.id] || []
    if (squad.length >= 30) continue
    const groups = { GK: 0, DEF: 0, MID: 0, ATT: 0 }
    for (const p of squad) groups[POSITION_GROUP[p.position]]++
    const targetOvr = 56 + club.reputation * 3.1
    const needs = []
    if (groups.GK < 2) needs.push('GK')
    if (groups.DEF < 6) needs.push('DEF')
    if (groups.MID < 5) needs.push('MID')
    if (groups.ATT < 3) needs.push('ATT')
    if (!needs.length && Math.random() < 0.25) {
      const weakest = Object.entries(groups).sort((a, b) => a[1] - b[1])[0]
      needs.push(weakest[0])
    }
    if (!needs.length) {
      // upgrade opportunity: a free agent clearly better than the weakest starter
      if (freeAgents.length && Math.random() < 0.4) {
        const weakest = [...squad].sort((a, b) => a.ovr - b.ovr)[0]
        const fa = freeAgents.find((p) => !usedFree.has(p.id) && p.ovr >= targetOvr && (!weakest || p.ovr > weakest.ovr + 2) && POSITION_GROUP[p.position] === POSITION_GROUP[weakest?.position || 'CM'])
        if (fa) {
          usedFree.add(fa.id)
          executeTransfer(saveId, fa.id, club.id, { fee: 0, wage: wageExpectation(fa, club), years: 3, type: 'free', date: save.date, season: save.season })
          deals++
        }
      }
      continue
    }
    const need = needs[Math.floor(Math.random() * needs.length)]
    const budget = club.transfer_budget
    const candidates = pool.filter((p) => POSITION_GROUP[p.position] === need && p.ovr >= targetOvr - 3 && p.ovr <= targetOvr + 6)
    let target = null
    let bestScore = -Infinity
    for (const p of candidates) {
      const fee = Math.round(marketValue(p.ovr, p.age, p.pot, Math.max(0, p.contract_end - save.season)) * (0.95 + Math.random() * 0.25))
      if (fee > budget * 0.75) continue
      const score = p.ovr * 1.2 - p.age * 0.6 + (p.pot - p.ovr) * 0.3 - fee / 5e6
      if (score > bestScore) { bestScore = score; target = { p, fee } }
    }
    if (!target && freeAgents.length) {
      const fa = freeAgents.find((p) => POSITION_GROUP[p.position] === need && p.ovr >= targetOvr - 4)
      if (fa) {
        executeTransfer(saveId, fa.id, club.id, { fee: 0, wage: wageExpectation(fa, club), years: 2, type: 'free', date: save.date, season: save.season })
        deals++
      }
      continue
    }
    if (!target) continue
    const sellerClub = getClubRow(saveId, target.p.club_id)
    // do not gut the user's squad without an offer
    if (target.p.club_id === userClub) continue
    if (sellerClub && sellerClub.reputation > club.reputation + 2 && Math.random() < 0.5) continue
    executeTransfer(saveId, target.p.id, club.id, {
      fee: target.fee, wage: wageExpectation(target.p, club), years: 3 + (target.p.age <= 23 ? 1 : 0),
      type: 'transfer', date: save.date, season: save.season,
    })
    addNews(saveId, {
      date: save.date, type: 'transfer', clubId: null,
      title: `${target.p.name} joins ${club.short}`,
      body: `${club.name} have signed ${target.p.name} from ${sellerClub?.name || 'free agency'} for £${(target.fee / 1e6).toFixed(1)}m.`,
    })
    deals++
  }
  return deals
}

export function generateIncomingOffers(saveId) {
  const save = getSave(saveId)
  if (!isWindowOpen(save.date)) return 0
  const squad = getSquad(saveId, save.club_id)
  const clubs = db.prepare('SELECT * FROM clubs WHERE save_id=? AND id!=? ORDER BY reputation DESC LIMIT 40').all(saveId, save.club_id)
  let made = 0
  for (const p of squad) {
    if (made >= 3) break
    if (Math.random() > 0.12) continue
    if (p.ovr < 72) continue
    const buyer = clubs[Math.floor(Math.random() * Math.min(clubs.length, 14))]
    if (!buyer || buyer.reputation < 5) continue
    const value = marketValue(p.ovr, p.age, p.pot, Math.max(0, p.contractEnd - save.season))
    const fee = Math.round(value * (0.9 + Math.random() * 0.5) / 1e5) * 1e5
    const existing = db.prepare('SELECT id FROM offers WHERE save_id=? AND player_id=? AND status=?').get(saveId, p.id, 'pending')
    if (existing) continue
    db.prepare('INSERT INTO offers (save_id,player_id,from_club,fee,wage,years,role,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(saveId, p.id, buyer.id, fee, Math.round(wageExpectation(p, buyer) * 1.1), 3, p.squadRole, 'pending', save.date)
    addNews(saveId, {
      date: save.date, type: 'transfer', clubId: save.club_id,
      title: `Offer received for ${p.name}`,
      body: `${buyer.name} have made a £${(fee / 1e6).toFixed(1)}m offer for ${p.name}. Review it in Transfers.`,
    })
    made++
  }
  return made
}

export function resolveOffer(saveId, offerId, accept) {
  const offer = db.prepare('SELECT * FROM offers WHERE save_id=? AND id=?').get(saveId, offerId)
  if (!offer || offer.status !== 'pending') return { ok: false }
  const save = getSave(saveId)
  if (!accept) {
    db.prepare('UPDATE offers SET status=? WHERE id=?').run('rejected', offerId)
    return { ok: true, accepted: false }
  }
  const p = getPlayerRow(saveId, offer.player_id)
  const res = executeTransfer(saveId, offer.player_id, offer.from_club, {
    fee: offer.fee, wage: offer.wage, years: offer.years, type: 'transfer', date: save.date, season: save.season,
  })
  db.prepare('UPDATE offers SET status=? WHERE id=?').run('accepted', offerId)
  addNews(saveId, { date: save.date, type: 'transfer', clubId: save.club_id, title: `${p.name} sold`, body: `${p.name} has joined ${getClubRow(saveId, offer.from_club)?.name} for £${(offer.fee / 1e6).toFixed(1)}m.` })
  return { ok: true, accepted: true, transfer: res }
}

export function aiRenewals(saveId, season, date) {
  const userClub = getSave(saveId)?.club_id
  const players = db.prepare('SELECT * FROM players WHERE save_id=? AND club_id IS NOT NULL AND is_youth=0 AND contract_end<=?').all(saveId, season + 1)
  const byClub = {}
  for (const p of players) (byClub[p.club_id] ||= []).push(p)
  let renewed = 0
  for (const [clubId, list] of Object.entries(byClub)) {
    if (clubId === userClub) continue
    const club = getClubRow(saveId, clubId)
    if (!club) continue
    const squad = db.prepare('SELECT id, ovr FROM players WHERE save_id=? AND club_id=? AND is_youth=0 ORDER BY ovr DESC').all(saveId, clubId)
    const rank = new Map(squad.map((p, i) => [p.id, i]))
    const mustKeep = squad.length < 23
    for (const p of list) {
      const core = (rank.get(p.id) ?? 99) < 20 || p.ovr >= 64
      if (p.age > 35) continue
      if (core || mustKeep || Math.random() < 0.55) {
        const years = p.age >= 31 ? 1 : p.age <= 23 ? 4 : 3
        db.prepare('UPDATE players SET contract_start=?, contract_end=?, wage=? WHERE save_id=? AND id=?')
          .run(date, season + 1 + years, Math.round(wageExpectation(p, club) * 1.05), saveId, p.id)
        renewed++
      }
    }
  }
  return renewed
}
