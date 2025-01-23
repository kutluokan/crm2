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
  HStack,
  VStack,
  FormControl,
  FormLabel,
} from '@chakra-ui/react'
import { supabase } from '../../lib/supabase'
import { TicketDetails } from './TicketDetails'
import { RealtimeChannel } from '@supabase/supabase-js'

interface Ticket {
  id: string
  title: string
  description: string
  status: string
  priority: string
  created_at: string
  customer: {
    id: string
    email: string
    full_name: string
  }
  assigned_to: string
  assignee?: {
    id: string
    full_name: string
  }
}

interface TicketListProps {
  userRole: 'admin' | 'support' | 'customer'
}

type SortField = 'created_at' | 'priority' | 'status'
type SortOrder = 'asc' | 'desc'

export function TicketList({ userRole }: TicketListProps): JSX.Element {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [filterCustomer, setFilterCustomer] = useState<string>('')
  const [filterSupport, setFilterSupport] = useState<string>('')
  const [customers, setCustomers] = useState<Array<{ id: string; full_name: string }>>([])
  const [supportStaff, setSupportStaff] = useState<Array<{ id: string; full_name: string }>>([])
  const { isOpen, onOpen, onClose } = useDisclosure()
  const toast = useToast()

  useEffect(() => {
    fetchTickets()
    if (userRole === 'admin') {
      fetchUsers()
    }
    
    // Set up real-time subscription
    const channel = setupTicketSubscription()
    
    return () => {
      channel.unsubscribe()
    }
  }, [userRole, sortField, sortOrder, filterCustomer, filterSupport])

  async function fetchUsers() {
    try {
      // Fetch customers
      const { data: customerData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'customer')
        .order('full_name')

      // Fetch support staff
      const { data: supportData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'support')
        .order('full_name')

      if (customerData) setCustomers(customerData)
      if (supportData) setSupportStaff(supportData)
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  function setupTicketSubscription(): RealtimeChannel {
    const channel = supabase
      .channel('tickets-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets'
        },
        async (payload) => {
          console.log('Real-time update:', payload)
          
          // Refresh the tickets list when changes occur
          if (payload.eventType === 'INSERT') {
            // For inserts, fetch just the new ticket and add it to the list
            const { data: newTicket, error } = await supabase
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
              .eq('id', payload.new.id)
              .single()

            if (!error && newTicket) {
              setTickets(current => [newTicket, ...current])
            }
          } else {
            // For updates and deletes, refresh the entire list
            fetchTickets()
          }
        }
      )
      .subscribe()

    return channel
  }

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
        .order(sortField, { ascending: sortOrder === 'asc' })

      // Apply filters based on role and selected filters
      if (userRole === 'customer') {
        query = query.eq('customer_id', user.id)
      } else if (userRole === 'support') {
        query = query.eq('assigned_to', user.id)
      } else if (userRole === 'admin') {
        if (filterCustomer) {
          query = query.eq('customer_id', filterCustomer)
        }
        if (filterSupport) {
          query = query.eq('assigned_to', filterSupport)
        }
      }

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
          id: ticket.customer_id,
          email: emailMap.get(ticket.customer_id) || 'N/A',
          full_name: ticket.customer?.full_name || 'N/A'
        },
        assigned_to: ticket.assigned_to,
        assignee: ticket.assignee ? {
          id: ticket.assignee.id,
          full_name: ticket.assignee.full_name
        } : undefined
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
      {(userRole === 'admin' || userRole === 'support') && (
        <Box p={4} bg="white" shadow="sm" mb={4}>
          <VStack spacing={4} align="stretch">
            <HStack spacing={4}>
              <FormControl>
                <FormLabel>Sort by</FormLabel>
                <Select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as SortField)}
                >
                  <option value="created_at">Date</option>
                  <option value="priority">Priority</option>
                  <option value="status">Status</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Order</FormLabel>
                <Select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </Select>
              </FormControl>
            </HStack>
            {userRole === 'admin' && (
              <HStack spacing={4}>
                <FormControl>
                  <FormLabel>Filter by Customer</FormLabel>
                  <Select
                    value={filterCustomer}
                    onChange={(e) => setFilterCustomer(e.target.value)}
                    placeholder="All Customers"
                  >
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.full_name}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Filter by Support Staff</FormLabel>
                  <Select
                    value={filterSupport}
                    onChange={(e) => setFilterSupport(e.target.value)}
                    placeholder="All Support Staff"
                  >
                    {supportStaff.map(staff => (
                      <option key={staff.id} value={staff.id}>
                        {staff.full_name}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              </HStack>
            )}
          </VStack>
        </Box>
      )}

      <Box overflowX="auto">
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>ID</Th>
              <Th>Title</Th>
              <Th>Status</Th>
              <Th>Priority</Th>
              {userRole !== 'customer' && <Th>Customer</Th>}
              {userRole === 'admin' && <Th>Assigned To</Th>}
              <Th>Created</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {tickets.map(ticket => (
              <Tr key={ticket.id}>
                <Td>#{ticket.id.slice(0, 8)}</Td>
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
                {userRole === 'admin' && (
                  <Td>{ticket.assignee?.full_name || 'Unassigned'}</Td>
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