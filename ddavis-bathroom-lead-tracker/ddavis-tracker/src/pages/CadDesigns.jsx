import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../App'
import { supabase, logActivity } from '../lib/supabase'
import { fmtDate, money, isPast, timeAgo } from '../lib/logic'
import { Empty, SkeletonCards } from '../components/ui'

const COLS = [
  { key: 'not booked',          label: 'To book',      color: 'var(--stage-quoted)' },
  { key: 'booked',              label: 'Booked',       color: 'var(--stage-new)' },
  { key: 'in progress',         label: 'In progress',  color: 'var(--stage-contact)' },
  { key: 'sent to customer',    label: 'Sent',         color: 'var(--stage-new)' },
  { key: 'revisions requested', label: 'Revisions',    color: 'var(--stage-lost)' },
  { key: 'approved',            label: 'Approved',     color: 'var(--stage-won)' },
]

// CAD status → lead stage, so the board and the pipeline stay in step
const CAD_TO_STAGE = {
  'not booked': 'CAD Required',
  'booked': 'CAD Booked',
  'in progress': 'CAD In Progress',
  'sent to customer': 'CAD Sent',
  'revisions requested': 'CAD Revisions Required',
  'approved': 'CAD Approved',
}

export default function CadDesigns() {
  const { leads, loading, profile, notify, refresh } = useApp()
  const nav = useNavigate()
  const [dragId, setDragId] = useState(null)
  const [overCol, setOverCol] = useState(null)

  if (loading) return <SkeletonCards n={6} />

  const cadLeads = leads.filter(l =>
    l.cad_required === 'yes' && l.stage !== 'Won' && l.stage !== 'Lost' && l.cad_status !== 'not required')
  const totalValue = cadLeads.reduce((s, l) => s + Number(l.quote_value ?? l.estimated_value ?? 0), 0)

  async function drop(status) {
    setOverCol(null)
    const lead = cadLeads.find(l => l.id === dragId)
    setDragId(null)
    if (!lead || lead.cad_status === status) return
    const patch = { cad_status: status, stage: CAD_TO_STAGE[status], stage_changed_at: new Date().toISOString() }
    if (status === 'approved') patch.cad_completed_date = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('leads').update(patch).eq('id', lead.id)
    if (error) return notify('Could not move card — ' + error.message)
    await logActivity(lead.id, 'cad', `CAD moved to ${status} (board)`, profile?.name)
    await refresh()
    notify(`${lead.customer_name} → ${COLS.find(c => c.key === status)?.label} ✓`)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Design pipeline</div>
          <h1>CAD Designs</h1>
          <div className="sub">{cadLeads.length} live CAD job{cadLeads.length === 1 ? '' : 's'} · {money(totalValue)} in design — drag a card to move it, tap to open.</div>
        </div>
      </div>

      {cadLeads.length === 0
        ? <div className="card"><Empty title="No CAD work in the pipeline">Mark a lead as "CAD required: yes" and it will appear here.</Empty></div>
        : <div className="cadboard">
            {COLS.map(c => {
              const items = cadLeads.filter(l => l.cad_status === c.key)
              const value = items.reduce((s, l) => s + Number(l.quote_value ?? l.estimated_value ?? 0), 0)
              return (
                <div className={`col2 ${overCol === c.key ? 'drop-over' : ''}`} key={c.key}
                  style={{ '--col-color': c.color }}
                  onDragOver={e => { e.preventDefault(); setOverCol(c.key) }}
                  onDragLeave={() => setOverCol(o => o === c.key ? null : o)}
                  onDrop={() => drop(c.key)}>
                  <header>
                    <span className="c2-title">{c.label}</span>
                    <span className="c2-count">{items.length}</span>
                    {value > 0 && <span className="c2-value">{money(value)}</span>}
                  </header>

                  <div className="c2-cards">
                    {items.map(l => {
                      const late = c.key === 'booked' && isPast(l.cad_booked_date)
                      const val = Number(l.quote_value ?? l.estimated_value ?? 0)
                      return (
                        <div className={`kcard2 ${dragId === l.id ? 'dragging' : ''}`} key={l.id}
                          draggable onDragStart={() => setDragId(l.id)} onDragEnd={() => setDragId(null)}
                          onClick={() => nav(`/leads/${l.id}`)} role="button" tabIndex={0}
                          onKeyDown={e => e.key === 'Enter' && nav(`/leads/${l.id}`)}>
                          <div className="k2-top">
                            <b>{l.customer_name}</b>
                            {late && <span className="k2-hot">LATE</span>}
                          </div>
                          <div className="k2-time">{timeAgo(l.updated_at)}</div>
                          <div className="k2-rows">
                            <span>🛁 {l.bathroom_type || 'Bathroom'}</span>
                            {l.postcode && <span>📍 {l.postcode}</span>}
                          </div>
                          {l.cad_booked_date && c.key !== 'approved' &&
                            <div className={`k2-date ${late ? 'late' : ''}`}>📅 {late ? 'Was booked ' : 'Booked '}{fmtDate(l.cad_booked_date)}</div>}
                          {val > 0 && <div className="k2-value">{money(val)}</div>}
                          <div className="k2-chips">
                            {l.lead_source && <span className="k2-chip">{l.lead_source}</span>}
                            {l.cad_designer
                              ? <span className="k2-chip designer">✏️ {l.cad_designer}</span>
                              : <span className="k2-chip warn">⚠ No designer</span>}
                            {l.cad_revision_count > 0 && <span className="k2-chip warn">rev {l.cad_revision_count}</span>}
                          </div>
                        </div>
                      )
                    })}
                    {items.length === 0 && <div className="k-empty">Drop a card here</div>}
                  </div>
                </div>
              )
            })}
          </div>}
    </>
  )
}
