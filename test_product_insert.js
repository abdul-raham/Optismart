import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testInsert() {
  console.log('Logging in...')
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'abdulrahmanbakare001@gmail.com',
    password: 'Temitayo2'
  })

  if (authError) {
    console.error('Login Failed:', authError)
    return
  }

  console.log('Login successful! User ID:', authData.user.id)
  
  console.log('Checking current role...')
  const { data: roleData, error: roleError } = await supabase.rpc('current_app_role')
  console.log('current_app_role:', roleData, roleError)
  
  const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin')
  console.log('is_admin:', isAdmin, adminError)

  console.log('Attempting to insert dummy product...')
  const dummyProduct = {
    name: 'TEST PRODUCT ' + Date.now(),
    description: 'This is a test product',
    retail_price: 1000,
    wholesale_price: 800,
    stock_quantity: 10,
    min_stock_level: 5,
    is_active: true
  }

  const { data, error } = await supabase.from('products').insert([dummyProduct]).select().single()

  if (error) {
    console.error('\n❌ INSERT FAILED:', JSON.stringify(error, null, 2))
  } else {
    console.log('\n✅ INSERT SUCCESS:', data.id)
    
    // cleanup
    await supabase.from('products').delete().eq('id', data.id)
  }
}

testInsert()
