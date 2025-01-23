import { useEffect, useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Heading,
  Divider,
  Select,
  useToast,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  useDisclosure,
  IconButton,
} from '@chakra-ui/react';
import { FiEdit2 } from 'react-icons/fi';
import { supabase } from '../../lib/supabase';
import TicketChat from '../../components/TicketChat';
import { EditTicket } from './EditTicket';
import { RealtimeChannel } from '@supabase/supabase-js';

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  customer: {
    id: string;
    full_name: string;
  };
  assigned_to: string;
}

interface TicketDetailsProps {
  ticketId: string;
  userRole: 'admin' | 'support' | 'customer';
}

export function TicketDetails({ ticketId, userRole }: TicketDetailsProps) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  useEffect(() => {
    fetchTicketDetails();
    getCurrentUser();

    // Set up real-time subscription
    const channel = setupTicketSubscription();
    
    return () => {
      channel.unsubscribe();
    }
  }, [ticketId]);

  async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  }

  async function fetchTicketDetails() {
    try {
      // First fetch the ticket with profile data
      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .select(`
          *,
          customer:profiles!tickets_customer_id_fkey (
            id,
            full_name
          )
        `)
        .eq('id', ticketId)
        .single();

      if (ticketError) throw ticketError;

      // Then fetch the email from auth.users using RPC
      if (ticketData) {
        const { data: users, error: usersError } = await supabase
          .rpc('get_users', {});

        if (usersError) throw usersError;

        const customerUser = users?.find(u => u.id === ticketData.customer_id);
        if (customerUser) {
          setCustomerEmail(customerUser.email);
        }

        setTicket(ticketData);
      }
    } catch (error) {
      console.error('Error fetching ticket details:', error);
      toast({
        title: 'Error fetching ticket details',
        status: 'error',
        duration: 3000,
      });
    }
  }

  function setupTicketSubscription(): RealtimeChannel {
    const channel = supabase
      .channel(`ticket-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `id=eq.${ticketId}`
        },
        async (payload) => {
          console.log('Real-time ticket update:', payload);
          
          if (payload.eventType === 'UPDATE') {
            // Update the ticket state with the new data
            setTicket(current => current ? { ...current, ...payload.new } : null);
          } else if (payload.eventType === 'DELETE') {
            // Handle ticket deletion - maybe show a message and close the detail view
            toast({
              title: 'Ticket has been deleted',
              status: 'warning',
              duration: 3000,
            });
          }
        }
      )
      .subscribe();

    return channel;
  }

  async function updateTicketStatus(newStatus: string) {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: newStatus })
        .eq('id', ticketId);

      if (error) throw error;

      setTicket(ticket => ticket ? { ...ticket, status: newStatus } : null);

      toast({
        title: 'Status updated successfully',
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      console.error('Error updating ticket status:', error);
      toast({
        title: 'Error updating status',
        status: 'error',
        duration: 3000,
      });
    }
  }

  async function handleCustomerCloseTicket() {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: 'closed' })
        .eq('id', ticketId);

      if (error) throw error;

      setTicket(ticket => ticket ? { ...ticket, status: 'closed' } : null);

      toast({
        title: 'Ticket closed successfully',
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      console.error('Error closing ticket:', error);
      toast({
        title: 'Error closing ticket',
        status: 'error',
        duration: 3000,
      });
    }
  }

  async function updateTicketPriority(newPriority: string) {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ priority: newPriority })
        .eq('id', ticketId);

      if (error) throw error;

      setTicket(ticket => ticket ? { ...ticket, priority: newPriority } : null);

      toast({
        title: 'Priority updated successfully',
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      console.error('Error updating priority:', error);
      toast({
        title: 'Error updating priority',
        status: 'error',
        duration: 3000,
      });
    }
  }

  function getPriorityColor(priority: string) {
    switch (priority) {
      case 'urgent': return 'red';
      case 'high': return 'orange';
      case 'medium': return 'yellow';
      case 'low': return 'green';
      default: return 'gray';
    }
  }

  if (!ticket) {
    return <Box p={6}>Loading ticket details...</Box>;
  }

  const canEdit = userRole === 'customer' && currentUserId === ticket.customer.id;

  return (
    <Box height="100%" display="flex" flexDirection="column" overflow="hidden">
      {/* Fixed Header */}
      <Box p={6} bg="white" borderBottom="1px" borderColor="gray.200">
        <HStack justify="space-between" align="flex-start" mb={2}>
          <Box flex="1">
            <HStack>
              <Heading size="lg">{ticket.title}</Heading>
              {canEdit && (
                <IconButton
                  icon={<FiEdit2 />}
                  aria-label="Edit ticket"
                  size="sm"
                  colorScheme="blue"
                  variant="ghost"
                  onClick={onOpen}
                />
              )}
            </HStack>
            <Text color="gray.600" mt={2}>{ticket.description}</Text>
          </Box>
        </HStack>
        
        <HStack spacing={4} mb={4} mt={4}>
          <HStack>
            <Text fontWeight="bold">Status:</Text>
            {userRole === 'customer' ? (
              <HStack>
                <Badge colorScheme={ticket.status === 'open' ? 'red' : ticket.status === 'in_progress' ? 'yellow' : 'green'}>
                  {ticket.status}
                </Badge>
                {ticket.status !== 'closed' && canEdit && (
                  <Button
                    size="xs"
                    colorScheme="red"
                    variant="outline"
                    onClick={handleCustomerCloseTicket}
                  >
                    Close Ticket
                  </Button>
                )}
              </HStack>
            ) : (
              <Select
                value={ticket.status}
                onChange={(e) => updateTicketStatus(e.target.value)}
                size="sm"
                width="150px"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </Select>
            )}
          </HStack>
          
          <HStack>
            <Text fontWeight="bold">Priority:</Text>
            {userRole === 'customer' ? (
              <Badge colorScheme={getPriorityColor(ticket.priority)}>
                {ticket.priority}
              </Badge>
            ) : (
              <Select
                value={ticket.priority}
                onChange={(e) => updateTicketPriority(e.target.value)}
                size="sm"
                width="150px"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            )}
          </HStack>
          
          <HStack>
            <Text fontWeight="bold">Created:</Text>
            <Text>{new Date(ticket.created_at).toLocaleDateString()}</Text>
          </HStack>
        </HStack>

        {userRole !== 'customer' && (
          <HStack>
            <Text fontWeight="bold">Customer:</Text>
            <Text>{ticket.customer?.full_name || 'N/A'} ({customerEmail || 'N/A'})</Text>
          </HStack>
        )}
      </Box>

      {/* Chat Section */}
      <Box flex="1" minH="0" display="flex" flexDirection="column" overflow="hidden">
        <Box p={6} bg="white" borderBottom="1px" borderColor="gray.200">
          <Heading size="md">Conversation</Heading>
        </Box>
        
        <Box flex="1" minH="0">
          <TicketChat
            ticketId={ticketId}
            currentUserId={currentUserId}
            isSupport={userRole !== 'customer'}
          />
        </Box>
      </Box>

      {/* Edit Ticket Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent maxW="800px">
          <ModalHeader>Edit Ticket</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <EditTicket
              ticket={ticket}
              onClose={onClose}
              onUpdate={fetchTicketDetails}
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
} 