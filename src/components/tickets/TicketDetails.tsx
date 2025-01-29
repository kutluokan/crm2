import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  HStack,
  Heading,
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
import TicketChat from '../TicketChat';
import { EditTicket } from './EditTicket';
import { RealtimeChannel } from '@supabase/supabase-js';
import { TicketInfo } from './TicketInfo';

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
  updated_at: string;
  customer: {
    id: string;
    full_name: string;
  };
  assigned_to: string;
  tags: Tag[];
}

interface TicketDetailsProps {
  userRole: 'admin' | 'support' | 'customer';
}

export function TicketDetails({ userRole }: TicketDetailsProps) {
  const { ticketId } = useParams<{ ticketId: string }>();

  if (!ticketId) {
    return <div>Ticket not found</div>;
  }

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const editDisclosure = useDisclosure();
  
  useEffect(() => {
    console.log('Using ticket ID:', ticketId);
    fetchTicketDetails();
    getCurrentUser();

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
      console.log('Fetching ticket:', ticketId);
      
      const { data: ticket, error } = await supabase
        .from('tickets')
        .select(`
          *,
          customer:profiles!tickets_customer_id_fkey(id, full_name),
          tags:ticket_tags(
            tag:tags(id, name, color)
          )
        `)
        .eq('id', ticketId)
        .single();

      if (error) {
        console.error('Error details:', error);
        throw error;
      }

      if (!ticket) {
        console.error('No ticket found with ID:', ticketId);
        return;
      }

      // Transform the tags data structure
      const transformedTicket = {
        ...ticket,
        tags: ticket.tags
          ?.map((t: { tag: Tag }) => t.tag)
          .filter((tag: Tag | null): tag is Tag => tag !== null) || []
      };

      setTicket(transformedTicket);

      // Fetch customer email using get_users function
      if (ticket.customer?.id) {
        const { data: userData, error: userError } = await supabase
          .rpc('get_users');
        
        if (!userError && userData) {
          const user = userData.find((u: { id: string, email: string }) => u.id === ticket.customer.id);
          if (user?.email) {
            setCustomerEmail(user.email);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching ticket details:', error);
    }
  }

  function setupTicketSubscription(): RealtimeChannel {
    const channel = supabase.channel(`ticket:${ticketId}`);
    
    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `id=eq.${ticketId}`
        },
        () => {
          fetchTicketDetails();
        }
      )
      .subscribe();

    return channel;
  }

  const canEdit = userRole === 'customer' && ticket?.customer?.id === currentUserId;

  if (!ticket) {
    return null;
  }

  return (
    <Box height="100vh" display="flex" flexDirection="column">
      {/* Fixed Header */}
      <Box
        p={6}
        bg="white"
        borderBottom="1px"
        borderColor="gray.200"
        position="fixed"
        top="0"
        left="240px"
        right="0"
        height="80px"
        width="calc(100% - 240px)"
        zIndex="10"
      >
        <HStack>
          <Heading size="lg">{ticket.title}</Heading>
          {canEdit && (
            <IconButton
              icon={<FiEdit2 />}
              aria-label="Edit ticket"
              size="sm"
              colorScheme="blue"
              variant="ghost"
              onClick={editDisclosure.onOpen}
            />
          )}
        </HStack>
      </Box>

      {/* Main Content + Sidebar */}
      <Box
        position="fixed"
        top="0"
        bottom="0"
        left="240px"
        right="0"
        display="flex"
        overflow="auto"
        pt={4}
        zIndex={10}
      >
        <Box flex="1" display="flex" flexDirection="column">
          <Box flex="1" overflowY="auto">
            <TicketChat
              ticketId={ticketId}
              currentUserId={currentUserId}
              isSupport={userRole !== 'customer'}
            />
          </Box>
        </Box>
        <TicketInfo
          ticket={ticket}
          customerEmail={customerEmail}
          userRole={userRole}
          currentUserId={currentUserId}
          onUpdate={fetchTicketDetails}
        />
      </Box>

      {/* Edit Ticket Modal */}
      <Modal 
        isOpen={editDisclosure.isOpen} 
        onClose={editDisclosure.onClose} 
        size="xl"
      >
        <ModalOverlay />
        <ModalContent maxW="800px">
          <ModalHeader>Edit Ticket</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <EditTicket
              ticket={ticket}
              onClose={editDisclosure.onClose}
              onUpdate={fetchTicketDetails}
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
} 
