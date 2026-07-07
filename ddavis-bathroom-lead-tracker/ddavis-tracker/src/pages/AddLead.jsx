import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, logActivity } from '../lib/supabase'
import { useApp } from '../App'
import { BATHROOM_TYPES, LEAD_SOURCES } from '../lib/logic'

const BLANK = {
  customer_name: '', address: '', postcode: '', phone: '', email: '',
  lead_source: '', bathroom_type: '', survey_completed_date: new Date().toISOString().slice(0, 10),
  surveyor: '', estimated_value: '', estimated_profit: '', notes: '',
}

export default function AddLead() {
  const nav = useNavigate()
  const { profile, notify, refresh } = useApp()
  const [f, setF] = useState(BLANK)
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    const row = {
      ...f,
      estimated_value: f.estimated_value === '' ? null : Number(f.estimated_value),
      estimated_profit: f.estimated_profit === '' ? null : Number(f.estimated_profit),
      stage: 'Survey Complete',
      survey_completed: true,
      survey_completed_date: f.survey_completed_date || new Date().toISOString().slice(0, 10),
      created_by: profile?.id,
    }
    const { data, error } = await supabase.from('leads').insert(row).select().single()
    setBusy(false)
    if (error) return notify('Could not save lead — ' + error.message)
    await logActivity(data.id, 'created', 'Lead added manually', profile?.name)
    await refresh()
    notify('Lead added ✓')
    nav(`/leads/${data.id}`)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Manual entry</div>
          <h1>Add New Lead</h1>
          <div className="sub">Add a lead after the survey visit — chasing starts from the survey date.</div>
        </div>
      </div>

      <form className="card" onSubmit={submit} style={{ maxWidth: 860 }}>
        <div className="card-body">
          <div className="form-grid">
            <div className="field"><label>Customer name <span className="req">*</span></label>
              <input required value={f.customer_name} onChange={e => set('customer_name', e.target.value)} /></div>
            <div className="field"><label>Phone</label>
              <input type="tel" value={f.phone} onChange={e => set('phone', e.target.value)} /></div>
            <div className="field"><label>Email</label>
              <input type="email" value={f.email} onChange={e => set('email', e.target.value)} /></div>
            <div className="field"><label>Address</label>
              <input value={f.address} onChange={e => set('address', e.target.value)} /></div>
            <div className="field"><label>Postcode</label>
              <input value={f.postcode} onChange={e => set('postcode', e.target.value)} /></div>
            <div className="field"><label>Lead source</label>
              <select value={f.lead_source} onChange={e => set('lead_source', e.target.value)}>
                <option value="">Select…</option>{LEAD_SOURCES.map(s => <option key={s}>{s}</option>)}
              </select></div>
            <div className="field"><label>Bathroom type</label>
              <select value={f.bathroom_type} onChange={e => set('bathroom_type', e.target.value)}>
                <option value="">Select…</option>{BATHROOM_TYPES.map(s => <option key={s}>{s}</option>)}
              </select></div>
            <div className="field"><label>Survey date (when the survey was done) <span className="req">*</span></label>
              <input type="date" required value={f.survey_completed_date} onChange={e => set('survey_completed_date', e.target.value)} /></div>
            <div className="field"><label>Surveyor</label>
              <input value={f.surveyor} onChange={e => set('surveyor', e.target.value)} placeholder="e.g. Danny" /></div>
            <div className="field"><label>Estimated quote value (£)</label>
              <input type="number" min="0" step="1" value={f.estimated_value} onChange={e => set('estimated_value', e.target.value)} /></div>
            <div className="field"><label>Estimated profit (£)</label>
              <input type="number" min="0" step="1" value={f.estimated_profit} onChange={e => set('estimated_profit', e.target.value)} /></div>
          </div>
          <div className="field"><label>Notes</label>
            <textarea rows="3" value={f.notes} onChange={e => set('notes', e.target.value)} /></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn gold" disabled={busy}>{busy ? 'Saving…' : 'Save lead'}</button>
            <button type="button" className="btn ghost" onClick={() => nav(-1)}>Cancel</button>
          </div>
        </div>
      </form>
    </>
  )
}
