import { useEffect, useState, createContext, useContext, useCallback } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { buildTodaysActions } from './lib/logic'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import TodaysActions from './pages/TodaysActions'
import Leads from './pages/Leads'
import AddLead from './pages/AddLead'
import LeadDetail from './pages/LeadDetail'
import ImportLeads from './pages/ImportLeads'
import ImportHistory from './pages/ImportHistory'
import CadDesigns from './pages/CadDesigns'
import Quotes from './pages/Quotes'
import Calendar from './pages/Calendar'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Users from './pages/Users'

// ---------------- global app context: session, profile, live leads ----------------
const AppCtx = createContext(null)
export const useApp = () => useContext(AppCtx)

function AppProvider({ session, children }) {
  const [profile, setProfile] = useState(null)
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  const notify = useCallback(msg => {
    setToast(msg)
    setTimeout(() => setToast(null), 3200)
  }, [])

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    if (!error) setLeads(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', session.user.id).single()
      .then(({ data }) => setProfile(data || { id: session.user.id, name: session.user.email, role: 'staff' }))
    refresh()
    // Live updates: any change to leads by any team member refreshes everyone.
    const ch = supabase.channel('live-leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, refresh)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [session.user.id, refresh])

  const actionCount = buildTodaysActions(leads).reduce((n, b) => n + b.items.length, 0)

  return (
    <AppCtx.Provider value={{ session, profile, leads, loading, refresh, notify, actionCount }}>
      {children}
      {toast && <div className="toast">{toast}</div>}
    </AppCtx.Provider>
  )
}

// ---------------- sidebar layout ----------------
const NAV = [
  { group: 'Overview' },
  { to: '/', icon: '▦', label: 'Dashboard' },
  { to: '/actions', icon: '⚑', label: "Today's Actions", counted: true },
  { to: '/calendar', icon: '▤', label: 'Calendar & Tasks' },
  { group: 'Pipeline' },
  { to: '/leads', icon: '☰', label: 'All Leads' },
  { to: '/leads/new', icon: '＋', label: 'Add New Lead' },
  { to: '/cad', icon: '✎', label: 'CAD Designs' },
  { to: '/quotes', icon: '£', label: 'Quotes' },
  { group: 'Data' },
  { to: '/import', icon: '↥', label: 'Import CRM Leads' },
  { to: '/import/history', icon: '↺', label: 'Import History' },
  { to: '/reports', icon: '◔', label: 'Reports' },
  { group: 'Admin' },
  { to: '/settings', icon: '⚙', label: 'Settings' },
  { to: '/users', icon: '👥', label: 'User Management' },
]

function Layout({ children }) {
  const { profile, actionCount } = useApp()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => setOpen(false), [loc.pathname])

  const initials = (profile?.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="shell">
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="mark">DD <span>DAVIS</span></div>
          <div className="tag">Bathroom Lead Tracker</div>
        </div>
        <nav className="nav">
          {NAV.map((n, i) => n.group
            ? <div key={i} className="group">{n.group}</div>
            : <NavLink key={n.to} to={n.to} end={n.to === '/' || n.to === '/leads' || n.to === '/import'}
                className={({ isActive }) => isActive ? 'active' : ''}>
                <span className="icon">{n.icon}</span>{n.label}
                {n.counted && actionCount > 0 && <span className="count">{actionCount}</span>}
              </NavLink>
          )}
        </nav>
        <div className="sidebar-user">
          <div className="avatar">{initials}</div>
          <div className="who">
            <b>{profile?.name || '…'}</b>
            <small style={{ textTransform: 'capitalize' }}>{profile?.role}</small>
          </div>
          <button onClick={() => supabase.auth.signOut()} title="Log out">Log out</button>
        </div>
      </aside>
      <main className="main">{children}</main>
      <button className="menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">☰ Menu</button>
    </div>
  )
}

// ---------------- root ----------------
export default function App() {
  const [session, setSession] = useState(undefined) // undefined = still checking

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
  if (!session) return <Login />

  return (
    <BrowserRouter>
      <AppProvider session={session}>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/actions" element={<TodaysActions />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/leads/new" element={<AddLead />} />
            <Route path="/leads/:id" element={<LeadDetail />} />
            <Route path="/import" element={<ImportLeads />} />
            <Route path="/import/history" element={<ImportHistory />} />
            <Route path="/cad" element={<CadDesigns />} />
            <Route path="/quotes" element={<Quotes />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/users" element={<Users />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </AppProvider>
    </BrowserRouter>
  )
}
