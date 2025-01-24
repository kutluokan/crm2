import {
  Box,
  Heading,
  Flex,
} from '@chakra-ui/react'
import { useLocation, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { FiUsers, FiInbox, FiBarChart2, FiMessageSquare } from 'react-icons/fi'
import { TicketList } from './tickets/TicketList'
import { UserManagement } from './admin/UserManagement'
import { PerformanceMetrics } from './admin/PerformanceMetrics'
import { ResponseTemplates } from './admin/ResponseTemplates'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const sidebarItems = [
  { label: 'User Management', path: '/admin/users', icon: FiUsers },
  { label: 'Tickets', path: '/admin/tickets', icon: FiInbox },
  { label: 'Performance', path: '/admin/performance', icon: FiBarChart2 },
  { label: 'Templates', path: '/admin/templates', icon: FiMessageSquare },
]

export function AdminDashboard() {
  const location = useLocation()
  const [userId, setUserId] = useState('')
  const isTicketsPath = location.pathname.includes('/tickets')
  const isUsersPath = location.pathname.includes('/users')
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
          <Heading size="lg" mb={8}>Admin Dashboard</Heading>

          <Box bg="white" rounded="lg" shadow="base" overflow="hidden">
            {isTicketsPath ? (
              <TicketList userRole="admin" />
            ) : isUsersPath ? (
              <UserManagement />
            ) : isPerformancePath ? (
              <PerformanceMetrics userRole="admin" />
            ) : isTemplatesPath ? (
              <ResponseTemplates userRole="admin" userId={userId} />
            ) : (
              <Navigate to="users" replace />
            )}
          </Box>
        </Box>
      </Box>
    </Flex>
  )
}
