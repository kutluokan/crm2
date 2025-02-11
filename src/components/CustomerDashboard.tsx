import {
  Box,
  Heading,
  Flex,
  Button,
  HStack,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
} from '@chakra-ui/react'
import { Sidebar } from './Sidebar'
import { FiHelpCircle, FiList, FiPlus } from 'react-icons/fi'
import { CreateTicket } from './tickets/CreateTicket'
import { useLocation, Outlet } from 'react-router-dom'
import { CustomerHelpAI } from './CustomerHelpAI'

const sidebarItems = [
  { label: 'My Tickets', path: '/customer/tickets', icon: FiList },
  { label: 'Help & Support', path: '/customer/help', icon: FiHelpCircle },
]

export function CustomerDashboard() {
  const location = useLocation()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const isTicketsPath = location.pathname.includes('/tickets')
  const isHelpPath = location.pathname.includes('/help')

  return (
    <Flex h="100vh" w="100vw" overflowY="auto" overflowX="hidden">
      <Sidebar items={sidebarItems} />
      <Box ml="240px" w="full" px={8}>
        <Box bg="gray.50" px={8} py={4}>
          <HStack justify="space-between">
            <Heading size="lg">Customer Dashboard</Heading>
            {isTicketsPath && (
              <Button
                leftIcon={<FiPlus />}
                colorScheme="blue"
                onClick={onOpen}
              >
                Create Ticket
              </Button>
            )}
          </HStack>
        </Box>

        <Box>
          {isHelpPath ? (
            <CustomerHelpAI />
          ) : (
            <Outlet />
          )}
        </Box>
      </Box>

      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create New Ticket</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <CreateTicket onSuccess={onClose} />
          </ModalBody>
        </ModalContent>
      </Modal>
    </Flex>
  )
}
