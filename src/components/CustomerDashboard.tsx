import { Box, Container, Heading, Text, Flex } from '@chakra-ui/react'
import { Sidebar } from './Sidebar'
import { FiHelpCircle, FiList } from 'react-icons/fi'
import { TicketList } from './tickets/TicketList'
import { useLocation, Navigate } from 'react-router-dom'

const sidebarItems = [
  { label: 'My Tickets', path: '/customer/tickets', icon: FiList },
  { label: 'Help & Support', path: '/customer/help', icon: FiHelpCircle },
]

export function CustomerDashboard() {
  const location = useLocation()
  const isTicketsPath = location.pathname.includes('/tickets')
  const isHelpPath = location.pathname.includes('/help')

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
          <Heading size="lg" mb={8}>Customer Dashboard</Heading>

          <Box bg="white" rounded="lg" shadow="base" overflow="hidden">
            {isTicketsPath ? (
              <TicketList userRole="customer" />
            ) : isHelpPath ? (
              <Box p={6}>
                <Heading size="md" mb={4}>Help & Support</Heading>
                <Text>
                  Need help? Here you can find guides and FAQs to help you use our support system effectively.
                </Text>
              </Box>
            ) : (
              <Navigate to="tickets" replace />
            )}
          </Box>
        </Box>
      </Box>
    </Flex>
  )
}
