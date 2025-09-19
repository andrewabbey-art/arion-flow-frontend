"use client"

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function TestSupabase() {
  const [status, setStatus] = useState<string>('Loading...')

  useEffect(() => {
    async function check() {
      const { data, error } = await supabase.from('users').select('id, status').limit(1)
      if (error) setStatus('Error: ' + error.message)
      else setStatus('Success: Found ' + data.length + ' user(s)')
    }
    check()
  }, [])

  return <div>{status}</div>
}
