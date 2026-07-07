// ============================================================
// WHAT'S NEW — the app changelog shown to the whole team.
// To announce an update, just add a new entry to the TOP of
// the UPDATES list below and redeploy. Newest first.
// ============================================================

const UPDATES = [
  {
    date: '7 July 2026',
    tag: 'New',
    title: 'Mobile menu bar & bolder pipeline',
    points: [
      'New bottom menu bar on phones — Home, Leads, a big orange ＋ Add button, CAD, and More for the full menu.',
      'Pipeline stages on each lead now stand out: green ticks for completed steps and an orange highlight on the current stage.',
      'This What\'s New page, so everyone can see what\'s changed.',
    ],
  },
  {
    date: '7 July 2026',
    tag: 'Design',
    title: 'New dark look to match the main DD Davis CRM',
    points: [
      'Dark theme throughout with the brand orange as the accent colour.',
      'Dashboard now leads with the total pipeline value, a trend vs last month, and a pipeline bar you can tap into.',
      'New leads chart covering the last 30 days.',
      'Stage colours now mean the same thing everywhere: blue = chasing form, purple = CAD, orange = quoted, green = won, red = lost.',
    ],
  },
  {
    date: '2 July 2026',
    tag: 'Change',
    title: 'Tracking now starts after the survey',
    points: [
      'Leads enter the tracker once the survey has been done — no more "New Lead" or "Survey Booked" stages.',
      'The chase clock starts from the survey date: amber at 4 days, red at 8, critical at 14+.',
      'CSV imports and the Add Lead form now ask for the survey date.',
    ],
  },
  {
    date: '2 July 2026',
    tag: 'Launch',
    title: 'DD Davis Bathroom Lead Tracker goes live',
    points: [
      'Shared live tracker for the whole team — changes appear for everyone instantly.',
      'Today\'s Actions worked out automatically: forms to chase, CAD to book, quotes to follow up.',
      'CSV import from the CRM with duplicate checking, plus CAD tracking, quotes, files, reports and a full activity timeline on every lead.',
    ],
  },
]

const TAG_COLOR = { New: 'gold', Design: 'purple', Change: 'blue', Launch: 'green', Fix: 'red' }

export default function WhatsNew() {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Updates</div>
          <h1>What's New</h1>
          <div className="sub">Every change to the lead tracker, newest first.</div>
        </div>
      </div>

      <div style={{ maxWidth: 720 }}>
        {UPDATES.map((u, i) => (
          <div className="card" key={i} style={{ marginBottom: 16 }}>
            <div className="card-head">
              <h2>{u.title}</h2>
              <span className={`badge ${TAG_COLOR[u.tag] || 'grey'}`}>{u.tag}</span>
            </div>
            <div className="card-body" style={{ paddingTop: 16 }}>
              <div className="muted small" style={{ marginBottom: 8 }}>{u.date}</div>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
                {u.points.map((p, j) => <li key={j} style={{ color: 'var(--text-secondary)' }}>{p}</li>)}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
