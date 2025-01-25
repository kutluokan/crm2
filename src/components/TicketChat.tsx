import { useEffect, useState, useRef } from 'react';
import {
  Box,
  Input,
  Button,
  VStack,
  HStack,
  Text,
  Avatar,
  Switch,
  FormControl,
  FormLabel,
  Badge,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuGroup,
  IconButton,
} from '@chakra-ui/react';
import { FiChevronDown } from 'react-icons/fi';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface UserProfile {
  full_name: string;
}

interface Message {
  id: string;
  message: string;
  created_at: string;
  user_id: string;
  is_internal: boolean;
  user: UserProfile;
}

interface TicketChatProps {
  ticketId: string;
  currentUserId: string;
  isSupport: boolean;
}

interface Template {
  id: string;
  title: string;
  content: string;
  category: string;
}

export default function TicketChat(props: TicketChatProps) {
  const { ticketId: paramTicketId } = useParams();
  const ticketId = props.ticketId || paramTicketId;
  const { currentUserId, isSupport } = props;

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    setupMessagesSubscription();
    if (isSupport) {
      fetchTemplates();
    }
  }, [ticketId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function loadMessages() {
    try {
      // First, get the messages
      let query = supabase
        .from('ticket_messages')
        .select('*, profiles(full_name)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (!ticketId) {
        console.error('No ticket ID provided for TicketChat.');
        return;
      }

      // If not support/admin, filter out internal messages
      if (!isSupport) {
        query = query.eq('is_internal', false);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Transform the data to ensure it matches our Message type
      const transformedMessages: Message[] = (data || []).map(msg => ({
        id: msg.id,
        message: msg.message,
        created_at: msg.created_at,
        user_id: msg.user_id,
        is_internal: msg.is_internal,
        user: {
          full_name: msg.profiles?.full_name || 'Unknown User'
        }
      }));

      setMessages(transformedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }

  async function fetchTemplates() {
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

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const { error } = await supabase
        .from('ticket_messages')
        .insert([
          {
            ticket_id: ticketId,
            user_id: currentUserId,
            message: newMessage.trim(),
            is_internal: isInternal,
          },
        ]);

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  function setupMessagesSubscription() {
    const channel = supabase
      .channel('ticket-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_messages',
          filter: `ticket_id=eq.${ticketId}`,
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }

  return (
    <Box h="100%" display="flex" flexDirection="column">
      <Box
        ref={chatContainerRef}
        flex="1"
        overflowY="auto"
        p={4}
        bg="gray.50"
      >
        <VStack spacing={4} align="stretch">
          {messages.map((message) => (
            <Box
              key={message.id}
              bg={message.is_internal ? 'yellow.100' : 'white'}
              p={3}
              borderRadius="md"
              boxShadow="sm"
              borderLeft={message.is_internal ? '4px solid orange' : undefined}
            >
              <HStack spacing={2} mb={2}>
                <Avatar size="sm" name={message.user?.full_name} />
                <Text fontWeight="bold">{message.user?.full_name}</Text>
                <Text fontSize="sm" color="gray.500">
                  {new Date(message.created_at).toLocaleString()}
                </Text>
                {message.is_internal && (
                  <Badge colorScheme="orange">Internal Note</Badge>
                )}
              </HStack>
              <Text whiteSpace="pre-wrap">{message.message}</Text>
            </Box>
          ))}
          <div ref={messagesEndRef} />
        </VStack>
      </Box>

      <Box
        p={4}
        bg="white"
        borderTop="1px"
        borderColor="gray.200"
        position="fixed"
        bottom="0"
        left="240px"
        right="0"
        width="calc(100% - 240px)"
        zIndex="10"
      >
        <form onSubmit={sendMessage}>
          <VStack spacing={4}>
            {isSupport && (
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
              {isSupport && templates.length > 0 && (
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
    </Box>
  );
} 
