import { Box, Container, Heading, Button, HStack, Text, Flex, Tabs, TabList, TabPanels, Tab, TabPanel } from '@chakra-ui/react'
import { supabase } from '../lib/supabase'
import { Sidebar } from './Sidebar'
import { FiHelpCircle, FiPlusCircle, FiList } from 'react-icons/fi'
import { CreateTicket } from './tickets/CreateTicket'
import { TicketList } from './tickets/TicketList'

const sidebarItems = [
  { label: 'Help & Support', path: '/customer/help', icon: FiHelpCircle },
]

export function CustomerDashboard() {
  async function handleSignOut() {
    try {
      // Clear any stored sessions
      sessionStorage.clear()
      localStorage.clear()
      
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      // Force a page reload to clear all state
      window.location.href = '/'
    } catch (error) {
      console.error('Error signing out:', error)
      // Force reload anyway on error
      window.location.href = '/'
    }
  }

  return (
    <Flex>
      <Sidebar items={sidebarItems} />
      <Box ml="240px" w="calc(100% - 240px)" minH="100vh" bg="gray.50">
        <Container maxW="container.xl" py={8}>
          <HStack justify="space-between" mb={8}>
            <Heading size="lg">Customer Dashboard</Heading>
            <Button onClick={handleSignOut} colorScheme="red" variant="outline">
              Sign Out
            </Button>
          </HStack>

          <Box bg="white" rounded="lg" shadow="base" overflow="hidden">
            <Tabs>
              <TabList px={6} pt={4}>
                <Tab><HStack><FiList /><Text>My Tickets</Text></HStack></Tab>
                <Tab><HStack><FiPlusCircle /><Text>Create Ticket</Text></HStack></Tab>
              </TabList>

              <TabPanels>
                <TabPanel>
                  <TicketList userRole="customer" />
                </TabPanel>
                <TabPanel>
                  <CreateTicket />
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Box>
        </Container>
      </Box>
    </Flex>
  )
}
