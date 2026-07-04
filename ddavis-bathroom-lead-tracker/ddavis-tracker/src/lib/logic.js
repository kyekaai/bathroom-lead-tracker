// ============================================================
// DD Davis Bathroom Lead Tracker — automation rules
// The app works out stage colour, priority and "next action"
// so staff never have to.
// ============================================================

export const STAGES = [
  'New Lead', 'Survey Booked', 'Survey Complete', 'Awaiting Selection Form',
  'Selection Form Received', 'CAD Required', 'CAD Booked', 'CAD In Progress',
  'CAD Sent', 'CAD Revisions Required', 'CAD Approved', 'Quote Sent',
  'Quote Follow Up', 'Won', 'Lost',
]

export const ACTIVE_STAGES = STAGES.filter(s => s !== 'Won' && s !== 'Lost')

export const BATHROOM_TYPES = [
  'Full bathroom renovation', 'En-suite', 'Shower room', 'Cloakroom', 'Disabled access', 'Other',
]

export const LEAD_SOURCES = [
  'Website', 'Checkatrade', 'Google Ads', 'Facebook', 'Word of mouth', 'Showroom', 'Repeat customer', 'Other',
]

export const LOST_REASONS = [
  'No response', 'Too expensive', 'Went with competitor', 'Not ready yet',
  'Finance declined', 'Changed mind', 'Duplicate lead', 'Outside area', 'Other',
]

export const CONTACT_METHODS = ['phone', 'text', 'email', 'whatsapp']

export const CAD_STATUSES = [
  'not required', 'not booked', 'booked', 'in progress',
  'sent to customer', 'revisions requested', 'approved', 'rejected',
]

export const FILE_CATEGORIES = ['cad drawing', 'pdf', 'screenshot', 'selection form', 'quote', 'other']

export const MAX_FOLLOW_UPS = 5

// Colour language: green complete/won · amber needs action · red overdue/lost · blue in progress · grey inactive
export const STAGE_COLOR = {
  'New Lead': 'blue', 'Survey Booked': 'blue', 'Survey Complete': 'green',
  'Awaiting Selection Form': 'amber', 'Selection Form Received': 'green',
  'CAD Required': 'amber', 'CAD Booked': 'blue', 'CAD In Progress': 'blue',
  'CAD Sent': 'blue', 'CAD Revisions Required': 'amber', 'CAD Approved': 'green',
  'Quote Sent': 'blue', 'Quote Follow Up': 'amber', 'Won': 'green', 'Lost': 'red',
}

// ---------- date helpers ----------
export function today() { return new Date().toISOString().slice(0, 10) }

export function daysSince(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr); if (isNaN(d)) return null
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

export function isPast(dateStr) {
  const n = daysSince(dateStr)
  return n !== null && n > 0
}

export function fmtDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return isNaN(d) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function money(n) {
  if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '—'
  return '£' + Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })
}

// ---------- priority ----------
// Selection-form chase bands: 0–3 normal · 4–7 amber · 8–14 red · 14+ critical
export function selectionBand(days) {
  if (days === null) return 'normal'
  if (days <= 3) return 'normal'
  if (days <= 7) return 'amber'
  if (days <= 14) return 'red'
  return 'critical'
}

const BAND_TO_PRIORITY = { normal: 'Low', amber: 'Medium', red: 'High', critical: 'Critical' }

