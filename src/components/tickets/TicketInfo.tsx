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
import { FiPlus, FiX, FiRefreshCw } from 'react-icons/fi';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Ticket } from './types';

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
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

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

  const generateSummary = async () => {
    setIsLoadingSummary(true);
    try {
      console.log('Starting summary generation for ticket:', ticket.id);
      
      // Log the Edge Function URL
      console.log('Edge Function URL:', `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/summarize-ticket`);
      
      // Log the request details
      const request = {
        body: { ticketId: ticket.id },
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      };
      console.log('Making request to Edge Function:', request);

      const { data, error } = await supabase.functions.invoke('summarize-ticket', request);

      console.log('Edge Function response:', { data, error });

      if (error) {
        console.error('Function error:', error);
        throw error;
      }
      
      // Log successful update
      console.log('Summary generated successfully:', data);
      onUpdate();
    } catch (error) {
      console.error('Error generating summary:', error);
      // Add more detailed error logging
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', await error.response.text());
      }
      if (error.message) {
        console.error('Error message:', error.message);
      }
      if (error.stack) {
        console.error('Error stack:', error.stack);
      }
    } finally {
      setIsLoadingSummary(false);
    }
  };

  return (
    <Box
      width="300px"
      height="100vh"
      position="fixed"
      right="0"
      top="0"
      bg="white"
      borderLeft="1px"
      borderColor="gray.200"
      p={4}
      overflowY="auto"
    >
      <VStack spacing={4} align="stretch">
        <Box>
          <Heading size="sm" mb={2}>Customer Information</Heading>
          <Text fontSize="sm">Name: {ticket.customer?.full_name}</Text>
          <Text fontSize="sm">Email: {customerEmail}</Text>
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

        <Box>
          <HStack justify="space-between" mb={2}>
            <Heading size="sm">AI Summary</Heading>
            {canManageTicket && (
              <IconButton
                icon={<FiRefreshCw />}
                aria-label="Generate summary"
                size="sm"
                variant="ghost"
                isLoading={isLoadingSummary}
                onClick={generateSummary}
              />
            )}
          </HStack>
          <Text fontSize="sm" fontStyle="italic">
            {ticket.ai_summary || 'No summary generated yet'}
          </Text>
        </Box>
      </VStack>
    </Box>
  );
} 