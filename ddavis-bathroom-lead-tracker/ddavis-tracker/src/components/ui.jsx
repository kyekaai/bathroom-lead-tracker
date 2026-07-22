import { useNavigate } from 'react-router-dom'
import { STAGE_COLOR, PRIORITY_COLOR, derive, fmtDate, money, daysSince } from '../lib/logic'

export function StageBadge({ stage }) {
  return <span className={`badge ${STAGE_COLOR[stage] || 'grey'}`}><span className={`dot ${STAGE_COLOR[stage] || 'grey'}`} />{stage}</span>
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
        <StageBadge stage={lead.stage} />
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
