import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../App'
import { selectionBand, stageAge, daysSince, timeAgo } from '../lib/logic'

const READ_KEY = 'dd-notifications-read-at'

// Work out what needs attention, straight from the lead data
function buildNotifications(leads) {
  const out = []
  for (const l of leads) {
    if (l.stage === 'Won' || l.stage === 'Lost') continue
    const when = l.stage_changed_at || l.updated_at || l.created_at

    if (l.survey_completed && !l.selection_form_returned) {
      const d = daysSince(l.survey_completed_date)
      const band = selectionBand(d)
      if (band === 'red' || band === 'critical') {
        out.push({
          id: `sf-${l.id}`, leadId: l.id, when,
          tone: band === 'critical' ? 'bad' : 'warn',
          title: 'Selection form overdue',
          who: l.customer_name, sub: `${d} days since survey`,
        })
      }
    }

    if (l.stage === 'New Enquiry') {
      const d = daysSince(l.created_at)
      if (d !== null && d >= 2) {
        out.push({
          id: `ne-${l.id}`, leadId: l.id, when,
          tone: 'warn', title: 'New enquiry not contacted',
          who: l.customer_name, sub: `${d} days old`,
        })
      }
    }

    if (l.cad_status === 'sent to customer') {
      const d = daysSince(l.stage_changed_at || l.updated_at)
      if (d !== null && d >= 7) {
        out.push({
          id: `cad-${l.id}`, leadId: l.id, when,
          tone: 'warn', title: 'Design awaiting approval',
          who: l.customer_name, sub: `sent ${d} days ago`,
        })
      }
    }

    if (l.cad_status === 'revisions requested') {
      out.push({
        id: `rev-${l.id}`, leadId: l.id, when,
        tone: 'info', title: 'Revisions requested',
        who: l.customer_name, sub: `revision ${l.cad_revision_count || 1}`,
      })
    }

    const sa = stageAge(l)
    if (sa.over && sa.days >= (sa.target ?? 0) * 2) {
      out.push({
        id: `st-${l.id}`, leadId: l.id, when,
        tone: 'bad', title: `Stuck in ${l.stage}`,
        who: l.customer_name, sub: `${sa.days} days (target ${sa.target})`,
      })
    }
  }
  return out.sort((a, b) => new Date(b.when) - new Date(a.when)).slice(0, 20)
}

export default function Notifications() {
  const { leads } = useApp()
  const [open, setOpen] = useState(false)
  const [readAt, setReadAt] = useState(() => {
    try { return localStorage.getItem(READ_KEY) || '' } catch { return '' }
  })

  const items = useMemo(() => buildNotifications(leads), [leads])
  const unread = items.filter(i => !readAt || new Date(i.when) > new Date(readAt)).length

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function markAllRead() {
    const now = new Date().toISOString()
    setReadAt(now)
    try { localStorage.setItem(READ_KEY, now) } catch { /* private mode */ }
  }

  return (
    <>
      <button className="bell" onClick={() => setOpen(o => !o)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`} title="Notifications">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
          strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 10-12 0c0 6-2.5 7-2.5 7h17S18 14 18 8z" />
          <path d="M13.7 20a2 2 0 01-3.4 0" />
        </svg>
        {unread > 0 && <span className="bell-dot">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <>
          <div className="bell-scrim" onClick={() => setOpen(false)} />
          <div className="notif-panel">
            <div className="np-head">
              <span>Notifications{unread > 0 && <em> · {unread} new</em>}</span>
              {items.length > 0 && <button onClick={markAllRead}>Mark all read</button>}
            </div>
            <div className="np-body">
              {items.length === 0
                ? <div className="np-empty">Nothing needs attention right now ✓</div>
                : items.map(i => {
                    const isUnread = !readAt || new Date(i.when) > new Date(readAt)
                    return (
                      <Link key={i.id} to={`/leads/${i.leadId}`} className="np-item" onClick={() => setOpen(false)}>
                        <span className={`np-dot ${isUnread ? i.tone : 'read'}`} />
                        <div>
                          <div className="np-title">{i.title} — <b>{i.who}</b></div>
                          <div className="np-sub">{i.sub} · {timeAgo(i.when)}</div>
                        </div>
                      </Link>
                    )
                  })}
            </div>
          </div>
        </>
      )}
    </>
  )
}
