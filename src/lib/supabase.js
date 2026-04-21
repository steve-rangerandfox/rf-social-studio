import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Upload a file to the assets bucket. Returns the permanent public URL.
//
// IMPORTANT: Use this for any video or large image. Never store the file
// bytes in document state — the doc is persisted to localStorage /
// IndexedDB, which blows out the browser storage quota on the first
// video.
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

// Same as uploadAsset but reports 0..1 progress via the callback.
// Uses a signed upload URL + XHR so we can hook into xhr.upload.onprogress
// (the Supabase JS client's upload doesn't surface progress events).
export async function uploadAssetWithProgress(file, onProgress) {
  const ext = file.name.split('.').pop()
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const signed = await supabase.storage
    .from('assets')
    .createSignedUploadUrl(filename)

  if (signed.error) throw signed.error
  const { signedUrl, token } = signed.data

  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', signedUrl, true)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && typeof onProgress === 'function') {
        onProgress(e.loaded / e.total)
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText || xhr.statusText}`))
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.send(file)
  })

  const { data } = supabase.storage.from('assets').getPublicUrl(filename)
  return data.publicUrl
}

// Client-side size limits so we fail fast instead of letting an upload
// spin and then die at the server / storage boundary.
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024   // 25 MB
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024  // 100 MB

export function checkFileSize(file) {
  const isVideo = file.type.startsWith('video/')
  const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  if (file.size > limit) {
    const mb = Math.round(limit / (1024 * 1024))
    throw new Error(`File is too large. Maximum is ${mb} MB for ${isVideo ? 'videos' : 'images'}.`)
  }
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