// ---------- the brain: derive everything from the lead record ----------
export function derive(lead) {
  const closed = lead.stage === 'Won' || lead.stage === 'Lost'
  const dSurvey = daysSince(lead.survey_completed_date || (lead.survey_completed ? lead.survey_booked_date : null))
  const dQuote = daysSince(lead.quote_sent_date)
  const dContact = daysSince(lead.last_chased_date || lead.last_quote_chase_date || lead.created_at)
  const chaseOverdue = isPast(lead.next_chase_date)
  const quoteChaseOverdue = isPast(lead.next_quote_chase_date)

  const flags = {
    chaseSelection: false, bookCad: false, cadInProgress: false, cadAwaitingApproval: false,
    sendQuote: false, followUpQuote: false, overdue: false, noContact: false, atRisk: false,
  }
  let nextAction = null
  let priority = 'Low'

  if (!closed) {
    // Selection form chasing
    const waitingForm = lead.survey_completed && !lead.selection_form_returned && lead.cad_required !== 'no'
    if (waitingForm && (dSurvey ?? 0) >= 4) {
      flags.chaseSelection = true
      const band = selectionBand(dSurvey)
      priority = maxPriority(priority, BAND_TO_PRIORITY[band])
      nextAction = nextAction || `Call customer and chase selection form (${dSurvey} days since survey)`
    }

    // CAD
    if (lead.stage === 'CAD Required' || (lead.cad_required === 'yes' && lead.cad_status === 'not booked')) {
      flags.bookCad = true
      priority = maxPriority(priority, 'Medium')
      nextAction = nextAction || 'Book CAD design appointment'
    }
    if (lead.cad_status === 'in progress' || lead.cad_status === 'booked') {
      flags.cadInProgress = true
      nextAction = nextAction || (lead.cad_status === 'booked' ? 'CAD appointment booked — start design' : 'Finish CAD design and send to customer')
    }
    if (lead.cad_status === 'sent to customer') {
      flags.cadAwaitingApproval = true
      priority = maxPriority(priority, 'Medium')
      nextAction = nextAction || 'Chase customer for CAD approval'
    }
    if (lead.cad_status === 'revisions requested') {
      flags.cadInProgress = true
      priority = maxPriority(priority, 'Medium')
      nextAction = nextAction || 'Complete CAD revisions and resend'
    }

    // Quote
    const cadDone = lead.cad_required === 'no' || ['approved', 'not required'].includes(lead.cad_status)
    if (lead.quote_required && !lead.quote_sent && cadDone && lead.survey_completed) {
      flags.sendQuote = true
      priority = maxPriority(priority, 'High')
      nextAction = nextAction || 'Send quote to customer'
    }
    if (lead.quote_sent && !lead.quote_outcome && (dQuote ?? 0) > 3) {
      flags.followUpQuote = true
      priority = maxPriority(priority, 'High')
      nextAction = nextAction || `Follow up quote (sent ${dQuote} days ago)`
    }

    // Overdue follow-ups
    if (chaseOverdue || quoteChaseOverdue) {
      flags.overdue = true
      priority = maxPriority(priority, 'High')
      nextAction = nextAction || 'Follow-up overdue — contact customer today'
    }

    // No contact yet
    if ((lead.chase_attempts || 0) === 0 && (lead.quote_chase_attempts || 0) === 0 &&
        (dContact ?? 0) >= 7 && lead.stage !== 'New Lead' && lead.stage !== 'Survey Booked') {
      flags.noContact = true
      priority = maxPriority(priority, 'Medium')
      nextAction = nextAction || 'No recent contact — check in with customer'
    }

    // At risk of being lost
    if ((lead.chase_attempts || 0) >= MAX_FOLLOW_UPS || selectionBand(dSurvey) === 'critical') {
      flags.atRisk = true
      priority = maxPriority(priority, 'Critical')
      if ((lead.chase_attempts || 0) >= MAX_FOLLOW_UPS) {
        nextAction = `${lead.chase_attempts} follow-ups with no response — consider marking Lost`
      }
    }
  }

  // Sensible default action per stage when no rule fired
  if (!nextAction && !closed) nextAction = DEFAULT_ACTION[lead.stage] || 'Review lead'
  if (lead.stage === 'Won') nextAction = lead.job_booked ? 'Job booked ✓' : 'Take deposit and book the job in'
  if (lead.stage === 'Lost') nextAction = '—'
  if (lead.next_action_override) nextAction = lead.next_action_override

  const hasAction = !closed && Object.values(flags).some(Boolean)

  return { nextAction, priority: closed ? '—' : priority, flags, dSurvey, dQuote, hasAction }
}

const DEFAULT_ACTION = {
  'New Lead': 'Contact customer and book a survey',
  'Survey Booked': 'Carry out survey',
  'Survey Complete': 'Hand over brochures and selection form',
  'Awaiting Selection Form': 'Wait / chase selection form',
  'Selection Form Received': 'Decide if CAD design is required',
  'CAD Required': 'Book CAD design appointment',
  'CAD Booked': 'Prepare for CAD appointment',
  'CAD In Progress': 'Finish CAD design',
  'CAD Sent': 'Chase customer for CAD approval',
  'CAD Revisions Required': 'Complete CAD revisions',
  'CAD Approved': 'Send quote to customer',
  'Quote Sent': 'Wait / follow up quote after 3 days',
  'Quote Follow Up': 'Follow up quote with customer',
}

