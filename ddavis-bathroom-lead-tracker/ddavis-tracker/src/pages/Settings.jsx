import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'

export default function Settings() {
  const { profile, session, notify } = useApp()
  const [name, setName] = useState(profile?.name || '')
  const [pw, setPw] = useState('')

  async function saveName(e) {
    e.preventDefault()
    const { error } = await supabase.from('profiles').update({ name }).eq('id', profile.id)
    notify(error ? 'Could not save name' : 'Name saved ✓ — refresh to see it everywhere')
  }
  async function savePw(e) {
    e.preventDefault()
    if (pw.length < 8) return notify('Password must be at least 8 characters')
    const { error } = await supabase.auth.updateUser({ password: pw })
    setPw('')
    notify(error ? 'Could not change password' : 'Password changed ✓')
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Your account</div>
          <h1>Settings</h1>
          <div className="sub">Signed in as {session.user.email}</div>
        </div>
      </div>
      <div className="grid two-col">
        <form className="card" onSubmit={saveName}>
          <div className="card-head"><h2>Display name</h2></div>
          <div className="card-body">
            <div className="field"><label>Name shown on follow-ups and the timeline</label>
              <input value={name} onChange={e => setName(e.target.value)} required /></div>
            <button className="btn gold">Save name</button>
          </div>
        </form>
        <form className="card" onSubmit={savePw}>
          <div className="card-head"><h2>Change password</h2></div>
          <div className="card-body">
            <div className="field"><label>New password (min 8 characters)</label>
              <input type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" required /></div>
            <button className="btn gold">Change password</button>
          </div>
        </form>
      </div>
    </>
  )
}
