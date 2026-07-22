// ============================================================
// Brochures & documents that can be sent to customers.
// To add / change a brochure, edit this list — nothing else.
// `selection: true` marks the selection form (sending it ticks
// "selection form sent" on the lead and starts the chase clock).
// ============================================================

export const DOCS = [
  { key: 'ddbrochure', name: 'DD Davis Bathroom Brochure', url: 'https://dddavis.co.uk/wp-content/uploads/2026/05/DD-Davis-BATHROOM-BROCHURE.pdf' },
  { key: 'kartell',    name: 'Kartell KVIT',               url: 'https://dddavis.co.uk/wp-content/uploads/2026/05/KVIT-Bathroom-Brochure.pdf' },
  { key: 'scudo',      name: 'Scudo',                      url: 'https://dddavis.co.uk/wp-content/uploads/2026/05/Scudo-Bathroom-Brochure-1.pdf' },
  { key: 'giavani',    name: 'Giavani – Floor Tile, Wall Tile & Wall Panelling', url: 'https://dddavis.co.uk/wp-content/uploads/2026/06/Floor-Tile-Wall-Tile-Wall-Panelling.pdf' },
  { key: 'selection',  name: 'Selection Form',             url: 'https://dddavis.netlify.app/selection-form.html', selection: true },
]

// The approved customer message — same wording as the Surveyor Toolkit.
// *asterisks* show as bold in WhatsApp; the email version strips them.
const BUNDLE = [
  'Please find attached our supplier brochures, showcasing the trusted brands we use at *DD Davis Ltd* for bathroom installations.',
  'You will be issued with a *Bathroom Selection Form* via email and also provided with a paper copy during your home survey.',
  'This allows us to gather your preferred choices and requirements so we can accurately price your project and create detailed *CAD bathroom designs* based on your selections.',
  'We can also guide you through alternative products, styles, and price points to suit a range of budgets, helping you compare options across the board.',
  "Our goal is to work closely with you to bring your vision to life and create the bathroom you've always dreamed of.",
].join('\n\n')

// UK mobile → WhatsApp number: 07712 783974 → 447712783974
export function waNumber(phone) {
  let n = (phone || '').replace(/[^0-9+]/g, '').replace(/^\+/, '')
  if (n.startsWith('0')) n = '44' + n.slice(1)
  else if (n.startsWith('7') && n.length === 10) n = '44' + n
  return n.startsWith('44') && n.length === 12 ? n : ''
}

// Full message: greeting + approved copy + the selected links
export function buildMessage(lead, docs, { bold = true } = {}) {
  const first = (lead.customer_name || '').trim().split(/\s+/)[0]
  const wrap = s => (bold ? `*${s}*` : s)
  const links = docs.map(d => `${wrap(d.name)}\n${d.url}`).join('\n\n')
  const body = bold ? BUNDLE : BUNDLE.replace(/\*/g, '')
  return `${first ? `Hi ${first},\n\n` : ''}${body}\n\n${links}`
}

export function waLink(lead, docs) {
  const n = waNumber(lead.phone)
  const text = encodeURIComponent(buildMessage(lead, docs, { bold: true }))
  return n ? `https://wa.me/${n}?text=${text}` : `https://wa.me/?text=${text}`
}

const EMAIL_SUBJECT = 'DD Davis Ltd — Bathroom Brochures'

export function mailtoLink(lead, docs) {
  const qs = `subject=${encodeURIComponent(EMAIL_SUBJECT)}&body=${encodeURIComponent(buildMessage(lead, docs, { bold: false }))}`
  return `mailto:${lead.email || ''}?${qs}`
}

// Outlook: the mobile app uses ms-outlook://, desktop gets the Outlook web compose deeplink
export function outlookLink(lead, docs) {
  const qs = `to=${encodeURIComponent(lead.email || '')}&subject=${encodeURIComponent(EMAIL_SUBJECT)}&body=${encodeURIComponent(buildMessage(lead, docs, { bold: false }))}`
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '')
  return isMobile ? `ms-outlook://compose?${qs}` : `https://outlook.office.com/mail/deeplink/compose?${qs}`
}

// ============================================================
// Quick email templates — pre-written emails for common jobs.
// Edit the wording here; {first} is the customer's first name.
// ============================================================

const SELECTION_URL = DOCS.find(d => d.selection)?.url
const SIGN_OFF = '\n\nMany thanks,\nDD Davis Ltd\n01274 481302'

function firstName(lead) {
  return (lead.customer_name || '').trim().split(/\s+/)[0] || 'there'
}

export const EMAIL_TEMPLATES = [
  {
    key: 'confirm_survey',
    label: 'Confirm survey appointment',
    subject: 'Your bathroom survey — DD Davis Ltd',
    body: (lead, fmtDate) =>
      `Hi ${firstName(lead)},\n\nJust confirming your bathroom survey${lead.survey_completed_date ? ` on ${fmtDate(lead.survey_completed_date)}` : ''}. ` +
      `Our surveyor will visit to measure up, talk through what you're looking to achieve, and answer any questions you have.\n\n` +
      `If you need to change the date or time, just give us a call.` + SIGN_OFF,
  },
  {
    key: 'chase_selection',
    label: 'Chase selection form',
    subject: 'Your bathroom selection form — DD Davis Ltd',
    body: lead =>
      `Hi ${firstName(lead)},\n\nHope you're well. Just a gentle reminder about your bathroom selection form — once we have this back we can accurately price your project and get your CAD designs underway.\n\n` +
      `You can fill it in here:\n${SELECTION_URL}\n\n` +
      `If you have any questions or would like a hand choosing, we're happy to help.` + SIGN_OFF,
  },
  {
    key: 'follow_up_quote',
    label: 'Follow up quote',
    subject: 'Your bathroom quote — DD Davis Ltd',
    body: lead =>
      `Hi ${firstName(lead)},\n\nJust following up on the bathroom quote we sent over. If you have any questions, or you'd like to talk through options, styles or budgets, we're happy to help.\n\n` +
      `We also offer finance over 3\u201310 years if that's of interest \u2014 you can see what your monthly payments would look like here:\nhttps://dddavis.co.uk/finance/` + SIGN_OFF,
  },
]

function composeQs(lead, subject, body) {
  return `to=${encodeURIComponent(lead.email || '')}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function templateOutlook(lead, tpl, fmtDate) {
  const qs = composeQs(lead, tpl.subject, tpl.body(lead, fmtDate))
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '')
  return isMobile ? `ms-outlook://compose?${qs}` : `https://outlook.office.com/mail/deeplink/compose?${qs}`
}

export function templateMailto(lead, tpl, fmtDate) {
  const body = tpl.body(lead, fmtDate)
  return `mailto:${lead.email || ''}?subject=${encodeURIComponent(tpl.subject)}&body=${encodeURIComponent(body)}`
}
