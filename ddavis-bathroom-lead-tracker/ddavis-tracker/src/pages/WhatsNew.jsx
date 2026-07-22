// ============================================================
// WHAT'S NEW — the app changelog shown to the whole team.
// To announce an update, just add a new entry to the TOP of
// the UPDATES list below and redeploy. Newest first.
// ============================================================

const UPDATES = [
  {
    date: '22 July 2026',
    tag: 'New',
    title: 'CAD board drag & drop — move jobs by dragging the card',
    points: [
      'Drag any CAD card into a new column and it moves instantly — the lead\'s pipeline stage, CAD status and timeline all update automatically.',
      'Columns now have coloured top edges and show the total value of jobs at each step.',
      'Cards show the designer\'s initials, revision count, booked date and value. Overdue booked jobs flag in red.',
      'Empty columns show a dashed drop zone so it\'s clear where to drag.',
    ],
  },
  {
    date: '22 July 2026',
    tag: 'New',
    title: 'Quick stage move from the leads list',
    points: [
      'The stage badge on every lead card and table row is now a dropdown — change a lead\'s stage without opening it.',
      'All the same side-effects apply: CAD board stays in sync, Won marks the quote accepted, Lost asks for a reason, and every move logs on the timeline.',
    ],
  },
  {
    date: '22 July 2026',
    tag: 'New',
    title: 'Install as a phone app',
    points: [
      'The tracker can now be installed on your phone home screen so it opens like a proper app — no browser bar.',
      'On iPhone: tap Share → Add to Home Screen. On Android: tap the menu (⋮) → Install app.',
      'It opens full-screen with the DD Davis icon, matching the Surveyor Toolkit on your home screen.',
    ],
  },
  {
    date: '22 July 2026',
    tag: 'Design',
    title: 'New Add Lead form, DD Davis logo & mobile fixes',
    points: [
      'The Add Lead form is redesigned — four stage cards at the top let you pick where the lead is up to, with the form sections appearing below. Value and profit fields removed (add those later on the lead). TradesBoost added as a lead source.',
      'The full DD Davis logo ("Built on trust. Driven by quality.") now appears in the sidebar and on the sign-in screen, replacing the text.',
      'Fixed mobile sideways swiping — the app now locks to the screen width and only scrolls up and down, like a native app.',
    ],
  },
  {
    date: '22 July 2026',
    tag: 'New',
    title: 'Pre-survey stages, sending docs, quick emails & more',
    points: [
      'Leads can now be tracked before the survey — new stages: New Enquiry, Contacted, and Survey Booked. Booked surveys show on the Calendar.',
      'New Send Docs tab on every lead — pick brochures and the selection form, then send via WhatsApp, Outlook or your mail app with the customer\'s details and message pre-filled. Sending logs on the timeline and starts the chase clock automatically.',
      'Quick emails on the same tab — one tap opens a pre-written email to confirm a survey, chase a selection form, or follow up a quote.',
      'Leads can be deleted (button at the bottom of the lead page), and the table view now has tick-boxes for bulk stage moves and bulk delete.',
      'Leads sitting untouched for 7+ days now show a 💤 idle badge so stale ones stand out.',
    ],
  },
  {
    date: '7 July 2026',
    tag: 'Fix',
    title: 'Stage dropdown now updates the CAD board',
    points: [
      'Picking a CAD stage from the "Move to stage" dropdown (CAD Booked, In Progress, Sent, etc.) now moves the lead to the matching column on the CAD Designs board.',
      'It already worked the other way round — now both stay in sync whichever one you update.',
    ],
  },
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
