import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useApp } from '../App'
import { supabase } from '../lib/supabase'
import { Stat, StageBadge } from '../components/ui'
import { buildTodaysActions, derive, money, fmtDate, findBottlenecks } from '../lib/logic'

// Pipeline groups — colours mean the same thing everywhere
const GROUPS = [
  { key: 'enquiry', label: 'Pre-Survey', color: 'var(--stage-enquiry)', stages: ['New Enquiry', 'Contacted', 'Survey Booked'] },
  { key: 'new', label: 'Chasing Form', color: 'var(--stage-new)', stages: ['Survey Complete', 'Awaiting Selection Form', 'Selection Form Received'] },
  { key: 'cad', label: 'CAD Design', color: 'var(--stage-contact)', stages: ['CAD Required', 'CAD Booked', 'CAD In Progress', 'CAD Sent', 'CAD Revisions Required', 'CAD Approved'] },
  { key: 'quoted', label: 'Quoted', color: 'var(--stage-quoted)', stages: ['Quote Sent', 'Quote Follow Up'] },
  { key: 'won', label: 'Won', color: 'var(--stage-won)', stages: ['Won'] },
]


// "5 mins ago" style timestamps for the activity feed
function timeAgo(ts) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m} min${m === 1 ? '' : 's'} ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.floor(h / 24); if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

const FEED_DOT = {
  stage: 'blue', cad: 'purple', quote: 'gold', email: 'gold', selection_form: 'gold',
  follow_up: 'amber', note: 'grey', created: 'teal', import: 'teal', survey: 'blue', file: 'grey',
}

