import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(url, key, {
  realtime: { params: { eventsPerSecond: 10 } },
})

export const DEFAULT_BOARD_ID =
  import.meta.env.VITE_DEFAULT_BOARD_ID ||
  '00000000-0000-0000-0000-000000000001'
