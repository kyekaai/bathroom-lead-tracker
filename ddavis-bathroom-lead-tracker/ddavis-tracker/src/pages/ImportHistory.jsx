import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Empty, SkeletonRows } from '../components/ui'

export default function ImportHistory() {
  const [rows, setRows] = useState(null)
  const [profiles, setProfiles] = useState({})

  useEffect(() => {
    supabase.from('import_history').select('*').order('imported_at', { ascending: false })
      .then(({ data }) => setRows(data || []))
    supabase.from('profiles').select('id,name')
      .then(({ data }) => setProfiles(Object.fromEntries((data || []).map(p => [p.id, p.name]))))
  }, [])

  if (!rows) return <SkeletonRows n={4} />

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Audit trail</div>
          <h1>Import History</h1>
          <div className="sub">Every CRM CSV import, who ran it, and what happened.</div>
        </div>
        <Link to="/import" className="btn gold">↥ New import</Link>
      </div>

      <div className="card table-wrap">
        {rows.length === 0
          ? <Empty title="No imports yet">Run your first import from the Import CRM Leads page.</Empty>
          : <table className="data">
              <thead><tr>
                <th>File</th><th>Date</th><th>Uploaded by</th>
                <th>Imported</th><th>Updated</th><th>Duplicates skipped</th><th>Errors</th>
              </tr></thead>
              <tbody>{rows.map(r => (
                <tr key={r.id}>
                  <td><b>{r.file_name}</b></td>
                  <td className="small">{new Date(r.imported_at).toLocaleString('en-GB')}</td>
                  <td className="small">{profiles[r.imported_by] || '—'}</td>
                  <td><span className="badge green">{r.imported_count}</span></td>
                  <td><span className="badge blue">{r.updated_count}</span></td>
                  <td><span className="badge amber">{r.duplicates_skipped}</span></td>
                  <td>{r.error_count > 0
                    ? <details><summary className="badge red" style={{ cursor: 'pointer' }}>{r.error_count}</summary>
                        <div className="small" style={{ marginTop: 6 }}>{(r.errors || []).map((e, i) => <div key={i}>line {e.line}: {e.reason}</div>)}</div>
                      </details>
                    : <span className="badge grey">0</span>}</td>
                </tr>))}</tbody>
            </table>}
      </div>
    </>
  )
}
