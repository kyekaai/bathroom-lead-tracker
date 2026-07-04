import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — check your .env file or Netlify environment variables.')
}

export const supabase = createClient(url, key)

// Write a line to a lead's timeline. Fire-and-forget.
export async function logActivity(leadId, type, message, actor) {
  try {
    await supabase.from('activity').insert({ lead_id: leadId, type, message, actor })
  } catch (e) { console.error('activity log failed', e) }
}
