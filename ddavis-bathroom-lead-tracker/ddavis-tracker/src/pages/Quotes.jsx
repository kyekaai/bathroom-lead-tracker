import { useNavigate } from 'react-router-dom'
import { useApp } from '../App'
import { StageBadge, Empty } from '../components/ui'
import { derive, fmtDate, money } from '../lib/logic'

export default function Quotes() {
  const { leads, loading } = useApp()
  const nav = useNavigate()
  if (loading) return <p className="muted">Loading…</p>

  const toSend = leads.map(l => ({ l, d: derive(l) })).filter(x => x.d.flags.sendQuote)
  const open = leads.filter(l => l.quote_sent && !l.quote_outcome && l.stage !== 'Won' && l.stage !== 'Lost')
  const decided = leads.filter(l => l.quote_outcome)

  const openValue = open.reduce((s, l) => s + Number(l.quote_value ?? l.estimated_value ?? 0), 0)

  const Table = ({ rows }) => (
    <div className="table-wrap">
      <table className="data">
        <thead><tr><th>Customer</th><th>Stage</th><th>Quote value</th><th>Sent</th><th>Chases</th><th>Next chase</th><th>Outcome</th></tr></thead>
        <tbody>{rows.map(l => (
          <tr key={l.id} className="click" onClick={() => nav(`/leads/${l.id}`)}>
            <td><b>{l.customer_name}</b><div className="muted small">{l.postcode || ''}</div></td>
            <td><StageBadge stage={l.stage} /></td>
            <td>{money(l.quote_value ?? l.estimated_value)}</td>
            <td className="small">{fmtDate(l.quote_sent_date)}</td>
            <td>{l.quote_chase_attempts || 0}</td>
            <td className="small">{fmtDate(l.next_quote_chase_date)}</td>
            <td>{l.quote_outcome
              ? <span className={`badge ${l.quote_outcome === 'accepted' ? 'green' : 'red'}`}>{l.quote_outcome}</span>
              : <span className="badge amber">awaiting</span>}</td>
          </tr>))}</tbody>
      </table>
    </div>
  )

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Money on the table</div>
          <h1>Quotes</h1>
          <div className="sub">{open.length} quotes awaiting a decision · {money(openValue)} in play</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-head"><h2><span className="dot amber" style={{ marginRight: 8 }} />Ready to quote ({toSend.length})</h2></div>
        {toSend.length === 0 ? <Empty title="Nothing waiting to be quoted" /> : <Table rows={toSend.map(x => x.l)} />}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-head"><h2><span className="dot blue" style={{ marginRight: 8 }} />Sent — awaiting decision ({open.length})</h2></div>
        {open.length === 0 ? <Empty title="No open quotes" /> : <Table rows={open} />}
      </div>

      <div className="card">
        <div className="card-head"><h2>Decided ({decided.length})</h2></div>
        {decided.length === 0 ? <Empty title="No decided quotes yet" /> : <Table rows={decided} />}
      </div>
    </>
  )
}
