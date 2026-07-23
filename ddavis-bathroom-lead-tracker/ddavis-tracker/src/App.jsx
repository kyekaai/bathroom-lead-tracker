import { useEffect, useState, createContext, useContext, useCallback } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom'
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
import Calendar from './pages/Calendar'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import WhatsNew from './pages/WhatsNew'
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follow_ups' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity' }, refresh)
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

// ── Line icons — drawn shapes so they look identical on every device ──
const I = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>,
  actions: <path d="M5 21V4.5C5 4.5 7 3 12 4.5S19 6 19 6v8s-2 1.5-7 0-7 0-7 0" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/></>,
  leads: <path d="M4 6h16M4 12h16M4 18h10" />,
  add: <><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></>,
  cad: <><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></>,
  importIn: <><path d="M12 3v12M8 11l4 4 4-4"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></>,
  history: <><path d="M3 12a9 9 0 109-9 9 9 0 00-7 3.4"/><path d="M3 3v4h4"/><path d="M12 7v5l3 2"/></>,
  reports: <path d="M5 21V10M12 21V4M19 21v-7" />,
  star: <path d="M12 2.5l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 8.9l6.1-.8z" />,
  settings: <><circle cx="12" cy="12" r="3.2"/><path d="M19.4 14.5a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.2a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.2a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H10a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.2a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V10a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.2a1.6 1.6 0 00-1.4 1z"/></>,
  users: <><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M16 5.2a3.2 3.2 0 010 5.6M17.5 20a6.5 6.5 0 00-2-4.7"/></>,
  logout: <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></>,
}

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[name]}</svg>
  )
}

const NAV = [
  { group: 'Overview' },
  { to: '/', icon: 'dashboard', label: 'Dashboard' },
  { to: '/actions', icon: 'actions', label: "Today's Actions", count: 'actions' },
  { to: '/calendar', icon: 'calendar', label: 'Calendar & Tasks' },
  { group: 'Pipeline' },
  { to: '/leads', icon: 'leads', label: 'All Leads', count: 'leads' },
  { to: '/leads/new', icon: 'add', label: 'Add New Lead' },
  { to: '/cad', icon: 'cad', label: 'CAD Designs', count: 'cad' },
  { group: 'Data' },
  { to: '/import', icon: 'importIn', label: 'Import CRM Leads' },
  { to: '/import/history', icon: 'history', label: 'Import History' },
  { to: '/reports', icon: 'reports', label: 'Reports' },
  { to: '/whats-new', icon: 'star', label: "What's New" },
  { group: 'Admin' },
  { to: '/settings', icon: 'settings', label: 'Settings' },
  { to: '/users', icon: 'users', label: 'User Management' },
]


// ── Spotlight search: Ctrl/Cmd+K anywhere to find and open any lead ──
function Spotlight() {
  const { leads } = useApp()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const onKey = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setOpen(o => !o); setQ(''); setIdx(0)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    const onOpen = () => { setOpen(true); setQ(''); setIdx(0) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('dd-spotlight', onOpen)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('dd-spotlight', onOpen) }
  }, [])

  if (!open) return null

  const needle = q.trim().toLowerCase()
  const results = leads
    .filter(l => !needle || [l.customer_name, l.postcode, l.phone, l.email, l.address].join(' ').toLowerCase().includes(needle))
    .slice(0, 8)

  const go = l => { setOpen(false); nav(`/leads/${l.id}`) }
  const onInputKey = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && results[idx]) go(results[idx])
  }

  return (
    <div className="spot-overlay" onClick={() => setOpen(false)}>
      <div className="spot" onClick={e => e.stopPropagation()}>
        <input autoFocus placeholder="Search leads by name, postcode, phone…" value={q}
          onChange={e => { setQ(e.target.value); setIdx(0) }} onKeyDown={onInputKey} />
        <div className="hint">↑↓ to navigate · Enter to open · Esc to close</div>
        <div className="res">
          {results.map((l, i) => (
            <button key={l.id} className={i === idx ? 'on' : ''} onMouseEnter={() => setIdx(i)} onClick={() => go(l)}>
              <span><b>{l.customer_name}</b><small>{[l.postcode, l.phone].filter(Boolean).join(' · ')}</small></span>
              <small>{l.stage}</small>
            </button>
          ))}
          {results.length === 0 && <div className="none">No leads match "{q}"</div>}
        </div>
      </div>
    </div>
  )
}

function Layout({ children }) {
  const { profile, actionCount, leads } = useApp()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => setOpen(false), [loc.pathname])

  const active = leads.filter(l => l.stage !== 'Won' && l.stage !== 'Lost')
  const COUNTS = {
    actions: actionCount,
    leads: active.length,
    cad: active.filter(l => l.cad_required === 'yes' && l.cad_status !== 'not required').length,
  }

  const initials = (profile?.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="shell">
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <img src="/logo.png" alt="DD Davis Limited — Built on trust. Driven by quality." className="brand-logo"
            style={{ display: 'block', width: '100%', maxWidth: 160, height: 'auto' }} />
        </div>
        <button className="side-search" onClick={() => window.dispatchEvent(new Event('dd-spotlight'))}>
          <span>🔍 Search leads</span><kbd>Ctrl K</kbd>
        </button>
        <nav className="nav">
          {NAV.map((n, i) => n.group
            ? <div key={i} className="group">{n.group}</div>
            : <NavLink key={n.to} to={n.to} end={n.to === '/' || n.to === '/leads' || n.to === '/import'}
                className={({ isActive }) => isActive ? 'active' : ''}>
                <span className="n-ico"><Icon name={n.icon} /></span>
                <span className="n-lbl">{n.label}</span>
                {n.count && COUNTS[n.count] > 0 &&
                  <span className={`n-badge ${n.count === 'actions' ? 'hot' : 'soft'}`}>{COUNTS[n.count]}</span>}
              </NavLink>
          )}
        </nav>
        <div className="sidebar-user">
          <div className="avatar">{initials}</div>
          <div className="who">
            <b>{profile?.name || '…'}</b>
            <small style={{ textTransform: 'capitalize' }}>{profile?.role}</small>
          </div>
          <button onClick={() => supabase.auth.signOut()} title="Log out" aria-label="Log out"><Icon name="logout" /></button>
        </div>
      </aside>
      <main className="main">{children}</main>
      <Spotlight />

      {/* Mobile bottom tab bar — 4 main destinations + More (full menu) */}
      <nav className="tabbar" aria-label="Main">
        <NavLink to="/" end className={({ isActive }) => `tab ${isActive ? 'on' : ''}`}>
          <span className="t-icon">▦</span>Home
        </NavLink>
        <NavLink to="/leads" end className={({ isActive }) => `tab ${isActive ? 'on' : ''}`}>
          <span className="t-icon">👥</span>Leads
        </NavLink>
        <NavLink to="/leads/new" className="tab add" aria-label="Add lead">
          <span className="add-btn">＋</span>Add
        </NavLink>
        <NavLink to="/cad" className={({ isActive }) => `tab ${isActive ? 'on' : ''}`}>
          <span className="t-icon">📐</span>CAD
        </NavLink>
        <button className={`tab ${open ? 'on' : ''}`} onClick={() => setOpen(true)}>
          <span className="t-icon">☰</span>More
          {actionCount > 0 && <span className="tab-dot" />}
        </button>
      </nav>
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
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/whats-new" element={<WhatsNew />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/users" element={<Users />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </AppProvider>
    </BrowserRouter>
  )
}
