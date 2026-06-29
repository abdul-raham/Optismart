import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const SUPABASE_URL = 'https://gefulgrfkgrzzatildja.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlZnVsZ3Jma2dyenphdGlsZGphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5MjM5MjQsImV4cCI6MjA5NzQ5OTkyNH0.x3i4zeTEEmwv5YQUPjK8WYTwXJvL29f_beuuOKDUv7I'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const usersToCreate = [
  { email: 'owner@optismart.ng', role: 'super_admin', name: 'OptiSmart Super Admin' },
  { email: 'admin@optismart.ng', role: 'admin', name: 'OptiSmart Admin' },
  { email: 'dsa@optismart.ng', role: 'dsa', name: 'Amina Sales' },
  { email: 'installer@optismart.ng', role: 'installer', name: 'Tunde Installer' },
  { email: 'reseller@optismart.ng', role: 'reseller', name: 'Kemi Reseller' }
]

async function seedAuth() {
  console.log('Registering users with password "Temitayo2"...')
  for (const user of usersToCreate) {
    const { data, error } = await supabase.auth.signUp({
      email: user.email,
      password: 'Temitayo2',
      options: {
        data: {
          role: user.role,
          full_name: user.name
        }
      }
    })

    if (error) {
      console.log(`❌ Failed to create ${user.email}: ${error.message}`)
    } else {
      console.log(`✅ Successfully created ${user.email}`)
    }
  }
  console.log('\nDone! You can now log in.')
}

seedAuth()
