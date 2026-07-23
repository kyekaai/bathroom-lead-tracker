import { Link } from 'react-router-dom'
import { useApp } from '../App'
import { buildTodaysActions, timeAgo } from '../lib/logic'
import { StageBadge, PriorityBadge, Empty } from '../components/ui'
import { waNumber } from '../lib/docs'

const P_WEIGHT = { Critical: 0, High: 1, Medium: 2, Low: 3 }

export default function TodaysActions() {
  const { leads, loading } = useApp()
  if (loading) return <p className="muted">Loading…</p>

  const buckets = buildTodaysActions(leads)
  const total = buckets.reduce((n, b) => n + b.items.length, 0)
  const critical = buckets.reduce((n, b) => n + b.items.filter(x => x.d.priority === 'Critical').length, 0)
  const high = buckets.reduce((n, b) => n + b.items.filter(x => x.d.priority === 'High').length, 0)

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Work the list, top to bottom</div>
          <h1>Today's Actions</h1>
          <div className="sub">{total === 0 ? 'Nothing outstanding.' : `${total} lead${total === 1 ? '' : 's'} need attention · ${critical} critical · ${high} high priority`}</div>
        </div>
      </div>

      {total > 0 && (
        <div className="ta-summary">
          {buckets.filter(b => b.items.length > 0).map(b => (
            <a key={b.key} href={`#ta-${b.key}`} className="ta-pill" style={{ '--pc': `var(--stage-${b.color === 'amber' ? 'quoted' : b.color === 'red' ? 'lost' : b.color === 'blue' ? 'new' : b.color === 'purple' ? 'contact' : b.color === 'green' ? 'won' : 'quoted'})` }}>
              <b>{b.items.length}</b><span>{b.label}</span>
            </a>
          ))}
        </div>
      )}

      {total === 0 && <div className="card"><Empty title="All caught up ✓">No selection forms to chase, no overdue follow-ups, no quotes waiting.</Empty></div>}

      {buckets.filter(b => b.items.length > 0).map(b => {
        const items = [...b.items].sort((a, z) => (P_WEIGHT[a.d.priority] ?? 9) - (P_WEIGHT[z.d.priority] ?? 9))
        return (
          <div className="card ta-card" id={`ta-${b.key}`} style={{ marginBottom: 14, '--bc': `var(--stage-${b.color === 'amber' ? 'quoted' : b.color === 'red' ? 'lost' : b.color === 'blue' ? 'new' : b.color === 'purple' ? 'contact' : b.color === 'green' ? 'won' : 'quoted'})` }} key={b.key}>
            <div className="card-head">
              <h2><span className="dot" style={{ background: 'var(--bc)', marginRight: 8 }} />{b.label}</h2>
              <span className="ta-count">{items.length}</span>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Customer</th><th>Stage</th><th>Priority</th><th>Next action</th><th>Last activity</th><th></th></tr></thead>
                <tbody>
                  {items.map(({ lead, d }) => (
                    <tr key={lead.id}>
                      <td><b>{lead.customer_name}</b><div className="muted small">{lead.postcode || lead.address || ''}</div></td>
                      <td><StageBadge stage={lead.stage} /></td>
                      <td><PriorityBadge priority={d.priority} /></td>
                      <td>{d.nextAction}</td>
                      <td className="small muted">{timeAgo(lead.updated_at)}</td>
                      <td className="right" style={{ whiteSpace: 'nowrap' }}>
                        {lead.phone && <a className="btn sm ghost" href={`tel:${lead.phone}`} title="Call">📞</a>}
                        {waNumber(lead.phone) && <a className="btn sm ghost" style={{ marginLeft: 4 }} href={`https://wa.me/${waNumber(lead.phone)}`} target="_blank" rel="noreferrer" title="WhatsApp">🟢</a>}
                        <Link to={`/leads/${lead.id}`} className="btn sm primary" style={{ marginLeft: 4 }}>Open</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </>
  )
}
