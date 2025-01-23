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
        return
      }

      if (data) {
        console.log('Profile fetched successfully:', data.role)
        setProfile(data)
      } else {
        console.log('No profile found')
        await handleSignOut()
      }
    } catch (error) {
      console.error('Error:', error)
      await handleSignOut()
    }
  }

  async function handleSignOut() {
    console.log('Signing out...')
    try {
      setSession(null)
      setProfile(null)
      sessionStorage.clear()
      localStorage.clear()
      await supabase.auth.signOut()
      navigate('/', { replace: true })
    } catch (error) {
      console.error('Error signing out:', error)
      setSession(null)
      setProfile(null)
      sessionStorage.clear()
      localStorage.clear()
      navigate('/', { replace: true })
    } finally {
      setLoading(false)
    }
  }

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
          await getProfile(initialSession.user.id)
        } else {
          console.log('No initial session found')
          setSession(null)
          setProfile(null)
        }
      } catch (error) {
        console.error('Error initializing session:', error)
      } finally {
        if (mounted) {
          setLoading(false)
        }
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
        sessionStorage.clear()
        localStorage.clear()
        navigate('/', { replace: true })
      } else if (currentSession) {
        console.log('Setting session for:', currentSession.user.email)
        setSession(currentSession)
        await getProfile(currentSession.user.id)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [navigate])

  if (loading) {
    console.log('Loading state:', { session: !!session, profile: !!profile })
    return (
      <Center h="100vh">
        <Spinner size="xl" />
      </Center>
    )
  }

  if (!session) {
    console.log('No session, showing Auth component')
    return (
      <Container maxW="container.sm" py={10}>
        <Auth />
      </Container>
    )
  }

  if (!profile) {
    console.log('Session exists but no profile, showing loading')
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