// Count-up animation for the hero number (~700ms, respects reduced motion)
function useCountUp(target) {
  const [n, setN] = useState(0)
  const done = useRef(false)
  useEffect(() => {
    if (done.current) { setN(target); return }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(target); done.current = true; return }
    done.current = true
    const t0 = performance.now()
    let raf
    const tick = now => {
      const p = Math.min(1, (now - t0) / 700)
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return n
}

export default function Dashboard() {
  const { leads, loading, profile } = useApp()
  const [feed, setFeed] = useState([])
  const bottlenecks = findBottlenecks(leads)
  const worst = bottlenecks[0]
  const maxCount = Math.max(1, ...bottlenecks.map(b => b.count))
  const [welcome, setWelcome] = useState(() => {
    try { return !localStorage.getItem('dd-welcome-dismissed') } catch { return false }
  })
  const dismissWelcome = () => {
    setWelcome(false)
    try { localStorage.setItem('dd-welcome-dismissed', '1') } catch { /* private mode */ }
  }

  // Latest team activity — refetches whenever anything changes (realtime refresh updates `leads`)
  useEffect(() => {
    supabase.from('activity')
      .select('id, lead_id, type, message, actor, created_at, leads(customer_name)')
      .order('created_at', { ascending: false }).limit(12)
      .then(({ data }) => setFeed(data || []))
  }, [leads])

  const active = leads.filter(l => l.stage !== 'Won' && l.stage !== 'Lost')
  const won = leads.filter(l => l.stage === 'Won')
  const lost = leads.filter(l => l.stage === 'Lost')

  const pipeline = active.reduce((s, l) => s + Number(l.quote_value ?? l.estimated_value ?? 0), 0)
  const animated = useCountUp(pipeline)
  if (loading) return <p className="muted">Loading live data…</p>

  const awaitingForms = active.filter(l => l.survey_completed && !l.selection_form_returned).length
  const cadInProgress = leads.filter(l => ['booked', 'in progress', 'revisions requested'].includes(l.cad_status)).length
  const cadAwaiting = active.filter(l => l.cad_status === 'sent to customer').length
  const decided = won.length + lost.length
  const convRate = decided ? Math.round(won.length / decided * 100) : 0
  const wonRev = won.reduce((s, l) => s + Number(l.quote_value ?? l.estimated_value ?? 0), 0)
  const profit = won.reduce((s, l) => s + Number(l.estimated_profit ?? 0), 0)

  // Trend: new leads this month vs last month
  const ym = d => (d || '').slice(0, 7)
  const now = new Date()
  const thisM = now.toISOString().slice(0, 7)
  const lastM = new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString().slice(0, 7)
  const nThis = leads.filter(l => ym(l.created_at) === thisM).length
  const nLast = leads.filter(l => ym(l.created_at) === lastM).length
  const trendPct = nLast ? Math.round(((nThis - nLast) / nLast) * 100) : null

  // 30-day leads-over-time series
  const series = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    series.push({
      day: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      leads: leads.filter(l => (l.created_at || '').slice(0, 10) === key).length,
    })
  }

  // Pipeline groups with count + value
  const groups = GROUPS.map(g => {
    const rows = leads.filter(l => g.stages.includes(l.stage))
    return { ...g, n: rows.length, value: rows.reduce((s, l) => s + Number(l.quote_value ?? l.estimated_value ?? 0), 0) }
  })
  const maxN = Math.max(1, ...groups.map(g => g.n))

  const buckets = buildTodaysActions(leads)
  const totalActions = buckets.reduce((n, b) => n + b.items.length, 0)
  const recent = [...leads].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 6)

  return (
    <>
      {welcome && (
        <div className="welcome-banner">
          <span>👋 Welcome{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}! The tracker gets regular upgrades — see what's changed on the <Link to="/whats-new">What's New</Link> page.</span>
          <button onClick={dismissWelcome} aria-label="Dismiss">✕</button>
        </div>
      )}

      <div className="page-head">
        <div>
          <div className="eyebrow">Overview</div>
          <h1>Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {(profile?.name || '').split(' ')[0]}</h1>
          <div className="sub">Live view of every bathroom lead — nothing gets missed.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/import" className="btn ghost">↥ Import CRM Leads</Link>
          <Link to="/leads/new" className="btn gold">＋ Add Lead</Link>
        </div>
      </div>

      {/* HERO metric + supporting stats */}
      <div className="hero-grid">
        <div className="hero">
          <div className="hero-label">Total pipeline value</div>
          <div className="hero-row">
            <div className="hero-num">{money(animated)}</div>
            {trendPct !== null && (
              <span className={`trend ${trendPct >= 0 ? 'up' : 'down'}`}>
                {trendPct >= 0 ? '▲' : '▼'} {Math.abs(trendPct)}% vs last month
              </span>
            )}
          </div>
          <div className="hero-sub">{active.length} active leads · {nThis} new this month</div>
        </div>
        <Stat n={awaitingForms} label="Awaiting selection forms" tone="blue" />
        <Stat n={cadInProgress} label="CAD in progress" tone="purple" />
        <Stat n={cadAwaiting} label="Designs awaiting approval" tone="gold" />
        <Stat n={`${convRate}%`} label="Conversion rate" tone="green" />
      </div>

      {/* PIPELINE — segmented funnel bar */}
      <div className="pipebar animate">
        {groups.map(g => (
          <Link key={g.key} className="seg-wrap" to={g.key === 'won' ? '/leads?stage=Won' : `/leads?group=${g.key}`}>
            <div className="seg-bar" style={{ background: g.color, opacity: 0.25 + 0.75 * (g.n / maxN) }} />
            <div className="seg-name" style={{ color: g.color }}>{g.label}</div>
            <div className="seg-meta">{g.n} · {money(g.value)}</div>
          </Link>
        ))}
      </div>

      {/* TODAY'S ACTIONS — the most important part */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-head">
          <h2>Today's Actions {totalActions > 0 && <span className="badge red" style={{ marginLeft: 8 }}>{totalActions} need attention</span>}</h2>
          <Link to="/actions" className="btn sm ghost">View all</Link>
        </div>
        <div className="card-body">
          {totalActions === 0
            ? <p className="muted" style={{ margin: 0 }}>All caught up — no outstanding actions today. ✓</p>
            : <div className="actions-board">
                {buckets.map(b => (
                  <div className="action-group" key={b.key}>
                    <header><span className={`dot ${b.color}`} />{b.label}<span className="count">{b.items.length}</span></header>
                    {b.items.slice(0, 3).map(({ lead, d }) => (
                      <Link className="action-item" key={lead.id} to={`/leads/${lead.id}`}>
                        <b>{lead.customer_name}</b><span>{d.nextAction}</span>
                      </Link>
                    ))}
                    {b.items.length > 3 && <Link className="action-item muted small" to="/actions">+ {b.items.length - 3} more…</Link>}
                  </div>
                ))}
              </div>}
        </div>
      </div>

      <div className="grid two-col" style={{ marginBottom: 24 }}>
        {/* CHART — leads over the last 30 days */}
        <div className="card">
          <div className="card-head"><h2>New leads — last 30 days</h2></div>
          <div className="card-body" style={{ paddingBottom: 16 }}>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={series} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f3ab2d" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#f3ab2d" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" interval={6} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ stroke: 'rgba(255,255,255,0.12)' }}
                  contentStyle={{ background: '#1c1c22', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#f4f4f6' }} />
                <Area type="monotone" dataKey="leads" stroke="#f3ab2d" strokeWidth={2} fill="url(#heroFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Where the pipeline is backing up */}
        <div className="card">
          <div className="card-head"><h2>Pipeline bottlenecks</h2><Link className="btn sm ghost" to="/leads?view=table">All leads</Link></div>
          <div className="card-body" style={{ paddingTop: 8 }}>
            {bottlenecks.length === 0
              ? <p className="muted">Nothing active in the pipeline.</p>
              : <>
                  <p className="muted small" style={{ marginTop: 0 }}>
                    {worst && worst.stuck > 0
                      ? <>Biggest hold-up: <b style={{ color: 'var(--stage-lost)' }}>{worst.stage}</b> — {worst.stuck} lead{worst.stuck === 1 ? '' : 's'} past the {worst.target}-day target.</>
                      : <>Nothing over target — the pipeline is flowing well.</>}
                  </p>
                  {bottlenecks.slice(0, 6).map(b => {
                    const pct = maxCount ? Math.round((b.count / maxCount) * 100) : 0
                    return (
                      <Link key={b.stage} to={`/leads?stage=${encodeURIComponent(b.stage)}`} className="bneck">
                        <div className="bn-top">
                          <span className="bn-stage">{b.stage}</span>
                          <span className="bn-nums">
                            {b.stuck > 0 && <em title={`Over the ${b.target}-day target`}>{b.stuck} stuck</em>}
                            <b>{b.count}</b>
                          </span>
                        </div>
                        <div className="bn-track"><div className="bn-fill" style={{ width: `${pct}%`, background: b.stuck > 0 ? 'var(--stage-lost)' : 'var(--stage-new)' }} /></div>
                        <div className="bn-meta">avg {b.avgDays}d in stage{b.target ? ` · target ${b.target}d` : ''}</div>
                      </Link>
                    )
                  })}
                </>}
          </div>
        </div>

        {/* Live team activity feed */}
        <div className="card">
          <div className="card-head"><h2>Latest activity</h2><Link className="btn sm ghost" to="/leads">All leads</Link></div>
          <div className="card-body feed" style={{ paddingTop: 8 }}>
            {feed.map(a => (
              <Link key={a.id} to={`/leads/${a.lead_id}`} className="feed-item">
                <span className={`dot ${FEED_DOT[a.type] || 'grey'}`} />
                <div className="feed-text">
                  <span><b>{a.actor || 'System'}</b> — {a.message}</span>
                  <span className="muted small">{a.leads?.customer_name || 'Lead'} · {timeAgo(a.created_at)}</span>
                </div>
              </Link>
            ))}
            {feed.length === 0 && <p className="muted">No activity yet — it will appear here as the team works.</p>}
          </div>
        </div>
      </div>

      {/* Won / lost / money summary */}
      <div className="grid stats-grid">
        <Stat n={won.length} label="Jobs won" tone="green" />
        <Stat n={lost.length} label="Jobs lost" tone="red" />
        <Stat n={money(wonRev)} label="Won revenue" tone="green" />
        <Stat n={money(profit)} label="Estimated profit (won)" tone="green" />
      </div>
    </>
  )
}
