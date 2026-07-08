import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { optismartCatalogProducts } from './src/data/optismartProducts.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '.env.local') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function runSync() {
  console.log('Logging in...')
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'abdulrahmanbakare001@gmail.com',
    password: 'Temitayo2'
  })

  if (authError) {
    console.error('Login Failed:', authError.message)
    return
  }
  console.log('Login successful!')

  console.log('Fetching existing products...')
  const { data: existing, error: fetchErr } = await supabase.from('products').select('name')
  if (fetchErr) {
    console.error('Fetch error:', fetchErr.message)
    return
  }

  const existingNames = new Set((existing || []).map(p => p.name))

  const newProducts = optismartCatalogProducts
    .filter(p => !existingNames.has(p.name))
    .map(({ specs: _specs, ...product }) => ({
      ...product,
      is_active: true,
    }))

  if (newProducts.length === 0) {
    console.log('No new products to insert. Updating existing ones with new images just in case...')
    // update existing
    for (const prod of optismartCatalogProducts) {
      await supabase.from('products').update({
        image_url: prod.image_url,
        source_url: prod.source_url
      }).eq('name', prod.name)
    }
    console.log('Done updating.')
    return
  }

  console.log(`Attempting to insert ${newProducts.length} new products...`)
  const { error: insertError } = await supabase.from('products').insert(newProducts)

  if (insertError) {
    console.error('\n❌ INSERT FAILED:', JSON.stringify(insertError, null, 2))
  } else {
    console.log('\n✅ INSERT SUCCESS!')
    
    // Also update existing ones just in case
    for (const prod of optismartCatalogProducts) {
      await supabase.from('products').update({
        image_url: prod.image_url,
        source_url: prod.source_url
      }).eq('name', prod.name)
    }
    console.log('✅ UPDATED EXISTING IMAGES TOO.')
  }
}

runSync()
