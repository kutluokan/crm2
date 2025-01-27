import {
  Box,
  VStack,
  Text,
  Heading,
  Divider,
  Badge,
  IconButton,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  PopoverArrow,
  Select,
  Input,
  Button,
  HStack,
  useDisclosure,
} from '@chakra-ui/react';
import { FiPlus, FiX } from 'react-icons/fi';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Ticket } from './types';
import { TicketAIAgent } from './TicketAIAgent';

interface TicketInfoProps {
  ticket: Ticket;
  customerEmail: string;
  userRole: 'admin' | 'support' | 'customer';
  currentUserId: string;
  onUpdate: () => void;
}

export function TicketInfo({ ticket, customerEmail, userRole, currentUserId, onUpdate }: TicketInfoProps) {
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#808080');
  const tagDisclosure = useDisclosure();
  const canManageTags = userRole === 'admin' || userRole === 'support';
  const [resolvedEmail, setResolvedEmail] = useState(customerEmail);

  useEffect(() => {
    if (!ticket.customer?.email) {
      fetchCustomerEmail(ticket.customer?.id);
    } else {
      setResolvedEmail(ticket.customer.email);
    }
  }, [ticket]);

  async function fetchCustomerEmail(customerId?: string) {
    if (!customerId) return;
    try {
      const { data: userData, error } = await supabase
        .rpc('get_users');
      
      if (error) throw error;
      if (userData) {
        const user = userData.find(u => u.id === customerId);
        if (user?.email) {
          setResolvedEmail(user.email);
        }
      }
    } catch (error) {
      console.error('Error fetching customer email:', error);
    }
  }

  // Fetch available tags when popover opens
  const handleTagPopoverOpen = async () => {
    tagDisclosure.onOpen();
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('name');

      if (error) throw error;
      setAvailableTags(data);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

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
    } catch (error) {
      console.error('Error creating tag:', error);
    }
  }

  async function addTagToTicket(tagId: string) {
    try {
      const { error } = await supabase
        .from('ticket_tags')
        .insert({
          ticket_id: ticket.id,
          tag_id: tagId,
          created_by: currentUserId
        });

      if (error) throw error;
      onUpdate();
      tagDisclosure.onClose();
    } catch (error) {
      console.error('Error adding tag:', error);
    }
  }

  async function removeTagFromTicket(tagId: string) {
    try {
      const { error } = await supabase
        .from('ticket_tags')
        .delete()
        .eq('ticket_id', ticket.id)
        .eq('tag_id', tagId);

      if (error) throw error;
      onUpdate();
    } catch (error) {
      console.error('Error removing tag:', error);
    }
  }

  async function updateTicketStatus(newStatus: string) {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: newStatus })
        .eq('id', ticket.id);

      if (error) throw error;
      onUpdate();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  }

  async function updateTicketPriority(newPriority: string) {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ priority: newPriority })
        .eq('id', ticket.id);

      if (error) throw error;
      onUpdate();
    } catch (error) {
      console.error('Error updating priority:', error);
    }
  }

  const canManageTicket = userRole === 'admin' || userRole === 'support';

  return (
    <Box
      width="300px"
      minWidth="200px"
      maxWidth="600px"
      style={{ direction: 'rtl' }}
      resize="horizontal"
      overflowY="auto"
      bg="white"
      borderLeft="1px"
      borderColor="gray.200"
      p={4}
    >
      <Box style={{ direction: 'ltr', width: '100%' }}>
        <VStack spacing={4} align="stretch">
          <Box>
            <Heading size="sm" mb={2}>Customer Information</Heading>
            <Text fontSize="sm">Name: {ticket.customer?.full_name}</Text>
            <Text fontSize="sm">Email: {resolvedEmail}</Text>
          </Box>

          <Divider />

          <Box>
            <Heading size="sm" mb={2}>Ticket Details</Heading>
            <VStack align="stretch" spacing={3}>
              <Box>
                <Text fontSize="sm" mb={1}>ID: #{ticket.id}</Text>
                <Text fontSize="sm" mb={1}>Created: {new Date(ticket.created_at).toLocaleDateString()}</Text>
              </Box>

              <Divider />

              <Box>
                <Text fontSize="sm" fontWeight="bold" mb={1}>Status:</Text>
                {canManageTicket ? (
                  <Select
                    size="sm"
                    value={ticket.status}
                    onChange={(e) => updateTicketStatus(e.target.value)}
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </Select>
                ) : (
                  <Badge colorScheme={
                    ticket.status === 'open' ? 'red' : 
                    ticket.status === 'in_progress' ? 'yellow' : 
                    'green'
                  }>{ticket.status}</Badge>
                )}
              </Box>

              <Box>
                <Text fontSize="sm" fontWeight="bold" mb={1}>Priority:</Text>
                {canManageTicket ? (
                  <Select
                    size="sm"
                    value={ticket.priority}
                    onChange={(e) => updateTicketPriority(e.target.value)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </Select>
                ) : (
                  <Badge colorScheme={
                    ticket.priority === 'urgent' ? 'red' : 
                    ticket.priority === 'high' ? 'orange' : 
                    ticket.priority === 'medium' ? 'yellow' : 
                    'green'
                  }>{ticket.priority}</Badge>
                )}
              </Box>
            </VStack>
          </Box>

          <Divider />

          <Box>
            <HStack justify="space-between" mb={2}>
              <Heading size="sm">Tags</Heading>
              {canManageTags && (
                <Popover
                  isOpen={tagDisclosure.isOpen}
                  onClose={tagDisclosure.onClose}
                  onOpen={handleTagPopoverOpen}
                >
                  <PopoverTrigger>
                    <IconButton
                      icon={<FiPlus />}
                      aria-label="Add tag"
                      size="sm"
                      variant="ghost"
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
                              onClick={createTag}
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
              )}
            </HStack>
            {ticket.tags?.length > 0 ? (
              <VStack spacing={2} align="stretch">
                {ticket.tags.map((tag) => (
                  <HStack key={tag.id}>
                    <Badge
                      flex="1"
                      bg={tag.color}
                      color="gray.800"
                      px={2}
                      py={1}
                      borderRadius="full"
                    >
                      {tag.name}
                    </Badge>
                    {canManageTags && (
                      <IconButton
                        icon={<FiX />}
                        aria-label="Remove tag"
                        size="xs"
                        variant="ghost"
                        onClick={() => removeTagFromTicket(tag.id)}
                      />
                    )}
                  </HStack>
                ))}
              </VStack>
            ) : (
              <Text fontSize="sm">No tags</Text>
            )}
          </Box>

          <Divider />

          <TicketAIAgent
            ticketId={ticket.id}
            userRole={userRole}
            onUpdate={onUpdate}
          />
        </VStack>
      </Box>
    </Box>
  );
} 
