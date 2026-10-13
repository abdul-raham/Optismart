import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY // Ensure you have this in .env.local

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase URL or Service Role Key in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function changeRole() {
  const email = 'bakare001@gmail.com' // Using the email from earlier context, assuming 01 was a typo
  
  // 1. Find user in public.users
  const { data: users, error: fetchError } = await supabase
    .from('users')
    .select('id, email, role')
    .ilike('email', 'bakare0%@gmail.com') // Matches bakare01 or bakare001

  if (fetchError || !users || users.length === 0) {
    console.error('Could not find user in public.users:', fetchError)
    return
  }

  for (const user of users) {
    console.log(`Found user: ${user.email} (Current Role: ${user.role})`)
    
    // 2. Update role to dsa
    const { error: updateError } = await supabase
      .from('users')
      .update({ role: 'dsa', status: 'active' })
      .eq('id', user.id)

    if (updateError) {
      console.error(`Failed to update role for ${user.email}:`, updateError)
    } else {
      console.log(`Successfully updated ${user.email} to DSA role!`)
      
      // Update auth.users user_metadata as well (if needed by frontend)
      const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
        user.id,
        { user_metadata: { role: 'dsa' } }
      )
      if (authUpdateError) {
        console.error(`Note: Could not update auth metadata for ${user.email}:`, authUpdateError)
      } else {
        console.log(`Successfully synced auth metadata for ${user.email}`)
      }
    }
  }
}

changeRole()
