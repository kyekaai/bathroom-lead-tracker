import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, logActivity } from '../lib/supabase'
import { useApp } from '../App'
import { BATHROOM_TYPES, LEAD_SOURCES } from '../lib/logic'

// The four points a lead can join the tracker at — shown as the journey picker
const START_STAGES = [
  { stage: 'New Enquiry',     hint: 'Just come in — not spoken to yet',  color: 'var(--stage-enquiry)', soft: 'var(--stage-enquiry-soft)' },
  { stage: 'Contacted',       hint: 'Spoken to the customer',            color: 'var(--stage-enquiry)', soft: 'var(--stage-enquiry-soft)' },
  { stage: 'Survey Booked',   hint: 'Survey date in the diary',          color: 'var(--stage-enquiry)', soft: 'var(--stage-enquiry-soft)' },
  { stage: 'Survey Complete', hint: 'Survey done — chasing starts',      color: 'var(--stage-new)',     soft: 'var(--stage-new-soft)' },
]

const BLANK = {
  customer_name: '', address: '', postcode: '', phone: '', email: '',
  lead_source: '', bathroom_type: '', survey_completed_date: new Date().toISOString().slice(0, 10),
  surveyor: '', notes: '',
  stage: 'Survey Complete',
}

export default function AddLead() {
  const nav = useNavigate()
  const { profile, notify, refresh } = useApp()
  const [f, setF] = useState(BLANK)
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  const showSurvey = f.stage === 'Survey Complete' || f.stage === 'Survey Booked'
  const surveyDone = f.stage === 'Survey Complete'

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    const row = {
      ...f,
      survey_completed: surveyDone,
      // For 'Survey Booked' this holds the booked survey date; blank for earlier stages
      survey_completed_date: surveyDone
        ? (f.survey_completed_date || new Date().toISOString().slice(0, 10))
        : (f.stage === 'Survey Booked' ? f.survey_completed_date || null : null),
      created_by: profile?.id,
      stage_changed_at: new Date().toISOString(),
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
          <div className="sub">Add a lead at any point — from a brand-new enquiry through to a completed survey.</div>
        </div>
      </div>

      <form className="card" onSubmit={submit} style={{ maxWidth: 860 }}>
        <div className="card-body">

          <div className="fs-eyebrow">Where is this lead up to?</div>
          <div className="stagepick" role="radiogroup" aria-label="Starting stage">
            {START_STAGES.map(s => (
              <button key={s.stage} type="button" role="radio" aria-checked={f.stage === s.stage}
                className={f.stage === s.stage ? 'on' : ''}
                style={{ '--sp-color': s.color, '--sp-soft': s.soft }}
                onClick={() => set('stage', s.stage)}>
                <span className="sp-dot" />
                <b>{s.stage}</b>
                <span className="sp-hint">{s.hint}</span>
              </button>
            ))}
          </div>

          <div className="form-section">
            <div className="fs-eyebrow">Customer</div>
            <div className="form-grid3">
              <div className="field"><label>Customer name <span className="req">*</span></label>
                <input required value={f.customer_name} onChange={e => set('customer_name', e.target.value)} placeholder="Full name" /></div>
              <div className="field"><label>Phone</label>
                <input type="tel" value={f.phone} onChange={e => set('phone', e.target.value)} placeholder="07..." /></div>
              <div className="field"><label>Email</label>
                <input type="email" value={f.email} onChange={e => set('email', e.target.value)} placeholder="name@email.com" /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}><label>Address</label>
                <input value={f.address} onChange={e => set('address', e.target.value)} placeholder="House number and street" /></div>
              <div className="field"><label>Postcode</label>
                <input value={f.postcode} onChange={e => set('postcode', e.target.value)} placeholder="e.g. HX3 7PE" /></div>
            </div>
          </div>

          <div className="form-section">
            <div className="fs-eyebrow">Lead details</div>
            <div className="form-grid3">
              <div className="field"><label>Lead source</label>
                <select value={f.lead_source} onChange={e => set('lead_source', e.target.value)}>
                  <option value="">Select…</option>{LEAD_SOURCES.map(s => <option key={s}>{s}</option>)}
                </select></div>
              <div className="field"><label>Bathroom type</label>
                <select value={f.bathroom_type} onChange={e => set('bathroom_type', e.target.value)}>
                  <option value="">Select…</option>{BATHROOM_TYPES.map(s => <option key={s}>{s}</option>)}
                </select></div>
            </div>
          </div>

          {showSurvey && (
            <div className="form-section">
              <div className="fs-eyebrow">Survey</div>
              <div className="form-grid3">
                <div className="field">
                  <label>{surveyDone ? <>Survey date (when it was done) <span className="req">*</span></> : 'Survey date (when it\u2019s booked for)'}</label>
                  <input type="date" required={surveyDone} value={f.survey_completed_date} onChange={e => set('survey_completed_date', e.target.value)} />
                </div>
                <div className="field"><label>Surveyor</label>
                  <input value={f.surveyor} onChange={e => set('surveyor', e.target.value)} placeholder="e.g. Danny" /></div>
              </div>
            </div>
          )}

          <div className="form-section">
            <div className="fs-eyebrow">Notes</div>
            <div className="field"><label>Notes</label>
              <textarea rows="3" value={f.notes} onChange={e => set('notes', e.target.value)} placeholder="Anything worth knowing — access, timescales, what they're after…" /></div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button className="btn gold" disabled={busy}>{busy ? 'Saving…' : 'Save lead'}</button>
            <button type="button" className="btn ghost" onClick={() => nav(-1)}>Cancel</button>
          </div>
        </div>
      </form>
    </>
  )
}
