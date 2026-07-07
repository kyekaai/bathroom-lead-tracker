import { Link } from 'react-router-dom'
import { useApp } from '../App'
import { Empty } from '../components/ui'
import { fmtDate, today } from '../lib/logic'

// Builds a date-keyed agenda from lead data:
// follow-ups due · overdue follow-ups · CAD appointments · quote chases · surveys booked
export default function Calendar() {
  const { leads, loading } = useApp()
  if (loading) return <p className="muted">Loading…</p>

  const active = leads.filter(l => l.stage !== 'Won' && l.stage !== 'Lost')
  const tasks = []
  for (const l of active) {
    if (l.next_chase_date) tasks.push({ date: l.next_chase_date, what: 'Chase selection form', lead: l, color: 'amber' })
    if (l.next_quote_chase_date) tasks.push({ date: l.next_quote_chase_date, what: 'Follow up quote', lead: l, color: 'amber' })
    if (l.cad_booked_date && ['booked', 'in progress'].includes(l.cad_status)) tasks.push({ date: l.cad_booked_date, what: `CAD appointment${l.cad_designer ? ` — ${l.cad_designer}` : ''}`, lead: l, color: 'blue' })
  }

  const t = today()
  const overdue = tasks.filter(x => x.date < t).sort((a, b) => a.date.localeCompare(b.date))
  const todays = tasks.filter(x => x.date === t)
  const upcoming = tasks.filter(x => x.date > t).sort((a, b) => a.date.localeCompare(b.date))

  const byDay = {}
  for (const x of upcoming) (byDay[x.date] = byDay[x.date] || []).push(x)

  const Task = ({ x, overdue }) => (
    <Link to={`/leads/${x.lead.id}`} className="task">
      <span className={`dot ${overdue ? 'red' : x.color}`} />
      <div>
        <div className="t-what">{x.what}</div>
        <div className="t-who">{x.lead.customer_name}{x.lead.postcode ? ` · ${x.lead.postcode}` : ''}</div>
      </div>
      <span className={`badge ${overdue ? 'red' : 'grey'}`}>{overdue ? `${fmtDate(x.date)} — overdue` : fmtDate(x.date)}</span>
    </Link>
  )

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">What's booked in</div>
          <h1>Calendar & Tasks</h1>
          <div className="sub">Follow-ups, CAD appointments, quote chases and surveys — pulled straight from the leads.</div>
        </div>
      </div>

      {overdue.length > 0 && (
        <div className="agenda-day">
          <h3 style={{ color: 'var(--stage-lost)' }}>⚠ Overdue ({overdue.length})</h3>
          {overdue.map((x, i) => <Task key={i} x={x} overdue />)}
        </div>
      )}

      <div className="agenda-day today">
        <h3>Today — {fmtDate(t)}</h3>
        {todays.length === 0 ? <p className="muted small">Nothing scheduled today.</p> : todays.map((x, i) => <Task key={i} x={x} />)}
      </div>

      {Object.entries(byDay).slice(0, 21).map(([date, items]) => (
        <div className="agenda-day" key={date}>
          <h3>{new Date(date).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short' })}</h3>
          {items.map((x, i) => <Task key={i} x={x} />)}
        </div>
      ))}

      {tasks.length === 0 && <div className="card"><Empty title="No scheduled tasks">Set follow-up dates and CAD bookings on leads and they'll show here automatically.</Empty></div>}
    </>
  )
}
