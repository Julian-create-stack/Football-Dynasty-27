import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useGame } from './store.jsx'
import { Toast } from './components/ui.jsx'
import Shell from './components/Shell.jsx'
import Start from './pages/Start.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Squad from './pages/Squad.jsx'
import Players from './pages/Players.jsx'
import PlayerProfile from './pages/PlayerProfile.jsx'
import Scouting from './pages/Scouting.jsx'
import Transfers from './pages/Transfers.jsx'
import Competitions from './pages/Competitions.jsx'
import Calendar from './pages/Calendar.jsx'
import Club from './pages/Club.jsx'
import Match from './pages/Match.jsx'

export default function App() {
  const { toast } = useGame()
  return (
    <>
      <Routes>
        <Route path="/" element={<Start />} />
        <Route element={<Shell />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/squad" element={<Squad />} />
          <Route path="/players" element={<Players />} />
          <Route path="/players/:id" element={<PlayerProfile />} />
          <Route path="/scouting" element={<Scouting />} />
          <Route path="/transfers" element={<Transfers />} />
          <Route path="/competitions" element={<Competitions />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/club" element={<Club />} />
          <Route path="/match/:id" element={<Match />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toast toast={toast} />
    </>
  )
}
