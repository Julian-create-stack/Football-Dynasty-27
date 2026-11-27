import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })

export const db = new Database(path.join(DATA_DIR, 'game.db'))
db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')
db.pragma('foreign_keys = OFF')

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS saves (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  slot INTEGER NOT NULL,
  name TEXT NOT NULL,
  manager_name TEXT NOT NULL,
  club_id TEXT NOT NULL,
  season INTEGER NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  season_start TEXT NOT NULL,
  season_end TEXT NOT NULL,
  finished INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_saves_user ON saves(user_id);

CREATE TABLE IF NOT EXISTS clubs (
  save_id TEXT NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  short TEXT,
  stadium TEXT,
  capacity INTEGER,
  color1 TEXT,
  color2 TEXT,
  reputation INTEGER,
  founded INTEGER,
  league_id TEXT,
  country TEXT,
  tier INTEGER,
  balance INTEGER DEFAULT 0,
  transfer_budget INTEGER DEFAULT 0,
  wage_budget INTEGER DEFAULT 0,
  board_confidence INTEGER DEFAULT 70,
  facilities INTEGER DEFAULT 6,
  youth_facilities INTEGER DEFAULT 6,
  training_facilities INTEGER DEFAULT 6,
  scouting INTEGER DEFAULT 6,
  objective TEXT,
  PRIMARY KEY (save_id, id)
);
CREATE INDEX IF NOT EXISTS idx_clubs_league ON clubs(save_id, league_id);

CREATE TABLE IF NOT EXISTS players (
  save_id TEXT NOT NULL,
  id INTEGER NOT NULL,
  name TEXT NOT NULL,
  first TEXT,
  last TEXT,
  nationality TEXT,
  position TEXT,
  alt TEXT,
  age INTEGER,
  ovr INTEGER,
  pot INTEGER,
  club_id TEXT,
  wage INTEGER,
  value INTEGER,
  contract_start TEXT,
  contract_end INTEGER,
  foot TEXT,
  height INTEGER,
  weight INTEGER,
  playstyles TEXT,
  attrs TEXT,
  morale INTEGER DEFAULT 75,
  fitness INTEGER DEFAULT 100,
  form REAL DEFAULT 0,
  squad_number INTEGER,
  squad_role TEXT DEFAULT 'Squad Player',
  release_clause INTEGER,
  is_youth INTEGER DEFAULT 0,
  training_focus TEXT,
  training_intensity TEXT DEFAULT 'Normal',
  injured_until TEXT,
  injury_type TEXT,
  suspension INTEGER DEFAULT 0,
  loan_from TEXT,
  transfer_listed INTEGER DEFAULT 0,
  generated INTEGER DEFAULT 0,
  PRIMARY KEY (save_id, id)
);
CREATE INDEX IF NOT EXISTS idx_players_club ON players(save_id, club_id);
CREATE INDEX IF NOT EXISTS idx_players_ovr ON players(save_id, ovr);

CREATE TABLE IF NOT EXISTS stats (
  save_id TEXT NOT NULL,
  player_id INTEGER NOT NULL,
  season INTEGER NOT NULL,
  apps INTEGER DEFAULT 0,
  starts INTEGER DEFAULT 0,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  minutes INTEGER DEFAULT 0,
  rating_sum REAL DEFAULT 0,
  yellow INTEGER DEFAULT 0,
  red INTEGER DEFAULT 0,
  clean_sheets INTEGER DEFAULT 0,
  PRIMARY KEY (save_id, player_id, season)
);

CREATE TABLE IF NOT EXISTS fixtures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  save_id TEXT NOT NULL,
  season INTEGER NOT NULL,
  competition TEXT NOT NULL,
  round TEXT,
  matchday INTEGER,
  date TEXT NOT NULL,
  home_id TEXT,
  away_id TEXT,
  home_goals INTEGER,
  away_goals INTEGER,
  played INTEGER DEFAULT 0,
  neutral INTEGER DEFAULT 0,
  attendance INTEGER,
  events TEXT,
  stats TEXT,
  bracket INTEGER
);
CREATE INDEX IF NOT EXISTS idx_fixtures_save ON fixtures(save_id, date);
CREATE INDEX IF NOT EXISTS idx_fixtures_comp ON fixtures(save_id, competition);

