import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Box, Container, Spinner, Center } from '@chakra-ui/react'
import { Auth } from './components/Auth'
import { AdminDashboard } from './components/AdminDashboard'
import { CustomerDashboard } from './components/CustomerDashboard'
import { SupportDashboard } from './components/SupportDashboard'
import { UserManagement } from './components/admin/UserManagement'
import { TicketList } from './components/tickets/TicketList'
import { TicketDetails } from './components/tickets/TicketDetails'
import { PerformanceMetrics } from './components/admin/PerformanceMetrics'
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

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Auth error:', error);
      }
      if (!session) {
        // Redirect to login or handle unauthorized state
        console.log('No active session');
      }
    };

    checkAuth();
  }, []);

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
      {loading ? (
        <Center h="100vh">
          <Spinner size="xl" />
        </Center>
      ) : !session ? (
        <Auth />
      ) : (
        <Routes>
          {profile?.role === 'admin' && (
            <Route path="/admin/*" element={<AdminDashboard />}>
              <Route path="users" element={<UserManagement />} />
              <Route path="tickets" element={<TicketList userRole="admin" />} />
              <Route path="tickets/:ticketId" element={<TicketDetails userRole="admin" />} />
              <Route path="performance" element={<PerformanceMetrics userRole="admin" />} />
              <Route path="" element={<Navigate to="users" replace />} />
            </Route>
          )}
          {profile?.role === 'support' && (
            <Route path="/support/*" element={<SupportDashboard />}>
              <Route path="tickets" element={<TicketList userRole="support" />} />
              <Route path="tickets/:ticketId" element={<TicketDetails userRole="support" />} />
              <Route path="performance" element={<PerformanceMetrics userRole="support" userId={profile.id} />} />
              <Route path="" element={<Navigate to="tickets" replace />} />
            </Route>
          )}
          {profile?.role === 'customer' && (
            <Route path="/customer/*" element={<CustomerDashboard />}>
              <Route path="tickets" element={<TicketList userRole="customer" />} />
              <Route path="tickets/:ticketId" element={<TicketDetails userRole="customer" />} />
              <Route path="help" element={<Box p={6}>Help & Support content here</Box>} />
              <Route path="" element={<Navigate to="tickets" replace />} />
            </Route>
          )}
          <Route
            path="*"
            element={
              <Navigate
                to={`/${profile?.role || ''}`}
                replace
              />
            }
          />
        </Routes>
      )}
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
