import {
  Box,
  Heading,
  Flex,
} from '@chakra-ui/react'
import { supabase } from '../lib/supabase'
import { useLocation, Navigate, Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { FiInbox, FiBarChart2, FiMessageSquare, FiCpu } from 'react-icons/fi'
import { TicketList } from './tickets/TicketList'
import { PerformanceMetrics } from './admin/PerformanceMetrics'
import { ResponseTemplates } from './admin/ResponseTemplates'
import { useState, useEffect } from 'react'

const sidebarItems = [
  { label: 'My Tickets', path: '/support/tickets', icon: FiInbox },
  { label: 'Performance', path: '/support/performance', icon: FiBarChart2 },
  { label: 'Templates', path: '/support/templates', icon: FiMessageSquare },
  { label: 'AI Assistant', path: '/support/ai-assistant', icon: FiCpu },
]

export function SupportDashboard() {
  const location = useLocation()
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

  return (
    <Flex h="100vh" w="100vw" overflowY="auto" overflowX="hidden">
      <Sidebar items={sidebarItems} />
      <Box ml="240px" w="full" px={8}>
        <Box bg="gray.50" px={8} py={4}>
          <Heading size="lg">Support Dashboard</Heading>
        </Box>

        <Box>
          {isPerformancePath ? (
            <PerformanceMetrics userRole="support" userId={userId} />
          ) : isTemplatesPath ? (
            <ResponseTemplates userRole="support" userId={userId} />
          ) : (
            <Outlet />
          )}
        </Box>
      </Box>
    </Flex>
  )
}
