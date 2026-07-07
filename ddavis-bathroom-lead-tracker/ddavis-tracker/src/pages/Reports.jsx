import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../App'
import { supabase } from '../lib/supabase'
import { money } from '../lib/logic'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts'

const GOLD = '#f3ab2d', GREEN = '#34d399', RED = '#f87171', BLUE = '#4f9dff', GREY = '#9a9aa4', AMBER = '#f3ab2d', PURPLE = '#b98bff'
const PIE = [GOLD, BLUE, GREEN, PURPLE, RED, GREY, '#7dd3fc', '#fda4af']

export default function Reports() {
  const { leads } = useApp()
  const [range, setRange] = useState('month') // week | month | all
  const [followUps, setFollowUps] = useState([])

  useEffect(() => {
    supabase.from('follow_ups').select('staff,date,method').then(({ data }) => setFollowUps(data || []))
  }, [])

  const cutoff = useMemo(() => {
    const d = new Date()
    if (range === 'week') d.setDate(d.getDate() - 7)
    else if (range === 'month') d.setMonth(d.getMonth() - 1)
    else return null
    return d
  }, [range])

  const inRange = l => !cutoff || new Date(l.created_at) >= cutoff
  const L = leads.filter(inRange)
  const won = L.filter(l => l.stage === 'Won')
  const lost = L.filter(l => l.stage === 'Lost')
  const surveys = L.filter(l => l.survey_completed)
  const forms = L.filter(l => l.selection_form_returned)
  const cadBooked = L.filter(l => l.cad_booked_date)
  const cadDone = L.filter(l => l.cad_status === 'approved' || l.cad_completed_date)
  const quotes = L.filter(l => l.quote_sent)

  const pct = (a, b) => b ? Math.round(a / b * 100) : 0

  const funnel = [
    { name: 'Leads', n: L.length },
    { name: 'Surveys', n: surveys.length },
    { name: 'Forms back', n: forms.length },
    { name: 'CAD done', n: cadDone.length },
    { name: 'Quoted', n: quotes.length },
    { name: 'Won', n: won.length },
  ]

  const sources = Object.entries(L.reduce((m, l) => {
    const k = l.lead_source || 'Unknown'; m[k] = (m[k] || 0) + 1; return m
  }, {})).map(([name, value]) => ({ name, value }))

  const lostReasons = Object.entries(lost.reduce((m, l) => {
    const k = l.lost_reason || 'Not recorded'; m[k] = (m[k] || 0) + 1; return m
  }, {})).map(([name, value]) => ({ name, value }))

  // monthly revenue over the last 6 months (all leads, not range-filtered)
  const monthly = useMemo(() => {
    const out = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i)
      const key = d.toISOString().slice(0, 7)
      const label = d.toLocaleDateString('en-GB', { month: 'short' })
      const monthWon = leads.filter(l => l.stage === 'Won' && (l.updated_at || l.created_at).slice(0, 7) === key)
      out.push({ label, revenue: monthWon.reduce((s, l) => s + Number(l.quote_value ?? l.estimated_value ?? 0), 0), jobs: monthWon.length })
    }
    return out
  }, [leads])

  const cadProgress = ['not booked', 'booked', 'in progress', 'sent to customer', 'revisions requested', 'approved']
    .map(s => ({ name: s, n: L.filter(l => l.cad_required === 'yes' && l.cad_status === s).length }))

  const staff = Object.entries(followUps.filter(f => !cutoff || new Date(f.date) >= cutoff)
    .reduce((m, f) => { const k = f.staff || 'Unknown'; m[k] = (m[k] || 0) + 1; return m }, {}))
    .map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n)

  const totalQuoteValue = quotes.reduce((s, l) => s + Number(l.quote_value ?? l.estimated_value ?? 0), 0)
  const wonValue = won.reduce((s, l) => s + Number(l.quote_value ?? l.estimated_value ?? 0), 0)
  const wonProfit = won.reduce((s, l) => s + Number(l.estimated_profit ?? 0), 0)

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Performance</div>
          <h1>Reports</h1>
          <div className="sub">Based on leads added {range === 'all' ? 'all time' : `in the last ${range}`}. Revenue chart always shows 6 months.</div>
        </div>
        <div className="seg">
          {[['week', 'Weekly'], ['month', 'Monthly'], ['all', 'All time']].map(([k, l]) => (
            <button key={k} className={range === k ? 'on' : ''} onClick={() => setRange(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="grid stats-grid" style={{ marginBottom: 16 }}>
        {[
          [L.length, 'Bathroom leads'], [surveys.length, 'Surveys completed'], [forms.length, 'Selection forms returned'],
          [cadBooked.length, 'CAD designs booked'], [cadDone.length, 'CAD designs completed'], [quotes.length, 'Quotes sent'],
          [won.length, 'Jobs won'], [lost.length, 'Jobs lost'],
          [`${pct(quotes.length, surveys.length)}%`, 'Survey → quote'], [`${pct(won.length, quotes.length)}%`, 'Quote → sale'],
          [money(totalQuoteValue), 'Total quote value'], [money(wonValue), 'Total won value'], [money(wonProfit), 'Estimated profit (won)'],
        ].map(([n, l]) => <div key={l} className="card stat"><div className="n">{n}</div><div className="l">{l}</div></div>)}
      </div>

      <div className="grid two-col" style={{ marginBottom: 14 }}>
        <div className="card"><div className="card-head"><h2>Sales funnel</h2></div>
          <div className="card-body" style={{ height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={funnel} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={80} />
                <Tooltip /><Bar dataKey="n" fill={GOLD} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card"><div className="card-head"><h2>Lead source breakdown</h2></div>
          <div className="card-body" style={{ height: 260 }}>
            {sources.length === 0 ? <p className="muted">No data yet.</p> :
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={sources} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {sources.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>}
          </div>
        </div>
      </div>

      <div className="grid two-col" style={{ marginBottom: 14 }}>
        <div className="card"><div className="card-head"><h2>Won vs lost</h2></div>
          <div className="card-body" style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={[{ name: range === 'all' ? 'All time' : `Last ${range}`, Won: won.length, Lost: lost.length }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Legend />
                <Bar dataKey="Won" fill={GREEN} radius={[6, 6, 0, 0]} /><Bar dataKey="Lost" fill={RED} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card"><div className="card-head"><h2>Monthly won revenue (6 months)</h2></div>
          <div className="card-body" style={{ height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" /><XAxis dataKey="label" /><YAxis tickFormatter={v => '£' + (v / 1000) + 'k'} />
                <Tooltip formatter={v => money(v)} />
                <Line type="monotone" dataKey="revenue" stroke={GOLD} strokeWidth={2.5} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid two-col" style={{ marginBottom: 14 }}>
        <div className="card"><div className="card-head"><h2>CAD progress</h2></div>
          <div className="card-body" style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={cadProgress}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} /><YAxis allowDecimals={false} /><Tooltip />
                <Bar dataKey="n" fill={BLUE} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card"><div className="card-head"><h2>Lost lead reasons</h2></div>
          <div className="card-body" style={{ height: 240 }}>
            {lostReasons.length === 0 ? <p className="muted">No lost leads in this period.</p> :
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={lostReasons} dataKey="value" nameKey="name" outerRadius={85}>
                    {lostReasons.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Staff follow-up activity</h2></div>
        <div className="card-body">
          {staff.length === 0 ? <p className="muted">No follow-ups logged in this period.</p> :
            <table className="data"><thead><tr><th>Staff member</th><th>Follow-ups logged</th></tr></thead>
              <tbody>{staff.map(s => <tr key={s.name}><td><b>{s.name}</b></td><td>{s.n}</td></tr>)}</tbody></table>}
        </div>
      </div>
    </>
  )
}
