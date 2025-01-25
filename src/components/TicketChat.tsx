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

export default function TicketChat({ ticketId, currentUserId, isSupport }: TicketChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    const loadMessagesIfMounted = async () => {
      if (isMounted) {
        await loadMessages();
      }
    };

    loadMessagesIfMounted();
    const subscription = setupMessagesSubscription();

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [ticketId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function setupMessagesSubscription() {
    return supabase
      .channel(`ticket-messages-${ticketId}`)
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
  }

  async function loadMessages() {
    try {
      if (!ticketId) {
        console.error('No ticket ID provided for TicketChat.');
        return;
      }

      // Create a new query each time
      const query = supabase
        .from('ticket_messages')
        .select('*, profiles(full_name)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      // If not support/admin, filter out internal messages
      if (!isSupport) {
        query.eq('is_internal', false);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }
      
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
      // Add more error details
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
    }
  }

  return (
    <Box height="100%" display="flex" flexDirection="column">
      <Box
        flex="1"
        overflowY="auto"
        p={4}
        bg="gray.50"
      >
        <VStack spacing={4} align="stretch" pt={2}>
          {messages.map((message) => (
            <Box
              key={message.id}
              alignSelf={message.user_id === currentUserId ? 'flex-end' : 'flex-start'}
              maxWidth={{ base: "85%", md: "50%" }}
              minWidth="auto"
              w="fit-content"
              ml={message.user_id === currentUserId ? 'auto' : '0'}
              mr={message.user_id === currentUserId ? '0' : 'auto'}
              bg={message.is_internal 
                ? 'yellow.100'
                : message.user_id === currentUserId 
                  ? 'green.100' 
                  : 'blue.100'
              }
              p={4}
              borderRadius="lg"
              boxShadow="sm"
              borderLeft={message.is_internal ? '4px solid orange' : undefined}
            >
              <HStack 
                spacing={2} 
                mb={2}
                justify="flex-start"
                flexWrap="wrap"
              >
                {message.user_id !== currentUserId && (
                  <Avatar size="sm" name={message.user?.full_name} />
                )}
                <VStack spacing={0} align="flex-start">
                  <Text fontSize="sm" fontWeight="bold" noOfLines={1}>
                    {message.user?.full_name}
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    {new Date(message.created_at).toLocaleString()}
                  </Text>
                </VStack>
                {message.user_id === currentUserId && (
                  <Avatar size="sm" name={message.user?.full_name} />
                )}
              </HStack>
              <Box>
                <Text 
                  whiteSpace="pre-wrap" 
                  textAlign="left"
                  wordBreak="break-word"
                >
                  {message.message}
                </Text>
              </Box>
              {message.is_internal && (
                <Badge colorScheme="orange" mt={2}>Internal Note</Badge>
              )}
            </Box>
          ))}
          <div ref={messagesEndRef} />
        </VStack>
      </Box>
    </Box>
  );
} 
