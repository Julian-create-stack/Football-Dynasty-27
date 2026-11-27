import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const world = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'world.json'), 'utf8'))

export const SEED = world
export const LEAGUES = world.leagues
export const SEED_CLUBS = world.clubs
export const SEED_PLAYERS = world.players
export const LEAGUE_CLUBS = world.leagueClubs

export const clubById = Object.fromEntries(world.clubs.map((c) => [c.id, c]))
export const leagueById = Object.fromEntries(world.leagues.map((l) => [l.id, l]))
export const TOP_LEAGUES = world.leagues.filter((l) => l.tier === 1)
export const SECOND_LEAGUES = world.leagues.filter((l) => l.tier === 2)

export const PAIR_TIER2 = {
  'premier-league': 'championship',
  'la-liga': 'la-liga-2',
  bundesliga: 'bundesliga-2',
  'serie-a': 'serie-b',
  'ligue-1': 'ligue-2',
}