const ORDER = { 'Low': 0, 'Medium': 1, 'High': 2, 'Critical': 3 }
function maxPriority(a, b) { return ORDER[b] > ORDER[a] ? b : a }

export const PRIORITY_COLOR = { Low: 'grey', Medium: 'amber', High: 'red', Critical: 'critical', '—': 'grey' }

// ---------- Today's Actions buckets ----------
export function buildTodaysActions(leads) {
  const derived = leads.map(l => ({ lead: l, d: derive(l) }))
  const bucket = key => derived.filter(x => x.d.flags[key])
  return [
    { key: 'chaseSelection',     label: 'Selection forms to chase',      color: 'red',   items: bucket('chaseSelection') },
    { key: 'bookCad',            label: 'CAD appointments to book',      color: 'amber', items: bucket('bookCad') },
    { key: 'cadInProgress',      label: 'CAD designs in progress',       color: 'blue',  items: bucket('cadInProgress') },
    { key: 'cadAwaitingApproval',label: 'CAD awaiting approval',         color: 'blue',  items: bucket('cadAwaitingApproval') },
    { key: 'sendQuote',          label: 'Quotes to send',                color: 'amber', items: bucket('sendQuote') },
    { key: 'followUpQuote',      label: 'Quotes to follow up',           color: 'amber', items: bucket('followUpQuote') },
    { key: 'overdue',            label: 'Overdue follow-ups',            color: 'red',   items: bucket('overdue') },
    { key: 'noContact',          label: 'Leads with no recent contact',  color: 'grey',  items: bucket('noContact') },
    { key: 'atRisk',             label: 'At risk of being lost',         color: 'critical', items: bucket('atRisk') },
  ].filter(b => b.items.length > 0)
}

// ---------- duplicate detection for CSV import ----------
const norm = s => (s || '').toString().trim().toLowerCase()
const digits = s => (s || '').toString().replace(/\D/g, '')

export function matchLead(row, existing) {
  // exact match → update; partial match → possible duplicate
  for (const l of existing) {
    const phoneHit = digits(row.phone) && digits(row.phone) === digits(l.phone)
    const emailHit = norm(row.email) && norm(row.email) === norm(l.email)
    const nameHit = norm(row.customer_name) && norm(row.customer_name) === norm(l.customer_name)
    const postHit = norm(row.postcode) && norm(row.postcode).replace(/\s/g, '') === norm(l.postcode).replace(/\s/g, '')
    const addrHit = norm(row.address) && norm(l.address) && (norm(row.address).includes(norm(l.address)) || norm(l.address).includes(norm(row.address)))

    if (phoneHit || emailHit || (nameHit && (postHit || addrHit))) return { type: 'update', lead: l }
    if (nameHit || postHit) return { type: 'possible', lead: l }
  }
  return { type: 'new' }
}

// Fields the CSV mapper can target
export const IMPORT_FIELDS = [
  { key: 'customer_name', label: 'Customer name', required: true },
  { key: 'address', label: 'Address' },
  { key: 'postcode', label: 'Postcode' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'lead_source', label: 'Lead source' },
  { key: 'bathroom_type', label: 'Bathroom type' },
  { key: 'survey_booked_date', label: 'Survey booked date' },
  { key: 'surveyor', label: 'Surveyor' },
  { key: 'estimated_value', label: 'Estimated quote value' },
  { key: 'estimated_profit', label: 'Estimated profit' },
  { key: 'notes', label: 'Notes' },
]

// Guess a CSV column → field mapping from the header names
export function guessMapping(headers) {
  const map = {}
  const H = headers.map(h => ({ raw: h, n: norm(h).replace(/[^a-z0-9]/g, '') }))
  const find = (...keys) => H.find(h => keys.some(k => h.n.includes(k)))?.raw
  map.customer_name = find('customername', 'fullname', 'name', 'customer', 'client')
  map.address = find('address', 'street')
  map.postcode = find('postcode', 'postalcode', 'zip')
  map.phone = find('phone', 'mobile', 'tel', 'contactnumber')
  map.email = find('email')
  map.lead_source = find('source', 'channel')
  map.bathroom_type = find('bathroomtype', 'type', 'project')
  map.survey_booked_date = find('surveydate', 'surveybooked', 'appointment')
  map.surveyor = find('surveyor')
  map.estimated_value = find('value', 'quote', 'price', 'amount')
  map.estimated_profit = find('profit', 'margin')
  map.notes = find('note', 'comment', 'description')
  return map
}
