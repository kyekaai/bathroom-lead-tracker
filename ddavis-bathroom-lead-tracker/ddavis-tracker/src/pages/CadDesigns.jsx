import { Link } from 'react-router-dom'
import { useApp } from '../App'
import { fmtDate } from '../lib/logic'
import { Empty } from '../components/ui'

const COLS = [
  { key: 'not booked', label: 'To book', color: 'amber' },
  { key: 'booked', label: 'Booked', color: 'blue' },
  { key: 'in progress', label: 'In progress', color: 'blue' },
  { key: 'sent to customer', label: 'Sent — awaiting approval', color: 'blue' },
  { key: 'revisions requested', label: 'Revisions requested', color: 'amber' },
  { key: 'approved', label: 'Approved', color: 'green' },
]

export default function CadDesigns() {
  const { leads, loading } = useApp()
  if (loading) return <p className="muted">Loading…</p>

  const cadLeads = leads.filter(l =>
    l.cad_required === 'yes' && l.stage !== 'Won' && l.stage !== 'Lost' && l.cad_status !== 'not required')

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Design pipeline</div>
          <h1>CAD Designs</h1>
          <div className="sub">{cadLeads.length} live CAD job{cadLeads.length === 1 ? '' : 's'} — update status inside each lead's CAD tab.</div>
        </div>
      </div>

      {cadLeads.length === 0
        ? <div className="card"><Empty title="No CAD work in the pipeline">Mark a lead as "CAD required: yes" and it will appear here.</Empty></div>
        : <div className="kanban">
            {COLS.map(c => {
              const items = cadLeads.filter(l => l.cad_status === c.key)
              return (
                <div className="col" key={c.key}>
                  <header><span><span className={`dot ${c.color}`} style={{ marginRight: 6 }} />{c.label}</span><span>{items.length}</span></header>
                  {items.map(l => (
                    <Link className="kcard" key={l.id} to={`/leads/${l.id}`}>
                      <b>{l.customer_name}</b>
                      <span>{l.cad_designer ? `Designer: ${l.cad_designer}` : 'No designer assigned'}</span><br />
                      <span>{l.cad_booked_date ? `Booked ${fmtDate(l.cad_booked_date)}` : ''}{l.cad_revision_count ? ` · rev ${l.cad_revision_count}` : ''}</span>
                    </Link>
                  ))}
                  {items.length === 0 && <p className="muted small" style={{ padding: '4px 6px' }}>—</p>}
                </div>
              )
            })}
          </div>}
    </>
  )
}
