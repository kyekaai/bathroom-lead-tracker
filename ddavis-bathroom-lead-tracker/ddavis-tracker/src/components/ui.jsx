import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, logActivity } from '../lib/supabase'
import { useApp } from '../App'
import {
  STAGE_COLOR, PRIORITY_COLOR, derive, fmtDate, money, daysSince,
  STAGES, PRE_SURVEY_STAGES, STAGE_TO_CAD, LOST_REASONS, today, healthScore, healthColor, healthBreakdown, stageAge,
} from '../lib/logic'
import { fireConfetti } from '../lib/confetti'

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
    const patch = { stage, stage_changed_at: new Date().toISOString() }
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
    if (stage === 'Won') fireConfetti()
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


// Shimmering placeholders shown while data loads — feels faster than "Loading…"
export function SkeletonCards({ n = 6 }) {
  return (
    <div className="sk-cards" aria-busy="true" aria-label="Loading">
      {Array.from({ length: n }).map((_, i) => (
        <div className="card sk-card" key={i}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
            <div className="sk ring" />
            <div style={{ flex: 1 }}>
              <div className="sk line w60" />
              <div className="sk line w80" />
            </div>
          </div>
          <div className="sk line w40" />
          <div className="sk line" style={{ height: 34 }} />
        </div>
      ))}
    </div>
  )
}

export function SkeletonRows({ n = 5 }) {
  return (
    <div className="card" aria-busy="true" aria-label="Loading">
      <div className="card-body">
        {Array.from({ length: n }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0' }}>
            <div className="sk ring" style={{ width: 30, height: 30 }} />
            <div style={{ flex: 1 }}><div className="sk line w40" /><div className="sk line w80" style={{ marginBottom: 0 }} /></div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Empty({ title, children, icon, cta, ctaTo }) {
  return (
    <div className="empty">
      {icon
        ? <span className="empty-icon" aria-hidden>{icon}</span>
        : <svg viewBox="0 0 120 120" fill="none" stroke="var(--accent)" strokeWidth="2.4"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="26" y="20" width="68" height="84" rx="8" strokeOpacity=".55" />
            <path d="M40 42h40M40 56h40M40 70h26" strokeOpacity=".35" />
            <circle cx="82" cy="80" r="20" fill="var(--bg)" />
            <path d="M74 80l6 6 12-12" />
          </svg>}
      <b>{title}</b>{children}
      {cta && <div><LinkBtn to={ctaTo}>{cta}</LinkBtn></div>}
    </div>
  )
}
function LinkBtn({ to, children }) {
  const nav = useNavigate()
  return <button className="btn gold" onClick={() => nav(to)}>{children}</button>
}

// Quick note — jot a note on a lead without opening it. Logs to the timeline.
export function QuickNote({ lead, label }) {
  const { profile, notify, refresh } = useApp()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    const note = text.trim()
    if (!note) return
    setBusy(true)
    // Touch the lead so the idle badge resets and everyone's screens refresh
    await supabase.from('leads').update({ updated_at: new Date().toISOString() }).eq('id', lead.id)
    await logActivity(lead.id, 'note', note, profile?.name)
    setBusy(false)
    setOpen(false); setText('')
    await refresh()
    notify('Note added ✓')
  }

  return (
    <>
      <button type="button" className={label ? 'btn sm ghost' : 'note-btn'} title="Add a quick note"
        onClick={e => { e.stopPropagation(); setOpen(true) }}>{label || '✎'}</button>
      {open && (
        <div className="qn-overlay" onClick={e => { e.stopPropagation(); setOpen(false) }}>
          <div className="qn-box" onClick={e => e.stopPropagation()}>
            <b>Note on {lead.customer_name}</b>
            <textarea rows="3" autoFocus value={text} onChange={e => setText(e.target.value)}
              placeholder="e.g. Left voicemail · customer on holiday until 1st Aug"
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save(); if (e.key === 'Escape') setOpen(false) }} />
            <div className="qn-actions">
              <button type="button" className="btn sm gold" disabled={busy || !text.trim()} onClick={save}>{busy ? 'Saving…' : 'Save note'}</button>
              <button type="button" className="btn sm ghost" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Health ring — one glance tells you how a lead is doing (green / amber / red).
// Hover shows a tooltip explaining exactly why the score is what it is.
export function HealthRing({ lead }) {
  const { score, reasons } = healthBreakdown(lead)
  const C = 2 * Math.PI * 18
  const [off, setOff] = useState(C)
  const [tip, setTip] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setOff(C - (C * score) / 100), 250)
    return () => clearTimeout(t)
  }, [score])
  if (lead.stage === 'Won' || lead.stage === 'Lost') return null
  return (
    <div className="health" onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)}
      onTouchStart={() => setTip(t => !t)}>
      <svg width="44" height="44">
        <circle className="track" cx="22" cy="22" r="18" />
        <circle className="val" cx="22" cy="22" r="18" stroke={healthColor(score)}
          strokeDasharray={C} strokeDashoffset={off} />
      </svg>
      <b>{score}</b>
      {tip && (
        <div className="health-tip" onClick={e => e.stopPropagation()}>
          <div className="ht-head">Lead health — {score}/100</div>
          {reasons.map((r, i) => (
            <div key={i} className={`ht-row ${r.good ? 'good' : 'bad'}`}>
              <span>{r.good ? '✓' : '✗'}</span>{r.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function LeadCard({ lead }) {
  const nav = useNavigate()
  const d = derive(lead)
  return (
    <div className="card lead-card" onClick={() => nav(`/leads/${lead.id}`)} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && nav(`/leads/${lead.id}`)}>
      <div className="top">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
          <HealthRing lead={lead} />
          <div style={{ minWidth: 0 }}>
            <div className="name">{lead.customer_name}</div>
            <div className="where">{[lead.address, lead.postcode].filter(Boolean).join(', ') || 'No address'}</div>
          </div>
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
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {money(lead.quote_value ?? lead.estimated_value)}
          <QuickNote lead={lead} />
        </span>
      </div>
    </div>
  )
}
