// Position groups, formations and lineup selection.

export const POSITION_GROUP = {
  GK: 'GK',
  CB: 'DEF', LB: 'DEF', RB: 'DEF', LWB: 'DEF', RWB: 'DEF',
  CDM: 'MID', CM: 'MID', CAM: 'MID', LM: 'MID', RM: 'MID',
  LW: 'ATT', RW: 'ATT', CF: 'ATT', ST: 'ATT',
}

export const POSITION_LABEL = {
  GK: 'Goalkeeper', CB: 'Centre Back', LB: 'Left Back', RB: 'Right Back',
  LWB: 'Left Wing Back', RWB: 'Right Wing Back', CDM: 'Defensive Midfielder',
  CM: 'Central Midfielder', CAM: 'Attacking Midfielder', LM: 'Left Midfielder',
  RM: 'Right Midfielder', LW: 'Left Winger', RW: 'Right Winger',
  CF: 'Centre Forward', ST: 'Striker',
}

const RELATED = {
  GK: ['GK'],
  CB: ['CB', 'CDM'],
  LB: ['LB', 'LWB', 'LM'],
  RB: ['RB', 'RWB', 'RM'],
  LWB: ['LWB', 'LB', 'LM'],
  RWB: ['RWB', 'RB', 'RM'],
  CDM: ['CDM', 'CM', 'CB'],
  CM: ['CM', 'CDM', 'CAM'],
  CAM: ['CAM', 'CM', 'CF'],
  LM: ['LM', 'LW', 'LWB'],
  RM: ['RM', 'RW', 'RWB'],
  LW: ['LW', 'LM', 'CF'],
  RW: ['RW', 'RM', 'CF'],
  CF: ['CF', 'ST', 'CAM'],
  ST: ['ST', 'CF', 'LW', 'RW'],
}

export function positionPenalty(playerPos, slotPos) {
  if (!playerPos || !slotPos) return 12
  if (playerPos === slotPos) return 0
  const rel = RELATED[slotPos] || []
  if (rel.includes(playerPos)) return 4
  if (POSITION_GROUP[playerPos] === POSITION_GROUP[slotPos]) return 9
  if (POSITION_GROUP[slotPos] === 'GK' || POSITION_GROUP[playerPos] === 'GK') return 30
  // adjacent lines are less bad than opposite lines
  const order = { GK: 0, DEF: 1, MID: 2, ATT: 3 }
  const gp = order[POSITION_GROUP[playerPos]] ?? 2
  const gs = order[POSITION_GROUP[slotPos]] ?? 2
  const gap = Math.abs(gp - gs)
  return gap === 1 ? 13 : 19
}

export const FORMATIONS = {
  '4-3-3': {
    label: '4-3-3',
    style: 'Balanced possession',
    slots: [
      { pos: 'GK', x: 50, y: 91 },
      { pos: 'LB', x: 13, y: 73 }, { pos: 'CB', x: 37, y: 77 }, { pos: 'CB', x: 63, y: 77 }, { pos: 'RB', x: 87, y: 73 },
      { pos: 'CM', x: 26, y: 51 }, { pos: 'CDM', x: 50, y: 57 }, { pos: 'CM', x: 74, y: 51 },
      { pos: 'LW', x: 15, y: 26 }, { pos: 'ST', x: 50, y: 20 }, { pos: 'RW', x: 85, y: 26 },
    ],
  },
  '4-2-3-1': {
    label: '4-2-3-1',
    style: 'Control and create',
    slots: [
      { pos: 'GK', x: 50, y: 91 },
      { pos: 'LB', x: 13, y: 73 }, { pos: 'CB', x: 37, y: 77 }, { pos: 'CB', x: 63, y: 77 }, { pos: 'RB', x: 87, y: 73 },
      { pos: 'CDM', x: 35, y: 57 }, { pos: 'CDM', x: 65, y: 57 },
      { pos: 'LM', x: 15, y: 36 }, { pos: 'CAM', x: 50, y: 39 }, { pos: 'RM', x: 85, y: 36 },
      { pos: 'ST', x: 50, y: 18 },
    ],
  },
  '4-4-2': {
    label: '4-4-2',
    style: 'Direct and compact',
    slots: [
      { pos: 'GK', x: 50, y: 91 },
      { pos: 'LB', x: 13, y: 73 }, { pos: 'CB', x: 37, y: 77 }, { pos: 'CB', x: 63, y: 77 }, { pos: 'RB', x: 87, y: 73 },
      { pos: 'LM', x: 13, y: 49 }, { pos: 'CM', x: 37, y: 53 }, { pos: 'CM', x: 63, y: 53 }, { pos: 'RM', x: 87, y: 49 },
      { pos: 'ST', x: 38, y: 22 }, { pos: 'ST', x: 62, y: 22 },
    ],
  },
  '3-5-2': {
    label: '3-5-2',
    style: 'Overload the middle',
    slots: [
      { pos: 'GK', x: 50, y: 91 },
      { pos: 'CB', x: 28, y: 77 }, { pos: 'CB', x: 50, y: 79 }, { pos: 'CB', x: 72, y: 77 },
      { pos: 'LWB', x: 8, y: 55 }, { pos: 'CM', x: 31, y: 55 }, { pos: 'CDM', x: 50, y: 59 }, { pos: 'CM', x: 69, y: 55 }, { pos: 'RWB', x: 92, y: 55 },
      { pos: 'ST', x: 38, y: 22 }, { pos: 'ST', x: 62, y: 22 },
    ],
  },
  '5-3-2': {
    label: '5-3-2',
    style: 'Low block, counter',
    slots: [
      { pos: 'GK', x: 50, y: 91 },
      { pos: 'LWB', x: 8, y: 69 }, { pos: 'CB', x: 28, y: 79 }, { pos: 'CB', x: 50, y: 81 }, { pos: 'CB', x: 72, y: 79 }, { pos: 'RWB', x: 92, y: 69 },
      { pos: 'CM', x: 28, y: 51 }, { pos: 'CM', x: 50, y: 55 }, { pos: 'CM', x: 72, y: 51 },
      { pos: 'ST', x: 38, y: 22 }, { pos: 'ST', x: 62, y: 22 },
    ],
  },
  '4-1-2-1-2': {
    label: '4-1-2-1-2',
    style: 'Narrow diamond',
    slots: [
      { pos: 'GK', x: 50, y: 91 },
      { pos: 'LB', x: 13, y: 73 }, { pos: 'CB', x: 37, y: 77 }, { pos: 'CB', x: 63, y: 77 }, { pos: 'RB', x: 87, y: 73 },
      { pos: 'CDM', x: 50, y: 59 }, { pos: 'CM', x: 27, y: 49 }, { pos: 'CM', x: 73, y: 49 }, { pos: 'CAM', x: 50, y: 37 },
      { pos: 'ST', x: 38, y: 20 }, { pos: 'ST', x: 62, y: 20 },
    ],
  },
}

