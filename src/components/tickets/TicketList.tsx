import { useState, useEffect } from 'react'
import {
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Button,
  useToast,
  Select,
  Text,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalCloseButton,
  ModalBody,
  useDisclosure,
} from '@chakra-ui/react'
import { supabase } from '../../lib/supabase'
import { TicketDetails } from './TicketDetails'

interface Ticket {
  id: string
  title: string
  description: string
  status: string
  priority: string
  created_at: string
  customer: {
    email: string
    full_name: string
  }
  assigned_to: string
}

interface TicketListProps {
  userRole: 'admin' | 'support' | 'customer'
}

export function TicketList({ userRole }: TicketListProps): JSX.Element {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const toast = useToast()

  useEffect(() => {
    fetchTickets()
  }, [userRole])

  async function fetchTickets() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      let query = supabase
        .from('tickets')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          created_at,
          customer_id,
          assigned_to,
          customer:profiles!tickets_customer_id_fkey (
            id,
            full_name
          ),
          assignee:profiles!tickets_assigned_to_fkey (
            id,
            full_name
          )
        `)
        .order('created_at', { ascending: false })

      // Filter based on role
      if (userRole === 'customer') {
        query = query.eq('customer_id', user.id)
      } else if (userRole === 'support') {
        query = query.eq('assigned_to', user.id)
      }
      // Admin sees all tickets

      const { data, error } = await query

      if (error) throw error

      // Get all unique user IDs from tickets
      const userIds = new Set([
        ...data.map(t => t.customer_id),
        ...data.map(t => t.assigned_to).filter(Boolean)
      ])

      // Fetch emails from auth.users
      const { data: authUsers } = await supabase.rpc('get_users', {})
      const emailMap = new Map(authUsers?.map(u => [u.id, u.email]) || [])

      // Transform the data to match our Ticket interface
      const transformedTickets = (data || []).map(ticket => ({
        ...ticket,
        customer: {
          email: emailMap.get(ticket.customer_id) || 'N/A',
          full_name: ticket.customer?.full_name || 'N/A'
        },
        assigned_to: ticket.assigned_to
      }))

      setTickets(transformedTickets)
    } catch (error) {
      console.error('Error fetching tickets:', error)
      toast({
        title: 'Error fetching tickets',
        status: 'error',
        duration: 3000,
      })
    } finally {
      setLoading(false)
    }
  }

  async function updateTicketStatus(ticketId: string, newStatus: string) {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: newStatus })
        .eq('id', ticketId)

      if (error) throw error

      setTickets(tickets.map(ticket =>
        ticket.id === ticketId ? { ...ticket, status: newStatus } : ticket
      ))

      toast({
        title: 'Ticket status updated',
        status: 'success',
        duration: 2000,
      })
    } catch (error) {
      console.error('Error updating ticket:', error)
      toast({
        title: 'Error updating ticket',
        status: 'error',
        duration: 3000,
      })
    }
  }

  function getPriorityColor(priority: string) {
    switch (priority) {
      case 'urgent': return 'red'
      case 'high': return 'orange'
      case 'medium': return 'yellow'
      case 'low': return 'green'
      default: return 'gray'
    }
  }

  function handleViewDetails(ticketId: string) {
    setSelectedTicketId(ticketId)
    onOpen()
  }

  if (loading) {
    return <Text p={6}>Loading tickets...</Text>
  }

  return (
    <>
      <Box overflowX="auto">
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>Title</Th>
              <Th>Status</Th>
              <Th>Priority</Th>
              {userRole !== 'customer' && <Th>Customer</Th>}
              <Th>Created</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {tickets.map(ticket => (
              <Tr key={ticket.id}>
                <Td>{ticket.title}</Td>
                <Td>
                  {userRole === 'customer' ? (
                    <Badge colorScheme={ticket.status === 'open' ? 'red' : ticket.status === 'in_progress' ? 'yellow' : 'green'}>
                      {ticket.status}
                    </Badge>
                  ) : (
                    <Select
                      value={ticket.status}
                      onChange={(e) => updateTicketStatus(ticket.id, e.target.value)}
                      size="sm"
                      width="150px"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </Select>
                  )}
                </Td>
                <Td>
                  <Badge colorScheme={getPriorityColor(ticket.priority)}>
                    {ticket.priority}
                  </Badge>
                </Td>
                {userRole !== 'customer' && (
                  <Td>{ticket.customer?.full_name || ticket.customer?.email || 'N/A'}</Td>
                )}
                <Td>{new Date(ticket.created_at).toLocaleDateString()}</Td>
                <Td>
                  <Button
                    size="sm"
                    colorScheme="blue"
                    onClick={() => handleViewDetails(ticket.id)}
                  >
                    View Details
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent maxW="800px" h="90vh" my="5vh" overflow="hidden">
          <ModalCloseButton zIndex="10" />
          <ModalBody p={0} display="flex" flexDirection="column" overflow="hidden">
            {selectedTicketId && (
              <TicketDetails
                ticketId={selectedTicketId}
                userRole={userRole}
              />
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  )
} 