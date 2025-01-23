import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'http://127.0.0.1:54321'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const users = [
  {
    email: 'sarah.support@example.com',
    password: 'password123',
    data: {
      role: 'support',
      full_name: 'Sarah Support'
    }
  },
  {
    email: 'christina.customer@example.com',
    password: 'password123',
    data: {
      role: 'customer',
      full_name: 'Christina Customer'
    }
  },
  {
    email: 'adam.admin@example.com',
    password: 'password123',
    data: {
      role: 'admin',
      full_name: 'Adam Admin'
    }
  }
]

async function createUsers() {
  for (const user of users) {
    try {
      // First check if user exists
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', user.data.role)
        .eq('full_name', user.data.full_name)
        .single()

      if (existingUser) {
        console.log(`User ${user.email} already exists, skipping...`)
        continue
      }

      // Create user with admin API
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        user_metadata: user.data,
        email_confirm: true
      })

      if (error) {
        console.error(`Error creating user ${user.email}:`, error)
        continue
      }

      console.log(`Created user ${user.email}:`, data)

      // Create profile using the generated user ID
      const now = new Date().toISOString()
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert([
          {
            id: data.user.id,
            role: user.data.role,
            full_name: user.data.full_name,
            created_at: now,
            updated_at: now
          }
        ])

      if (profileError) {
        console.error(`Error creating profile for ${user.email}:`, profileError)
      } else {
        console.log(`Created profile for ${user.email}`)
      }
    } catch (error) {
      console.error(`Error creating user ${user.email}:`, error)
    }
  }
}

createUsers() 