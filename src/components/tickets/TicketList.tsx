import { useState, useEffect, useMemo } from 'react'
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
  Checkbox,
  ButtonGroup,
  IconButton,
  Tooltip,
  useColorModeValue,
  Input,
  InputGroup,
  InputLeftElement,
} from '@chakra-ui/react'
import { supabase } from '../../lib/supabase'
import { TicketDetails } from './TicketDetails'
import { RealtimeChannel } from '@supabase/supabase-js'
import { FiCheck, FiUserPlus, FiSearch } from 'react-icons/fi'

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  customer: {
    id: string;
    email: string;
    full_name: string;
  };
  assigned_to: string;
  assignee?: {
    id: string;
    full_name: string;
  };
  tags: Tag[];
}

interface TicketListProps {
  userRole: 'admin' | 'support' | 'customer'
}

type SortField = 'created_at' | 'priority' | 'status'
type SortOrder = 'asc' | 'desc'

interface SupportStaff {
  id: string
  full_name: string
}

export function TicketList({ userRole }: TicketListProps): JSX.Element {
  // Chakra hooks first
  const toast = useToast()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const textColor = useColorModeValue('gray.800', 'white')

  // All useState hooks
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [filterCustomer, setFilterCustomer] = useState<string>('')
  const [filterSupport, setFilterSupport] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [supportSearch, setSupportSearch] = useState('')
  const [customers, setCustomers] = useState<Array<{ id: string; full_name: string }>>([])
  const [supportStaff, setSupportStaff] = useState<SupportStaff[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<Array<{ id: string; full_name: string }>>([])
  const [filteredSupportStaff, setFilteredSupportStaff] = useState<SupportStaff[]>([])
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)

  // Memoized values
  const filteredTickets = useMemo(() => {
    if (!tickets) return []
    
    return tickets.filter(ticket => {
      if (!ticket) return false

      const searchLower = searchQuery.toLowerCase()
      const customerName = ticket.customer?.full_name || ''
      const assigneeName = ticket.assignee?.full_name || ''
      const ticketId = ticket.id || ''
      const title = ticket.title || ''
      const description = ticket.description || ''

      return (
        title.toLowerCase().includes(searchLower) ||
        description.toLowerCase().includes(searchLower) ||
        ticketId.toLowerCase().includes(searchLower) ||
        customerName.toLowerCase().includes(searchLower) ||
        assigneeName.toLowerCase().includes(searchLower)
      )
    })
  }, [tickets, searchQuery])

  // Effects
  useEffect(() => {
    fetchTickets()
    if (userRole === 'admin') {
      fetchUsers()
      fetchSupportStaff()
    }
    
    // Set up real-time subscription
    const channel = setupTicketSubscription()
    
    return () => {
      channel.unsubscribe()
    }
  }, [userRole, sortField, sortOrder, filterCustomer, filterSupport])

  useEffect(() => {
    if (customers.length > 0) {
      const filtered = customers.filter(customer =>
        (customer?.full_name || '').toLowerCase().includes(customerSearch.toLowerCase())
      )
      setFilteredCustomers(filtered)
    } else {
      setFilteredCustomers([])
    }
  }, [customerSearch, customers])

  useEffect(() => {
    if (supportStaff.length > 0) {
      const filtered = supportStaff.filter(staff =>
        (staff?.full_name || '').toLowerCase().includes(supportSearch.toLowerCase())
      )
      setFilteredSupportStaff(filtered)
    } else {
      setFilteredSupportStaff([])
    }
  }, [supportSearch, supportStaff])

  async function fetchUsers() {
    try {
      // Fetch customers
      const { data: customerData, error: customerError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'customer')
        .order('full_name')

      if (customerError) throw customerError

      // Fetch support staff
      const { data: supportData, error: supportError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'support')
        .order('full_name')

      if (supportError) throw supportError

      setCustomers(customerData?.filter(c => c && c.id && c.full_name) || [])
      setSupportStaff(supportData?.filter(s => s && s.id && s.full_name) || [])
    } catch (error) {
      console.error('Error fetching users:', error)
      toast({
        title: 'Error fetching users',
        description: 'Could not load users list',
        status: 'error',
        duration: 3000,
      })
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
          ),
          tags:ticket_tags(
            tag:tags(
              id,
              name,
              color
            )
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
        assigned_to: ticket.assigned_to || null,
        assignee: ticket.assignee ? {
          id: ticket.assignee.id,
          full_name: ticket.assignee.full_name || 'N/A'
        } : undefined,
        tags: (ticket.tags || []).map((t: any) => t.tag)
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

  async function fetchSupportStaff() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'support')
        .order('full_name')

      if (error) throw error
      setSupportStaff(data || [])
    } catch (error) {
      console.error('Error fetching support staff:', error)
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

  async function updateTicketAssignment(ticketId: string, newAssigneeId: string) {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ assigned_to: newAssigneeId || null })
        .eq('id', ticketId)

      if (error) throw error

      // Update local state
      setTickets(tickets.map(ticket =>
        ticket.id === ticketId
          ? {
              ...ticket,
              assigned_to: newAssigneeId,
              assignee: supportStaff.find(staff => staff.id === newAssigneeId)
            }
          : ticket
      ))

      toast({
        title: 'Ticket assignment updated',
        status: 'success',
        duration: 2000,
      })
    } catch (error) {
      console.error('Error updating ticket assignment:', error)
      toast({
        title: 'Error updating assignment',
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

  // Add new functions for bulk operations
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedTickets(new Set())
    } else {
      setSelectedTickets(new Set(tickets.map(ticket => ticket.id)))
    }
    setSelectAll(!selectAll)
  }

  const handleSelectTicket = (ticketId: string) => {
    const newSelected = new Set(selectedTickets)
    if (newSelected.has(ticketId)) {
      newSelected.delete(ticketId)
    } else {
      newSelected.add(ticketId)
    }
    setSelectedTickets(newSelected)
    setSelectAll(newSelected.size === tickets.length)
  }

  async function bulkUpdateStatus(newStatus: string) {
    if (selectedTickets.size === 0) return

    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: newStatus })
        .in('id', Array.from(selectedTickets))

      if (error) throw error

      setTickets(tickets.map(ticket =>
        selectedTickets.has(ticket.id) ? { ...ticket, status: newStatus } : ticket
      ))

      toast({
        title: `Updated ${selectedTickets.size} tickets to ${newStatus}`,
        status: 'success',
        duration: 2000,
      })

      setSelectedTickets(new Set())
      setSelectAll(false)
    } catch (error) {
      console.error('Error updating tickets:', error)
      toast({
        title: 'Error updating tickets',
        status: 'error',
        duration: 3000,
      })
    }
  }

  async function bulkUpdateAssignment(newAssigneeId: string) {
    if (selectedTickets.size === 0) return

    try {
      const { error } = await supabase
        .from('tickets')
        .update({ assigned_to: newAssigneeId || null })
        .in('id', Array.from(selectedTickets))

      if (error) throw error

      setTickets(tickets.map(ticket =>
        selectedTickets.has(ticket.id)
          ? {
              ...ticket,
              assigned_to: newAssigneeId,
              assignee: supportStaff.find(staff => staff.id === newAssigneeId)
            }
          : ticket
      ))

      toast({
        title: `Assigned ${selectedTickets.size} tickets to ${newAssigneeId ? supportStaff.find(s => s.id === newAssigneeId)?.full_name : 'Unassigned'}`,
        status: 'success',
        duration: 2000,
      })

      setSelectedTickets(new Set())
      setSelectAll(false)
    } catch (error) {
      console.error('Error updating ticket assignments:', error)
      toast({
        title: 'Error updating assignments',
        status: 'error',
        duration: 3000,
      })
    }
  }

  if (loading) {
    return <Text p={6}>Loading tickets...</Text>
  }

  return (
    <>
      {(userRole === 'admin' || userRole === 'support') && (
        <Box p={4} bg="white" shadow="sm" mb={4}>
          <VStack spacing={4} align="stretch">
            {/* Search for tickets */}
            <FormControl>
              <FormLabel>Search Tickets</FormLabel>
              <InputGroup>
                <InputLeftElement pointerEvents="none">
                  <FiSearch color="gray.300" />
                </InputLeftElement>
                <Input
                  placeholder="Search by title, description, ID, customer, or assignee"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </InputGroup>
            </FormControl>

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
              <HStack spacing={4} align="flex-start">
                <FormControl>
                  <FormLabel>Filter by Customer</FormLabel>
                  <VStack spacing={2} align="stretch">
                    <InputGroup>
                      <InputLeftElement pointerEvents="none">
                        <FiSearch color="gray.300" />
                      </InputLeftElement>
                      <Input
                        placeholder="Search customers"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        mb={2}
                      />
                    </InputGroup>
                    <Select
                      value={filterCustomer}
                      onChange={(e) => setFilterCustomer(e.target.value)}
                      placeholder="All Customers"
                    >
                      {filteredCustomers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.full_name}
                        </option>
                      ))}
                    </Select>
                  </VStack>
                </FormControl>
                <FormControl>
                  <FormLabel>Filter by Support Staff</FormLabel>
                  <VStack spacing={2} align="stretch">
                    <InputGroup>
                      <InputLeftElement pointerEvents="none">
                        <FiSearch color="gray.300" />
                      </InputLeftElement>
                      <Input
                        placeholder="Search support staff"
                        value={supportSearch}
                        onChange={(e) => setSupportSearch(e.target.value)}
                        mb={2}
                      />
                    </InputGroup>
                    <Select
                      value={filterSupport}
                      onChange={(e) => setFilterSupport(e.target.value)}
                      placeholder="All Support Staff"
                    >
                      {filteredSupportStaff.map(staff => (
                        <option key={staff.id} value={staff.id}>
                          {staff.full_name}
                        </option>
                      ))}
                    </Select>
                  </VStack>
                </FormControl>
              </HStack>
            )}
            
            <HStack spacing={4} pt={2}>
              <Text width="150px">
                {selectedTickets.size} ticket{selectedTickets.size !== 1 ? 's' : ''} selected
              </Text>
              {selectedTickets.size > 0 && (
                <>
                  <ButtonGroup size="sm" isAttached variant="outline">
                    <Select
                      placeholder="Update Status"
                      size="sm"
                      onChange={(e) => bulkUpdateStatus(e.target.value)}
                      width="150px"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </Select>
                  </ButtonGroup>
                  {userRole === 'admin' && (
                    <ButtonGroup size="sm" isAttached variant="outline">
                      <Select
                        placeholder="Assign To"
                        size="sm"
                        onChange={(e) => bulkUpdateAssignment(e.target.value)}
                        width="150px"
                      >
                        <option value="">Unassigned</option>
                        {supportStaff.map(staff => (
                          <option key={staff.id} value={staff.id}>
                            {staff.full_name}
                          </option>
                        ))}
                      </Select>
                    </ButtonGroup>
                  )}
                </>
              )}
            </HStack>
          </VStack>
        </Box>
      )}

      <Box overflowX="auto">
        <Table variant="simple">
          <Thead>
            <Tr>
              {(userRole === 'admin' || userRole === 'support') && (
                <Th px={0} width="40px">
                  <Checkbox
                    isChecked={selectAll}
                    onChange={handleSelectAll}
                    colorScheme="blue"
                  />
                </Th>
              )}
              <Th>ID</Th>
              <Th>Title</Th>
              <Th>Status</Th>
              <Th>Priority</Th>
              <Th>Tags</Th>
              {userRole !== 'customer' && <Th>Customer</Th>}
              {userRole === 'admin' && <Th>Assigned To</Th>}
              <Th>Created</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filteredTickets.map(ticket => (
              <Tr key={ticket.id}>
                {(userRole === 'admin' || userRole === 'support') && (
                  <Td px={0}>
                    <Checkbox
                      isChecked={selectedTickets.has(ticket.id)}
                      onChange={() => handleSelectTicket(ticket.id)}
                      colorScheme="blue"
                    />
                  </Td>
                )}
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
                <Td>
                  <HStack spacing={1}>
                    {ticket.tags?.map((tag) => (
                      <Badge
                        key={tag.id}
                        bg={tag.color}
                        color={textColor}
                        borderRadius="full"
                        px={2}
                        py={0.5}
                        fontSize="xs"
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </HStack>
                </Td>
                {userRole !== 'customer' && (
                  <Td>{ticket.customer?.full_name || ticket.customer?.email || 'N/A'}</Td>
                )}
                {userRole === 'admin' && (
                  <Td>
                    <Select
                      value={ticket.assigned_to || ''}
                      onChange={(e) => updateTicketAssignment(ticket.id, e.target.value)}
                      size="sm"
                      width="150px"
                    >
                      <option value="">Unassigned</option>
                      {supportStaff.map(staff => (
                        <option key={staff.id} value={staff.id}>
                          {staff.full_name}
                        </option>
                      ))}
                    </Select>
                  </Td>
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