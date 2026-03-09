import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Upload a file to the assets bucket
// Returns the permanent public URL
export async function uploadAsset(file) {
  const ext = file.name.split('.').pop()
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  
  const { error } = await supabase.storage
    .from('assets')
    .upload(filename, file, { upsert: false })

  if (error) throw error

  const { data } = supabase.storage
    .from('assets')
    .getPublicUrl(filename)

  return data.publicUrl
}

// Fetch all assets from the library
export async function fetchAssets() {
  const { data, error } = await supabase
    .from('media_assets')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// Save asset metadata to DB after upload
export async function saveAsset({ name, url, type, size_bytes }) {
  const { data, error } = await supabase
    .from('media_assets')
    .insert({ name, url, type, size_bytes })
    .select()
    .single()
  if (error) throw error
  return data
}