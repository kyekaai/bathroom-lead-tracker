import { Link } from 'react-router-dom'
import { useApp } from '../App'
import { buildTodaysActions } from '../lib/logic'
import { StageBadge, PriorityBadge, Empty } from '../components/ui'

export default function TodaysActions() {
  const { leads, loading } = useApp()
  if (loading) return <p className="muted">Loading…</p>

  const buckets = buildTodaysActions(leads)
  const total = buckets.reduce((n, b) => n + b.items.length, 0)

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Work the list, top to bottom</div>
          <h1>Today's Actions</h1>
          <div className="sub">{total === 0 ? 'Nothing outstanding.' : `${total} lead${total === 1 ? '' : 's'} need attention. Tap one to open it.`}</div>
        </div>
      </div>

      {total === 0 && <div className="card"><Empty title="All caught up ✓">No selection forms to chase, no overdue follow-ups, no quotes waiting.</Empty></div>}

      {buckets.map(b => (
        <div className="card" style={{ marginBottom: 14 }} key={b.key}>
          <div className="card-head"><h2><span className={`dot ${b.color}`} style={{ marginRight: 8 }} />{b.label} ({b.items.length})</h2></div>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Customer</th><th>Stage</th><th>Priority</th><th>Next action</th><th></th></tr></thead>
              <tbody>
                {b.items.map(({ lead, d }) => (
                  <tr key={lead.id}>
                    <td><b>{lead.customer_name}</b><div className="muted small">{lead.postcode || lead.address || ''}</div></td>
                    <td><StageBadge stage={lead.stage} /></td>
                    <td><PriorityBadge priority={d.priority} /></td>
                    <td>{d.nextAction}</td>
                    <td className="right"><Link to={`/leads/${lead.id}`} className="btn sm primary">Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  )
}
