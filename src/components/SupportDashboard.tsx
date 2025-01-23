import { Box, Container, Heading, Button, HStack, Flex } from '@chakra-ui/react'
import { supabase } from '../lib/supabase'
import { Sidebar } from './Sidebar'
import { FiInbox } from 'react-icons/fi'
import { Outlet, useLocation } from 'react-router-dom'

const sidebarItems = [
  { label: 'Tickets', path: '/support/tickets', icon: FiInbox },
]

export function SupportDashboard() {
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
            <Heading size="lg">Support Dashboard</Heading>
            <Button onClick={handleSignOut} colorScheme="red" variant="outline">
              Sign Out
            </Button>
          </HStack>

          <Box bg="white" rounded="lg" shadow="base" overflow="hidden">
            <Outlet />
          </Box>
        </Container>
      </Box>
    </Flex>
  )
}
