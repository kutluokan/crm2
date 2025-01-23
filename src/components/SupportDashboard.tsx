import { Box, Container, Heading, Button, HStack, Flex, useToast } from '@chakra-ui/react'
import { supabase } from '../lib/supabase'
import { Sidebar } from './Sidebar'
import { FiInbox } from 'react-icons/fi'
import { Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { TicketList } from './tickets/TicketList'

const sidebarItems = [
  { label: 'Tickets', path: '/support/tickets', icon: FiInbox },
]

export function SupportDashboard() {
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const isTicketsPath = location.pathname.includes('/tickets')

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
            <Heading size="lg">Support Dashboard</Heading>
            <Button onClick={handleSignOut} colorScheme="red" variant="outline">
              Sign Out
            </Button>
          </HStack>

          <Box bg="white" rounded="lg" shadow="base" overflow="hidden">
            {isTicketsPath ? (
              <TicketList userRole="support" />
            ) : (
              <Navigate to="tickets" replace />
            )}
          </Box>
        </Box>
      </Box>
    </Flex>
  )
}
