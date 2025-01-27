import { useRef, useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiChevronUp, FiChevronDown } from 'react-icons/fi'
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
  useColorModeValue,
  Input,
  InputGroup,
  InputLeftElement,
  IconButton,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverBody,
} from '@chakra-ui/react'
import { supabase } from '../../lib/supabase'
import { TicketDetails } from './TicketDetails'
import { RealtimeChannel } from '@supabase/supabase-js'
import { FiSearch } from 'react-icons/fi'

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

interface RawTicket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  customer_id: string;
  assigned_to: string | null;
  customer: {
    id: string;
    full_name: string | null;
  } | null;
  assignee: {
    id: string;
    full_name: string | null;
  } | null;
  ticket_tags: Array<{
    tag: Tag;
  }>;
}

export function TicketList({ userRole }: TicketListProps): JSX.Element {
  const navigate = useNavigate()
  // Chakra hooks first
  const toast = useToast()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const textColor = useColorModeValue('gray.800', 'white')
  const theadBg = useColorModeValue('gray.50', 'gray.800')
  
  // All useState hooks
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [staffFilterInput, setStaffFilterInput] = useState('')
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [filterCustomer, setFilterCustomer] = useState<string>('')
  const [filterSupport, setFilterSupport] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [supportSearch, setSupportSearch] = useState('')
  const [titleFilterInput, setTitleFilterInput] = useState('')
  const [filterTitle, setFilterTitle] = useState('')
  // New state for ID, Status, Priority, and Tags
  const [idFilterInput, setIdFilterInput] = useState('')
  const [filterID, setFilterID] = useState('')
  const [statusFilterInput, setStatusFilterInput] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [priorityFilterInput, setPriorityFilterInput] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [tagsFilterInput, setTagsFilterInput] = useState('')
  const [filterTags, setFilterTags] = useState('')
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

      // ID filter
      if (filterID.trim() && !ticketId.toLowerCase().includes(filterID.toLowerCase())) {
        return false
      }
      // Status filter
      if (filterStatus.trim() && !ticket.status.toLowerCase().includes(filterStatus.toLowerCase())) {
        return false
      }
      // Priority filter
      if (filterPriority.trim() && !ticket.priority.toLowerCase().includes(filterPriority.toLowerCase())) {
        return false
      }
      // Tags filter
      if (filterTags.trim()) {
        const matchTags = ticket.tags.some(t => t.name.toLowerCase().includes(filterTags.toLowerCase()))
        if (!matchTags) return false
      }
      if (filterSupport.trim() && !assigneeName.toLowerCase().includes(filterSupport.toLowerCase())) {
        return false
      }
      if (filterTitle.trim() && !title.toLowerCase().includes(filterTitle.toLowerCase())) {
        return false
      }
      return (
        title.toLowerCase().includes(searchLower) ||
        description.toLowerCase().includes(searchLower) ||
        ticketId.toLowerCase().includes(searchLower) ||
        customerName.toLowerCase().includes(searchLower) ||
        assigneeName.toLowerCase().includes(searchLower)
      )
    })
  }, [tickets, searchQuery, filterID, filterStatus, filterPriority, filterTags, filterSupport, filterTitle])

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
  }, [userRole, sortField, sortOrder, filterCustomer])

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
          
          if (payload.eventType === 'INSERT') {
            const { data: newTicket, error } = await supabase
              .from('tickets')
              .select(`
                *,
                customer:customer_id(id, full_name),
                assignee:assigned_to(id, full_name),
                ticket_tags(
                  tag:tags(
                    id,
                    name,
                    color
                  )
                )
              `)
              .eq('id', payload.new.id)
              .single()

            if (!error && newTicket) {
              const transformedTicket = {
                ...newTicket,
                assigned_to: newTicket.assigned_to || '',
                customer: {
                  id: newTicket.customer?.id || '',
                  email: newTicket.customer?.email || 'N/A',
                  full_name: newTicket.customer?.full_name || 'N/A'
                },
                assignee: newTicket.assignee ? {
                  id: newTicket.assignee.id,
                  full_name: newTicket.assignee.full_name || 'N/A'
                } : undefined,
                tags: (newTicket as RawTicket).ticket_tags?.map(tt => tt.tag) || []
              } as Ticket

              setTickets(current => [transformedTicket, ...current])
            }
          } else {
            fetchTickets()
          }
        }
      )
      .subscribe()

    return channel
  }

  async function fetchTickets() {
    try {
      setLoading(true)
      let query = supabase
        .from('tickets')
        .select(`
          *,
          customer:customer_id(id, full_name),
          assignee:assigned_to(id, full_name),
          ticket_tags(
            tag:tags(
              id,
              name,
              color
            )
          )
        `)
        .order(sortField, { ascending: sortOrder === 'asc' })


      const { data: tickets, error } = await query

      if (error) throw error

      const transformedTickets = (tickets as RawTicket[]).map(ticket => ({
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        created_at: ticket.created_at,
        assigned_to: ticket.assigned_to || '',
        customer: {
          id: ticket.customer?.id || '',
          email: ticket.customer?.email || 'N/A',
          full_name: ticket.customer?.full_name || 'N/A'
        },
        assignee: ticket.assignee ? {
          id: ticket.assignee.id,
          full_name: ticket.assignee.full_name || 'N/A'
        } : undefined,
        tags: ticket.ticket_tags?.map(tt => tt.tag) || []
      })) as unknown as Ticket[]

      setTickets(transformedTickets)
    } catch (error) {
      console.error('Error fetching tickets:', error)
      toast({
        title: 'Error fetching tickets',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 5000,
        isClosable: true,
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

  async function bulkDeleteTickets() {
    if (selectedTickets.size === 0) return

    try {
      // First delete all associated documents
      const { error: docsError } = await supabase
        .from('documents')
        .delete()
        .in('ticket_id', Array.from(selectedTickets))

      if (docsError) {
        console.error('Error deleting documents:', docsError)
        throw docsError
      }

      // Then delete the tickets
      const { error } = await supabase
        .from('tickets')
        .delete()
        .in('id', Array.from(selectedTickets))

      if (error) throw error

      // Remove deleted tickets from local state
      setTickets(tickets.filter(ticket => !selectedTickets.has(ticket.id)))

      toast({
        title: `Deleted ${selectedTickets.size} tickets`,
        status: 'success',
        duration: 2000,
      })

      setSelectedTickets(new Set())
      setSelectAll(false)
    } catch (error) {
      console.error('Error deleting tickets:', error)
      toast({
        title: 'Error deleting tickets',
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
      {(userRole === 'admin' || userRole === 'support') && selectedTickets.size > 0 && (
        <Box mb={4} p={4} bg="white" shadow="sm" borderRadius="md">
          <HStack spacing={4}>
            <Text>Selected: {selectedTickets.size} tickets</Text>
            <ButtonGroup size="sm">
              <Button
                colorScheme="red"
                onClick={bulkDeleteTickets}
              >
                Delete Selected
              </Button>
              <Button
                colorScheme="blue"
                onClick={() => bulkUpdateStatus('closed')}
              >
                Close Selected
              </Button>
              <Button
                colorScheme="green"
                onClick={() => bulkUpdateStatus('resolved')}
              >
                Mark Resolved
              </Button>
              {userRole === 'admin' && (
                <Select
                  size="sm"
                  placeholder="Assign to..."
                  onChange={(e) => bulkUpdateAssignment(e.target.value)}
                  width="200px"
                >
                  <option value="">Unassign</option>
                  {supportStaff.map(staff => (
                    <option key={staff.id} value={staff.id}>
                      {staff.full_name}
                    </option>
                  ))}
                </Select>
              )}
            </ButtonGroup>
          </HStack>
        </Box>
      )}
      <Box overflowX="auto" overflowY="auto" maxH="calc(100vh - 200px)">
        <Table variant="simple" style={{ tableLayout: 'auto', width: '100%' }} className="ticket-table">
          <Thead position="sticky" top="0" zIndex="1" bg={theadBg}>
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
              <Th whiteSpace="nowrap" textAlign="left">
                ID
                <Popover>
                  <PopoverTrigger>
                    <IconButton
                      icon={<FiSearch />}
                      aria-label="Filter ID"
                      size="xs"
                      ml={2}
                    />
                  </PopoverTrigger>
                  <PopoverContent>
                    <PopoverArrow />
                    <PopoverBody>
                      <Input
                        size="xs"
                        placeholder="Search ID..."
                        value={idFilterInput}
                        onChange={(e) => {
                          setIdFilterInput(e.target.value)
                          setFilterID(e.target.value.trim())
                        }}
                        width="120px"
                      />
                    </PopoverBody>
                  </PopoverContent>
                </Popover>
              </Th>
              <Th whiteSpace="nowrap" textAlign="left">
                Title
                <Popover>
                  <PopoverTrigger>
                    <IconButton
                      icon={<FiSearch />}
                      aria-label="Filter title"
                      size="xs"
                      ml={2}
                    />
                  </PopoverTrigger>
                  <PopoverContent>
                    <PopoverArrow />
                    <PopoverBody>
                      <Input
                        size="xs"
                        placeholder="Search Title..."
                        value={titleFilterInput}
                        onChange={(e) => {
                          setTitleFilterInput(e.target.value)
                          setFilterTitle(e.target.value.trim())
                        }}
                        width="120px"
                      />
                    </PopoverBody>
                  </PopoverContent>
                </Popover>
              </Th>
              <Th whiteSpace="nowrap" textAlign="left">
                Status
                <Popover>
                  <PopoverTrigger>
                    <IconButton
                      icon={<FiSearch />}
                      aria-label="Filter Status"
                      size="xs"
                      ml={2}
                    />
                  </PopoverTrigger>
                  <PopoverContent>
                    <PopoverArrow />
                    <PopoverBody>
                      <Select
                        placeholder="All"
                        size="xs"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        width="150px"
                        display="block"
                      >
                        <option value="">All</option>
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </Select>
                    </PopoverBody>
                  </PopoverContent>
                </Popover>
              </Th>
              <Th whiteSpace="nowrap" textAlign="left">
                Priority
                <Popover>
                  <PopoverTrigger>
                    <IconButton
                      icon={<FiSearch />}
                      aria-label="Filter Priority"
                      size="xs"
                      ml={2}
                    />
                  </PopoverTrigger>
                  <PopoverContent>
                    <PopoverArrow />
                    <PopoverBody>
                      <Select
                        placeholder="All"
                        size="xs"
                        value={filterPriority}
                        onChange={(e) => setFilterPriority(e.target.value)}
                        width="150px"
                        display="block"
                      >
                        <option value="">All</option>
                        <option value="urgent">Urgent</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </Select>
                    </PopoverBody>
                  </PopoverContent>
                </Popover>
              </Th>
              <Th whiteSpace="nowrap" textAlign="left">
                Tags
                <Popover>
                  <PopoverTrigger>
                    <IconButton
                      icon={<FiSearch />}
                      aria-label="Filter Tags"
                      size="xs"
                      ml={2}
                    />
                  </PopoverTrigger>
                  <PopoverContent>
                    <PopoverArrow />
                    <PopoverBody>
                      <Input
                        size="xs"
                        placeholder="Search Tags..."
                        value={tagsFilterInput}
                        onChange={(e) => {
                          setTagsFilterInput(e.target.value)
                          setFilterTags(e.target.value.trim())
                        }}
                        width="120px"
                      />
                    </PopoverBody>
                  </PopoverContent>
                </Popover>
              </Th>
              {userRole !== 'customer' && <Th whiteSpace="nowrap" textAlign="left">Customer</Th>}
              {userRole === 'admin' && (
                <Th whiteSpace="nowrap" textAlign="left">
                  Assigned To
                  <Popover>
                    <PopoverTrigger>
                      <IconButton
                        icon={<FiSearch />}
                        aria-label="Filter staff"
                        size="xs"
                        ml={2}
                      />
                    </PopoverTrigger>
                    <PopoverContent>
                      <PopoverArrow />
                      <PopoverBody>
                        <Input
                          size="xs"
                          placeholder="Type staff name..."
                          value={staffFilterInput}
                          onChange={(e) => {
                            setStaffFilterInput(e.target.value)
                            setFilterSupport(e.target.value.trim())
                          }}
                          width="120px"
                        />
                      </PopoverBody>
                    </PopoverContent>
                  </Popover>
                </Th>
              )}
              <Th whiteSpace="nowrap" display="inline-flex" alignItems="center" textAlign="left">
                <Box mr="1">Created</Box>
                <FiChevronUp
                  cursor="pointer"
                  style={{ marginLeft: '6px', marginRight: '3px' }}
                  onClick={() => {
                    setSortField('created_at')
                    setSortOrder('asc')
                  }}
                />
                <FiChevronDown
                  cursor="pointer"
                  onClick={() => {
                    setSortField('created_at')
                    setSortOrder('desc')
                  }}
                />
              </Th>
              <Th whiteSpace="nowrap" textAlign="left">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filteredTickets.length === 0 && (
              <Tr>
                <Td colSpan={10} textAlign="center">No tickets found.</Td>
              </Tr>
            )}
            {filteredTickets.map(ticket => (
              <Tr key={ticket.id}>
                {(userRole === 'admin' || userRole === 'support') && (
                  <Td px={2} py={3}>
                    <Checkbox
                      isChecked={selectedTickets.has(ticket.id)}
                      onChange={() => handleSelectTicket(ticket.id)}
                      colorScheme="blue"
                    />
                  </Td>
                )}
                <Td textAlign="left" whiteSpace="normal" wordBreak="break-word" maxWidth="200px" px={2} py={3}>#{ticket.id.slice(0, 8)}</Td>
                <Td textAlign="left" whiteSpace="normal" wordBreak="break-word" maxWidth="200px" px={2} py={3}>{ticket.title}</Td>
                <Td textAlign="left" whiteSpace="normal" wordBreak="break-word" maxWidth="200px" px={2} py={3}>
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
                <Td textAlign="left" whiteSpace="normal" wordBreak="break-word" maxWidth="200px" px={2} py={3}>
                  <Badge colorScheme={getPriorityColor(ticket.priority)}>
                    {ticket.priority}
                  </Badge>
                </Td>
                <Td textAlign="left" whiteSpace="normal" wordBreak="break-word" maxWidth="200px" px={2} py={3}>
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
                  <Td textAlign="left" whiteSpace="normal" wordBreak="break-word" maxWidth="200px" px={2} py={3}>{ticket.customer?.full_name || ticket.customer?.email || 'N/A'}</Td>
                )}
                {userRole === 'admin' && (
                  <Td textAlign="left" whiteSpace="normal" wordBreak="break-word" maxWidth="200px" px={2} py={3}>
                    <Select
                      value={ticket.assigned_to || ''}
                      onChange={(e) => updateTicketAssignment(ticket.id, e.target.value)}
                      size="sm"
                      width="150px"
                    >
                      <option value="">Unassigned</option>
                      {(supportSearch.trim() ? filteredSupportStaff : supportStaff).map(staff => (
                        <option key={staff.id} value={staff.id}>
                          {staff.full_name}
                        </option>
                      ))}
                    </Select>
                  </Td>
                )}
                <Td textAlign="left" whiteSpace="normal" wordBreak="break-word" maxWidth="200px" px={2} py={3}>{new Date(ticket.created_at).toLocaleDateString()}</Td>
                <Td textAlign="left" whiteSpace="normal" wordBreak="break-word" maxWidth="200px" px={2} py={3}>
                  <Button
                    size="sm"
                    colorScheme="blue"
                    onClick={() => {
                      if (userRole === 'admin') {
                        navigate(`/admin/tickets/${ticket.id}`)
                      } else if (userRole === 'support') {
                        navigate(`/support/tickets/${ticket.id}`)
                      } else {
                        navigate(`/customer/tickets/${ticket.id}`)
                      }
                    }}
                  >
                    View Details
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

    </>
  )
} 
