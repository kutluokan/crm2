import {
  Box,
  Heading,
  useToast,
  Flex,
} from '@chakra-ui/react'
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
  const isTicketsPath = location.pathname.includes('/tickets')
  const isUsersPath = location.pathname.includes('/users')
  const isPerformancePath = location.pathname.includes('/performance')

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
            ) : (
              <Navigate to="users" replace />
            )}
          </Box>
        </Box>
      </Box>
    </Flex>
  )
}
