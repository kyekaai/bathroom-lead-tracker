import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Papa from 'papaparse'
import { supabase, logActivity } from '../lib/supabase'
import { useApp } from '../App'
import { IMPORT_FIELDS, guessMapping, matchLead } from '../lib/logic'

export default function ImportLeads() {
  const { leads, profile, notify, refresh } = useApp()
  const nav = useNavigate()
  const [step, setStep] = useState(1)          // 1 upload · 2 map · 3 review · 4 done
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [mapping, setMapping] = useState({})
  const [review, setReview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [drag, setDrag] = useState(false)
  const fileInput = useRef()

  // ---------- step 1: parse the CSV ----------
  function handleFile(file) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) return notify('Please upload a .csv file exported from your CRM.')
    setFileName(file.name)
    Papa.parse(file, {
      header: true, skipEmptyLines: 'greedy',
      complete: res => {
        const hs = res.meta.fields || []
        if (hs.length === 0 || res.data.length === 0) return notify('That file looks empty — check the CRM export.')
        setHeaders(hs)
        setRows(res.data)
        setMapping(guessMapping(hs))
        setStep(2)
      },
      error: () => notify('Could not read that CSV file.'),
    })
  }

  // ---------- step 2 → 3: build the review ----------
  function buildReview() {
    if (!mapping.customer_name) return notify('Map a column to Customer name first — it is required.')
    const toField = row => {
      const out = {}
      for (const f of IMPORT_FIELDS) {
        const col = mapping[f.key]
        if (col && row[col] !== undefined) out[f.key] = String(row[col]).trim()
      }
      if (out.estimated_value) out.estimated_value = Number(String(out.estimated_value).replace(/[£,]/g, '')) || null
      if (out.estimated_profit) out.estimated_profit = Number(String(out.estimated_profit).replace(/[£,]/g, '')) || null
      if (out.survey_completed_date) {
        const d = parseUkDate(out.survey_completed_date)
        out.survey_completed_date = d || null
      }
      return out
    }

    const newLeads = [], updates = [], possibles = [], missing = [], errors = []
    rows.forEach((raw, i) => {
      try {
        const row = toField(raw)
        if (!row.customer_name) { errors.push({ line: i + 2, reason: 'No customer name' }); return }
        const gaps = []
        if (!row.phone && !row.email) gaps.push('no phone or email')
        if (!row.postcode && !row.address) gaps.push('no address or postcode')
        const m = matchLead(row, existingPool(newLeads, leads))
        const entry = { row, gaps, line: i + 2 }
        if (m.type === 'update') updates.push({ ...entry, existing: m.lead })
        else if (m.type === 'possible') possibles.push({ ...entry, existing: m.lead, include: false })
        else { newLeads.push(entry); if (gaps.length) missing.push(entry) }
      } catch (e) {
        errors.push({ line: i + 2, reason: e.message })
      }
    })
    setReview({ newLeads, updates, possibles, missing, errors })
    setStep(3)
  }

  // include rows already staged as "new" so duplicates inside the same file are caught too
  function existingPool(stagedNew, dbLeads) {
    return [...dbLeads, ...stagedNew.map(e => e.row)]
  }

  // ---------- step 3 → 4: run the import ----------
  async function runImport() {
    setBusy(true)
    const importId = crypto.randomUUID()
    let imported = 0, updated = 0, errorRows = [...review.errors]

    const toInsert = [
      ...review.newLeads.map(e => e.row),
      ...review.possibles.filter(p => p.include).map(e => e.row),
    ]
    const skipped = review.possibles.filter(p => !p.include).length

    for (const row of toInsert) {
      const { data, error } = await supabase.from('leads')
        .insert({ ...row, stage: 'Survey Complete', survey_completed: true, import_id: importId, created_by: profile?.id }).select('id').single()
      if (error) errorRows.push({ line: '-', reason: `${row.customer_name}: ${error.message}` })
      else { imported++; await logActivity(data.id, 'import', `Imported from CSV: ${fileName}`, profile?.name) }
    }

    for (const u of review.updates) {
      const patch = {}
      for (const [k, v] of Object.entries(u.row)) if (v !== null && v !== '' && !u.existing[k]) patch[k] = v
      if (Object.keys(patch).length === 0) { updated++; continue }
      const { error } = await supabase.from('leads').update(patch).eq('id', u.existing.id)
      if (error) errorRows.push({ line: u.line, reason: `${u.row.customer_name}: ${error.message}` })
      else { updated++; await logActivity(u.existing.id, 'import', `Updated from CSV: ${fileName}`, profile?.name) }
    }

    await supabase.from('import_history').insert({
      file_name: fileName, imported_by: profile?.id,
      imported_count: imported, updated_count: updated,
      duplicates_skipped: skipped, error_count: errorRows.length,
      errors: errorRows.length ? errorRows : null,
    })

    await refresh()
    setResult({ imported, updated, skipped, errors: errorRows.length })
    setBusy(false)
    setStep(4)
  }

  function reset() {
    setStep(1); setFileName(''); setHeaders([]); setRows([]); setMapping({}); setReview(null); setResult(null)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">From your CRM</div>
          <h1>Import CRM Leads</h1>
          <div className="sub">Export bathroom leads from the CRM as CSV, then upload here. Duplicates are checked automatically.</div>
        </div>
        <Link to="/import/history" className="btn ghost">↺ Import History</Link>
      </div>

      <div className="steps">
        {['Upload file', 'Map columns', 'Review & import', 'Done'].map((s, i) => (
          <div key={s} className={`s ${step === i + 1 ? 'on' : ''} ${step > i + 1 ? 'done' : ''}`}>
            <i>{step > i + 1 ? '✓' : i + 1}</i>{s}{i < 3 && <span className="muted"> →</span>}
          </div>
        ))}
      </div>

      {/* STEP 1 */}
      {step === 1 && (
        <div className="card"><div className="card-body">
          <div className={`dropzone ${drag ? 'on' : ''}`}
            onClick={() => fileInput.current.click()}
            onDragOver={e => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]) }}>
            <p style={{ fontSize: 30, margin: '0 0 6px' }}>↥</p>
            <b>Drag and drop your CSV file here</b>
            <p className="muted">or click to choose a file</p>
            <input ref={fileInput} type="file" accept=".csv" hidden onChange={e => handleFile(e.target.files[0])} />
          </div>
          <p className="muted small" style={{ marginBottom: 0 }}>Columns are detected automatically — you'll get a chance to check the mapping and preview everything before anything is imported.</p>
        </div></div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="card">
          <div className="card-head"><h2>Map CSV columns → tracker fields</h2><span className="badge grey">{fileName} · {rows.length} rows</span></div>
          <div className="card-body">
            <div className="form-grid">
              {IMPORT_FIELDS.map(f => (
                <div className="field" key={f.key}>
                  <label>{f.label} {f.required && <span className="req">*</span>}</label>
                  <select value={mapping[f.key] || ''} onChange={e => setMapping({ ...mapping, [f.key]: e.target.value || undefined })}>
                    <option value="">— not in this file —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <hr className="divider" />
            <b className="small">Preview (first 3 rows)</b>
            <div className="table-wrap" style={{ marginTop: 8 }}>
              <table className="data">
                <thead><tr>{IMPORT_FIELDS.filter(f => mapping[f.key]).map(f => <th key={f.key}>{f.label}</th>)}</tr></thead>
                <tbody>{rows.slice(0, 3).map((r, i) => (
                  <tr key={i}>{IMPORT_FIELDS.filter(f => mapping[f.key]).map(f => <td key={f.key} className="small">{r[mapping[f.key]] || <span className="muted">—</span>}</td>)}</tr>
                ))}</tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn gold" onClick={buildReview}>Next: review import</button>
              <button className="btn ghost" onClick={reset}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && review && (
        <>
          <div className="grid stats-grid" style={{ marginBottom: 14 }}>
            <div className="card stat green"><div className="n">{review.newLeads.length}</div><div className="l">New leads to import</div></div>
            <div className="card stat blue"><div className="n">{review.updates.length}</div><div className="l">Existing leads to update</div></div>
            <div className="card stat amber"><div className="n">{review.possibles.length}</div><div className="l">Possible duplicates</div></div>
            <div className="card stat amber"><div className="n">{review.missing.length}</div><div className="l">Rows missing key details</div></div>
            <div className="card stat red"><div className="n">{review.errors.length}</div><div className="l">Import errors</div></div>
          </div>

          {review.possibles.length > 0 && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-head"><h2>⚠ Possible duplicates — tick any you still want to import</h2></div>
              <div className="table-wrap"><table className="data">
                <thead><tr><th>Import?</th><th>CSV row</th><th>Looks like existing lead</th></tr></thead>
                <tbody>{review.possibles.map((p, i) => (
                  <tr key={i}>
                    <td><input type="checkbox" checked={p.include} onChange={e => {
                      const next = [...review.possibles]; next[i] = { ...p, include: e.target.checked }
                      setReview({ ...review, possibles: next })
                    }} /></td>
                    <td><b>{p.row.customer_name}</b><div className="muted small">{p.row.phone || p.row.email || ''} · {p.row.postcode || ''}</div></td>
                    <td>{p.existing.customer_name}<div className="muted small">{p.existing.phone || p.existing.email || ''} · {p.existing.postcode || ''}</div></td>
                  </tr>))}</tbody>
              </table></div>
            </div>
          )}

          {review.missing.length > 0 && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-head"><h2>Rows missing key details (will still import — flagged so you can fill them in)</h2></div>
              <div className="table-wrap"><table className="data">
                <thead><tr><th>Line</th><th>Customer</th><th>Missing</th></tr></thead>
                <tbody>{review.missing.map((m, i) => (
                  <tr key={i}><td>{m.line}</td><td><b>{m.row.customer_name}</b></td><td><span className="badge amber">{m.gaps.join(', ')}</span></td></tr>
                ))}</tbody>
              </table></div>
            </div>
          )}

          {review.errors.length > 0 && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-head"><h2>Errors (these rows will be skipped)</h2></div>
              <div className="card-body">{review.errors.map((e, i) => <p key={i} className="small" style={{ margin: '4px 0' }}><span className="badge red">line {e.line}</span> {e.reason}</p>)}</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn gold" onClick={runImport} disabled={busy}>
              {busy ? 'Importing…' : `Confirm import (${review.newLeads.length + review.possibles.filter(p => p.include).length} new · ${review.updates.length} updates)`}
            </button>
            <button className="btn ghost" onClick={() => setStep(2)} disabled={busy}>Back</button>
          </div>
        </>
      )}

      {/* STEP 4 */}
      {step === 4 && result && (
        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ fontSize: 34, margin: 0 }}>✓</p>
          <h2 style={{ margin: '8px 0 14px' }}>Import complete</h2>
          <div className="pill-row" style={{ justifyContent: 'center' }}>
            <span className="badge green">{result.imported} imported</span>
            <span className="badge blue">{result.updated} updated</span>
            <span className="badge amber">{result.skipped} duplicates skipped</span>
            <span className="badge red">{result.errors} errors</span>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20 }}>
            <button className="btn gold" onClick={() => nav('/leads')}>View leads</button>
            <button className="btn ghost" onClick={reset}>Import another file</button>
          </div>
        </div></div>
      )}
    </>
  )
}

// Accepts 12/05/2024, 2024-05-12, 12-05-24 …
function parseUkDate(s) {
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/)
  if (!m) return null
  let [, dd, mm, yy] = m
  if (yy.length === 2) yy = '20' + yy
  return `${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}
