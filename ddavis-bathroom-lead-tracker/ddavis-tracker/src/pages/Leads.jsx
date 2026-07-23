import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../App'
import { supabase, logActivity } from '../lib/supabase'
import { LeadCard, StageBadge, StageSelect, PriorityBadge, IdleBadge, Empty } from '../components/ui'
import { STAGES, PRE_SURVEY_STAGES, BATHROOM_TYPES, LEAD_SOURCES, STAGE_GROUPS, derive, fmtDate, money, today } from '../lib/logic'
import { fireConfetti } from '../lib/confetti'

export default function Leads() {
  const { leads, loading, profile, notify, refresh } = useApp()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState('cards')
  const [sel, setSel] = useState(() => new Set())
  const [bulkStage, setBulkStage] = useState('')
  const [busy, setBusy] = useState(false)

  const q = params.get('q') || ''
  const f = key => params.get(key) || ''
  const setF = (key, val) => {
    const p = new URLSearchParams(params)
    val ? p.set(key, val) : p.delete(key)
    setParams(p, { replace: true })
  }

  const surveyors = useMemo(() => [...new Set(leads.map(l => l.surveyor).filter(Boolean))], [leads])
  const designers = useMemo(() => [...new Set(leads.map(l => l.cad_designer).filter(Boolean))], [leads])

  const filtered = useMemo(() => leads.map(l => ({ lead: l, d: derive(l) })).filter(({ lead, d }) => {
    if (q) {
      const hay = [lead.customer_name, lead.phone, lead.email, lead.postcode, lead.address].join(' ').toLowerCase()
      if (!hay.includes(q.toLowerCase())) return false
    }
    if (f('stage') && lead.stage !== f('stage')) return false
    if (f('group') && !(STAGE_GROUPS[f('group')] || []).includes(lead.stage)) return false
    if (f('surveyor') && lead.surveyor !== f('surveyor')) return false
    if (f('designer') && lead.cad_designer !== f('designer')) return false
    if (f('source') && lead.lead_source !== f('source')) return false
    if (f('type') && lead.bathroom_type !== f('type')) return false
    if (f('priority') && d.priority !== f('priority')) return false
    if (f('overdue') === '1' && !d.flags.overdue) return false
    if (f('status') === 'won' && lead.stage !== 'Won') return false
    if (f('status') === 'lost' && lead.stage !== 'Lost') return false
    if (f('status') === 'active' && (lead.stage === 'Won' || lead.stage === 'Lost')) return false
    if (f('from') && new Date(lead.created_at) < new Date(f('from'))) return false
    if (f('to') && new Date(lead.created_at) > new Date(f('to') + 'T23:59:59')) return false
    return true
  }), [leads, params])

  if (loading) return <p className="muted">Loading…</p>

  const toggleSel = id => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allShown = filtered.map(({ lead }) => lead.id)
  const allSelected = allShown.length > 0 && allShown.every(id => sel.has(id))
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(allShown))
  const clearSel = () => setSel(new Set())

  async function bulkMove() {
    if (!bulkStage || sel.size === 0) return
    setBusy(true)
    const ids = [...sel]
    const patch = { stage: bulkStage }
    if (PRE_SURVEY_STAGES.includes(bulkStage)) patch.survey_completed = false
    if (bulkStage === 'Survey Complete') patch.survey_completed = true
    if (bulkStage === 'Won') patch.quote_outcome = 'accepted'
    if (bulkStage === 'Lost') patch.lost_reason = 'Other'
    const { error } = await supabase.from('leads').update(patch).in('id', ids)
    setBusy(false)
    if (error) return notify('Bulk update failed — ' + error.message)
    await Promise.all(ids.map(id => logActivity(id, 'stage', `Stage changed to ${bulkStage} (bulk update)`, profile?.name)))
    await refresh()
    if (bulkStage === 'Won') fireConfetti()
    notify(`${ids.length} lead${ids.length === 1 ? '' : 's'} moved to ${bulkStage} ✓`)
    clearSel(); setBulkStage('')
  }

  async function bulkDelete() {
    if (sel.size === 0) return
    const ids = [...sel]
    const sure = window.confirm(`Delete ${ids.length} lead${ids.length === 1 ? '' : 's'}?\n\nThis permanently removes them plus all follow-ups, timeline history and files. This cannot be undone.`)
    if (!sure) return
    const check = window.prompt(`Type DELETE to confirm removing ${ids.length} lead${ids.length === 1 ? '' : 's'}:`)
    if (check !== 'DELETE') return notify('Delete cancelled')
    setBusy(true)
    // Remove any storage files first — the database rows cascade automatically
    const { data: fileRows } = await supabase.from('lead_files').select('storage_path').in('lead_id', ids)
    const paths = (fileRows || []).map(f => f.storage_path).filter(Boolean)
    if (paths.length) await supabase.storage.from('lead-files').remove(paths)
    const { error } = await supabase.from('leads').delete().in('id', ids)
    setBusy(false)
    if (error) return notify('Delete failed — ' + error.message)
    await refresh()
    notify(`${ids.length} lead${ids.length === 1 ? '' : 's'} deleted`)
    clearSel()
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Pipeline</div>
          <h1>All Leads</h1>
          <div className="sub">{filtered.length} of {leads.length} leads</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/import" className="btn ghost">↥ Import CRM Leads</Link>
          <Link to="/leads/new" className="btn gold">＋ Add New Lead</Link>
        </div>
      </div>

      <div className="filterbar">
        <input type="search" placeholder="Search name, phone, email, postcode, address…" value={q} onChange={e => setF('q', e.target.value)} />
        <select value={f('stage')} onChange={e => setF('stage', e.target.value)}>
          <option value="">All stages</option>{STAGES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={f('status')} onChange={e => setF('status', e.target.value)}>
          <option value="">Won / lost / active</option>
          <option value="active">In progress</option><option value="won">Won</option><option value="lost">Lost</option>
        </select>
        <select value={f('priority')} onChange={e => setF('priority', e.target.value)}>
          <option value="">All priorities</option>
          {['Critical', 'High', 'Medium', 'Low'].map(p => <option key={p}>{p}</option>)}
        </select>
        <select value={f('surveyor')} onChange={e => setF('surveyor', e.target.value)}>
          <option value="">All surveyors</option>{surveyors.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={f('designer')} onChange={e => setF('designer', e.target.value)}>
          <option value="">All CAD designers</option>{designers.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={f('source')} onChange={e => setF('source', e.target.value)}>
          <option value="">All sources</option>{LEAD_SOURCES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={f('type')} onChange={e => setF('type', e.target.value)}>
          <option value="">All bathroom types</option>{BATHROOM_TYPES.map(s => <option key={s}>{s}</option>)}
        </select>
        <input type="date" value={f('from')} onChange={e => setF('from', e.target.value)} title="Added from" />
        <input type="date" value={f('to')} onChange={e => setF('to', e.target.value)} title="Added to" />
        <label className="check" style={{ margin: 0 }}>
          <input type="checkbox" checked={f('overdue') === '1'} onChange={e => setF('overdue', e.target.checked ? '1' : '')} /> Overdue only
        </label>
        <div className="seg" role="tablist">
          <button className={view === 'cards' ? 'on' : ''} onClick={() => setView('cards')}>Cards</button>
          <button className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>Table</button>
        </div>
      </div>

      {filtered.length === 0 && <div className="card"><Empty title="No leads yet" cta="＋ Add Lead" ctaTo="/leads/new">Try clearing a filter, import from your CRM, or add a lead.</Empty></div>}

      {view === 'cards' && (
        <div className="lead-cards animate">{filtered.map(({ lead }) => <LeadCard key={lead.id} lead={lead} />)}</div>
      )}

      {view === 'table' && sel.size > 0 && (
        <div className="card" style={{ marginBottom: 10 }}>
          <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '12px 16px' }}>
            <b>{sel.size} selected</b>
            <select value={bulkStage} onChange={e => setBulkStage(e.target.value)} style={{ maxWidth: 220 }}>
              <option value="">Move to stage…</option>
              {STAGES.map(s => <option key={s}>{s}</option>)}
            </select>
            <button className="btn sm gold" disabled={!bulkStage || busy} onClick={bulkMove}>{busy ? 'Working…' : 'Apply'}</button>
            <button className="btn sm danger" disabled={busy} onClick={bulkDelete}>Delete selected</button>
            <button className="btn sm ghost" onClick={clearSel}>Clear</button>
          </div>
        </div>
      )}

      {view === 'table' && filtered.length > 0 && (
        <div className="card table-wrap">
          <table className="data">
            <thead><tr>
              <th style={{ width: 34 }}><input type="checkbox" checked={allSelected} onChange={toggleAll} title="Select all shown" /></th>
              <th>Customer</th><th>Contact</th><th>Stage</th><th>Idle</th><th>Survey</th><th>Surveyor</th>
              <th>Next action</th><th>Priority</th><th>Chases</th><th>Value</th><th>Profit</th>
            </tr></thead>
            <tbody>
              {filtered.map(({ lead, d }) => (
                <tr key={lead.id} className="click" onClick={() => nav(`/leads/${lead.id}`)}>
                  <td onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={sel.has(lead.id)} onChange={() => toggleSel(lead.id)} />
                  </td>
                  <td><b>{lead.customer_name}</b><div className="muted small">{lead.postcode || ''} · {lead.lead_source || '—'} · {lead.bathroom_type || '—'}</div></td>
                  <td className="small">{lead.phone || '—'}<div className="muted">{lead.email || ''}</div></td>
                  <td onClick={e => e.stopPropagation()}><StageSelect lead={lead} /></td>
                  <td><IdleBadge lead={lead} /></td>
                  <td className="small">{fmtDate(lead.survey_completed_date)}</td>
                  <td className="small">{lead.surveyor || '—'}</td>
                  <td className="small">{d.nextAction}</td>
                  <td><PriorityBadge priority={d.priority} /></td>
                  <td>{(lead.chase_attempts || 0) + (lead.quote_chase_attempts || 0)}</td>
                  <td>{money(lead.quote_value ?? lead.estimated_value)}</td>
                  <td>{money(lead.estimated_profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
