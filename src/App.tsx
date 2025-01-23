import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Box, Container, Spinner, Center } from '@chakra-ui/react'
import { Auth } from './components/Auth'
import { AdminDashboard } from './components/AdminDashboard'
import { CustomerDashboard } from './components/CustomerDashboard'
import { SupportDashboard } from './components/SupportDashboard'
import { UserManagement } from './components/admin/UserManagement'
import { TicketList } from './components/tickets/TicketList'
import { supabase } from './lib/supabase'
import { Session } from '@supabase/supabase-js'

type UserRole = 'admin' | 'customer' | 'support'

interface UserProfile {
  id: string
  role: UserRole
  full_name?: string | null
  avatar_url?: string | null
  created_at: string
  updated_at: string
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Clear any existing sessions on mount
    sessionStorage.clear()
    localStorage.clear()

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        getProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email)
      
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setProfile(null)
        setLoading(false)
        // Clear any stored state
        sessionStorage.clear()
        localStorage.clear()
      } else if (event === 'SIGNED_IN' && session) {
        setSession(session)
        await getProfile(session.user.id)
      } else {
        setSession(session)
        if (session?.user) {
          await getProfile(session.user.id)
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    })

    return () => {
      subscription.unsubscribe()
      // Clear state on unmount
      setSession(null)
      setProfile(null)
    }
  }, [])

  async function getProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        // If profile doesn't exist or there's an error, sign out the user
        await supabase.auth.signOut()
        sessionStorage.clear()
        localStorage.clear()
        setSession(null)
        setProfile(null)
        setLoading(false)
        return
      }

      if (data) {
        setProfile(data)
      } else {
        // If no profile data, sign out
        await supabase.auth.signOut()
        sessionStorage.clear()
        localStorage.clear()
        setSession(null)
        setProfile(null)
      }
    } catch (error) {
      console.error('Error:', error)
      // On any error, clear everything
      await supabase.auth.signOut()
      sessionStorage.clear()
      localStorage.clear()
      setSession(null)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Center h="100vh">
        <Spinner size="xl" />
      </Center>
    )
  }

  // If there's no session, show the Auth component
  if (!session) {
    return (
      <Container maxW="container.sm" py={10}>
        <Auth />
      </Container>
    )
  }

  // If there's a session but no profile, show a loading state
  if (!profile) {
    return (
      <Center h="100vh">
        <Spinner size="xl" />
      </Center>
    )
  }

  return (
    <Router>
      <Box minH="100vh" bg="gray.50">
        <Routes>
          <Route path="/" element={
            profile?.role === 'admin' ? <Navigate to="/admin/users" /> :
            profile?.role === 'customer' ? <Navigate to="/customer" /> :
            profile?.role === 'support' ? <Navigate to="/support/tickets" /> :
            <Navigate to="/" />
          } />
          
          <Route path="/admin" element={
            profile?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/" />
          }>
            <Route path="users" element={<UserManagement />} />
            <Route path="tickets" element={<div>Tickets page coming soon...</div>} />
            <Route index element={<Navigate to="users" replace />} />
          </Route>

          <Route path="/support" element={
            profile?.role === 'support' ? <SupportDashboard /> : <Navigate to="/" />
          }>
            <Route path="tickets" element={<TicketList userRole="support" />} />
            <Route index element={<Navigate to="tickets" replace />} />
          </Route>

          <Route path="/customer" element={
            profile?.role === 'customer' ? <CustomerDashboard /> : <Navigate to="/" />
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
    </Router>
  )
}
