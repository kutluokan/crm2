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
import { FiInbox, FiBarChart2 } from 'react-icons/fi'
import { TicketList } from './tickets/TicketList'
import { PerformanceMetrics } from './admin/PerformanceMetrics'
import { useState, useEffect } from 'react'

const sidebarItems = [
  { label: 'My Tickets', path: '/support/tickets', icon: FiInbox },
  { label: 'Performance', path: '/support/performance', icon: FiBarChart2 },
]

export function SupportDashboard() {
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const [userId, setUserId] = useState<string>('')
  const isTicketsPath = location.pathname.includes('/tickets')
  const isPerformancePath = location.pathname.includes('/performance')

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
    <Flex>
      <Sidebar items={sidebarItems} />
      <Box ml="240px" p={6} w="calc(100% - 240px)">
        {isTicketsPath && <TicketList userRole="support" />}
        {isPerformancePath && <PerformanceMetrics userRole="support" userId={userId} />}
      </Box>
    </Flex>
  )
}
