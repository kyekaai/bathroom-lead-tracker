import { useNavigate } from 'react-router-dom'
import { supabase, logActivity } from '../lib/supabase'
import { useApp } from '../App'
import {
  STAGE_COLOR, PRIORITY_COLOR, derive, fmtDate, money, daysSince,
  STAGES, PRE_SURVEY_STAGES, STAGE_TO_CAD, LOST_REASONS, today,
} from '../lib/logic'

export function StageBadge({ stage }) {
  return <span className={`badge ${STAGE_COLOR[stage] || 'grey'}`}><span className={`dot ${STAGE_COLOR[stage] || 'grey'}`} />{stage}</span>
}

// Colour name → CSS variable, so the quick select matches the stage badges
const COLOR_VAR = {
  teal: 'var(--stage-enquiry)', blue: 'var(--stage-new)', purple: 'var(--stage-contact)',
  gold: 'var(--stage-quoted)', green: 'var(--stage-won)', red: 'var(--stage-lost)',
}

// Quick stage move — change a lead's stage without opening it.
// Applies the same side-effects as the lead page dropdown.
export function StageSelect({ lead }) {
  const { profile, notify, refresh } = useApp()

  async function change(e) {
    const stage = e.target.value
    if (stage === lead.stage) return
    const patch = { stage }
    if (stage === 'Lost') {
      const reason = prompt('Reason lost? (' + LOST_REASONS.join(' / ') + ')', 'No response')
      if (reason === null) { e.target.value = lead.stage; return }
      patch.lost_reason = reason
    }
    if (stage === 'Won') patch.quote_outcome = 'accepted'
    if (STAGE_TO_CAD[stage]) { patch.cad_required = 'yes'; patch.cad_status = STAGE_TO_CAD[stage] }
    if (PRE_SURVEY_STAGES.includes(stage)) {
      patch.survey_completed = false
    } else if (stage === 'Survey Complete') {
      patch.survey_completed = true
      if (!lead.survey_completed_date) patch.survey_completed_date = today()
    }
    const { error } = await supabase.from('leads').update(patch).eq('id', lead.id)
    if (error) return notify('Could not move stage — ' + error.message)
    await logActivity(lead.id, 'stage', `Stage changed to ${stage}`, profile?.name)
    await refresh()
    notify(`${lead.customer_name} → ${stage} ✓`)
  }

  const color = COLOR_VAR[STAGE_COLOR[lead.stage]] || 'var(--text-secondary)'
  return (
    <select className="stage-quick" value={lead.stage} onChange={change}
      onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}
      style={{ color }} title="Move to stage">
      {STAGES.map(s => <option key={s}>{s}</option>)}
    </select>
  )
}

// Flags leads sitting untouched: amber from 7 days, red from 14
export function IdleBadge({ lead }) {
  if (lead.stage === 'Won' || lead.stage === 'Lost') return null
  const d = daysSince(lead.updated_at)
  if (d === null || d < 7) return null
  return <span className={`badge ${d >= 14 ? 'red' : 'amber'}`} title={`No activity for ${d} days`}>💤 {d}d idle</span>
}

export function PriorityBadge({ priority }) {
  if (!priority || priority === '—') return <span className="badge grey">—</span>
  return <span className={`badge ${PRIORITY_COLOR[priority]}`}>{priority}</span>
}

export function Stat({ n, label, tone = '' }) {
  return (
    <div className={`card stat ${tone}`}>
      <div className="n">{n}</div>
      <div className="l">{label}</div>
    </div>
  )
}

export function Empty({ title, children, icon = '📋', cta, ctaTo }) {
  return (
    <div className="empty">
      <span className="empty-icon" aria-hidden>{icon}</span>
      <b>{title}</b>{children}
      {cta && <div><LinkBtn to={ctaTo}>{cta}</LinkBtn></div>}
    </div>
  )
}
function LinkBtn({ to, children }) {
  const nav = useNavigate()
  return <button className="btn gold" onClick={() => nav(to)}>{children}</button>
}

export function LeadCard({ lead }) {
  const nav = useNavigate()
  const d = derive(lead)
  return (
    <div className="card lead-card" onClick={() => nav(`/leads/${lead.id}`)} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && nav(`/leads/${lead.id}`)}>
      <div className="top">
        <div>
          <div className="name">{lead.customer_name}</div>
          <div className="where">{[lead.address, lead.postcode].filter(Boolean).join(', ') || 'No address'}</div>
        </div>
        <PriorityBadge priority={d.priority} />
      </div>
      <div className="meta">
        <StageSelect lead={lead} />
        <IdleBadge lead={lead} />
        {lead.bathroom_type && <span className="badge grey">{lead.bathroom_type}</span>}
        {lead.lead_source && <span className="badge gold">{lead.lead_source}</span>}
      </div>
      <div className="action"><b>Next action</b>{d.nextAction}</div>
      <div className="foot">
        <span>{d.dSurvey !== null ? `${d.dSurvey}d since survey` : 'No survey date'}</span>
        <span>{money(lead.quote_value ?? lead.estimated_value)}</span>
      </div>
    </div>
  )
}
