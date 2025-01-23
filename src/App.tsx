import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
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

function AppContent() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  async function getProfile(userId: string) {
    console.log('Fetching profile for user:', userId)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        await handleSignOut()
        return null
      }

      if (data) {
        console.log('Profile fetched successfully:', data.role)
        return data
      } else {
        console.log('No profile found')
        await handleSignOut()
        return null
      }
    } catch (error) {
      console.error('Error:', error)
      await handleSignOut()
      return null
    }
  }

  async function handleSignOut() {
    console.log('Signing out...')
    try {
      await supabase.auth.signOut()
      setSession(null)
      setProfile(null)
      navigate('/', { replace: true })
    } catch (error) {
      console.error('Error signing out:', error)
      setSession(null)
      setProfile(null)
      navigate('/', { replace: true })
    } finally {
      setLoading(false)
    }
  }

  // Effect to handle profile loading whenever session changes
  useEffect(() => {
    let mounted = true

    async function loadProfile() {
      if (!session?.user?.id) {
        setProfile(null)
        return
      }

      setLoading(true)
      const profileData = await getProfile(session.user.id)
      if (mounted) {
        if (profileData) {
          setProfile(profileData)
        }
        setLoading(false)
      }
    }

    loadProfile()

    return () => {
      mounted = false
    }
  }, [session])

  useEffect(() => {
    let mounted = true

    async function initializeSession() {
      try {
        console.log('Initializing session...')
        const { data: { session: initialSession } } = await supabase.auth.getSession()
        
        if (!mounted) return

        if (initialSession?.user) {
          console.log('Initial session found for:', initialSession.user.email)
          setSession(initialSession)
        } else {
          console.log('No initial session found')
          setSession(null)
          setProfile(null)
          setLoading(false)
        }
      } catch (error) {
        console.error('Error initializing session:', error)
        setSession(null)
        setProfile(null)
        setLoading(false)
      }
    }

    // Initialize session
    initializeSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('Auth state changed:', event, currentSession?.user?.email)
      
      if (!mounted) return

      if (event === 'SIGNED_OUT') {
        console.log('User signed out')
        setSession(null)
        setProfile(null)
        setLoading(false)
        navigate('/', { replace: true })
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        console.log('Setting session for:', currentSession?.user?.email)
        setSession(currentSession)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [navigate])

  console.log('Current state -', 'Session:', !!session, 'Profile:', !!profile, 'Loading:', loading)

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

  if (!profile) {
    return (
      <Center h="100vh">
        <Spinner size="xl" />
      </Center>
    )
  }

  console.log('Rendering main content for role:', profile.role)
  return (
    <Box minH="100vh" bg="gray.50">
      <Routes>
        <Route path="/" element={
          profile?.role === 'admin' ? <Navigate to="/admin/users" /> :
          profile?.role === 'customer' ? <Navigate to="/customer/tickets" /> :
          profile?.role === 'support' ? <Navigate to="/support/tickets" /> :
          <Navigate to="/" />
        } />
        
        <Route path="/admin/*" element={
          profile?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/" />
        } />

        <Route path="/support/*" element={
          profile?.role === 'support' ? <SupportDashboard /> : <Navigate to="/" />
        } />

        <Route path="/customer/*" element={
          profile?.role === 'customer' ? <CustomerDashboard /> : <Navigate to="/" />
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Box>
  )
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}
