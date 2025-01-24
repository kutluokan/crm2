import {
  Box,
  Heading,
  Button,
  useToast,
  HStack,
  Flex,
} from '@chakra-ui/react'
import { supabase } from '../lib/supabase'
import { useLocation, useNavigate, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { FiInbox, FiBarChart2, FiMessageSquare } from 'react-icons/fi'
import { TicketList } from './tickets/TicketList'
import { PerformanceMetrics } from './admin/PerformanceMetrics'
import { ResponseTemplates } from './admin/ResponseTemplates'
import { useState, useEffect } from 'react'

const sidebarItems = [
  { label: 'My Tickets', path: '/support/tickets', icon: FiInbox },
  { label: 'Performance', path: '/support/performance', icon: FiBarChart2 },
  { label: 'Templates', path: '/support/templates', icon: FiMessageSquare },
]

export function SupportDashboard() {
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const [userId, setUserId] = useState<string>('')
  const isTicketsPath = location.pathname.includes('/tickets')
  const isPerformancePath = location.pathname.includes('/performance')
  const isTemplatesPath = location.pathname.includes('/templates')

  useEffect(() => {
    getCurrentUser()
  }, [])

  async function getCurrentUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    } catch (error) {
      console.error('Error getting current user:', error)
    }
  }

  async function handleSignOut() {
    try {
      // Clear state first
      sessionStorage.clear()
      localStorage.clear()

      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      // Finally navigate
      navigate('/', { replace: true })
    } catch (error: any) {
      console.error('Error signing out:', error)
      toast({
        title: 'Error signing out',
        description: error.message || 'An error occurred while signing out',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      // Force navigation to home on error
      navigate('/', { replace: true })
    }
  }

  return (
    <Flex h="100vh" overflow="hidden">
      <Sidebar items={sidebarItems} />
      <Box 
        ml="240px" 
        flex="1"
        overflowY="auto"
        bg="gray.50"
        css={{
          '&::-webkit-scrollbar': {
            width: '4px',
          },
          '&::-webkit-scrollbar-track': {
            width: '6px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#CBD5E0',
            borderRadius: '24px',
          },
        }}
      >
        <Box p={8} maxW="100%" mx="auto">
          <Heading size="lg" mb={8}>Support Dashboard</Heading>

          <Box bg="white" rounded="lg" shadow="base" overflow="hidden">
            {isTicketsPath ? (
              <TicketList userRole="support" />
            ) : isPerformancePath ? (
              <PerformanceMetrics userRole="support" userId={userId} />
            ) : isTemplatesPath ? (
              <ResponseTemplates userRole="support" userId={userId} />
            ) : (
              <Navigate to="tickets" replace />
            )}
          </Box>
        </Box>
      </Box>
    </Flex>
  )
}
