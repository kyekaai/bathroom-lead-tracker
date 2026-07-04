import { Link } from 'react-router-dom'
import { useApp } from '../App'
import { Stat, StageBadge, PriorityBadge } from '../components/ui'
import { buildTodaysActions, derive, money, fmtDate } from '../lib/logic'

export default function Dashboard() {
  const { leads, loading, profile } = useApp()
  if (loading) return <p className="muted">Loading live data…</p>

  const active = leads.filter(l => l.stage !== 'Won' && l.stage !== 'Lost')
  const won = leads.filter(l => l.stage === 'Won')
  const lost = leads.filter(l => l.stage === 'Lost')
  const is = s => leads.filter(l => l.stage === s).length

  const surveysBooked = leads.filter(l => l.survey_booked_date && !l.survey_completed).length
  const surveysDone = leads.filter(l => l.survey_completed).length
  const awaitingForms = leads.filter(l => l.survey_completed && !l.selection_form_returned && l.stage !== 'Won' && l.stage !== 'Lost').length
  const formsBack = leads.filter(l => l.selection_form_returned).length
  const cadRequired = leads.filter(l => l.cad_required === 'yes' && ['not booked'].includes(l.cad_status)).length
  const cadInProgress = leads.filter(l => ['booked', 'in progress', 'revisions requested'].includes(l.cad_status)).length
  const cadDone = leads.filter(l => ['approved', 'sent to customer'].includes(l.cad_status)).length
  const quotesSent = leads.filter(l => l.quote_sent).length
  const quotesChase = leads.filter(l => derive(l).flags.followUpQuote).length

  const decided = won.length + lost.length
  const convRate = decided ? Math.round(won.length / decided * 100) : 0
  const pipeline = active.reduce((s, l) => s + Number(l.quote_value ?? l.estimated_value ?? 0), 0)
  const wonRev = won.reduce((s, l) => s + Number(l.quote_value ?? l.estimated_value ?? 0), 0)
  const profit = won.reduce((s, l) => s + Number(l.estimated_profit ?? 0), 0)

  const buckets = buildTodaysActions(leads)
  const totalActions = buckets.reduce((n, b) => n + b.items.length, 0)

  const recent = [...leads].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 6)

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Overview</div>
          <h1>Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {(profile?.name || '').split(' ')[0]}</h1>
          <div className="sub">Live view of every bathroom lead — nothing gets missed.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/import" className="btn ghost">↥ Import CRM Leads</Link>
          <Link to="/leads/new" className="btn gold">＋ Add New Lead</Link>
        </div>
      </div>

      {/* TODAY'S ACTIONS — the most important part */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-head">
          <h2>⚑ Today's Actions {totalActions > 0 && <span className="badge red" style={{ marginLeft: 8 }}>{totalActions} need attention</span>}</h2>
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

      {/* KPI grid */}
      <div className="grid stats-grid" style={{ marginBottom: 18 }}>
        <Stat n={active.length} label="Active bathroom leads" />
        <Stat n={surveysBooked} label="Surveys booked" tone="blue" />
        <Stat n={surveysDone} label="Surveys completed" tone="green" />
        <Stat n={awaitingForms} label="Awaiting selection forms" tone="amber" />
        <Stat n={formsBack} label="Selection forms returned" tone="green" />
        <Stat n={cadRequired} label="CAD designs required" tone="amber" />
        <Stat n={cadInProgress} label="CAD in progress" tone="blue" />
        <Stat n={cadDone} label="CAD completed / sent" tone="green" />
        <Stat n={quotesSent} label="Quotes sent" tone="blue" />
        <Stat n={quotesChase} label="Quotes needing follow-up" tone="amber" />
        <Stat n={won.length} label="Jobs won" tone="green" />
        <Stat n={lost.length} label="Jobs lost" tone="red" />
        <Stat n={`${convRate}%`} label="Conversion rate (won vs decided)" tone="gold" />
        <Stat n={money(pipeline)} label="Total pipeline value" tone="gold" />
        <Stat n={money(wonRev)} label="Won revenue" tone="green" />
        <Stat n={money(profit)} label="Estimated profit (won)" tone="green" />
      </div>

      <div className="grid two-col">
        <div className="card">
          <div className="card-head"><h2>Pipeline by stage</h2><Link className="btn sm ghost" to="/leads">All leads</Link></div>
          <div className="card-body">
            {['New Lead','Survey Booked','Survey Complete','Awaiting Selection Form','Selection Form Received','CAD Required','CAD Booked','CAD In Progress','CAD Sent','CAD Revisions Required','CAD Approved','Quote Sent','Quote Follow Up'].map(s => {
              const n = is(s); if (!n) return null
              return (
                <Link key={s} to={`/leads?stage=${encodeURIComponent(s)}`} className="spread" style={{ padding: '7px 0', textDecoration: 'none', borderBottom: '1px solid var(--line)' }}>
                  <StageBadge stage={s} /><b>{n}</b>
                </Link>
              )
            })}
            {active.length === 0 && <p className="muted">No active leads yet — import from your CRM or add one manually.</p>}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Recently updated</h2></div>
          <div className="card-body" style={{ paddingTop: 8 }}>
            {recent.map(l => {
              const d = derive(l)
              return (
                <Link key={l.id} to={`/leads/${l.id}`} className="spread" style={{ padding: '9px 0', textDecoration: 'none', borderBottom: '1px solid var(--line)' }}>
                  <div>
                    <b style={{ fontSize: 13.5 }}>{l.customer_name}</b>
                    <div className="muted small">{d.nextAction}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <StageBadge stage={l.stage} />
                    <div className="muted small">{fmtDate(l.updated_at)}</div>
                  </div>
                </Link>
              )
            })}
            {recent.length === 0 && <p className="muted">Nothing here yet.</p>}
          </div>
        </div>
      </div>
    </>
  )
}