CREATE TABLE IF NOT EXISTS live_matches (
  save_id TEXT NOT NULL,
  fixture_id INTEGER NOT NULL,
  state TEXT NOT NULL,
  PRIMARY KEY (save_id, fixture_id)
);

CREATE TABLE IF NOT EXISTS transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  save_id TEXT NOT NULL,
  player_id INTEGER,
  player_name TEXT,
  from_club TEXT,
  to_club TEXT,
  fee INTEGER,
  wage INTEGER,
  type TEXT,
  date TEXT,
  season INTEGER
);
CREATE INDEX IF NOT EXISTS idx_transfers_save ON transfers(save_id);

CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  save_id TEXT NOT NULL,
  date TEXT,
  type TEXT,
  title TEXT,
  body TEXT,
  club_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_news_save ON news(save_id);

CREATE TABLE IF NOT EXISTS shortlist (
  save_id TEXT NOT NULL,
  player_id INTEGER NOT NULL,
  added_at TEXT,
  PRIMARY KEY (save_id, player_id)
);

CREATE TABLE IF NOT EXISTS scout_reports (
  save_id TEXT NOT NULL,
  player_id INTEGER NOT NULL,
  created_at TEXT,
  accuracy INTEGER,
  report TEXT,
  PRIMARY KEY (save_id, player_id)
);

CREATE TABLE IF NOT EXISTS tactics (
  save_id TEXT NOT NULL,
  club_id TEXT NOT NULL,
  formation TEXT DEFAULT '4-3-3',
  mentality INTEGER DEFAULT 3,
  pressing INTEGER DEFAULT 3,
  def_line INTEGER DEFAULT 3,
  buildup TEXT DEFAULT 'Balanced',
  chance_creation TEXT DEFAULT 'Balanced',
  width INTEGER DEFAULT 3,
  tempo INTEGER DEFAULT 3,
  set_pieces TEXT,
  instructions TEXT,
  PRIMARY KEY (save_id, club_id)
);

CREATE TABLE IF NOT EXISTS lineups (
  save_id TEXT NOT NULL,
  club_id TEXT NOT NULL,
  player_id INTEGER NOT NULL,
  slot INTEGER DEFAULT 0,
  PRIMARY KEY (save_id, club_id, player_id)
);

CREATE TABLE IF NOT EXISTS finances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  save_id TEXT NOT NULL,
  club_id TEXT NOT NULL,
  date TEXT,
  season INTEGER,
  type TEXT,
  description TEXT,
  amount INTEGER
);
CREATE INDEX IF NOT EXISTS idx_fin_save ON finances(save_id, club_id);

CREATE TABLE IF NOT EXISTS season_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  save_id TEXT NOT NULL,
  season INTEGER,
  competition TEXT,
  winner_club_id TEXT,
  winner_name TEXT,
  user_club_id TEXT,
  user_position INTEGER,
  user_points INTEGER
);

CREATE TABLE IF NOT EXISTS trophies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  save_id TEXT NOT NULL,
  club_id TEXT,
  competition TEXT,
  season INTEGER
);

CREATE TABLE IF NOT EXISTS injury_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  save_id TEXT NOT NULL,
  player_id INTEGER NOT NULL,
  date TEXT,
  type TEXT,
  days INTEGER
);

CREATE TABLE IF NOT EXISTS player_history (
  save_id TEXT NOT NULL,
  player_id INTEGER NOT NULL,
  season INTEGER NOT NULL,
  ovr INTEGER,
  pot INTEGER,
  club_id TEXT,
  value INTEGER,
  PRIMARY KEY (save_id, player_id, season)
);

CREATE TABLE IF NOT EXISTS negotiations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  save_id TEXT NOT NULL,
  player_id INTEGER,
  club_id TEXT,
  kind TEXT,
  status TEXT,
  payload TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  save_id TEXT NOT NULL,
  player_id INTEGER,
  from_club TEXT,
  fee INTEGER,
  wage INTEGER,
  years INTEGER,
  role TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT
);
`)

export const nowIso = () => new Date().toISOString()
