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
import { FiUsers, FiInbox, FiBarChart2 } from 'react-icons/fi'
import { TicketList } from './tickets/TicketList'
import { UserManagement } from './admin/UserManagement'
import { PerformanceMetrics } from './admin/PerformanceMetrics'

const sidebarItems = [
  { label: 'User Management', path: '/admin/users', icon: FiUsers },
  { label: 'Tickets', path: '/admin/tickets', icon: FiInbox },
  { label: 'Performance', path: '/admin/performance', icon: FiBarChart2 },
]

export function AdminDashboard() {
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const isTicketsPath = location.pathname.includes('/tickets')
  const isUsersPath = location.pathname.includes('/users')
  const isPerformancePath = location.pathname.includes('/performance')

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
          <HStack justify="space-between" mb={8} flexWrap="wrap" gap={4}>
            <Heading size="lg">Admin Dashboard</Heading>
            <Button onClick={handleSignOut} colorScheme="red" variant="outline">
              Sign Out
            </Button>
          </HStack>

          <Box bg="white" rounded="lg" shadow="base" overflow="hidden">
            {isTicketsPath ? (
              <TicketList userRole="admin" />
            ) : isUsersPath ? (
              <UserManagement />
            ) : isPerformancePath ? (
              <PerformanceMetrics userRole="admin" />
            ) : (
              <Navigate to="users" replace />
            )}
          </Box>
        </Box>
      </Box>
    </Flex>
  )
}
