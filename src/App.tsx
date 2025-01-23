import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Box, Container, Spinner, Center } from '@chakra-ui/react'
import { Auth } from './components/Auth'
import { AdminDashboard } from './components/AdminDashboard'
import { CustomerDashboard } from './components/CustomerDashboard'
import { SupportDashboard } from './components/SupportDashboard'
import { supabase } from './lib/supabase'

type UserRole = 'admin' | 'customer' | 'support'

interface UserProfile {
  id: string
  role: UserRole
  email: string
}

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('App mounted, checking session...')
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session:', session)
      setSession(session)
      if (session?.user) {
        getProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', session)
      setSession(session)
      if (session?.user) {
        getProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function getProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      console.log('Profile data:', data)
      setProfile(data)
    } catch (error) {
      console.error('Error loading user profile:', error)
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

  if (!session) {
    return (
      <Container maxW="container.sm" py={10}>
        <Auth />
      </Container>
    )
  }

  return (
    <Router>
      <Box minH="100vh" bg="gray.50">
        <Routes>
          <Route path="/" element={
            profile?.role === 'admin' ? <Navigate to="/admin" /> :
            profile?.role === 'support' ? <Navigate to="/support" /> :
            <Navigate to="/dashboard" />
          } />
          <Route path="/admin" element={
            profile?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/" />
          } />
          <Route path="/support" element={
            profile?.role === 'support' ? <SupportDashboard /> : <Navigate to="/" />
          } />
          <Route path="/dashboard" element={<CustomerDashboard />} />
        </Routes>
      </Box>
    </Router>
  )
}
