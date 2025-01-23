import { Box, Container, Heading, Button, HStack, Text, Flex, Tabs, TabList, TabPanels, Tab, TabPanel, useToast } from '@chakra-ui/react'
import { supabase } from '../lib/supabase'
import { Sidebar } from './Sidebar'
import { FiHelpCircle, FiPlusCircle, FiList } from 'react-icons/fi'
import { CreateTicket } from './tickets/CreateTicket'
import { TicketList } from './tickets/TicketList'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'

const sidebarItems = [
  { label: 'My Tickets', path: '/customer/tickets', icon: FiList },
  { label: 'Help & Support', path: '/customer/help', icon: FiHelpCircle },
]

export function CustomerDashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const isTicketsPath = location.pathname.includes('/tickets')
  const isHelpPath = location.pathname.includes('/help')

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

  function renderContent() {
    if (isHelpPath) {
      return (
        <Box p={6}>
          <Heading size="md" mb={4}>Help & Support</Heading>
          <Text>
            Need help? Here's how to get support:
          </Text>
          <Box mt={4}>
            <Text mb={2}>1. Create a new ticket from the "My Tickets" section</Text>
            <Text mb={2}>2. Describe your issue in detail</Text>
            <Text mb={2}>3. Our support team will respond as soon as possible</Text>
          </Box>
        </Box>
      )
    }

    if (isTicketsPath) {
      return (
        <Tabs display="flex" flexDirection="column" h="full">
          <TabList px={6} pt={4}>
            <Tab><HStack><FiList /><Text>My Tickets</Text></HStack></Tab>
            <Tab><HStack><FiPlusCircle /><Text>Create Ticket</Text></HStack></Tab>
          </TabList>

          <TabPanels flex="1" overflow="auto">
            <TabPanel h="full">
              <TicketList userRole="customer" />
            </TabPanel>
            <TabPanel h="full">
              <CreateTicket />
            </TabPanel>
          </TabPanels>
        </Tabs>
      )
    }

    return <Navigate to="tickets" replace />
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
        <Box h="full" p={8}>
          <HStack justify="space-between" mb={8} flexWrap="wrap" gap={4}>
            <Heading size="lg">Customer Dashboard</Heading>
            <Button onClick={handleSignOut} colorScheme="red" variant="outline">
              Sign Out
            </Button>
          </HStack>

          <Box 
            bg="white" 
            rounded="lg" 
            shadow="base" 
            overflow="hidden"
            h="calc(100vh - 140px)"
          >
            {renderContent()}
          </Box>
        </Box>
      </Box>
    </Flex>
  )
}
