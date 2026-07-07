import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase, logActivity } from '../lib/supabase'
import { useApp } from '../App'
import { StageBadge, PriorityBadge } from '../components/ui'
import {
  STAGES, LOST_REASONS, CONTACT_METHODS, CAD_STATUSES, FILE_CATEGORIES,
  derive, fmtDate, money, selectionBand, MAX_FOLLOW_UPS, today,
} from '../lib/logic'

const MAIN_STEPS = ['Survey', 'Selection Form', 'CAD', 'Quote', 'Won/Lost']
function stepIndex(stage) {
  const i = STAGES.indexOf(stage)
  if (i === 0) return 0
  if (i <= 2) return 1
  if (i <= 8) return 2
  if (i <= 10) return 3
  return 5
}

export default function LeadDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { profile, notify, refresh } = useApp()
  const [lead, setLead] = useState(null)
  const [followUps, setFollowUps] = useState([])
  const [activity, setActivity] = useState([])
  const [files, setFiles] = useState([])
  const [tab, setTab] = useState('timeline')

  const load = useCallback(async () => {
    const [{ data: l }, { data: fu }, { data: ac }, { data: fl }] = await Promise.all([
      supabase.from('leads').select('*').eq('id', id).single(),
      supabase.from('follow_ups').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
      supabase.from('activity').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
      supabase.from('lead_files').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
    ])
    setLead(l); setFollowUps(fu || []); setActivity(ac || []); setFiles(fl || [])
  }, [id])

  useEffect(() => { load() }, [load])

  // Save a partial update + timeline entry, then reload.
  const save = useCallback(async (patch, type, message) => {
    const { error } = await supabase.from('leads').update(patch).eq('id', id)
    if (error) return notify('Save failed — ' + error.message)
    if (message) await logActivity(id, type, message, profile?.name)
    await load(); await refresh()
    notify('Saved ✓')
  }, [id, profile, load, refresh, notify])

  if (!lead) return <p className="muted">Loading lead…</p>
  const d = derive(lead)
  const stepNow = stepIndex(lead.stage)

  // Stage → CAD status, so the stage dropdown and the CAD Designs board always match
  const STAGE_TO_CAD = {
    'CAD Required': 'not booked',
    'CAD Booked': 'booked',
    'CAD In Progress': 'in progress',
    'CAD Sent': 'sent to customer',
    'CAD Revisions Required': 'revisions requested',
    'CAD Approved': 'approved',
  }

  async function changeStage(stage) {
    if (stage === 'Lost') {
      const reason = prompt('Reason lost? (' + LOST_REASONS.join(' / ') + ')', 'No response')
      if (reason === null) return
      return save({ stage, lost_reason: reason }, 'stage', `Marked Lost — ${reason}`)
    }
    const patch = { stage }
    if (stage === 'Won') patch.quote_outcome = 'accepted'
    if (STAGE_TO_CAD[stage]) {
      patch.cad_required = 'yes'
      patch.cad_status = STAGE_TO_CAD[stage]
    }
    save(patch, 'stage', `Stage changed to ${stage}`)
  }

  return (
    <>
      <div className="small" style={{ marginBottom: 10 }}>
        <Link to="/leads" className="muted" style={{ textDecoration: 'none' }}>← All Leads</Link>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-body">
          <div className="detail-head">
            <div>
              <div className="eyebrow">{lead.lead_source || 'Lead'} · {lead.bathroom_type || 'Bathroom'}</div>
              <h1>{lead.customer_name}</h1>
              <div className="muted">{[lead.address, lead.postcode].filter(Boolean).join(', ') || 'No address on file'}</div>
              <div className="contact-row">
                {lead.phone && <a href={`tel:${lead.phone}`}>📞 {lead.phone}</a>}
                {lead.phone && <a href={`sms:${lead.phone}`}>💬 Text</a>}
                {lead.email && <a href={`mailto:${lead.email}`}>✉️ {lead.email}</a>}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <PriorityBadge priority={d.priority} />
                <StageBadge stage={lead.stage} />
              </div>
              <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
                <label>Move to stage</label>
                <select value={lead.stage} onChange={e => changeStage(e.target.value)}>
                  {STAGES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="small muted" style={{ marginTop: 6 }}>
                Value {money(lead.quote_value ?? lead.estimated_value)} · Profit {money(lead.estimated_profit)}
              </div>
            </div>
          </div>

          <div className="stagebar" style={{ marginTop: 16 }} aria-label="Pipeline progress">
            {MAIN_STEPS.map((s, i) => (
              <div key={s} className={`step ${i < stepNow ? 'done' : ''} ${i === stepNow ? 'now' : ''}`}>
                <div className="bar" /><span className="step-label">{i < stepNow ? '✓ ' : ''}{s}</span>
              </div>
            ))}
          </div>

          <div className="lead-card" style={{ padding: 0, cursor: 'default', boxShadow: 'none', border: 0 }}>
            <div className="action" style={{ marginTop: 8 }}>
              <b>Next action</b>{d.nextAction}
              {d.dSurvey !== null && !lead.selection_form_returned && lead.stage !== 'Won' && lead.stage !== 'Lost' && (
                <span className={`badge ${selectionBand(d.dSurvey) === 'normal' ? 'grey' : selectionBand(d.dSurvey)}`} style={{ marginLeft: 8 }}>
                  {d.dSurvey} days since survey
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {[['timeline', 'Timeline'], ['followups', `Follow-ups (${followUps.length})`], ['survey', 'Survey'],
          ['selection', 'Selection Form'], ['cad', 'CAD'], ['quote', 'Quote'], ['files', `Files (${files.length})`], ['notes', 'Notes']]
          .map(([k, label]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>
          ))}
      </div>

      {tab === 'timeline' && <Timeline activity={activity} lead={lead} />}
      {tab === 'followups' && <FollowUps lead={lead} followUps={followUps} save={save} profile={profile} reload={load} notify={notify} />}
      {tab === 'survey' && <Survey lead={lead} save={save} />}
      {tab === 'selection' && <Selection lead={lead} save={save} d={d} />}
      {tab === 'cad' && <Cad lead={lead} save={save} />}
      {tab === 'quote' && <Quote lead={lead} save={save} />}
      {tab === 'files' && <Files lead={lead} files={files} profile={profile} reload={load} notify={notify} />}
      {tab === 'notes' && <Notes lead={lead} save={save} />}
    </>
  )
}

/* ---------------- Timeline ---------------- */
function Timeline({ activity, lead }) {
  return (
    <div className="card"><div className="card-body">
      <ul className="timeline">
        {activity.map(a => (
          <li key={a.id}>
            <div className="when">{new Date(a.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            <div className="what">{a.message}</div>
            {a.actor && <div className="who">by {a.actor}</div>}
          </li>
        ))}
        <li>
          <div className="when">{fmtDate(lead.created_at)}</div>
          <div className="what">Lead added{lead.import_id ? ' via CSV import' : ''}</div>
        </li>
      </ul>
    </div></div>
  )
}

/* ---------------- Follow-ups ---------------- */
function FollowUps({ lead, followUps, save, profile, reload, notify }) {
  const [f, setF] = useState({ date: today(), method: 'phone', notes: '', outcome: '', next_follow_up_date: '' })
  const attempts = lead.chase_attempts || 0

  async function add(e) {
    e.preventDefault()
    const { error } = await supabase.from('follow_ups').insert({
      lead_id: lead.id, ...f, next_follow_up_date: f.next_follow_up_date || null,
      staff: profile?.name, created_by: profile?.id,
    })
    if (error) return notify('Could not log follow-up — ' + error.message)
    const newAttempts = attempts + 1
    await save(
      { chase_attempts: newAttempts, last_chased_date: f.date, next_chase_date: f.next_follow_up_date || null },
      'follow_up', `Follow-up ${newAttempts} by ${f.method} — ${f.outcome || 'no outcome recorded'}`
    )
    setF({ date: today(), method: 'phone', notes: '', outcome: '', next_follow_up_date: '' })
    await reload()

    // 5 attempts with no response → suggest Lost, but always ask first.
    if (newAttempts >= MAX_FOLLOW_UPS && lead.stage !== 'Won' && lead.stage !== 'Lost') {
      if (confirm(`${newAttempts} follow-up attempts with no result.\n\nMark this lead as "Lost — No Response"?`)) {
        await save({ stage: 'Lost', lost_reason: 'No response' }, 'stage', 'Marked Lost — No Response after 5 follow-ups')
      }
    }
  }

  return (
    <div className="grid two-col">
      <div className="card">
        <div className="card-head"><h2>Log a follow-up</h2>
          <span className={`badge ${attempts >= MAX_FOLLOW_UPS ? 'critical' : attempts >= 3 ? 'amber' : 'grey'}`}>Attempt {Math.min(attempts + 1, MAX_FOLLOW_UPS)} of {MAX_FOLLOW_UPS}</span>
        </div>
        <form className="card-body" onSubmit={add}>
          <div className="form-grid">
            <div className="field"><label>Date</label><input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} required /></div>
            <div className="field"><label>Contact method</label>
              <select value={f.method} onChange={e => setF({ ...f, method: e.target.value })}>
                {CONTACT_METHODS.map(m => <option key={m} value={m}>{m[0].toUpperCase() + m.slice(1)}</option>)}
              </select></div>
            <div className="field"><label>Outcome</label>
              <input value={f.outcome} onChange={e => setF({ ...f, outcome: e.target.value })} placeholder="e.g. left voicemail, will call back" /></div>
            <div className="field"><label>Next follow-up date</label>
              <input type="date" value={f.next_follow_up_date} onChange={e => setF({ ...f, next_follow_up_date: e.target.value })} /></div>
          </div>
          <div className="field"><label>Notes</label>
            <textarea rows="2" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></div>
          <button className="btn gold">Log follow-up</button>
        </form>
      </div>

      <div className="card">
        <div className="card-head"><h2>History</h2></div>
        <div className="card-body">
          {followUps.length === 0 && <p className="muted">No follow-ups logged yet.</p>}
          <ul className="timeline">
            {followUps.map(fu => (
              <li key={fu.id}>
                <div className="when">{fmtDate(fu.date)} · {fu.method}</div>
                <div className="what">{fu.outcome || 'No outcome recorded'}{fu.notes ? ` — ${fu.notes}` : ''}</div>
                <div className="who">by {fu.staff || 'unknown'}{fu.next_follow_up_date ? ` · next: ${fmtDate(fu.next_follow_up_date)}` : ''}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Survey ---------------- */
function Survey({ lead, save }) {
  const [f, setF] = useState({
    survey_completed: lead.survey_completed,
    survey_completed_date: lead.survey_completed_date || '', surveyor: lead.surveyor || '',
    brochures_handed: lead.brochures_handed, selection_form_handed: lead.selection_form_handed,
    survey_notes: lead.survey_notes || '', estimated_value: lead.estimated_value ?? '', estimated_profit: lead.estimated_profit ?? '',
  })
  function submit(e) {
    e.preventDefault()
    const patch = {
      ...f,
      survey_completed_date: f.survey_completed ? (f.survey_completed_date || today()) : null,
      estimated_value: f.estimated_value === '' ? null : Number(f.estimated_value),
      estimated_profit: f.estimated_profit === '' ? null : Number(f.estimated_profit),
    }
    if (f.survey_completed && lead.stage === 'Survey Complete' && lead.selection_form_handed) {
      patch.stage = 'Awaiting Selection Form'
    }
    save(patch, 'survey', f.survey_completed ? 'Survey marked complete' : 'Survey details updated')
  }
  return (
    <form className="card" onSubmit={submit} style={{ maxWidth: 760 }}>
      <div className="card-head"><h2>Survey tracking</h2></div>
      <div className="card-body">
        <div className="form-grid">
          <div className="field"><label>Survey date (completed)</label><input type="date" value={f.survey_completed_date} onChange={e => setF({ ...f, survey_completed_date: e.target.value })} /></div>
          <div className="field"><label>Surveyor</label><input value={f.surveyor} onChange={e => setF({ ...f, surveyor: e.target.value })} /></div>
          <div className="field"><label>Estimated quote value (£)</label><input type="number" value={f.estimated_value} onChange={e => setF({ ...f, estimated_value: e.target.value })} /></div>
          <div className="field"><label>Estimated profit (£)</label><input type="number" value={f.estimated_profit} onChange={e => setF({ ...f, estimated_profit: e.target.value })} /></div>
        </div>
        <label className="check"><input type="checkbox" checked={f.survey_completed} onChange={e => setF({ ...f, survey_completed: e.target.checked })} /> Survey completed</label>
        <label className="check"><input type="checkbox" checked={f.brochures_handed} onChange={e => setF({ ...f, brochures_handed: e.target.checked })} /> Brochures handed over</label>
        <label className="check"><input type="checkbox" checked={f.selection_form_handed} onChange={e => setF({ ...f, selection_form_handed: e.target.checked })} /> Selection form handed over</label>
        <div className="field"><label>Survey notes</label><textarea rows="3" value={f.survey_notes} onChange={e => setF({ ...f, survey_notes: e.target.value })} /></div>
        <button className="btn gold">Save survey</button>
      </div>
    </form>
  )
}

/* ---------------- Selection form ---------------- */
function Selection({ lead, save, d }) {
  const [f, setF] = useState({
    selection_form_sent: lead.selection_form_sent, selection_form_sent_date: lead.selection_form_sent_date || '',
    selection_form_returned: lead.selection_form_returned, selection_form_returned_date: lead.selection_form_returned_date || '',
    next_chase_date: lead.next_chase_date || '',
  })
  const band = selectionBand(d.dSurvey)
  function submit(e) {
    e.preventDefault()
    const patch = {
      ...f,
      selection_form_sent_date: f.selection_form_sent ? (f.selection_form_sent_date || today()) : null,
      selection_form_returned_date: f.selection_form_returned ? (f.selection_form_returned_date || today()) : null,
      next_chase_date: f.next_chase_date || null,
    }
    if (f.selection_form_returned && !lead.selection_form_returned) patch.stage = 'Selection Form Received'
    save(patch, 'selection_form', f.selection_form_returned ? 'Selection form returned' : 'Selection form details updated')
  }
  return (
    <form className="card" onSubmit={submit} style={{ maxWidth: 760 }}>
      <div className="card-head">
        <h2>Selection form</h2>
        {d.dSurvey !== null && <span className={`badge ${band === 'normal' ? 'grey' : band}`}>{d.dSurvey} days since survey · {band}</span>}
      </div>
      <div className="card-body">
        <label className="check"><input type="checkbox" checked={f.selection_form_sent} onChange={e => setF({ ...f, selection_form_sent: e.target.checked })} /> Selection form sent / handed over</label>
        {f.selection_form_sent && <div className="field" style={{ maxWidth: 220 }}><label>Sent date</label><input type="date" value={f.selection_form_sent_date} onChange={e => setF({ ...f, selection_form_sent_date: e.target.value })} /></div>}
        <label className="check"><input type="checkbox" checked={f.selection_form_returned} onChange={e => setF({ ...f, selection_form_returned: e.target.checked })} /> Selection form returned by customer</label>
        {f.selection_form_returned && <div className="field" style={{ maxWidth: 220 }}><label>Returned date</label><input type="date" value={f.selection_form_returned_date} onChange={e => setF({ ...f, selection_form_returned_date: e.target.value })} /></div>}
        <div className="field" style={{ maxWidth: 220 }}><label>Next chase date</label><input type="date" value={f.next_chase_date} onChange={e => setF({ ...f, next_chase_date: e.target.value })} /></div>
        <p className="muted small">Chase attempts so far: <b>{lead.chase_attempts || 0}</b> · last chased {fmtDate(lead.last_chased_date)}. Log chases in the Follow-ups tab.</p>
        <button className="btn gold">Save selection form</button>
      </div>
    </form>
  )
}

/* ---------------- CAD ---------------- */
function Cad({ lead, save }) {
  const [f, setF] = useState({
    cad_required: lead.cad_required, cad_booked_date: lead.cad_booked_date || '',
    cad_designer: lead.cad_designer || '', cad_status: lead.cad_status,
    cad_notes: lead.cad_notes || '', cad_revision_count: lead.cad_revision_count || 0,
    cad_completed_date: lead.cad_completed_date || '',
  })
  function submit(e) {
    e.preventDefault()
    const patch = { ...f, cad_booked_date: f.cad_booked_date || null, cad_completed_date: f.cad_completed_date || null }
    // Keep stage in step with CAD status
    const map = {
      'booked': 'CAD Booked', 'in progress': 'CAD In Progress', 'sent to customer': 'CAD Sent',
      'revisions requested': 'CAD Revisions Required', 'approved': 'CAD Approved',
    }
    if (f.cad_required === 'yes' && f.cad_status === 'not booked' && !['Won', 'Lost'].includes(lead.stage)) patch.stage = 'CAD Required'
    if (map[f.cad_status] && !['Won', 'Lost'].includes(lead.stage)) patch.stage = map[f.cad_status]
    if (f.cad_status === 'revisions requested' && lead.cad_status !== 'revisions requested') patch.cad_revision_count = (lead.cad_revision_count || 0) + 1
    if (f.cad_status === 'approved' && !f.cad_completed_date) patch.cad_completed_date = today()
    save(patch, 'cad', `CAD updated — ${f.cad_status}`)
  }
  return (
    <form className="card" onSubmit={submit} style={{ maxWidth: 760 }}>
      <div className="card-head"><h2>CAD design tracking</h2><span className="badge grey">Revisions: {lead.cad_revision_count || 0}</span></div>
      <div className="card-body">
        <div className="form-grid">
          <div className="field"><label>CAD required?</label>
            <select value={f.cad_required} onChange={e => setF({ ...f, cad_required: e.target.value })}>
              <option value="yes">Yes</option><option value="no">No</option><option value="unsure">Unsure</option>
            </select></div>
          <div className="field"><label>CAD status</label>
            <select value={f.cad_status} onChange={e => setF({ ...f, cad_status: e.target.value })}>
              {CAD_STATUSES.map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
            </select></div>
          <div className="field"><label>CAD booked date</label><input type="date" value={f.cad_booked_date} onChange={e => setF({ ...f, cad_booked_date: e.target.value })} /></div>
          <div className="field"><label>CAD designer</label><input value={f.cad_designer} onChange={e => setF({ ...f, cad_designer: e.target.value })} placeholder="e.g. Crystal" /></div>
          <div className="field"><label>CAD completed date</label><input type="date" value={f.cad_completed_date} onChange={e => setF({ ...f, cad_completed_date: e.target.value })} /></div>
        </div>
        <div className="field"><label>CAD notes</label><textarea rows="3" value={f.cad_notes} onChange={e => setF({ ...f, cad_notes: e.target.value })} /></div>
        <p className="muted small">Upload CAD drawings, PDFs and screenshots in the <b>Files</b> tab.</p>
        <button className="btn gold">Save CAD</button>
      </div>
    </form>
  )
}

/* ---------------- Quote ---------------- */
function Quote({ lead, save }) {
  const [f, setF] = useState({
    quote_required: lead.quote_required, quote_sent: lead.quote_sent,
    quote_sent_date: lead.quote_sent_date || '', quote_value: lead.quote_value ?? '',
    next_quote_chase_date: lead.next_quote_chase_date || '', quote_outcome: lead.quote_outcome || '',
    lost_reason: lead.lost_reason || '', competitor: lead.competitor || '',
    deposit_paid: lead.deposit_paid, job_booked: lead.job_booked,
  })
  function submit(e) {
    e.preventDefault()
    const patch = {
      ...f,
      quote_sent_date: f.quote_sent ? (f.quote_sent_date || today()) : null,
      quote_value: f.quote_value === '' ? null : Number(f.quote_value),
      next_quote_chase_date: f.next_quote_chase_date || null,
      quote_outcome: f.quote_outcome || null,
      lost_reason: f.lost_reason || null,
    }
    if (f.quote_outcome === 'accepted') { patch.stage = 'Won' }
    else if (f.quote_outcome === 'rejected') { patch.stage = 'Lost'; if (!patch.lost_reason) patch.lost_reason = 'Other' }
    else if (f.quote_sent && !['Won', 'Lost'].includes(lead.stage)) { patch.stage = 'Quote Sent' }
    save(patch, 'quote', f.quote_outcome ? `Quote ${f.quote_outcome}` : f.quote_sent ? 'Quote sent' : 'Quote details updated')
  }
  async function logQuoteChase() {
    await save({
      quote_chase_attempts: (lead.quote_chase_attempts || 0) + 1,
      last_quote_chase_date: today(),
      stage: ['Won', 'Lost'].includes(lead.stage) ? lead.stage : 'Quote Follow Up',
    }, 'quote', `Quote chased (attempt ${(lead.quote_chase_attempts || 0) + 1})`)
  }
  return (
    <form className="card" onSubmit={submit} style={{ maxWidth: 760 }}>
      <div className="card-head"><h2>Quote tracking</h2>
        <span className="badge grey">Chases: {lead.quote_chase_attempts || 0} · last {fmtDate(lead.last_quote_chase_date)}</span>
      </div>
      <div className="card-body">
        <label className="check"><input type="checkbox" checked={f.quote_required} onChange={e => setF({ ...f, quote_required: e.target.checked })} /> Quote required</label>
        <label className="check"><input type="checkbox" checked={f.quote_sent} onChange={e => setF({ ...f, quote_sent: e.target.checked })} /> Quote sent</label>
        <div className="form-grid">
          {f.quote_sent && <div className="field"><label>Quote sent date</label><input type="date" value={f.quote_sent_date} onChange={e => setF({ ...f, quote_sent_date: e.target.value })} /></div>}
          <div className="field"><label>Quote value (£)</label><input type="number" value={f.quote_value} onChange={e => setF({ ...f, quote_value: e.target.value })} /></div>
          <div className="field"><label>Next quote chase date</label><input type="date" value={f.next_quote_chase_date} onChange={e => setF({ ...f, next_quote_chase_date: e.target.value })} /></div>
          <div className="field"><label>Outcome</label>
            <select value={f.quote_outcome} onChange={e => setF({ ...f, quote_outcome: e.target.value })}>
              <option value="">Awaiting decision</option><option value="accepted">Accepted — Won</option><option value="rejected">Rejected — Lost</option>
            </select></div>
          {f.quote_outcome === 'rejected' && <>
            <div className="field"><label>Reason lost</label>
              <select value={f.lost_reason} onChange={e => setF({ ...f, lost_reason: e.target.value })}>
                <option value="">Select…</option>{LOST_REASONS.map(r => <option key={r}>{r}</option>)}
              </select></div>
            <div className="field"><label>Competitor chosen (if known)</label><input value={f.competitor} onChange={e => setF({ ...f, competitor: e.target.value })} /></div>
          </>}
        </div>
        {f.quote_outcome === 'accepted' && <>
          <label className="check"><input type="checkbox" checked={f.deposit_paid} onChange={e => setF({ ...f, deposit_paid: e.target.checked })} /> Deposit paid</label>
          <label className="check"><input type="checkbox" checked={f.job_booked} onChange={e => setF({ ...f, job_booked: e.target.checked })} /> Job booked in</label>
        </>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn gold">Save quote</button>
          {lead.quote_sent && !lead.quote_outcome && <button type="button" className="btn ghost" onClick={logQuoteChase}>Log a quote chase today</button>}
        </div>
      </div>
    </form>
  )
}

/* ---------------- Files ---------------- */
function Files({ lead, files, profile, reload, notify }) {
  const [category, setCategory] = useState('cad drawing')
  const [busy, setBusy] = useState(false)

  async function upload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    const path = `${lead.id}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('lead-files').upload(path, file)
    if (error) { setBusy(false); return notify('Upload failed — ' + error.message) }
    await supabase.from('lead_files').insert({ lead_id: lead.id, file_name: file.name, storage_path: path, category, uploaded_by: profile?.id })
    await logActivity(lead.id, 'file', `File uploaded: ${file.name} (${category})`, profile?.name)
    setBusy(false); e.target.value = ''
    await reload(); notify('File uploaded ✓')
  }

  async function open(f) {
    const { data, error } = await supabase.storage.from('lead-files').createSignedUrl(f.storage_path, 3600)
    if (error) return notify('Could not open file')
    window.open(data.signedUrl, '_blank')
  }

  return (
    <div className="card" style={{ maxWidth: 760 }}>
      <div className="card-head"><h2>Files</h2></div>
      <div className="card-body">
        <div className="form-grid" style={{ alignItems: 'end' }}>
          <div className="field"><label>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              {FILE_CATEGORIES.map(c => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
            </select></div>
          <div className="field"><label>Upload file (CAD, PDF, screenshot, selection form, quote)</label>
            <input type="file" onChange={upload} disabled={busy} /></div>
        </div>
        {files.length === 0
          ? <p className="muted">No files uploaded yet.</p>
          : <table className="data"><thead><tr><th>File</th><th>Category</th><th>Uploaded</th><th></th></tr></thead>
              <tbody>{files.map(f => (
                <tr key={f.id}>
                  <td><b>{f.file_name}</b></td>
                  <td><span className="badge grey">{f.category}</span></td>
                  <td className="small">{fmtDate(f.created_at)}</td>
                  <td className="right"><button type="button" className="btn sm ghost" onClick={() => open(f)}>Open</button></td>
                </tr>))}</tbody></table>}
      </div>
    </div>
  )
}

/* ---------------- Notes ---------------- */
function Notes({ lead, save }) {
  const [notes, setNotes] = useState(lead.notes || '')
  return (
    <div className="card" style={{ maxWidth: 760 }}>
      <div className="card-head"><h2>Notes</h2></div>
      <div className="card-body">
        <div className="field"><textarea rows="6" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything the team should know about this customer…" /></div>
        <button className="btn gold" onClick={() => save({ notes }, 'note', 'Notes updated')}>Save notes</button>
      </div>
    </div>
  )
}
