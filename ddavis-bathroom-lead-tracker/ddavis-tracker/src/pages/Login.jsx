import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setErr('Login failed — check your email and password.')
    setBusy(false)
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <img src="/logo.png" alt="DD Davis Limited — Built on trust. Driven by quality."
          style={{ display: 'block', width: '100%', maxWidth: 240, height: 'auto', margin: '0 auto 8px' }} />
        <div className="tag" style={{ textAlign: 'center' }}>Bathroom Lead Tracker</div>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} />
        <label htmlFor="pw">Password</label>
        <input id="pw" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
        {err && <div className="login-err">{err}</div>}
        <button className="btn gold" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  )
}