export const SQUAD_ROLES = ['Star Player', 'Important Player', 'First Team', 'Rotation', 'Squad Player', 'Prospect']

export function roleWeight(role) {
  return { 'Star Player': 1, 'Important Player': 0.9, 'First Team': 0.78, Rotation: 0.62, 'Squad Player': 0.5, Prospect: 0.35 }[role] ?? 0.5
}

export function effectiveRating(player, slotPos) {
  const pen = positionPenalty(player.position, slotPos)
  const fit = (player.fitness ?? 100) / 100
  const morale = (player.morale ?? 75)
  const form = player.form ?? 0
  const fitnessPenalty = fit < 0.75 ? (0.75 - fit) * 45 : 0
  const moraleBonus = (morale - 75) / 35
  return player.ovr - pen - fitnessPenalty + moraleBonus + form * 0.5
}

export function availablePlayers(squad) {
  return squad.filter((p) => !p.injuredUntil && !p.injured_until && (p.suspension ?? 0) <= 0)
}

export function autoLineup(squad, formationKey = '4-3-3') {
  const formation = FORMATIONS[formationKey] || FORMATIONS['4-3-3']
  const available = availablePlayers(squad)
  const pool = (available.length >= 11 ? available : squad).slice()
  // Global best-fit assignment: strong natural fits are chosen before stars are
  // pushed into unfamiliar slots, so the XI keeps its shape.
  const pairs = []
  formation.slots.forEach((slot, i) => {
    for (const p of pool) {
      const pen = positionPenalty(p.position, slot.pos)
      const score = effectiveRating(p, slot.pos) - pen * 1.1
      pairs.push({ i, slot, p, score })
    }
  })
  pairs.sort((a, b) => b.score - a.score)
  const usedP = new Set()
  const usedS = new Set()
  const starters = []
  for (const pair of pairs) {
    if (usedP.has(pair.p.id) || usedS.has(pair.i)) continue
    usedP.add(pair.p.id)
    usedS.add(pair.i)
    starters.push({ playerId: pair.p.id, slot: pair.i })
    if (starters.length === formation.slots.length) break
  }
  starters.sort((a, b) => a.slot - b.slot)
  const bench = pool
    .filter((p) => !usedP.has(p.id))
    .sort((a, b) => b.ovr - a.ovr)
    .slice(0, 9)
    .map((p) => p.id)
  return { formation: formationKey, starters, bench }
}

export function fillSlots(pool, slots, usedIds = new Set()) {
  const pairs = []
  slots.forEach((slot) => {
    for (const p of pool) {
      if (usedIds.has(p.id)) continue
      const pen = positionPenalty(p.position, slot.pos)
      pairs.push({ slot, p, score: effectiveRating(p, slot.pos) - pen * 1.1 })
    }
  })
  pairs.sort((a, b) => b.score - a.score)
  const usedP = new Set()
  const usedS = new Set()
  const out = []
  for (const pair of pairs) {
    if (usedP.has(pair.p.id) || usedS.has(pair.slot.index)) continue
    usedP.add(pair.p.id)
    usedS.add(pair.slot.index)
    out.push({ playerId: pair.p.id, slot: pair.slot.index })
    if (out.length === slots.length) break
  }
  return out
}

export function lineupRating(squad, starters, formationKey) {
  const formation = FORMATIONS[formationKey] || FORMATIONS['4-3-3']
  const map = new Map(squad.map((p) => [p.id, p]))
  const byGroup = { GK: [], DEF: [], MID: [], ATT: [] }
  for (const s of starters) {
    const p = map.get(s.playerId)
    if (!p) continue
    const slot = formation.slots[s.slot]
    if (!slot) continue
    const g = POSITION_GROUP[slot.pos]
    byGroup[g].push(effectiveRating(p, slot.pos))
  }
  const avg = (arr, fb = 60) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : fb)
  return {
    gk: avg(byGroup.GK, 60),
    def: avg(byGroup.DEF, 60),
    mid: avg(byGroup.MID, 60),
    att: avg(byGroup.ATT, 60),
  }
}

export function formationSlots(formationKey) {
  return (FORMATIONS[formationKey] || FORMATIONS['4-3-3']).slots
}
