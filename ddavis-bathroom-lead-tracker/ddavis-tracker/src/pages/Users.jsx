import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'
import { SkeletonRows } from '../components/ui'

const ROLES = ['management', 'admin', 'designer', 'staff']

export default function Users() {
  const { profile, notify } = useApp()
  const [users, setUsers] = useState(null)
  const isManager = profile?.role === 'management'

  const load = () => supabase.from('profiles').select('*').order('name').then(({ data }) => setUsers(data || []))
  useEffect(() => { load() }, [])

  async function setRole(id, role) {
    if (!isManager) return notify('Only management can change roles')
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
    notify(error ? 'Could not update role' : 'Role updated ✓'); load()
  }

  if (!users) return <SkeletonRows n={4} />

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Team</div>
          <h1>User Management</h1>
          <div className="sub">The 4 DD Davis accounts. New users are created in the Supabase dashboard (see the README) so passwords stay secure.</div>
        </div>
      </div>
      <div className="card table-wrap">
        <table className="data">
          <thead><tr><th>Name</th><th>Role</th><th>Added</th></tr></thead>
          <tbody>{users.map(u => (
            <tr key={u.id}>
              <td><b>{u.name}</b>{u.id === profile.id && <span className="badge gold" style={{ marginLeft: 8 }}>you</span>}</td>
              <td>
                {isManager
                  ? <select value={u.role} onChange={e => setRole(u.id, e.target.value)} style={{ border: '1px solid var(--border-strong)', borderRadius: 8, padding: '5px 8px' }}>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  : <span className="badge grey" style={{ textTransform: 'capitalize' }}>{u.role}</span>}
              </td>
              <td className="small">{new Date(u.created_at).toLocaleDateString('en-GB')}</td>
            </tr>))}</tbody>
        </table>
      </div>
      <p className="muted small" style={{ marginTop: 12 }}>
        To add or remove a user: Supabase dashboard → Authentication → Users. A profile row is created automatically when a user is added.
      </p>
    </>
  )
}
