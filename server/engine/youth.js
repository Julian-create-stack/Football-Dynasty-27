import { db } from '../db.js'
import { getSave, addNews } from './world.js'

const FIRST = {
  England: ['Harry', 'Jack', 'Ollie', 'Callum', 'Tyler', 'Reece', 'Josh', 'Charlie', 'Alfie', 'Leo', 'Kian', 'Finley', 'Mason', 'Elliot', 'Jude', 'Sam', 'Archie', 'Freddie', 'Louie', 'Rhys'],
  Spain: ['Álvaro', 'Iker', 'Pau', 'Nico', 'Hugo', 'Marc', 'Dani', 'Adrián', 'Sergio', 'Bruno', 'Izan', 'Rodrigo', 'Mateo', 'Diego', 'Javier', 'Pablo', 'Aitor', 'Unai', 'Gonzalo', 'Thiago'],
  Germany: ['Lukas', 'Finn', 'Jonas', 'Leon', 'Noah', 'Elias', 'Ben', 'Paul', 'Max', 'Felix', 'Tim', 'Jan', 'Nico', 'Tom', 'Erik', 'Julian', 'Marvin', 'Oskar', 'Lenn', 'Anton'],
  Italy: ['Luca', 'Matteo', 'Andrea', 'Davide', 'Simone', 'Federico', 'Lorenzo', 'Tommaso', 'Marco', 'Nicolò', 'Gabriele', 'Riccardo', 'Alessio', 'Pietro', 'Filippo', 'Samuele', 'Edoardo', 'Diego', 'Michele', 'Cristian'],
  France: ['Lucas', 'Hugo', 'Théo', 'Nathan', 'Enzo', 'Mathis', 'Noah', 'Jules', 'Adam', 'Rayan', 'Yanis', 'Ilan', 'Gabriel', 'Aaron', 'Maxime', 'Clément', 'Bilal', 'Ismaël', 'Sacha', 'Tidiane'],
}
const LAST = {
  England: ['Walker', 'Bennett', 'Hughes', 'Palmer', 'Reed', 'Foster', 'Doyle', 'Grant', 'Hart', 'Lowe', 'Mason', 'Pearce', 'Rowe', 'Sharpe', 'Turner', 'Vaughan', 'Walsh', 'Webb', 'Young', 'Bailey'],
  Spain: ['Serrano', 'Vidal', 'Ferrer', 'Cano', 'Ramos', 'Bermejo', 'Paz', 'Lozano', 'Salas', 'Iglesias', 'Molina', 'Ortega', 'Navarro', 'Gil', 'Rubio', 'Marín', 'Sanz', 'Cabrera', 'Reyes', 'Prieto'],
  Germany: ['Müller', 'Schmidt', 'Weber', 'Wagner', 'Becker', 'Hoffmann', 'Schulz', 'Koch', 'Richter', 'Klein', 'Wolf', 'Neumann', 'Schwarz', 'Zimmermann', 'Braun', 'Krüger', 'Hartmann', 'Lange', 'Werner', 'Krause'],
  Italy: ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'De Luca', 'Costa', 'Giordano', 'Mancini', 'Rizzo', 'Lombardi', 'Moretti'],
  France: ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier'],
}
const NATIONS = Object.keys(FIRST)

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

function nextPlayerId(saveId) {
  const row = db.prepare('SELECT MAX(id) as m FROM players WHERE save_id=?').get(saveId)
  return Math.max(900000, (row?.m || 0) + 1)
}

export function generateYouthPlayer(saveId, club, season, date) {
  const nat = club.country in FIRST ? club.country : pick(NATIONS)
  const first = pick(FIRST[nat])
  const last = pick(LAST[nat])
  const age = 15 + Math.floor(Math.random() * 4)
  const positions = ['GK', 'CB', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CM', 'CAM', 'LW', 'RW', 'ST', 'ST']
  const position = pick(positions)
  const fac = club.youth_facilities || 6
  const base = 40 + Math.round(fac * 1.6) + Math.floor(Math.random() * 8)
  const ovr = Math.min(66, base)
  const pot = Math.min(94, ovr + 12 + Math.round(fac * 1.4) + Math.floor(Math.random() * 10))
  const attrs = {}
  const keys = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physicality', 'finishing', 'shot_power', 'long_shots', 'positioning', 'volleys', 'penalties', 'short_passing', 'long_passing', 'vision', 'crossing', 'curve', 'fk_accuracy', 'ball_control', 'agility', 'balance', 'reactions', 'composure', 'acceleration', 'sprint_speed', 'stamina', 'strength', 'jumping', 'aggression', 'interceptions', 'awareness', 'standing_tackle', 'sliding_tackle', 'heading', 'gk_diving', 'gk_handling', 'gk_kicking', 'gk_positioning', 'gk_reflexes']
  for (const k of keys) attrs[k] = Math.max(25, Math.min(85, ovr + Math.round((Math.random() - 0.5) * 14)))
  if (position === 'GK') {
    for (const k of ['gk_diving', 'gk_handling', 'gk_kicking', 'gk_positioning', 'gk_reflexes']) attrs[k] = Math.max(40, Math.min(80, ovr + 4))
  }
  const id = nextPlayerId(saveId)
  const used = new Set(db.prepare('SELECT squad_number FROM players WHERE save_id=? AND club_id=?').all(saveId, club.id).map((r) => r.squad_number))
  let num = 30
  while (used.has(num)) num++
  db.prepare(`INSERT INTO players (save_id,id,name,first,last,nationality,position,alt,age,ovr,pot,club_id,wage,value,contract_start,contract_end,foot,height,weight,playstyles,attrs,morale,fitness,form,squad_number,squad_role,is_youth,training_focus,training_intensity,generated)
    VALUES (?,?,?,?,?,?,?,'',?,?,?,?,?,?,?,?,'Right',?,?,?,?,75,100,0,?, 'Prospect',1,'Balanced','Normal',1)`)
    .run(saveId, id, `${first} ${last}`, first, last, nat, position, age, ovr, pot, club.id, 800, Math.round((250000 + pot * 9000) / 10000) * 10000, date, season + 2, 165 + Math.floor(Math.random() * 20), 58 + Math.floor(Math.random() * 16), '', JSON.stringify(attrs), num)
  return { id, name: `${first} ${last}`, age, position, ovr, pot }
}

export function youthIntake(saveId, season, date) {
  const save = getSave(saveId)
  const clubs = db.prepare('SELECT * FROM clubs WHERE save_id=?').all(saveId)
  const userClub = clubs.find((c) => c.id === save.club_id)
  let count = 0
  const tx = db.transaction(() => {
    for (const club of clubs) {
      const n = 3 + Math.floor(Math.random() * 3)
      for (let i = 0; i < n; i++) { generateYouthPlayer(saveId, club, season, date); count++ }
    }
  })
  tx()
  if (userClub) {
    addNews(saveId, {
      date, type: 'youth', clubId: userClub.id,
      title: 'Youth intake arrives',
      body: `A new group of academy prospects has arrived at ${userClub.name}. Review them in the Club section.`,
    })
  }
  return count
}

export const YOUTH_NAME_POOLS = { FIRST, LAST }
