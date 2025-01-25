import { useEffect, useState, useContext, useMemo, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
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
  Wrap,
  WrapItem,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  PopoverArrow,
  Input,
  useColorModeValue,
  FormControl,
  FormLabel,
  Switch,
  Menu,
  MenuButton,
  MenuList,
  MenuGroup,
  MenuItem,
} from '@chakra-ui/react';
import { FiEdit2, FiPlus, FiX, FiChevronDown } from 'react-icons/fi';
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

interface User {
  id: string;
  email: string;
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
    full_name: string;
  };
  assigned_to: string;
  tags: Tag[];
}

interface Template {
  id: string;
  title: string;
  content: string;
  category: string;
}

interface TicketDetailsProps {
  ticketId: string;
  userRole: 'admin' | 'support' | 'customer';
}

export function TicketDetails({ ticketId, userRole }: TicketDetailsProps) {
  const { ticketId: paramTicketId } = useParams();
  const effectiveTicketId = ticketId || paramTicketId;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#808080');
  const toast = useToast();
  const editDisclosure = useDisclosure();
  const tagDisclosure = useDisclosure();
  const colorModeValue = useColorModeValue('gray.800', 'white');
  const [newMessage, setNewMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    fetchTicketDetails();
    getCurrentUser();
    fetchAvailableTags();
    if (currentUserId) {
      fetchTemplates();
    }

    const channel = setupTicketSubscription();
    
    return () => {
      channel.unsubscribe();
    }
  }, [effectiveTicketId, currentUserId]);

  async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  }

  async function fetchTicketDetails() {
    try {
      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .select(`
          *,
          customer:profiles!tickets_customer_id_fkey (
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
        .eq('id', effectiveTicketId)
        .single();

      if (ticketError) throw ticketError;

      // Transform the tags data structure
      const transformedTicket = {
        ...ticketData,
        tags: ticketData.tags.map((t: any) => t.tag)
      };

      // Then fetch the email from auth.users using RPC
      if (ticketData) {
        const { data: users, error: usersError } = await supabase
          .rpc('get_users', {});

        if (usersError) throw usersError;

        const customerUser = users?.find((u: User) => u.id === ticketData.customer_id);
        if (customerUser) {
          setCustomerEmail(customerUser.email);
        }

        setTicket(transformedTicket);
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

  async function fetchAvailableTags() {
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('name');

      if (error) throw error;
      setAvailableTags(data);
    } catch (error) {
      console.error('Error fetching tags:', error);
      toast({
        title: 'Error fetching tags',
        status: 'error',
        duration: 3000,
      });
    }
  }

  async function createTag() {
    if (!newTagName.trim()) return;

    try {
      const { data, error } = await supabase
        .from('tags')
        .insert({
          name: newTagName.trim(),
          color: newTagColor,
          created_by: currentUserId
        })
        .select()
        .single();

      if (error) throw error;

      setAvailableTags([...availableTags, data]);
      setNewTagName('');
      setNewTagColor('#808080');
      
      toast({
        title: 'Tag created successfully',
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      console.error('Error creating tag:', error);
      toast({
        title: 'Error creating tag',
        status: 'error',
        duration: 3000,
      });
    }
  }

  async function addTagToTicket(tagId: string) {
    try {
      const { error } = await supabase
        .from('ticket_tags')
        .insert({
          ticket_id: effectiveTicketId,
          tag_id: tagId,
          created_by: currentUserId
        });

      if (error) throw error;

      // Update local state
      const newTag = availableTags.find(t => t.id === tagId);
      if (newTag && ticket) {
        setTicket({
          ...ticket,
          tags: [...ticket.tags, newTag]
        });
      }

      toast({
        title: 'Tag added successfully',
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      console.error('Error adding tag:', error);
      toast({
        title: 'Error adding tag',
        status: 'error',
        duration: 3000,
      });
    }
  }

  async function removeTagFromTicket(tagId: string) {
    try {
      const { error } = await supabase
        .from('ticket_tags')
        .delete()
        .eq('ticket_id', effectiveTicketId)
        .eq('tag_id', tagId);

      if (error) throw error;

      // Update local state
      if (ticket) {
        setTicket({
          ...ticket,
          tags: ticket.tags.filter(t => t.id !== tagId)
        });
      }

      toast({
        title: 'Tag removed successfully',
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      console.error('Error removing tag:', error);
      toast({
        title: 'Error removing tag',
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
        .eq('id', effectiveTicketId);

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
        .eq('id', effectiveTicketId);

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
        .eq('id', effectiveTicketId);

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

  async function fetchTemplates() {
    if (userRole === 'customer' || !currentUserId) return;
    
    try {
      const { data, error } = await supabase
        .from('response_templates')
        .select('*')
        .or(`created_by.eq.${currentUserId},is_global.eq.true`)
        .order('category')
        .order('title');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  }

  function insertTemplate(content: string) {
    setNewMessage(prev => {
      const hasText = prev.trim().length > 0;
      return hasText ? `${prev}\n\n${content}` : content;
    });
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const { error } = await supabase
        .from('ticket_messages')
        .insert([
          {
            ticket_id: effectiveTicketId,
            user_id: currentUserId,
            message: newMessage.trim(),
            is_internal: isInternal,
          },
        ]);

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error sending message',
        status: 'error',
        duration: 3000,
      });
    }
  }

  if (!ticket) {
    return <Box p={6}>Loading ticket details...</Box>;
  }

  const canEdit = userRole === 'customer' && currentUserId === ticket.customer.id;
  const canManageTags = userRole === 'admin' || userRole === 'support';

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
        right="300px"
        height="80px"
        width="calc(100% - 540px)"
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

      {/* Main Content Area */}
      <Box
        position="fixed"
        top="80px"
        bottom="100px"
        left="240px"
        right="300px"
        width="calc(100% - 540px)"
        overflowY="hidden"
        display="flex"
        flexDirection="column"
        pt={4}
      >
        <TicketChat
          ticketId={effectiveTicketId}
          currentUserId={currentUserId}
          isSupport={userRole !== 'customer'}
        />
      </Box>

      {/* Fixed Footer for Message Input */}
      <Box
        p={4}
        bg="white"
        borderTop="1px"
        borderColor="gray.200"
        position="fixed"
        bottom="0"
        left="240px"
        right="300px"
        height="100px"
        width="calc(100% - 540px)"
        zIndex="10"
      >
        <form onSubmit={sendMessage}>
          <VStack spacing={4}>
            {userRole !== 'customer' && (
              <FormControl display="flex" alignItems="center">
                <FormLabel htmlFor="internal-note" mb="0">
                  Internal Note
                </FormLabel>
                <Switch
                  id="internal-note"
                  isChecked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                />
              </FormControl>
            )}
            <HStack w="100%">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={isInternal ? "Add an internal note..." : "Type a message..."}
                bg="white"
              />
              {userRole !== 'customer' && templates.length > 0 && (
                <Menu>
                  <MenuButton
                    as={IconButton}
                    icon={<FiChevronDown />}
                    variant="outline"
                    aria-label="Templates"
                  />
                  <MenuList>
                    {Array.from(new Set(templates.map(t => t.category))).map(category => (
                      <MenuGroup key={category} title={category.charAt(0).toUpperCase() + category.slice(1)}>
                        {templates
                          .filter(t => t.category === category)
                          .map(template => (
                            <MenuItem
                              key={template.id}
                              onClick={() => insertTemplate(template.content)}
                            >
                              {template.title}
                            </MenuItem>
                          ))}
                      </MenuGroup>
                    ))}
                  </MenuList>
                </Menu>
              )}
              <Button type="submit" colorScheme="blue">
                Send
              </Button>
            </HStack>
          </VStack>
        </form>
      </Box>

      {/* Right Sidebar */}
      <TicketInfo 
        ticket={ticket} 
        customerEmail={customerEmail} 
        userRole={userRole}
        currentUserId={currentUserId}
        onUpdate={fetchTicketDetails}
      />

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
