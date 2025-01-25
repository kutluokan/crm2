import { useEffect, useState } from 'react';
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
} from '@chakra-ui/react';
import { FiEdit2, FiPlus, FiX } from 'react-icons/fi';
import { supabase } from '../../lib/supabase';
import TicketChat from '../TicketChat';
import { EditTicket } from './EditTicket';
import { RealtimeChannel } from '@supabase/supabase-js';

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
  const { isOpen, onOpen, onClose } = useDisclosure();
  const tagPopover = useDisclosure();

  useEffect(() => {
    fetchTicketDetails();
    getCurrentUser();
    fetchAvailableTags();

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
          ticket_id: ticketId,
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
        .eq('ticket_id', ticketId)
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
        right="0"
        width="calc(100% - 240px)"
        zIndex="10"
        display="flex"
        flexDirection="column"
      >
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

            <Box mt={4}>
              <Heading size="md">Conversation</Heading>
            </Box>

            {/* Tags Section */}
            <Wrap mt={2} spacing={2}>
              {ticket.tags?.map((tag) => (
                <WrapItem key={tag.id}>
                  <Badge
                    bg={tag.color}
                    color={useColorModeValue('gray.800', 'white')}
                    px={2}
                    py={1}
                    borderRadius="full"
                  >
                    {tag.name}
                    {canManageTags && (
                      <IconButton
                        icon={<FiX />}
                        aria-label="Remove tag"
                        size="xs"
                        ml={1}
                        variant="ghost"
                        onClick={() => removeTagFromTicket(tag.id)}
                      />
                    )}
                  </Badge>
                </WrapItem>
              ))}
              {canManageTags && (
                <WrapItem>
                  <Popover
                    isOpen={tagPopover.isOpen}
                    onClose={tagPopover.onClose}
                    placement="bottom-start"
                  >
                    <PopoverTrigger>
                      <IconButton
                        icon={<FiPlus />}
                        aria-label="Add tag"
                        size="sm"
                        variant="ghost"
                        onClick={tagPopover.onOpen}
                      />
                    </PopoverTrigger>
                    <PopoverContent p={4} width="300px">
                      <PopoverArrow />
                      <PopoverBody>
                        <VStack spacing={4}>
                          <Box width="100%">
                            <Text mb={2} fontWeight="bold">Add Existing Tag</Text>
                            <Select
                              placeholder="Select a tag"
                              onChange={(e) => {
                                if (e.target.value) {
                                  addTagToTicket(e.target.value);
                                  tagPopover.onClose();
                                }
                              }}
                            >
                              {availableTags
                                .filter(tag => !ticket.tags?.some(t => t.id === tag.id))
                                .map(tag => (
                                  <option key={tag.id} value={tag.id}>
                                    {tag.name}
                                  </option>
                                ))}
                            </Select>
                          </Box>
                          <Divider />
                          <Box width="100%">
                            <Text mb={2} fontWeight="bold">Create New Tag</Text>
                            <VStack spacing={2}>
                              <Input
                                placeholder="Tag name"
                                value={newTagName}
                                onChange={(e) => setNewTagName(e.target.value)}
                              />
                              <Input
                                type="color"
                                value={newTagColor}
                                onChange={(e) => setNewTagColor(e.target.value)}
                              />
                              <Button
                                width="100%"
                                onClick={() => {
                                  createTag();
                                  tagPopover.onClose();
                                }}
                                isDisabled={!newTagName.trim()}
                              >
                                Create Tag
                              </Button>
                            </VStack>
                          </Box>
                        </VStack>
                      </PopoverBody>
                    </PopoverContent>
                  </Popover>
                </WrapItem>
              )}
            </Wrap>
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
      <Box
        flex="1"
        display="flex"
        flexDirection="column"
        position="relative"
        mt="24"
        overflow="hidden"
      >
        
        <Box flex="1" overflow="auto">
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
