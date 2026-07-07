import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://gefulgrfkgrzzatildja.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlZnVsZ3Jma2dyenphdGlsZGphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5MjM5MjQsImV4cCI6MjA5NzQ5OTkyNH0.x3i4zeTEEmwv5YQUPjK8WYTwXJvL29f_beuuOKDUv7I'
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkUser() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'abdulrahmanbakare001@gmail.com',
    password: 'Temitayo2'
  })

  if (error) {
    console.error('Login Error:', error.message)
    return
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', data.user.id)
    .single()

  if (profileError) {
    console.error('Profile Error:', profileError.message)
    return
  }

  console.log('User Profile:', profile)
}

checkUser()
